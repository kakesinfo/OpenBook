import 'dart:async';

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
  bool _isPaused = false;
  bool _markedSeen = false;
  bool _timerStarted = false;

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
        _onDataReady();
      });
    }
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  void _onDataReady() {
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
  }

  void _nextSlide() {
    if (!mounted) return;
    if (_currentIndex < _totalSlides - 1) {
      setState(() {
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
      backgroundColor: const Color(0xFF090D16),
      body: asyncData.when(
        loading: () => _buildLoadingState(),
        error: (error, _) => _buildErrorState(error.toString()),
        data: (retro) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _onDataReady();
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
        duration: const Duration(milliseconds: 350),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: currentSlide.gradientColors,
          ),
        ),
        child: SafeArea(
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
                                    ? const ColoredBox(color: Colors.white24)
                                    : AnimatedBuilder(
                                        animation: _progressController,
                                        builder: (context, _) {
                                          return LinearProgressIndicator(
                                            value: _progressController.value,
                                            backgroundColor: Colors.white24,
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
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.auto_awesome_rounded,
                            color: Colors.white,
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
                    const SizedBox(width: 8),
                    Text(
                      '${_currentIndex + 1}/$_totalSlides',
                      style: const TextStyle(
                        color: Colors.white70,
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

              // Slide content
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 260),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  child: KeyedSubtree(
                    key: ValueKey(_currentIndex),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 16,
                      ),
                      child: currentSlide.builder(context),
                    ),
                  ),
                ),
              ),

              // Bottom hint
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(
                  _currentIndex == _totalSlides - 1
                      ? 'Appuie à droite pour terminer'
                      : 'Appuie pour continuer · Maintiens pour mettre en pause',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<_StorySlide> _buildSlides(YearlyRetrospective retro) {
    return [
      // 1. Nombre de livres lus sur l'année
      _StorySlide(
        gradientColors: const [Color(0xFF064E3B), Color(0xFF0F172A)],
        builder: (_) => _MetricSlide(
          badge: 'BILAN DE LECTURE',
          icon: Icons.menu_book_rounded,
          accentColor: const Color(0xFF34D399),
          title: 'Nombre de livres lus',
          bigValue: '${retro.booksReadCount}',
          unit: retro.booksReadCount > 1 ? 'livres terminés' : 'livre terminé',
          subtitle: retro.booksReadCount > 0
              ? 'Autant d\'histoires découvertes tout au long de ${retro.year}.'
              : 'Aucun livre terminé enregistré en ${retro.year}.',
        ),
      ),

      // 2. Nombre de pages lues dans l'année
      _StorySlide(
        gradientColors: const [Color(0xFF1E3A8A), Color(0xFF0F172A)],
        builder: (_) => _MetricSlide(
          badge: 'ENDURANCE',
          icon: Icons.auto_stories_rounded,
          accentColor: const Color(0xFF60A5FA),
          title: 'Pages tournées',
          bigValue: _formatInt(retro.pagesReadCount),
          unit: retro.pagesReadCount > 1 ? 'pages lues' : 'page lue',
          subtitle: retro.pagesReadCount > 0
              ? 'Chaque page compte dans ton voyage littéraire de ${retro.year}.'
              : 'Aucune page enregistrée sur tes sessions de ${retro.year}.',
        ),
      ),

      // 3. Le plus gros livre de l'année
      _StorySlide(
        gradientColors: const [Color(0xFF312E81), Color(0xFF090D16)],
        builder: (_) => _BookHighlightSlide(
          badge: 'LE PAVÉ DE L\'ANNÉE',
          icon: Icons.layers_rounded,
          accentColor: const Color(0xFFA78BFA),
          title: 'Le plus gros livre',
          book: retro.thickestBook,
          highlightValue: retro.thickestBook?.pageCount != null
              ? '${_formatInt(retro.thickestBook!.pageCount!)} pages'
              : null,
          emptyMessage: 'Aucun livre avec nombre de pages renseigné en ${retro.year}.',
        ),
      ),

      // 4. Temps passé à lire
      _StorySlide(
        gradientColors: const [Color(0xFF7C2D12), Color(0xFF111827)],
        builder: (_) => _MetricSlide(
          badge: 'CHRONO LECTURE',
          icon: Icons.schedule_rounded,
          accentColor: const Color(0xFFFBBF24),
          title: 'Temps passé à lire',
          bigValue: _formatDurationCompact(retro.totalReadingSeconds),
          unit: 'au total en ${retro.year}',
          subtitle: retro.totalReadingSeconds > 0
              ? 'Soit environ ${(retro.totalReadingSeconds / 3600).toStringAsFixed(1)} heures plongé dans tes livres.'
              : 'Aucune session chronométrée enregistrée en ${retro.year}.',
        ),
      ),

      // 5. Livre lu le plus longtemps
      _StorySlide(
        gradientColors: const [Color(0xFF581C87), Color(0xFF0F172A)],
        builder: (_) => _BookHighlightSlide(
          badge: 'COMPAGNON AU LONG COURS',
          icon: Icons.hourglass_bottom_rounded,
          accentColor: const Color(0xFFE879F9),
          title: 'Livre lu le plus longtemps',
          book: retro.longestReadBook,
          highlightValue: retro.longestReadBook?.readingSeconds != null
              ? _formatDurationCompact(retro.longestReadBook!.readingSeconds!)
              : null,
          secondaryText: retro.longestReadBook?.sessionsCount != null
              ? '${retro.longestReadBook!.sessionsCount} session${retro.longestReadBook!.sessionsCount! > 1 ? 's' : ''} de lecture'
              : null,
          emptyMessage: 'Aucune session de lecture enregistrée en ${retro.year}.',
        ),
      ),

      // 6. Le mois avec le plus de livres
      _StorySlide(
        gradientColors: const [Color(0xFF0F766E), Color(0xFF090D16)],
        builder: (_) => _MetricSlide(
          badge: 'PIC DE LECTURE',
          icon: Icons.calendar_month_rounded,
          accentColor: const Color(0xFF2DD4BF),
          title: 'Le mois le plus productif',
          bigValue: retro.bestMonth?.monthName ?? '—',
          unit: retro.bestMonth != null
              ? '${retro.bestMonth!.booksCount} livre${retro.bestMonth!.booksCount > 1 ? 's' : ''} lu${retro.bestMonth!.booksCount > 1 ? 's' : ''}'
              : 'Aucune donnée',
          subtitle: retro.bestMonth != null
              ? 'C\'est en ${retro.bestMonth!.monthName.toLowerCase()} que tu as dévoré le plus de livres.'
              : 'Termine des livres pour découvrir ton mois record.',
        ),
      ),

      // 7. Catégorie de livre la plus lue
      _StorySlide(
        gradientColors: const [Color(0xFF831843), Color(0xFF0F172A)],
        builder: (_) => _TopStatSlide(
          badge: 'GENRE PRÉFÉRÉ',
          icon: Icons.category_rounded,
          accentColor: const Color(0xFFF472B6),
          title: 'Catégorie la plus lue',
          stat: retro.topCategory,
          emptyMessage: 'Aucune catégorie identifiée pour ${retro.year}.',
        ),
      ),

      // 8. L'auteur le plus lu
      _StorySlide(
        gradientColors: const [Color(0xFF1E293B), Color(0xFF020617)],
        builder: (_) => _TopStatSlide(
          badge: 'PLUME FAVORITE',
          icon: Icons.person_rounded,
          accentColor: const Color(0xFF38BDF8),
          title: 'Auteur le plus lu',
          stat: retro.topAuthor,
          emptyMessage: 'Aucun auteur identifié pour ${retro.year}.',
        ),
      ),

      // 9. L'éditeur le plus lu
      _StorySlide(
        gradientColors: const [Color(0xFF14532D), Color(0xFF090D16)],
        builder: (_) => _TopStatSlide(
          badge: 'MAISON D\'ÉDITION',
          icon: Icons.apartment_rounded,
          accentColor: const Color(0xFF4ADE80),
          title: 'Éditeur le plus lu',
          stat: retro.topPublisher,
          emptyMessage: 'Aucun éditeur renseigné pour ${retro.year}.',
        ),
      ),

      // 10. Le prix total des livres achetés
      _StorySlide(
        gradientColors: const [Color(0xFF78350F), Color(0xFF0F172A)],
        builder: (_) => _MetricSlide(
          badge: 'BUDGET BIBLIOTHÈQUE',
          icon: Icons.shopping_bag_rounded,
          accentColor: const Color(0xFFFBBF24),
          title: 'Prix total des livres achetés',
          bigValue: _formatPrice(retro.totalSpentAmount),
          unit:
              'pour ${retro.boughtBooksCount} achat${retro.boughtBooksCount > 1 ? 's' : ''} en ${retro.year}',
          subtitle: retro.boughtBooksCount > 0
              ? 'Investissement dans ta collection personnelle.'
              : 'Aucun achat enregistré en ${retro.year}.',
        ),
      ),

      // 11. Le livre le plus cher
      _StorySlide(
        gradientColors: const [Color(0xFF7F1D1D), Color(0xFF090D16)],
        builder: (_) => _BookHighlightSlide(
          badge: 'BELLE PIÈCE',
          icon: Icons.workspace_premium_rounded,
          accentColor: const Color(0xFFFCA5A5),
          title: 'Le livre le plus cher',
          book: retro.mostExpensiveBook,
          highlightValue: retro.mostExpensiveBook?.price != null
              ? _formatPrice(retro.mostExpensiveBook!.price!)
              : null,
          emptyMessage: 'Aucun achat avec prix renseigné en ${retro.year}.',
        ),
      ),

      // 12. Le livre le plus rapide en moyenne
      _StorySlide(
        gradientColors: const [Color(0xFF065F46), Color(0xFF0F172A)],
        builder: (_) => _BookHighlightSlide(
          badge: 'VITESSE ÉCLAIR',
          icon: Icons.bolt_rounded,
          accentColor: const Color(0xFF34D399),
          title: 'Le livre le plus rapide',
          book: retro.fastestBook,
          highlightValue: retro.fastestBook?.pagesPerHour != null
              ? '${retro.fastestBook!.pagesPerHour!.toStringAsFixed(1)} pages/h'
              : null,
          secondaryText: _formatSpeedSubtitle(retro.fastestBook),
          emptyMessage: 'Pas assez de sessions chronométrées avec pages pour calculer la vitesse.',
        ),
      ),

      // 13. Le livre le plus lent en moyenne
      _StorySlide(
        gradientColors: const [Color(0xFF3730A3), Color(0xFF090D16)],
        builder: (_) => _BookHighlightSlide(
          badge: 'LECTURE SAVOURÉE',
          icon: Icons.spa_rounded,
          accentColor: const Color(0xFF818CF8),
          title: 'Le livre le plus lent',
          book: retro.slowestBook,
          highlightValue: retro.slowestBook?.pagesPerHour != null
              ? '${retro.slowestBook!.pagesPerHour!.toStringAsFixed(1)} pages/h'
              : null,
          secondaryText: _formatSpeedSubtitle(retro.slowestBook),
          emptyMessage: 'Pas assez de sessions chronométrées avec pages pour calculer la vitesse.',
        ),
      ),

      // 14. Plus longue série de lecture dans l'année
      _StorySlide(
        gradientColors: const [Color(0xFF9A3412), Color(0xFF0F172A)],
        builder: (_) => _MetricSlide(
          badge: 'RÉGULARITÉ',
          icon: Icons.local_fire_department_rounded,
          accentColor: const Color(0xFFFB923C),
          title: 'Plus longue série de lecture',
          bigValue: '${retro.longestStreakDays}',
          unit: retro.longestStreakDays > 1 ? 'jours consécutifs' : 'jour consécutif',
          subtitle: (retro.longestStreakStart != null &&
                  retro.longestStreakEnd != null)
              ? 'Du ${_formatIsoDateFr(retro.longestStreakStart!)} au ${_formatIsoDateFr(retro.longestStreakEnd!)}'
              : 'Aucune série enregistrée en ${retro.year}.',
        ),
      ),

      // 15. Nombre de jours de lecture dans l'année
      _StorySlide(
        gradientColors: const [Color(0xFF0C4A6E), Color(0xFF090D16)],
        builder: (_) => _MetricSlide(
          badge: 'ASSIDUITÉ',
          icon: Icons.today_rounded,
          accentColor: const Color(0xFF38BDF8),
          title: 'Jours de lecture en ${retro.year}',
          bigValue: '${retro.readingDaysCount}',
          unit: retro.readingDaysCount > 1 ? 'jours avec lecture' : 'jour avec lecture',
          subtitle: retro.readingDaysCount > 0
              ? 'Soit ${((retro.readingDaysCount / 365) * 100).clamp(0, 100).toStringAsFixed(0)}% de l\'année passée avec un livre.'
              : 'Aucun jour de lecture enregistré en ${retro.year}.',
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

  static String _formatIsoDateFr(String iso) {
    final parts = iso.split('-');
    if (parts.length != 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}

class _StorySlide {
  const _StorySlide({
    required this.gradientColors,
    required this.builder,
  });

  final List<Color> gradientColors;
  final WidgetBuilder builder;
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
        border: Border.all(color: accentColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: accentColor, size: 16),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: accentColor,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricSlide extends StatelessWidget {
  const _MetricSlide({
    required this.badge,
    required this.icon,
    required this.accentColor,
    required this.title,
    required this.bigValue,
    required this.unit,
    required this.subtitle,
  });

  final String badge;
  final IconData icon;
  final Color accentColor;
  final String title;
  final String bigValue;
  final String unit;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _SlideBadge(label: badge, icon: icon, accentColor: accentColor),
        const SizedBox(height: 24),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 28),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Column(
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  bigValue,
                  style: TextStyle(
                    color: accentColor,
                    fontSize: 54,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                unit,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
            height: 1.45,
          ),
        ),
      ],
    );
  }
}

class _BookHighlightSlide extends StatelessWidget {
  const _BookHighlightSlide({
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
        _SlideBadge(label: badge, icon: icon, accentColor: accentColor),
        const SizedBox(height: 20),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 24),
        if (currentBook == null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            ),
            child: Text(
              emptyMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 15,
                height: 1.45,
              ),
            ),
          )
        else ...[
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.3),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: BookCover(
              book: Book(
                id: currentBook.id,
                title: currentBook.title,
                author: currentBook.author,
                coverUrl: currentBook.coverUrl,
                status: BookStatus.read,
              ),
              width: 140,
              height: 205,
              borderRadius: 14,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            currentBook.title,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
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
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: accentColor.withValues(alpha: 0.45)),
              ),
              child: Text(
                highlightValue!,
                style: TextStyle(
                  color: accentColor,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
          if (secondaryText != null) ...[
            const SizedBox(height: 10),
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
      ],
    );
  }
}

class _TopStatSlide extends StatelessWidget {
  const _TopStatSlide({
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
        _SlideBadge(label: badge, icon: icon, accentColor: accentColor),
        const SizedBox(height: 24),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 28),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
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
                    Text(
                      current.name,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: accentColor,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${current.count} livre${current.count > 1 ? 's' : ''} (${current.percentage.toStringAsFixed(0)}%)',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}
