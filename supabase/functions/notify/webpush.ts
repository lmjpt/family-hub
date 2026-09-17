// 웹 푸시(RFC 8291 aes128gcm + RFC 8292 VAPID)를 WebCrypto 만으로 구현합니다.
//
// npm:web-push 는 Node 의 crypto 모듈에 기대는데, Deno(Supabase Edge) 위에서는
// 겉으로는 성공(201)해도 폰의 크롬이 풀 수 없는 암호문을 만드는 일이 있었습니다.
// 그래서 어디서나 같은 결과가 나오는 표준 WebCrypto 로 직접 만듭니다. 의존성 없음.
// 검증: Node 의 http_ece(web-push 의 복호화 구현)로 풀어서 평문이 그대로 나오는지 확인했습니다.

export interface PushSubscriptionKeys {
  endpoint: string
  /** 구독자의 공개키 (base64url, 65바이트 raw) */
  p256dh: string
  /** 구독자의 인증 비밀 (base64url, 16바이트) */
  auth: string
}

export interface VapidKeys {
  /** base64url, 65바이트 raw 공개키 */
  publicKey: string
  /** base64url, 32바이트 d */
  privateKey: string
  /** 'mailto:...' 또는 https 주소 */
  subject: string
}

export interface SendOptions {
  /** 초 단위. 푸시 서비스가 폰이 꺼져 있을 때 보관하는 시간 */
  ttl?: number
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

export interface SendResult {
  ok: boolean
  status: number
  body: string
}

const enc = new TextEncoder()

export function b64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

export function bytesToB64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** WebCrypto 는 ArrayBuffer 를 원합니다 (TS 5.7+ 의 엄격한 typed array 타입 대응). */
function toBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength)
  new Uint8Array(out).set(u8)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** HKDF-SHA256 (extract + expand 를 WebCrypto 가 한 번에 해 줍니다) */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toBuffer(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toBuffer(salt), info: toBuffer(info) },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/** RFC 8291: 구독자 공개키·auth 로 본문을 암호화합니다. 결과는 aes128gcm 본문 전체. (테스트용으로 export) */
export async function encrypt(sub: PushSubscriptionKeys, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(sub.p256dh) // 65 bytes
  const authSecret = b64urlToBytes(sub.auth) // 16 bytes

  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey)) // 65 bytes
  const uaKey = await crypto.subtle.importKey(
    'raw',
    toBuffer(uaPublic),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256),
  )

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // 마지막(유일한) 레코드: 본문 뒤에 구분자 0x02
  const padded = concat(plaintext, new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', toBuffer(cek), 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toBuffer(nonce), tagLength: 128 },
      aesKey,
      toBuffer(padded),
    ),
  )

  // 헤더: salt(16) | rs(4, big-endian) | idlen(1) | as_public(65)
  const rs = 4096
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, rs)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** RFC 8292: 푸시 서비스에 우리가 누구인지 증명하는 짧은 JWT (ES256) */
async function vapidHeader(endpoint: string, vapid: VapidKeys): Promise<string> {
  const pub = b64urlToBytes(vapid.publicKey)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: vapid.privateKey,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: vapid.subject,
      }),
    ),
  )
  const signingInput = `${header}.${payload}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput))
  // WebCrypto 의 ECDSA 서명은 r||s 64바이트 — JWS ES256 이 원하는 형식 그대로입니다.
  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${vapid.publicKey}`
}

/** 구독 하나에 푸시를 보냅니다. 던지지 않고 결과를 돌려줍니다. */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: string,
  vapid: VapidKeys,
  options: SendOptions = {},
): Promise<SendResult> {
  const body = await encrypt(sub, enc.encode(payload))
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(options.ttl ?? 60 * 60 * 24),
      Urgency: options.urgency ?? 'normal',
      Authorization: await vapidHeader(sub.endpoint, vapid),
    },
    body: toBuffer(body),
  })
  const text = await res.text().catch(() => '')
  return { ok: res.status >= 200 && res.status < 300, status: res.status, body: text }
}
