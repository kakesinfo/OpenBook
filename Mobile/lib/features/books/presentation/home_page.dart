import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import 'book_reading_session_page.dart';
import 'book_details_page.dart';
import 'components/book_card.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final readingBooks = ref.watch(readingBooksProvider);
    final viewportHeight = MediaQuery.of(context).size.height;
    final carouselHeight = (viewportHeight * 0.34).clamp(220.0, 280.0);

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Accueil', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(
                    'Retrouve tes lectures en cours et reprends rapidement là où tu t’es arrêté.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverToBoxAdapter(
              child: booksAsync.when(
                loading: () => const _LoadingHero(),
                error: (error, stackTrace) => _EmptyHero(
                  title: 'Impossible de charger les livres',
                  subtitle: error.toString(),
                ),
                data: (books) {
                  final totalBooks = books.where((book) => book.isOwned).length;
                  final unreadBooks = books.where((book) => book.isOwned && book.isUnread).length;

                  return Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _StatCard(label: 'Possédés', value: totalBooks.toString(), icon: Icons.collections_bookmark_outlined),
                      _StatCard(label: 'PAL', value: unreadBooks.toString(), icon: Icons.menu_book_outlined),
                      _StatCard(label: 'En cours', value: readingBooks.length.toString(), icon: Icons.auto_stories_outlined),
                    ],
                  );
                },
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
            sliver: SliverToBoxAdapter(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Lectures en cours', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverToBoxAdapter(
              child: readingBooks.isEmpty
                  ? const _EmptyHero(
                      title: 'Aucune lecture en cours',
                      subtitle: 'Ajoute un livre et passe-le en statut “En cours” pour l’afficher ici.',
                    )
                  : CarouselSlider(
                      options: CarouselOptions(
                        height: carouselHeight,
                        viewportFraction: 1.0,
                        enlargeCenterPage: true,
                        padEnds: true,
                        enableInfiniteScroll: false,
                        scrollPhysics: ScrollPhysics(parent: BouncingScrollPhysics()),
                      ),
                      items: readingBooks
                          .map(
                            (book) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: BookCard(
                                book: book,
                                onEdit: () => Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => BookDetailsPage(book: book)),
                                ),
                                onRecordSession: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => BookReadingSessionPage(book: book),
                                  ),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 108,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(label, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoadingHero extends StatelessWidget {
  const _LoadingHero();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 120,
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _EmptyHero extends StatelessWidget {
  const _EmptyHero({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54)),
        ],
      ),
    );
  }
}