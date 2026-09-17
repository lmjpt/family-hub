# 우리집 안드로이드 앱

웹앱을 그대로 전체 화면으로 띄우는 껍데기(Trusted Web Activity)에 **바탕화면 위젯** 하나를
더한 것입니다. 화면 코드는 여기 없습니다 — 앱은 `https://lmjpt.github.io/family-hub/` 를
크롬으로 띄우므로, 웹을 배포하면 앱 화면도 그 즉시 바뀝니다. 알림·서비스 워커도 웹 것이
그대로 동작합니다.

```
android/app/src/main/
  AndroidManifest.xml                         진입점(LauncherActivity) + 위젯 + 토큰 받는 Activity
  java/io/github/lmjpt/familyhub/
    TodayWidget.kt        위젯 본체. 30분마다 / 앱에서 연결할 때 갱신
    WidgetData.kt         서버(Edge Function 'widget')에서 줄을 받아 그림
    WidgetLinkActivity.kt familyhub://widget?token=... 을 받아 토큰을 저장
  res/layout/widget.xml   위젯 모양 (줄 6개)
```

## 어떻게 만들어지나

- 빌드는 이 PC 가 아니라 **GitHub Actions** 가 합니다 (`.github/workflows/android.yml`).
  `android/` 아래가 바뀌면 자동으로 돌고, 결과 APK 는 항상 같은 주소에 올라갑니다:
  `https://github.com/lmjpt/family-hub/releases/latest/download/family-hub.apk`
- 서명 키 원본은 PC 의 `android-signing.local/` (git 에 안 올라감). **잃어버리면 기존 설치
  위에 업데이트할 수 없으니** 어딘가에 백업해 두세요. GitHub secret 세 개가 그 복사본입니다.
- 앱이 주소창 없이 뜨려면 사이트 루트에 `/.well-known/assetlinks.json` 이 있어야 합니다.
  그 파일은 `lmjpt/lmjpt.github.io` 저장소에 있고, 서명 키의 SHA-256 지문이 적혀 있습니다.
  키를 바꾸면 그 파일도 바꿔야 합니다.

## 위젯이 데이터를 받는 길

```
폰 위젯 ──(위젯 토큰)──▶ Edge Function 'widget' ──▶ 오늘 일정·마감 줄들(한국어)
```

위젯은 웹의 로그인 세션을 볼 수 없습니다. 그래서 웹 화면의 **설정 → 위젯 연결** 을 누르면
`widget_token` 에 한 줄이 생기고, 크롬이 `familyhub://widget?token=...` 을 앱에 넘겨서
폰에 저장됩니다. 위젯은 그 토큰만으로 함수를 부릅니다. 토큰 하나가 구성원 하나를 가리키므로
"그 폰에 로그인한 사람 것만" 보입니다.

## 서버 쪽 준비 (한 번만, Supabase 대시보드)

1. `supabase/schema.sql` 을 SQL Editor 에서 다시 실행 → `widget_token` 표가 생깁니다.
2. Edge Functions → Deploy a new function → Via Editor → 이름 **`widget`** →
   `supabase/functions/widget/index.ts` 내용을 붙여넣고 Deploy.
   이름이 다르면 `WidgetData.kt` 의 `ENDPOINT` 끝부분도 맞춰야 합니다.
3. 그 함수의 **Verify JWT 를 끕니다.** (토큰이 JWT 가 아니라서 켜 두면 401)
   secret 은 필요 없습니다. Supabase 가 자동으로 넣어 주는 값만 씁니다.

## 폰에 설치하고 위젯 붙이기

1. 폰 크롬에서 위 APK 주소를 열어 내려받고 설치합니다. "출처를 알 수 없는 앱" 경고가 나오면
   크롬에 설치 허용을 줍니다. 스토어에 올리지 않은 앱이라 그렇습니다.
2. 설치된 **우리집** 앱을 열고 로그인 → 설정 → **위젯 연결**.
3. 바탕화면 빈 곳을 길게 눌러 위젯 → **우리집 오늘** 을 추가합니다.

## 앱을 고칠 때

- 화면·기능은 웹만 고치면 됩니다. APK 다시 만들 필요 없습니다.
- 위젯 모양이나 앱 껍데기를 고치면 `android/app/build.gradle.kts` 의 `versionCode` 를
  1 올리고 푸시하세요. 가족은 APK 를 다시 받아 설치하면 됩니다.
