import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_application_1/app/theme_provider.dart';

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

  void _goToTab(int index) {
    setState(() => _index = index);
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(appThemeModeProvider);

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
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _goToTab,
          backgroundColor: AppTheme.bgSurface,
          indicatorColor: AppTheme.accentPrimaryLight,
          height: 64,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            NavigationDestination(
              icon: Icon(Icons.explore_outlined, color: AppTheme.textMuted),
              selectedIcon: Icon(Icons.explore_rounded, color: AppTheme.accentPrimary),
              label: 'Accueil',
            ),
            NavigationDestination(
              icon: Icon(Icons.menu_book_outlined, color: AppTheme.textMuted),
              selectedIcon: Icon(Icons.menu_book_rounded, color: AppTheme.accentPrimary),
              label: 'Mes Albums',
            ),
            NavigationDestination(
              icon: Icon(Icons.favorite_outline_rounded, color: AppTheme.textMuted),
              selectedIcon: Icon(Icons.favorite_rounded, color: AppTheme.accentRose),
              label: 'Souhaits',
            ),
            NavigationDestination(
              icon: Icon(Icons.settings_outlined, color: AppTheme.textMuted),
              selectedIcon: Icon(Icons.settings_rounded, color: AppTheme.accentPrimary),
              label: 'Paramètres',
            ),
          ],
        ),
      ),
    );
  }
}
