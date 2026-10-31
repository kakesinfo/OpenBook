enum BookStatus {
  unread,
  reading,
  read,
  sold,
  lent,
  wishlist,
}

enum CoverSourceType {
  none,
  url,
  file,
}

enum BookLibraryFilter {
  collection,
  souhaits,
  pal,
  vendus,
}

extension BookStatusX on BookStatus {
  String get label {
    switch (this) {
      case BookStatus.unread:
        return 'Non lu';
      case BookStatus.reading:
        return 'En cours';
      case BookStatus.read:
        return 'Lu';
      case BookStatus.sold:
        return 'Vendu';
      case BookStatus.lent:
        return 'Prêté';
      case BookStatus.wishlist:
        return 'Souhait';
    }
  }
}

extension BookLibraryFilterX on BookLibraryFilter {
  String get label {
    switch (this) {
      case BookLibraryFilter.collection:
        return 'Collection';
      case BookLibraryFilter.souhaits:
        return 'Souhaits';
      case BookLibraryFilter.pal:
        return 'PAL';
      case BookLibraryFilter.vendus:
        return 'Vendus';
    }
  }

  bool matches(Book book) {
    switch (this) {
      case BookLibraryFilter.collection:
        return book.status != BookStatus.wishlist &&
            book.status != BookStatus.lent &&
            book.status != BookStatus.sold;
      case BookLibraryFilter.souhaits:
        return book.status == BookStatus.wishlist;
      case BookLibraryFilter.pal:
        return book.status == BookStatus.unread;
      case BookLibraryFilter.vendus:
        return book.status == BookStatus.sold;
    }
  }
}

class Book {
  Book({
    this.id,
    required this.title,
    this.author = '',
    this.series = '',
    this.volume,
    this.coverUrl = '',
    required this.status,
    this.totalPages,
    this.startedAt,
    this.finishedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  final int? id;

  final String title;

  final String author;

  final String series;

  final int? volume;

  final String coverUrl;

  final BookStatus status;

  final int? totalPages;

  final DateTime? startedAt;

  final DateTime? finishedAt;

  final DateTime createdAt;

  final DateTime updatedAt;

  bool get isOwned =>
      status != BookStatus.sold && status != BookStatus.wishlist && status != BookStatus.lent;

  bool get isCurrentlyReading => status == BookStatus.reading;

  bool get isUnread => status == BookStatus.unread;

  Book copyWith({
    int? id,
    String? title,
    String? author,
    String? series,
    int? volume,
    String? coverUrl,
    BookStatus? status,
    int? totalPages,
    DateTime? startedAt,
    DateTime? finishedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Book(
      id: id ?? this.id,
      title: title ?? this.title,
      author: author ?? this.author,
      series: series ?? this.series,
      volume: volume ?? this.volume,
      coverUrl: coverUrl ?? this.coverUrl,
      status: status ?? this.status,
      totalPages: totalPages ?? this.totalPages,
      startedAt: startedAt ?? this.startedAt,
      finishedAt: finishedAt ?? this.finishedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory Book.fromMap(Map<String, Object?> map) {
    return Book(
      id: map['id'] as int?,
      title: map['title'] as String? ?? '',
      author: map['author'] as String? ?? '',
      series: map['series'] as String? ?? '',
      volume: map['volume'] as int?,
      coverUrl: map['coverUrl'] as String? ?? '',
      status: BookStatus.values[(map['status'] as int?) ?? 0],
      totalPages: map['totalPages'] as int?,
      startedAt: _dateTimeFromMillis(map['startedAt']),
      finishedAt: _dateTimeFromMillis(map['finishedAt']),
      createdAt: _dateTimeFromMillis(map['createdAt']) ?? DateTime.now(),
      updatedAt: _dateTimeFromMillis(map['updatedAt']) ?? DateTime.now(),
    );
  }

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'title': title,
      'author': author,
      'series': series,
      'volume': volume,
      'coverUrl': coverUrl,
      'status': status.index,
      'totalPages': totalPages,
      'startedAt': startedAt?.millisecondsSinceEpoch,
      'finishedAt': finishedAt?.millisecondsSinceEpoch,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'updatedAt': updatedAt.millisecondsSinceEpoch,
    };
  }

  static DateTime? _dateTimeFromMillis(Object? value) {
    if (value is int) {
      return DateTime.fromMillisecondsSinceEpoch(value);
    }

    return null;
  }
}

class BookDraft {
  const BookDraft({
    required this.title,
    required this.author,
    required this.series,
    required this.volume,
    required this.coverUrl,
    this.coverFilePath,
    required this.coverSourceType,
    this.totalPages,
    required this.status,
  });

  final String title;
  final String author;
  final String series;
  final int? volume;
  final String coverUrl;
  final String? coverFilePath;
  final CoverSourceType coverSourceType;
  final int? totalPages;
  final BookStatus status;

  Book toBook({Book? existingBook, String? resolvedCoverPath}) {
    return Book(
      id: existingBook?.id,
      title: title,
      author: author,
      series: series,
      volume: volume,
      coverUrl: resolvedCoverPath ?? coverUrl,
      status: status,
      totalPages: totalPages,
      startedAt: existingBook?.startedAt,
      finishedAt: existingBook?.finishedAt,
      createdAt: existingBook?.createdAt,
      updatedAt: DateTime.now(),
    );
  }

  factory BookDraft.fromBook(Book book) {
    final coverUrl = book.coverUrl;
    final isNetworkCover = coverUrl.startsWith('http://') || coverUrl.startsWith('https://');

    return BookDraft(
      title: book.title,
      author: book.author,
      series: book.series,
      volume: book.volume,
      coverUrl: isNetworkCover ? coverUrl : '',
      coverFilePath: isNetworkCover || coverUrl.isEmpty ? null : coverUrl,
      coverSourceType: coverUrl.isEmpty
          ? CoverSourceType.none
          : (isNetworkCover ? CoverSourceType.url : CoverSourceType.file),
      status: book.status,
      totalPages: book.totalPages,
    );
  }
}
