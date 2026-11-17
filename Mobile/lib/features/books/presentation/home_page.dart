import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'abandoned_books_page.dart';
import 'book_details_page.dart';
import 'book_reading_session_page.dart';
import 'components/app_header.dart';
import 'components/book_card.dart';
import 'components/reading_streak_card.dart';
import 'components/reading_timer_modal.dart';
import 'components/retrospective_stories_section.dart';
import 'glossary_page.dart';
import 'notes_page.dart';
import 'paused_books_page.dart';
import 'reading_calendar_page.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  static bool _hasPlayedInitialEntrance = false;
  late final bool _animateOnEntry;
  int _currentCarouselIndex = 0;

  @override
  void initState() {
    super.initState();
    _animateOnEntry = !_hasPlayedInitialEntrance;
    if (_animateOnEntry) {
      _hasPlayedInitialEntrance = true;
    }
  }

  Future<void> _refreshAll(WidgetRef ref) async {
    ref.invalidate(allReadingSessionsProvider);
    ref.invalidate(retrospectiveYearsProvider);
    await Future.wait([
      ref.read(booksControllerProvider.notifier).reload(),
      ref.read(notesControllerProvider.notifier).reload(),
      ref.read(wordsControllerProvider.notifier).reload(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(booksControllerProvider);
    final readingBooks = ref.watch(readingBooksProvider);
    final pausedBooks = ref.watch(pausedBooksProvider);
    final abandonedBooks = ref.watch(abandonedBooksProvider);
    final wishlistBooks = ref.watch(wishlistBooksProvider);
    final notesAsync = ref.watch(notesControllerProvider);
    final wordsAsync = ref.watch(wordsControllerProvider);

    final notes = notesAsync.value ?? const [];
    final words = wordsAsync.value ?? const [];
    final retroYears = ref.watch(retrospectiveYearsProvider).value ?? const <int>[];

    final viewportHeight = MediaQuery.of(context).size.height;
    final carouselHeight = (viewportHeight * 0.32).clamp(240.0, 280.0);
    final activeCarouselIndex = readingBooks.isEmpty
        ? 0
        : _currentCarouselIndex.clamp(0, readingBooks.length - 1);

    return Scaffold(
      appBar: const AppHeader(
        title: 'Accueil',
        subtitle: 'Lectures, Carnet & Progression',
      ),
      body: RefreshIndicator(
        color: AppTheme.accentPrimary,
        onRefresh: () => _refreshAll(ref),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // 1. Stat cards strip
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 0,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: booksAsync.when(
                      loading: () => const _LoadingHero(),
                      error: (error, _) => _EmptyHero(
                        title: 'Impossible de charger les données',
                        subtitle: error.toString(),
                      ),
                      data: (books) {
                        final totalBooks = books.where((book) => book.isOwned).length;
                        final unreadBooks =
                            books.where((book) => book.isOwned && book.isUnread).length;

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
              ),
            ),

            // 2. Lectures en cours Section Header
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 10),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 70,
                  child: _SectionHeader(
                    title: 'Lectures en cours',
                    badgeText: readingBooks.isNotEmpty ? '${readingBooks.length}' : null,
                  ),
                ),
              ),
            ),

            // Lectures en cours Carousel
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 110,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: booksAsync.isLoading && readingBooks.isEmpty
                        ? const _LoadingHero()
                        : readingBooks.isEmpty
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
                          onPageChanged: (index, reason) {
                            if (_currentCarouselIndex != index) {
                              setState(() {
                                _currentCarouselIndex = index;
                              });
                            }
                          },
                        ),
                        items: readingBooks.asMap().entries.map((entry) {
                          final index = entry.key;
                          final book = entry.value;
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: BookCard(
                              key: ValueKey(book.id ?? book.title),
                              book: book,
                              isActive: index == activeCarouselIndex,
                              onEdit: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => BookDetailsPage(book: book),
                                ),
                              ),
                              onRecordSession: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      BookReadingSessionPage(book: book),
                                ),
                              ),
                              onTimer: () => ReadingTimerModal.show(context, book),
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
                          );
                        }).toList(),
                      ),
                  ),
                ),
              ),
            ),

            // 3. Carnet & Références (Notes & Glossaire Bento Grid)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 10),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 160,
                  child: const _SectionHeader(
                    title: 'Carnet & Lexique',
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 190,
                  child: Row(
                  children: [
                    Expanded(
                      child: _FeatureBentoCard(
                        title: 'Notes',
                        subtitle: notes.isEmpty
                            ? 'Fiches de lecture'
                            : '${notes.length} fiche${notes.length > 1 ? 's' : ''} de lecture',
                        caption: notes.isNotEmpty && notes.first.book != null
                            ? 'Récent : ${notes.first.book!.title}'
                            : 'Une note par livre',
                        count: notes.length,
                        icon: Icons.sticky_note_2_rounded,
                        accentColor: AppTheme.accentPrimary,
                        lightBg: AppTheme.accentPrimaryLight,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const NotesPage(),
                          ),
                        ),
                        onQuickAdd: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const NotesPage(initialCreate: true),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _FeatureBentoCard(
                        title: 'Glossaire',
                        subtitle: words.isEmpty
                            ? 'Mots & définitions'
                            : '${words.length} terme${words.length > 1 ? 's' : ''} défini${words.length > 1 ? 's' : ''}',
                        caption: words.isNotEmpty
                            ? 'Ex : ${words.first.word}'
                            : 'Lié à vos lectures',
                        count: words.length,
                        icon: Icons.spellcheck_rounded,
                        accentColor: AppTheme.accentSecondary,
                        lightBg: AppTheme.accentSecondaryLight,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const GlossaryPage(),
                          ),
                        ),
                        onQuickAdd: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const GlossaryPage(initialCreate: true),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                ),
              ),
            ),

            // 4. Rythme & Suivi (Série de lecture + Accès rapide Calendrier / Listes)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 10),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 240,
                  child: const _SectionHeader(
                    title: 'Activité & Suivi',
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverToBoxAdapter(
                child: _HomeSectionReveal(
                  animate: _animateOnEntry,
                  delayMs: 270,
                  child: const ReadingStreakCard(),
                ),
              ),
            ),

            // Calendrier de lectures compact banner
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              sliver: SliverToBoxAdapter(
                child: _QuickNavRowTile(
                  title: 'Calendrier de lectures',
                  subtitle: 'Historique complet et sessions jour par jour',
                  icon: Icons.calendar_month_rounded,
                  accentColor: AppTheme.accentPrimary,
                  lightBg: AppTheme.accentPrimaryLight,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ReadingCalendarPage(mode: ReadingCalendarMode.covers),
                    ),
                  ),
                ),
              ),
            ),

            // 5. En pause & Abandonnées (2-column compact Bento row)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  children: [
                    Expanded(
                      child: _CompactStatusTile(
                        title: 'En pause',
                        subtitle: pausedBooks.isEmpty
                            ? 'Aucun livre'
                            : '${pausedBooks.length} livre${pausedBooks.length > 1 ? 's' : ''}',
                        count: pausedBooks.length,
                        icon: Icons.pause_circle_outline_rounded,
                        accentColor: AppTheme.textSecondary,
                        lightBg: AppTheme.bgElevated,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const PausedBooksPage(),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _CompactStatusTile(
                        title: 'Abandonnées',
                        subtitle: abandonedBooks.isEmpty
                            ? 'Aucun livre'
                            : '${abandonedBooks.length} livre${abandonedBooks.length > 1 ? 's' : ''}',
                        count: abandonedBooks.length,
                        icon: Icons.do_not_disturb_on_outlined,
                        accentColor: AppTheme.accentRed,
                        lightBg: AppTheme.accentRedLight,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const AbandonedBooksPage(),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 6. Rétrospective (Stories par année)
            if (retroYears.isNotEmpty) ...[
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(18, 22, 18, 10),
                sliver: SliverToBoxAdapter(
                  child: _SectionHeader(
                    title: 'Rétrospective',
                  ),
                ),
              ),
              const SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(
                  child: RetrospectiveStoriesSection(),
                ),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }
}

class _HomeSectionReveal extends StatelessWidget {
  const _HomeSectionReveal({
    required this.animate,
    required this.delayMs,
    required this.child,
  });

  final bool animate;
  final int delayMs;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!animate) return child;
    final totalMs = 380 + delayMs;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: totalMs),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        final start = delayMs / totalMs;
        final t = ((value - start) / (1.0 - start)).clamp(0.0, 1.0);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1.0 - t) * 14),
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.badgeText,
  });

  final String title;
  final String? badgeText;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: AppTheme.textPrimary,
            letterSpacing: -0.01,
          ),
        ),
        if (badgeText != null)
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
              badgeText!,
              style: TextStyle(
                color: AppTheme.accentPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}

class _FeatureBentoCard extends StatelessWidget {
  const _FeatureBentoCard({
    required this.title,
    required this.subtitle,
    required this.caption,
    required this.count,
    required this.icon,
    required this.accentColor,
    required this.lightBg,
    required this.onTap,
    required this.onQuickAdd,
  });

  final String title;
  final String subtitle;
  final String caption;
  final int count;
  final IconData icon;
  final Color accentColor;
  final Color lightBg;
  final VoidCallback onTap;
  final VoidCallback onQuickAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: lightBg,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        border: Border.all(
                          color: accentColor.withValues(alpha: 0.28),
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: Icon(icon, color: accentColor, size: 20),
                      ),
                    ),
                    Material(
                      color: AppTheme.bgElevated,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        onTap: onQuickAdd,
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            border: Border.all(color: AppTheme.borderSubtle),
                          ),
                          child: Icon(
                            Icons.add_rounded,
                            size: 17,
                            color: accentColor,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.textPrimary,
                          letterSpacing: -0.01,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (count > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: lightBg,
                          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                        ),
                        child: Text(
                          '$count',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: accentColor,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  caption,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppTheme.textMuted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickNavRowTile extends StatelessWidget {
  const _QuickNavRowTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    required this.lightBg,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final Color lightBg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: lightBg,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Center(
                    child: Icon(icon, color: accentColor, size: 18),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppTheme.textMuted,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
    );
  }
}

class _CompactStatusTile extends StatelessWidget {
  const _CompactStatusTile({
    required this.title,
    required this.subtitle,
    required this.count,
    required this.icon,
    required this.accentColor,
    required this.lightBg,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final int count;
  final IconData icon;
  final Color accentColor;
  final Color lightBg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: lightBg,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Center(
                    child: Icon(icon, color: accentColor, size: 18),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.textMuted,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: AppTheme.textMuted,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
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
