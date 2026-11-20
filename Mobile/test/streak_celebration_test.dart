import 'package:flutter_application_1/features/books/application/streak_utils.dart';
import 'package:flutter_application_1/features/books/data/reading_session.dart';
import 'package:flutter_application_1/features/books/presentation/streak_celebration_page.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  group('evaluateFirstReadingOfDayStreak', () {
    // Thursday Nov 19, 2026 (weekday = 4 -> index 3)
    final now = DateTime(2026, 11, 19, 21, 0);

    test('triggers 0 -> 1 on first ever reading today', () {
      final result = evaluateFirstReadingOfDayStreak(
        sessionsBeforeSave: const [],
        sessionDate: now,
        referenceNow: now,
      );

      expect(result, isNotNull);
      expect(result!.previousStreak, 0);
      expect(result.newStreak, 1);
      expect(result.todayIndex, 3); // jeudi
      expect(result.activeWeekDayIndices, {3});
    });

    test('triggers N -> N+1 when yesterday was read and today has no session yet', () {
      final sessions = [
        ReadingSession(
          id: 1,
          bookId: 1,
          currentPage: 20,
          minutesRead: 15,
          createdAt: DateTime(2026, 11, 18, 20, 0), // mercredi (index 2)
        ),
      ];

      final result = evaluateFirstReadingOfDayStreak(
        sessionsBeforeSave: sessions,
        sessionDate: now,
        referenceNow: now,
      );

      expect(result, isNotNull);
      expect(result!.previousStreak, 1);
      expect(result.newStreak, 2);
      expect(result.todayIndex, 3);
      expect(result.activeWeekDayIndices, {2, 3});
    });

    test('returns null if a session was already recorded today', () {
      final sessions = [
        ReadingSession(
          id: 1,
          bookId: 1,
          currentPage: 10,
          minutesRead: 10,
          createdAt: DateTime(2026, 11, 19, 8, 30),
        ),
      ];

      final result = evaluateFirstReadingOfDayStreak(
        sessionsBeforeSave: sessions,
        sessionDate: now,
        referenceNow: now,
      );

      expect(result, isNull);
    });

    test('returns null if the new session is backdated to another day', () {
      final result = evaluateFirstReadingOfDayStreak(
        sessionsBeforeSave: const [],
        sessionDate: DateTime(2026, 11, 17, 12, 0),
        referenceNow: now,
      );

      expect(result, isNull);
    });
  });

  group('StreakCelebrationPage widget', () {
    testWidgets('animates from previousStreak to newStreak and closes on Continuer',
        (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      const data = StreakCelebrationData(
        previousStreak: 1,
        newStreak: 2,
        activeWeekDayIndices: {2, 3}, // mer. + jeu.
        todayIndex: 3, // jeu.
      );

      var dismissed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () async {
                    await StreakCelebrationPage.show(context, data: data);
                    dismissed = true;
                  },
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Before the +1 moment: previousStreak is shown
      expect(find.text('1'), findsOneWidget);
      expect(find.text('Série de lecture actuelle'), findsOneWidget);
      expect(find.text('lun.'), findsOneWidget);
      expect(find.text('jeu.'), findsOneWidget);

      // Advance past the +1 animation
      await tester.pump(const Duration(milliseconds: 1200));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('2'), findsOneWidget);
      expect(find.text('+1'), findsOneWidget);
      expect(find.byIcon(Icons.check_rounded), findsNWidgets(2));
      expect(find.text('Continuer'), findsOneWidget);

      // Dismiss via Continuer button
      await tester.tap(find.text('Continuer'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));

      expect(dismissed, isTrue);
    });
  });
}
