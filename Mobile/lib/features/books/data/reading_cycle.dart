import 'reading_session.dart';

class ReadingCycleRecord {
  const ReadingCycleRecord({
    required this.id,
    required this.bookId,
    required this.isCommon,
    required this.startedAt,
    this.endedAt,
    this.sessions = const <ReadingSession>[],
  });

  final int id;
  final int bookId;
  final bool isCommon;
  final DateTime startedAt;
  final DateTime? endedAt;
  final List<ReadingSession> sessions;
}
