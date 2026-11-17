import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/retrospective.dart';
import 'components/book_cover.dart';

class RetrospectiveStoryPage extends ConsumerStatefulWidget {
  const RetrospectiveStoryPage({
    super.key,
    required this.year,
    this.initialData,
  });

  final int year;

  /// Optional preloaded data (useful for previews and widget tests).
  final YearlyRetrospective? initialData;

  @override
  ConsumerState<RetrospectiveStoryPage> createState() =>
      _RetrospectiveStoryPageState();
}

class _RetrospectiveStoryPageState extends ConsumerState<RetrospectiveStoryPage>
    with SingleTickerProviderStateMixin {
  static const int _totalSlides = 15;
  static const Duration _slideDuration = Duration(seconds: 6);

  late final AnimationController _progressController;
  int _currentIndex = 0;
  bool _isForward = true;
  bool _isPaused = false;
  bool _markedSeen = false;
  bool _timerStarted = false;
  bool _coversPrefetched = false;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: _slideDuration,
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          _nextSlide();
        }
      });

    if (widget.initialData != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _onDataReady(widget.initialData);
      });
    }
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  void _onDataReady([YearlyRetrospective? retro]) {
    if (!_markedSeen) {
      _markedSeen = true;
      unawaited(
        ref.read(seenRetrospectiveYearsProvider.notifier).markSeen(widget.year),
      );
    }
    if (!_timerStarted) {
      _timerStarted = true;
      _progressController.forward(from: 0.0);
    }
    if (retro != null && !_coversPrefetched) {
      _coversPrefetched = true;
      unawaited(_precacheCoversSequentially(retro));
    }
  }

  Future<void> _precacheCoversSequentially(YearlyRetrospective retro) async {
    final urls = <String>[
      if (retro.thickestBook != null) retro.thickestBook!.coverUrl,
      if (retro.longestReadBook != null) retro.longestReadBook!.coverUrl,
      if (retro.mostExpensiveBook != null) retro.mostExpensiveBook!.coverUrl,
      if (retro.fastestBook != null) retro.fastestBook!.coverUrl,
      if (retro.slowestBook != null) retro.slowestBook!.coverUrl,
    ];

    for (final rawUrl in urls) {
      if (!mounted) return;
      final url = rawUrl.trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          await precacheImage(NetworkImage(url), context);
        } catch (_) {}
      }
    }
  }

  void _nextSlide() {
    if (!mounted) return;
    if (_currentIndex < _totalSlides - 1) {
      setState(() {
        _isForward = true;
        _currentIndex++;
      });
      _progressController.forward(from: 0.0);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  void _previousSlide() {
    if (!mounted) return;
    if (_currentIndex > 0) {
      setState(() {
        _isForward = false;
        _currentIndex--;
      });
      _progressController.forward(from: 0.0);
    } else {
      _progressController.forward(from: 0.0);
    }
  }

  void _pauseStory() {
    if (_isPaused) return;
    setState(() {
      _isPaused = true;
    });
    _progressController.stop();
  }

  void _resumeStory() {
    if (!_isPaused) return;
    setState(() {
      _isPaused = false;
    });
    if (_timerStarted) {
      _progressController.forward();
    }
  }

  void _handleTapUp(TapUpDetails details, double screenWidth) {
    if (_isPaused) {
      _resumeStory();
      return;
    }
    if (details.globalPosition.dx < screenWidth * 0.33) {
      _previousSlide();
    } else {
      _nextSlide();
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = widget.initialData != null
        ? AsyncValue.data(widget.initialData!)
        : ref.watch(retrospectiveByYearProvider(widget.year));

    return Scaffold(
      backgroundColor: const Color(0xFF060911),
      body: asyncData.when(
        loading: () => _buildLoadingState(),
        error: (error, _) => _buildErrorState(error.toString()),
        data: (retro) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _onDataReady(retro);
          });
          return _buildStoryContent(context, retro);
        },
      ),
    );
  }

  Widget _buildLoadingState() {
    return SafeArea(
      child: Stack(
        children: [
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: AppTheme.accentPrimary),
                const SizedBox(height: 16),
                Text(
                  'Préparation de ta rétrospective ${widget.year}...',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            top: 12,
            right: 12,
            child: IconButton(
              icon: const Icon(Icons.close_rounded, color: Colors.white),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(String message) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ),
            const Spacer(),
            const Icon(Icons.auto_stories_rounded, color: Colors.white54, size: 52),
            const SizedBox(height: 16),
            Text(
              'Impossible d\'ouvrir la rétrospective ${widget.year}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message.replaceFirst('Exception: ', ''),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => ref.invalidate(retrospectiveByYearProvider(widget.year)),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Réessayer'),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }

  Widget _buildStoryContent(BuildContext context, YearlyRetrospective retro) {
    final slides = _buildSlides(retro);
    final currentSlide = slides[_currentIndex];
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;

    final orb1Top = (_currentIndex.isEven ? 0.08 : 0.18) * screenHeight;
    final orb1Left = ((_currentIndex % 3) * 0.22 - 0.1) * screenWidth;
    final orb2Bottom = (_currentIndex.isOdd ? 0.10 : 0.20) * screenHeight;
    final orb2Right = (((_currentIndex + 1) % 3) * 0.2 - 0.1) * screenWidth;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapUp: (details) => _handleTapUp(details, screenWidth),
      onLongPressStart: (_) => _pauseStory(),
      onLongPressEnd: (_) => _resumeStory(),
      onHorizontalDragEnd: (details) {
        final velocity = details.primaryVelocity ?? 0;
        if (velocity < -200) {
          _nextSlide();
        } else if (velocity > 200) {
          _previousSlide();
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 550),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: currentSlide.gradientColors,
          ),
        ),
        child: Stack(
          children: [
            // Ambient glow orb 1
            AnimatedPositioned(
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOutCubic,
              top: orb1Top,
              left: orb1Left,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 550),
                width: screenWidth * 0.85,
                height: screenWidth * 0.85,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      currentSlide.accentColor.withValues(alpha: 0.28),
                      currentSlide.accentColor.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),

            // Ambient glow orb 2
            AnimatedPositioned(
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOutCubic,
              bottom: orb2Bottom,
              right: orb2Right,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 550),
                width: screenWidth * 0.75,
                height: screenWidth * 0.75,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      currentSlide.secondaryGlow.withValues(alpha: 0.22),
                      currentSlide.secondaryGlow.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),

            // Foreground SafeArea UI
            SafeArea(
              child: Column(
                children: [
                  // Progress segments
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                    child: Row(
                      children: List.generate(_totalSlides, (index) {
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: SizedBox(
                                height: 3,
                                child: index < _currentIndex
                                    ? const ColoredBox(color: Colors.white)
                                    : index > _currentIndex
                                        ? ColoredBox(
                                            color: Colors.white.withValues(alpha: 0.22),
                                          )
                                        : AnimatedBuilder(
                                            animation: _progressController,
                                            builder: (context, _) {
                                              return LinearProgressIndicator(
                                                value: _progressController.value,
                                                backgroundColor:
                                                    Colors.white.withValues(alpha: 0.22),
                                                valueColor:
                                                    const AlwaysStoppedAnimation<Color>(
                                                  Colors.white,
                                                ),
                                              );
                                            },
                                          ),
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),

                  // Header bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.2),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.auto_awesome_rounded,
                                    color: currentSlide.accentColor,
                                    size: 14,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Rétrospective ${retro.year}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${_currentIndex + 1}/$_totalSlides',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.72),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_isPaused) ...[
                          const SizedBox(width: 8),
                          const Icon(
                            Icons.pause_rounded,
                            color: Colors.white70,
                            size: 16,
                          ),
                        ],
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.of(context).maybePop(),
                          icon: const Icon(
                            Icons.close_rounded,
                            color: Colors.white,
                          ),
                          tooltip: 'Fermer',
                        ),
                      ],
                    ),
                  ),

                  // Direction-aware Slide Content with Entrance/Exit Animations
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 420),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      transitionBuilder: (child, animation) {
                        final isIncoming = child.key == ValueKey(_currentIndex);
                        final beginOffset = isIncoming
                            ? Offset(_isForward ? 0.18 : -0.18, 0.02)
                            : Offset(_isForward ? -0.18 : 0.18, -0.02);

                        final slideAnim = Tween<Offset>(
                          begin: beginOffset,
                          end: Offset.zero,
                        ).animate(animation);

                        final scaleAnim = Tween<double>(
                          begin: isIncoming ? 0.94 : 0.96,
                          end: 1.0,
                        ).animate(animation);

                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: slideAnim,
                            child: ScaleTransition(
                              scale: scaleAnim,
                              child: child,
                            ),
                          ),
                        );
                      },
                      child: KeyedSubtree(
                        key: ValueKey(_currentIndex),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            return SingleChildScrollView(
                              physics: const BouncingScrollPhysics(),
                              child: ConstrainedBox(
                                constraints: BoxConstraints(
                                  minHeight: constraints.maxHeight,
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 22,
                                    vertical: 12,
                                  ),
                                  child: currentSlide.builder(context),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ),

                  // Bottom navigation hint
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.touch_app_rounded,
                          size: 13,
                          color: Colors.white.withValues(alpha: 0.45),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _currentIndex == _totalSlides - 1
                              ? 'Appuie à droite pour terminer'
                              : 'Appuie pour passer · Maintiens pour pause',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.5),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<_StorySlide> _buildSlides(YearlyRetrospective retro) {
    return [
      // 1. Nombre de livres lus sur l'année
      _StorySlide(
        gradientColors: const [Color(0xFF032B22), Color(0xFF090D16)],
        accentColor: const Color(0xFF34D399),
        secondaryGlow: const Color(0xFF0EA5E9),
        builder: (_) => _HeroCountSlide(
          badge: 'BILAN LECTURE',
          icon: Icons.menu_book_rounded,
          accentColor: const Color(0xFF34D399),
          title: 'Livres dévorés',
          targetValue: retro.booksReadCount.toDouble(),
          valueFormatter: (v) => '${v.round()}',
          unit: null,
          insightTitle: retro.booksReadCount > 0
              ? 'Appétit littéraire'
              : 'Mode sieste',
          insightText: retro.booksReadCount > 0
              ? 'Environ ${(retro.booksReadCount / 12).toStringAsFixed(1)} livre(s)/mois. Ton canapé s\'en souvient.'
              : 'Zéro livre fini, mais on parie que ta PAL a grandi.',
        ),
      ),

      // 2. Nombre de pages lues dans l'année
      _StorySlide(
        gradientColors: const [Color(0xFF0F2557), Color(0xFF070B14)],
        accentColor: const Color(0xFF60A5FA),
        secondaryGlow: const Color(0xFF818CF8),
        builder: (_) => _HeroCountSlide(
          badge: 'ENDURANCE',
          icon: Icons.auto_stories_rounded,
          accentColor: const Color(0xFF60A5FA),
          title: 'Pages tournées',
          targetValue: retro.pagesReadCount.toDouble(),
          valueFormatter: (v) => _formatInt(v.round()),
          unit: null,
          insightTitle: 'Muscle du pouce',
          insightText: retro.pagesReadCount > 0
              ? 'À ce rythme, tu mérites une médaille de tournage de pages.'
              : 'Tes doigts ont pris des vacances cette année.',
        ),
      ),

      // 3. Le plus gros livre de l'année
      _StorySlide(
        gradientColors: const [Color(0xFF231942), Color(0xFF090D16)],
        accentColor: const Color(0xFFA78BFA),
        secondaryGlow: const Color(0xFFEC4899),
        builder: (_) => _BookShowcaseSlide(
          badge: 'LE GROS PAVÉ',
          icon: Icons.layers_rounded,
          accentColor: const Color(0xFFA78BFA),
          title: 'Ton plus gros livre',
          book: retro.thickestBook,
          highlightValue: retro.thickestBook?.pageCount != null
              ? '${_formatInt(retro.thickestBook!.pageCount!)} pages'
              : null,
          emptyMessage: 'Pas de pavé repéré cette année (tes poignets te remercient).',
        ),
      ),

      // 4. Temps passé à lire
      _StorySlide(
        gradientColors: const [Color(0xFF3E1F0D), Color(0xFF090D16)],
        accentColor: const Color(0xFFFBBF24),
        secondaryGlow: const Color(0xFFF97316),
        builder: (_) => _HeroCountSlide(
          badge: 'CHRONO',
          icon: Icons.schedule_rounded,
          accentColor: const Color(0xFFFBBF24),
          title: 'Temps passé à lire',
          targetValue: retro.totalReadingSeconds.toDouble(),
          valueFormatter: (v) => _formatDurationCompact(v.round()),
          unit: 'en ${retro.year}',
          insightTitle: 'En mode bulle',
          insightText: retro.totalReadingSeconds > 0
              ? '${(retro.totalReadingSeconds / 3600).toStringAsFixed(1)}h sans scroller. Un exploit rare.'
              : 'Aucun chrono lancé en ${retro.year}, lecture ninja.',
        ),
      ),

      // 5. Livre lu le plus longtemps
      _StorySlide(
        gradientColors: const [Color(0xFF3B0764), Color(0xFF090D16)],
        accentColor: const Color(0xFFE879F9),
        secondaryGlow: const Color(0xFF6366F1),
        builder: (_) => _BookShowcaseSlide(
          badge: 'LONG COURS',
          icon: Icons.hourglass_bottom_rounded,
          accentColor: const Color(0xFFE879F9),
          title: 'Squatteur de table de nuit',
          book: retro.longestReadBook,
          highlightValue: retro.longestReadBook?.readingSeconds != null
              ? _formatDurationCompact(retro.longestReadBook!.readingSeconds!)
              : null,
          secondaryText: retro.longestReadBook?.sessionsCount != null
              ? '${retro.longestReadBook!.sessionsCount} session${retro.longestReadBook!.sessionsCount! > 1 ? 's' : ''} ensemble'
              : null,
          emptyMessage: 'Aucune session enregistrée en ${retro.year}.',
        ),
      ),

      // 6. Le mois avec le plus de livres
      _StorySlide(
        gradientColors: const [Color(0xFF0B3B3C), Color(0xFF070B14)],
        accentColor: const Color(0xFF2DD4BF),
        secondaryGlow: const Color(0xFF34D399),
        builder: (_) => _MonthRecordSlide(
          accentColor: const Color(0xFF2DD4BF),
          bestMonth: retro.bestMonth,
          year: retro.year,
        ),
      ),

      // 7. Catégorie de livre la plus lue
      _StorySlide(
        gradientColors: const [Color(0xFF4C0519), Color(0xFF090D16)],
        accentColor: const Color(0xFFF472B6),
        secondaryGlow: const Color(0xFFFB7185),
        builder: (_) => _SpotlightRankSlide(
          badge: 'OBSESSION',
          icon: Icons.category_rounded,
          accentColor: const Color(0xFFF472B6),
          title: 'Ton genre fétiche',
          stat: retro.topCategory,
          emptyMessage: 'Tu es un lecteur mystérieux, inclassable.',
        ),
      ),

      // 8. L'auteur le plus lu
      _StorySlide(
        gradientColors: const [Color(0xFF0C2340), Color(0xFF060911)],
        accentColor: const Color(0xFF38BDF8),
        secondaryGlow: const Color(0xFF6366F1),
        builder: (_) => _SpotlightRankSlide(
          badge: 'FAN CLUB',
          icon: Icons.person_rounded,
          accentColor: const Color(0xFF38BDF8),
          title: 'Ta plume préférée',
          stat: retro.topAuthor,
          emptyMessage: 'Aucun auteur ne s\'est démarqué cette année.',
        ),
      ),

      // 9. L'éditeur le plus lu
      _StorySlide(
        gradientColors: const [Color(0xFF052E16), Color(0xFF060911)],
        accentColor: const Color(0xFF4ADE80),
        secondaryGlow: const Color(0xFF14B8A6),
        builder: (_) => _SpotlightRankSlide(
          badge: 'FOURNISSEUR OFFICIEL',
          icon: Icons.apartment_rounded,
          accentColor: const Color(0xFF4ADE80),
          title: 'Ton éditeur star',
          stat: retro.topPublisher,
          emptyMessage: 'Aucun éditeur renseigné cette année.',
        ),
      ),

      // 10. Le prix total des livres achetés
      _StorySlide(
        gradientColors: const [Color(0xFF451A03), Color(0xFF090D16)],
        accentColor: const Color(0xFFFBBF24),
        secondaryGlow: const Color(0xFFF59E0B),
        builder: (_) => _HeroCountSlide(
          badge: 'TICKET DE CAISSE',
          icon: Icons.shopping_bag_rounded,
          accentColor: const Color(0xFFFBBF24),
          title: 'Budget bibliothèque',
          targetValue: retro.totalSpentAmount,
          valueFormatter: _formatPrice,
          unit:
              'pour ${retro.boughtBooksCount} achat${retro.boughtBooksCount > 1 ? 's' : ''}',
          insightTitle: retro.boughtBooksCount > 0
              ? 'Aïe le portefeuille'
              : 'Mode économe',
          insightText: retro.boughtBooksCount > 0
              ? '${(retro.totalSpentAmount / retro.boughtBooksCount).toStringAsFixed(2).replaceAll('.', ',')} €/livre en moyenne. C\'est de la culture, ça compte pas.'
              : 'Zéro euro dépensé ! Ton banquier t\'applaudit.',
        ),
      ),

      // 11. Le livre le plus cher
      _StorySlide(
        gradientColors: const [Color(0xFF450A0A), Color(0xFF090D16)],
        accentColor: const Color(0xFFFCA5A5),
        secondaryGlow: const Color(0xFFEF4444),
        builder: (_) => _BookShowcaseSlide(
          badge: 'PIÈCE DE LUXE',
          icon: Icons.workspace_premium_rounded,
          accentColor: const Color(0xFFFCA5A5),
          title: 'Le livre le plus cher',
          book: retro.mostExpensiveBook,
          highlightValue: retro.mostExpensiveBook?.price != null
              ? _formatPrice(retro.mostExpensiveBook!.price!)
              : null,
          emptyMessage: 'Aucun achat avec prix noté (bien caché).',
        ),
      ),

      // 12. Le livre le plus rapide en moyenne
      _StorySlide(
        gradientColors: const [Color(0xFF022C22), Color(0xFF090D16)],
        accentColor: const Color(0xFF34D399),
        secondaryGlow: const Color(0xFF22D3EE),
        builder: (_) => _BookShowcaseSlide(
          badge: 'MODE TGV',
          icon: Icons.bolt_rounded,
          accentColor: const Color(0xFF34D399),
          title: 'Lu à toute vitesse',
          book: retro.fastestBook,
          highlightValue: retro.fastestBook?.pagesPerHour != null
              ? '${retro.fastestBook!.pagesPerHour!.toStringAsFixed(1)} pages/h'
              : null,
          secondaryText: _formatSpeedSubtitle(retro.fastestBook),
          emptyMessage: 'Pas assez de chronos pour mesurer ta vitesse de pointe.',
        ),
      ),

      // 13. Le livre le plus lent en moyenne
      _StorySlide(
        gradientColors: const [Color(0xFF1E1B4B), Color(0xFF090D16)],
        accentColor: const Color(0xFF818CF8),
        secondaryGlow: const Color(0xFF38BDF8),
        builder: (_) => _BookShowcaseSlide(
          badge: 'MODE TORTUE',
          icon: Icons.spa_rounded,
          accentColor: const Color(0xFF818CF8),
          title: 'Savouré page par page',
          book: retro.slowestBook,
          highlightValue: retro.slowestBook?.pagesPerHour != null
              ? '${retro.slowestBook!.pagesPerHour!.toStringAsFixed(1)} pages/h'
              : null,
          secondaryText: _formatSpeedSubtitle(retro.slowestBook),
          emptyMessage: 'Pas assez de chronos pour trouver ta lecture la plus zen.',
        ),
      ),

      // 14. Plus longue série de lecture dans l'année
      _StorySlide(
        gradientColors: const [Color(0xFF431407), Color(0xFF090D16)],
        accentColor: const Color(0xFFFB923C),
        secondaryGlow: const Color(0xFFFACC15),
        builder: (_) => _StreakSlide(
          accentColor: const Color(0xFFFB923C),
          streakDays: retro.longestStreakDays,
          startIso: retro.longestStreakStart,
          endIso: retro.longestStreakEnd,
          year: retro.year,
        ),
      ),

      // 15. Nombre de jours de lecture dans l'année
      _StorySlide(
        gradientColors: const [Color(0xFF082F49), Color(0xFF060911)],
        accentColor: const Color(0xFF38BDF8),
        secondaryGlow: const Color(0xFF34D399),
        builder: (_) => _ReadingDaysRingSlide(
          accentColor: const Color(0xFF38BDF8),
          readingDaysCount: retro.readingDaysCount,
          year: retro.year,
        ),
      ),
    ];
  }

  static String _formatInt(int value) {
    final str = value.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) {
        buffer.write(' ');
      }
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  static String _formatDurationCompact(int totalSeconds) {
    if (totalSeconds <= 0) return '0 min';
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    if (hours > 0) {
      return '${hours}h ${minutes.toString().padLeft(2, '0')}m';
    }
    return '$minutes min';
  }

  static String _formatPrice(double price) {
    return '${price.toStringAsFixed(2).replaceAll('.', ',')} €';
  }

  static String? _formatSpeedSubtitle(RetrospectiveBook? book) {
    if (book == null || book.pagesRead == null || book.readingSeconds == null) {
      return null;
    }
    return '${book.pagesRead} pages en ${_formatDurationCompact(book.readingSeconds!)}';
  }
}

class _StorySlide {
  const _StorySlide({
    required this.gradientColors,
    required this.accentColor,
    required this.secondaryGlow,
    required this.builder,
  });

  final List<Color> gradientColors;
  final Color accentColor;
  final Color secondaryGlow;
  final WidgetBuilder builder;
}

class _StaggeredEntrance extends StatelessWidget {
  const _StaggeredEntrance({
    required this.delayMs,
    required this.child,
    this.offsetY = 22,
  });

  final int delayMs;
  final double offsetY;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 500 + delayMs),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        final start = delayMs / (500 + delayMs);
        final t = ((value - start) / (1.0 - start)).clamp(0.0, 1.0);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1.0 - t) * offsetY),
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({
    required this.child,
    this.padding = const EdgeInsets.all(22),
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(26),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          width: double.infinity,
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(
              color: borderColor ?? Colors.white.withValues(alpha: 0.16),
              width: 1.2,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _SlideBadge extends StatelessWidget {
  const _SlideBadge({
    required this.label,
    required this.icon,
    required this.accentColor,
  });

  final String label;
  final IconData icon;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accentColor.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: accentColor, size: 15),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: accentColor,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroCountSlide extends StatelessWidget {
  const _HeroCountSlide({
    required this.badge,
    required this.icon,
    required this.accentColor,
    required this.title,
    required this.targetValue,
    required this.valueFormatter,
    required this.unit,
    required this.insightTitle,
    required this.insightText,
  });

  final String badge;
  final IconData icon;
  final Color accentColor;
  final String title;
  final double targetValue;
  final String Function(double) valueFormatter;
  final String? unit;
  final String insightTitle;
  final String insightText;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StaggeredEntrance(
          delayMs: 0,
          offsetY: -14,
          child: _SlideBadge(label: badge, icon: icon, accentColor: accentColor),
        ),
        const SizedBox(height: 18),
        _StaggeredEntrance(
          delayMs: 80,
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const SizedBox(height: 28),
        _StaggeredEntrance(
          delayMs: 160,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: targetValue),
            duration: const Duration(milliseconds: 950),
            curve: Curves.easeOutExpo,
            builder: (context, value, _) {
              return Column(
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      valueFormatter(value),
                      style: TextStyle(
                        color: accentColor,
                        fontSize: 66,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -2.0,
                        height: 1.0,
                        shadows: [
                          Shadow(
                            color: accentColor.withValues(alpha: 0.35),
                            blurRadius: 28,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (unit != null && unit!.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      unit!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 36),
        _StaggeredEntrance(
          delayMs: 280,
          child: _GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            borderColor: accentColor.withValues(alpha: 0.28),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: accentColor, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        insightTitle,
                        style: TextStyle(
                          color: accentColor,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        insightText,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _BookShowcaseSlide extends StatelessWidget {
  const _BookShowcaseSlide({
    required this.badge,
    required this.icon,
    required this.accentColor,
    required this.title,
    required this.book,
    required this.highlightValue,
    required this.emptyMessage,
    this.secondaryText,
  });

  final String badge;
  final IconData icon;
  final Color accentColor;
  final String title;
  final RetrospectiveBook? book;
  final String? highlightValue;
  final String? secondaryText;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final currentBook = book;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StaggeredEntrance(
          delayMs: 0,
          offsetY: -14,
          child: _SlideBadge(label: badge, icon: icon, accentColor: accentColor),
        ),
        const SizedBox(height: 14),
        _StaggeredEntrance(
          delayMs: 80,
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 23,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const SizedBox(height: 24),
        if (currentBook == null)
          _StaggeredEntrance(
            delayMs: 160,
            child: _GlassCard(
              child: Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 15,
                  height: 1.45,
                ),
              ),
            ),
          )
        else ...[
          _StaggeredEntrance(
            delayMs: 140,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.92, end: 1.0),
              duration: const Duration(milliseconds: 650),
              curve: Curves.easeOutBack,
              builder: (context, scale, child) {
                return Transform.scale(scale: scale, child: child);
              },
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 150,
                    height: 202,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.42),
                          blurRadius: 42,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),
                  BookCover(
                    book: Book(
                      id: currentBook.id,
                      title: currentBook.title,
                      author: currentBook.author,
                      coverUrl: currentBook.coverUrl,
                      status: BookStatus.read,
                    ),
                    width: 136,
                    height: 196,
                    borderRadius: 16,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          _StaggeredEntrance(
            delayMs: 260,
            child: _GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              borderColor: accentColor.withValues(alpha: 0.3),
              child: Column(
                children: [
                  Text(
                    currentBook.title,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  if (currentBook.author.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      currentBook.author,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                  if (highlightValue != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: accentColor.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Text(
                        highlightValue!,
                        style: TextStyle(
                          color: accentColor,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                  if (secondaryText != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      secondaryText!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _MonthRecordSlide extends StatelessWidget {
  const _MonthRecordSlide({
    required this.accentColor,
    required this.bestMonth,
    required this.year,
  });

  final Color accentColor;
  final RetrospectiveBestMonth? bestMonth;
  final int year;

  @override
  Widget build(BuildContext context) {
    final month = bestMonth;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StaggeredEntrance(
          delayMs: 0,
          offsetY: -14,
          child: _SlideBadge(
            label: 'MOIS RECORD',
            icon: Icons.calendar_month_rounded,
            accentColor: accentColor,
          ),
        ),
        const SizedBox(height: 18),
        const _StaggeredEntrance(
          delayMs: 80,
          child: Text(
            'Ton mois le plus chaud',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const SizedBox(height: 28),
        _StaggeredEntrance(
          delayMs: 180,
          child: _GlassCard(
            padding: EdgeInsets.zero,
            borderColor: accentColor.withValues(alpha: 0.35),
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.22),
                  ),
                  child: Text(
                    '$year',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: accentColor,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 3,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
                  child: Column(
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          month?.monthName ?? '—',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 44,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -1,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          month != null
                              ? '${month.booksCount} livre${month.booksCount > 1 ? 's' : ''} lu${month.booksCount > 1 ? 's' : ''}'
                              : 'Aucune donnée',
                          style: TextStyle(
                            color: accentColor,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 22),
        _StaggeredEntrance(
          delayMs: 280,
          child: Text(
            month != null
                ? 'En ${month.monthName.toLowerCase()}, tu ne t\'es littéralement pas arrêté.'
                : 'Pas encore de mois record cette année.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }
}

class _SpotlightRankSlide extends StatelessWidget {
  const _SpotlightRankSlide({
    required this.badge,
    required this.icon,
    required this.accentColor,
    required this.title,
    required this.stat,
    required this.emptyMessage,
  });

  final String badge;
  final IconData icon;
  final Color accentColor;
  final String title;
  final RetrospectiveTopStat? stat;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final current = stat;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StaggeredEntrance(
          delayMs: 0,
          offsetY: -14,
          child: _SlideBadge(label: badge, icon: icon, accentColor: accentColor),
        ),
        const SizedBox(height: 18),
        _StaggeredEntrance(
          delayMs: 80,
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const SizedBox(height: 28),
        _StaggeredEntrance(
          delayMs: 180,
          child: _GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
            borderColor: accentColor.withValues(alpha: 0.3),
            child: current == null
                ? Text(
                    emptyMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 15,
                    ),
                  )
                : Column(
                    children: [
                      Container(
                        width: 54,
                        height: 54,
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.16),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, color: accentColor, size: 28),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        current.name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${current.count} livre${current.count > 1 ? 's' : ''} · ${current.percentage.toStringAsFixed(0)}% de tes lectures',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: accentColor,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TweenAnimationBuilder<double>(
                        tween: Tween(
                          begin: 0.0,
                          end: (current.percentage / 100.0).clamp(0.0, 1.0),
                        ),
                        duration: const Duration(milliseconds: 900),
                        curve: Curves.easeOutCubic,
                        builder: (context, value, _) {
                          return ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: LinearProgressIndicator(
                              value: value,
                              minHeight: 8,
                              backgroundColor: Colors.white.withValues(alpha: 0.12),
                              valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

class _StreakSlide extends StatelessWidget {
  const _StreakSlide({
    required this.accentColor,
    required this.streakDays,
    required this.startIso,
    required this.endIso,
    required this.year,
  });

  final Color accentColor;
  final int streakDays;
  final String? startIso;
  final String? endIso;
  final int year;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StaggeredEntrance(
          delayMs: 0,
          offsetY: -14,
          child: _SlideBadge(
            label: 'EN FEU',
            icon: Icons.local_fire_department_rounded,
            accentColor: accentColor,
          ),
        ),
        const SizedBox(height: 18),
        const _StaggeredEntrance(
          delayMs: 80,
          child: Text(
            'Ta plus longue série',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const SizedBox(height: 26),
        _StaggeredEntrance(
          delayMs: 160,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: streakDays.toDouble()),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutExpo,
            builder: (context, value, _) {
              return Column(
                children: [
                  Container(
                    width: 68,
                    height: 68,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.35),
                          blurRadius: 24,
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.local_fire_department_rounded,
                      color: accentColor,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    '${value.round()}',
                    style: TextStyle(
                      color: accentColor,
                      fontSize: 64,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -2,
                      height: 1.0,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    streakDays > 1 ? 'jours consécutifs' : 'jour consécutif',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 28),
        _StaggeredEntrance(
          delayMs: 280,
          child: _GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            borderColor: accentColor.withValues(alpha: 0.3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.date_range_rounded, color: accentColor, size: 18),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    (startIso != null && endIso != null)
                        ? 'Du ${_formatIsoDateFr(startIso!)} au ${_formatIsoDateFr(endIso!)} · Impossible de te décrocher !'
                        : 'Pas de série enregistrée en $year.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static String _formatIsoDateFr(String iso) {
    final parts = iso.split('-');
    if (parts.length != 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}

class _ReadingDaysRingSlide extends StatelessWidget {
  const _ReadingDaysRingSlide({
    required this.accentColor,
    required this.readingDaysCount,
    required this.year,
  });

  final Color accentColor;
  final int readingDaysCount;
  final int year;

  @override
  Widget build(BuildContext context) {
    final ratio = (readingDaysCount / 365.0).clamp(0.0, 1.0);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StaggeredEntrance(
          delayMs: 0,
          offsetY: -14,
          child: _SlideBadge(
            label: 'ASSIDUITÉ',
            icon: Icons.today_rounded,
            accentColor: accentColor,
          ),
        ),
        const SizedBox(height: 18),
        _StaggeredEntrance(
          delayMs: 80,
          child: Text(
            'Jours avec un livre en $year',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const SizedBox(height: 30),
        _StaggeredEntrance(
          delayMs: 160,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: ratio),
            duration: const Duration(milliseconds: 1100),
            curve: Curves.easeOutCubic,
            builder: (context, animRatio, _) {
              final animDays = (animRatio * 365).round().clamp(0, readingDaysCount);
              return SizedBox(
                width: 210,
                height: 210,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: const Size(210, 210),
                      painter: _RingPainter(
                        progress: animRatio,
                        accentColor: accentColor,
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$animDays',
                          style: TextStyle(
                            color: accentColor,
                            fontSize: 54,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -1.5,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          readingDaysCount > 1 ? 'jours sur 365' : 'jour sur 365',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 30),
        _StaggeredEntrance(
          delayMs: 280,
          child: _GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            borderColor: accentColor.withValues(alpha: 0.3),
            child: Text(
              readingDaysCount > 0
                  ? '${(ratio * 100).toStringAsFixed(0)}% de l\'année avec un livre. Pas mal du tout !'
                  : 'Aucun jour de lecture enregistré en $year.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({
    required this.progress,
    required this.accentColor,
  });

  final double progress;
  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width / 2) - 12;

    final trackPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    final progressPaint = Paint()
      ..color = accentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, trackPaint);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.accentColor != accentColor;
}
