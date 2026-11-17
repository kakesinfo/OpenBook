import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/add_book_sheet.dart';
import 'components/book_grid_card.dart';

class WishlistPage extends ConsumerStatefulWidget {
  const WishlistPage({super.key, this.onExploreCatalogue});

  final VoidCallback? onExploreCatalogue;

  @override
  ConsumerState<WishlistPage> createState() => _WishlistPageState();
}

class _WishlistPageState extends ConsumerState<WishlistPage> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(booksControllerProvider);
    final wishlistBooks = ref.watch(wishlistBooksProvider);

    final query = _searchQuery.trim().toLowerCase();
    final filteredWishlist = query.isEmpty
        ? wishlistBooks
        : wishlistBooks.where((book) {
            return book.title.toLowerCase().contains(query) ||
                book.author.toLowerCase().contains(query) ||
                book.series.toLowerCase().contains(query);
          }).toList();

    return Scaffold(
      appBar: const AppHeader(
        title: 'Liste de souhaits',
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () {
          showAddBookSheet(context, initialStatus: BookStatus.wishlist);
        },
        icon: const Icon(Icons.favorite_outline),
        label: const Text('Ajouter un souhait'),
      ),
      body: RefreshIndicator(
        color: AppTheme.accentPrimary,
        onRefresh: () => ref.read(booksControllerProvider.notifier).reload(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (wishlistBooks.isNotEmpty)
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
                      onChanged: (val) => setState(() => _searchQuery = val),
                      style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Rechercher un souhait, une série, un auteur...',
                        hintStyle: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        prefixIcon: Icon(Icons.search_rounded, color: AppTheme.accentPrimary, size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: Icon(Icons.clear_rounded, color: AppTheme.textMuted, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                      ),
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
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.accentRed),
                    ),
                  ),
                ),
              ),
              data: (_) {
                if (wishlistBooks.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppTheme.accentRoseLight,
                                border: Border.all(
                                  color: AppTheme.accentRoseBorder,
                                  width: 1,
                                ),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.favorite_rounded,
                                  size: 30,
                                  color: AppTheme.accentRose,
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Aucun livre dans vos souhaits',
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
                                'Retrouvez ici tous les ouvrages que vous aimeriez acquérir ou lire plus tard.',
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
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                  onTap: widget.onExploreCatalogue ??
                                      () {
                                        showAddBookSheet(
                                          context,
                                          initialStatus: BookStatus.wishlist,
                                        );
                                      },
                                  child: const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 22),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.explore_outlined, size: 18, color: Colors.white),
                                        SizedBox(width: 8),
                                        Text(
                                          'Explorer le catalogue',
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

                if (filteredWishlist.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off_rounded, size: 36, color: AppTheme.textMuted),
                            const SizedBox(height: 12),
                            Text(
                              'Aucun résultat pour « ${_searchQuery.trim()} »',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.49,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final book = filteredWishlist[index];
                        return BookGridCard(
                          book: book,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => BookDetailsPage(book: book)),
                          ),
                        );
                      },
                      childCount: filteredWishlist.length,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
