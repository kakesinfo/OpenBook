import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

Future<Database>? _booksDatabaseFuture;

Future<Database> getBooksDatabase() {
  return _booksDatabaseFuture ??= _openBooksDatabase();
}

Future<Database> _openBooksDatabase() async {
  final directory = await getApplicationDocumentsDirectory();
  final databasePath = p.join(directory.path, 'books_collection.db');

  return openDatabase(
    databasePath,
    version: 7,
    onCreate: (database, version) async {
      await database.execute('''
        CREATE TABLE books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          series TEXT NOT NULL,
          volume INTEGER,
          coverUrl TEXT NOT NULL,
          totalPages INTEGER,
          startedAt INTEGER,
          finishedAt INTEGER,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      ''');

      await database.execute('''
        CREATE TABLE book_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bookId INTEGER NOT NULL UNIQUE,
          status INTEGER NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
        )
      ''');

      await database.execute('''
        CREATE TABLE reading_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bookId INTEGER NOT NULL,
          currentPage INTEGER NOT NULL,
          minutesRead INTEGER NOT NULL,
          secondsRead INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL,
          sessionType INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
        )
      ''');
    },
    onUpgrade: (database, oldVersion, newVersion) async {
      if (oldVersion < 2) {
        await database.execute('ALTER TABLE books ADD COLUMN totalPages INTEGER');
      }

      if (oldVersion < 3) {
        await database.execute('''
          CREATE TABLE IF NOT EXISTS reading_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookId INTEGER NOT NULL,
            currentPage INTEGER NOT NULL,
            minutesRead INTEGER NOT NULL,
            secondsRead INTEGER NOT NULL DEFAULT 0,
            createdAt INTEGER NOT NULL,
            sessionType INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
          )
        ''');
      }

      if (oldVersion == 3) {
        await database.execute(
          'ALTER TABLE reading_sessions ADD COLUMN sessionType INTEGER NOT NULL DEFAULT 1',
        );
      }

      if (oldVersion < 5) {
        await database.execute(
          'ALTER TABLE reading_sessions ADD COLUMN secondsRead INTEGER NOT NULL DEFAULT 0',
        );
      }

      if (oldVersion < 6) {
        await database.execute('''
          CREATE TABLE IF NOT EXISTS book_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookId INTEGER NOT NULL UNIQUE,
            status INTEGER NOT NULL,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
          )
        ''');

        await database.execute('''
          INSERT OR IGNORE INTO book_status (bookId, status, createdAt, updatedAt)
          SELECT
            id,
            COALESCE(status, 0),
            COALESCE(createdAt, CAST(strftime('%s','now') AS INTEGER) * 1000),
            COALESCE(updatedAt, CAST(strftime('%s','now') AS INTEGER) * 1000)
          FROM books
        ''');

        final booksColumns = await database.rawQuery('PRAGMA table_info(books)');
        final hasStatusColumn = booksColumns.any((column) => column['name'] == 'status');
        if (hasStatusColumn) {
          await database.execute('PRAGMA foreign_keys = OFF');
          await database.transaction((txn) async {
            await txn.execute('''
              CREATE TABLE books_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                series TEXT NOT NULL,
                volume INTEGER,
                coverUrl TEXT NOT NULL,
                totalPages INTEGER,
                startedAt INTEGER,
                finishedAt INTEGER,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL
              )
            ''');

            await txn.execute('''
              INSERT INTO books_new (
                id, title, author, series, volume, coverUrl,
                totalPages, startedAt, finishedAt, createdAt, updatedAt
              )
              SELECT
                id, title, author, series, volume, coverUrl,
                totalPages, startedAt, finishedAt, createdAt, updatedAt
              FROM books
            ''');

            await txn.execute('DROP TABLE books');
            await txn.execute('ALTER TABLE books_new RENAME TO books');
          });
          await database.execute('PRAGMA foreign_keys = ON');
        }
      }

      if (oldVersion < 7) {
        final booksColumns = await database.rawQuery('PRAGMA table_info(books)');
        final hasNotesColumn = booksColumns.any((column) => column['name'] == 'notes');
        if (hasNotesColumn) {
          await database.execute('PRAGMA foreign_keys = OFF');
          await database.transaction((txn) async {
            await txn.execute('''
              CREATE TABLE books_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                series TEXT NOT NULL,
                volume INTEGER,
                coverUrl TEXT NOT NULL,
                totalPages INTEGER,
                startedAt INTEGER,
                finishedAt INTEGER,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL
              )
            ''');

            await txn.execute('''
              INSERT INTO books_new (
                id, title, author, series, volume, coverUrl,
                totalPages, startedAt, finishedAt, createdAt, updatedAt
              )
              SELECT
                id, title, author, series, volume, coverUrl,
                totalPages, startedAt, finishedAt, createdAt, updatedAt
              FROM books
            ''');

            await txn.execute('DROP TABLE books');
            await txn.execute('ALTER TABLE books_new RENAME TO books');
          });
          await database.execute('PRAGMA foreign_keys = ON');
        }
      }
    },
  );
}