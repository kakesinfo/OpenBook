import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';

import '../../data/book.dart';

/// Pastille de statut (Lu, En cours, En pause, Abandonné, Souhaité, Vendu, Prêté)
/// affichée en haut à gauche d'une couverture, alignée avec le client Web.
class BookStatusBadge extends StatelessWidget {
  const BookStatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  final BookStatus status;
  final bool compact;

  static bool shouldShow(BookStatus status) => status != BookStatus.unread;

  @override
  Widget build(BuildContext context) {
    if (!shouldShow(status)) {
      return const SizedBox.shrink();
    }

    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final (IconData icon, String label, Color bgColor, Color textColor) =
        switch (status) {
      BookStatus.read => (
          Icons.check_rounded,
          'Lu',
          isBeige ? const Color(0xEB15803D) : const Color(0xE610B981),
          Colors.white,
        ),
      BookStatus.reading => (
          Icons.menu_book_rounded,
          'En cours',
          isBeige ? const Color(0xEB7C3AED) : const Color(0xE68B5CF6),
          Colors.white,
        ),
      BookStatus.paused => (
          Icons.pause_rounded,
          'En pause',
          const Color(0xE6475569),
          const Color(0xFFF8FAFC),
        ),
      BookStatus.abandoned => (
          Icons.block_rounded,
          'Abandonné',
          const Color(0xE6E11D48),
          Colors.white,
        ),
      BookStatus.sold => (
          Icons.check_rounded,
          'Vendu',
          const Color(0xE6334155),
          const Color(0xFFE2E8F0),
        ),
      BookStatus.wishlist => (
          Icons.favorite_rounded,
          'Souhaité',
          const Color(0xE6F43F5E),
          Colors.white,
        ),
      BookStatus.lent => (
          Icons.swap_horiz_rounded,
          'Prêté',
          const Color(0xEBD97706),
          Colors.white,
        ),
      BookStatus.unread => (
          Icons.circle,
          '',
          Colors.transparent,
          Colors.transparent,
        ),
    };

    final double height = compact ? 20 : 26;
    final double hPad = compact ? 6 : 9;
    final double iconSize = compact ? 10 : 12;
    final double fontSize = compact ? 9.5 : 11.5;

    return Container(
      height: height,
      padding: EdgeInsets.symmetric(horizontal: hPad),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.24),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: iconSize, color: textColor),
          SizedBox(width: compact ? 3 : 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w600,
                color: textColor,
                height: 1.0,
                letterSpacing: 0.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
