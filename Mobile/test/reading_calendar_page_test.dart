import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/features/books/application/books_providers.dart';
import 'package:flutter_application_1/features/books/data/book.dart';
import 'package:flutter_application_1/features/books/data/reading_session.dart';
import 'package:flutter_application_1/features/books/presentation/reading_calendar_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeBooksController extends BooksController {
  _FakeBooksController(this._books);
  final List<Book> _books;

  @override
  Future<List<Book>> build() async => _books;
}

void main() {
  group('computeMonthlyBookSummaries', () {
    test('aggregates pages read and duration for focused month, ordered most recent first', () {
      final focusedMonth = DateTime(2026, 11, 1);
      final sessions = [
        // Book 1 started in October at page 50, then read 40 + 30 pages in November
        ReadingSession(
          id: 1,
          bookId: 1,
          currentPage: 50,
          minutesRead: 30,
          createdAt: DateTime(2026, 10, 28, 20, 0),
        ),
        ReadingSession(
          id: 2,
          bookId: 1,
          currentPage: 90,
          minutesRead: 25,
          secondsRead: 30,
          createdAt: DateTime(2026, 11, 3, 21, 0),
        ),
        ReadingSession(
          id: 3,
          bookId: 1,
          currentPage: 120,
          minutesRead: 20,
          createdAt: DateTime(2026, 11, 10, 19, 0),
        ),
        // Book 2 started and read in November (more recent than Book 1)
        ReadingSession(
          id: 4,
          bookId: 2,
          currentPage: 0,
          minutesRead: 0,
          createdAt: DateTime(2026, 11, 12, 10, 0),
          type: ReadingSessionType.start,
        ),
        ReadingSession(
          id: 5,
          bookId: 2,
          currentPage: 35,
          minutesRead: 40,
          createdAt: DateTime(2026, 11, 15, 22, 0),
        ),
        // Book 3 only read in October (should not appear in November)
        ReadingSession(
          id: 6,
          bookId: 3,
          currentPage: 100,
          minutesRead: 60,
          createdAt: DateTime(2026, 10, 15, 18, 0),
        ),
      ];

      final summaries = computeMonthlyBookSummaries(sessions, focusedMonth);

      expect(summaries.length, 2);
      // Most recent first: Book 2 (Nov 15), then Book 1 (Nov 10)
      expect(summaries[0].bookId, 2);
      expect(summaries[0].pagesRead, 35);
      expect(summaries[0].totalSecondsRead, 40 * 60);

      expect(summaries[1].bookId, 1);
      expect(summaries[1].pagesRead, 70); // (90 - 50) + (120 - 90)
      expect(summaries[1].totalSecondsRead, (25 * 60 + 30) + (20 * 60));
    });
  });

  group('formatReadingDuration', () {
    test('formats seconds, minutes, and hours cleanly', () {
      expect(formatReadingDuration(0), '0 min');
      expect(formatReadingDuration(45), '45 s');
      expect(formatReadingDuration(25 * 60), '25 min');
      expect(formatReadingDuration(3600), '1 h');
      expect(formatReadingDuration(3600 + 25 * 60), '1 h 25 min');
    });
  });

  group('ReadingCalendarPage widget', () {
    final now = DateTime.now();
    final day1 = DateTime(now.year, now.month, 1, 10, 0);
    final day2 = DateTime(now.year, now.month, 2, 11, 0);

    final testBooks = [
      Book(
        id: 1,
        title: 'Dune',
        author: 'Frank Herbert',
        coverUrl: '',
        status: BookStatus.reading,
        createdAt: day1,
      ),
      Book(
        id: 2,
        title: 'Fondation',
        author: 'Isaac Asimov',
        coverUrl: '',
        status: BookStatus.reading,
        createdAt: day2,
      ),
    ];

    final testSessions = [
      ReadingSession(
        id: 1,
        bookId: 1,
        currentPage: 42,
        minutesRead: 30,
        createdAt: day1,
      ),
      ReadingSession(
        id: 2,
        bookId: 2,
        currentPage: 18,
        minutesRead: 15,
        createdAt: day2,
      ),
      ReadingSession(
        id: 3,
        bookId: 1,
        currentPage: 50,
        minutesRead: 10,
        createdAt: day2.add(const Duration(hours: 1)),
      ),
    ];

    Widget buildTestApp(ReadingCalendarMode mode) {
      return ProviderScope(
        overrides: [
          allReadingSessionsProvider.overrideWith((ref) async => testSessions),
          booksControllerProvider.overrideWith(() => _FakeBooksController(testBooks)),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(0.9),
            ),
            child: child!,
          ),
          home: ReadingCalendarPage(mode: mode),
        ),
      );
    }

    testWidgets('streak mode shows flames and no monthly books list', (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(buildTestApp(ReadingCalendarMode.streak));
      await tester.pumpAndSettle();

      expect(find.text('Série de lecture'), findsOneWidget);
      expect(find.byIcon(Icons.local_fire_department_rounded), findsNWidgets(2));
    });

    testWidgets('covers mode shows no flames and lists monthly books newest first', (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(buildTestApp(ReadingCalendarMode.covers));
      await tester.pumpAndSettle();

      expect(find.text('Calendrier de lectures'), findsOneWidget);
      expect(find.byIcon(Icons.local_fire_department_rounded), findsNothing);

      // Scroll down to ensure monthly books list is built and visible
      await tester.scrollUntilVisible(find.text('18 pages lues'), 200);
      await tester.pumpAndSettle();

      // Monthly list contains both books with pages read and duration
      expect(find.text('18 pages lues'), findsOneWidget);
      expect(find.text('15 min'), findsOneWidget);
      expect(find.text('50 pages lues'), findsOneWidget);
      expect(find.text('40 min'), findsOneWidget);

      // Book 1 (last read at day2 + 1h) should appear above Fondation (day2)
      final duneY = tester.getTopLeft(find.text('Dune').last).dy;
      final fondationY = tester.getTopLeft(find.text('Fondation').last).dy;
      expect(duneY, lessThan(fondationY));
    });
  });
}
