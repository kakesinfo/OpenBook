import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/add_book_sheet.dart';
import 'components/book_grid_card.dart';

class WishlistPage extends ConsumerWidget {
  const WishlistPage({super.key, this.onExploreCatalogue});

  final VoidCallback? onExploreCatalogue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final wishlistBooks = ref.watch(wishlistBooksProvider);

    final titleWithCount = wishlistBooks.isNotEmpty
        ? 'Liste de souhaits (${wishlistBooks.length})'
        : 'Liste de souhaits';

    return Scaffold(
      appBar: AppHeader(
        title: titleWithCount,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          showAddBookSheet(context, initialStatus: BookStatus.wishlist);
        },
        icon: const Icon(Icons.favorite_outline),
        label: const Text('Ajouter un souhait'),
      ),
      body: booksAsync.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: AppTheme.accentPrimary),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Erreur : $error',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.accentRed),
            ),
          ),
        ),
        data: (_) {
          if (wishlistBooks.isEmpty) {
            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Rose circle with heart icon matching WishlistPage.tsx
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
                    // Gradient Emerald Action Button matching WishlistPage.tsx
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
                          onTap: onExploreCatalogue ??
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
            );
          }

          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 16,
                    childAspectRatio: 0.56,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final book = wishlistBooks[index];
                      return BookGridCard(
                        book: book,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => BookDetailsPage(book: book)),
                        ),
                      );
                    },
                    childCount: wishlistBooks.length,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
