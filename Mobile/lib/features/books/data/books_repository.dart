import 'package:sqflite/sqflite.dart';

import 'book.dart';
import 'reading_session.dart';

class BooksRepository {
  BooksRepository(this._databaseFuture);

  final Future<Database> _databaseFuture;

  Future<List<Book>> getAllBooks() async {
    final database = await _databaseFuture;
    final rows = await database.rawQuery('''
      SELECT
        b.id,
        b.title,
        b.author,
        b.series,
        b.volume,
        b.coverUrl,
        b.totalPages,
        b.startedAt,
        b.finishedAt,
        b.createdAt,
        b.updatedAt,
        COALESCE(bs.status, 0) AS status
      FROM books b
      LEFT JOIN book_status bs ON bs.bookId = b.id
      ORDER BY b.title COLLATE NOCASE ASC
    ''');
    return rows.map(Book.fromMap).toList();
  }

  Future<void> saveBook(Book book) async {
    final database = await _databaseFuture;
    final payload = book.copyWith(updatedAt: DateTime.now()).toMap();
    final booksPayload = Map<String, Object?>.from(payload)
      ..remove('id')
      ..remove('status');
    final statusPayload = <String, Object?>{
      'bookId': book.id,
      'status': book.status.index,
      'createdAt': book.createdAt.millisecondsSinceEpoch,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    };

    if (book.id == null) {
      final insertedId = await database.insert(
        'books',
        booksPayload,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      payload['id'] = insertedId;
      await database.insert(
        'book_status',
        Map<String, Object?>.from(statusPayload)..['bookId'] = insertedId,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    } else {
      await database.update(
        'books',
        booksPayload,
        where: 'id = ?',
        whereArgs: [book.id],
      );

      await database.insert(
        'book_status',
        Map<String, Object?>.from(statusPayload)..['bookId'] = book.id,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
  }

  Future<void> deleteBook(int id) async {
    final database = await _databaseFuture;
    await database.delete(
      'book_status',
      where: 'bookId = ?',
      whereArgs: [id],
    );

    await database.delete(
      'reading_sessions',
      where: 'bookId = ?',
      whereArgs: [id],
    );

    await database.delete(
      'books',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> addReadingSession(ReadingSession session) async {
    final database = await _databaseFuture;
    await database.insert(
      'reading_sessions',
      Map<String, Object?>.from(session.toMap())..remove('id'),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> deleteReadingSession(int sessionId) async {
    final database = await _databaseFuture;
    await database.delete(
      'reading_sessions',
      where: 'id = ?',
      whereArgs: [sessionId],
    );
  }

  Future<Map<int, List<ReadingSession>>> getSessionsByBookIds(List<int> bookIds) async {
    if (bookIds.isEmpty) {
      return {};
    }

    final database = await _databaseFuture;
    final placeholders = List.filled(bookIds.length, '?').join(',');
    final rows = await database.rawQuery(
      'SELECT * FROM reading_sessions WHERE bookId IN ($placeholders) ORDER BY createdAt ASC',
      bookIds,
    );

    final grouped = <int, List<ReadingSession>>{};
    for (final row in rows) {
      final session = ReadingSession.fromMap(row);
      grouped.putIfAbsent(session.bookId, () => <ReadingSession>[]).add(session);
    }

    return grouped;
  }

  Future<List<ReadingSession>> getSessionsByBookId(int bookId) async {
    final database = await _databaseFuture;
    final rows = await database.query(
      'reading_sessions',
      where: 'bookId = ?',
      whereArgs: [bookId],
      orderBy: 'createdAt ASC',
    );

    return rows.map(ReadingSession.fromMap).toList();
  }
}