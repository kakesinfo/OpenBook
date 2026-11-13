import 'package:flutter/material.dart';
import 'package:confetti/confetti.dart';
import '../../../../app/theme.dart';
import '../../data/book.dart';
import 'book_cover.dart';

/// Dialogue de célébration affiché lorsqu'un livre est marqué comme terminé / lu.
class BookCompletionDialog extends StatefulWidget {
  const BookCompletionDialog({super.key, required this.book});

  final Book book;

  static Future<void> show(BuildContext context, Book book) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (_) => BookCompletionDialog(book: book),
    );
  }

  @override
  State<BookCompletionDialog> createState() => _BookCompletionDialogState();
}

class _BookCompletionDialogState extends State<BookCompletionDialog> {
  late ConfettiController _confettiController;

  @override
  void initState() {
    super.initState();
    _confettiController = ConfettiController(
      duration: const Duration(seconds: 4),
    );
    _confettiController.play();
  }

  @override
  void dispose() {
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final book = widget.book;

    return Stack(
      alignment: Alignment.topCenter,
      children: [
        Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 380),
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            decoration: BoxDecoration(
              gradient: AppTheme.cardGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.borderMedium, width: 1.5),
              boxShadow: [
                ...AppTheme.modalShadow,
                BoxShadow(
                  color: AppTheme.accentPrimary.withValues(alpha: 0.2),
                  blurRadius: 36,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Badge félicitations
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.accentPrimary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    border: Border.all(
                      color: AppTheme.accentPrimary.withValues(alpha: 0.35),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        size: 16,
                        color: AppTheme.accentPrimary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'LECTURE TERMINÉE !',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: AppTheme.accentPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Couverture du livre
                BookCover(
                  book: book,
                  width: 120,
                  height: 180,
                  borderRadius: AppTheme.radiusLg,
                ),
                const SizedBox(height: 18),

                // Titre
                Text(
                  book.title,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textPrimary,
                    letterSpacing: -0.02,
                  ),
                ),
                if (book.author.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    book.author,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Text(
                  'Félicitations pour avoir terminé ce livre !',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.textMuted,
                  ),
                ),
                const SizedBox(height: 24),

                // Bouton Terminer / Fermer
                Container(
                  width: double.infinity,
                  height: 46,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.accentPrimaryGlow,
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      onTap: () => Navigator.of(context).pop(),
                      child: const Center(
                        child: Text(
                          'Génial !',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Confettis qui tombent du haut
        Positioned(
          top: 0,
          child: ConfettiWidget(
            confettiController: _confettiController,
            blastDirectionality: BlastDirectionality.explosive,
            shouldLoop: false,
            emissionFrequency: 0.05,
            numberOfParticles: 25,
            gravity: 0.15,
            colors: const [
              Color(0xFF10B981), // Emerald
              Color(0xFF6366F1), // Indigo
              Color(0xFF34D399), // Light Emerald
              Color(0xFFEC4899), // Pink
              Color(0xFF3B82F6), // Blue
              Color(0xFFF43F5E), // Rose
            ],
          ),
        ),
      ],
    );
  }
}
