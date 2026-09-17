# 푸시 알림 설정 (한 번만)

앱을 닫아 둔 폰에도 새 대화·댓글을 알려 주려면 서버 쪽에 세 가지가 있어야 합니다.
브라우저(앱) 쪽 코드는 이미 배포되어 있으니, 아래는 **Supabase 대시보드에서 하는 일**입니다.

```
새 글이 생김 ──▶ Database Webhook ──▶ Edge Function 'notify' ──▶ 폰으로 푸시
 (message,         (3번)                 (1번 + 2번 secret)
  comment)
```

## 0. 테이블

`supabase/schema.sql` 을 SQL Editor 에서 다시 실행합니다. `comment`, `push_subscription`
테이블이 생깁니다. 여러 번 실행해도 안전합니다.

## 1. Edge Function 배포

`supabase/functions/notify/index.ts` 가 함수 코드입니다. 둘 중 편한 방법으로:

**대시보드에서 (회사망에서도 됨)**
Edge Functions → *Deploy a new function* → *Via Editor* → 이름 `notify` →
`index.ts` 내용을 통째로 붙여넣기 → *Deploy*.

**CLI 로 (집에서)**

```bash
npx supabase login
npx supabase functions deploy notify --project-ref cluemjqdqqtmkezjqcag
```

## 2. Secret 두 개

키는 `supabase/vapid-keys.local` 에 있습니다 (git 에 올라가지 않음).

Edge Functions → *Secrets* 에 아래 두 개를 추가합니다. 이름은 정확히 이대로:

| 이름 | 값 |
| --- | --- |
| `VAPID_PUBLIC_KEY` | vapid-keys.local 의 공개 키 |
| `VAPID_PRIVATE_KEY` | vapid-keys.local 의 비밀 키 |

CLI 라면 한 줄로: `npx supabase secrets set --env-file supabase/vapid-keys.local --project-ref cluemjqdqqtmkezjqcag`

> 공개 키는 `src/lib/push.ts` 에도 들어 있습니다. **키를 새로 만들면 안 됩니다** —
> 이미 알림을 켜 둔 기기의 구독이 전부 무효가 됩니다.

## 3. 트리거 (새 글 → 함수 호출)

`supabase/push-webhook.sql.local` 내용을 SQL Editor 에서 실행합니다
(프로젝트 주소와 anon 키가 채워져 있어 git 에 올라가지 않는 파일입니다).

대시보드의 Database Webhooks 화면이나 *Enable webhooks* 버튼은 **필요 없습니다.**
이 SQL 은 `pg_net` 확장을 직접 켜고, `message`/`comment` 에 INSERT 가 생기면
`net.http_post` 로 함수를 부르는 트리거를 만듭니다. 웹훅 화면이 만드는 것과 같은 내용입니다.

함수 쪽에서는 **Verify JWT 를 꺼 두세요.** 우리 키는 `sb_publishable_` 형식이라 JWT 가
아니어서, 검증을 켜 두면 호출이 거부됩니다. 함수는 넘어온 내용을 믿지 않고 항상 DB 에서
다시 읽으므로 꺼도 위험이 거의 없습니다.

## 4. 확인

1. 폰 두 대에서 앱을 열고 **설정 → 알림 → 켜기**. 아이폰은 홈 화면에 추가한 아이콘으로 열어야 켤 수 있습니다.
2. 한 대에서 대화를 보냅니다. 다른 대는 앱을 닫아 두어도 알림이 옵니다.
3. 안 오면 Edge Functions → notify → *Logs* 를 봅니다. `sent: 0` 이면 구독이 없는 것이고,
   `푸시 실패` 가 찍히면 secret 이 틀린 경우가 대부분입니다.

## 알림이 "보냈어요" 인데 폰에 안 뜰 때

- 함수는 외부 라이브러리(npm:web-push) 없이 WebCrypto 로 직접 암호화합니다. 예전 npm 방식은
  Deno 위에서 겉으로는 성공(201)해도 크롬이 풀 수 없는 암호문을 만들 수 있었습니다.
- 크롬은 푸시가 도착한 순간 알림 권한이 없다고 판단하면 **그 구독을 조용히 폐기**합니다(다음 발송은
  410). 그러면 `push_subscription` 에 옛 줄이 남고 폰은 다시 켜야 합니다. 앱(TWA)에서는 "권한" 이
  우리집 앱의 알림 권한이므로, 폰 설정 → 애플리케이션 → 우리집 → 알림이 켜져 있어야 합니다.
- 함수는 404/410 을 받으면 그 줄을 지웁니다. 남은 줄 수는 SQL 로 확인:
  `select m.name, count(*) from push_subscription s join member m on m.id=s.member_id group by 1;`

## 알아 둘 것

- 본인이 쓴 글은 본인 기기에 알리지 않습니다.
- 알림을 꺼서 무효가 된 구독은 함수가 보낼 때 자동으로 정리합니다.
- 서비스 워커(`public/sw.js`)는 알림만 담당하고 **아무것도 캐시하지 않습니다.**
  새 버전을 배포하면 폰에도 그대로 반영됩니다.
