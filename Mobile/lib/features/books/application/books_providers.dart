import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_client.dart';
import '../data/achievement.dart';
import '../data/bnf_service.dart';
import '../data/book.dart';
import '../data/book_note.dart';
import '../data/book_transaction.dart';
import '../data/books_repository.dart';
import '../data/cover_image_service.dart';
import '../data/glossary_word.dart';
import '../data/reading_cycle.dart';
import '../data/reading_session.dart';
import '../data/retrospective.dart';
import 'streak_utils.dart';

final bnfServiceProvider = Provider<BnfService>((ref) {
  final clientNotifier = ref.watch(apiClientProvider.notifier);
  return BnfService(apiClient: clientNotifier);
});

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

/// Sélectionne les sessions appartenant au cycle de lecture actif d'un livre.
/// Quand readingCycleId est renseigné, privilégie le cycle ouvert (sans session
/// de fin) ayant l'id le plus élevé, sinon le cycle d'id le plus élevé.
List<ReadingSession> activeCycleSessionsFor(List<ReadingSession> sessions) {
  if (sessions.isEmpty) return const <ReadingSession>[];

  final hasCycleIds = sessions.every((s) => s.readingCycleId != null);
  if (hasCycleIds) {
    final byCycle = <int, List<ReadingSession>>{};
    for (final s in sessions) {
      byCycle.putIfAbsent(s.readingCycleId!, () => <ReadingSession>[]).add(s);
    }
    final sortedIds = byCycle.keys.toList()..sort();
    for (final cycleId in sortedIds.reversed) {
      final group = byCycle[cycleId]!;
      final hasEnd = group.any((s) => s.type == ReadingSessionType.end);
      if (!hasEnd) {
        return group;
      }
    }
    return byCycle[sortedIds.last]!;
  }

  final lastStartIndex =
      sessions.lastIndexWhere((session) => session.type == ReadingSessionType.start);
  return lastStartIndex == -1 ? sessions : sessions.sublist(lastStartIndex);
}

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

  final activeCycleSessions = activeCycleSessionsFor(sessions);

  final lastProgressSession = activeCycleSessions.lastWhere(
    (session) => session.type != ReadingSessionType.start,
    orElse: () => activeCycleSessions.last,
  );
  final totalSeconds = activeCycleSessions.fold<int>(0, (sum, session) => sum + session.totalSecondsRead);
  final totalPages = book.totalPages;
  final progress = totalPages == null || totalPages <= 0
      ? 0.0
      : (lastProgressSession.currentPage / totalPages).clamp(0.0, 1.0);

  final startSession = activeCycleSessions.firstWhere(
    (session) => session.type == ReadingSessionType.start,
    orElse: () => activeCycleSessions.first,
  );
  final startedAt = book.startedAt ?? startSession.createdAt;
  final isCommon = activeCycleSessions.any((session) => session.isCommon);

  return ReadingProgress(
    currentPage: lastProgressSession.currentPage,
    totalPages: totalPages,
    totalSecondsRead: totalSeconds,
    progress: progress,
    sessionsCount: activeCycleSessions.length,
    startedAt: startedAt,
    isCommon: isCommon,
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

final readingCyclesForBookProvider = FutureProvider.family<List<ReadingCycleRecord>, Book>((ref, book) async {
  final id = book.id;
  if (id == null) {
    return const <ReadingCycleRecord>[];
  }

  final repository = ref.watch(booksRepositoryProvider);
  return repository.getReadingCyclesByBookId(id);
});

final allReadingSessionsProvider = FutureProvider<List<ReadingSession>>((ref) async {
  final client = ref.watch(apiClientProvider);
  if (!client.isInitialized || !client.isAuthenticated) {
    return const <ReadingSession>[];
  }
  final repository = ref.watch(booksRepositoryProvider);
  return repository.getAllReadingSessions();
});

final commonReadingBookIdsProvider = Provider<Set<int>>((ref) {
  final sessions = ref.watch(allReadingSessionsProvider).value ?? const <ReadingSession>[];
  final byBook = <int, List<ReadingSession>>{};
  for (final session in sessions) {
    byBook.putIfAbsent(session.bookId, () => <ReadingSession>[]).add(session);
  }

  final ids = <int>{};
  for (final entry in byBook.entries) {
    final activeCycle = activeCycleSessionsFor(entry.value);
    if (activeCycle.any((s) => s.isCommon)) {
      ids.add(entry.key);
    }
  }
  return ids;
});

final upcomingPlanningBooksProvider = FutureProvider<List<Book>>((ref) async {
  final client = ref.watch(apiClientProvider);
  if (!client.isInitialized || !client.isAuthenticated) {
    return const <Book>[];
  }
  final repository = ref.watch(booksRepositoryProvider);
  return repository.getUpcomingBooks();
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

final pausedBooksProvider = Provider<List<Book>>((ref) {
  final books = ref.watch(booksControllerProvider).value ?? const <Book>[];
  return books.where((book) => book.isPaused).toList()
    ..sort((left, right) => left.title.toLowerCase().compareTo(right.title.toLowerCase()));
});

final abandonedBooksProvider = Provider<List<Book>>((ref) {
  final books = ref.watch(booksControllerProvider).value ?? const <Book>[];
  return books.where((book) => book.isAbandoned).toList()
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
    this.startedAt,
    this.isCommon = false,
  });

  final int currentPage;
  final int? totalPages;
  final int totalSecondsRead;
  final double progress;
  final int sessionsCount;
  final DateTime? startedAt;
  final bool isCommon;

  int get totalMinutesRead => totalSecondsRead ~/ 60;

  factory ReadingProgress.empty({int? totalPages, DateTime? startedAt}) {
    return ReadingProgress(
      currentPage: 0,
      totalPages: totalPages,
      totalSecondsRead: 0,
      progress: 0,
      sessionsCount: 0,
      startedAt: startedAt,
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
    BnfBookResult? bnf,
  }) async {
    final created = await _repository.quickCreateBook(
      title: title,
      isbn: isbn,
      price: price,
      coverUrl: coverUrl,
      localCoverPath: localCoverPath,
      status: status,
      bnf: bnf,
    );
    await reload();
    return created;
  }

  Future<void> updateBookStatus(Book book, BookStatus status) async {
    final bookId = book.id;
    if (bookId == null) return;
    await _repository.updateBookStatus(bookId, status);
    ref.invalidate(bookDetailsProvider(bookId));
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

  Future<List<ReadingSession>> _loadSessionsSnapshot() async {
    final cached = ref.read(allReadingSessionsProvider).value;
    if (cached != null) {
      return cached;
    }
    try {
      return await _repository.getAllReadingSessions();
    } catch (_) {
      return const <ReadingSession>[];
    }
  }

  Future<StreakCelebrationData?> logReadingSession({
    required Book book,
    required int currentPage,
    required Duration sessionDuration,
    DateTime? occurredAt,
  }) async {
    final sanitizedCurrentPage = currentPage < 0 ? 0 : currentPage;
    final sanitizedDuration = sessionDuration.isNegative ? Duration.zero : sessionDuration;
    final bookId = book.id;
    if (bookId == null) {
      return null;
    }

    final effectiveOccurredAt = occurredAt ?? DateTime.now();
    final sessionsBefore = await _loadSessionsSnapshot();
    final streakCelebration = evaluateFirstReadingOfDayStreak(
      sessionsBeforeSave: sessionsBefore,
      sessionDate: effectiveOccurredAt,
    );

    final totalPages = book.totalPages;
    final completedBook = totalPages != null && totalPages > 0 && sanitizedCurrentPage >= totalPages;

    await _repository.addReadingSession(
      ReadingSession(
        bookId: bookId,
        currentPage: sanitizedCurrentPage,
        minutesRead: sanitizedDuration.inMinutes,
        secondsRead: sanitizedDuration.inSeconds.remainder(60),
        createdAt: effectiveOccurredAt,
        type: completedBook ? ReadingSessionType.end : ReadingSessionType.progress,
      ),
    );

    await _repository.updateReadingStatus(bookId, completedBook ? 'READ' : 'READING');
    ref.invalidate(readingProgressByBookProvider);
    ref.invalidate(readingSessionsForBookProvider);
    ref.invalidate(readingCyclesForBookProvider);
    ref.invalidate(allReadingSessionsProvider);
    await reload();
    return streakCelebration;
  }

  Future<StreakCelebrationData?> startReadingSession({
    required Book book,
    DateTime? startedAt,
    bool isCommon = false,
  }) async {
    if (book.status == BookStatus.sold || book.status == BookStatus.lent || book.status == BookStatus.wishlist) {
      return null;
    }

    final bookId = book.id;
    if (bookId == null) {
      return null;
    }

    final effectiveStartedAt = startedAt ?? DateTime.now();
    final sessionsBefore = await _loadSessionsSnapshot();
    final streakCelebration = evaluateFirstReadingOfDayStreak(
      sessionsBeforeSave: sessionsBefore,
      sessionDate: effectiveStartedAt,
    );

    await _repository.addReadingSession(
      ReadingSession(
        bookId: bookId,
        currentPage: 0,
        minutesRead: 0,
        secondsRead: 0,
        createdAt: effectiveStartedAt,
        type: ReadingSessionType.start,
        isCommon: isCommon,
      ),
    );

    await _repository.updateReadingStatus(bookId, 'READING');

    ref.invalidate(readingProgressByBookProvider);
    ref.invalidate(readingSessionsForBookProvider);
    ref.invalidate(readingCyclesForBookProvider);
    ref.invalidate(allReadingSessionsProvider);
    await reload();
    return streakCelebration;
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
    ref.invalidate(readingCyclesForBookProvider);
    ref.invalidate(allReadingSessionsProvider);
    await reload();
  }

  Future<void> deleteReadingCycle({
    required int bookId,
    required int cycleId,
  }) async {
    await _repository.deleteReadingCycle(cycleId);

    final remainingCycles = await _repository.getReadingCyclesByBookId(bookId);
    if (remainingCycles.isEmpty) {
      final currentBook = _bookById(bookId);
      if (currentBook != null &&
          currentBook.status != BookStatus.wishlist &&
          currentBook.status != BookStatus.sold &&
          currentBook.status != BookStatus.lent) {
        await _repository.updateReadingStatus(bookId, 'UNREAD');
      }
    }

    ref.invalidate(readingProgressByBookProvider);
    ref.invalidate(readingSessionsForBookProvider);
    ref.invalidate(readingCyclesForBookProvider);
    ref.invalidate(allReadingSessionsProvider);
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
        currentBook.status != BookStatus.paused &&
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

final selectableBooksProvider = FutureProvider<List<Book>>((ref) async {
  final client = ref.watch(apiClientProvider);
  if (!client.isInitialized || !client.isAuthenticated) {
    return const <Book>[];
  }
  final userBooks = ref.watch(booksControllerProvider).value ?? const <Book>[];
  final repository = ref.watch(booksRepositoryProvider);
  final catalogBooks = await repository.getCatalogBooks();

  final byId = <int, Book>{};
  for (final b in catalogBooks) {
    if (b.id != null) {
      byId[b.id!] = b;
    }
  }
  for (final b in userBooks) {
    if (b.id != null) {
      byId[b.id!] = b;
    }
  }

  final merged = byId.values.toList()
    ..sort((left, right) => left.title.toLowerCase().compareTo(right.title.toLowerCase()));
  return merged;
});

final notesControllerProvider =
    AsyncNotifierProvider<NotesController, List<BookNote>>(NotesController.new);

class NotesController extends AsyncNotifier<List<BookNote>> {
  BooksRepository get _repository => ref.read(booksRepositoryProvider);

  @override
  Future<List<BookNote>> build() async {
    final client = ref.watch(apiClientProvider);
    if (!client.isInitialized || !client.isAuthenticated) {
      return const <BookNote>[];
    }
    return _repository.getNotes();
  }

  Future<void> reload() async {
    try {
      state = AsyncValue.data(await _repository.getNotes());
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<BookNote> createNote({
    required int bookId,
    required String content,
  }) async {
    final created = await _repository.createNote(
      bookId: bookId,
      content: content,
    );
    await reload();
    return created;
  }

  Future<BookNote> updateNote({
    required int id,
    required String content,
  }) async {
    final updated = await _repository.updateNote(
      id: id,
      content: content,
    );
    await reload();
    return updated;
  }

  Future<void> deleteNote(int id) async {
    await _repository.deleteNote(id);
    await reload();
  }
}

final wordsControllerProvider =
    AsyncNotifierProvider<WordsController, List<GlossaryWord>>(WordsController.new);

class WordsController extends AsyncNotifier<List<GlossaryWord>> {
  BooksRepository get _repository => ref.read(booksRepositoryProvider);

  @override
  Future<List<GlossaryWord>> build() async {
    final client = ref.watch(apiClientProvider);
    if (!client.isInitialized || !client.isAuthenticated) {
      return const <GlossaryWord>[];
    }
    return _repository.getWords();
  }

  Future<void> reload() async {
    try {
      state = AsyncValue.data(await _repository.getWords());
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<GlossaryWord> createWord({
    required String word,
    required String definition,
    List<int> bookIds = const [],
  }) async {
    final created = await _repository.createWord(
      word: word,
      definition: definition,
      bookIds: bookIds,
    );
    await reload();
    return created;
  }

  Future<GlossaryWord> updateWord({
    required int id,
    required String word,
    required String definition,
    List<int> bookIds = const [],
  }) async {
    final updated = await _repository.updateWord(
      id: id,
      word: word,
      definition: definition,
      bookIds: bookIds,
    );
    await reload();
    return updated;
  }

  Future<void> deleteWord(int id) async {
    await _repository.deleteWord(id);
    await reload();
  }
}

final achievementsControllerProvider =
    AsyncNotifierProvider<AchievementsController, List<Achievement>>(
        AchievementsController.new);

class AchievementsController extends AsyncNotifier<List<Achievement>> {
  BooksRepository get _repository => ref.read(booksRepositoryProvider);

  @override
  Future<List<Achievement>> build() async {
    final client = ref.watch(apiClientProvider);
    if (!client.isInitialized || !client.isAuthenticated) {
      return const <Achievement>[];
    }
    return _repository.getAchievements();
  }

  Future<void> reload() async {
    try {
      state = AsyncValue.data(await _repository.getAchievements());
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<Achievement> createAchievement({
    required String name,
    required int totalSteps,
    required String icon,
    required String ornament,
    required String iconColor,
    required String backgroundColor,
    DateTime? unlockedAt,
  }) async {
    final created = await _repository.createAchievement(
      name: name,
      totalSteps: totalSteps,
      icon: icon,
      ornament: ornament,
      iconColor: iconColor,
      backgroundColor: backgroundColor,
      unlockedAt: unlockedAt,
    );
    final current = state.value ?? const <Achievement>[];
    state = AsyncValue.data([created, ...current]);
    return created;
  }

  Future<Achievement> updateAchievement({
    required int id,
    String? name,
    int? totalSteps,
    int? completedSteps,
    String? icon,
    String? ornament,
    String? iconColor,
    String? backgroundColor,
    DateTime? unlockedAt,
  }) async {
    final updated = await _repository.updateAchievement(
      id: id,
      name: name,
      totalSteps: totalSteps,
      completedSteps: completedSteps,
      icon: icon,
      ornament: ornament,
      iconColor: iconColor,
      backgroundColor: backgroundColor,
      unlockedAt: unlockedAt,
    );
    final current = state.value ?? const <Achievement>[];
    state = AsyncValue.data(
      current.map((a) => a.id == updated.id ? updated : a).toList(),
    );
    return updated;
  }

  Future<void> deleteAchievement(int id) async {
    await _repository.deleteAchievement(id);
    final current = state.value ?? const <Achievement>[];
    state = AsyncValue.data(current.where((a) => a.id != id).toList());
  }
}

final retrospectiveYearsProvider = FutureProvider<List<int>>((ref) async {
  final client = ref.watch(apiClientProvider);
  if (!client.isInitialized || !client.isAuthenticated) {
    return const <int>[];
  }
  final repository = ref.watch(booksRepositoryProvider);
  return repository.getRetrospectiveYears();
});

final retrospectiveByYearProvider =
    FutureProvider.autoDispose.family<YearlyRetrospective, int>((ref, year) async {
  final link = ref.keepAlive();
  try {
    final repository = ref.watch(booksRepositoryProvider);
    return await repository.getRetrospective(year);
  } catch (_) {
    link.close();
    rethrow;
  }
});

final seenRetrospectiveYearsProvider =
    NotifierProvider<SeenRetrospectiveYearsNotifier, Set<int>>(
  SeenRetrospectiveYearsNotifier.new,
);

class SeenRetrospectiveYearsNotifier extends Notifier<Set<int>> {
  static const _prefsKey = 'seen_retrospective_years';

  @override
  Set<int> build() {
    _load();
    return <int>{};
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_prefsKey) ?? const <String>[];
    final parsed = raw.map(int.tryParse).whereType<int>().toSet();
    if (parsed.isNotEmpty) {
      state = parsed;
    }
  }

  Future<void> markSeen(int year) async {
    if (state.contains(year)) return;
    final next = {...state, year};
    state = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _prefsKey,
      next.map((e) => e.toString()).toList(),
    );
  }
}
