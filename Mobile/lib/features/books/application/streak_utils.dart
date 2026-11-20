import '../data/reading_session.dart';

/// Données nécessaires pour afficher l'écran animé d'augmentation du streak.
class StreakCelebrationData {
  const StreakCelebrationData({
    required this.previousStreak,
    required this.newStreak,
    required this.activeWeekDayIndices,
    required this.todayIndex,
  });

  final int previousStreak;
  final int newStreak;

  /// Indices des jours lus cette semaine (0 = lundi .. 6 = dimanche), incluant aujourd'hui.
  final Set<int> activeWeekDayIndices;

  /// Indice du jour courant (0 = lundi .. 6 = dimanche).
  final int todayIndex;
}

String _dayKey(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Calcule la série de lecture actuelle (nombre de jours consécutifs).
int calculateReadingStreakDays(
  List<ReadingSession> sessions, {
  DateTime? referenceNow,
}) {
  if (sessions.isEmpty) return 0;

  final readDays = <String>{
    for (final s in sessions) _dayKey(s.createdAt),
  };

  final now = referenceNow ?? DateTime.now();
  var checkDate = DateTime(now.year, now.month, now.day);

  int streak = 0;

  // Si déjà lu aujourd'hui, on remonte depuis aujourd'hui
  if (readDays.contains(_dayKey(checkDate))) {
    while (readDays.contains(_dayKey(checkDate))) {
      streak++;
      checkDate = checkDate.subtract(const Duration(days: 1));
    }
    return streak;
  }

  // Sinon, si lu hier, la série est toujours en attente de la session d'aujourd'hui
  final yesterday = checkDate.subtract(const Duration(days: 1));
  if (readDays.contains(_dayKey(yesterday))) {
    checkDate = yesterday;
    while (readDays.contains(_dayKey(checkDate))) {
      streak++;
      checkDate = checkDate.subtract(const Duration(days: 1));
    }
    return streak;
  }

  return 0;
}

/// Retourne les indices (0 = lun .. 6 = dim) des jours lus dans la semaine courante.
Set<int> currentWeekReadDayIndices(
  List<ReadingSession> sessions, {
  DateTime? referenceNow,
}) {
  final now = referenceNow ?? DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final startOfWeek = today.subtract(Duration(days: today.weekday - 1));

  final indices = <int>{};
  for (final s in sessions) {
    final sDate = DateTime(s.createdAt.year, s.createdAt.month, s.createdAt.day);
    final diffDays = sDate.difference(startOfWeek).inDays;
    if (diffDays >= 0 && diffDays < 7) {
      indices.add(diffDays);
    }
  }
  return indices;
}

/// Détermine si l'enregistrement d'une session à [sessionDate] déclenche
/// l'écran d'augmentation du streak (première lecture de la journée).
///
/// Retourne `null` si la session n'est pas datée d'aujourd'hui ou si une
/// session existe déjà aujourd'hui dans [sessionsBeforeSave].
StreakCelebrationData? evaluateFirstReadingOfDayStreak({
  required List<ReadingSession> sessionsBeforeSave,
  required DateTime sessionDate,
  DateTime? referenceNow,
}) {
  final now = referenceNow ?? DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final targetDay = DateTime(sessionDate.year, sessionDate.month, sessionDate.day);

  if (targetDay != today) {
    return null;
  }

  final todayKey = _dayKey(today);
  final alreadyReadToday = sessionsBeforeSave.any(
    (s) => _dayKey(s.createdAt) == todayKey,
  );
  if (alreadyReadToday) {
    return null;
  }

  final previousStreak = calculateReadingStreakDays(
    sessionsBeforeSave,
    referenceNow: now,
  );
  final todayIndex = today.weekday - 1;
  final weekIndices = currentWeekReadDayIndices(
    sessionsBeforeSave,
    referenceNow: now,
  )..add(todayIndex);

  return StreakCelebrationData(
    previousStreak: previousStreak,
    newStreak: previousStreak + 1,
    activeWeekDayIndices: Set<int>.unmodifiable(weekIndices),
    todayIndex: todayIndex,
  );
}
