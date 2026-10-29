import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';

import '../home_page.dart';
import '../library_page.dart';
import '../settings_page.dart';
import '../wishlist_page.dart';

class BooksShell extends StatefulWidget {
  const BooksShell({super.key});

  @override
  State<BooksShell> createState() => _BooksShellState();
}

class _BooksShellState extends State<BooksShell> {
  int _index = 0;

  void _goToTab(int index) {
    setState(() => _index = index);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomePage(),
      LibraryPage(),
      WishlistPage(onExploreCatalogue: () => _goToTab(1)),
      SettingsPage(),
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
              icon: Icon(Icons.newspaper_outlined),
              selectedIcon: Icon(Icons.newspaper_rounded, color: AppTheme.accentPrimary),
              label: 'Accueil',
            ),
            NavigationDestination(
              icon: Icon(Icons.menu_book_outlined),
              selectedIcon: Icon(Icons.menu_book_rounded, color: AppTheme.accentPrimary),
              label: 'Collection',
            ),
            NavigationDestination(
              icon: Icon(Icons.favorite_outline_rounded),
              selectedIcon: Icon(Icons.favorite_rounded, color: AppTheme.accentRose),
              label: 'Souhaits',
            ),
            NavigationDestination(
              icon: Icon(Icons.settings_outlined),
              selectedIcon: Icon(Icons.settings_rounded, color: AppTheme.accentPrimary),
              label: 'Paramètres',
            ),
          ],
        ),
      ),
    );
  }
}
