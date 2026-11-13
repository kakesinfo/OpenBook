import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/add_book_sheet.dart';
import 'components/book_grid_card.dart';

class LibraryPage extends ConsumerStatefulWidget {
  const LibraryPage({super.key});

  @override
  ConsumerState<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends ConsumerState<LibraryPage> {
  late final TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: ref.read(bookSearchQueryProvider));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(booksControllerProvider);
    final books = ref.watch(filteredBooksProvider);
    final selectedFilter = ref.watch(bookFilterProvider);

    return Scaffold(
      appBar: const AppHeader(
        title: 'Mes Albums',
        subtitle: 'Bibliothèque & Filtres',
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () {
          showAddBookSheet(context);
        },
        icon: const Icon(Icons.add),
        label: const Text('Ajouter un livre'),
      ),
      body: CustomScrollView(
        slivers: [
          // Search Bar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) {
                    ref.read(bookSearchQueryProvider.notifier).setQuery(val);
                    setState(() {});
                  },
                  style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Rechercher un album, une série, un auteur...',
                    hintStyle: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    prefixIcon: Icon(Icons.search_rounded, color: AppTheme.accentPrimary, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: Icon(Icons.clear_rounded, color: AppTheme.textMuted, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              ref.read(bookSearchQueryProvider.notifier).clear();
                              setState(() {});
                            },
                          )
                        : null,
                  ),
                ),
              ),
            ),
          ),

          // Filter Chips Row
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            sliver: SliverToBoxAdapter(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: BookLibraryFilter.values.map((filter) {
                    final isSelected = selectedFilter == filter;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(filter.label),
                        selected: isSelected,
                        onSelected: (_) =>
                            ref.read(bookFilterProvider.notifier).setFilter(filter),
                        backgroundColor: AppTheme.bgSurface,
                        selectedColor: AppTheme.accentPrimaryLight,
                        side: BorderSide(
                          color: isSelected
                              ? AppTheme.accentPrimary.withValues(alpha: 0.4)
                              : AppTheme.borderSubtle,
                          width: 1,
                        ),
                        labelStyle: TextStyle(
                          color: isSelected ? AppTheme.accentPrimary : AppTheme.textSecondary,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 13,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          booksAsync.when(
            loading: () => SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(color: AppTheme.accentPrimary),
              ),
            ),
            error: (error, _) => SliverFillRemaining(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Erreur : $error',
                    style: TextStyle(color: AppTheme.accentRed),
                  ),
                ),
              ),
            ),
            data: (_) {
              if (books.isEmpty) {
                final query = ref.watch(bookSearchQueryProvider).trim();
                if (query.isNotEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppTheme.bgElevated,
                                border: Border.all(color: AppTheme.borderSubtle),
                              ),
                              child: Icon(Icons.search_off_rounded, size: 32, color: AppTheme.textMuted),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Aucun album trouvé',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Aucun album ne correspond à « $query »',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: AppTheme.textMuted,
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextButton.icon(
                              onPressed: () {
                                _searchController.clear();
                                ref.read(bookSearchQueryProvider.notifier).clear();
                                setState(() {});
                              },
                              icon: const Icon(Icons.close_rounded, size: 16),
                              label: const Text('Effacer la recherche'),
                              style: TextButton.styleFrom(
                                foregroundColor: AppTheme.accentPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.accentPrimaryLight,
                              border: Border.all(
                                color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                                width: 1,
                              ),
                            ),
                            child: Center(
                              child: Icon(
                                Icons.collections_bookmark_rounded,
                                size: 30,
                                color: AppTheme.accentPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Votre collection est encore vide',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                              letterSpacing: -0.01,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 340),
                            child: Text(
                              'Ajoutez vos premiers livres ou BD pour constituer et suivre votre collection.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: AppTheme.textMuted,
                                height: 1.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Container(
                            height: 44,
                            decoration: BoxDecoration(
                              gradient: AppTheme.primaryGradient,
                              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.accentPrimaryGlow,
                                  blurRadius: 14,
                                  offset: Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                onTap: () {
                                  showAddBookSheet(context);
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 24),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.add, size: 18, color: Colors.white),
                                      SizedBox(width: 8),
                                      Text(
                                        'Ajouter un livre',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 16,
                    childAspectRatio: 0.49,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final book = books[index];
                      return BookGridCard(
                        book: book,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => BookDetailsPage(book: book)),
                        ),
                      );
                    },
                    childCount: books.length,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
