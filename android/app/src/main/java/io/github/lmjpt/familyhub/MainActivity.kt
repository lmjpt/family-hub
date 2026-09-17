package io.github.lmjpt.familyhub

import android.content.pm.PackageManager
import com.google.androidbrowserhelper.trusted.LauncherActivity
import com.google.androidbrowserhelper.trusted.TwaLauncher

/**
 * 앱 진입점. 웹앱을 전체 화면(Trusted Web Activity)으로 띄웁니다.
 *
 * 크롬이 있으면 크롬으로 엽니다 — 알림을 '우리집' 이름으로 넘겨 주는 위임은 크롬만 지원하기
 * 때문입니다. 크롬이 없거나 '사용 중지' 되어 있으면 안내 창에서 막히지 않고 기본 브라우저로
 * 엽니다(그때 알림은 그 브라우저 이름으로 옵니다). 앱이 안 열리는 것보다 낫습니다.
 */
class MainActivity : LauncherActivity() {

    override fun createTwaLauncher(): TwaLauncher =
        if (chromeUsable()) TwaLauncher(this, CHROME) else TwaLauncher(this)

    private fun chromeUsable(): Boolean = try {
        packageManager.getApplicationInfo(CHROME, 0).enabled
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    companion object {
        const val CHROME = "com.android.chrome"
    }
}
