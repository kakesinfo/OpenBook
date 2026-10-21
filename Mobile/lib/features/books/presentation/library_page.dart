import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_details_page.dart';
import 'components/book_form_sheet.dart';
import 'components/book_grid_card.dart';

class LibraryPage extends ConsumerWidget {
  const LibraryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final books = ref.watch(filteredBooksProvider);
    final selectedFilter = ref.watch(bookFilterProvider);

    return SafeArea(
      child: Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () async {
            final draft = await showBookFormSheet(context);
            if (draft != null && context.mounted) {
              await ref.read(booksControllerProvider.notifier).saveBook(draft: draft);
            }
          },
          icon: const Icon(Icons.add),
          label: const Text('Ajouter un livre'),
        ),
        body: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Bibliothèque', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(
                      'Classe tes livres par statut et retrouve rapidement ceux que tu possèdes.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: SliverToBoxAdapter(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: BookLibraryFilter.values
                      .map(
                        (filter) => FilterChip(
                          label: Text(filter.label),
                          selected: selectedFilter == filter,
                          onSelected: (_) => ref.read(bookFilterProvider.notifier).setFilter(filter),
                        ),
                      )
                      .toList(),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            booksAsync.when(
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, stackTrace) => SliverFillRemaining(
                child: Center(child: Text(error.toString())),
              ),
              data: (_) {
                if (books.isEmpty) {
                  return const SliverFillRemaining(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: _EmptyLibraryState(),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 100),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.58,
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
      ),
    );
  }
}

class _EmptyLibraryState extends StatelessWidget {
  const _EmptyLibraryState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.library_books_outlined, size: 56, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text('Ta bibliothèque est vide', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('Ajoute ton premier livre ou ta première BD avec le bouton en bas à droite.'),
          ],
        ),
      ),
    );
  }
}