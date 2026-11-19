import 'dart:math' as math;

import 'package:confetti/confetti.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:material_ui/material_ui.dart';

import '../application/streak_utils.dart';

/// Écran animé plein écran célébrant l'augmentation de +1 du streak de lecture
/// lors de la première session ou du premier début de lecture de la journée.
class StreakCelebrationPage extends StatefulWidget {
  const StreakCelebrationPage({
    super.key,
    required this.data,
  });

  final StreakCelebrationData data;

  static Future<void> show(
    BuildContext context, {
    required StreakCelebrationData data,
  }) {
    return Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        transitionDuration: const Duration(milliseconds: 360),
        reverseTransitionDuration: const Duration(milliseconds: 240),
        pageBuilder: (_, _, _) => StreakCelebrationPage(data: data),
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
  State<StreakCelebrationPage> createState() => _StreakCelebrationPageState();
}

class _StreakCelebrationPageState extends State<StreakCelebrationPage>
    with TickerProviderStateMixin {
  late final AnimationController _introController;
  late final AnimationController _ambientController;
  late final ConfettiController _confettiController;

  late final Animation<double> _flameScale;
  late final Animation<double> _shockwaveProgress;
  late final Animation<double> _incrementProgress;
  late final Animation<double> _plusOneBadgePop;
  late final Animation<double> _todayIgniteScale;
  late final Animation<double> _textFade;
  late final Animation<double> _ctaFade;

  bool _hasIncremented = false;

  static const _fireRed = Color(0xFFFF3B30);
  static const _fireCoral = Color(0xFFFF5E3A);
  static const _fireOrange = Color(0xFFFF9500);
  static const _fireGold = Color(0xFFFFD60A);
  static const _emerald = Color(0xFF10B981);

  @override
  void initState() {
    super.initState();

    _introController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1650),
    );

    _ambientController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat();

    _confettiController = ConfettiController(
      duration: const Duration(seconds: 3),
    );

    _flameScale = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.0, 0.36, curve: Curves.easeOutBack),
    );

    _shockwaveProgress = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.32, 0.85, curve: Curves.easeOutCubic),
    );

    _incrementProgress = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.36, 0.68, curve: Curves.easeOutBack),
    );

    _plusOneBadgePop = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.2)
            .chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 55,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.2, end: 1.0)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 45,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.42, 0.78),
      ),
    );

    _todayIgniteScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.75, end: 1.28)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.28, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 50,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.44, 0.84),
      ),
    );

    _textFade = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.55, 0.85, curve: Curves.easeOut),
    );

    _ctaFade = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.72, 1.0, curve: Curves.easeOutCubic),
    );

    _introController.addListener(_onIntroTick);
    _introController.forward();
  }

  void _onIntroTick() {
    if (!_hasIncremented && _introController.value >= 0.38) {
      _hasIncremented = true;
      _confettiController.play();
      if (mounted) {
        setState(() {});
      }
    }
  }

  @override
  void dispose() {
    _introController.removeListener(_onIntroTick);
    _introController.dispose();
    _ambientController.dispose();
    _confettiController.dispose();
    super.dispose();
  }

  String _motivationalMessage(int streak) {
    if (streak <= 1) {
      return 'Un superbe début ! Chaque page lue nourrit votre nouvelle série.';
    }
    if (streak < 7) {
      return 'Chaque journée de lecture tranquille vous renforce un peu plus.';
    }
    if (streak < 14) {
      return 'Une semaine complète de lecture ! Votre régularité est remarquable.';
    }
    if (streak < 30) {
      return 'Quelle constance ! La lecture fait désormais partie de votre rythme.';
    }
    return 'Une série légendaire ! Rien ne peut arrêter votre passion de lire.';
  }

  @override
  Widget build(BuildContext context) {
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final bgTop = isBeige ? const Color(0xFFFBF5EC) : const Color(0xFF070A12);
    final bgBottom = isBeige ? const Color(0xFFF2E6D4) : const Color(0xFF120E1A);
    final primaryTextColor = isBeige ? const Color(0xFF292524) : const Color(0xFFF8FAFC);
    final secondaryTextColor = isBeige ? const Color(0xFF57534E) : const Color(0xFFCBD5E1);
    final mutedTextColor = isBeige ? const Color(0xFF78716C) : const Color(0xFF94A3B8);

    return Scaffold(
      backgroundColor: bgTop,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background rich gradient + breathing radial fire glow
          AnimatedBuilder(
            animation: Listenable.merge([_introController, _ambientController]),
            builder: (context, _) {
              final pulse = 0.5 + 0.5 * math.sin(_ambientController.value * 2 * math.pi);
              final glowAlpha = (isBeige ? 0.16 : 0.24) + pulse * 0.08;
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
                      radius: 0.85 + pulse * 0.08,
                      colors: [
                        _fireOrange.withValues(alpha: glowAlpha),
                        _fireCoral.withValues(alpha: glowAlpha * 0.45),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.45, 1.0],
                    ),
                  ),
                ),
              );
            },
          ),

          // Ambient floating glowing embers
          IgnorePointer(
            child: AnimatedBuilder(
              animation: _ambientController,
              builder: (context, _) => CustomPaint(
                painter: _EmberParticlesPainter(
                  progress: _ambientController.value,
                  isBeige: isBeige,
                ),
              ),
            ),
          ),

          // Main Content
          SafeArea(
            child: Column(
              children: [
                // Top bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Fermer',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: Icon(
                          Icons.arrow_back_rounded,
                          color: primaryTextColor,
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
                        const SizedBox(height: 16),

                        // Animated Multi-Layered Flame + Shockwave Aura
                        SizedBox(
                          width: 190,
                          height: 180,
                          child: AnimatedBuilder(
                            animation: Listenable.merge([
                              _introController,
                              _ambientController,
                            ]),
                            builder: (context, _) {
                              final flicker =
                                  math.sin(_ambientController.value * 2 * math.pi);
                              final secondaryFlicker =
                                  math.cos(_ambientController.value * 4 * math.pi);
                              final boost = _hasIncremented
                                  ? 1.0 +
                                      0.06 *
                                          math.sin(
                                            _incrementProgress.value * math.pi,
                                          )
                                  : 1.0;

                              return Stack(
                                alignment: Alignment.center,
                                children: [
                                  // Expanding shockwave rings on +1 moment
                                  if (_shockwaveProgress.value > 0 &&
                                      _shockwaveProgress.value < 1) ...[
                                    _ShockwaveRing(
                                      progress: _shockwaveProgress.value,
                                      color: _fireGold,
                                      maxRadius: 92,
                                    ),
                                    _ShockwaveRing(
                                      progress: ((_shockwaveProgress.value - 0.18) / 0.82)
                                          .clamp(0.0, 1.0),
                                      color: _fireCoral,
                                      maxRadius: 108,
                                    ),
                                  ],

                                  // Soft radial glow behind flame
                                  Container(
                                    width: 128 + flicker * 8,
                                    height: 128 + flicker * 8,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: _fireOrange.withValues(
                                            alpha: isBeige ? 0.34 : 0.45,
                                          ),
                                          blurRadius: 46,
                                          spreadRadius: 8,
                                        ),
                                        BoxShadow(
                                          color: _fireRed.withValues(
                                            alpha: isBeige ? 0.18 : 0.28,
                                          ),
                                          blurRadius: 72,
                                          spreadRadius: 12,
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Custom-painted vibrant animated flame
                                  Transform.scale(
                                    scale: _flameScale.value * boost,
                                    child: CustomPaint(
                                      size: const Size(124, 146),
                                      painter: _AnimatedFlamePainter(
                                        flicker: flicker,
                                        secondaryFlicker: secondaryFlicker,
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Animated Streak Counter (previousStreak -> newStreak) + "+1" badge
                        AnimatedBuilder(
                          animation: _introController,
                          builder: (context, _) {
                            return SizedBox(
                              height: 108,
                              child: Stack(
                                alignment: Alignment.center,
                                clipBehavior: Clip.none,
                                children: [
                                  AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 520),
                                    switchInCurve: Curves.elasticOut,
                                    switchOutCurve: Curves.easeInCubic,
                                    transitionBuilder: (child, animation) {
                                      final isIncoming =
                                          child.key == ValueKey<int>(widget.data.newStreak);
                                      final offsetTween = isIncoming
                                          ? Tween<Offset>(
                                              begin: const Offset(0, 0.55),
                                              end: Offset.zero,
                                            )
                                          : Tween<Offset>(
                                              begin: const Offset(0, -0.55),
                                              end: Offset.zero,
                                            );
                                      return FadeTransition(
                                        opacity: animation,
                                        child: SlideTransition(
                                          position: offsetTween.animate(animation),
                                          child: ScaleTransition(
                                            scale: Tween<double>(begin: 0.72, end: 1.0)
                                                .animate(animation),
                                            child: child,
                                          ),
                                        ),
                                      );
                                    },
                                    child: ShaderMask(
                                      key: ValueKey<int>(
                                        _hasIncremented
                                            ? widget.data.newStreak
                                            : widget.data.previousStreak,
                                      ),
                                      shaderCallback: (bounds) => const LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [_fireGold, _fireOrange, _fireCoral],
                                      ).createShader(bounds),
                                      child: Text(
                                        '${_hasIncremented ? widget.data.newStreak : widget.data.previousStreak}',
                                        style: const TextStyle(
                                          fontSize: 88,
                                          height: 1.0,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                          letterSpacing: -2,
                                          fontFeatures: [FontFeature.tabularFigures()],
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Floating "+1" pill badge
                                  if (_plusOneBadgePop.value > 0.01)
                                    Positioned(
                                      top: 6,
                                      right: MediaQuery.of(context).size.width * 0.5 - 118,
                                      child: Transform.scale(
                                        scale: _plusOneBadgePop.value,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 5,
                                          ),
                                          decoration: BoxDecoration(
                                            gradient: const LinearGradient(
                                              colors: [_emerald, Color(0xFF059669)],
                                            ),
                                            borderRadius:
                                                BorderRadius.circular(AppTheme.radiusFull),
                                            boxShadow: [
                                              BoxShadow(
                                                color: _emerald.withValues(alpha: 0.45),
                                                blurRadius: 12,
                                                offset: const Offset(0, 3),
                                              ),
                                            ],
                                          ),
                                          child: const Text(
                                            '+1',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w900,
                                              height: 1.0,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),

                        const SizedBox(height: 6),

                        // Title
                        FadeTransition(
                          opacity: _textFade,
                          child: Text(
                            'Série de lecture actuelle',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: primaryTextColor,
                              letterSpacing: -0.3,
                            ),
                          ),
                        ),

                        const SizedBox(height: 30),

                        // Animated 7-day Week Strip
                        AnimatedBuilder(
                          animation: _introController,
                          builder: (context, _) => _AnimatedWeekStrip(
                            activeWeekDayIndices: widget.data.activeWeekDayIndices,
                            todayIndex: widget.data.todayIndex,
                            todayIgnited: _hasIncremented,
                            todayScale: _todayIgniteScale.value,
                            isBeige: isBeige,
                            mutedTextColor: mutedTextColor,
                          ),
                        ),

                        const SizedBox(height: 32),

                        // Motivational message
                        FadeTransition(
                          opacity: _textFade,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              _motivationalMessage(widget.data.newStreak),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                height: 1.45,
                                fontWeight: FontWeight.w500,
                                color: secondaryTextColor,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),

                // Bottom Continue CTA
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
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [_fireCoral, _fireOrange],
                          ),
                          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                          boxShadow: [
                            BoxShadow(
                              color: _fireOrange.withValues(alpha: 0.42),
                              blurRadius: 18,
                              offset: const Offset(0, 6),
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
                                'Continuer',
                                style: TextStyle(
                                  color: Colors.white,
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

          // Celebratory confetti burst from top center
          Align(
            alignment: Alignment.topCenter,
            child: IgnorePointer(
              child: ConfettiWidget(
                confettiController: _confettiController,
                blastDirectionality: BlastDirectionality.explosive,
                shouldLoop: false,
                emissionFrequency: 0.06,
                numberOfParticles: 24,
                maxBlastForce: 22,
                minBlastForce: 8,
                gravity: 0.18,
                colors: const [
                  _fireGold,
                  _fireOrange,
                  _fireCoral,
                  _fireRed,
                  _emerald,
                  Color(0xFF6366F1),
                  Color(0xFFEC4899),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnimatedWeekStrip extends StatelessWidget {
  const _AnimatedWeekStrip({
    required this.activeWeekDayIndices,
    required this.todayIndex,
    required this.todayIgnited,
    required this.todayScale,
    required this.isBeige,
    required this.mutedTextColor,
  });

  final Set<int> activeWeekDayIndices;
  final int todayIndex;
  final bool todayIgnited;
  final double todayScale;
  final bool isBeige;
  final Color mutedTextColor;

  static const _dayLabels = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

  @override
  Widget build(BuildContext context) {
    final containerBg = isBeige
        ? Colors.white.withValues(alpha: 0.55)
        : Colors.white.withValues(alpha: 0.04);
    final containerBorder = isBeige
        ? const Color(0x33B45309)
        : Colors.white.withValues(alpha: 0.08);
    final emptyCircleBorder = isBeige
        ? const Color(0x44785F46)
        : Colors.white.withValues(alpha: 0.18);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 16),
      decoration: BoxDecoration(
        color: containerBg,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: containerBorder, width: 1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(7, (index) {
          final isToday = index == todayIndex;
          final wasReadBeforeToday =
              activeWeekDayIndices.contains(index) && !isToday;
          final isLit = wasReadBeforeToday || (isToday && todayIgnited);

          Widget circle = AnimatedContainer(
            duration: const Duration(milliseconds: 360),
            curve: Curves.easeOutCubic,
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: isLit
                  ? LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: isToday
                          ? const [Color(0xFFFFD60A), Color(0xFFFF6B35)]
                          : const [Color(0xFFFF9500), Color(0xFFFF5E3A)],
                    )
                  : null,
              color: isLit ? null : Colors.transparent,
              border: isLit
                  ? null
                  : Border.all(
                      color: isToday
                          ? const Color(0xFFFF9500).withValues(alpha: 0.7)
                          : emptyCircleBorder,
                      width: isToday ? 1.8 : 1.3,
                    ),
              boxShadow: isLit
                  ? [
                      BoxShadow(
                        color: (isToday
                                ? const Color(0xFFFF9500)
                                : const Color(0xFFFF5E3A))
                            .withValues(alpha: isToday ? 0.5 : 0.28),
                        blurRadius: isToday ? 14 : 8,
                        offset: const Offset(0, 3),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 280),
                transitionBuilder: (child, anim) => ScaleTransition(
                  scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
                  child: child,
                ),
                child: isLit
                    ? const Icon(
                        Icons.check_rounded,
                        key: ValueKey('checked'),
                        size: 20,
                        color: Colors.white,
                      )
                    : const SizedBox.shrink(key: ValueKey('empty')),
              ),
            ),
          );

          if (isToday && todayIgnited) {
            circle = Transform.scale(
              scale: todayScale,
              child: circle,
            );
          }

          return Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                circle,
                const SizedBox(height: 8),
                Text(
                  _dayLabels[index],
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                    color: isToday
                        ? const Color(0xFFFF9500)
                        : mutedTextColor,
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
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
    final radius = 34 + (maxRadius - 34) * progress;
    final opacity = (1.0 - progress).clamp(0.0, 1.0) * 0.55;
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: opacity),
          width: 3.0 * (1.0 - progress * 0.6),
        ),
      ),
    );
  }
}

class _AnimatedFlamePainter extends CustomPainter {
  const _AnimatedFlamePainter({
    required this.flicker,
    required this.secondaryFlicker,
  });

  final double flicker;
  final double secondaryFlicker;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Ground shadow oval under the flame
    final shadowPaint = Paint()
      ..color = const Color(0xFF9A1B12).withValues(alpha: 0.42)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(w * 0.5, h * 0.93),
        width: w * 0.62,
        height: h * 0.11,
      ),
      shadowPaint,
    );

    final tipShift = flicker * 3.5;
    final sideSway = secondaryFlicker * 2.0;

    // Outer flame silhouette (vibrant red-coral-orange gradient)
    final outerPath = Path()
      ..moveTo(w * 0.50, h * 0.90)
      ..cubicTo(
        w * 0.14, h * 0.90,
        w * 0.04, h * 0.60,
        w * 0.16, h * 0.38,
      )
      ..cubicTo(
        w * 0.24, h * 0.24,
        w * 0.36 + tipShift * 0.5, h * 0.14,
        w * 0.46 + tipShift, h * 0.04,
      )
      ..cubicTo(
        w * 0.55 + tipShift * 0.6, h * 0.16,
        w * 0.62 + sideSway, h * 0.22,
        w * 0.67 + sideSway, h * 0.28,
      )
      ..cubicTo(
        w * 0.72, h * 0.22,
        w * 0.77 - sideSway, h * 0.17,
        w * 0.80 - sideSway, h * 0.16,
      )
      ..cubicTo(
        w * 0.96, h * 0.38,
        w * 0.92, h * 0.90,
        w * 0.50, h * 0.90,
      )
      ..close();

    final outerPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFF6B35),
          Color(0xFFFF453A),
          Color(0xFFE63946),
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));

    canvas.drawPath(outerPath, outerPaint);

    // Mid flame (warm bright orange)
    final midPath = Path()
      ..moveTo(w * 0.51, h * 0.88)
      ..cubicTo(
        w * 0.26, h * 0.88,
        w * 0.22, h * 0.64,
        w * 0.32, h * 0.48,
      )
      ..cubicTo(
        w * 0.38 - tipShift * 0.5, h * 0.37,
        w * 0.42 - tipShift * 0.4, h * 0.30,
        w * 0.45 - tipShift * 0.6, h * 0.26,
      )
      ..cubicTo(
        w * 0.53, h * 0.37,
        w * 0.59, h * 0.43,
        w * 0.62, h * 0.48,
      )
      ..cubicTo(
        w * 0.66, h * 0.43,
        w * 0.70, h * 0.40,
        w * 0.72, h * 0.40,
      )
      ..cubicTo(
        w * 0.80, h * 0.56,
        w * 0.76, h * 0.88,
        w * 0.51, h * 0.88,
      )
      ..close();

    final midPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFFD60A),
          Color(0xFFFF9F0A),
          Color(0xFFFF7A00),
        ],
      ).createShader(Rect.fromLTWH(0, h * 0.24, w, h * 0.66));

    canvas.drawPath(midPath, midPaint);

    // Inner bright golden core
    final corePath = Path()
      ..moveTo(w * 0.51, h * 0.85)
      ..cubicTo(
        w * 0.37, h * 0.85,
        w * 0.36, h * 0.69,
        w * 0.44 + sideSway * 0.3, h * 0.58,
      )
      ..cubicTo(
        w * 0.49, h * 0.51,
        w * 0.54, h * 0.53,
        w * 0.59 - sideSway * 0.3, h * 0.62,
      )
      ..cubicTo(
        w * 0.65, h * 0.71,
        w * 0.63, h * 0.85,
        w * 0.51, h * 0.85,
      )
      ..close();

    final corePaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFFF3B0),
          Color(0xFFFFD60A),
        ],
      ).createShader(Rect.fromLTWH(0, h * 0.50, w, h * 0.36));

    canvas.drawPath(corePath, corePaint);
  }

  @override
  bool shouldRepaint(covariant _AnimatedFlamePainter oldDelegate) =>
      oldDelegate.flicker != flicker ||
      oldDelegate.secondaryFlicker != secondaryFlicker;
}

class _EmberParticlesPainter extends CustomPainter {
  const _EmberParticlesPainter({
    required this.progress,
    required this.isBeige,
  });

  final double progress;
  final bool isBeige;

  static const _seeds = [
    (x: 0.22, yOffset: 0.05, speed: 1.0, radius: 3.2, color: Color(0xFFFFD60A)),
    (x: 0.78, yOffset: 0.30, speed: 1.0, radius: 2.8, color: Color(0xFFFF9500)),
    (x: 0.34, yOffset: 0.55, speed: 1.0, radius: 2.4, color: Color(0xFFFF5E3A)),
    (x: 0.66, yOffset: 0.75, speed: 1.0, radius: 3.5, color: Color(0xFFFFD60A)),
    (x: 0.16, yOffset: 0.42, speed: 1.0, radius: 2.2, color: Color(0xFF10B981)),
    (x: 0.84, yOffset: 0.15, speed: 1.0, radius: 2.6, color: Color(0xFFFF6B35)),
    (x: 0.45, yOffset: 0.88, speed: 1.0, radius: 2.5, color: Color(0xFFFFB703)),
    (x: 0.56, yOffset: 0.22, speed: 1.0, radius: 2.0, color: Color(0xFFFF5E3A)),
    (x: 0.28, yOffset: 0.72, speed: 1.0, radius: 3.0, color: Color(0xFFFF9500)),
    (x: 0.72, yOffset: 0.50, speed: 1.0, radius: 2.3, color: Color(0xFFFFD60A)),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    for (var i = 0; i < _seeds.length; i++) {
      final seed = _seeds[i];
      final t = (progress * seed.speed + seed.yOffset) % 1.0;
      final y = size.height * (0.62 - t * 0.54);
      final sway = math.sin((t * 2 * math.pi) + i) * 14.0;
      final x = size.width * seed.x + sway;
      final fade = math.sin(t * math.pi).clamp(0.0, 1.0);
      final alpha = fade * (isBeige ? 0.55 : 0.72);

      paint.color = seed.color.withValues(alpha: alpha);
      canvas.drawCircle(Offset(x, y), seed.radius * (0.7 + 0.4 * fade), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _EmberParticlesPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.isBeige != isBeige;
}
