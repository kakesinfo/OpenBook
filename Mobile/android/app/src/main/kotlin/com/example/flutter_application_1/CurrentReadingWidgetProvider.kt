package com.example.flutter_application_1

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

class CurrentReadingWidgetProvider : AppWidgetProvider() {

    companion object {
        const val PREFS_NAME = "CurrentReadingWidgetPrefs"
        const val KEY_HAS_BOOK = "has_book"
        const val KEY_BOOK_ID = "book_id"
        const val KEY_TITLE = "title"
        const val KEY_CURRENT_PAGE = "current_page"
        const val KEY_TOTAL_PAGES = "total_pages"
        const val KEY_TOTAL_MINUTES = "total_minutes"
        const val KEY_PROGRESS_PCT = "progress_pct"
        const val KEY_COVER_PATH = "cover_path"

        const val KEY_BOOKS_JSON = "books_json"
        const val KEY_SELECTED_BOOK_ID = "selected_book_id"

        const val KEY_TIMER_ACTIVE = "timer_active"
        const val KEY_TIMER_RUNNING = "timer_running"
        const val KEY_TIMER_Accumulated_MS = "timer_accumulated_ms"
        const val KEY_TIMER_LAST_START_ELAPSED = "timer_last_start_elapsed"

        const val ACTION_PLAY = "fr.openbook.yet_another_library.WIDGET_ACTION_PLAY"
        const val ACTION_PAUSE_RESUME = "fr.openbook.yet_another_library.WIDGET_ACTION_PAUSE_RESUME"
        const val ACTION_FINISH = "fr.openbook.yet_another_library.WIDGET_ACTION_FINISH"
        const val ACTION_REFRESH = "fr.openbook.yet_another_library.WIDGET_ACTION_REFRESH"
        const val ACTION_PREV_BOOK = "fr.openbook.yet_another_library.WIDGET_ACTION_PREV_BOOK"
        const val ACTION_NEXT_BOOK = "fr.openbook.yet_another_library.WIDGET_ACTION_NEXT_BOOK"

        const val EXTRA_WIDGET_FINISH_BOOK_ID = "widget_finish_book_id"
        const val EXTRA_WIDGET_FINISH_ELAPSED_SECONDS = "widget_finish_elapsed_seconds"

        data class WidgetBookData(
            val bookId: Int,
            val title: String,
            val currentPage: Int,
            val totalPages: Int,
            val totalMinutes: Int,
            val progressPct: Int,
            val coverPath: String
        )

        fun parseBooks(prefs: SharedPreferences): List<WidgetBookData> {
            val jsonStr = prefs.getString(KEY_BOOKS_JSON, null)
            if (!jsonStr.isNullOrBlank()) {
                try {
                    val array = JSONArray(jsonStr)
                    val list = mutableListOf<WidgetBookData>()
                    for (i in 0 until array.length()) {
                        val obj = array.optJSONObject(i) ?: continue
                        val id = obj.optInt("bookId", -1)
                        if (id > 0) {
                            list.add(
                                WidgetBookData(
                                    bookId = id,
                                    title = obj.optString("title", "Aucune lecture en cours"),
                                    currentPage = obj.optInt("currentPage", 0),
                                    totalPages = obj.optInt("totalPages", 0),
                                    totalMinutes = obj.optInt("totalMinutes", 0),
                                    progressPct = obj.optInt("progressPct", 0).coerceIn(0, 100),
                                    coverPath = obj.optString("coverPath", "")
                                )
                            )
                        }
                    }
                    return list
                } catch (_: Exception) {
                }
            }

            // Fallback sur les clés unitaires historiques
            val hasBook = prefs.getBoolean(KEY_HAS_BOOK, false)
            val bookId = prefs.getInt(KEY_BOOK_ID, -1)
            if (hasBook && bookId > 0) {
                return listOf(
                    WidgetBookData(
                        bookId = bookId,
                        title = prefs.getString(KEY_TITLE, "Aucune lecture en cours") ?: "Aucune lecture en cours",
                        currentPage = prefs.getInt(KEY_CURRENT_PAGE, 0),
                        totalPages = prefs.getInt(KEY_TOTAL_PAGES, 0),
                        totalMinutes = prefs.getInt(KEY_TOTAL_MINUTES, 0),
                        progressPct = prefs.getInt(KEY_PROGRESS_PCT, 0).coerceIn(0, 100),
                        coverPath = prefs.getString(KEY_COVER_PATH, "") ?: ""
                    )
                )
            }
            return emptyList()
        }

        fun resolveCurrentBookIndex(books: List<WidgetBookData>, prefs: SharedPreferences): Int {
            if (books.isEmpty()) return -1
            val selectedId = prefs.getInt(KEY_SELECTED_BOOK_ID, prefs.getInt(KEY_BOOK_ID, -1))
            val idx = books.indexOfFirst { it.bookId == selectedId }
            return if (idx >= 0) idx else 0
        }

        fun applySelectedBookToEditor(editor: SharedPreferences.Editor, book: WidgetBookData?) {
            if (book == null) {
                editor.putBoolean(KEY_HAS_BOOK, false)
                    .putInt(KEY_BOOK_ID, -1)
                    .putInt(KEY_SELECTED_BOOK_ID, -1)
                    .putString(KEY_TITLE, "")
                    .putInt(KEY_CURRENT_PAGE, 0)
                    .putInt(KEY_TOTAL_PAGES, 0)
                    .putInt(KEY_TOTAL_MINUTES, 0)
                    .putInt(KEY_PROGRESS_PCT, 0)
                    .putString(KEY_COVER_PATH, "")
            } else {
                editor.putBoolean(KEY_HAS_BOOK, true)
                    .putInt(KEY_BOOK_ID, book.bookId)
                    .putInt(KEY_SELECTED_BOOK_ID, book.bookId)
                    .putString(KEY_TITLE, book.title)
                    .putInt(KEY_CURRENT_PAGE, book.currentPage)
                    .putInt(KEY_TOTAL_PAGES, book.totalPages)
                    .putInt(KEY_TOTAL_MINUTES, book.totalMinutes)
                    .putInt(KEY_PROGRESS_PCT, book.progressPct)
                    .putString(KEY_COVER_PATH, book.coverPath)
            }
        }

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, CurrentReadingWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (widgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }

        fun resetTimer(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(KEY_TIMER_ACTIVE, false)
                .putBoolean(KEY_TIMER_RUNNING, false)
                .putLong(KEY_TIMER_Accumulated_MS, 0L)
                .putLong(KEY_TIMER_LAST_START_ELAPSED, 0L)
                .apply()
            updateAllWidgets(context)
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val books = parseBooks(prefs)
            val currentIndex = resolveCurrentBookIndex(books, prefs)
            val currentBook = if (currentIndex >= 0) books[currentIndex] else null
            val hasBook = currentBook != null && currentBook.bookId > 0

            val timerActive = prefs.getBoolean(KEY_TIMER_ACTIVE, false) && hasBook
            val timerRunning = prefs.getBoolean(KEY_TIMER_RUNNING, false)
            val accumulatedMs = prefs.getLong(KEY_TIMER_Accumulated_MS, 0L)
            val lastStartElapsed = prefs.getLong(KEY_TIMER_LAST_START_ELAPSED, 0L)

            val views = RemoteViews(context.packageName, R.layout.widget_current_reading)

            if (!hasBook || currentBook == null) {
                views.setTextViewText(R.id.widget_title, "Aucune lecture en cours")
                views.setTextViewText(R.id.widget_progress_text, "p 0 / 0m")
                views.setProgressBar(R.id.widget_progress_bar, 100, 0, false)
                views.setImageViewResource(R.id.widget_cover, R.mipmap.ic_launcher)
                views.setViewVisibility(R.id.widget_idle_controls, View.VISIBLE)
                views.setViewVisibility(R.id.widget_timer_controls, View.GONE)
                views.setViewVisibility(R.id.widget_btn_prev, View.GONE)
                views.setViewVisibility(R.id.widget_btn_next, View.GONE)
                views.setTextViewText(R.id.widget_btn_play, "Ouvrir")

                val openAppIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                val openAppPendingIntent = PendingIntent.getActivity(
                    context,
                    100,
                    openAppIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_btn_play, openAppPendingIntent)
                views.setOnClickPendingIntent(R.id.widget_cover, openAppPendingIntent)
            } else {
                val showNavArrows = books.size > 1 && !timerActive
                views.setViewVisibility(R.id.widget_btn_prev, if (showNavArrows) View.VISIBLE else View.GONE)
                views.setViewVisibility(R.id.widget_btn_next, if (showNavArrows) View.VISIBLE else View.GONE)

                if (showNavArrows) {
                    val prevIntent = Intent(context, CurrentReadingWidgetProvider::class.java).apply {
                        action = ACTION_PREV_BOOK
                    }
                    val prevPendingIntent = PendingIntent.getBroadcast(
                        context,
                        204,
                        prevIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPendingIntent)

                    val nextIntent = Intent(context, CurrentReadingWidgetProvider::class.java).apply {
                        action = ACTION_NEXT_BOOK
                    }
                    val nextPendingIntent = PendingIntent.getBroadcast(
                        context,
                        205,
                        nextIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_btn_next, nextPendingIntent)
                }

                views.setTextViewText(R.id.widget_title, currentBook.title)
                val progressText = if (books.size > 1) {
                    "(${currentIndex + 1}/${books.size}) • p ${currentBook.currentPage} / ${currentBook.totalMinutes}m"
                } else {
                    "p ${currentBook.currentPage} / ${currentBook.totalMinutes}m"
                }
                views.setTextViewText(R.id.widget_progress_text, progressText)
                views.setProgressBar(R.id.widget_progress_bar, 100, currentBook.progressPct, false)

                val coverBitmap = loadRoundedCoverBitmap(currentBook.coverPath)
                if (coverBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_cover, coverBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_cover, R.mipmap.ic_launcher)
                }

                // Clic sur la couverture -> ouvre l'application
                val openAppIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                val openAppPendingIntent = PendingIntent.getActivity(
                    context,
                    101,
                    openAppIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_cover, openAppPendingIntent)

                if (!timerActive) {
                    views.setViewVisibility(R.id.widget_status_label, View.GONE)
                    views.setViewVisibility(R.id.widget_progress_section, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_chronometer, View.GONE)
                    views.setViewVisibility(R.id.widget_idle_controls, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_timer_controls, View.GONE)
                    views.setTextViewText(R.id.widget_btn_play, "▶")

                    val playIntent = Intent(context, CurrentReadingWidgetProvider::class.java).apply {
                        action = ACTION_PLAY
                    }
                    val playPendingIntent = PendingIntent.getBroadcast(
                        context,
                        201,
                        playIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_btn_play, playPendingIntent)
                } else {
                    views.setViewVisibility(R.id.widget_status_label, View.VISIBLE)
                    views.setTextViewText(
                        R.id.widget_status_label,
                        if (timerRunning) "Lecture en cours..." else "En pause"
                    )
                    views.setTextColor(
                        R.id.widget_status_label,
                        if (timerRunning) 0xFF10B981.toInt() else 0xFFF59E0B.toInt()
                    )
                    views.setViewVisibility(R.id.widget_progress_section, View.GONE)
                    views.setViewVisibility(R.id.widget_chronometer, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_idle_controls, View.GONE)
                    views.setViewVisibility(R.id.widget_timer_controls, View.VISIBLE)

                    val nowElapsed = SystemClock.elapsedRealtime()
                    val baseTime = if (timerRunning && lastStartElapsed > 0L) {
                        nowElapsed - (accumulatedMs + max(0L, nowElapsed - lastStartElapsed))
                    } else {
                        nowElapsed - accumulatedMs
                    }

                    views.setChronometer(R.id.widget_chronometer, baseTime, null, timerRunning)
                    views.setTextViewText(
                        R.id.widget_btn_pause_resume,
                        if (timerRunning) "⏸" else "▶"
                    )

                    val pauseResumeIntent = Intent(context, CurrentReadingWidgetProvider::class.java).apply {
                        action = ACTION_PAUSE_RESUME
                    }
                    val pauseResumePendingIntent = PendingIntent.getBroadcast(
                        context,
                        202,
                        pauseResumeIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_btn_pause_resume, pauseResumePendingIntent)

                    val finishIntent = Intent(context, CurrentReadingWidgetProvider::class.java).apply {
                        action = ACTION_FINISH
                    }
                    val finishPendingIntent = PendingIntent.getBroadcast(
                        context,
                        203,
                        finishIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_btn_finish, finishPendingIntent)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun loadRoundedCoverBitmap(path: String): Bitmap? {
            if (path.isBlank()) return null
            val file = File(path)
            if (!file.exists()) return null
            return try {
                val options = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeFile(file.absolutePath, options)
                val targetWidth = 240
                val targetHeight = 360
                var sampleSize = 1
                while (options.outWidth / sampleSize > targetWidth * 2 ||
                    options.outHeight / sampleSize > targetHeight * 2
                ) {
                    sampleSize *= 2
                }
                val decodeOptions = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize
                }
                val raw = BitmapFactory.decodeFile(file.absolutePath, decodeOptions) ?: return null
                val cornerRadius = (minOf(raw.width, raw.height) * 0.08f).coerceAtLeast(12f)
                getRoundedCornerBitmap(raw, cornerRadius)
            } catch (_: Exception) {
                null
            }
        }

        private fun getRoundedCornerBitmap(bitmap: Bitmap, radiusPx: Float): Bitmap {
            val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val paint = Paint().apply {
                isAntiAlias = true
                color = -0xbdbdbe
            }
            val rect = Rect(0, 0, bitmap.width, bitmap.height)
            val rectF = RectF(rect)
            canvas.drawARGB(0, 0, 0, 0)
            canvas.drawRoundRect(rectF, radiusPx, radiusPx, paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(bitmap, rect, rect, paint)
            return output
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val now = SystemClock.elapsedRealtime()

        when (intent.action) {
            ACTION_PREV_BOOK, ACTION_NEXT_BOOK -> {
                val isActive = prefs.getBoolean(KEY_TIMER_ACTIVE, false)
                if (isActive) return

                val books = parseBooks(prefs)
                if (books.size <= 1) return

                val currentIndex = resolveCurrentBookIndex(books, prefs)
                val delta = if (intent.action == ACTION_NEXT_BOOK) 1 else -1
                val nextIndex = (currentIndex + delta + books.size) % books.size
                val nextBook = books[nextIndex]

                val editor = prefs.edit()
                applySelectedBookToEditor(editor, nextBook)
                editor.apply()

                updateAllWidgets(context)
            }

            ACTION_PLAY -> {
                val books = parseBooks(prefs)
                val currentIndex = resolveCurrentBookIndex(books, prefs)
                if (currentIndex < 0) return

                val currentBook = books[currentIndex]
                val editor = prefs.edit()
                applySelectedBookToEditor(editor, currentBook)
                editor.putBoolean(KEY_TIMER_ACTIVE, true)
                    .putBoolean(KEY_TIMER_RUNNING, true)
                    .putLong(KEY_TIMER_Accumulated_MS, 0L)
                    .putLong(KEY_TIMER_LAST_START_ELAPSED, now)
                    .apply()
                updateAllWidgets(context)
            }

            ACTION_PAUSE_RESUME -> {
                val isActive = prefs.getBoolean(KEY_TIMER_ACTIVE, false)
                if (!isActive) return

                val isRunning = prefs.getBoolean(KEY_TIMER_RUNNING, false)
                val accumulated = prefs.getLong(KEY_TIMER_Accumulated_MS, 0L)
                val lastStart = prefs.getLong(KEY_TIMER_LAST_START_ELAPSED, 0L)

                if (isRunning) {
                    val delta = if (lastStart > 0L && now >= lastStart) now - lastStart else 0L
                    prefs.edit()
                        .putBoolean(KEY_TIMER_RUNNING, false)
                        .putLong(KEY_TIMER_Accumulated_MS, accumulated + delta)
                        .putLong(KEY_TIMER_LAST_START_ELAPSED, 0L)
                        .apply()
                } else {
                    prefs.edit()
                        .putBoolean(KEY_TIMER_RUNNING, true)
                        .putLong(KEY_TIMER_LAST_START_ELAPSED, now)
                        .apply()
                }
                updateAllWidgets(context)
            }

            ACTION_FINISH -> {
                val books = parseBooks(prefs)
                val currentIndex = resolveCurrentBookIndex(books, prefs)
                val bookId = if (currentIndex >= 0) {
                    books[currentIndex].bookId
                } else {
                    prefs.getInt(KEY_BOOK_ID, -1)
                }

                val isRunning = prefs.getBoolean(KEY_TIMER_RUNNING, false)
                val accumulated = prefs.getLong(KEY_TIMER_Accumulated_MS, 0L)
                val lastStart = prefs.getLong(KEY_TIMER_LAST_START_ELAPSED, 0L)

                val totalMs = if (isRunning && lastStart > 0L && now >= lastStart) {
                    accumulated + (now - lastStart)
                } else {
                    accumulated
                }
                val elapsedSeconds = max(0, (totalMs / 1000.0).roundToInt())

                // Réinitialise le chronomètre du widget
                prefs.edit()
                    .putBoolean(KEY_TIMER_ACTIVE, false)
                    .putBoolean(KEY_TIMER_RUNNING, false)
                    .putLong(KEY_TIMER_Accumulated_MS, 0L)
                    .putLong(KEY_TIMER_LAST_START_ELAPSED, 0L)
                    .apply()
                updateAllWidgets(context)

                // Ouvre MainActivity sur l'écran d'enregistrement de session pour ce livre
                if (bookId > 0) {
                    val launchIntent = Intent(context, MainActivity::class.java).apply {
                        action = ACTION_FINISH
                        putExtra(EXTRA_WIDGET_FINISH_BOOK_ID, bookId)
                        putExtra(EXTRA_WIDGET_FINISH_ELAPSED_SECONDS, elapsedSeconds)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP
                    }
                    context.startActivity(launchIntent)
                }
            }

            ACTION_REFRESH -> {
                updateAllWidgets(context)
            }
        }
    }
}
