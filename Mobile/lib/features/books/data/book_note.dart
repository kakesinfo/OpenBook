import 'book.dart';

class BookNote {
  const BookNote({
    required this.id,
    required this.bookId,
    required this.content,
    this.book,
    this.username,
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final int bookId;
  final String content;
  final Book? book;
  final String? username;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  BookNote copyWith({
    int? id,
    int? bookId,
    String? content,
    Book? book,
    String? username,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BookNote(
      id: id ?? this.id,
      bookId: bookId ?? this.bookId,
      content: content ?? this.content,
      book: book ?? this.book,
      username: username ?? this.username,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
