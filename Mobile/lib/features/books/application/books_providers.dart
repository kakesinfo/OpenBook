import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/book.dart';
import '../data/book_transaction.dart';
import '../data/books_repository.dart';
import '../data/cover_image_service.dart';
import '../data/reading_session.dart';

final booksRepositoryProvider = Provider<BooksRepository>((ref) {
  final clientNotifier = ref.watch(apiClientProvider.notifier);
  return BooksRepository(clientNotifier);
});

final coverImageServiceProvider = Provider<CoverImageService>((ref) {
  return CoverImageService();
});

final bookFilterProvider =
    NotifierProvider<BookFilterNotifier, BookLibraryFilter>(
  BookFilterNotifier.new,
);

final bookSearchQueryProvider =
    NotifierProvider<BookSearchQueryNotifier, String>(
  BookSearchQueryNotifier.new,
);


final bookTransactionsProvider =
    FutureProvider.family<List<BookTransaction>, int>((ref, bookId) async {
  final repository = ref.watch(booksRepositoryProvider);
  return repository.getBookTransactions(bookId);
});

final bookDetailsProvider = FutureProvider.family<Map<String, dynamic>, int>((ref, bookId) async {
  final repository = ref.watch(booksRepositoryProvider);
  return repository.getBookDetails(bookId);
});

class BookSearchQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  void setQuery(String query) {
    state = query;
  }

  void clear() {
    state = '';
  }
}

final booksControllerProvider =
    AsyncNotifierProvider<BooksController, List<Book>>(BooksController.new);

final readingProgressByBookProvider = FutureProvider.family<ReadingProgress, Book>((ref, book) async {
  final id = book.id;
  if (id == null) {
    return ReadingProgress.empty(totalPages: book.totalPages);
  }

  final repository = ref.watch(booksRepositoryProvider);
  final sessions = await repository.getSessionsByBookId(id);
  if (sessions.isEmpty) {
    return ReadingProgress.empty(totalPages: book.totalPages);
  }

  final lastStartIndex = sessions.lastIndexWhere((session) => session.type == ReadingSessionType.start);
  final activeCycleSessions = lastStartIndex == -1 ? sessions : sessions.sublist(lastStartIndex);
  final lastProgressSession = activeCycleSessions.lastWhere(
    (session) => session.type != ReadingSessionType.start,
    orElse: () => activeCycleSessions.last,
  );
  final totalSeconds = activeCycleSessions.fold<int>(0, (sum, session) => sum + session.totalSecondsRead);
  final totalPages = book.totalPages;
  final progress = totalPages == null || totalPages <= 0
      ? 0.0
      : (lastProgressSession.currentPage / totalPages).clamp(0.0, 1.0);

  return ReadingProgress(
    currentPage: lastProgressSession.currentPage,
    totalPages: totalPages,
    totalSecondsRead: totalSeconds,
    progress: progress,
    sessionsCount: activeCycleSessions.length,
  );
});

final readingSessionsForBookProvider = FutureProvider.family<List<ReadingSession>, Book>((ref, book) async {
  final id = book.id;
  if (id == null) {
    return const <ReadingSession>[];
  }

  final repository = ref.watch(booksRepositoryProvider);
  return repository.getSessionsByBookId(id);
});

final filteredBooksProvider = Provider<List<Book>>((ref) {
  final books = ref.watch(booksControllerProvider).value ?? const <Book>[];
  final filter = ref.watch(bookFilterProvider);
  final searchQuery = ref.watch(bookSearchQueryProvider).trim().toLowerCase();

  return books.where((book) {
    if (!filter.matches(book)) return false;
    if (searchQuery.isEmpty) return true;
    final titleMatch = book.title.toLowerCase().contains(searchQuery);
    final authorMatch = book.author.toLowerCase().contains(searchQuery);
    final seriesMatch = book.series.toLowerCase().contains(searchQuery);
    return titleMatch || authorMatch || seriesMatch;
  }).toList()
    ..sort((left, right) => left.title.toLowerCase().compareTo(right.title.toLowerCase()));
});

final readingBooksProvider = Provider<List<Book>>((ref) {
  final books = ref.watch(booksControllerProvider).value ?? const <Book>[];
  return books.where((book) => book.isCurrentlyReading).toList()
    ..sort((left, right) => left.title.toLowerCase().compareTo(right.title.toLowerCase()));
});

final wishlistBooksProvider = Provider<List<Book>>((ref) {
  final books = ref.watch(booksControllerProvider).value ?? const <Book>[];
  return books.where((book) => book.status == BookStatus.wishlist).toList()
    ..sort((left, right) => left.title.toLowerCase().compareTo(right.title.toLowerCase()));
});

class BookFilterNotifier extends Notifier<BookLibraryFilter> {
  @override
  BookLibraryFilter build() {
    return BookLibraryFilter.collection;
  }

  void setFilter(BookLibraryFilter filter) {
    state = filter;
  }
}

class ReadingProgress {
  const ReadingProgress({
    required this.currentPage,
    required this.totalPages,
    required this.totalSecondsRead,
    required this.progress,
    required this.sessionsCount,
  });

  final int currentPage;
  final int? totalPages;
  final int totalSecondsRead;
  final double progress;
  final int sessionsCount;

  int get totalMinutesRead => totalSecondsRead ~/ 60;

  factory ReadingProgress.empty({int? totalPages}) {
    return ReadingProgress(
      currentPage: 0,
      totalPages: totalPages,
      totalSecondsRead: 0,
      progress: 0,
      sessionsCount: 0,
    );
  }
}

class BooksController extends AsyncNotifier<List<Book>> {
  static const _loadTimeout = Duration(seconds: 8);

  BooksRepository get _repository => ref.read(booksRepositoryProvider);
  CoverImageService get _coverImageService => ref.read(coverImageServiceProvider);

  Future<List<Book>> _loadBooks() {
    return _repository.getAllBooks().timeout(
      _loadTimeout,
      onTimeout: () => throw TimeoutException(
        'Le chargement de la collection a expiré.',
      ),
    );
  }

  @override
  Future<List<Book>> build() async {
    final client = ref.watch(apiClientProvider);
    if (!client.isInitialized || !client.isAuthenticated) {
      return const <Book>[];
    }
    return _loadBooks();
  }

  Future<void> reload() async {
    try {
      state = AsyncValue.data(await _loadBooks());
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> addBook(int bookId, {BookStatus status = BookStatus.unread}) async {
    await _repository.addBookToUser(bookId, status: status);
    await reload();
  }

  Future<Book> quickCreateBook({
    required String title,
    String? isbn,
    int? price,
    String? coverUrl,
    String? localCoverPath,
    BookStatus status = BookStatus.unread,
  }) async {
    final created = await _repository.quickCreateBook(
      title: title,
      isbn: isbn,
      price: price,
      coverUrl: coverUrl,
      localCoverPath: localCoverPath,
      status: status,
    );
    await reload();
    return created;
  }

  Future<void> updateBookStatus(Book book, BookStatus status) async {
    final bookId = book.id;
    if (bookId == null) return;
    await _repository.updateBookStatus(bookId, status);
    await reload();
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
    await _repository.updateBookInfo(
      bookId: bookId,
      title: title,
      seriesName: seriesName,
      volume: volume,
      author: author,
      pageCount: pageCount,
      isbn: isbn,
      description: description,
    );
    ref.invalidate(bookDetailsProvider(bookId));
    await reload();
  }

  Future<void> saveBook({Book? existingBook, required BookDraft draft}) async {
    final currentCover = existingBook?.coverUrl ?? '';
    final resolvedCover = await _resolveCoverPath(
      draft: draft,
      existingCover: currentCover,
    );

    final book = draft.toBook(
      existingBook: existingBook,
      resolvedCoverPath: resolvedCover,
    );

    await _repository.saveBook(book);

    if (currentCover != resolvedCover && _coverImageService.isLocalCoverPath(currentCover)) {
      await _coverImageService.deleteLocalCover(currentCover);
    }

    await reload();
  }

  Future<void> deleteBook(Book book) async {
    final id = book.id;
    if (id == null) {
      return;
    }

    await _repository.deleteBook(id);

    if (_coverImageService.isLocalCoverPath(book.coverUrl)) {
      await _coverImageService.deleteLocalCover(book.coverUrl);
    }

    await reload();
    ref.invalidate(readingProgressByBookProvider);
  }

  Future<void> logReadingSession({
    required Book book,
    required int currentPage,
    required Duration sessionDuration,
    DateTime? occurredAt,
  }) async {
    final sanitizedCurrentPage = currentPage < 0 ? 0 : currentPage;
    final sanitizedDuration = sessionDuration.isNegative ? Duration.zero : sessionDuration;
    final bookId = book.id;
    if (bookId == null) {
      return;
    }

    final totalPages = book.totalPages;
    final completedBook = totalPages != null && totalPages > 0 && sanitizedCurrentPage >= totalPages;

    await _repository.addReadingSession(
      ReadingSession(
        bookId: bookId,
        currentPage: sanitizedCurrentPage,
        minutesRead: sanitizedDuration.inMinutes,
        secondsRead: sanitizedDuration.inSeconds.remainder(60),
        createdAt: occurredAt ?? DateTime.now(),
        type: completedBook ? ReadingSessionType.end : ReadingSessionType.progress,
      ),
    );

    await _repository.updateReadingStatus(bookId, completedBook ? 'READ' : 'READING');
    ref.invalidate(readingProgressByBookProvider);
    ref.invalidate(readingSessionsForBookProvider);
    await reload();
  }

  Future<void> startReadingSession({
    required Book book,
  }) async {
    if (book.status == BookStatus.sold || book.status == BookStatus.lent || book.status == BookStatus.wishlist) {
      return;
    }

    final bookId = book.id;
    if (bookId == null) {
      return;
    }

    await _repository.addReadingSession(
      ReadingSession(
        bookId: bookId,
        currentPage: 0,
        minutesRead: 0,
        secondsRead: 0,
        createdAt: DateTime.now(),
        type: ReadingSessionType.start,
      ),
    );

    await _repository.updateReadingStatus(bookId, 'READING');

    ref.invalidate(readingProgressByBookProvider);
    ref.invalidate(readingSessionsForBookProvider);
    await reload();
  }

  Future<void> deleteReadingSession({
    required ReadingSession session,
  }) async {
    final sessionId = session.id;
    if (sessionId == null) {
      return;
    }

    await _repository.deleteReadingSession(sessionId);

    final remainingSessions = await _repository.getSessionsByBookId(session.bookId);
    if (remainingSessions.isEmpty) {
      final currentBook = _bookById(session.bookId);
      if (currentBook != null && currentBook.status != BookStatus.wishlist) {
        await _repository.updateReadingStatus(session.bookId, 'UNREAD');
      }
    }

    ref.invalidate(readingProgressByBookProvider);
    ref.invalidate(readingSessionsForBookProvider);
    await reload();
  }

  Book? _bookById(int bookId) {
    final books = state.maybeWhen<List<Book>?>(
      data: (books) => books,
      orElse: () => null,
    );
    if (books == null) {
      return null;
    }

    for (final book in books) {
      if (book.id == bookId) {
        return book;
      }
    }

    return null;
  }

  Future<String> _resolveCoverPath({
    required BookDraft draft,
    required String existingCover,
  }) async {
    switch (draft.coverSourceType) {
      case CoverSourceType.none:
        return '';
      case CoverSourceType.url:
        return draft.coverUrl.trim();
      case CoverSourceType.file:
        final selectedPath = draft.coverFilePath;
        if (selectedPath == null || selectedPath.isEmpty) {
          return existingCover;
        }

        return _coverImageService.storeResizedCover(selectedPath);
    }
  }

  Future<void> addBookTransaction({
    required int bookId,
    required BookTransaction transaction,
  }) async {
    await _repository.addBookTransaction(bookId, transaction);
    ref.invalidate(bookTransactionsProvider(bookId));
    final currentBook = _bookById(bookId);
    if (currentBook != null &&
        currentBook.status != BookStatus.read &&
        currentBook.status != BookStatus.reading &&
        currentBook.status != BookStatus.unread &&
        currentBook.status != BookStatus.lent &&
        currentBook.status != BookStatus.sold) {
      await _repository.updateBookStatus(bookId, BookStatus.unread);
    }
    await reload();
  }

  Future<void> deleteBookTransaction({
    required int bookId,
    required int transactionId,
  }) async {
    await _repository.deleteBookTransaction(transactionId);
    ref.invalidate(bookTransactionsProvider(bookId));
    await reload();
  }
}
