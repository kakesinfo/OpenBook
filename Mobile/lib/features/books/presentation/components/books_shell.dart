import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_application_1/app/theme_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../widget/android_reading_widget_service.dart';
import '../../application/books_providers.dart';
import '../../data/book.dart';
import '../book_reading_session_page.dart';
import '../home_page.dart';
import '../library_page.dart';
import '../settings_page.dart';
import '../wishlist_page.dart';

class BooksShell extends ConsumerStatefulWidget {
  const BooksShell({super.key});

  @override
  ConsumerState<BooksShell> createState() => _BooksShellState();
}

class _BooksShellState extends ConsumerState<BooksShell> {
  int _index = 0;
  StreamSubscription<WidgetFinishSessionPayload>? _widgetFinishSubscription;
  WidgetFinishSessionPayload? _pendingPayload;

  @override
  void initState() {
    super.initState();
    AndroidReadingWidgetService.instance.ensureInitialized();
    _widgetFinishSubscription = AndroidReadingWidgetService.instance.onFinishSession.listen(
      _handleWidgetFinishPayload,
    );
    _checkInitialWidgetSession();
  }

  Future<void> _checkInitialWidgetSession() async {
    final payload = await AndroidReadingWidgetService.instance.consumePendingWidgetSession();
    if (payload != null && mounted) {
      _handleWidgetFinishPayload(payload);
    }
  }

  void _handleWidgetFinishPayload(WidgetFinishSessionPayload payload) {
    if (!mounted) return;
    final books = ref.read(booksControllerProvider).value;
    if (books != null && books.isNotEmpty) {
      _openSessionForPayload(payload, books);
    } else {
      _pendingPayload = payload;
    }
  }

  void _openSessionForPayload(WidgetFinishSessionPayload payload, List<Book> books) {
    Book? targetBook;
    for (final book in books) {
      if (book.id == payload.bookId) {
        targetBook = book;
        break;
      }
    }
    if (targetBook == null) return;

    _pendingPayload = null;
    setState(() => _index = 0);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => BookReadingSessionPage(
            book: targetBook!,
            initialDuration: Duration(seconds: payload.elapsedSeconds),
          ),
        ),
      );
    });
  }

  @override
  void dispose() {
    _widgetFinishSubscription?.cancel();
    super.dispose();
  }

  void _goToTab(int index) {
    setState(() => _index = index);
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(appThemeModeProvider);
    final booksAsync = ref.watch(booksControllerProvider);
    final readingBooks = ref.watch(readingBooksProvider);

    final activeReadingBook = readingBooks.isNotEmpty ? readingBooks.first : null;
    final progressAsync = activeReadingBook != null
        ? ref.watch(readingProgressByBookProvider(activeReadingBook))
        : null;

    // Synchronise le widget Android dès que la lecture en cours ou sa progression évolue
    if (booksAsync.hasValue) {
      if (activeReadingBook == null) {
        AndroidReadingWidgetService.instance.syncReadingBook(
          book: null,
          progress: null,
        );
      } else if (progressAsync != null && progressAsync.hasValue) {
        AndroidReadingWidgetService.instance.syncReadingBook(
          book: activeReadingBook,
          progress: progressAsync.value,
        );
      }

      if (_pendingPayload != null && booksAsync.value != null) {
        final payload = _pendingPayload!;
        _openSessionForPayload(payload, booksAsync.value!);
      }
    }

    final pages = [
      HomePage(key: ValueKey('home_${themeMode.name}')),
      LibraryPage(key: ValueKey('library_${themeMode.name}')),
      WishlistPage(
        key: ValueKey('wishlist_${themeMode.name}'),
        onExploreCatalogue: () => _goToTab(1),
      ),
      SettingsPage(key: ValueKey('settings_${themeMode.name}')),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppTheme.bgSurface,
          border: Border(
            top: BorderSide(color: AppTheme.borderSubtle, width: 1),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _goToTab,
          backgroundColor: AppTheme.bgSurface,
          indicatorColor: AppTheme.accentPrimaryLight,
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.newspaper_outlined),
              selectedIcon: Icon(Icons.newspaper_rounded, color: AppTheme.accentPrimary),
              label: 'Accueil',
            ),
            NavigationDestination(
              icon: const Icon(Icons.menu_book_outlined),
              selectedIcon: Icon(Icons.menu_book_rounded, color: AppTheme.accentPrimary),
              label: 'Mes Albums',
            ),
            NavigationDestination(
              icon: const Icon(Icons.favorite_outline_rounded),
              selectedIcon: Icon(Icons.favorite_rounded, color: AppTheme.accentRose),
              label: 'Souhaits',
            ),
            NavigationDestination(
              icon: const Icon(Icons.settings_outlined),
              selectedIcon: Icon(Icons.settings_rounded, color: AppTheme.accentPrimary),
              label: 'Paramètres',
            ),
          ],
        ),
      ),
    );
  }
}
