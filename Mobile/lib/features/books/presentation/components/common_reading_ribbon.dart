import 'package:material_ui/material_ui.dart';

import 'package:flutter_application_1/app/theme.dart';

/// Marque-page (ruban à encoche) affiché en haut à gauche d'une couverture
/// quand la lecture en cours est une lecture commune.
class CommonReadingRibbon extends StatelessWidget {
  const CommonReadingRibbon({super.key, this.tooltip = 'Lecture commune'});

  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: ClipPath(
        clipper: _RibbonClipper(),
        child: Container(
          width: 22,
          height: 30,
          color: AppTheme.accentSecondary,
          alignment: Alignment.topCenter,
          padding: const EdgeInsets.only(top: 5),
          child: const Icon(
            Icons.groups_rounded,
            size: 12,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _RibbonClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    return Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height)
      ..lineTo(size.width / 2, size.height - 7)
      ..lineTo(0, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
