import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/book_grid_card.dart';

class PausedBooksPage extends ConsumerWidget {
  const PausedBooksPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final pausedBooks = ref.watch(pausedBooksProvider);

    return Scaffold(
      appBar: AppHeader(
        title: 'Lectures en pause',
        subtitle: pausedBooks.isEmpty
            ? 'Aucun livre en pause'
            : '${pausedBooks.length} lecture${pausedBooks.length > 1 ? 's' : ''} en pause',
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: RefreshIndicator(
        color: AppTheme.accentPrimary,
        onRefresh: () => ref.read(booksControllerProvider.notifier).reload(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
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
                if (pausedBooks.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: AppTheme.bgSurface,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.borderSubtle, width: 1),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.pause_circle_outline_rounded,
                                  size: 28,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Aucune lecture en pause',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Les livres dont tu mets la lecture en pause apparaîtront ici.',
                              style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.49,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final book = pausedBooks[index];
                        return BookGridCard(
                          book: book,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => BookDetailsPage(book: book),
                            ),
                          ),
                        );
                      },
                      childCount: pausedBooks.length,
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
