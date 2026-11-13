import 'package:flutter/material.dart';

enum AppThemeMode {
  dark,
  beige;

  String get displayName => switch (this) {
    AppThemeMode.dark => 'Sombre (Émeraude & Slate)',
    AppThemeMode.beige => 'Beige (Chaud & Marron)',
  };
}

/// Design tokens and Material 3 theme matching the Web Client
class AppTheme {
  static AppThemeMode _currentMode = AppThemeMode.dark;
  static AppThemeMode get currentMode => _currentMode;

  static void setThemeMode(AppThemeMode mode) {
    _currentMode = mode;
  }

  // ----------------------------------------------------
  // Raw Color Constants for Dark Theme
  // ----------------------------------------------------
  static const Color darkBgPrimary = Color(0xFF0B0F17); // --bg-primary
  static const Color darkBgSurface = Color(0xFF131926); // --bg-surface
  static const Color darkBgElevated = Color(0xFF1A2234); // --bg-elevated
  static const Color darkBgCard = Color(0xFF161D2E); // --bg-card
  static const Color darkInputBg = Color(0xFF0B0F17);

  static const Color darkBorderSubtle = Color(0x14FFFFFF); // rgba(255, 255, 255, 0.08)
  static const Color darkBorderMedium = Color(0x28FFFFFF); // rgba(255, 255, 255, 0.16)
  static const Color darkBorderFocus = Color(0x6610B981); // rgba(16, 185, 129, 0.4)

  static const Color darkAccentPrimary = Color(0xFF10B981); // --accent-primary (emerald)
  static const Color darkAccentPrimaryHover = Color(0xFF059669);
  static const Color darkAccentPrimaryLight = Color(0x1F10B981); // rgba(16, 185, 129, 0.12)
  static const Color darkAccentPrimaryGlow = Color(0x4010B981);

  static const Color darkAccentSecondary = Color(0xFF6366F1); // --accent-secondary (indigo)
  static const Color darkAccentSecondaryLight = Color(0x1F6366F1);

  static const Color darkAccentAmber = Color(0xFF10B981);
  static const Color darkAccentAmberLight = Color(0x1F10B981);

  static const Color darkAccentRose = Color(0xFFF43F5E);
  static const Color darkAccentRoseLight = Color(0x1AF43F5E);
  static const Color darkAccentRoseBorder = Color(0x33F43F5E);

  static const Color darkAccentRed = Color(0xFFEF4444);
  static const Color darkAccentRedLight = Color(0x1FEF4444);

  static const Color darkTextPrimary = Color(0xFFF8FAFC);
  static const Color darkTextSecondary = Color(0xFF94A3B8);
  static const Color darkTextMuted = Color(0xFF64748B);

  static const Color darkBadgeVolumeBg = Color(0xE60F172A);
  static const Color darkBadgeVolumeBorder = Color(0x33FFFFFF);
  static const Color darkBadgeVolumeText = Color(0xFFF8FAFC);

  // ----------------------------------------------------
  // Raw Color Constants for Beige Theme
  // ----------------------------------------------------
  static const Color beigeBgPrimary = Color(0xFFF6F1EB); // #f6f1eb
  static const Color beigeBgSurface = Color(0xFFEBE3D5); // #ebe3d5
  static const Color beigeBgElevated = Color(0xFFDFD5C4); // #dfd5c4
  static const Color beigeBgCard = Color(0xFFF5F0E8); // rgba(245, 240, 232, 0.9)
  static const Color beigeInputBg = Color(0xFFFFFFFF); // crisp white inputs

  static const Color beigeBorderSubtle = Color(0x3D785F46); // rgba(120, 95, 70, 0.24)
  static const Color beigeBorderMedium = Color(0x59785F46); // rgba(120, 95, 70, 0.35)
  static const Color beigeBorderFocus = Color(0x80B46E2D); // rgba(180, 110, 45, 0.5)

  static const Color beigeAccentPrimary = Color(0xFFB45309); // #b45309 (warm brown)
  static const Color beigeAccentPrimaryHover = Color(0xFF92400E);
  static const Color beigeAccentPrimaryLight = Color(0x1FB45309); // rgba(180, 83, 9, 0.12)
  static const Color beigeAccentPrimaryGlow = Color(0x38B45309);

  static const Color beigeAccentSecondary = Color(0xFF78716C);
  static const Color beigeAccentSecondaryLight = Color(0x2478716C);

  static const Color beigeAccentAmber = Color(0xFFA16207); // deep warm amber for sales
  static const Color beigeAccentAmberLight = Color(0x24A16207);

  static const Color beigeAccentRose = Color(0xFFE11D48); // rose-600
  static const Color beigeAccentRoseLight = Color(0x1FE11D48);
  static const Color beigeAccentRoseBorder = Color(0x3DE11D48);

  static const Color beigeAccentRed = Color(0xFFDC2626); // red-600
  static const Color beigeAccentRedLight = Color(0x1FDC2626);

  static const Color beigeTextPrimary = Color(0xFF292524); // #292524
  static const Color beigeTextSecondary = Color(0xFF57534E); // #57534e
  static const Color beigeTextMuted = Color(0xFF736C64); // #736c64

  static const Color beigeBadgeVolumeBg = Color(0xF2F5F0E8); // #f5f0e8 with 95% opacity
  static const Color beigeBadgeVolumeBorder = Color(0x4DB45309);
  static const Color beigeBadgeVolumeText = Color(0xFF92400E);

  // ----------------------------------------------------
  // Dynamic Getters adapting to active theme
  // ----------------------------------------------------
  static Color get bgPrimary => _currentMode == AppThemeMode.beige ? beigeBgPrimary : darkBgPrimary;
  static Color get bgSurface => _currentMode == AppThemeMode.beige ? beigeBgSurface : darkBgSurface;
  static Color get bgElevated => _currentMode == AppThemeMode.beige ? beigeBgElevated : darkBgElevated;
  static Color get bgCard => _currentMode == AppThemeMode.beige ? beigeBgCard : darkBgCard;
  static Color get inputBg => _currentMode == AppThemeMode.beige ? beigeInputBg : darkInputBg;

  static Color get borderSubtle => _currentMode == AppThemeMode.beige ? beigeBorderSubtle : darkBorderSubtle;
  static Color get borderMedium => _currentMode == AppThemeMode.beige ? beigeBorderMedium : darkBorderMedium;
  static Color get borderFocus => _currentMode == AppThemeMode.beige ? beigeBorderFocus : darkBorderFocus;

  static Color get accentPrimary => _currentMode == AppThemeMode.beige ? beigeAccentPrimary : darkAccentPrimary;
  static Color get accentPrimaryHover => _currentMode == AppThemeMode.beige ? beigeAccentPrimaryHover : darkAccentPrimaryHover;
  static Color get accentPrimaryLight => _currentMode == AppThemeMode.beige ? beigeAccentPrimaryLight : darkAccentPrimaryLight;
  static Color get accentPrimaryGlow => _currentMode == AppThemeMode.beige ? beigeAccentPrimaryGlow : darkAccentPrimaryGlow;

  static Color get accentSecondary => _currentMode == AppThemeMode.beige ? beigeAccentSecondary : darkAccentSecondary;
  static Color get accentSecondaryLight => _currentMode == AppThemeMode.beige ? beigeAccentSecondaryLight : darkAccentSecondaryLight;

  static Color get accentAmber => _currentMode == AppThemeMode.beige ? beigeAccentAmber : darkAccentAmber;
  static Color get accentAmberLight => _currentMode == AppThemeMode.beige ? beigeAccentAmberLight : darkAccentAmberLight;

  static Color get accentRose => _currentMode == AppThemeMode.beige ? beigeAccentRose : darkAccentRose;
  static Color get accentRoseLight => _currentMode == AppThemeMode.beige ? beigeAccentRoseLight : darkAccentRoseLight;
  static Color get accentRoseBorder => _currentMode == AppThemeMode.beige ? beigeAccentRoseBorder : darkAccentRoseBorder;

  static Color get accentRed => _currentMode == AppThemeMode.beige ? beigeAccentRed : darkAccentRed;
  static Color get accentRedLight => _currentMode == AppThemeMode.beige ? beigeAccentRedLight : darkAccentRedLight;

  static Color get textPrimary => _currentMode == AppThemeMode.beige ? beigeTextPrimary : darkTextPrimary;
  static Color get textSecondary => _currentMode == AppThemeMode.beige ? beigeTextSecondary : darkTextSecondary;
  static Color get textMuted => _currentMode == AppThemeMode.beige ? beigeTextMuted : darkTextMuted;

  static Color get badgeVolumeBg => _currentMode == AppThemeMode.beige ? beigeBadgeVolumeBg : darkBadgeVolumeBg;
  static Color get badgeVolumeBorder => _currentMode == AppThemeMode.beige ? beigeBadgeVolumeBorder : darkBadgeVolumeBorder;
  static Color get badgeVolumeText => _currentMode == AppThemeMode.beige ? beigeBadgeVolumeText : darkBadgeVolumeText;

  // Border Radii
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusXl = 20.0;
  static const double radiusFull = 9999.0;

  // Box Shadows (adapted to dark/beige)
  static List<BoxShadow> get cardShadow => _currentMode == AppThemeMode.beige
      ? [
          BoxShadow(
            color: const Color(0xFF46321E).withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ]
      : [
          const BoxShadow(
            color: Color(0x66000000),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ];

  static List<BoxShadow> get modalShadow => _currentMode == AppThemeMode.beige
      ? [
          BoxShadow(
            color: const Color(0xFF46321E).withValues(alpha: 0.16),
            blurRadius: 28,
            offset: const Offset(0, 8),
          ),
        ]
      : [
          const BoxShadow(
            color: Color(0x80000000),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ];

  static List<BoxShadow> get glowShadow => [
        BoxShadow(
          color: accentPrimaryGlow,
          blurRadius: 18,
          offset: const Offset(0, 4),
        ),
      ];

  // Gradients
  static LinearGradient get primaryGradient => _currentMode == AppThemeMode.beige
      ? const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [beigeAccentPrimary, beigeAccentPrimaryHover],
        )
      : const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [darkAccentPrimary, darkAccentPrimaryHover],
        );

  static LinearGradient get cardGradient => _currentMode == AppThemeMode.beige
      ? const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFBF8F4),
            Color(0xFFF3ECE0),
          ],
        )
      : const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xF2161D2E),
            Color(0xE60F1420),
          ],
        );

  static LinearGradient get coverFallbackGradient => _currentMode == AppThemeMode.beige
      ? const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFEBE3D5),
            Color(0xFFDFD5C4),
          ],
        )
      : const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF161D2E),
            Color(0xFF0E1320),
          ],
        );

  static LinearGradient get logoGradient => _currentMode == AppThemeMode.beige
      ? const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0x33B45309),
            Color(0x1AB45309),
          ],
        )
      : const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0x3310B981),
            Color(0x1A059669),
          ],
        );

  static ThemeData themeFor(AppThemeMode mode) => switch (mode) {
    AppThemeMode.dark => darkTheme,
    AppThemeMode.beige => beigeTheme,
  };

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkBgPrimary,
      colorScheme: const ColorScheme.dark(
        primary: darkAccentPrimary,
        primaryContainer: darkAccentPrimaryLight,
        onPrimary: Colors.white,
        onPrimaryContainer: darkAccentPrimary,
        secondary: darkAccentSecondary,
        secondaryContainer: darkAccentSecondaryLight,
        surface: darkBgSurface,
        surfaceContainerHighest: darkBgElevated,
        surfaceContainerHigh: darkBgCard,
        surfaceContainerLow: darkBgSurface,
        onSurface: darkTextPrimary,
        onSurfaceVariant: darkTextSecondary,
        outline: darkBorderSubtle,
        outlineVariant: darkBorderMedium,
        error: darkAccentRed,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: darkBgSurface,
        foregroundColor: darkTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: darkTextPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.02,
        ),
      ),
      cardTheme: CardThemeData(
        color: darkBgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: const BorderSide(color: darkBorderSubtle, width: 1),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: darkBgSurface,
        elevation: 0,
        indicatorColor: darkAccentPrimaryLight,
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              color: darkAccentPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            );
          }
          return const TextStyle(
            color: darkTextMuted,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: darkAccentPrimary, size: 22);
          }
          return const IconThemeData(color: darkTextMuted, size: 22);
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: darkBgSurface,
        selectedColor: darkAccentPrimaryLight,
        labelStyle: const TextStyle(
          color: darkTextSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        secondaryLabelStyle: const TextStyle(
          color: darkAccentPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusFull),
          side: const BorderSide(color: darkBorderSubtle, width: 1),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: darkAccentPrimary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusFull),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: darkAccentPrimary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusFull),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: darkTextPrimary,
          side: const BorderSide(color: darkBorderSubtle),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: darkInputBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: const TextStyle(color: darkTextSecondary, fontSize: 14),
        hintStyle: const TextStyle(color: darkTextMuted, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkBorderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkBorderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkAccentPrimary, width: 1.5),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: darkBgSurface,
        modalBackgroundColor: darkBgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: darkBgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: const BorderSide(color: darkBorderSubtle),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: darkBorderSubtle,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: darkAccentPrimary,
        linearTrackColor: Color(0x1FFFFFFF),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          color: darkTextPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        headlineMedium: TextStyle(
          color: darkTextPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        headlineSmall: TextStyle(
          color: darkTextPrimary,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.01,
        ),
        titleLarge: TextStyle(color: darkTextPrimary, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: darkTextPrimary, fontWeight: FontWeight.w600),
        titleSmall: TextStyle(color: darkTextPrimary, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: darkTextPrimary),
        bodyMedium: TextStyle(color: darkTextSecondary),
        bodySmall: TextStyle(color: darkTextMuted),
        labelLarge: TextStyle(color: darkTextPrimary, fontWeight: FontWeight.w600),
        labelMedium: TextStyle(color: darkTextSecondary, fontWeight: FontWeight.w500),
        labelSmall: TextStyle(color: darkTextMuted, fontWeight: FontWeight.w500),
      ),
    );
  }

  static ThemeData get beigeTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: beigeBgPrimary,
      colorScheme: const ColorScheme.light(
        primary: beigeAccentPrimary,
        primaryContainer: beigeAccentPrimaryLight,
        onPrimary: Colors.white,
        onPrimaryContainer: beigeAccentPrimary,
        secondary: beigeAccentSecondary,
        secondaryContainer: beigeAccentSecondaryLight,
        surface: beigeBgSurface,
        surfaceContainerHighest: beigeBgElevated,
        surfaceContainerHigh: beigeBgCard,
        surfaceContainerLow: beigeBgSurface,
        onSurface: beigeTextPrimary,
        onSurfaceVariant: beigeTextSecondary,
        outline: beigeBorderSubtle,
        outlineVariant: beigeBorderMedium,
        error: beigeAccentRed,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: beigeBgSurface,
        foregroundColor: beigeTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: beigeTextPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.02,
        ),
      ),
      cardTheme: CardThemeData(
        color: beigeBgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: const BorderSide(color: beigeBorderSubtle, width: 1),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: beigeBgSurface,
        elevation: 0,
        indicatorColor: beigeAccentPrimaryLight,
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              color: beigeAccentPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            );
          }
          return const TextStyle(
            color: beigeTextMuted,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: beigeAccentPrimary, size: 22);
          }
          return const IconThemeData(color: beigeTextMuted, size: 22);
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: beigeBgSurface,
        selectedColor: beigeAccentPrimaryLight,
        labelStyle: const TextStyle(
          color: beigeTextSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        secondaryLabelStyle: const TextStyle(
          color: beigeAccentPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusFull),
          side: const BorderSide(color: beigeBorderSubtle, width: 1),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: beigeAccentPrimary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusFull),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: beigeAccentPrimary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusFull),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: beigeTextPrimary,
          side: const BorderSide(color: beigeBorderSubtle),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: beigeInputBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: const TextStyle(color: beigeTextSecondary, fontSize: 14),
        hintStyle: const TextStyle(color: beigeTextMuted, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: beigeBorderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: beigeBorderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: beigeAccentPrimary, width: 1.5),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: beigeBgSurface,
        modalBackgroundColor: beigeBgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: beigeBgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: const BorderSide(color: beigeBorderSubtle),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: beigeBorderSubtle,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: beigeAccentPrimary,
        linearTrackColor: Color(0x19785F46),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          color: beigeTextPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        headlineMedium: TextStyle(
          color: beigeTextPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        headlineSmall: TextStyle(
          color: beigeTextPrimary,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.01,
        ),
        titleLarge: TextStyle(color: beigeTextPrimary, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: beigeTextPrimary, fontWeight: FontWeight.w600),
        titleSmall: TextStyle(color: beigeTextPrimary, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: beigeTextPrimary),
        bodyMedium: TextStyle(color: beigeTextSecondary),
        bodySmall: TextStyle(color: beigeTextMuted),
        labelLarge: TextStyle(color: beigeTextPrimary, fontWeight: FontWeight.w600),
        labelMedium: TextStyle(color: beigeTextSecondary, fontWeight: FontWeight.w500),
        labelSmall: TextStyle(color: beigeTextMuted, fontWeight: FontWeight.w500),
      ),
    );
  }
}
