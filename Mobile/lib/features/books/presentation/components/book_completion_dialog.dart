import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../app/theme.dart';
import '../../data/book.dart';
import 'book_cover.dart';

/// Écran plein écran animé célébrant la fin d'une lecture.
/// Même structure que StreakCelebrationPage et AchievementCelebrationPage,
/// avec sa propre identité littéraire (aurore émeraude/indigo, pages flottantes
/// et couverture animée en 3D).
class BookCompletionDialog extends StatefulWidget {
  const BookCompletionDialog({super.key, required this.book});

  final Book book;

  static Future<void> show(BuildContext context, Book book) {
    return Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        transitionDuration: const Duration(milliseconds: 360),
        reverseTransitionDuration: const Duration(milliseconds: 240),
        pageBuilder: (_, _, _) => BookCompletionDialog(book: book),
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
  State<BookCompletionDialog> createState() => _BookCompletionDialogState();
}

class _BookCompletionDialogState extends State<BookCompletionDialog>
    with TickerProviderStateMixin {
  late final AnimationController _introController;
  late final AnimationController _ambientController;
  late final AnimationController _haloController;

  late final Animation<double> _coverEntranceScale;
  late final Animation<double> _coverTurnY;
  late final Animation<double> _coverLift;
  late final Animation<double> _coverSurge;
  late final Animation<double> _shockwaveProgress;
  late final Animation<double> _sealPopScale;
  late final Animation<double> _textFade;
  late final Animation<double> _ctaFade;

  bool _hasBurst = false;

  static const _mint = Color(0xFF6EE7B7);
  static const _emerald = Color(0xFF10B981);
  static const _deepEmerald = Color(0xFF059669);
  static const _indigo = Color(0xFF818CF8);

  @override
  void initState() {
    super.initState();

    _introController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    );

    _ambientController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5200),
    )..repeat();

    _haloController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat();

    _coverEntranceScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.25, end: 1.08)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 66,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.08, end: 0.97)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 34,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.0, 0.44),
      ),
    );

    // Smooth single book flip into place (2*pi)
    _coverTurnY = Tween<double>(begin: -2 * math.pi, end: 0.0).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.02, 0.46, curve: Curves.easeOutCubic),
      ),
    );

    _coverLift = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 28.0, end: -10.0)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 58,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: -10.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeInOutCubic)),
        weight: 42,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.0, 0.54),
      ),
    );

    _coverSurge = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.12)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 35,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.12, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 65,
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

    _sealPopScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.24)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 45,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.24, end: 1.0)
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
      curve: const Interval(0.52, 0.82, curve: Curves.easeOut),
    );

    _ctaFade = CurvedAnimation(
      parent: _introController,
      curve: const Interval(0.70, 1.0, curve: Curves.easeOutCubic),
    );

    _introController.addListener(_onIntroTick);
    _introController.forward();
  }

  void _onIntroTick() {
    if (!_hasBurst && _introController.value >= 0.44) {
      _hasBurst = true;
      HapticFeedback.mediumImpact();
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    _introController.removeListener(_onIntroTick);
    _introController.dispose();
    _ambientController.dispose();
    _haloController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final book = widget.book;
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final bgTop = isBeige ? const Color(0xFFF9F6EE) : const Color(0xFF061114);
    final bgBottom = isBeige ? const Color(0xFFEEE8D8) : const Color(0xFF0C1524);
    final primaryText =
        isBeige ? const Color(0xFF292524) : const Color(0xFFF8FAFC);
    final secondaryText =
        isBeige ? const Color(0xFF57534E) : const Color(0xFFCBD5E1);
    final mutedText =
        isBeige ? const Color(0xFF78716C) : const Color(0xFF94A3B8);
    final accentReadable = isBeige ? _deepEmerald : _mint;

    final hasPages = (book.totalPages ?? 0) > 0;
    final hasSeries = book.series.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: bgTop,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Literary emerald & indigo aurora background
          AnimatedBuilder(
            animation: Listenable.merge([_introController, _ambientController]),
            builder: (context, _) {
              final pulse =
                  0.5 + 0.5 * math.sin(_ambientController.value * 2 * math.pi);
              final surgeGlow = (_coverSurge.value - 1.0).clamp(0.0, 0.25) * 0.5;
              final glowAlpha =
                  (isBeige ? 0.14 : 0.24) + pulse * 0.06 + surgeGlow;
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
                      center: const Alignment(0, -0.34),
                      radius: 0.90 + pulse * 0.06 + surgeGlow * 0.3,
                      colors: [
                        _emerald.withValues(alpha: glowAlpha.clamp(0.0, 0.48)),
                        _indigo.withValues(
                            alpha: (glowAlpha * 0.34).clamp(0.0, 0.24)),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.50, 1.0],
                    ),
                  ),
                ),
              );
            },
          ),

          // Fluttering translucent book pages & soft library light motes
          IgnorePointer(
            child: AnimatedBuilder(
              animation: _ambientController,
              builder: (context, _) => CustomPaint(
                painter: _FloatingPagesPainter(
                  progress: _ambientController.value,
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
                        const SizedBox(height: 8),

                        // Hero 3D Book Cover + Aurora Halo + Shockwaves + Emerald Seal
                        SizedBox(
                          width: 244,
                          height: 240,
                          child: AnimatedBuilder(
                            animation: Listenable.merge([
                              _introController,
                              _ambientController,
                              _haloController,
                            ]),
                            builder: (context, _) {
                              final wave = math.sin(
                                  _ambientController.value * 2 * math.pi);
                              final ambientBob = wave * 3.0;
                              final ambientTilt = wave * 0.022;

                              final totalScale = _coverEntranceScale.value *
                                  _coverSurge.value;
                              final liftY = _coverLift.value + ambientBob;

                              final coverMatrix = Matrix4.identity()
                                ..setEntry(3, 2, 0.0016)
                                ..rotateY(_coverTurnY.value)
                                ..rotateZ(ambientTilt);

                              final haloOpacity =
                                  (_coverEntranceScale.value * 0.65)
                                          .clamp(0.0, 1.0) *
                                      (isBeige ? 0.30 : 0.42);

                              return Stack(
                                alignment: Alignment.center,
                                children: [
                                  // Rotating delicate orbital literary rings behind the book
                                  Opacity(
                                    opacity: haloOpacity,
                                    child: Transform.rotate(
                                      angle: _haloController.value * 2 * math.pi,
                                      child: CustomPaint(
                                        size: const Size(228, 228),
                                        painter: _LiteraryHaloPainter(
                                          primaryColor: _emerald,
                                          secondaryColor: _indigo,
                                        ),
                                      ),
                                    ),
                                  ),

                                  // 3 expanding shockwave rings on completion burst
                                  if (_shockwaveProgress.value > 0 &&
                                      _shockwaveProgress.value < 1) ...[
                                    _BookShockwaveRing(
                                      progress: _shockwaveProgress.value,
                                      color: _mint,
                                      maxRadius: 108,
                                    ),
                                    _BookShockwaveRing(
                                      progress:
                                          ((_shockwaveProgress.value - 0.14) /
                                                  0.86)
                                              .clamp(0.0, 1.0),
                                      color: _emerald,
                                      maxRadius: 120,
                                    ),
                                    _BookShockwaveRing(
                                      progress:
                                          ((_shockwaveProgress.value - 0.28) /
                                                  0.72)
                                              .clamp(0.0, 1.0),
                                      color: _indigo,
                                      maxRadius: 132,
                                    ),
                                  ],

                                  // Soft radial emerald halo behind cover
                                  Container(
                                    width: 146 * _coverSurge.value,
                                    height: 186 * _coverSurge.value,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(24),
                                      boxShadow: [
                                        BoxShadow(
                                          color: _emerald.withValues(
                                            alpha: isBeige ? 0.28 : 0.40,
                                          ),
                                          blurRadius: 46,
                                          spreadRadius: 4,
                                        ),
                                        BoxShadow(
                                          color: _indigo.withValues(
                                            alpha: isBeige ? 0.14 : 0.24,
                                          ),
                                          blurRadius: 68,
                                          spreadRadius: 8,
                                        ),
                                      ],
                                    ),
                                  ),

                                  // 3D Animated Book Cover
                                  Transform.translate(
                                    offset: Offset(0, liftY),
                                    child: Transform(
                                      alignment: Alignment.center,
                                      transform: coverMatrix,
                                      child: Transform.scale(
                                        scale: totalScale,
                                        child: Container(
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(
                                                AppTheme.radiusLg),
                                            border: Border.all(
                                              color: _mint.withValues(
                                                  alpha: isBeige ? 0.5 : 0.45),
                                              width: 2,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black
                                                    .withValues(alpha: 0.42),
                                                blurRadius: 22,
                                                offset: const Offset(0, 10),
                                              ),
                                            ],
                                          ),
                                          child: BookCover(
                                            book: book,
                                            width: 132,
                                            height: 196,
                                            borderRadius: AppTheme.radiusLg - 2,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Animated Emerald "Lu" check seal on bottom-right corner of book
                                  if (_sealPopScale.value > 0.01)
                                    Positioned(
                                      right: 42,
                                      bottom: 14,
                                      child: Transform.scale(
                                        scale: _sealPopScale.value,
                                        child: Container(
                                          width: 42,
                                          height: 42,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            gradient: const LinearGradient(
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                              colors: [_mint, _emerald],
                                            ),
                                            border: Border.all(
                                              color: bgTop,
                                              width: 3,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: _emerald.withValues(
                                                    alpha: 0.55),
                                                blurRadius: 14,
                                              ),
                                            ],
                                          ),
                                          child: const Icon(
                                            Icons.check_rounded,
                                            color: Colors.white,
                                            size: 24,
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              );
                            },
                          ),
                        ),

                        const SizedBox(height: 14),

                        // Kicker label
                        FadeTransition(
                          opacity: _textFade,
                          child: ShaderMask(
                            shaderCallback: (bounds) => const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [_mint, _emerald, _indigo],
                            ).createShader(bounds),
                            child: const Text(
                              'LECTURE TERMINÉE !',
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

                        // Book Title
                        FadeTransition(
                          opacity: _textFade,
                          child: Text(
                            book.title,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 24,
                              height: 1.2,
                              fontWeight: FontWeight.w900,
                              color: primaryText,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ),

                        if (book.author.trim().isNotEmpty) ...[
                          const SizedBox(height: 6),
                          FadeTransition(
                            opacity: _textFade,
                            child: Text(
                              book.author,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: secondaryText,
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // Literary Recap Card (mirrors Streak 7-day strip & Achievements XP card)
                        FadeTransition(
                          opacity: _textFade,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: isBeige
                                  ? Colors.white.withValues(alpha: 0.65)
                                  : Colors.white.withValues(alpha: 0.05),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusXl),
                              border: Border.all(
                                color: isBeige
                                    ? _emerald.withValues(alpha: 0.22)
                                    : Colors.white.withValues(alpha: 0.09),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                _RecapPill(
                                  icon: Icons.verified_rounded,
                                  value: 'Lu',
                                  label: 'Statut',
                                  accent: accentReadable,
                                  primaryText: primaryText,
                                  mutedText: mutedText,
                                ),
                                if (hasPages) ...[
                                  _RecapDivider(isBeige: isBeige),
                                  _RecapPill(
                                    icon: Icons.menu_book_rounded,
                                    value: '${book.totalPages}',
                                    label: 'Pages',
                                    accent: accentReadable,
                                    primaryText: primaryText,
                                    mutedText: mutedText,
                                  ),
                                ],
                                if (hasSeries) ...[
                                  _RecapDivider(isBeige: isBeige),
                                  Expanded(
                                    child: _RecapPill(
                                      icon: Icons.collections_bookmark_rounded,
                                      value: book.volume != null &&
                                              book.volume! > 0
                                          ? 'Tome ${book.volume}'
                                          : book.series,
                                      label: book.volume != null &&
                                              book.volume! > 0
                                          ? book.series
                                          : 'Série',
                                      accent: _indigo,
                                      primaryText: primaryText,
                                      mutedText: mutedText,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Warm literary message
                        FadeTransition(
                          opacity: _textFade,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: Text(
                              'Un chapitre de plus qui s\'ajoute à ta bibliothèque. Prêt pour ta prochaine aventure ?',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14.5,
                                height: 1.45,
                                fontWeight: FontWeight.w500,
                                color: secondaryText,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 20),
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
                            colors: [_emerald, _deepEmerald],
                          ),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusFull),
                          boxShadow: [
                            BoxShadow(
                              color: _emerald.withValues(alpha: 0.42),
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
                            child: const Center(
                              child: Text(
                                'Génial !',
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
        ],
      ),
    );
  }
}

class _RecapPill extends StatelessWidget {
  const _RecapPill({
    required this.icon,
    required this.value,
    required this.label,
    required this.accent,
    required this.primaryText,
    required this.mutedText,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color accent;
  final Color primaryText;
  final Color mutedText;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: accent),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: primaryText,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: mutedText,
            ),
          ),
        ],
      ),
    );
  }
}

class _RecapDivider extends StatelessWidget {
  const _RecapDivider({required this.isBeige});

  final bool isBeige;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 36,
      color: isBeige
          ? const Color(0x22059669)
          : Colors.white.withValues(alpha: 0.10),
    );
  }
}

class _LiteraryHaloPainter extends CustomPainter {
  const _LiteraryHaloPainter({
    required this.primaryColor,
    required this.secondaryColor,
  });

  final Color primaryColor;
  final Color secondaryColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r1 = size.width * 0.44;
    final r2 = size.width * 0.49;

    // Fine outer orbital ring
    canvas.drawCircle(
      center,
      r1,
      Paint()
        ..color = primaryColor.withValues(alpha: 0.24)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );

    // 16 subtle radial ticks / compass marks around the halo
    for (var i = 0; i < 16; i++) {
      final a = (i * 2 * math.pi) / 16;
      final isMajor = i % 4 == 0;
      final innerR = isMajor ? r1 - 4 : r1;
      final outerR = isMajor ? r2 + 4 : r2 - 2;
      canvas.drawLine(
        Offset(center.dx + math.cos(a) * innerR,
            center.dy + math.sin(a) * innerR),
        Offset(center.dx + math.cos(a) * outerR,
            center.dy + math.sin(a) * outerR),
        Paint()
          ..color = (isMajor ? primaryColor : secondaryColor)
              .withValues(alpha: isMajor ? 0.55 : 0.30)
          ..strokeWidth = isMajor ? 2.2 : 1.3
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _LiteraryHaloPainter oldDelegate) =>
      oldDelegate.primaryColor != primaryColor ||
      oldDelegate.secondaryColor != secondaryColor;
}

class _BookShockwaveRing extends StatelessWidget {
  const _BookShockwaveRing({
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
    final radius = 44 + progress * (maxRadius - 44);
    final opacity = (1.0 - progress).clamp(0.0, 1.0) * 0.62;

    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: opacity),
          width: (3.0 * (1.0 - progress * 0.7)).clamp(0.8, 3.0),
        ),
      ),
    );
  }
}

/// Pages translucides qui voltigent doucement + poussières lumineuses de bibliothèque.
class _FloatingPagesPainter extends CustomPainter {
  const _FloatingPagesPainter({
    required this.progress,
    required this.isBeige,
  });

  final double progress;
  final bool isBeige;

  @override
  void paint(Canvas canvas, Size size) {
    final fillPaint = Paint()..style = PaintingStyle.fill;
    final strokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1;

    // 10 delicate fluttering paper sheets drifting across the screen
    for (var i = 0; i < 10; i++) {
      final seed = (i * 0.61803398875) % 1.0;
      final t = (progress + seed) % 1.0;
      final baseX = size.width * (0.06 + 0.88 * (((i * 29 + 11) % 100) / 100.0));
      final driftX = math.sin(t * 2 * math.pi + i * 1.1) * 24;
      final x = baseX + driftX;
      final y = size.height * (0.95 - t * 1.05);
      final fade = math.sin(t * math.pi).clamp(0.0, 1.0);
      final alpha = (fade * (isBeige ? 0.36 : 0.28)).clamp(0.0, 1.0);

      final tint = i % 3 == 0
          ? const Color(0xFF6EE7B7)
          : (i % 3 == 1
              ? const Color(0xFF818CF8)
              : (isBeige ? const Color(0xFF059669) : const Color(0xFFF8FAFC)));

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(math.sin(t * 4 * math.pi + i) * 0.55 + (i.isEven ? 0.3 : -0.3));
      final flutter = 0.55 + 0.45 * math.cos(t * 6 * math.pi + i).abs();
      canvas.scale(flutter, 1.0);

      // Curved open page silhouette
      final w = 9.0 + (i % 3) * 2.2;
      final h = 11.5 + (i % 2) * 2.5;
      final page = Path()
        ..moveTo(-w * 0.5, -h * 0.5)
        ..quadraticBezierTo(0, -h * 0.32, w * 0.5, -h * 0.5)
        ..lineTo(w * 0.42, h * 0.5)
        ..quadraticBezierTo(0, h * 0.34, -w * 0.42, h * 0.5)
        ..close();

      fillPaint.color = tint.withValues(alpha: alpha);
      strokePaint.color = tint.withValues(alpha: (alpha * 1.4).clamp(0.0, 1.0));
      canvas.drawPath(page, fillPaint);
      canvas.drawPath(page, strokePaint);
      canvas.restore();
    }

    // 10 soft library bokeh light motes
    for (var i = 0; i < 10; i++) {
      final seed = ((i + 5) * 0.381966) % 1.0;
      final t = (progress + seed) % 1.0;
      final x = size.width * (0.10 + 0.80 * (((i * 53 + 7) % 100) / 100.0)) +
          math.cos(t * 2 * math.pi + i) * 14;
      final y = size.height * (0.12 + 0.72 * (((i * 37 + 19) % 100) / 100.0)) +
          math.sin(t * 2 * math.pi + i) * 12;
      final pulse = 0.35 + 0.65 * math.sin(t * 2 * math.pi).abs();
      final r = 3.0 + (i % 3) * 2.2;
      final color = i.isEven ? const Color(0xFF34D399) : const Color(0xFF818CF8);

      fillPaint.color =
          color.withValues(alpha: (pulse * (isBeige ? 0.22 : 0.30)).clamp(0.0, 1.0));
      canvas.drawCircle(Offset(x, y), r, fillPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _FloatingPagesPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.isBeige != isBeige;
}
