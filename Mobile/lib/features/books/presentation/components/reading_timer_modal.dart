import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme.dart';
import '../../application/books_providers.dart';
import '../../data/book.dart';
import '../book_reading_session_page.dart';
import 'book_cover.dart';

/// Modal chronomètre de lecture en temps réel.
class ReadingTimerModal extends ConsumerStatefulWidget {
  const ReadingTimerModal({super.key, required this.book});

  final Book book;

  static Future<void> show(BuildContext context, Book book) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      isDismissible: true,
      enableDrag: false,
      builder: (_) => ReadingTimerModal(book: book),
    );
  }

  @override
  ConsumerState<ReadingTimerModal> createState() => _ReadingTimerModalState();
}

class _ReadingTimerModalState extends ConsumerState<ReadingTimerModal> {
  Timer? _ticker;
  int _secondsElapsed = 0;
  bool _isRunning = true;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        _secondsElapsed++;
      });
    });
  }

  void _pauseTimer() {
    _ticker?.cancel();
    _ticker = null;
  }

  void _togglePlayPause() {
    setState(() {
      _isRunning = !_isRunning;
      if (_isRunning) {
        _startTimer();
      } else {
        _pauseTimer();
      }
    });
  }

  void _onFinish() {
    _pauseTimer();
    final elapsedDuration = Duration(seconds: _secondsElapsed);
    final book = widget.book;

    // Ferme la modale du chronomètre
    Navigator.of(context).pop();

    // Ouvre la page d'enregistrement de session avec le temps écoulé pré-rempli
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BookReadingSessionPage(
          book: book,
          initialDuration: elapsedDuration,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _formatTime(int totalSeconds) {
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final progressAsync = ref.watch(readingProgressByBookProvider(widget.book));
    final progress = progressAsync.value ?? ReadingProgress.empty(totalPages: widget.book.totalPages);
    final totalPages = progress.totalPages ?? widget.book.totalPages ?? 0;
    final currentPage = progress.currentPage;
    final progressPct = totalPages > 0 ? (currentPage / totalPages).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(
          color: AppTheme.borderMedium,
          width: 1.5,
        ),
        boxShadow: AppTheme.modalShadow,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header: Barre de tirage + bouton Fermer / Terminé
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 16, 8),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Poignée supérieure discrète
                  Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppTheme.borderMedium,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        color: AppTheme.textMuted,
                        onPressed: () => Navigator.of(context).pop(),
                        tooltip: 'Fermer',
                      ),
                      // Bouton "Terminé" en haut à droite
                      TextButton.icon(
                        style: TextButton.styleFrom(
                          backgroundColor: AppTheme.accentPrimaryLight,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                            side: BorderSide(
                              color: AppTheme.accentPrimary.withValues(alpha: 0.4),
                              width: 1,
                            ),
                          ),
                        ),
                        onPressed: _onFinish,
                        icon: Icon(
                          Icons.check_rounded,
                          size: 18,
                          color: AppTheme.accentPrimary,
                        ),
                        label: Text(
                          'Terminé',
                          style: TextStyle(
                            color: AppTheme.accentPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Compteur chronomètre géant & animé
            Text(
              'SESSION DE LECTURE',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: _isRunning ? AppTheme.accentPrimary : AppTheme.textMuted,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              _formatTime(_secondsElapsed),
              style: TextStyle(
                fontSize: 54,
                fontWeight: FontWeight.w900,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: AppTheme.textPrimary,
                letterSpacing: -1.5,
              ),
            ),
            const SizedBox(height: 20),

            // Bouton Pause / Play
            Center(
              child: GestureDetector(
                onTap: _togglePlayPause,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: _isRunning
                        ? LinearGradient(
                            colors: [
                              AppTheme.accentAmber,
                              AppTheme.accentAmber.withValues(alpha: 0.85),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : AppTheme.primaryGradient,
                    boxShadow: [
                      BoxShadow(
                        color: (_isRunning ? AppTheme.accentAmber : AppTheme.accentPrimary)
                            .withValues(alpha: 0.4),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Icon(
                    _isRunning ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    size: 38,
                    color: Colors.white,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 28),

            // Encart en bas avec couverture, titre, auteur et progression en pages
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.bgElevated,
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Couverture du livre
                    BookCover(
                      book: widget.book,
                      width: 52,
                      height: 76,
                      borderRadius: AppTheme.radiusMd,
                    ),
                    const SizedBox(width: 14),
                    // Titre, auteur et progression
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            widget.book.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          if (widget.book.author.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              widget.book.author,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),
                          // Barre de progression + texte
                          Row(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: progressPct,
                                    minHeight: 6,
                                    backgroundColor: AppTheme.borderSubtle,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      AppTheme.accentPrimary,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                totalPages > 0
                                    ? '$currentPage / $totalPages p. (${(progressPct * 100).round()}%)'
                                    : 'p. $currentPage',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
