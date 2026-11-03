import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_application_1/features/books/data/book_transaction.dart';

void main() {
  group('BookTransaction tests', () {
    test('creates transaction and checks properties for purchase', () {
      final tx = BookTransaction(
        id: 1,
        bookId: 42,
        type: 'BOUGHT',
        date: '2026-05-10',
        price: 15.50,
        location: 'Fnac',
        memo: 'Édition collector',
      );

      expect(tx.isBought, isTrue);
      expect(tx.isGift, isFalse);
      expect(tx.isSold, isFalse);
      expect(tx.price, equals(15.50));
      expect(tx.date, equals('2026-05-10'));
      expect(tx.location, equals('Fnac'));
      expect(tx.memo, equals('Édition collector'));

      final json = tx.toJson();
      expect(json['type'], equals('BOUGHT'));
      expect(json['price'], equals(15.50));
      expect(json['date'], equals('2026-05-10'));
      expect(json['location'], equals('Fnac'));
      expect(json['memo'], equals('Édition collector'));
    });

    test('creates transaction and checks properties for gift', () {
      final tx = BookTransaction(
        id: 2,
        bookId: 42,
        type: 'GIFT',
        date: '2026-12-25',
        price: null,
        location: 'Noël / Famille',
        memo: 'Offert par mes parents',
      );

      expect(tx.isBought, isFalse);
      expect(tx.isGift, isTrue);
      expect(tx.isSold, isFalse);
      expect(tx.price, isNull);
      expect(tx.location, equals('Noël / Famille'));

      final parsed = BookTransaction.fromJson({
        'id': 2,
        'bookId': 42,
        'type': 'GIFT',
        'date': '2026-12-25',
        'price': null,
        'location': 'Noël / Famille',
        'memo': 'Offert par mes parents',
      });

      expect(parsed.isGift, isTrue);
      expect(parsed.price, isNull);
      expect(parsed.location, equals('Noël / Famille'));
    });
  });
}
