package com.example.flutter_application_1

import android.content.Context
import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    companion object {
        private const val CHANNEL = "fr.openbook.yet_another_library/widget"
    }

    private var methodChannel: MethodChannel? = null
    private var pendingFinishSession: Map<String, Int>? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        extractWidgetIntent(intent)

        val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        methodChannel = channel

        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "updateWidgetData" -> {
                    val hasBook = call.argument<Boolean>("hasBook") ?: false
                    val bookId = call.argument<Int>("bookId") ?: -1
                    val title = call.argument<String>("title") ?: ""
                    val currentPage = call.argument<Int>("currentPage") ?: 0
                    val totalPages = call.argument<Int>("totalPages") ?: 0
                    val totalMinutes = call.argument<Int>("totalMinutes") ?: 0
                    val progressPct = call.argument<Int>("progressPct") ?: 0
                    val coverPath = call.argument<String>("coverPath") ?: ""

                    val prefs = applicationContext.getSharedPreferences(
                        CurrentReadingWidgetProvider.PREFS_NAME,
                        Context.MODE_PRIVATE
                    )
                    val previousBookId = prefs.getInt(CurrentReadingWidgetProvider.KEY_BOOK_ID, -1)

                    val editor = prefs.edit()
                        .putBoolean(CurrentReadingWidgetProvider.KEY_HAS_BOOK, hasBook)
                        .putInt(CurrentReadingWidgetProvider.KEY_BOOK_ID, bookId)
                        .putString(CurrentReadingWidgetProvider.KEY_TITLE, title)
                        .putInt(CurrentReadingWidgetProvider.KEY_CURRENT_PAGE, currentPage)
                        .putInt(CurrentReadingWidgetProvider.KEY_TOTAL_PAGES, totalPages)
                        .putInt(CurrentReadingWidgetProvider.KEY_TOTAL_MINUTES, totalMinutes)
                        .putInt(CurrentReadingWidgetProvider.KEY_PROGRESS_PCT, progressPct)
                        .putString(CurrentReadingWidgetProvider.KEY_COVER_PATH, coverPath)

                    // Si le livre en cours a changé ou qu'il n'y en a plus, réinitialise le chrono
                    if (!hasBook || (previousBookId != -1 && previousBookId != bookId)) {
                        editor.putBoolean(CurrentReadingWidgetProvider.KEY_TIMER_ACTIVE, false)
                            .putBoolean(CurrentReadingWidgetProvider.KEY_TIMER_RUNNING, false)
                            .putLong(CurrentReadingWidgetProvider.KEY_TIMER_Accumulated_MS, 0L)
                            .putLong(CurrentReadingWidgetProvider.KEY_TIMER_LAST_START_ELAPSED, 0L)
                    }
                    editor.apply()

                    CurrentReadingWidgetProvider.updateAllWidgets(applicationContext)
                    result.success(true)
                }

                "consumePendingWidgetSession" -> {
                    val session = pendingFinishSession
                    pendingFinishSession = null
                    result.success(session)
                }

                else -> result.notImplemented()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (extractWidgetIntent(intent)) {
            val session = pendingFinishSession
            if (session != null && methodChannel != null) {
                pendingFinishSession = null
                methodChannel?.invokeMethod("onOpenReadingSession", session)
            }
        }
    }

    private fun extractWidgetIntent(intent: Intent?): Boolean {
        if (intent == null) return false
        val bookId = intent.getIntExtra(CurrentReadingWidgetProvider.EXTRA_WIDGET_FINISH_BOOK_ID, -1)
        if (bookId > 0) {
            val elapsedSeconds = intent.getIntExtra(
                CurrentReadingWidgetProvider.EXTRA_WIDGET_FINISH_ELAPSED_SECONDS,
                0
            )
            pendingFinishSession = mapOf(
                "bookId" to bookId,
                "elapsedSeconds" to elapsedSeconds
            )
            intent.removeExtra(CurrentReadingWidgetProvider.EXTRA_WIDGET_FINISH_BOOK_ID)
            intent.removeExtra(CurrentReadingWidgetProvider.EXTRA_WIDGET_FINISH_ELAPSED_SECONDS)
            return true
        }
        return false
    }
}
