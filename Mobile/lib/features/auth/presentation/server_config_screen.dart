import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/network/api_client.dart';

class ServerConfigScreen extends ConsumerStatefulWidget {
  const ServerConfigScreen({
    super.key,
    this.onConfigSaved,
  });

  final VoidCallback? onConfigSaved;

  @override
  ConsumerState<ServerConfigScreen> createState() => _ServerConfigScreenState();
}

class _ServerConfigScreenState extends ConsumerState<ServerConfigScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _hostController;
  late final TextEditingController _portController;

  bool _isTesting = false;
  bool _isSaving = false;
  String? _testStatus;
  bool _testSuccess = false;

  @override
  void initState() {
    super.initState();
    final client = ref.read(apiClientProvider);
    _hostController = TextEditingController(text: client.host.isNotEmpty ? client.host : 'localhost');
    _portController = TextEditingController(text: client.port.isNotEmpty ? client.port : '8080');
  }

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    final host = _hostController.text.trim();
    final port = _portController.text.trim();

    if (host.isEmpty) {
      setState(() {
        _testStatus = 'Veuillez saisir l\'adresse du serveur';
        _testSuccess = false;
      });
      return;
    }

    setState(() {
      _isTesting = true;
      _testStatus = null;
    });

    final notifier = ref.read(apiClientProvider.notifier);
    final reachable = await notifier.testConnection(host, port);

    if (!mounted) return;

    setState(() {
      _isTesting = false;
      _testSuccess = reachable;
      _testStatus = reachable
          ? 'Serveur joignable avec succès !'
          : 'Impossible de contacter le serveur à http://$host:$port';
    });
  }

  Future<void> _saveConfig() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSaving = true;
    });

    final notifier = ref.read(apiClientProvider.notifier);
    await notifier.setServerConfig(
      _hostController.text.trim(),
      _portController.text.trim(),
    );

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    widget.onConfigSaved?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgPrimary,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header logo
                    Center(
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          gradient: AppTheme.logoGradient,
                          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                          border: Border.all(
                            color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                            width: 1,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.accentPrimary.withValues(alpha: 0.25),
                              blurRadius: 20,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.dns_rounded,
                            size: 32,
                            color: AppTheme.accentPrimary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Configuration du Serveur',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.02,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Entrez l\'adresse IP ou le nom d\'hôte ainsi que le port de votre serveur backend.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Inputs container
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: AppTheme.cardGradient,
                        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                        border: Border.all(color: AppTheme.borderSubtle, width: 1),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x66000000),
                            blurRadius: 16,
                            offset: Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Hôte / Adresse IP',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _hostController,
                            keyboardType: TextInputType.url,
                            autocorrect: false,
                            textInputAction: TextInputAction.next,
                            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'ex: 192.168.1.100 ou localhost',
                              hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                              prefixIcon: const Icon(Icons.language_rounded, size: 20, color: AppTheme.textMuted),
                              filled: true,
                              fillColor: AppTheme.bgElevated,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                borderSide: const BorderSide(color: AppTheme.borderSubtle),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                borderSide: const BorderSide(color: AppTheme.borderSubtle),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                borderSide: const BorderSide(color: AppTheme.accentPrimary),
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'L\'adresse du serveur est requise';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Port',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _portController,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: '8080',
                              hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                              prefixIcon: const Icon(Icons.tag_rounded, size: 20, color: AppTheme.textMuted),
                              filled: true,
                              fillColor: AppTheme.bgElevated,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                borderSide: const BorderSide(color: AppTheme.borderSubtle),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                borderSide: const BorderSide(color: AppTheme.borderSubtle),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                borderSide: const BorderSide(color: AppTheme.accentPrimary),
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'Le port est requis';
                              }
                              final portNum = int.tryParse(val.trim());
                              if (portNum == null || portNum <= 0 || portNum > 65535) {
                                return 'Port invalide (1 - 65535)';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          // Test status badge if tested
                          if (_testStatus != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: _testSuccess ? AppTheme.accentPrimaryLight : AppTheme.accentRedLight,
                                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                                border: Border.all(
                                  color: _testSuccess
                                      ? AppTheme.accentPrimary.withValues(alpha: 0.3)
                                      : AppTheme.accentRed.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    _testSuccess ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded,
                                    size: 18,
                                    color: _testSuccess ? AppTheme.accentPrimary : AppTheme.accentRed,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _testStatus!,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                        color: _testSuccess ? AppTheme.accentPrimary : AppTheme.accentRed,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],

                          // Test button
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _isTesting ? null : _testConnection,
                              icon: _isTesting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accentPrimary),
                                    )
                                  : const Icon(Icons.network_check_rounded, size: 18),
                              label: Text(_isTesting ? 'Test en cours...' : 'Tester la connexion'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppTheme.textPrimary,
                                side: const BorderSide(color: AppTheme.borderMedium),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit button
                    ElevatedButton(
                      onPressed: _isSaving ? null : _saveConfig,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accentPrimary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Continuer vers la connexion',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                ),
                                SizedBox(width: 8),
                                Icon(Icons.arrow_forward_rounded, size: 18),
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
