import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_details_page.dart';
import 'book_reading_session_page.dart';
import 'components/app_header.dart';
import 'components/book_card.dart';
import 'components/reading_streak_card.dart';
import 'paused_books_page.dart';
import 'reading_calendar_page.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(booksControllerProvider);
    final readingBooks = ref.watch(readingBooksProvider);
    final pausedBooks = ref.watch(pausedBooksProvider);
    final wishlistBooks = ref.watch(wishlistBooksProvider);
    final viewportHeight = MediaQuery.of(context).size.height;
    final carouselHeight = (viewportHeight * 0.28).clamp(200.0, 245.0);

    return Scaffold(
      appBar: const AppHeader(
        title: 'Accueil',
        subtitle: 'Lectures & Progression',
      ),
      body: CustomScrollView(
        slivers: [
          // Stat cards
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
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
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
            sliver: SliverToBoxAdapter(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
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
                        style: TextStyle(
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
                              padding: const EdgeInsets.symmetric(vertical: 4),
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
                                onPause: () async {
                                  await ref
                                      .read(booksControllerProvider.notifier)
                                      .updateBookStatus(book, BookStatus.paused);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('« ${book.title} » mis en pause'),
                                        backgroundColor: AppTheme.accentPrimary,
                                        behavior: SnackBarBehavior.floating,
                                      ),
                                    );
                                  }
                                },
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
          ),
          // Bouton horizontal vers la liste des lectures en pause
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
            sliver: SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const PausedBooksPage(),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppTheme.bgElevated,
                              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            ),
                            child: Center(
                              child: Icon(
                                Icons.pause_circle_outline_rounded,
                                color: AppTheme.textSecondary,
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Lectures en pause',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  pausedBooks.isEmpty
                                      ? 'Aucune lecture en pause'
                                      : '${pausedBooks.length} livre${pausedBooks.length > 1 ? 's' : ''} en pause',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.textMuted,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (pausedBooks.isNotEmpty) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.bgElevated,
                                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                border: Border.all(
                                  color: AppTheme.borderSubtle,
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                '${pausedBooks.length}',
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Icon(
                            Icons.chevron_right_rounded,
                            color: AppTheme.textMuted,
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Bouton horizontal vers le Calendrier de lectures
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            sliver: SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ReadingCalendarPage(),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppTheme.accentPrimaryLight,
                              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            ),
                            child: Center(
                              child: Icon(
                                Icons.calendar_month_rounded,
                                color: AppTheme.accentPrimary,
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Calendrier de lectures',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Consulter l\'historique et les sessions par jour',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.textMuted,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: AppTheme.textMuted,
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Section Série de lecture (flammes de la semaine courante)
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 0),
            sliver: SliverToBoxAdapter(
              child: ReadingStreakCard(),
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
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
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
    return SizedBox(
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
                child: Center(
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
                  style: TextStyle(
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
            style: TextStyle(
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
