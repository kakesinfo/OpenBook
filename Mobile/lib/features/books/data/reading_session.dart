enum ReadingSessionType {
  start,
  progress,
  end,
}

extension ReadingSessionTypeX on ReadingSessionType {
  String get label {
    switch (this) {
      case ReadingSessionType.start:
        return 'Start';
      case ReadingSessionType.progress:
        return 'Progress';
      case ReadingSessionType.end:
        return 'End';
    }
  }
}

class ReadingSession {
  const ReadingSession({
    this.id,
    required this.bookId,
    required this.currentPage,
    required this.minutesRead,
    this.secondsRead = 0,
    required this.createdAt,
    this.type = ReadingSessionType.progress,
    this.isCommon = false,
  });

  final int? id;
  final int bookId;
  final int currentPage;
  final int minutesRead;
  final int secondsRead;
  final DateTime createdAt;
  final ReadingSessionType type;
  final bool isCommon;

  factory ReadingSession.fromMap(Map<String, Object?> map) {
    return ReadingSession(
      id: map['id'] as int?,
      bookId: map['bookId'] as int,
      currentPage: map['currentPage'] as int,
      minutesRead: map['minutesRead'] as int,
      secondsRead: map['secondsRead'] as int? ?? 0,
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt'] as int),
      type: ReadingSessionType.values[(map['sessionType'] as int?) ?? ReadingSessionType.progress.index],
      isCommon: map['isCommon'] as bool? ?? false,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'bookId': bookId,
      'currentPage': currentPage,
      'minutesRead': minutesRead,
      'secondsRead': secondsRead,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'sessionType': type.index,
      'isCommon': isCommon,
    };
  }

  int get totalSecondsRead => minutesRead * 60 + secondsRead;
}
