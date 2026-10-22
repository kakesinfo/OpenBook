import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import 'book_details_page.dart';
import 'book_reading_session_page.dart';
import 'components/app_header.dart';
import 'components/book_card.dart';
import 'components/add_book_sheet.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final readingBooks = ref.watch(readingBooksProvider);
    final wishlistBooks = ref.watch(wishlistBooksProvider);
    final viewportHeight = MediaQuery.of(context).size.height;
    final carouselHeight = (viewportHeight * 0.34).clamp(240.0, 300.0);

    return Scaffold(
      appBar: AppHeader(
        title: 'Yet Another Library',
        subtitle: 'Accueil & Lectures',
        actions: [
          IconButton(
            tooltip: 'Ajouter un livre',
            icon: const Icon(Icons.add, color: AppTheme.accentPrimary),
            onPressed: () {
              showAddBookSheet(context);
            },
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 16),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Accueil',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.02,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Retrouve tes lectures en cours et gère ta bibliothèque.',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.textMuted,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Stat cards
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverToBoxAdapter(
              child: booksAsync.when(
                loading: () => const _LoadingHero(),
                error: (error, _) => _EmptyHero(
                  title: 'Impossible de charger les données',
                  subtitle: error.toString(),
                ),
                data: (books) {
                  final totalBooks = books.where((book) => book.isOwned).length;
                  final unreadBooks = books.where((book) => book.isOwned && book.isUnread).length;

                  return Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          label: 'Collection',
                          value: totalBooks.toString(),
                          icon: Icons.collections_bookmark_rounded,
                          accentColor: AppTheme.accentPrimary,
                          lightBg: AppTheme.accentPrimaryLight,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatCard(
                          label: 'PAL',
                          value: unreadBooks.toString(),
                          icon: Icons.menu_book_rounded,
                          accentColor: AppTheme.accentSecondary,
                          lightBg: AppTheme.accentSecondaryLight,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatCard(
                          label: 'En cours',
                          value: readingBooks.length.toString(),
                          icon: Icons.auto_stories_rounded,
                          accentColor: AppTheme.accentAmber,
                          lightBg: AppTheme.accentAmberLight,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatCard(
                          label: 'Souhaits',
                          value: wishlistBooks.length.toString(),
                          icon: Icons.favorite_rounded,
                          accentColor: AppTheme.accentRose,
                          lightBg: AppTheme.accentRoseLight,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          // Lectures en cours Section Header
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
            sliver: SliverToBoxAdapter(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Lectures en cours',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.01,
                    ),
                  ),
                  if (readingBooks.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.accentPrimaryLight,
                        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                        border: Border.all(
                          color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        '${readingBooks.length}',
                        style: const TextStyle(
                          color: AppTheme.accentPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          // Lectures en cours Carousel
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverToBoxAdapter(
              child: readingBooks.isEmpty
                  ? const _EmptyHero(
                      title: 'Aucune lecture en cours',
                      subtitle:
                          'Ajoute un livre et passe-le en statut « En cours » pour suivre tes progrès.',
                    )
                  : CarouselSlider(
                      options: CarouselOptions(
                        height: carouselHeight,
                        viewportFraction: 1.0,
                        enlargeCenterPage: true,
                        padEnds: true,
                        enableInfiniteScroll: false,
                        scrollPhysics: const BouncingScrollPhysics(),
                      ),
                      items: readingBooks
                          .map(
                            (book) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: BookCard(
                                book: book,
                                onEdit: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => BookDetailsPage(book: book),
                                  ),
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
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accentColor,
    required this.lightBg,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accentColor;
  final Color lightBg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: lightBg,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: Center(
              child: Icon(icon, color: accentColor, size: 16),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppTheme.textMuted,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _LoadingHero extends StatelessWidget {
  const _LoadingHero();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 100,
      child: Center(child: CircularProgressIndicator(color: AppTheme.accentPrimary)),
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
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppTheme.accentPrimaryLight,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: const Center(
                  child: Icon(
                    Icons.auto_stories_rounded,
                    color: AppTheme.accentPrimary,
                    size: 18,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.textMuted,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
