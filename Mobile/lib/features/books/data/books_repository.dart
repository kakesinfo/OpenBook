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

  Future<Map<String, dynamic>> getBookDetails(int id) async {
    final response = await _apiClient.get(
      '/books/$id?withSeries=true&withCollection=true&withEditor=true&withAuthors=true&withStatus=true',
    );
    if (response.statusCode != 200) {
      throw Exception('Impossible de charger les détails de l\'album (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
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

  Future<Book> quickCreateBook({
    required String title,
    String? isbn,
    int? price,
    String? coverUrl,
    String? localCoverPath,
    BookStatus status = BookStatus.unread,
  }) async {
    final cleanTitle = title.trim();
    if (cleanTitle.isEmpty) {
      throw ArgumentError('Le titre ne peut pas être vide.');
    }

    final cleanIsbn = isbn?.trim();
    final cleanCoverUrl = coverUrl?.trim();

    final payload = <String, dynamic>{
      'title': cleanTitle,
      if (cleanIsbn != null && cleanIsbn.isNotEmpty) 'isbn': cleanIsbn,
      if (price != null && price >= 0) 'price': price,
      if (cleanCoverUrl != null && cleanCoverUrl.isNotEmpty) 'coverUrl': cleanCoverUrl,
      'addToLibrary': status != BookStatus.wishlist,
    };

    final response = await _apiClient.post('/books', body: payload);
    if (response.statusCode != 200 && response.statusCode != 201) {
      if (response.statusCode == 409 && cleanIsbn != null && cleanIsbn.isNotEmpty) {
        try {
          final existing = await searchBooks(cleanIsbn);
          if (existing.isNotEmpty && existing.first.id != null) {
            final bookId = existing.first.id!;
            await addBookToUser(bookId, status: status);

            if (localCoverPath != null && localCoverPath.trim().isNotEmpty) {
              try {
                await _apiClient.postMultipart(
                  '/books/$bookId/cover',
                  fieldName: 'file',
                  filePath: localCoverPath.trim(),
                );
              } catch (_) {}
            }

            return existing.first.copyWith(
              status: status == BookStatus.wishlist ? BookStatus.wishlist : BookStatus.unread,
            );
          }
        } catch (_) {}
      }

      String errorMessage = 'Erreur lors de la création du livre (${response.statusCode})';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map) {
          if (decoded['detail'] != null && decoded['detail'].toString().trim().isNotEmpty) {
            errorMessage = decoded['detail'].toString();
          } else if (decoded['message'] != null && decoded['message'].toString().trim().isNotEmpty) {
            errorMessage = decoded['message'].toString();
          }
        }
      } catch (_) {}
      throw Exception(errorMessage);
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final bookId = (data['id'] as num?)?.toInt();

    if (bookId != null && localCoverPath != null && localCoverPath.trim().isNotEmpty) {
      try {
        final coverResponse = await _apiClient.postMultipart(
          '/books/$bookId/cover',
          fieldName: 'file',
          filePath: localCoverPath.trim(),
        );
        if (coverResponse.statusCode == 200 || coverResponse.statusCode == 201) {
          try {
            final updatedData = jsonDecode(coverResponse.body) as Map<String, dynamic>;
            data['coverUrl'] = updatedData['coverUrl'];
          } catch (_) {}
        }
      } catch (_) {}
    }

    if (bookId != null && status == BookStatus.wishlist) {
      try {
        await addBookToUser(bookId, status: BookStatus.wishlist);
        data['status'] = 'WISHLISTED';
      } catch (_) {}
    }

    return _bookFromSummary(data);
  }

  Future<void> updateBookInfo({
    required int bookId,
    required String title,
    String? seriesName,
    int? volume,
    String? author,
    int? pageCount,
    String? isbn,
    String? description,
  }) async {
    final cleanSeriesName = seriesName?.trim() ?? '';
    int? seriesId;

    if (cleanSeriesName.isNotEmpty) {
      try {
        final encoded = Uri.encodeQueryComponent(cleanSeriesName);
        final seriesRes = await _apiClient.get('/series?query=$encoded');
        if (seriesRes.statusCode == 200) {
          final list = jsonDecode(seriesRes.body) as List<dynamic>;
          for (final item in list) {
            if (item is Map &&
                item['name']?.toString().toLowerCase().trim() == cleanSeriesName.toLowerCase()) {
              seriesId = (item['id'] as num?)?.toInt();
              break;
            }
          }
        }
        if (seriesId == null) {
          final createRes = await _apiClient.post(
            '/series',
            body: {'name': cleanSeriesName, 'bookIds': [bookId]},
          );
          if (createRes.statusCode == 200 || createRes.statusCode == 201) {
            final data = jsonDecode(createRes.body) as Map<String, dynamic>;
            seriesId = (data['id'] as num?)?.toInt();
          }
        }
      } catch (_) {}
    }

    try {
      await _apiClient.put(
        '/books/$bookId/series',
        body: {
          'seriesId': cleanSeriesName.isNotEmpty ? seriesId : null,
          'volume': cleanSeriesName.isNotEmpty ? volume : null,
        },
      );
    } catch (_) {}

    final payload = <String, dynamic>{
      'title': title.trim(),
      if (isbn != null) 'isbn': isbn.trim(),
      if (pageCount != null && pageCount > 0) 'pageCount': pageCount,
      if (description != null) 'description': description.trim(),
      if (volume != null && cleanSeriesName.isNotEmpty) 'volume': volume,
      if (cleanSeriesName.isEmpty) 'clearSeries': true,
      if (author != null && author.trim().isNotEmpty)
        'authors': [
          {'firstname': '', 'lastname': author.trim(), 'type': 'Writer'}
        ],
    };

    final response = await _apiClient.put('/books/$bookId', body: payload);
    if (response.statusCode != 200 && response.statusCode != 204) {
      String msg = 'Erreur lors de la modification (${response.statusCode})';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['detail'] != null) {
          msg = decoded['detail'].toString();
        } else if (decoded is Map && decoded['message'] != null) {
          msg = decoded['message'].toString();
        }
      } catch (_) {}
      throw Exception(msg);
    }
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
