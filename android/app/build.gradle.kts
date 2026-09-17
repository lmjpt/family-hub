plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.lmjpt.familyhub"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.lmjpt.familyhub"
        minSdk = 24
        targetSdk = 35
        // 버전을 올릴 때는 두 줄을 함께. versionCode 는 설치된 것보다 커야 업데이트됩니다.
        versionCode = 2
        versionName = "1.1"
    }

    // 서명 키는 GitHub Actions 의 secret 에서 옵니다 (android-signing.local 폴더 원본).
    // 로컬에서 환경 변수가 없으면 서명 없이 빌드만 됩니다.
    signingConfigs {
        create("release") {
            val ks = System.getenv("KEYSTORE_FILE")
            if (ks != null) {
                storeFile = rootProject.file(ks)
                storeType = "PKCS12"
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Trusted Web Activity: 크롬으로 우리 웹앱을 전체 화면으로 띄워 줍니다.
    // 덕분에 푸시 알림·서비스 워커가 웹에서 만든 그대로 동작합니다.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
    implementation("androidx.core:core-ktx:1.13.1")
}
