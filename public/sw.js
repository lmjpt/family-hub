// 푸시 알림 전용 서비스 워커.
//
// 일부러 아무것도 캐시하지 않습니다 (fetch 핸들러 없음). 캐시를 하면 새 버전을
// 배포해도 폰에 옛 화면이 남는 문제가 생기는데, 가족 앱에서 그걸 감수할 이유가
// 없습니다. 이 파일이 하는 일은 두 가지뿐입니다:
//   1. 서버(Edge Function)가 보낸 푸시를 받아 알림으로 띄운다
//   2. 알림을 누르면 앱을 열거나 이미 열린 앱을 앞으로 가져온다

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '우리집'
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    // 같은 tag 는 새 알림이 이전 것을 덮어씁니다. 대화가 여러 개 와도 한 줄만 남게.
    tag: data.tag || 'family-hub',
    renotify: true,
    data: { url: data.url || './' },
  }
  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      // 알림을 못 띄우면 왜인지 남겨 둡니다 (chrome://inspect 로 볼 수 있음).
      console.error('알림 표시 실패', err)
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope)) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
