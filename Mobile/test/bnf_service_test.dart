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

    test('parses full backend BnF JSON payload (authors, editor, dimensions...)', () {
      final res = BnfBookResult.fromJson({
        'title': 'Watchmen',
        'isbn': '9782809499872',
        'price': 25,
        'coverUrl': 'https://example.com/cover.jpg',
        'seriesName': 'Watchmen',
        'volume': 1,
        'editorName': 'Urban Comics',
        'collectionName': 'DC Deluxe',
        'pageCount': 336,
        'releaseDate': '2012-10-10T00:00:00Z',
        'description': 'Un comics culte.',
        'docType': 'Livre',
        'height': 32,
        'length': 24,
        'thickness': 3,
        'authors': [
          {'firstname': 'Alan', 'lastname': 'Moore', 'type': 'Writer'},
          {'firstname': 'Dave', 'lastname': 'Gibbons', 'type': 'Illustrator'},
        ],
      });

      expect(res.seriesName, 'Watchmen');
      expect(res.volume, 1);
      expect(res.editorName, 'Urban Comics');
      expect(res.collectionName, 'DC Deluxe');
      expect(res.pageCount, 336);
      expect(res.releaseDate, '2012-10-10T00:00:00Z');
      expect(res.description, 'Un comics culte.');
      expect(res.docType, 'Livre');
      expect(res.height, 32);
      expect(res.length, 24);
      expect(res.thickness, 3);
      expect(res.authors, hasLength(2));
      expect(res.authors.first.lastname, 'Moore');
      expect(res.authors.first.type, 'Writer');
      expect(res.authors.last.type, 'Illustrator');
    });

    test('toBookFields builds the POST /books payload like the web app', () {
      final res = BnfBookResult.fromJson({
        'title': 'Watchmen',
        'isbn': '9782809499872',
        'price': 25,
        'coverUrl': 'https://example.com/cover.jpg',
        'seriesName': 'Watchmen',
        'volume': 1,
        'editorName': 'Urban Comics',
        'collectionName': 'DC Deluxe',
        'pageCount': 336,
        'releaseDate': '2012-10-10T00:00:00Z',
        'description': 'Un comics culte.',
        'docType': 'Livre',
        'height': 32,
        'length': 24,
        'thickness': 3,
        'authors': [
          {'firstname': 'Alan', 'lastname': 'Moore', 'type': 'Writer'},
        ],
      });

      final fields = res.toBookFields();

      expect(fields['seriesName'], 'Watchmen');
      expect(fields['volume'], 1);
      expect(fields['editorName'], 'Urban Comics');
      expect(fields['collectionName'], 'DC Deluxe');
      expect(fields['pageCount'], 336);
      expect(fields['releaseDate'], '2012-10-10T00:00:00Z');
      expect(fields['description'], 'Un comics culte.');
      expect(fields['type'], 'Livre');
      expect(fields['height'], 32);
      expect(fields['length'], 24);
      expect(fields['thickness'], 3);
      expect(fields['authors'], [
        {'firstname': 'Alan', 'lastname': 'Moore', 'type': 'Writer'},
      ]);
      // price / coverUrl / title / isbn ne font pas partie des métadonnées :
      // ils sont gérés par le formulaire de création rapide.
      expect(fields.containsKey('price'), isFalse);
      expect(fields.containsKey('coverUrl'), isFalse);
      expect(fields.containsKey('title'), isFalse);
    });

    test('toBookFields omits empty or zero values', () {
      final res = BnfBookResult.fromJson({
        'title': 'X',
        'isbn': '',
        'coverUrl': '',
        'editorName': '  ',
        'pageCount': 0,
      });

      final fields = res.toBookFields();
      expect(fields, isEmpty);
    });

    test('search returns empty list when apiClient is null or query is blank', () async {
      final service = BnfService();
      expect(await service.search(''), isEmpty);
      expect(await service.search('Astérix'), isEmpty);
    });
  });
}
