import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/book_grid_card.dart';

class AbandonedBooksPage extends ConsumerWidget {
  const AbandonedBooksPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final abandonedBooks = ref.watch(abandonedBooksProvider);

    return Scaffold(
      appBar: AppHeader(
        title: 'Lectures abandonnées',
        subtitle: abandonedBooks.isEmpty
            ? 'Aucune lecture abandonnée'
            : '${abandonedBooks.length} lecture${abandonedBooks.length > 1 ? 's' : ''} abandonnée${abandonedBooks.length > 1 ? 's' : ''}',
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
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
          if (abandonedBooks.isEmpty) {
            return Center(
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
                          Icons.do_not_disturb_on_outlined,
                          size: 28,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Aucune lecture abandonnée',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Les livres dont tu as abandonné la lecture apparaîtront ici.',
                      style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return CustomScrollView(
            slivers: [
              SliverPadding(
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
                      final book = abandonedBooks[index];
                      return BookGridCard(
                        book: book,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => BookDetailsPage(book: book),
                          ),
                        ),
                      );
                    },
                    childCount: abandonedBooks.length,
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
