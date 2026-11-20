import 'package:material_ui/material_ui.dart';

import 'package:flutter_application_1/app/theme.dart';

/// Pastille ronde de lecture commune affichée sur la couverture,
/// harmonisée avec les badges pilules du client Web.
class CommonReadingRibbon extends StatelessWidget {
  const CommonReadingRibbon({
    super.key,
    this.tooltip = 'Lecture commune',
    this.size = 22,
  });

  final String tooltip;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppTheme.accentSecondary,
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.26),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.groups_rounded,
          size: size * 0.54,
          color: Colors.white,
        ),
      ),
    );
  }
}

/// Badge pilule « Lecture commune » avec icône et libellé,
/// affiché sur les cartes (accueil « Lectures en cours », historique des lectures).
class CommonReadingBadge extends StatelessWidget {
  const CommonReadingBadge({
    super.key,
    this.label = 'Lecture commune',
    this.compact = false,
  });

  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final hPad = compact ? 8.0 : 10.0;
    final vPad = compact ? 4.0 : 5.0;
    final iconSize = compact ? 12.5 : 14.0;
    final fontSize = compact ? 10.5 : 11.5;

    return Tooltip(
      message: label,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
        decoration: BoxDecoration(
          color: AppTheme.accentSecondaryLight,
          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
          border: Border.all(
            color: AppTheme.accentSecondary.withValues(alpha: 0.4),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.groups_rounded,
              size: iconSize,
              color: AppTheme.accentSecondary,
            ),
            SizedBox(width: compact ? 4 : 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w700,
                color: AppTheme.accentSecondary,
                height: 1.0,
                letterSpacing: 0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
