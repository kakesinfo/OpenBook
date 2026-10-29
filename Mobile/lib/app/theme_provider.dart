import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';

class AppThemeNotifier extends Notifier<AppThemeMode> {
  static const _keyThemeMode = 'app_theme_mode';

  @override
  AppThemeMode build() {
    _loadTheme();
    return AppTheme.currentMode;
  }

  Future<void> _loadTheme() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_keyThemeMode);
      if (saved != null) {
        final mode = AppThemeMode.values.firstWhere(
          (m) => m.name == saved,
          orElse: () => AppThemeMode.dark,
        );
        AppTheme.setThemeMode(mode);
        state = mode;
      }
    } catch (_) {
      // Fallback to default
    }
  }

  Future<void> setTheme(AppThemeMode mode) async {
    AppTheme.setThemeMode(mode);
    state = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyThemeMode, mode.name);
    } catch (_) {
      // Fallback
    }
  }
}

final appThemeModeProvider = NotifierProvider<AppThemeNotifier, AppThemeMode>(
  AppThemeNotifier.new,
);
