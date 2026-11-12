import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../books/application/books_providers.dart';
import '../books/data/book.dart';

class WidgetFinishSessionPayload {
  const WidgetFinishSessionPayload({
    required this.bookId,
    required this.elapsedSeconds,
  });

  final int bookId;
  final int elapsedSeconds;
}

class AndroidReadingWidgetService {
  AndroidReadingWidgetService._();

  static final AndroidReadingWidgetService instance = AndroidReadingWidgetService._();

  static const MethodChannel _channel = MethodChannel('fr.openbook.yet_another_library/widget');

  final StreamController<WidgetFinishSessionPayload> _finishSessionController =
      StreamController<WidgetFinishSessionPayload>.broadcast();

  Stream<WidgetFinishSessionPayload> get onFinishSession => _finishSessionController.stream;

  bool _initialized = false;
  String? _lastCoverUrl;
  String? _lastLocalCoverPath;

  void ensureInitialized() {
    if (_initialized) return;
    _initialized = true;

    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return;
    }

    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onOpenReadingSession') {
        final args = call.arguments;
        if (args is Map) {
          final bookId = (args['bookId'] as num?)?.toInt();
          final elapsedSeconds = (args['elapsedSeconds'] as num?)?.toInt() ?? 0;
          if (bookId != null && bookId > 0) {
            _finishSessionController.add(
              WidgetFinishSessionPayload(
                bookId: bookId,
                elapsedSeconds: elapsedSeconds,
              ),
            );
          }
        }
      }
    });
  }

  Future<WidgetFinishSessionPayload?> consumePendingWidgetSession() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return null;
    }
    ensureInitialized();
    try {
      final result = await _channel.invokeMethod<dynamic>('consumePendingWidgetSession');
      if (result is Map) {
        final bookId = (result['bookId'] as num?)?.toInt();
        final elapsedSeconds = (result['elapsedSeconds'] as num?)?.toInt() ?? 0;
        if (bookId != null && bookId > 0) {
          return WidgetFinishSessionPayload(
            bookId: bookId,
            elapsedSeconds: elapsedSeconds,
          );
        }
      }
    } catch (_) {}
    return null;
  }

  Future<void> syncReadingBook({
    required Book? book,
    required ReadingProgress? progress,
  }) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return;
    }
    ensureInitialized();

    try {
      if (book == null || book.id == null) {
        await _channel.invokeMethod('updateWidgetData', {
          'hasBook': false,
          'bookId': -1,
          'title': '',
          'currentPage': 0,
          'totalPages': 0,
          'totalMinutes': 0,
          'progressPct': 0,
          'coverPath': '',
        });
        return;
      }

      final currentPage = progress?.currentPage ?? 0;
      final totalPages = progress?.totalPages ?? book.totalPages ?? 0;
      final totalMinutes = progress?.totalMinutesRead ?? 0;
      final progressPct = totalPages > 0
          ? ((currentPage / totalPages).clamp(0.0, 1.0) * 100).round()
          : 0;

      final coverPath = await _resolveCoverForWidget(book.coverUrl);

      await _channel.invokeMethod('updateWidgetData', {
        'hasBook': true,
        'bookId': book.id,
        'title': book.title,
        'currentPage': currentPage,
        'totalPages': totalPages,
        'totalMinutes': totalMinutes,
        'progressPct': progressPct,
        'coverPath': coverPath,
      });
    } catch (_) {}
  }

  Future<String> _resolveCoverForWidget(String rawCoverUrl) async {
    final cover = rawCoverUrl.trim();
    if (cover.isEmpty) {
      return '';
    }

    if (!cover.startsWith('http://') && !cover.startsWith('https://')) {
      final localFile = File(cover);
      if (await localFile.exists()) {
        return localFile.path;
      }
      return '';
    }

    if (_lastCoverUrl == cover && _lastLocalCoverPath != null) {
      final cachedFile = File(_lastLocalCoverPath!);
      if (await cachedFile.exists()) {
        return cachedFile.path;
      }
    }

    try {
      final response = await http.get(Uri.parse(cover)).timeout(const Duration(seconds: 6));
      if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
        final tempDir = await getTemporaryDirectory();
        final widgetCoversDir = Directory(p.join(tempDir.path, 'widget_covers'));
        if (!await widgetCoversDir.exists()) {
          await widgetCoversDir.create(recursive: true);
        }
        final targetPath = p.join(widgetCoversDir.path, 'current_reading_cover.jpg');
        final file = File(targetPath);
        await file.writeAsBytes(response.bodyBytes, flush: true);
        _lastCoverUrl = cover;
        _lastLocalCoverPath = file.path;
        return file.path;
      }
    } catch (_) {}

    return '';
  }
}
