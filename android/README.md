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
폰에 저장됩니다. 위젯은 그 토큰만으로 함수를 부릅니다. 토큰 하나가 구성원 하나를 가리킵니다.

- **부모** 위젯: 가족 전체 일정 + 모든 아이의 오늘 할일·숙제. 남의 것에는 `· 👧이름` 이 붙습니다.
- **아이** 위젯: 자기 일정(가족 전체 일정 포함)과 자기 할일·숙제만.

앱의 권한 표(부모는 전부, 아이는 본인 것)와 같은 기준입니다.

## 서버 쪽 준비 (한 번만, Supabase 대시보드)

1. `supabase/schema.sql` 을 SQL Editor 에서 다시 실행 → `widget_token` 표가 생깁니다.
2. Edge Functions → Deploy a new function → Via Editor → 이름 **`widget`** →
   `supabase/functions/widget/index.ts` 내용을 붙여넣고 Deploy.
   이름이 다르면 `WidgetData.kt` 의 `ENDPOINT` 끝부분도 맞춰야 합니다.
3. Verify JWT 는 켜 두어도 됩니다. 위젯이 `apikey` 헤더(publishable 키)를 함께 보내서
   게이트웨이를 통과하고, 위젯 토큰은 `X-Widget-Token` 헤더로 따로 보냅니다.
   secret 은 필요 없습니다. Supabase 가 자동으로 넣어 주는 값만 씁니다.

### 위젯에 뜨는 문구로 원인 찾기

| 문구 | 뜻 |
| --- | --- |
| 앱을 열고 설정 → 위젯 연결을 눌러 주세요 | 폰에 토큰이 없음. 앱에서 연결 버튼 |
| 연결이 끊겼어요… | 서버가 401. 토큰이 표에 없음(schema.sql 안 돌림) 또는 함수 코드가 옛 버전 |
| 서버에 widget 함수가 아직 없어요 | 함수를 아직 배포하지 않았거나 이름이 `widget` 이 아님 |
| 불러오지 못했어요 (500) + 원인 | 함수 안에서 오류. 그 아래 줄이 원인 문구 |
| 인터넷에 연결되어 있는지… | 폰이 오프라인 |

## 폰에 설치하고 위젯 붙이기

1. 폰 크롬에서 위 APK 주소를 열어 내려받고 설치합니다. "출처를 알 수 없는 앱" 경고가 나오면
   크롬에 설치 허용을 줍니다. 스토어에 올리지 않은 앱이라 그렇습니다.
2. 설치된 **우리집** 앱을 열고 로그인 → 설정 → **위젯 연결**.
3. 바탕화면 빈 곳을 길게 눌러 위젯 → **우리집 오늘** 을 추가합니다.

## 위젯 레이아웃을 고칠 때 (중요)

위젯 화면(RemoteViews)은 쓸 수 있는 요소가 정해져 있습니다: `LinearLayout`, `FrameLayout`,
`RelativeLayout`, `TextView`, `ImageView`, `Button`, `ProgressBar` 정도입니다. plain `View`,
`ConstraintLayout`, 커스텀 뷰를 넣으면 빌드는 되지만 **폰에서 빈 상자만 보입니다.**

## 라이브러리·빌드 도구 버전은 올리지 마세요

androidbrowserhelper **2.5.0 + AGP 8.7.3 + compileSdk 35 + Gradle 8.11.1** 조합이 검증된 것입니다.
2.7.3(+AGP 8.11, compileSdk 36)으로 올린 1.6/1.7 은 폰에서 앱이 켜지자마자 꺼졌습니다. 원인은
확인하지 못했고(로그를 볼 수 없는 환경), 되돌린 1.8 로 정상화했습니다.

진입점 이름은 `com.google.androidbrowserhelper.trusted.LauncherActivity` 별칭으로 유지합니다.
바탕화면 아이콘이 이 이름을 가리키고 있어서, 바꾸면 아이콘이 깨집니다.

## 앱은 크롬이 있으면 크롬으로 엽니다 (1.8+)

`MainActivity` 가 크롬(`com.android.chrome`)이 설치·사용 가능하면 크롬으로, 아니면 기본 브라우저로
엽니다. 삼성 폰은 기본 브라우저가 삼성 인터넷인데, 그걸로 열리면 알림이 "인터넷" 이름으로 오고
앱 이름 위임이 안 됩니다. 크롬이 '사용 중지' 된 폰은 설정 → 애플리케이션 → Chrome → 사용 을 눌러
켜 주세요. (1.6 은 크롬을 강제해서 크롬이 꺼진 폰에서 안내 창에 막혀 앱이 안 열렸습니다.)
브라우저를 바꾼 뒤에는 서비스 워커·푸시 구독이 새 브라우저에 새로 생기므로, **앱에서 알림을 끄고
다시 켜야** 합니다(옛 브라우저 구독은 함수가 만료 응답을 받으면 자동으로 지웁니다).

## 알림이 안 올 때

앱의 알림은 웹 푸시이고, 크롬이 대신 띄웁니다. 앱(1.4+)에 알림 위임(DelegationService +
NotificationPermissionRequestActivity)이 있어서:

- 앱 설정 → 알림 켜기를 누르면 **우리집 앱의 권한 창**이 뜹니다 (크롬 사이트 권한이 아님).
- 폰 설정 → 앱 → 알림에 **우리집** 이 나타나고, 알림도 우리집 아이콘·이름으로 옵니다.

이게 '하이브리드' 의 실제 모습입니다: 내용은 웹이, 알림의 얼굴과 권한은 앱이 맡습니다.

- 앱의 설정 → 알림 버튼이 "폰 설정에서 허용해 주세요" 라고 하면 크롬이 이 사이트를 **차단**으로
  기억한 것입니다. 크롬 → ⋮ → 설정 → 사이트 설정 → 알림 → 차단됨 목록에서 `lmjpt.github.io`
  를 허용으로 바꾸거나 지운 뒤, 앱에서 다시 켭니다.
- 폰 설정 → 앱 → Chrome → 알림이 꺼져 있으면 모든 사이트 알림이 막힙니다.
- 서버: `push-webhook.sql.local` 트리거를 실행했는지, 함수 Secrets 에 VAPID 두 개가 있는지.
  SQL Editor 에서 `select * from net._http_response order by created desc limit 5;` 를 보면
  최근 웹훅 호출의 응답 코드가 나옵니다. 200 이 아니면 함수 쪽 문제입니다.

## 앱을 고칠 때

- 화면·기능은 웹만 고치면 됩니다. APK 다시 만들 필요 없습니다.
- 위젯 모양이나 앱 껍데기를 고치면 `android/app/build.gradle.kts` 의 `versionCode` 를
  1 올리고 푸시하세요. 가족은 APK 를 다시 받아 설치하면 됩니다.
