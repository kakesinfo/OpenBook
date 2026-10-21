import 'package:flutter/material.dart';

import '../home_page.dart';
import '../library_page.dart';
import '../settings_page.dart';

class BooksShell extends StatefulWidget {
  const BooksShell({super.key});

  @override
  State<BooksShell> createState() => _BooksShellState();
}

class _BooksShellState extends State<BooksShell> {
  int _index = 0;

  final _pages = const [
    HomePage(),
    LibraryPage(),
    SettingsPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Accueil'),
          NavigationDestination(icon: Icon(Icons.local_library_outlined), label: 'Bibliothèque'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'Paramètres'),
        ],
      ),
    );
  }
}