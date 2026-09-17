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

## 3. 웹훅 (새 글 → 함수 호출)

Database → *Webhooks* 에서 처음이면 *Enable webhooks* 를 한 번 누릅니다.
그 다음 `supabase/push-webhook.sql.local` 내용을 SQL Editor 에서 실행합니다
(프로젝트 주소와 anon 키가 채워져 있어 git 에 올라가지 않는 파일입니다).

손으로 만들고 싶으면 Webhooks 화면에서 두 개를 만듭니다:
`message` INSERT → Edge Function `notify`, `comment` INSERT → Edge Function `notify`.

## 4. 확인

1. 폰 두 대에서 앱을 열고 **설정 → 알림 → 켜기**. 아이폰은 홈 화면에 추가한 아이콘으로 열어야 켤 수 있습니다.
2. 한 대에서 대화를 보냅니다. 다른 대는 앱을 닫아 두어도 알림이 옵니다.
3. 안 오면 Edge Functions → notify → *Logs* 를 봅니다. `sent: 0` 이면 구독이 없는 것이고,
   `푸시 실패` 가 찍히면 secret 이 틀린 경우가 대부분입니다.

## 알아 둘 것

- 본인이 쓴 글은 본인 기기에 알리지 않습니다.
- 알림을 꺼서 무효가 된 구독은 함수가 보낼 때 자동으로 정리합니다.
- 서비스 워커(`public/sw.js`)는 알림만 담당하고 **아무것도 캐시하지 않습니다.**
  새 버전을 배포하면 폰에도 그대로 반영됩니다.
