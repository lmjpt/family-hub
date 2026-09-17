package io.github.lmjpt.familyhub

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/** 바탕화면 위젯. 안드로이드가 갱신 시점을 알려 주면 서버에서 오늘 내용을 받아 그립니다. */
class TodayWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        // 네트워크는 메인 스레드에서 못 합니다. goAsync 로 시간을 벌고 스레드에서 받아 옵니다.
        val pending = goAsync()
        Thread {
            try {
                val data = WidgetData.fetch(context)
                for (id in ids) manager.updateAppWidget(id, WidgetData.render(context, data))
            } finally {
                pending.finish()
            }
        }.start()
    }

    companion object {
        /** 바탕화면에 있는 이 위젯을 전부 지금 갱신합니다. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidget::class.java))
            if (ids.isEmpty()) return
            val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .setComponent(ComponentName(context, TodayWidget::class.java))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            context.sendBroadcast(intent)
        }
    }
}
