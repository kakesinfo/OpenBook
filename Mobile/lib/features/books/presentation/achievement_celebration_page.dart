import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:material_ui/material_ui.dart';

import '../data/achievement.dart';
import 'components/achievement_medal.dart';

/// Écran plein écran animé célébrant la validation / le déblocage d'un succès,
/// entièrement teinté aux couleurs du trophée avec confettis et étoiles scintillantes.
class AchievementCelebrationPage extends StatefulWidget {
  const AchievementCelebrationPage({
    super.key,
    required this.achievement,
    required this.unlockedCount,
    required this.totalCount,
  });

  final Achievement achievement;
  final int unlockedCount;
  final int totalCount;

  static Future<void> show(
    BuildContext context, {
    required Achievement achievement,
    required int unlockedCount,
    required int totalCount,
  }) {
    return Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        transitionDuration: const Duration(milliseconds: 360),
        reverseTransitionDuration: const Duration(milliseconds: 240),
        pageBuilder: (_, _, _) => AchievementCelebrationPage(
          achievement: achievement,
          unlockedCount: unlockedCount,
          totalCount: totalCount,
        ),
        transitionsBuilder: (_, animation, _, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          return FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.96, end: 1.0).animate(curved),
              child: child,
            ),
          );
        },
      ),
    );
  }

  @override
  State<AchievementCelebrationPage> createState() =>
      _AchievementCelebrationPageState();
}

class _TrophyPalette {
  const _TrophyPalette({
    required this.primary,
    required this.light,
    required this.deep,
    required this.secondary,
    required this.textOnTheme,
    required this.ctaText,
  });

  final Color primary;
  final Color light;
  final Color deep;
  final Color secondary;
  final Color textOnTheme;
  final Color ctaText;

  factory _TrophyPalette.fromAchievement(
    Achievement achievement, {
    required bool isBeige,
  }) {
    final rawIcon = achievement.parsedIconColor;
    final rawBg = achievement.parsedBackgroundColor;

    final iconHsl = HSLColor.fromColor(rawIcon);
    final bgHsl = HSLColor.fromColor(rawBg);

    // Pick a vibrant primary color (fallback to bg hue if icon is nearly grayscale/white/black)
    final baseHsl = (iconHsl.saturation < 0.12 && bgHsl.saturation >= 0.18)
        ? bgHsl
        : iconHsl;

    final primary = baseHsl
        .withLightness(baseHsl.lightness.clamp(0.42, 0.62))
        .withSaturation(baseHsl.saturation < 0.1 ? baseHsl.saturation : baseHsl.saturation.clamp(0.45, 0.95))
        .toColor();

    final light = HSLColor.fromColor(primary)
        .withLightness((HSLColor.fromColor(primary).lightness + 0.18).clamp(0.0, 0.88))
        .toColor();

    final deep = HSLColor.fromColor(primary)
        .withLightness((HSLColor.fromColor(primary).lightness - 0.14).clamp(0.22, 0.72))
        .toColor();

    // Secondary accent derived from backgroundColor (harmonious contrast)
    final secondary = bgHsl
        .withLightness(bgHsl.lightness.clamp(0.46, 0.74))
        .toColor();

    // Readable text tint for rank pill & percentage on dark vs beige background
    final textOnTheme = isBeige
        ? HSLColor.fromColor(primary)
            .withLightness(HSLColor.fromColor(primary).lightness.clamp(0.26, 0.44))
            .toColor()
        : HSLColor.fromColor(primary)
            .withLightness(HSLColor.fromColor(primary).lightness.clamp(0.56, 0.76))
            .toColor();

    final ctaText = primary.computeLuminance() > 0.60
        ? const Color(0xFF0F172A)
        : Colors.white;

    return _TrophyPalette(
      primary: primary,
      light: light,
      deep: deep,
      secondary: secondary,
      textOnTheme: textOnTheme,
      ctaText: ctaText,
    );
  }
}

class _AchievementCelebrationPageState extends State<AchievementCelebrationPage>
    with TickerProviderStateMixin {
  late final AnimationController _introController;
  late final AnimationController _ambientController;
  late final AnimationController _raysController;

  late final Animation<double> _medalEntranceScale;
  late final Animation<double> _medalSpin;
  late final Animation<double> _medalLift;
  late final Animation<double> _medalSurge;
  late final Animation<double> _shockwaveProgress;
  late final Animation<double> _checkPopScale;
  late final Animation<double> _textFade;
  late final Animation<double> _progressAnim;
  late final Animation<double> _ctaFade;

  bool _hasBurst = false;

  @override
  void initState() {
    super.initState();

    _introController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    );

    _ambientController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    )..repeat();

    _raysController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 16),
    )..repeat();

    _medalEntranceScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.15, end: 1.12)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 68,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.12, end: 0.95)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 32,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.0, 0.44),
      ),
    );

    _medalSpin = Tween<double>(begin: 0.0, end: 4 * math.pi).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.02, 0.46, curve: Curves.easeOutCubic),
      ),
    );

    _medalLift = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 24.0, end: -12.0)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 60,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: -12.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeInOutCubic)),
        weight: 40,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.0, 0.54),
      ),
    );

    _medalSurge = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.22)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 34,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.22, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 66,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.44, 0.86),
      ),
    );

    _shockwaveProgress = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.42, 0.94, curve: Curves.easeOutCubic),
    );

    _checkPopScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.25)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 45,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.25, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 55,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.46, 0.84),
      ),
    );

    _textFade = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.54, 0.84, curve: Curves.easeOut),
    );

    final prevRatio = widget.totalCount > 0
        ? ((widget.unlockedCount - 1).clamp(0, widget.totalCount) /
            widget.totalCount)
        : 0.0;
    final nextRatio = widget.totalCount > 0
        ? (widget.unlockedCount.clamp(0, widget.totalCount) / widget.totalCount)
        : 1.0;

    _progressAnim = Tween<double>(begin: prevRatio, end: nextRatio).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.55, 0.92, curve: Curves.easeOutCubic),
      ),
    );

    _ctaFade = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.72, 1.0, curve: Curves.easeOutCubic),
    );

    _introController.addListener(_onIntroTick);
    _introController.forward();
  }

  void _onIntroTick() {
    if (!_hasBurst && _introController.value >= 0.44) {
      _hasBurst = true;
      HapticFeedback.heavyImpact();
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    _introController.removeListener(_onIntroTick);
    _introController.dispose();
    _ambientController.dispose();
    _raysController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final bgTop = isBeige ? const Color(0xFFFBF5EC) : const Color(0xFF070A12);
    final bgBottom = isBeige ? const Color(0xFFF2E6D4) : const Color(0xFF101524);
    final primaryText =
        isBeige ? const Color(0xFF292524) : const Color(0xFFF8FAFC);
    final secondaryText =
        isBeige ? const Color(0xFF57534E) : const Color(0xFFCBD5E1);
    final mutedText =
        isBeige ? const Color(0xFF78716C) : const Color(0xFF94A3B8);

    final palette = _TrophyPalette.fromAchievement(
      widget.achievement,
      isBeige: isBeige,
    );
    final medalIconColor = widget.achievement.parsedIconColor;
    final medalBgColor = widget.achievement.parsedBackgroundColor;

    final rankLabel =
        achievementRankLabel(widget.unlockedCount, widget.totalCount);
    final percent = widget.totalCount > 0
        ? ((widget.unlockedCount / widget.totalCount) * 100).round()
        : 100;

    return Scaffold(
      backgroundColor: bgTop,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Breathing radial glow tinted with trophy palette
          AnimatedBuilder(
            animation: Listenable.merge([_introController, _ambientController]),
            builder: (context, _) {
              final pulse =
                  0.5 + 0.5 * math.sin(_ambientController.value * 2 * math.pi);
              final surgeGlow = (_medalSurge.value - 1.0).clamp(0.0, 0.3) * 0.45;
              final glowAlpha =
                  (isBeige ? 0.16 : 0.25) + pulse * 0.07 + surgeGlow;
              return DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [bgTop, bgBottom],
                  ),
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: const Alignment(0, -0.35),
                      radius: 0.88 + pulse * 0.08 + surgeGlow * 0.4,
                      colors: [
                        palette.primary
                            .withValues(alpha: glowAlpha.clamp(0.0, 0.50)),
                        palette.secondary
                            .withValues(alpha: (glowAlpha * 0.38).clamp(0.0, 0.28)),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.45, 1.0],
                    ),
                  ),
                ),
              );
            },
          ),

          // Festive confetti ribbons & twinkling 4-point sparkles in trophy colors
          IgnorePointer(
            child: AnimatedBuilder(
              animation: _ambientController,
              builder: (context, _) => CustomPaint(
                painter: _ConfettiSparklesPainter(
                  progress: _ambientController.value,
                  primaryColor: palette.primary,
                  lightColor: palette.light,
                  secondaryColor: palette.secondary,
                  isBeige: isBeige,
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // Top close bar
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Fermer',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: Icon(
                          Icons.arrow_back_rounded,
                          color: primaryText,
                        ),
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 12),

                        // Animated Medal + Sunburst + Shockwaves + Orbiting Diamond Stars + Validation Check
                        SizedBox(
                          width: 240,
                          height: 220,
                          child: AnimatedBuilder(
                            animation: Listenable.merge([
                              _introController,
                              _ambientController,
                              _raysController,
                            ]),
                            builder: (context, _) {
                              final wave = math.sin(
                                  _ambientController.value * 2 * math.pi);
                              final ambientBreath = 1.0 + wave * 0.025;
                              final ambientBob = wave * 3.2;

                              final totalScale = _medalEntranceScale.value *
                                  _medalSurge.value *
                                  ambientBreath;
                              final spinAngle = _medalSpin.value;
                              final liftY = _medalLift.value + ambientBob;

                              final medalMatrix = Matrix4.identity()
                                ..setEntry(3, 2, 0.0018)
                                ..rotateY(spinAngle);

                              final raysOpacity =
                                  (_medalEntranceScale.value * 0.65)
                                          .clamp(0.0, 1.0) *
                                      (isBeige ? 0.28 : 0.40);

                              return Stack(
                                alignment: Alignment.center,
                                children: [
                                  // Rotating radiant rays in trophy colors
                                  Opacity(
                                    opacity: raysOpacity,
                                    child: Transform.rotate(
                                      angle: _raysController.value * 2 * math.pi,
                                      child: CustomPaint(
                                        size: const Size(220, 220),
                                        painter: _SunburstPainter(
                                          primaryColor: palette.light,
                                          secondaryColor: palette.primary,
                                        ),
                                      ),
                                    ),
                                  ),

                                  // 3 expanding concentric shockwave rings in trophy colors
                                  if (_shockwaveProgress.value > 0 &&
                                      _shockwaveProgress.value < 1) ...[
                                    _ShockwaveRing(
                                      progress: _shockwaveProgress.value,
                                      color: palette.light,
                                      maxRadius: 102,
                                    ),
                                    _ShockwaveRing(
                                      progress:
                                          ((_shockwaveProgress.value - 0.14) /
                                                  0.86)
                                              .clamp(0.0, 1.0),
                                      color: palette.primary,
                                      maxRadius: 114,
                                    ),
                                    _ShockwaveRing(
                                      progress:
                                          ((_shockwaveProgress.value - 0.28) /
                                                  0.72)
                                              .clamp(0.0, 1.0),
                                      color: palette.secondary,
                                      maxRadius: 124,
                                    ),
                                  ],

                                  // Soft radial halo behind medal
                                  Container(
                                    width: (136 + wave * 10) * _medalSurge.value,
                                    height: (136 + wave * 10) * _medalSurge.value,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: palette.primary.withValues(
                                            alpha: isBeige ? 0.34 : 0.46,
                                          ),
                                          blurRadius: 48,
                                          spreadRadius: 8,
                                        ),
                                        BoxShadow(
                                          color: palette.secondary.withValues(
                                            alpha: isBeige ? 0.18 : 0.26,
                                          ),
                                          blurRadius: 72,
                                          spreadRadius: 12,
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Orbiting 4-point twinkling diamond stars
                                  CustomPaint(
                                    size: const Size(216, 204),
                                    painter: _OrbitingStarsPainter(
                                      angle:
                                          _raysController.value * 2 * math.pi +
                                              spinAngle * 0.35,
                                      twinkle: _ambientController.value,
                                      opacity: _medalEntranceScale.value
                                          .clamp(0.0, 1.0),
                                      primaryColor: palette.primary,
                                      lightColor: palette.light,
                                      isBeige: isBeige,
                                    ),
                                  ),

                                  // Hero Achievement Medal with 3D spin + surge
                                  Transform.translate(
                                    offset: Offset(0, liftY),
                                    child: Transform(
                                      alignment: Alignment.center,
                                      transform: medalMatrix,
                                      child: Transform.scale(
                                        scale: totalScale,
                                        child: AchievementMedalWidget(
                                          icon: widget.achievement.icon,
                                          ornament: widget.achievement.ornament,
                                          iconColor: medalIconColor,
                                          backgroundColor: medalBgColor,
                                          size: 162,
                                          unlocked: true,
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Animated validation check badge in trophy palette
                                  if (_checkPopScale.value > 0.01)
                                    Positioned(
                                      right: 42,
                                      bottom: 34,
                                      child: Transform.scale(
                                        scale: _checkPopScale.value,
                                        child: Container(
                                          width: 38,
                                          height: 38,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            gradient: LinearGradient(
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                              colors: [
                                                palette.light,
                                                palette.primary,
                                              ],
                                            ),
                                            border: Border.all(
                                              color: bgTop,
                                              width: 3,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: palette.primary
                                                    .withValues(alpha: 0.55),
                                                blurRadius: 14,
                                              ),
                                            ],
                                          ),
                                          child: Icon(
                                            Icons.check_rounded,
                                            color: palette.ctaText,
                                            size: 22,
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              );
                            },
                          ),
                        ),

                        const SizedBox(height: 10),

                        // Dynamic trophy-colored "SUCCÈS DÉBLOQUÉ !" header
                        FadeTransition(
                          opacity: _textFade,
                          child: ShaderMask(
                            shaderCallback: (bounds) => LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                palette.light,
                                palette.primary,
                                palette.deep,
                              ],
                            ).createShader(bounds),
                            child: const Text(
                              'SUCCÈS DÉBLOQUÉ !',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.8,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 10),

                        // Achievement Name
                        FadeTransition(
                          opacity: _textFade,
                          child: Text(
                            widget.achievement.name,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 26,
                              height: 1.2,
                              fontWeight: FontWeight.w900,
                              color: primaryText,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ),

                        const SizedBox(height: 8),

                        FadeTransition(
                          opacity: _textFade,
                          child: Text(
                            widget.achievement.totalSteps > 1
                                ? '${widget.achievement.totalSteps} / ${widget.achievement.totalSteps} étapes accomplies'
                                : 'Bravo ! Un nouveau trophée rejoint ta collection.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14.5,
                              height: 1.4,
                              fontWeight: FontWeight.w500,
                              color: secondaryText,
                            ),
                          ),
                        ),

                        const SizedBox(height: 28),

                        // Overall progress card themed with trophy colors
                        FadeTransition(
                          opacity: _textFade,
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isBeige
                                  ? Colors.white.withValues(alpha: 0.65)
                                  : Colors.white.withValues(alpha: 0.05),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusXl),
                              border: Border.all(
                                color: isBeige
                                    ? palette.primary.withValues(alpha: 0.22)
                                    : Colors.white.withValues(alpha: 0.09),
                              ),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '${widget.unlockedCount}',
                                          style: TextStyle(
                                            fontSize: 17,
                                            fontWeight: FontWeight.w900,
                                            color: primaryText,
                                          ),
                                        ),
                                        Text(
                                          ' / ${widget.totalCount} succès',
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.w600,
                                            color: mutedText,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: palette.primary
                                            .withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(
                                            AppTheme.radiusFull),
                                        border: Border.all(
                                          color: palette.primary
                                              .withValues(alpha: 0.42),
                                        ),
                                      ),
                                      child: Text(
                                        rankLabel,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: palette.textOnTheme,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                AnimatedBuilder(
                                  animation: _progressAnim,
                                  builder: (context, _) {
                                    final value = _progressAnim.value;
                                    return Row(
                                      children: [
                                        Expanded(
                                          child: SizedBox(
                                            height: 12,
                                            child: LayoutBuilder(
                                              builder: (context, constraints) {
                                                final w = constraints.maxWidth;
                                                return Stack(
                                                  alignment:
                                                      Alignment.centerLeft,
                                                  children: [
                                                    Container(
                                                      height: 8,
                                                      decoration: BoxDecoration(
                                                        color: isBeige
                                                            ? const Color(
                                                                0xFFE7DCCB)
                                                            : Colors.white
                                                                .withValues(
                                                                    alpha:
                                                                        0.10),
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(999),
                                                      ),
                                                    ),
                                                    Container(
                                                      height: 8,
                                                      width: (w * value)
                                                          .clamp(0.0, w),
                                                      decoration: BoxDecoration(
                                                        gradient:
                                                            LinearGradient(
                                                          colors: [
                                                            palette.light,
                                                            palette.primary,
                                                            palette.deep,
                                                          ],
                                                        ),
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(999),
                                                        boxShadow: [
                                                          BoxShadow(
                                                            color: palette
                                                                .primary
                                                                .withValues(
                                                                    alpha:
                                                                        0.45),
                                                            blurRadius: 8,
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    for (final m in const [
                                                      0.25,
                                                      0.50,
                                                      0.75,
                                                      1.0
                                                    ])
                                                      Positioned(
                                                        left: (w * m - 4)
                                                            .clamp(0.0, w - 8),
                                                        child: Container(
                                                          width: 8,
                                                          height: 8,
                                                          decoration:
                                                              BoxDecoration(
                                                            shape:
                                                                BoxShape.circle,
                                                            color: value >= m
                                                                ? palette.light
                                                                : bgTop,
                                                            border: Border.all(
                                                              color: value >= m
                                                                  ? palette.deep
                                                                  : mutedText
                                                                      .withValues(
                                                                          alpha:
                                                                              0.4),
                                                              width: 1.5,
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                );
                                              },
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Text(
                                          '$percent%',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: palette.textOnTheme,
                                          ),
                                        ),
                                      ],
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),

                // Bottom Continue CTA tinted with trophy colors
                FadeTransition(
                  opacity: _ctaFade,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, 0.25),
                      end: Offset.zero,
                    ).animate(_ctaFade),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      child: Container(
                        width: double.infinity,
                        height: 52,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [palette.primary, palette.deep],
                          ),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusFull),
                          boxShadow: [
                            BoxShadow(
                              color: palette.primary.withValues(alpha: 0.42),
                              blurRadius: 18,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusFull),
                            onTap: () => Navigator.of(context).pop(),
                            child: Center(
                              child: Text(
                                'Continuer',
                                style: TextStyle(
                                  color: palette.ctaText,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
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
    );
  }
}

void _drawFourPointStar(Canvas canvas, Offset center, double radius, Paint paint) {
  final c = radius * 0.22;
  final path = Path()
    ..moveTo(center.dx, center.dy - radius)
    ..quadraticBezierTo(center.dx, center.dy - c, center.dx + radius, center.dy)
    ..quadraticBezierTo(center.dx, center.dy + c, center.dx, center.dy + radius)
    ..quadraticBezierTo(center.dx, center.dy + c, center.dx - radius, center.dy)
    ..quadraticBezierTo(center.dx, center.dy - c, center.dx, center.dy - radius)
    ..close();
  canvas.drawPath(path, paint);
}

class _SunburstPainter extends CustomPainter {
  const _SunburstPainter({
    required this.primaryColor,
    required this.secondaryColor,
  });

  final Color primaryColor;
  final Color secondaryColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxR = size.width / 2;
    const rayCount = 12;

    for (var i = 0; i < rayCount; i++) {
      final baseAngle = (i * 2 * math.pi) / rayCount;
      final spread = (math.pi / rayCount) * 0.42;
      final rayLength = i.isEven ? maxR : maxR * 0.82;

      final path = Path()
        ..moveTo(center.dx, center.dy)
        ..lineTo(
          center.dx + math.cos(baseAngle - spread) * rayLength,
          center.dy + math.sin(baseAngle - spread) * rayLength,
        )
        ..lineTo(
          center.dx + math.cos(baseAngle + spread) * rayLength,
          center.dy + math.sin(baseAngle + spread) * rayLength,
        )
        ..close();

      final color = i.isEven ? primaryColor : secondaryColor;
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            color.withValues(alpha: 0.40),
            color.withValues(alpha: 0.0),
          ],
          stops: const [0.15, 1.0],
        ).createShader(Rect.fromCircle(center: center, radius: rayLength));

      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SunburstPainter oldDelegate) =>
      oldDelegate.primaryColor != primaryColor ||
      oldDelegate.secondaryColor != secondaryColor;
}

class _OrbitingStarsPainter extends CustomPainter {
  const _OrbitingStarsPainter({
    required this.angle,
    required this.twinkle,
    required this.opacity,
    required this.primaryColor,
    required this.lightColor,
    required this.isBeige,
  });

  final double angle;
  final double twinkle;
  final double opacity;
  final Color primaryColor;
  final Color lightColor;
  final bool isBeige;

  @override
  void paint(Canvas canvas, Size size) {
    if (opacity <= 0.01) return;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final paint = Paint()..style = PaintingStyle.fill;

    final stars = [
      (0.0, 86.0, 32.0, 16.0, 7.5, lightColor),
      (1.3, 94.0, 38.0, -14.0, 6.0, primaryColor),
      (2.6, 78.0, 28.0, 10.0, 6.8, Colors.white),
      (3.9, 90.0, 34.0, -20.0, 5.5, lightColor),
      (5.2, 74.0, 26.0, 24.0, 5.8, primaryColor),
    ];

    for (var i = 0; i < stars.length; i++) {
      final s = stars[i];
      final a = angle + s.$1;
      final x = cx + math.cos(a) * s.$2;
      final y = cy + s.$4 + math.sin(a) * s.$3;
      final pulse = 0.65 + 0.35 * math.sin((twinkle * 2 * math.pi) + i * 1.3);
      final alpha =
          (opacity * pulse * (isBeige ? 0.78 : 0.94)).clamp(0.0, 1.0);

      paint.color = s.$6.withValues(alpha: alpha);
      _drawFourPointStar(canvas, Offset(x, y), s.$5 * pulse, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _OrbitingStarsPainter oldDelegate) =>
      oldDelegate.angle != angle ||
      oldDelegate.twinkle != twinkle ||
      oldDelegate.opacity != opacity ||
      oldDelegate.primaryColor != primaryColor ||
      oldDelegate.lightColor != lightColor ||
      oldDelegate.isBeige != isBeige;
}

class _ShockwaveRing extends StatelessWidget {
  const _ShockwaveRing({
    required this.progress,
    required this.color,
    required this.maxRadius,
  });

  final double progress;
  final Color color;
  final double maxRadius;

  @override
  Widget build(BuildContext context) {
    if (progress <= 0 || progress >= 1) return const SizedBox.shrink();
    final radius = 36 + progress * (maxRadius - 36);
    final opacity = (1.0 - progress).clamp(0.0, 1.0) * 0.65;

    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: opacity),
          width: (3.2 * (1.0 - progress * 0.7)).clamp(0.8, 3.2),
        ),
      ),
    );
  }
}

/// Confettis festifs qui tombent doucement en tournoyant + étoiles 4 branches scintillantes
/// (remplace les braises montantes pour se distinguer nettement de Streak).
class _ConfettiSparklesPainter extends CustomPainter {
  const _ConfettiSparklesPainter({
    required this.progress,
    required this.primaryColor,
    required this.lightColor,
    required this.secondaryColor,
    required this.isBeige,
  });

  final double progress;
  final Color primaryColor;
  final Color lightColor;
  final Color secondaryColor;
  final bool isBeige;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    const count = 24;

    final palette = [
      primaryColor,
      lightColor,
      secondaryColor,
      isBeige ? primaryColor.withValues(alpha: 0.85) : Colors.white,
    ];

    for (var i = 0; i < count; i++) {
      final seed = (i * 0.61803398875) % 1.0;
      final t = (progress + seed) % 1.0;
      final baseX = size.width * (0.05 + 0.90 * (((i * 41 + 13) % 100) / 100.0));
      final sway = math.sin(t * 2 * math.pi + i * 0.9) * 18;
      final x = baseX + sway;
      // Gently fall from top to bottom
      final y = size.height * (-0.05 + t * 1.10);
      final fade = math.sin(t * math.pi).clamp(0.0, 1.0);
      final color = palette[i % palette.length];
      final alpha = (fade * (isBeige ? 0.55 : 0.72)).clamp(0.0, 1.0);

      paint.color = color.withValues(alpha: alpha);

      if (i % 3 == 0) {
        // Twinkling 4-point star sparkle
        final twinkle = 0.6 + 0.4 * math.sin(t * 6 * math.pi + i);
        _drawFourPointStar(
          canvas,
          Offset(x, y),
          (4.5 + (i % 3) * 1.4) * twinkle,
          paint,
        );
      } else if (i % 3 == 1) {
        // Tumbling confetti ribbon
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(t * 4 * math.pi * (i.isEven ? 1 : -1) + i);
        final flipScale = math.cos(t * 6 * math.pi + i).abs().clamp(0.25, 1.0);
        canvas.scale(1.0, flipScale);
        final rect = RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: Offset.zero,
            width: 8.5 + (i % 2) * 2.5,
            height: 4.0,
          ),
          const Radius.circular(2),
        );
        canvas.drawRRect(rect, paint);
        canvas.restore();
      } else {
        // Rotating faceted diamond confetti
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(t * 3 * math.pi + i * 0.7);
        final d = 3.8 + (i % 2) * 1.4;
        final diamond = Path()
          ..moveTo(0, -d)
          ..lineTo(d * 0.7, 0)
          ..lineTo(0, d)
          ..lineTo(-d * 0.7, 0)
          ..close();
        canvas.drawPath(diamond, paint);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiSparklesPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.primaryColor != primaryColor ||
      oldDelegate.lightColor != lightColor ||
      oldDelegate.secondaryColor != secondaryColor ||
      oldDelegate.isBeige != isBeige;
}
