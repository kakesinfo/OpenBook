import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../data/achievement.dart';

class AchievementMedalWidget extends StatelessWidget {
  const AchievementMedalWidget({
    super.key,
    required this.icon,
    required this.ornament,
    required this.iconColor,
    required this.backgroundColor,
    this.size = 104,
    this.unlocked = true,
  });

  final String icon;
  final String ornament;
  final Color iconColor;
  final Color backgroundColor;
  final double size;
  final bool unlocked;

  @override
  Widget build(BuildContext context) {
    final badgeSize = size * 0.585;
    final iconSize = badgeSize * 0.52;

    Widget medal = SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (ornament != 'none')
            CustomPaint(
              size: Size(size, size),
              painter: _OrnamentPainter(
                ornament: ornament,
                color: iconColor,
                unlocked: unlocked,
              ),
            ),
          Container(
            width: badgeSize,
            height: badgeSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: backgroundColor,
              gradient: RadialGradient(
                center: const Alignment(-0.35, -0.45),
                radius: 0.95,
                colors: [
                  Color.lerp(backgroundColor, Colors.white, 0.28)!,
                  backgroundColor,
                  Color.lerp(backgroundColor, Colors.black, 0.28)!,
                ],
                stops: const [0.0, 0.52, 1.0],
              ),
              border: Border.all(
                color: unlocked
                    ? Color.lerp(iconColor, Colors.white, 0.2)!
                    : iconColor.withValues(alpha: 0.45),
                width: (size * 0.024).clamp(1.8, 3.2),
              ),
              boxShadow: unlocked
                  ? [
                      BoxShadow(
                        color: iconColor.withValues(alpha: 0.36),
                        blurRadius: size * 0.2,
                        spreadRadius: 1,
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 5),
                      ),
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 6,
                        offset: const Offset(0, 3),
                      ),
                    ],
            ),
            child: ClipOval(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Top glossy dome highlight
                  Positioned(
                    top: badgeSize * 0.04,
                    left: badgeSize * 0.1,
                    right: badgeSize * 0.1,
                    height: badgeSize * 0.44,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(badgeSize),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.42),
                            Colors.white.withValues(alpha: 0.06),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Inner engraved ring
                  Padding(
                    padding: EdgeInsets.all(badgeSize * 0.065),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: iconColor.withValues(alpha: 0.34),
                          width: 1.3,
                        ),
                      ),
                      child: const SizedBox.expand(),
                    ),
                  ),
                  // Main icon
                  Icon(
                    achievementIconData(icon),
                    size: iconSize,
                    color: iconColor,
                    shadows: [
                      if (unlocked)
                        Shadow(
                          color: iconColor.withValues(alpha: 0.5),
                          blurRadius: 8,
                        ),
                      Shadow(
                        color: Colors.black.withValues(alpha: 0.32),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );

    if (!unlocked) {
      medal = Opacity(
        opacity: 0.46,
        child: ColorFiltered(
          colorFilter: const ColorFilter.matrix(<double>[
            0.2126, 0.7152, 0.0722, 0, 0,
            0.2126, 0.7152, 0.0722, 0, 0,
            0.2126, 0.7152, 0.0722, 0, 0,
            0, 0, 0, 1, 0,
          ]),
          child: medal,
        ),
      );
    }

    return medal;
  }
}

class _OrnamentPainter extends CustomPainter {
  const _OrnamentPainter({
    required this.ornament,
    required this.color,
    required this.unlocked,
  });

  final String ornament;
  final Color color;
  final bool unlocked;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 160.0;
    canvas.save();
    canvas.scale(s, s);

    switch (ornament) {
      case 'stars':
        _paintStars(canvas);
        break;
      case 'wings':
        _paintWings(canvas);
        break;
      case 'royal':
        _paintRoyal(canvas);
        break;
      case 'ribbon':
        _paintRibbon(canvas);
        break;
      case 'laurel':
      default:
        _paintLaurel(canvas);
        break;
    }

    canvas.restore();
  }

  void _drawStar5(Canvas canvas, Offset center, double r, double opacity) {
    final path = Path();
    final inner = r * 0.44;
    for (var i = 0; i < 10; i++) {
      final angle = (math.pi / 5) * i - math.pi / 2;
      final rad = i.isEven ? r : inner;
      final x = center.dx + math.cos(angle) * rad;
      final y = center.dy + math.sin(angle) * rad;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
    canvas.drawPath(
      path,
      Paint()..color = color.withValues(alpha: opacity),
    );
  }

  void _drawLeaf(Canvas canvas, double x, double y, double deg, double scale, double opacity) {
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(deg * math.pi / 180);
    canvas.scale(scale, scale);
    final path = Path()
      ..moveTo(0, -9)
      ..cubicTo(4, -4, 4, 4, 0, 9)
      ..cubicTo(-4, 4, -4, -4, 0, -9)
      ..close();
    canvas.drawPath(path, Paint()..color = color.withValues(alpha: opacity));
    canvas.restore();
  }

  void _paintLaurel(Canvas canvas) {
    final stemPaint = Paint()
      ..color = color.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final leftStem = Path()
      ..moveTo(66, 135)
      ..cubicTo(34, 125, 18, 98, 20, 68)
      ..cubicTo(22, 47, 32, 30, 48, 20);
    canvas.drawPath(leftStem, stemPaint);

    final rightStem = Path()
      ..moveTo(94, 135)
      ..cubicTo(126, 125, 142, 98, 140, 68)
      ..cubicTo(138, 47, 128, 30, 112, 20);
    canvas.drawPath(rightStem, stemPaint);

    const leaves = [
      (44.0, 24.0, -48.0, 0.78),
      (32.0, 35.0, -36.0, 0.86),
      (24.0, 49.0, -22.0, 0.92),
      (19.0, 65.0, -8.0, 0.96),
      (19.0, 82.0, 8.0, 0.96),
      (24.0, 98.0, 24.0, 0.92),
      (34.0, 113.0, 42.0, 0.88),
      (48.0, 125.0, 58.0, 0.82),
    ];

    for (final l in leaves) {
      _drawLeaf(canvas, l.$1, l.$2, l.$3, l.$4, 0.82);
      _drawLeaf(canvas, 160 - l.$1, l.$2, -l.$3, l.$4, 0.82);
    }

    _drawStar5(canvas, const Offset(80, 138), 7.5, 0.95);
  }

  void _paintStars(Canvas canvas) {
    canvas.drawCircle(
      const Offset(80, 80),
      57,
      Paint()
        ..color = color.withValues(alpha: 0.32)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    _drawStar5(canvas, const Offset(80, 16), 9.5, 0.95);
    _drawStar5(canvas, const Offset(51, 24), 6.2, 0.85);
    _drawStar5(canvas, const Offset(109, 24), 6.2, 0.85);
    _drawStar5(canvas, const Offset(18, 76), 7.2, 0.85);
    _drawStar5(canvas, const Offset(142, 76), 7.2, 0.85);
    _drawStar5(canvas, const Offset(80, 144), 7.5, 0.95);
    _drawStar5(canvas, const Offset(58, 138), 4.8, 0.75);
    _drawStar5(canvas, const Offset(102, 138), 4.8, 0.75);
  }

  void _paintWings(Canvas canvas) {
    canvas.drawCircle(
      const Offset(80, 80),
      54,
      Paint()
        ..color = color.withValues(alpha: 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );

    final stroke = Paint()
      ..color = color.withValues(alpha: 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeJoin = StrokeJoin.round;

    void drawWingSide(bool mirror) {
      canvas.save();
      if (mirror) {
        canvas.translate(160, 0);
        canvas.scale(-1, 1);
      }
      final tiers = [
        (
          Path()
            ..moveTo(36, 58)
            ..cubicTo(22, 44, 10, 42, 5, 48)
            ..cubicTo(13, 55, 21, 60, 32, 64)
            ..close(),
          0.45
        ),
        (
          Path()
            ..moveTo(33, 68)
            ..cubicTo(18, 62, 8, 64, 5, 72)
            ..cubicTo(14, 75, 23, 76, 33, 76)
            ..close(),
          0.34
        ),
        (
          Path()
            ..moveTo(34, 80)
            ..cubicTo(20, 80, 12, 85, 11, 93)
            ..cubicTo(19, 94, 28, 92, 37, 89)
            ..close(),
          0.24
        ),
      ];
      for (final tier in tiers) {
        canvas.drawPath(tier.$1, Paint()..color = color.withValues(alpha: tier.$2));
        canvas.drawPath(tier.$1, stroke);
      }
      canvas.restore();
    }

    drawWingSide(false);
    drawWingSide(true);

    final bottomGem = Path()
      ..moveTo(80, 130)
      ..lineTo(87, 139)
      ..lineTo(80, 148)
      ..lineTo(73, 139)
      ..close();
    canvas.drawPath(bottomGem, Paint()..color = color);
  }

  void _paintRoyal(Canvas canvas) {
    canvas.drawCircle(
      const Offset(80, 80),
      55,
      Paint()
        ..color = color.withValues(alpha: 0.42)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8,
    );

    for (var i = 0; i < 8; i++) {
      canvas.save();
      canvas.translate(80, 80);
      canvas.rotate((i * 45) * math.pi / 180);
      final ray = Path()
        ..moveTo(0, -73)
        ..lineTo(3.4, -58)
        ..lineTo(-3.4, -58)
        ..close();
      canvas.drawPath(
        ray,
        Paint()..color = color.withValues(alpha: i.isEven ? 0.92 : 0.65),
      );
      canvas.restore();
    }
  }

  void _paintRibbon(Canvas canvas) {
    final fill = Paint()..color = color.withValues(alpha: 0.36);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeJoin = StrokeJoin.round;

    final left = Path()
      ..moveTo(52, 114)
      ..lineTo(38, 152)
      ..lineTo(54, 143)
      ..lineTo(66, 154)
      ..lineTo(76, 122)
      ..close();
    final right = Path()
      ..moveTo(108, 114)
      ..lineTo(122, 152)
      ..lineTo(106, 143)
      ..lineTo(94, 154)
      ..lineTo(84, 122)
      ..close();

    canvas.drawPath(left, fill);
    canvas.drawPath(left, stroke);
    canvas.drawPath(right, fill);
    canvas.drawPath(right, stroke);

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(63, 119, 34, 12),
        const Radius.circular(6),
      ),
      Paint()..color = color.withValues(alpha: 0.92),
    );
  }

  @override
  bool shouldRepaint(covariant _OrnamentPainter oldDelegate) =>
      oldDelegate.ornament != ornament ||
      oldDelegate.color != color ||
      oldDelegate.unlocked != unlocked;
}
