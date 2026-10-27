import 'dart:convert';

import '../../../core/network/api_client.dart';
import 'book.dart';
import 'reading_session.dart';

class BooksRepository {
  BooksRepository(this._apiClient);

  final ApiClientNotifier _apiClient;

  static final _uuidRegex = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

  static String resolveCoverUrl(String? rawCover, String baseUrl) {
    final cover = (rawCover ?? '').trim();
    if (cover.isEmpty) return '';

    if (cover.startsWith('/')) {
      return '$baseUrl$cover';
    }

    final uri = Uri.tryParse(cover);
    if (uri != null && uri.hasScheme && (uri.host == 'localhost' || uri.host == '127.0.0.1')) {
      final pathWithQuery = uri.hasQuery ? '${uri.path}?${uri.query}' : uri.path;
      return '$baseUrl$pathWithQuery';
    }

    if (_uuidRegex.hasMatch(cover)) {
      return '$baseUrl/images/$cover/blob';
    }

    return cover;
  }

  Future<List<Book>> getAllBooks() async {
    final response = await _apiClient.get('/user/books');
    if (response.statusCode != 200) {
      throw Exception('Erreur lors du chargement des livres: ${response.statusCode}');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => _bookFromSummary(item as Map<String, dynamic>)).toList();
  }

  Future<List<Book>> searchBooks(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return [];

    final encoded = Uri.encodeQueryComponent(trimmed);
    final response = await _apiClient.get('/books/search?query=$encoded');
    if (response.statusCode != 200) {
      throw Exception('Erreur lors de la recherche: ${response.statusCode}');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => _bookFromSummary(item as Map<String, dynamic>)).toList();
  }

  Book _bookFromSummary(Map<String, dynamic> item) {
    final cover = resolveCoverUrl(item['coverUrl'] as String?, _apiClient.baseUrl);

    final rawStatus = (item['status'] as String? ?? 'OWNED').toUpperCase();
    final rawReading = (item['readingStatus'] as String? ?? 'UNREAD').toUpperCase();

    BookStatus bookStatus;
    if (rawStatus == 'WISHLIST' || rawStatus == 'WISHLISTED') {
      bookStatus = BookStatus.wishlist;
    } else if (rawStatus == 'LENT') {
      bookStatus = BookStatus.lent;
    } else if (rawStatus == 'SOLD') {
      bookStatus = BookStatus.sold;
    } else {
      if (rawReading == 'READING') {
        bookStatus = BookStatus.reading;
      } else if (rawReading == 'READ') {
        bookStatus = BookStatus.read;
      } else {
        bookStatus = BookStatus.unread;
      }
    }

    String seriesName = '';
    if (item['seriesName'] != null) {
      seriesName = item['seriesName'].toString();
    } else if (item['series'] != null && item['series'] is Map) {
      seriesName = item['series']['name']?.toString() ?? '';
    }

    String authorName = '';
    if (item['author'] != null) {
      authorName = item['author'].toString();
    } else if (item['authors'] != null && item['authors'] is List && (item['authors'] as List).isNotEmpty) {
      final first = (item['authors'] as List).first;
      if (first is Map) {
        authorName = '${first['firstname'] ?? ''} ${first['lastname'] ?? ''}'.trim();
      }
    }

    return Book(
      id: (item['id'] as num?)?.toInt(),
      title: item['title'] as String? ?? '',
      author: authorName,
      series: seriesName,
      volume: (item['volume'] as num?)?.toInt(),
      coverUrl: cover,
      status: bookStatus,
      totalPages: (item['pageCount'] as num?)?.toInt(),
    );
  }

  Future<void> addBookToUser(int bookId, {BookStatus status = BookStatus.unread}) async {
    String payloadStatus = 'OWNED';
    if (status == BookStatus.wishlist) {
      payloadStatus = 'WISHLISTED';
    } else if (status == BookStatus.lent) {
      payloadStatus = 'LENT';
    } else if (status == BookStatus.sold) {
      payloadStatus = 'SOLD';
    }

    final response = await _apiClient.post('/user/addBook/$bookId/$payloadStatus');
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Impossible d\'ajouter le livre: ${response.statusCode}');
    }

    if (status == BookStatus.reading) {
      await updateReadingStatus(bookId, 'READING');
    } else if (status == BookStatus.read) {
      await updateReadingStatus(bookId, 'READ');
    } else if (status == BookStatus.unread) {
      await updateReadingStatus(bookId, 'UNREAD');
    }
  }

  Future<void> updateBookStatus(int bookId, BookStatus status) async {
    switch (status) {
      case BookStatus.wishlist:
        await _apiClient.post('/user/addBook/$bookId/WISHLISTED');
        break;
      case BookStatus.lent:
        await _apiClient.post('/user/addBook/$bookId/LENT');
        break;
      case BookStatus.sold:
        await _apiClient.post('/user/addBook/$bookId/SOLD');
        break;
      case BookStatus.unread:
        await _apiClient.post('/user/addBook/$bookId/OWNED');
        await updateReadingStatus(bookId, 'UNREAD');
        break;
      case BookStatus.reading:
        await _apiClient.post('/user/addBook/$bookId/OWNED');
        await updateReadingStatus(bookId, 'READING');
        break;
      case BookStatus.read:
        await _apiClient.post('/user/addBook/$bookId/OWNED');
        await updateReadingStatus(bookId, 'READ');
        break;
    }
  }

  Future<void> updateReadingStatus(int bookId, String status) async {
    await _apiClient.post('/user/readingStatus/$bookId/$status');
  }

  Future<void> saveBook(Book book) async {
    if (book.id == null) {
      throw UnsupportedError('La création manuelle de livres a été supprimée.');
    }
    await updateBookStatus(book.id!, book.status);
  }

  Future<void> deleteBook(int id) async {
    await _apiClient.delete('/user/removeBook/$id');
    await _apiClient.delete('/user/readingStatus/$id');
  }

  Future<List<ReadingSession>> getSessionsByBookId(int bookId) async {
    final response = await _apiClient.get('/user/readingSessions/$bookId');
    if (response.statusCode != 200) {
      return [];
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => _sessionFromMap(item as Map<String, dynamic>)).toList();
  }

  Future<Map<int, List<ReadingSession>>> getSessionsByBookIds(List<int> bookIds) async {
    final response = await _apiClient.get('/user/readingSessions');
    if (response.statusCode != 200) {
      return {};
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    final grouped = <int, List<ReadingSession>>{};
    for (final item in list) {
      final session = _sessionFromMap(item as Map<String, dynamic>);
      if (bookIds.contains(session.bookId)) {
        grouped.putIfAbsent(session.bookId, () => <ReadingSession>[]).add(session);
      }
    }
    return grouped;
  }

  ReadingSession _sessionFromMap(Map<String, dynamic> map) {
    return ReadingSession(
      id: (map['id'] as num?)?.toInt(),
      bookId: (map['bookId'] as num).toInt(),
      currentPage: (map['currentPage'] as num?)?.toInt() ?? 0,
      minutesRead: (map['minutesRead'] as num?)?.toInt() ?? 0,
      secondsRead: (map['secondsRead'] as num?)?.toInt() ?? 0,
      createdAt: map['createdAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch((map['createdAt'] as num).toInt())
          : DateTime.now(),
      type: ReadingSessionType.values[(map['sessionType'] as int?) ?? ReadingSessionType.progress.index],
    );
  }

  Future<void> addReadingSession(ReadingSession session) async {
    final payload = <String, dynamic>{
      'bookId': session.bookId,
      'currentPage': session.currentPage,
      'minutesRead': session.minutesRead,
      'secondsRead': session.secondsRead,
      'sessionType': session.type.index,
      'createdAt': session.createdAt.millisecondsSinceEpoch,
    };

    final response = await _apiClient.post('/user/readingSessions', body: payload);
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Impossible d\'enregistrer la session: ${response.statusCode}');
    }
  }

  Future<void> deleteReadingSession(int sessionId) async {
    final response = await _apiClient.delete('/user/readingSessions/$sessionId');
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Impossible de supprimer la session: ${response.statusCode}');
    }
  }
}
