// 안드로이드 앱 껍데기. 화면은 웹(https://lmjpt.github.io/family-hub/)을 그대로 띄우고,
// 이 프로젝트가 직접 가진 것은 바탕화면 위젯 하나입니다.
// 빌드는 GitHub Actions(.github/workflows/android.yml)에서만 합니다.
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
