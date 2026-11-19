import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/features/books/application/books_providers.dart';
import 'package:flutter_application_1/features/books/data/book.dart';
import 'package:flutter_application_1/features/books/data/reading_session.dart';
import 'package:flutter_application_1/features/books/presentation/book_reading_history_page.dart';
import 'package:flutter_application_1/features/books/presentation/components/book_card.dart';
import 'package:flutter_application_1/features/books/presentation/components/book_cover.dart';
import 'package:flutter_application_1/features/books/presentation/components/common_reading_ribbon.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeBooksController extends BooksController {
  _FakeBooksController(this._books);
  final List<Book> _books;

  @override
  Future<List<Book>> build() async => _books;
}

void main() {
  group('groupSessionsIntoReadingCycles', () {
    test('returns empty list when there are no sessions', () {
      expect(groupSessionsIntoReadingCycles(const []), isEmpty);
    });

    test('groups completed and ongoing readings newest first with isCommon per reading', () {
      final sessions = [
        // Reading #1 (common, completed)
        ReadingSession(
          id: 1,
          bookId: 10,
          currentPage: 0,
          minutesRead: 0,
          createdAt: DateTime(2026, 1, 5, 9, 0),
          type: ReadingSessionType.start,
          isCommon: true,
        ),
        ReadingSession(
          id: 2,
          bookId: 10,
          currentPage: 120,
          minutesRead: 45,
          createdAt: DateTime(2026, 1, 6, 20, 0),
          type: ReadingSessionType.progress,
        ),
        ReadingSession(
          id: 3,
          bookId: 10,
          currentPage: 250,
          minutesRead: 60,
          createdAt: DateTime(2026, 1, 8, 21, 30),
          type: ReadingSessionType.end,
        ),
        // Reading #2 (not common, ongoing)
        ReadingSession(
          id: 4,
          bookId: 10,
          currentPage: 0,
          minutesRead: 0,
          createdAt: DateTime(2026, 11, 1, 10, 0),
          type: ReadingSessionType.start,
          isCommon: false,
        ),
        ReadingSession(
          id: 5,
          bookId: 10,
          currentPage: 80,
          minutesRead: 30,
          createdAt: DateTime(2026, 11, 3, 22, 0),
          type: ReadingSessionType.progress,
        ),
      ];

      final cycles = groupSessionsIntoReadingCycles(
        sessions,
        bookStatus: BookStatus.reading,
      );

      expect(cycles.length, 2);

      // Most recent first: Reading #2 (ongoing)
      expect(cycles[0].readingNumber, 2);
      expect(cycles[0].status, ReadingCycleStatus.inProgress);
      expect(cycles[0].isCommon, isFalse);
      expect(cycles[0].sessions.length, 2);
      expect(cycles[0].totalSecondsRead, 30 * 60);
      expect(cycles[0].maxPage, 80);
      expect(cycles[0].endedAt, isNull);

      // Second: Reading #1 (completed, common)
      expect(cycles[1].readingNumber, 1);
      expect(cycles[1].status, ReadingCycleStatus.completed);
      expect(cycles[1].isCommon, isTrue);
      expect(cycles[1].sessions.length, 3);
      expect(cycles[1].totalSecondsRead, 105 * 60);
      expect(cycles[1].maxPage, 250);
      expect(cycles[1].endedAt, DateTime(2026, 1, 8, 21, 30));
    });

    test('marks an older unclosed cycle as unfinished when a newer start exists', () {
      final sessions = [
        ReadingSession(
          id: 1,
          bookId: 10,
          currentPage: 0,
          minutesRead: 0,
          createdAt: DateTime(2026, 2, 1, 10, 0),
          type: ReadingSessionType.start,
        ),
        ReadingSession(
          id: 2,
          bookId: 10,
          currentPage: 40,
          minutesRead: 20,
          createdAt: DateTime(2026, 2, 2, 10, 0),
          type: ReadingSessionType.progress,
        ),
        ReadingSession(
          id: 3,
          bookId: 10,
          currentPage: 0,
          minutesRead: 0,
          createdAt: DateTime(2026, 11, 1, 10, 0),
          type: ReadingSessionType.start,
          isCommon: true,
        ),
      ];

      final cycles = groupSessionsIntoReadingCycles(sessions);

      expect(cycles.length, 2);
      expect(cycles[0].readingNumber, 2);
      expect(cycles[0].status, ReadingCycleStatus.inProgress);
      expect(cycles[0].isCommon, isTrue);
      expect(cycles[1].readingNumber, 1);
      expect(cycles[1].status, ReadingCycleStatus.unfinished);
      expect(cycles[1].isCommon, isFalse);
    });

    test('orders same-timestamp sessions deterministically (start -> progress -> end)', () {
      final ts = DateTime(2026, 5, 10, 12, 0);
      final sessions = [
        ReadingSession(
          id: 3,
          bookId: 10,
          currentPage: 200,
          minutesRead: 30,
          createdAt: ts,
          type: ReadingSessionType.end,
        ),
        ReadingSession(
          id: 1,
          bookId: 10,
          currentPage: 0,
          minutesRead: 0,
          createdAt: ts,
          type: ReadingSessionType.start,
          isCommon: true,
        ),
        ReadingSession(
          id: 2,
          bookId: 10,
          currentPage: 100,
          minutesRead: 25,
          createdAt: ts,
          type: ReadingSessionType.progress,
        ),
      ];

      final cycles = groupSessionsIntoReadingCycles(sessions);
      expect(cycles.length, 1);
      expect(
        cycles.first.sessions.map((s) => s.type).toList(),
        [ReadingSessionType.start, ReadingSessionType.progress, ReadingSessionType.end],
      );
      expect(
        cycles.first.sessionsDescending.map((s) => s.type).toList(),
        [ReadingSessionType.end, ReadingSessionType.progress, ReadingSessionType.start],
      );
    });
  });

  group('BookReadingHistoryPage widget', () {
    final testBook = Book(
      id: 42,
      title: 'Dune',
      author: 'Frank Herbert',
      totalPages: 400,
      status: BookStatus.reading,
    );

    final testSessions = [
      ReadingSession(
        id: 1,
        bookId: 42,
        currentPage: 0,
        minutesRead: 0,
        createdAt: DateTime(2026, 1, 10, 9, 0),
        type: ReadingSessionType.start,
        isCommon: true,
      ),
      ReadingSession(
        id: 2,
        bookId: 42,
        currentPage: 150,
        minutesRead: 60,
        createdAt: DateTime(2026, 1, 12, 20, 0),
        type: ReadingSessionType.progress,
      ),
      ReadingSession(
        id: 3,
        bookId: 42,
        currentPage: 400,
        minutesRead: 90,
        createdAt: DateTime(2026, 1, 15, 22, 0),
        type: ReadingSessionType.end,
      ),
      ReadingSession(
        id: 4,
        bookId: 42,
        currentPage: 0,
        minutesRead: 0,
        createdAt: DateTime(2026, 11, 1, 14, 0),
        type: ReadingSessionType.start,
        isCommon: false,
      ),
      ReadingSession(
        id: 5,
        bookId: 42,
        currentPage: 75,
        minutesRead: 35,
        createdAt: DateTime(2026, 11, 2, 18, 30),
        type: ReadingSessionType.progress,
      ),
    ];

    testWidgets('renames header, groups readings with common badge, and opens sub-menu on tap',
        (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            booksControllerProvider.overrideWith(() => _FakeBooksController([testBook])),
            readingSessionsForBookProvider(testBook).overrideWith((ref) async => testSessions),
          ],
          child: MaterialApp(
            home: BookReadingHistoryPage(book: testBook),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Renamed header
      expect(find.text('Historique des lectures'), findsOneWidget);
      expect(find.text('Historique des sessions'), findsNothing);

      // Both reading cards visible (ongoing #2 and completed #1)
      expect(find.text('Lecture #2'), findsOneWidget);
      expect(find.text('Lecture #1'), findsOneWidget);
      expect(find.text('En cours'), findsOneWidget);
      expect(find.text('Terminée'), findsOneWidget);

      // Only Lecture #1 is common -> single CommonReadingBadge on the overview page
      expect(find.byType(CommonReadingBadge), findsOneWidget);
      expect(find.text('Lecture commune'), findsOneWidget);

      // Individual session rows should NOT be shown until a reading is tapped
      expect(find.text('Page 150'), findsNothing);
      expect(find.text('Page 75'), findsNothing);

      // Tap Lecture #1 to open its sessions sub-menu
      await tester.tap(find.text('Lecture #1'));
      await tester.pumpAndSettle();

      expect(find.text('Sessions de lecture'), findsOneWidget);
      expect(find.text('Page 150'), findsOneWidget);
      expect(find.text('Page 75'), findsNothing);
      expect(find.byType(CommonReadingBadge), findsOneWidget);
    });
  });

  group('BookCard common reading badge placement', () {
    final testBook = Book(
      id: 7,
      title: 'Fondation',
      author: 'Isaac Asimov',
      series: 'Cycle de Fondation',
      volume: 1,
      totalPages: 320,
      status: BookStatus.reading,
    );

    testWidgets('shows CommonReadingBadge on the card and NOT on the cover when isCommon is true',
        (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      final progress = ReadingProgress(
        currentPage: 120,
        totalPages: 320,
        totalSecondsRead: 3600,
        progress: 120 / 320,
        sessionsCount: 3,
        startedAt: DateTime(2026, 11, 10),
        isCommon: true,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            readingProgressByBookProvider(testBook).overrideWith((ref) async => progress),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: BookCard(
                  book: testBook,
                  onEdit: () {},
                  onRecordSession: () {},
                  onTimer: () {},
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(CommonReadingBadge), findsOneWidget);
      expect(find.byType(CommonReadingRibbon), findsNothing);
      expect(
        find.descendant(
          of: find.byType(BookCover),
          matching: find.byType(CommonReadingBadge),
        ),
        findsNothing,
      );

      final coverRect = tester.getRect(find.byType(BookCover));
      final badgeRect = tester.getRect(find.byType(CommonReadingBadge));
      expect(coverRect.overlaps(badgeRect), isFalse);
    });

    testWidgets('hides CommonReadingBadge when isCommon is false', (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      final progress = ReadingProgress(
        currentPage: 120,
        totalPages: 320,
        totalSecondsRead: 3600,
        progress: 120 / 320,
        sessionsCount: 3,
        startedAt: DateTime(2026, 11, 10),
        isCommon: false,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            readingProgressByBookProvider(testBook).overrideWith((ref) async => progress),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: BookCard(
                  book: testBook,
                  onEdit: () {},
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(CommonReadingBadge), findsNothing);
      expect(find.byType(CommonReadingRibbon), findsNothing);
    });
  });
}
