import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/books_providers.dart';
import '../../data/book.dart';
import 'book_cover.dart';
import 'common_reading_ribbon.dart';

class BookCard extends ConsumerStatefulWidget {
  const BookCard({
    super.key,
    required this.book,
    required this.onEdit,
    this.isActive = true,
    this.onRecordSession,
    this.onTimer,
    this.onPause,
  });

  final Book book;
  final VoidCallback onEdit;
  final bool isActive;
  final VoidCallback? onRecordSession;
  final VoidCallback? onTimer;
  final VoidCallback? onPause;

  @override
  ConsumerState<BookCard> createState() => _BookCardState();
}

class _BookCardState extends ConsumerState<BookCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _progressAnimation;
  late final Animation<double> _timerPopAnimation;
  late final Animation<double> _logPopAnimation;

  static Animatable<double> _popBounceTween() => TweenSequence<double>([
        TweenSequenceItem(
          tween: Tween(begin: 0.0, end: 1.22)
              .chain(CurveTween(curve: Curves.easeOut)),
          weight: 50,
        ),
        TweenSequenceItem(
          tween: Tween(begin: 1.22, end: 0.92)
              .chain(CurveTween(curve: Curves.easeInOut)),
          weight: 25,
        ),
        TweenSequenceItem(
          tween: Tween(begin: 0.92, end: 1.0)
              .chain(CurveTween(curve: Curves.easeOut)),
          weight: 25,
        ),
      ]);

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _progressAnimation = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.0, 1.0, curve: Curves.easeOutCubic),
    );
    _timerPopAnimation = _popBounceTween().animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.08, 0.58),
      ),
    );
    _logPopAnimation = _popBounceTween().animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.16, 0.68),
      ),
    );

    if (widget.isActive) {
      _animController.forward(from: 0.0);
    }
  }

  @override
  void didUpdateWidget(covariant BookCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((widget.isActive && !oldWidget.isActive) ||
        (widget.book.id != oldWidget.book.id && widget.isActive)) {
      _animController.forward(from: 0.0);
    } else if (!widget.isActive && oldWidget.isActive) {
      _animController.reset();
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final book = widget.book;
    ref.listen<AsyncValue<ReadingProgress>>(
      readingProgressByBookProvider(book),
      (prev, next) {
        if (widget.isActive &&
            (prev == null || prev.isLoading) &&
            next.hasValue) {
          _animController.forward(from: 0.0);
        }
      },
    );

    final progressAsync = ref.watch(readingProgressByBookProvider(book));
    final progress =
        progressAsync.value ?? ReadingProgress.empty(totalPages: book.totalPages);
    final totalPages = progress.totalPages ?? 0;
    final currentPage = progress.currentPage;
    final startedAt = progress.startedAt ?? book.startedAt;

    final daysReading = startedAt == null
        ? 0
        : DateTime.now()
                .difference(
                  DateTime(startedAt.year, startedAt.month, startedAt.day),
                )
                .inDays +
            1;

    final remainingTime =
        (progress.totalSecondsRead > 0 && totalPages > currentPage && currentPage > 0)
            ? ((totalPages - currentPage) * (progress.totalSecondsRead / currentPage))
                .round()
            : null;

    final seriesText = book.series.isEmpty
        ? 'Hors série'
        : (book.volume == null ? book.series : '${book.series} • Tome ${book.volume}');

    final targetProgress =
        totalPages <= 0 ? 0.0 : progress.progress.clamp(0.0, 1.0);

    return AnimatedBuilder(
      animation: _animController,
      builder: (context, _) {
        final animatedProgress = targetProgress * _progressAnimation.value;
        final animatedPage = (currentPage * _progressAnimation.value).round();

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Icon(
                          Icons.timer_outlined,
                          size: 16,
                          color: AppTheme.accentPrimary,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            daysReading <= 0 ? 'Début non défini' : 'Jour $daysReading',
                            style: TextStyle(
                              fontSize: 15,
                              color: AppTheme.accentPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.accentPrimaryLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      border: Border.all(
                        color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                        width: 1,
                      ),
                    ),
                    child: Text(
                      totalPages <= 0
                          ? 'p. $animatedPage'
                          : 'p. $animatedPage / $totalPages',
                      style: TextStyle(
                        color: AppTheme.accentPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Container(
                width: double.infinity,
                height: 172,
                decoration: BoxDecoration(
                  gradient: AppTheme.cardGradient,
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: widget.onEdit,
                    borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        // Top Progress Bar
                        Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(AppTheme.radiusLg),
                            ),
                            child: LinearProgressIndicator(
                              value: animatedProgress,
                              minHeight: 8,
                              backgroundColor: AppTheme.borderSubtle,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                AppTheme.accentPrimary,
                              ),
                            ),
                          ),
                        ),
                        // Content Info
                        Padding(
                          padding: const EdgeInsets.fromLTRB(122, 22, 72, 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                book.title,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.textPrimary,
                                  letterSpacing: -0.01,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                seriesText,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Icon(
                                    Icons.access_time_rounded,
                                    size: 13,
                                    color: AppTheme.textMuted,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      remainingTime == null
                                          ? 'Temps restant indéfini'
                                          : '${Duration(seconds: remainingTime).inHours}h ${Duration(seconds: remainingTime).inMinutes.remainder(60)}m restants',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: AppTheme.textMuted,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        // Overlapping Book Cover
                        Positioned(
                          left: 14,
                          bottom: -12,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              BookCover(
                                book: book,
                                width: 92,
                                height: 140,
                                borderRadius: AppTheme.radiusMd,
                              ),
                              if (progress.isCommon)
                                const Positioned(
                                  top: 6,
                                  left: 6,
                                  child: CommonReadingRibbon(size: 22),
                                ),
                            ],
                          ),
                        ),
                        // Quick Action Buttons (timer + log session)
                        if (widget.onRecordSession != null || widget.onTimer != null)
                          Positioned(
                            right: 14,
                            bottom: -10,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (widget.onTimer != null) ...[
                                  Transform.scale(
                                    scale: _timerPopAnimation.value,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: AppTheme.bgElevated,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: AppTheme.borderMedium,
                                          width: 1.2,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withValues(alpha: 0.35),
                                            blurRadius: 10,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: Material(
                                        color: Colors.transparent,
                                        shape: const CircleBorder(),
                                        child: InkWell(
                                          customBorder: const CircleBorder(),
                                          onTap: widget.onTimer,
                                          child: SizedBox(
                                            width: 44,
                                            height: 44,
                                            child: Icon(
                                              Icons.timer_outlined,
                                              color: AppTheme.accentPrimary,
                                              size: 22,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                if (widget.onRecordSession != null)
                                  Transform.scale(
                                    scale: _logPopAnimation.value,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        gradient: AppTheme.primaryGradient,
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppTheme.accentPrimary.withValues(alpha: 0.35),
                                            blurRadius: 10,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: Material(
                                        color: Colors.transparent,
                                        shape: const CircleBorder(),
                                        child: InkWell(
                                          customBorder: const CircleBorder(),
                                          onTap: widget.onRecordSession,
                                          child: const SizedBox(
                                            width: 44,
                                            height: 44,
                                            child: Icon(
                                              Icons.edit_note_rounded,
                                              color: Colors.white,
                                              size: 22,
                                            ),
                                          ),
                                        ),
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
              ),
            ),
          ],
        );
      },
    );
  }
}
