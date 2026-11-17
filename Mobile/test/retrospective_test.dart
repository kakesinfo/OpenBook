import 'package:flutter/material.dart';
import 'package:flutter_application_1/features/books/application/books_providers.dart';
import 'package:flutter_application_1/features/books/data/retrospective.dart';
import 'package:flutter_application_1/features/books/presentation/components/retrospective_stories_section.dart';
import 'package:flutter_application_1/features/books/presentation/retrospective_story_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('YearlyRetrospective.isYearAccessible', () {
    test('is false before January 1st of the following year', () {
      expect(
        YearlyRetrospective.isYearAccessible(2025, DateTime(2025, 12, 31, 23, 59, 59)),
        isFalse,
      );
      expect(
        YearlyRetrospective.isYearAccessible(2026, DateTime(2026, 11, 17)),
        isFalse,
      );
    });

    test('is true starting January 1st of the following year', () {
      expect(
        YearlyRetrospective.isYearAccessible(2025, DateTime(2026, 1, 1, 0, 0, 0)),
        isTrue,
      );
      expect(
        YearlyRetrospective.isYearAccessible(2024, DateTime(2026, 11, 17)),
        isTrue,
      );
    });
  });

  group('YearlyRetrospective.fromJson', () {
    test('parses all 15 retrospective metrics', () {
      final retro = YearlyRetrospective.fromJson({
        'year': 2025,
        'availableYears': [2025, 2024],
        'booksReadCount': 24,
        'pagesReadCount': 8420,
        'thickestBook': {
          'id': 1,
          'title': 'Le Comte de Monte-Cristo',
          'author': 'Alexandre Dumas',
          'coverUrl': '/images/abc/blob',
          'pageCount': 1240,
        },
        'totalReadingSeconds': 360000,
        'longestReadBook': {
          'id': 2,
          'title': 'Dune',
          'author': 'Frank Herbert',
          'readingSeconds': 72000,
          'sessionsCount': 18,
        },
        'bestMonth': {
          'month': 8,
          'monthName': 'Août',
          'booksCount': 5,
        },
        'topCategory': {'name': 'Roman', 'count': 14, 'percentage': 58.3},
        'topAuthor': {'name': 'Brandon Sanderson', 'count': 4, 'percentage': 16.7},
        'topPublisher': {'name': 'Le Livre de Poche', 'count': 9, 'percentage': 37.5},
        'totalSpentAmount': 312.5,
        'boughtBooksCount': 16,
        'mostExpensiveBook': {
          'id': 3,
          'title': 'Artbook Collector',
          'author': 'Studio Ghibli',
          'price': 49.9,
        },
        'fastestBook': {
          'id': 4,
          'title': 'L\'Étranger',
          'author': 'Albert Camus',
          'pagesPerHour': 62.4,
          'pagesRead': 156,
          'readingSeconds': 9000,
        },
        'slowestBook': {
          'id': 5,
          'title': 'Critique de la raison pure',
          'author': 'Emmanuel Kant',
          'pagesPerHour': 12.0,
          'pagesRead': 120,
          'readingSeconds': 36000,
        },
        'longestStreakDays': 21,
        'longestStreakStart': '2025-07-01',
        'longestStreakEnd': '2025-07-21',
        'readingDaysCount': 185,
      }, resolveCover: (raw) => 'https://example.com$raw');

      expect(retro.year, 2025);
      expect(retro.booksReadCount, 24);
      expect(retro.pagesReadCount, 8420);
      expect(retro.thickestBook?.title, 'Le Comte de Monte-Cristo');
      expect(retro.thickestBook?.coverUrl, 'https://example.com/images/abc/blob');
      expect(retro.totalReadingSeconds, 360000);
      expect(retro.longestReadBook?.sessionsCount, 18);
      expect(retro.bestMonth?.monthName, 'Août');
      expect(retro.topCategory?.name, 'Roman');
      expect(retro.topAuthor?.name, 'Brandon Sanderson');
      expect(retro.topPublisher?.name, 'Le Livre de Poche');
      expect(retro.totalSpentAmount, 312.5);
      expect(retro.boughtBooksCount, 16);
      expect(retro.mostExpensiveBook?.price, 49.9);
      expect(retro.fastestBook?.pagesPerHour, 62.4);
      expect(retro.slowestBook?.pagesPerHour, 12.0);
      expect(retro.longestStreakDays, 21);
      expect(retro.readingDaysCount, 185);
    });
  });

  group('RetrospectiveStoriesSection', () {
    testWidgets('shows locked snackbar for current year and opens story for past year', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            retrospectiveYearsProvider.overrideWith((ref) async => [2026, 2025]),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: RetrospectiveStoriesSection(
                referenceDate: DateTime(2026, 11, 17),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('2026'), findsOneWidget);
      expect(find.text('1 jan. 2027'), findsOneWidget);
      expect(find.text('2025'), findsOneWidget);
      expect(find.text('Bilan 2025'), findsOneWidget);

      await tester.tap(find.text('2026'));
      await tester.pump();
      expect(
        find.text('La rétrospective 2026 sera accessible à partir du 1er janvier 2027.'),
        findsOneWidget,
      );
    });
  });

  group('RetrospectiveStoryPage', () {
    testWidgets('navigates through all 15 slides', (tester) async {
      final retro = YearlyRetrospective(
        year: 2025,
        booksReadCount: 12,
        pagesReadCount: 3450,
        thickestBook: const RetrospectiveBook(title: 'Gros Livre', pageCount: 900),
        totalReadingSeconds: 72000,
        longestReadBook: const RetrospectiveBook(
          title: 'Long Livre',
          readingSeconds: 18000,
          sessionsCount: 10,
        ),
        bestMonth: const RetrospectiveBestMonth(
          month: 8,
          monthName: 'Août',
          booksCount: 4,
        ),
        topCategory: const RetrospectiveTopStat(name: 'Manga', count: 6, percentage: 50),
        topAuthor: const RetrospectiveTopStat(name: 'Naoki Urasawa', count: 4, percentage: 33.3),
        topPublisher: const RetrospectiveTopStat(name: 'Kana', count: 5, percentage: 41.7),
        totalSpentAmount: 180.0,
        boughtBooksCount: 10,
        mostExpensiveBook: const RetrospectiveBook(title: 'Coffret Collector', price: 45.0),
        fastestBook: const RetrospectiveBook(
          title: 'Rapide',
          pagesPerHour: 55.0,
          pagesRead: 110,
          readingSeconds: 7200,
        ),
        slowestBook: const RetrospectiveBook(
          title: 'Lent',
          pagesPerHour: 15.0,
          pagesRead: 60,
          readingSeconds: 14400,
        ),
        longestStreakDays: 14,
        longestStreakStart: '2025-05-01',
        longestStreakEnd: '2025-05-14',
        readingDaysCount: 120,
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RetrospectiveStoryPage(
              year: 2025,
              initialData: retro,
            ),
          ),
        ),
      );
      await tester.pump();

      final expectedTitles = [
        'Nombre de livres lus',
        'Pages tournées',
        'Le plus gros livre',
        'Temps passé à lire',
        'Livre lu le plus longtemps',
        'Le mois le plus productif',
        'Catégorie la plus lue',
        'Auteur le plus lu',
        'Éditeur le plus lu',
        'Prix total des livres achetés',
        'Le livre le plus cher',
        'Le livre le plus rapide',
        'Le livre le plus lent',
        'Plus longue série de lecture',
        'Jours de lecture en 2025',
      ];

      final size = tester.getSize(find.byType(RetrospectiveStoryPage));
      final rightTap = Offset(size.width * 0.8, size.height * 0.5);

      for (int i = 0; i < expectedTitles.length; i++) {
        expect(find.text(expectedTitles[i]), findsOneWidget);
        expect(find.text('${i + 1}/15'), findsOneWidget);
        if (i < expectedTitles.length - 1) {
          await tester.tapAt(rightTap);
          await tester.pump(const Duration(milliseconds: 350));
        }
      }
    });
  });
}
