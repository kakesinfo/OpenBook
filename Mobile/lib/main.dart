import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences_android/shared_preferences_android.dart';

import 'app/books_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (defaultTargetPlatform == TargetPlatform.android) {
    SharedPreferencesAndroid.registerWith();
  }
  runApp(const ProviderScope(child: BooksApp()));
}

