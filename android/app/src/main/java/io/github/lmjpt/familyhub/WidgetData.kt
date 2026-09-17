package io.github.lmjpt.familyhub

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.net.ssl.HttpsURLConnection

/**
 * 위젯에 보일 내용을 서버에서 받아 옵니다.
 *
 * 서버(Edge Function 'widget')가 한국어 문장으로 다 만들어서 줍니다. 위젯은 그 줄들을
 * 그대로 그리기만 합니다 — 날짜 계산이나 문구를 여기서 또 하면 웹과 어긋나기 때문입니다.
 *
 * 누구 것을 보여 줄지는 '위젯 토큰'으로 정해집니다. 웹 화면의 설정 → 위젯 연결을 누르면
 * WidgetLinkActivity 가 토큰을 받아 이 기기에 저장합니다.
 */
object WidgetData {
    private const val ENDPOINT = "https://cluemjqdqqtmkezjqcag.supabase.co/functions/v1/widget"
    private const val APP_URL = "https://lmjpt.github.io/family-hub/"

    /**
     * Supabase 게이트웨이가 요구하는 공개 키. 비밀이 아닙니다 (웹 번들에도 그대로 들어 있음).
     * 진짜 보호는 RLS 와 위젯 토큰이 합니다.
     */
    private const val PUBLISHABLE_KEY = "sb_publishable_EYSyYqcPSgZeo8jdeG1LAA_LB02jXyT"

    const val PREFS = "widget"
    const val KEY_TOKEN = "token"

    data class Data(val header: String, val lines: List<String>, val footer: String)

    fun fetch(context: Context): Data {
        val token = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, null)
        if (token.isNullOrBlank()) {
            return Data("우리집", listOf("앱을 열고 설정 → 위젯 연결을 눌러 주세요"), "")
        }

        return try {
            val conn = (URL(ENDPOINT).openConnection() as HttpsURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("apikey", PUBLISHABLE_KEY)
                setRequestProperty("X-Widget-Token", token)
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()

            when {
                code == 401 -> Data("우리집", listOf("연결이 끊겼어요. 앱에서 위젯 연결을 다시 눌러 주세요"), "")
                code == 404 -> Data("우리집", listOf("서버에 widget 함수가 아직 없어요 (README 2단계)"), "")
                code !in 200..299 -> {
                    // 서버가 원인을 JSON 으로 주면 그대로 보여 줘서 고칠 수 있게 합니다.
                    val reason = try { JSONObject(body).optString("error", "") } catch (e: Exception) { "" }
                    Data("우리집", listOf("불러오지 못했어요 ($code)", reason).filter { it.isNotBlank() }, "")
                }
                else -> {
                    val json = JSONObject(body)
                    val arr = json.getJSONArray("lines")
                    val lines = (0 until arr.length()).map { arr.getString(it) }
                    val time = SimpleDateFormat("HH:mm", Locale.KOREA).format(Date())
                    Data(
                        header = "${json.getString("date")} · ${json.getString("name")}",
                        lines = if (lines.isEmpty()) listOf(json.optString("empty", "오늘은 비어 있어요 🎉")) else lines,
                        footer = "$time 갱신 · 눌러서 앱 열기",
                    )
                }
            }
        } catch (e: Exception) {
            Data("우리집", listOf("인터넷에 연결되어 있는지 확인해 주세요"), "")
        }
    }

    fun render(context: Context, data: Data): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget)
        views.setTextViewText(R.id.header, data.header)

        val ids = intArrayOf(R.id.line1, R.id.line2, R.id.line3, R.id.line4, R.id.line5, R.id.line6)
        val shown = if (data.lines.size > ids.size) {
            data.lines.take(ids.size - 1) + "+${data.lines.size - (ids.size - 1)}개 더"
        } else {
            data.lines
        }
        ids.forEachIndexed { i, id ->
            if (i < shown.size) {
                views.setTextViewText(id, shown[i])
                views.setViewVisibility(id, View.VISIBLE)
            } else {
                views.setViewVisibility(id, View.GONE)
            }
        }
        views.setTextViewText(R.id.footer, data.footer)

        // 어디를 눌러도 앱(일정 화면)이 열립니다.
        // (apply 안에서 `data = ...` 라고 쓰면 매개변수 data 와 헷갈려 컴파일이 안 됩니다)
        val open = Intent(context, MainActivity::class.java)
        open.action = Intent.ACTION_VIEW
        open.data = Uri.parse(APP_URL)
        val pending = PendingIntent.getActivity(
            context, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.root, pending)
        return views
    }
}
