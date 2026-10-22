import 'dart:convert';

import '../../../core/network/api_client.dart';
import 'book.dart';
import 'reading_session.dart';

class BooksRepository {
  BooksRepository(this._apiClient);

  final ApiClientNotifier _apiClient;

  Future<List<Book>> getAllBooks() async {
    final response = await _apiClient.get('/user/books');
    if (response.statusCode != 200) {
      throw Exception('Erreur lors du chargement des livres: ${response.statusCode}');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => _bookFromSummary(item as Map<String, dynamic>)).toList();
  }

  Book _bookFromSummary(Map<String, dynamic> item) {
    var cover = (item['coverUrl'] as String? ?? '').trim();
    if (cover.isNotEmpty && cover.startsWith('/')) {
      cover = '${_apiClient.baseUrl}$cover';
    }

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

  String _statusToPayload(BookStatus status) {
    switch (status) {
      case BookStatus.wishlist:
        return 'WISHLISTED';
      case BookStatus.lent:
        return 'LENT';
      case BookStatus.sold:
        return 'SOLD';
      case BookStatus.unread:
        return 'UNREAD';
      case BookStatus.reading:
        return 'READING';
      case BookStatus.read:
        return 'READ';
    }
  }

  Future<void> saveBook(Book book) async {
    final payload = <String, dynamic>{
      'title': book.title,
      'author': book.author,
      'series': book.series,
      'volume': book.volume,
      'pageCount': book.totalPages,
      'coverUrl': book.coverUrl,
      'status': _statusToPayload(book.status),
    };

    if (book.id == null) {
      final response = await _apiClient.post('/user/customBook', body: payload);
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('Impossible d\'ajouter le livre: ${response.statusCode}');
      }
    } else {
      final response = await _apiClient.put('/user/customBook/${book.id}', body: payload);
      if (response.statusCode != 200) {
        throw Exception('Impossible de mettre à jour le livre: ${response.statusCode}');
      }
    }
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
