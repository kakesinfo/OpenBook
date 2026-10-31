import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_application_1/features/books/data/book.dart';

void main() {
  group('BookLibraryFilter', () {
    test('collection excludes wishlist, lent and sold books', () {
      final soldBook = Book(title: 'Album', status: BookStatus.sold);
      final lentBook = Book(title: 'BD', status: BookStatus.lent);
      final wishlistBook = Book(title: 'Manga', status: BookStatus.wishlist);

      expect(BookLibraryFilter.collection.matches(soldBook), isFalse);
      expect(BookLibraryFilter.collection.matches(lentBook), isFalse);
      expect(BookLibraryFilter.collection.matches(wishlistBook), isFalse);
    });

    test('souhaits and PAL filters match the right statuses', () {
      final wishlistBook = Book(title: 'Manga', status: BookStatus.wishlist);
      final unreadBook = Book(title: 'Manga', status: BookStatus.unread);
      final soldBook = Book(title: 'Roman', status: BookStatus.sold);

      expect(BookLibraryFilter.souhaits.matches(wishlistBook), isTrue);
      expect(BookLibraryFilter.pal.matches(unreadBook), isTrue);
      expect(BookLibraryFilter.vendus.matches(soldBook), isTrue);
    });
  });

  test('book draft round-trips to a book instance', () {
    final draft = BookDraft(
      title: 'Dune',
      author: 'Frank Herbert',
      series: 'Dune',
      volume: 1,
      coverUrl: 'https://example.com/cover.jpg',
      coverFilePath: null,
      coverSourceType: CoverSourceType.url,
      totalPages: 700,
      status: BookStatus.read,
    );

    final book = draft.toBook();

    expect(book.title, 'Dune');
    expect(book.author, 'Frank Herbert');
    expect(book.series, 'Dune');
    expect(book.volume, 1);
    expect(book.coverUrl, 'https://example.com/cover.jpg');
    expect(book.totalPages, 700);
    expect(book.status, BookStatus.read);
  });
}
