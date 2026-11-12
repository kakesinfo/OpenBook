package com.example.flutter_application_1

import android.content.Context
import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject

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
                    val prefs = applicationContext.getSharedPreferences(
                        CurrentReadingWidgetProvider.PREFS_NAME,
                        Context.MODE_PRIVATE
                    )
                    val previousSelectedId = prefs.getInt(
                        CurrentReadingWidgetProvider.KEY_SELECTED_BOOK_ID,
                        prefs.getInt(CurrentReadingWidgetProvider.KEY_BOOK_ID, -1)
                    )

                    val rawBooks = call.argument<List<Map<String, Any?>>>("books")
                    val parsedBooks = mutableListOf<CurrentReadingWidgetProvider.Companion.WidgetBookData>()

                    if (rawBooks != null) {
                        for (item in rawBooks) {
                            val id = (item["bookId"] as? Number)?.toInt() ?: -1
                            if (id > 0) {
                                parsedBooks.add(
                                    CurrentReadingWidgetProvider.Companion.WidgetBookData(
                                        bookId = id,
                                        title = (item["title"] as? String) ?: "",
                                        currentPage = (item["currentPage"] as? Number)?.toInt() ?: 0,
                                        totalPages = (item["totalPages"] as? Number)?.toInt() ?: 0,
                                        totalMinutes = (item["totalMinutes"] as? Number)?.toInt() ?: 0,
                                        progressPct = ((item["progressPct"] as? Number)?.toInt() ?: 0).coerceIn(0, 100),
                                        coverPath = (item["coverPath"] as? String) ?: ""
                                    )
                                )
                            }
                        }
                    } else {
                        val hasBook = call.argument<Boolean>("hasBook") ?: false
                        val bookId = call.argument<Int>("bookId") ?: -1
                        if (hasBook && bookId > 0) {
                            parsedBooks.add(
                                CurrentReadingWidgetProvider.Companion.WidgetBookData(
                                    bookId = bookId,
                                    title = call.argument<String>("title") ?: "",
                                    currentPage = call.argument<Int>("currentPage") ?: 0,
                                    totalPages = call.argument<Int>("totalPages") ?: 0,
                                    totalMinutes = call.argument<Int>("totalMinutes") ?: 0,
                                    progressPct = (call.argument<Int>("progressPct") ?: 0).coerceIn(0, 100),
                                    coverPath = call.argument<String>("coverPath") ?: ""
                                )
                            )
                        }
                    }

                    val jsonArray = JSONArray()
                    for (book in parsedBooks) {
                        val obj = JSONObject().apply {
                            put("bookId", book.bookId)
                            put("title", book.title)
                            put("currentPage", book.currentPage)
                            put("totalPages", book.totalPages)
                            put("totalMinutes", book.totalMinutes)
                            put("progressPct", book.progressPct)
                            put("coverPath", book.coverPath)
                        }
                        jsonArray.put(obj)
                    }

                    val selectedBook = parsedBooks.firstOrNull { it.bookId == previousSelectedId }
                        ?: parsedBooks.firstOrNull()

                    val editor = prefs.edit()
                        .putString(CurrentReadingWidgetProvider.KEY_BOOKS_JSON, jsonArray.toString())

                    CurrentReadingWidgetProvider.applySelectedBookToEditor(editor, selectedBook)

                    // Si le livre sélectionné a disparu ou changé, réinitialise le chrono
                    if (selectedBook == null || (previousSelectedId != -1 && previousSelectedId != selectedBook.bookId)) {
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
