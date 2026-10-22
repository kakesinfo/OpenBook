import 'package:flutter/material.dart';

/// Design tokens and Material 3 theme matching the Web Client (Client/src/globals.css)
class AppTheme {
  // Backgrounds
  static const Color bgPrimary = Color(0xFF0B0F17); // --bg-primary
  static const Color bgSurface = Color(0xFF131926); // --bg-surface
  static const Color bgElevated = Color(0xFF1A2234); // --bg-elevated
  static const Color bgCard = Color(0xFF161D2E); // --bg-card

  // Borders
  static const Color borderSubtle = Color(0x14FFFFFF); // rgba(255, 255, 255, 0.08)
  static const Color borderMedium = Color(0x28FFFFFF); // rgba(255, 255, 255, 0.16)
  static const Color borderFocus = Color(0x6610B981); // rgba(16, 185, 129, 0.4)

  // Accents
  static const Color accentPrimary = Color(0xFF10B981); // --accent-primary (emerald)
  static const Color accentPrimaryHover = Color(0xFF059669); // --accent-primary-hover
  static const Color accentPrimaryLight = Color(0x1F10B981); // rgba(16, 185, 129, 0.12)
  static const Color accentPrimaryGlow = Color(0x4010B981); // rgba(16, 185, 129, 0.25)

  static const Color accentSecondary = Color(0xFF6366F1); // --accent-secondary (indigo)
  static const Color accentSecondaryLight = Color(0x1F6366F1);

  static const Color accentAmber = Color(0xFFF59E0B); // --accent-amber
  static const Color accentAmberLight = Color(0x1FF59E0B);

  static const Color accentRose = Color(0xFFF43F5E); // wishlist heart rose
  static const Color accentRoseLight = Color(0x1AF43F5E); // rgba(244, 63, 94, 0.1)
  static const Color accentRoseBorder = Color(0x33F43F5E); // rgba(244, 63, 94, 0.2)

  static const Color accentRed = Color(0xFFEF4444); // red
  static const Color accentRedLight = Color(0x1FEF4444);

  // Text colors
  static const Color textPrimary = Color(0xFFF8FAFC); // --text-primary
  static const Color textSecondary = Color(0xFF94A3B8); // --text-secondary
  static const Color textMuted = Color(0xFF64748B); // --text-muted

  // Border Radii
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusFull = 9999.0;

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [accentPrimary, accentPrimaryHover],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xF2161D2E), // rgba(22, 29, 46, 0.95)
      Color(0xE60F1420), // rgba(15, 20, 32, 0.9)
    ],
  );

  static const LinearGradient coverFallbackGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF161D2E),
      Color(0xFF0E1320),
    ],
  );

  static const LinearGradient logoGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0x3310B981),
      Color(0x1A059669),
    ],
  );

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgPrimary,
      colorScheme: const ColorScheme.dark(
        primary: accentPrimary,
        primaryContainer: accentPrimaryLight,
        onPrimary: Colors.white,
        onPrimaryContainer: accentPrimary,
        secondary: accentSecondary,
        secondaryContainer: accentSecondaryLight,
        surface: bgSurface,
        surfaceContainerHighest: bgElevated,
        surfaceContainerHigh: bgCard,
        surfaceContainerLow: bgSurface,
        onSurface: textPrimary,
        onSurfaceVariant: textSecondary,
        outline: borderSubtle,
        outlineVariant: borderMedium,
        error: accentRed,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bgSurface,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.02,
        ),
      ),
      cardTheme: CardThemeData(
        color: bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: const BorderSide(color: borderSubtle, width: 1),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: bgSurface,
        elevation: 0,
        indicatorColor: accentPrimaryLight,
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              color: accentPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            );
          }
          return const TextStyle(
            color: textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: accentPrimary, size: 22);
          }
          return const IconThemeData(color: textMuted, size: 22);
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: bgSurface,
        selectedColor: accentPrimaryLight,
        labelStyle: const TextStyle(
          color: textSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        secondaryLabelStyle: const TextStyle(
          color: accentPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusFull),
          side: const BorderSide(color: borderSubtle, width: 1),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: accentPrimary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusFull),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accentPrimary,
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
          foregroundColor: textPrimary,
          side: const BorderSide(color: borderSubtle),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgPrimary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 14),
        hintStyle: const TextStyle(color: textMuted, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: accentPrimary, width: 1.5),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: bgSurface,
        modalBackgroundColor: bgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: bgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: const BorderSide(color: borderSubtle),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: borderSubtle,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: accentPrimary,
        linearTrackColor: Color(0x1FFFFFFF),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          color: textPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        headlineMedium: TextStyle(
          color: textPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        headlineSmall: TextStyle(
          color: textPrimary,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.01,
        ),
        titleLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        titleSmall: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: textPrimary),
        bodyMedium: TextStyle(color: textSecondary),
        bodySmall: TextStyle(color: textMuted),
        labelLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        labelMedium: TextStyle(color: textSecondary, fontWeight: FontWeight.w500),
        labelSmall: TextStyle(color: textMuted, fontWeight: FontWeight.w500),
      ),
    );
  }
}
