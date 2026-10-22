import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClientState {
  const ApiClientState({
    this.host = '',
    this.port = '8080',
    this.token,
    this.userEmail,
    this.userName,
    this.userAvatar,
    this.isInitialized = false,
  });

  final String host;
  final String port;
  final String? token;
  final String? userEmail;
  final String? userName;
  final String? userAvatar;
  final bool isInitialized;

  String get baseUrl {
    if (host.isEmpty) return '';
    return 'http://$host:$port';
  }

  bool get hasServerConfig => host.isNotEmpty && port.isNotEmpty;
  bool get isAuthenticated => token != null && token!.isNotEmpty;

  ApiClientState copyWith({
    String? host,
    String? port,
    String? token,
    String? userEmail,
    String? userName,
    String? userAvatar,
    bool? isInitialized,
  }) {
    return ApiClientState(
      host: host ?? this.host,
      port: port ?? this.port,
      token: token ?? this.token,
      userEmail: userEmail ?? this.userEmail,
      userName: userName ?? this.userName,
      userAvatar: userAvatar ?? this.userAvatar,
      isInitialized: isInitialized ?? this.isInitialized,
    );
  }
}

class ApiClientNotifier extends Notifier<ApiClientState> {
  static const _keyHost = 'api_server_host';
  static const _keyPort = 'api_server_port';
  static const _keyToken = 'api_auth_token';
  static const _keyUserEmail = 'api_user_email';
  static const _keyUserName = 'api_user_name';
  static const _keyUserAvatar = 'api_user_avatar';

  @override
  ApiClientState build() {
    _initFromPrefs();
    return const ApiClientState();
  }

  Future<void> _initFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final host = prefs.getString(_keyHost) ?? '';
    final port = prefs.getString(_keyPort) ?? '8080';
    final token = prefs.getString(_keyToken);
    final userEmail = prefs.getString(_keyUserEmail);
    final userName = prefs.getString(_keyUserName);
    final userAvatar = prefs.getString(_keyUserAvatar);

    state = ApiClientState(
      host: host,
      port: port,
      token: token,
      userEmail: userEmail,
      userName: userName,
      userAvatar: userAvatar,
      isInitialized: true,
    );
  }

  String get baseUrl => state.baseUrl;

  static String sanitizeHost(String input) {
    var trimmed = input.trim();
    if (trimmed.startsWith('http://')) {
      trimmed = trimmed.substring(7);
    } else if (trimmed.startsWith('https://')) {
      trimmed = trimmed.substring(8);
    }
    if (trimmed.contains('/')) {
      trimmed = trimmed.split('/').first;
    }
    if (trimmed.contains(':')) {
      trimmed = trimmed.split(':').first;
    }
    return trimmed;
  }

  static String sanitizePort(String input, {String defaultPort = '8080'}) {
    final trimmed = input.trim();
    final parsed = int.tryParse(trimmed);
    if (parsed != null && parsed > 0 && parsed <= 65535) {
      return parsed.toString();
    }
    return defaultPort;
  }

  Future<void> setServerConfig(String hostInput, String portInput) async {
    final cleanHost = sanitizeHost(hostInput);
    final cleanPort = sanitizePort(portInput);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyHost, cleanHost);
    await prefs.setString(_keyPort, cleanPort);

    state = state.copyWith(host: cleanHost, port: cleanPort);
  }

  Future<({bool reachable, String? warning})> testConnection(String hostInput, String portInput) async {
    final cleanHost = sanitizeHost(hostInput);
    final cleanPort = sanitizePort(portInput);
    if (cleanHost.isEmpty) {
      return (reachable: false, warning: 'Adresse hôte vide');
    }

    final url = Uri.parse('http://$cleanHost:$cleanPort/auth/login');
    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({}),
      ).timeout(const Duration(seconds: 4));

      if (response.statusCode == 400) {
        return (reachable: true, warning: null);
      } else if (response.statusCode == 404) {
        return (
          reachable: false,
          warning: 'Ce port ($cleanPort) ne répond pas à l\'API. Avez-vous mis le port du client web (3000) au lieu du backend (8080) ?',
        );
      }
      return (reachable: response.statusCode > 0, warning: null);
    } catch (_) {
      return (reachable: false, warning: 'Impossible de joindre le serveur à http://$cleanHost:$cleanPort');
    }
  }

  Future<({bool success, String? error})> login(String identifier, String password) async {
    if (!state.hasServerConfig) {
      return (success: false, error: 'Serveur non configuré');
    }

    final trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier.isEmpty || password.isEmpty) {
      return (success: false, error: 'Identifiant et mot de passe requis');
    }

    try {
      final url = Uri.parse('$baseUrl/auth/login');
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': trimmedIdentifier,
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = data['token'] as String?;
        if (token == null || token.isEmpty) {
          return (success: false, error: 'Jeton de session non reçu');
        }

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_keyToken, token);

        state = state.copyWith(token: token);

        // Fetch profile
        await _fetchProfile();
        return (success: true, error: null);
      }

      if (response.statusCode == 404) {
        return (
          success: false,
          error: 'Serveur introuvable ou mauvais port (utilisez le port 8080 du backend et non le port 3000 du client web).',
        );
      }

      if (response.statusCode == 400 || response.statusCode == 401) {
        return (
          success: false,
          error: 'Identifiant (email ou pseudo) ou mot de passe incorrect.',
        );
      }

      final errorBody = response.body;
      String errorMsg = 'Erreur serveur (${response.statusCode})';
      if (errorBody.isNotEmpty) {
        try {
          final parsed = jsonDecode(errorBody);
          if (parsed is Map && parsed['message'] != null) {
            errorMsg = parsed['message'].toString();
          } else if (parsed is String) {
            errorMsg = parsed;
          }
        } catch (_) {
          errorMsg = errorBody;
        }
      }

      return (success: false, error: errorMsg);
    } on SocketException catch (_) {
      return (success: false, error: 'Impossible de joindre le serveur à $baseUrl. Vérifiez l\'adresse IP/port.');
    } on TimeoutException catch (_) {
      return (success: false, error: 'Délai d\'attente dépassé lors de la connexion.');
    } catch (e) {
      return (success: false, error: 'Erreur de connexion : $e');
    }
  }

  Future<void> _fetchProfile() async {
    try {
      final response = await get('/user/profile');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final email = data['email'] as String?;
        final name = data['username'] as String?;
        final avatar = data['avatar'] as String?;

        final prefs = await SharedPreferences.getInstance();
        if (email != null) await prefs.setString(_keyUserEmail, email);
        if (name != null) await prefs.setString(_keyUserName, name);
        if (avatar != null) await prefs.setString(_keyUserAvatar, avatar);

        state = state.copyWith(
          userEmail: email,
          userName: name,
          userAvatar: avatar,
        );
      }
    } catch (_) {}
  }

  Future<void> logout() async {
    try {
      if (state.token != null && baseUrl.isNotEmpty) {
        await http.post(
          Uri.parse('$baseUrl/auth/logout'),
          headers: _buildHeaders(),
        ).timeout(const Duration(seconds: 2));
      }
    } catch (_) {}

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserEmail);
    await prefs.remove(_keyUserName);
    await prefs.remove(_keyUserAvatar);

    state = ApiClientState(
      host: state.host,
      port: state.port,
      token: null,
      userEmail: null,
      userName: null,
      userAvatar: null,
      isInitialized: true,
    );
  }

  Future<void> clearServerConfig() async {
    await logout();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyHost);
    await prefs.remove(_keyPort);

    state = const ApiClientState(isInitialized: true);
  }

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (state.token != null && state.token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer ${state.token}';
    }
    return headers;
  }

  Future<http.Response> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    final response = await http.get(url, headers: _buildHeaders());
    _checkUnauthorized(response);
    return response;
  }

  Future<http.Response> post(String path, {Object? body}) async {
    final url = Uri.parse('$baseUrl$path');
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: body != null ? jsonEncode(body) : null,
    );
    _checkUnauthorized(response);
    return response;
  }

  Future<http.Response> put(String path, {Object? body}) async {
    final url = Uri.parse('$baseUrl$path');
    final response = await http.put(
      url,
      headers: _buildHeaders(),
      body: body != null ? jsonEncode(body) : null,
    );
    _checkUnauthorized(response);
    return response;
  }

  Future<http.Response> delete(String path) async {
    final url = Uri.parse('$baseUrl$path');
    final response = await http.delete(url, headers: _buildHeaders());
    _checkUnauthorized(response);
    return response;
  }

  void _checkUnauthorized(http.Response response) {
    if (response.statusCode == 401) {
      logout();
    }
  }
}

final apiClientProvider = NotifierProvider<ApiClientNotifier, ApiClientState>(
  ApiClientNotifier.new,
);
