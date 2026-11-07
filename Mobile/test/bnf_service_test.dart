import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

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

  group('BnfService parseBnfResponse', () {
    test('parses UNIMARC record with title, subtitle and price', () {
      const xml = '''
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>1</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
          <mxc:datafield tag="010">
            <mxc:subfield code="a">978-2-9560165-1-9</mxc:subfield>
            <mxc:subfield code="d">50 EUR</mxc:subfield>
          </mxc:datafield>
          <mxc:datafield tag="200">
            <mxc:subfield code="a">Young romance</mxc:subfield>
            <mxc:subfield code="e">L'intégrale</mxc:subfield>
          </mxc:datafield>
        </mxc:record>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>
''';

      final res = BnfService.parseBnfResponse(xml, '9782956016519');
      expect(res, isNotNull);
      expect(res!.title, "Young romance : L'intégrale");
      expect(res.price, 50);
      expect(res.isbn, '9782956016519');
      expect(
        res.coverUrl,
        'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=9782956016519&couverture=1&taille=originale',
      );
    });

    test('parses decimal price correctly and rounds to integer', () {
      const xml = '''
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>1</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
          <mxc:datafield tag="010">
            <mxc:subfield code="d">17,50 EUR</mxc:subfield>
          </mxc:datafield>
          <mxc:datafield tag="200">
            <mxc:subfield code="a">La vengeance de Black Hand</mxc:subfield>
          </mxc:datafield>
        </mxc:record>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>
''';

      final res = BnfService.parseBnfResponse(xml, '9782365772143');
      expect(res, isNotNull);
      expect(res!.title, 'La vengeance de Black Hand');
      expect(res.price, 18);
      expect(res.isbn, '9782365772143');
      expect(
        res.coverUrl,
        'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=9782365772143&couverture=1&taille=originale',
      );
    });

    test('returns null when numberOfRecords is 0', () {
      const xml = '''
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>0</srw:numberOfRecords>
</srw:searchRetrieveResponse>
''';

      final res = BnfService.parseBnfResponse(xml, '9780000000000');
      expect(res, isNull);
    });

    test('falls back to Dublin Core title when UNIMARC tag 200 is missing', () {
      const xml = '''
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>1</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">L'Étranger / Albert Camus</dc:title>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>
''';

      final res = BnfService.parseBnfResponse(xml, '2070360024');
      expect(res, isNotNull);
      expect(res!.title, "L'Étranger");
      expect(res.price, isNull);
      expect(res.isbn, '9782070360024'); // Converted to ISBN-13
      expect(
        res.coverUrl,
        'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=9782070360024&couverture=1&taille=originale',
      );
    });
  });

  group('BnfService lookupByIsbn with MockClient', () {
    test('successful lookup returns BnfBookResult', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.host, 'catalogue.bnf.fr');
        expect(request.url.queryParameters['query'], contains('bib.isbn all "9782956016519"'));

        return http.Response(
          '''
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>1</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
          <mxc:datafield tag="010">
            <mxc:subfield code="d">50 EUR</mxc:subfield>
          </mxc:datafield>
          <mxc:datafield tag="200">
            <mxc:subfield code="a">Young romance</mxc:subfield>
          </mxc:datafield>
        </mxc:record>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>
''',
          200,
        );
      });

      final service = BnfService(client: mockClient);
      final result = await service.lookupByIsbn('978-2-9560165-1-9');

      expect(result, isNotNull);
      expect(result!.title, 'Young romance');
      expect(result.price, 50);
      expect(result.isbn, '9782956016519');
      expect(
        result.coverUrl,
        'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=9782956016519&couverture=1&taille=originale',
      );
    });

    test('returns null when book not found on BNF', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/"><srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>',
          200,
        );
      });

      final service = BnfService(client: mockClient);
      final result = await service.lookupByIsbn('9780000000000');
      expect(result, isNull);
    });

    test('returns null gracefully on network failure', () async {
      final mockClient = MockClient((request) async {
        throw http.ClientException('Network down');
      });

      final service = BnfService(client: mockClient);
      final result = await service.lookupByIsbn('9782956016519');
      expect(result, isNull);
    });

    test('returns null immediately for invalid ISBN length', () async {
      final service = BnfService();
      final result = await service.lookupByIsbn('12345');
      expect(result, isNull);
    });
  });
}
