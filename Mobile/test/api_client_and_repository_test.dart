import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter_application_1/core/network/api_client.dart';
import 'package:flutter_application_1/features/books/data/book.dart';
import 'package:flutter_application_1/features/books/data/books_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('ApiClient sanitize helpers', () {
    test('sanitizes host and port inputs correctly', () {
      expect(ApiClientNotifier.sanitizeHost('  http://192.168.1.50:8080/api  '), '192.168.1.50');
      expect(ApiClientNotifier.sanitizeHost('https://backend.example.com/'), 'backend.example.com');
      expect(ApiClientNotifier.sanitizeHost('localhost:3000'), 'localhost');

      expect(ApiClientNotifier.sanitizePort(' 8080 '), '8080');
      expect(ApiClientNotifier.sanitizePort('99999'), '8080');
      expect(ApiClientNotifier.sanitizePort('abc'), '8080');
      expect(ApiClientNotifier.sanitizePort('3000'), '3000');
    });

    test('initial state has no config and is unauthenticated', () {
      const state = ApiClientState();
      expect(state.hasServerConfig, isFalse);
      expect(state.isAuthenticated, isFalse);
      expect(state.baseUrl, '');
    });

    test('setting host and port updates baseUrl and hasServerConfig', () {
      final state = const ApiClientState().copyWith(host: '10.0.2.2', port: '8080');
      expect(state.hasServerConfig, isTrue);
      expect(state.baseUrl, 'http://10.0.2.2:8080');
      expect(state.isAuthenticated, isFalse);
    });

    test('setting token marks client as authenticated', () {
      final state = const ApiClientState().copyWith(
        host: 'localhost',
        port: '8080',
        token: 'jwt-test-token',
        userName: 'mobileuser',
      );
      expect(state.isAuthenticated, isTrue);
      expect(state.userName, 'mobileuser');
    });
  });

  group('BooksRepository instantiation and status mapping', () {
    test('instantiates with ApiClientNotifier', () {
      final repo = BooksRepository(ApiClientNotifier());
      expect(repo, isNotNull);

      expect(BookStatus.wishlist.index, 5);
      expect(BookStatus.lent.index, 4);
      expect(BookStatus.sold.index, 3);
      expect(BookStatus.unread.index, 0);
      expect(BookStatus.reading.index, 1);
      expect(BookStatus.read.index, 2);
    });

    test('searchBooks with empty or blank query returns empty list immediately', () async {
      final repo = BooksRepository(ApiClientNotifier());
      final emptyResult = await repo.searchBooks('');
      expect(emptyResult, isEmpty);

      final blankResult = await repo.searchBooks('   ');
      expect(blankResult, isEmpty);
    });

    test('saveBook without id throws UnsupportedError (manual book creation removed)', () {
      final repo = BooksRepository(ApiClientNotifier());
      final manualBook = Book(title: 'Manual Book', status: BookStatus.unread);
      expect(() => repo.saveBook(manualBook), throwsUnsupportedError);
    });

    test('quickCreateBook validates title is non-empty', () async {
      final repo = BooksRepository(ApiClientNotifier());
      expect(() => repo.quickCreateBook(title: ''), throwsArgumentError);
      expect(() => repo.quickCreateBook(title: '   '), throwsArgumentError);
    });

    test('resolveCoverUrl handles relative, localhost, UUID and remote urls', () {
      const baseUrl = 'http://192.168.1.100:8080';

      // Relative path
      expect(
        BooksRepository.resolveCoverUrl('/images/abc-123/blob', baseUrl),
        'http://192.168.1.100:8080/images/abc-123/blob',
      );

      // Localhost / 127.0.0.1 rewrite
      expect(
        BooksRepository.resolveCoverUrl('http://localhost:8080/images/abc-123/blob', baseUrl),
        'http://192.168.1.100:8080/images/abc-123/blob',
      );
      expect(
        BooksRepository.resolveCoverUrl('http://127.0.0.1:8080/images/abc-123/blob', baseUrl),
        'http://192.168.1.100:8080/images/abc-123/blob',
      );

      // Raw UUID
      expect(
        BooksRepository.resolveCoverUrl('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', baseUrl),
        'http://192.168.1.100:8080/images/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d/blob',
      );

      // Remote URL remains unchanged
      expect(
        BooksRepository.resolveCoverUrl('https://example.com/cover.jpg', baseUrl),
        'https://example.com/cover.jpg',
      );

      // Empty/null
      expect(BooksRepository.resolveCoverUrl('', baseUrl), '');
      expect(BooksRepository.resolveCoverUrl(null, baseUrl), '');
    });
  });
}
