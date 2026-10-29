import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_application_1/app/theme_provider.dart';

import '../../../core/network/api_client.dart';
import '../../auth/presentation/server_config_screen.dart';
import 'components/app_header.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(apiClientProvider);
    final themeMode = ref.watch(appThemeModeProvider);

    final displayName = (client.userName != null && client.userName!.isNotEmpty)
        ? client.userName!
        : 'Lecteur';
    final displayEmail = (client.userEmail != null && client.userEmail!.isNotEmpty)
        ? client.userEmail!
        : 'Yet Another Library • Mobile';

    return Scaffold(
      appBar: const AppHeader(
        title: 'Paramètres',
        subtitle: 'Configuration & Informations',
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Profile card matching Web client navigation footer
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: AppTheme.cardGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppTheme.primaryGradient,
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.person_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        displayEmail,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.accentPrimaryLight,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Icon(
                    Icons.verified_rounded,
                    color: AppTheme.accentPrimary,
                    size: 18,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Text(
            'Serveur & Synchronisation',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textSecondary,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.accentSecondaryLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.dns_rounded,
                        color: AppTheme.accentSecondary,
                        size: 20,
                      ),
                    ),
                  ),
                  title: Text(
                    'Serveur Backend API',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    client.hasServerConfig
                        ? 'http://${client.host}:${client.port}'
                        : 'Non configuré',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: client.isAuthenticated ? AppTheme.accentPrimaryLight : AppTheme.accentRedLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    ),
                    child: Text(
                      client.isAuthenticated ? 'Connecté' : 'Hors-ligne',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: client.isAuthenticated ? AppTheme.accentPrimary : AppTheme.accentRed,
                      ),
                    ),
                  ),
                ),
                const Divider(height: 1, indent: 64),
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.accentAmberLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.settings_ethernet_rounded,
                        color: AppTheme.accentAmber,
                        size: 20,
                      ),
                    ),
                  ),
                  title: Text(
                    'Changer de serveur',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    'Modifier l\'adresse ou le port du serveur',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                  trailing: Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.textMuted,
                  ),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (ctx) => ServerConfigScreen(
                          onConfigSaved: () {
                            Navigator.of(ctx).pop();
                          },
                        ),
                      ),
                    );
                  },
                ),
                const Divider(height: 1, indent: 64),
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.accentRedLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.logout_rounded,
                        color: AppTheme.accentRed,
                        size: 20,
                      ),
                    ),
                  ),
                  title: Text(
                    'Déconnexion',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.accentRed,
                    ),
                  ),
                  subtitle: Text(
                    'Se déconnecter de la session actuelle',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                  onTap: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (dialogCtx) => AlertDialog(
                        backgroundColor: AppTheme.bgSurface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                          side: BorderSide(color: AppTheme.borderSubtle),
                        ),
                        title: Text(
                          'Déconnexion',
                          style: TextStyle(color: AppTheme.textPrimary, fontSize: 18),
                        ),
                        content: Text(
                          'Voulez-vous vraiment vous déconnecter ?',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(dialogCtx).pop(false),
                            child: Text('Annuler', style: TextStyle(color: AppTheme.textMuted)),
                          ),
                          ElevatedButton(
                            onPressed: () => Navigator.of(dialogCtx).pop(true),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.accentRed,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Déconnexion'),
                          ),
                        ],
                      ),
                    );

                    if (confirm == true) {
                      await ref.read(apiClientProvider.notifier).logout();
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          Text(
            'Application',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textSecondary,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.accentPrimaryLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.palette_outlined,
                        color: AppTheme.accentPrimary,
                        size: 20,
                      ),
                    ),
                  ),
                  title: Text(
                    'Thème visuel',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    themeMode.displayName,
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.accentPrimaryLight,
                          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                        ),
                        child: Text(
                          themeMode == AppThemeMode.beige ? 'Beige' : 'Sombre',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.accentPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: AppTheme.textMuted,
                      ),
                    ],
                  ),
                  onTap: () => _showThemeSelector(context, ref, themeMode),
                ),
                const Divider(height: 1, indent: 64),
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0x1A94A3B8),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.info_outline_rounded,
                        color: AppTheme.textSecondary,
                        size: 20,
                      ),
                    ),
                  ),
                  title: Text(
                    'Version',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    'Yet Another Library Mobile v0.2.0 (Backend API)',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showThemeSelector(BuildContext context, WidgetRef ref, AppThemeMode currentMode) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Choisir un thème',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close_rounded, color: AppTheme.textMuted),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ...AppThemeMode.values.map((mode) {
                  final isSelected = mode == currentMode;
                  final isBeige = mode == AppThemeMode.beige;
                  final primaryColor = isBeige ? AppTheme.beigeAccentPrimary : AppTheme.darkAccentPrimary;
                  final bgColor = isBeige ? AppTheme.beigeBgPrimary : AppTheme.darkBgPrimary;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: InkWell(
                      onTap: () {
                        ref.read(appThemeModeProvider.notifier).setTheme(mode);
                        Navigator.of(ctx).pop();
                      },
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.accentPrimaryLight : AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                          border: Border.all(
                            color: isSelected ? AppTheme.accentPrimary : AppTheme.borderSubtle,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: bgColor,
                                shape: BoxShape.circle,
                                border: Border.all(color: primaryColor, width: 2),
                              ),
                              child: Center(
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    color: primaryColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    mode.displayName,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                      color: AppTheme.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    isBeige
                                        ? 'Palette claire chaude, touches marron ambré'
                                        : 'Palette sombre ardoise, touches émeraude',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              Icon(
                                Icons.check_circle_rounded,
                                color: AppTheme.accentPrimary,
                                size: 22,
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }
}
