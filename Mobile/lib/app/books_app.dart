import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/server_config_screen.dart';
import '../features/books/presentation/components/books_shell.dart';
import 'theme.dart';
import 'theme_provider.dart';

class BooksApp extends ConsumerWidget {
  const BooksApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(appThemeModeProvider);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'OpenBook',
      theme: AppTheme.themeFor(themeMode),
      home: const _AppRootGate(),
    );
  }
}

class _AppRootGate extends ConsumerStatefulWidget {
  const _AppRootGate();

  @override
  ConsumerState<_AppRootGate> createState() => _AppRootGateState();
}

class _AppRootGateState extends ConsumerState<_AppRootGate> {
  bool _forceEditServer = false;

  @override
  Widget build(BuildContext context) {
    final client = ref.watch(apiClientProvider);

    if (!client.isInitialized) {
      return const AppLoadingScreen();
    }

    if (_forceEditServer || !client.hasServerConfig) {
      return ServerConfigScreen(
        onConfigSaved: () {
          setState(() {
            _forceEditServer = false;
          });
        },
      );
    }

    if (!client.isAuthenticated) {
      return LoginScreen(
        onChangeServer: () {
          setState(() {
            _forceEditServer = true;
          });
        },
      );
    }

    return const BooksShell();
  }
}

class AppLoadingScreen extends StatelessWidget {
  const AppLoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                gradient: AppTheme.cardGradient,
                borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                border: Border.all(color: AppTheme.borderSubtle, width: 1),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: AppTheme.logoGradient,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      border: Border.all(
                        color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.accentPrimary.withValues(alpha: 0.25),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        Icons.menu_book_rounded,
                        size: 28,
                        color: AppTheme.accentPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'OpenBook',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                          letterSpacing: -0.02,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.accentPrimary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppTheme.accentPrimary.withValues(alpha: 0.4)),
                        ),
                        child: Text(
                          'Beta',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.accentPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Connexion au serveur...',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ClipRRect(
                    borderRadius: const BorderRadius.all(Radius.circular(999)),
                    child: LinearProgressIndicator(
                      minHeight: 4,
                      backgroundColor: AppTheme.borderSubtle,
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.accentPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
