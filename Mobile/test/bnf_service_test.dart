import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_application_1/features/books/data/bnf_service.dart';

void main() {
  group('BnfService ISBN utilities', () {
    test('cleanIsbn strips spaces, hyphens and handles barcode addons', () {
      expect(BnfService.cleanIsbn(' 978-2-9560165-1-9 '), '9782956016519');
      expect(BnfService.cleanIsbn('978295601651900050'), '9782956016519');
      expect(BnfService.cleanIsbn('2-07-036002-4'), '2070360024');
      expect(BnfService.cleanIsbn('207036002X'), '207036002X');
    });

    test('isbn10ToIsbn13 converts correctly', () {
      expect(BnfService.isbn10ToIsbn13('2070360024'), '9782070360024');
      expect(BnfService.isbn10ToIsbn13('2956016515'), '9782956016519');
      expect(BnfService.isbn10ToIsbn13('123'), isNull);
    });

    test('isbn13ToIsbn10 converts correctly', () {
      expect(BnfService.isbn13ToIsbn10('9782070360024'), '2070360024');
      expect(BnfService.isbn13ToIsbn10('9782956016519'), '2956016512');
      expect(BnfService.isbn13ToIsbn10('9791093836003'), isNull); // 979 prefix cannot convert to ISBN-10
    });
  });

  group('BnfBookResult.fromJson', () {
    test('parses backend BnF JSON payload', () {
      final res = BnfBookResult.fromJson({
        'title': 'Astérix le Gaulois',
        'isbn': '9782012101333',
        'price': 11,
        'coverUrl':
            'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=9782012101333&couverture=1&taille=originale',
      });

      expect(res.title, 'Astérix le Gaulois');
      expect(res.isbn, '9782012101333');
      expect(res.price, 11);
      expect(
        res.coverUrl,
        'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=9782012101333&couverture=1&taille=originale',
      );
    });

    test('search returns empty list when apiClient is null or query is blank', () async {
      final service = BnfService();
      expect(await service.search(''), isEmpty);
      expect(await service.search('Astérix'), isEmpty);
    });
  });
}
