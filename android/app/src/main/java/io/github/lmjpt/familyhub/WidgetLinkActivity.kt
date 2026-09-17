package io.github.lmjpt.familyhub

import android.app.Activity
import android.os.Bundle
import android.widget.Toast

/**
 * 웹 화면(설정 → 위젯 연결)이 familyhub://widget?token=... 을 열면 여기로 옵니다.
 * 토큰을 이 기기에 저장하고 위젯을 바로 갱신한 뒤 조용히 닫힙니다.
 * 화면이 없는 Activity 라서 onCreate 안에서 반드시 finish() 해야 합니다.
 */
class WidgetLinkActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val token = intent?.data?.getQueryParameter("token")
        if (!token.isNullOrBlank()) {
            getSharedPreferences(WidgetData.PREFS, MODE_PRIVATE)
                .edit()
                .putString(WidgetData.KEY_TOKEN, token)
                .apply()
            TodayWidget.refreshAll(this)
            Toast.makeText(
                this,
                "위젯이 연결되었어요. 바탕화면을 길게 눌러 '우리집 오늘' 위젯을 추가해 보세요.",
                Toast.LENGTH_LONG,
            ).show()
        }
        finish()
    }
}
