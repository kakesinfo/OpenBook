import 'book.dart';

class GlossaryWord {
  const GlossaryWord({
    required this.id,
    required this.word,
    required this.definition,
    this.books = const [],
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final String word;
  final String definition;
  final List<Book> books;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get initialLetter {
    final trimmed = word.trim();
    if (trimmed.isEmpty) return '#';
    final first = trimmed[0].toUpperCase();
    // Normalize accented characters for grouping
    const accents = 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ';
    const normal  = 'AAAAAACEEEEIIIINOOOOOUUUUY';
    final idx = accents.indexOf(first);
    final normalized = idx != -1 ? normal[idx] : first;
    return RegExp(r'^[A-Z]$').hasMatch(normalized) ? normalized : '#';
  }

  GlossaryWord copyWith({
    int? id,
    String? word,
    String? definition,
    List<Book>? books,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return GlossaryWord(
      id: id ?? this.id,
      word: word ?? this.word,
      definition: definition ?? this.definition,
      books: books ?? this.books,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
