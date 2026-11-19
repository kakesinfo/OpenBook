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
