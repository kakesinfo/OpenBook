class RetrospectiveBook {
  const RetrospectiveBook({
    this.id,
    required this.title,
    this.author = '',
    this.coverUrl = '',
    this.pageCount,
    this.price,
    this.readingSeconds,
    this.sessionsCount,
    this.pagesPerHour,
    this.pagesRead,
  });

  final int? id;
  final String title;
  final String author;
  final String coverUrl;
  final int? pageCount;
  final double? price;
  final int? readingSeconds;
  final int? sessionsCount;
  final double? pagesPerHour;
  final int? pagesRead;

  factory RetrospectiveBook.fromJson(
    Map<String, dynamic> json, {
    String Function(String?)? resolveCover,
  }) {
    final rawCover = json['coverUrl'] as String?;
    return RetrospectiveBook(
      id: (json['id'] as num?)?.toInt(),
      title: (json['title'] as String?) ?? '',
      author: (json['author'] as String?) ?? '',
      coverUrl: resolveCover != null ? resolveCover(rawCover) : (rawCover ?? ''),
      pageCount: (json['pageCount'] as num?)?.toInt(),
      price: (json['price'] as num?)?.toDouble(),
      readingSeconds: (json['readingSeconds'] as num?)?.toInt(),
      sessionsCount: (json['sessionsCount'] as num?)?.toInt(),
      pagesPerHour: (json['pagesPerHour'] as num?)?.toDouble(),
      pagesRead: (json['pagesRead'] as num?)?.toInt(),
    );
  }
}

class RetrospectiveBestMonth {
  const RetrospectiveBestMonth({
    required this.month,
    required this.monthName,
    required this.booksCount,
  });

  final int month;
  final String monthName;
  final int booksCount;

  factory RetrospectiveBestMonth.fromJson(Map<String, dynamic> json) {
    return RetrospectiveBestMonth(
      month: (json['month'] as num?)?.toInt() ?? 1,
      monthName: (json['monthName'] as String?) ?? '',
      booksCount: (json['booksCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class RetrospectiveTopStat {
  const RetrospectiveTopStat({
    required this.name,
    required this.count,
    required this.percentage,
  });

  final String name;
  final int count;
  final double percentage;

  factory RetrospectiveTopStat.fromJson(Map<String, dynamic> json) {
    return RetrospectiveTopStat(
      name: (json['name'] as String?) ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
      percentage: (json['percentage'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class YearlyRetrospective {
  const YearlyRetrospective({
    required this.year,
    this.availableYears = const [],
    this.booksReadCount = 0,
    this.pagesReadCount = 0,
    this.thickestBook,
    this.totalReadingSeconds = 0,
    this.longestReadBook,
    this.bestMonth,
    this.topCategory,
    this.topAuthor,
    this.topPublisher,
    this.totalSpentAmount = 0.0,
    this.boughtBooksCount = 0,
    this.mostExpensiveBook,
    this.fastestBook,
    this.slowestBook,
    this.longestStreakDays = 0,
    this.longestStreakStart,
    this.longestStreakEnd,
    this.readingDaysCount = 0,
  });

  final int year;
  final List<int> availableYears;
  final int booksReadCount;
  final int pagesReadCount;
  final RetrospectiveBook? thickestBook;
  final int totalReadingSeconds;
  final RetrospectiveBook? longestReadBook;
  final RetrospectiveBestMonth? bestMonth;
  final RetrospectiveTopStat? topCategory;
  final RetrospectiveTopStat? topAuthor;
  final RetrospectiveTopStat? topPublisher;
  final double totalSpentAmount;
  final int boughtBooksCount;
  final RetrospectiveBook? mostExpensiveBook;
  final RetrospectiveBook? fastestBook;
  final RetrospectiveBook? slowestBook;
  final int longestStreakDays;
  final String? longestStreakStart;
  final String? longestStreakEnd;
  final int readingDaysCount;

  /// A retrospective for [year] is only accessible starting January 1st of [year + 1].
  static bool isYearAccessible(int year, [DateTime? now]) {
    final reference = now ?? DateTime.now();
    final unlockDate = DateTime(year + 1, 1, 1);
    return !reference.isBefore(unlockDate);
  }

  factory YearlyRetrospective.fromJson(
    Map<String, dynamic> json, {
    String Function(String?)? resolveCover,
  }) {
    RetrospectiveBook? parseBook(String key) {
      final raw = json[key];
      if (raw is Map<String, dynamic>) {
        return RetrospectiveBook.fromJson(raw, resolveCover: resolveCover);
      }
      return null;
    }

    return YearlyRetrospective(
      year: (json['year'] as num?)?.toInt() ?? 0,
      availableYears: (json['availableYears'] as List<dynamic>?)
              ?.map((e) => (e as num).toInt())
              .toList() ??
          const [],
      booksReadCount: (json['booksReadCount'] as num?)?.toInt() ?? 0,
      pagesReadCount: (json['pagesReadCount'] as num?)?.toInt() ?? 0,
      thickestBook: parseBook('thickestBook'),
      totalReadingSeconds: (json['totalReadingSeconds'] as num?)?.toInt() ?? 0,
      longestReadBook: parseBook('longestReadBook'),
      bestMonth: json['bestMonth'] is Map<String, dynamic>
          ? RetrospectiveBestMonth.fromJson(json['bestMonth'] as Map<String, dynamic>)
          : null,
      topCategory: json['topCategory'] is Map<String, dynamic>
          ? RetrospectiveTopStat.fromJson(json['topCategory'] as Map<String, dynamic>)
          : null,
      topAuthor: json['topAuthor'] is Map<String, dynamic>
          ? RetrospectiveTopStat.fromJson(json['topAuthor'] as Map<String, dynamic>)
          : null,
      topPublisher: json['topPublisher'] is Map<String, dynamic>
          ? RetrospectiveTopStat.fromJson(json['topPublisher'] as Map<String, dynamic>)
          : null,
      totalSpentAmount: (json['totalSpentAmount'] as num?)?.toDouble() ?? 0.0,
      boughtBooksCount: (json['boughtBooksCount'] as num?)?.toInt() ?? 0,
      mostExpensiveBook: parseBook('mostExpensiveBook'),
      fastestBook: parseBook('fastestBook'),
      slowestBook: parseBook('slowestBook'),
      longestStreakDays: (json['longestStreakDays'] as num?)?.toInt() ?? 0,
      longestStreakStart: json['longestStreakStart'] as String?,
      longestStreakEnd: json['longestStreakEnd'] as String?,
      readingDaysCount: (json['readingDaysCount'] as num?)?.toInt() ?? 0,
    );
  }
}
