import 'dart:async';
import 'dart:convert';

import '../../../core/network/api_client.dart';

class BnfAuthor {
  const BnfAuthor({
    required this.firstname,
    required this.lastname,
    this.type = 'Writer',
  });

  factory BnfAuthor.fromJson(Map<String, dynamic> json) {
    return BnfAuthor(
      firstname: (json['firstname'] ?? '').toString(),
      lastname: (json['lastname'] ?? '').toString(),
      type: (json['type'] ?? 'Writer').toString(),
    );
  }

  final String firstname;
  final String lastname;
  final String type;

  Map<String, dynamic> toJson() => {
        'firstname': firstname,
        'lastname': lastname,
        'type': type,
      };
}

class BnfBookResult {
  const BnfBookResult({
    required this.title,
    required this.isbn,
    this.price,
    required this.coverUrl,
    this.seriesName,
    this.volume,
    this.editorName,
    this.collectionName,
    this.pageCount,
    this.releaseDate,
    this.description,
    this.docType,
    this.height,
    this.length,
    this.thickness,
    this.authors = const [],
  });

  factory BnfBookResult.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['price'];
    int? parsedPrice;
    if (rawPrice is int) {
      parsedPrice = rawPrice;
    } else if (rawPrice is num) {
      parsedPrice = rawPrice.round();
    }

    int? parseInt(dynamic raw) {
      if (raw is int) return raw;
      if (raw is num) return raw.round();
      if (raw is String) return int.tryParse(raw.trim());
      return null;
    }

    final rawAuthors = json['authors'];
    final authors = <BnfAuthor>[
      if (rawAuthors is List)
        for (final a in rawAuthors)
          if (a is Map<String, dynamic>) BnfAuthor.fromJson(a),
    ];

    return BnfBookResult(
      title: (json['title'] ?? '').toString(),
      isbn: (json['isbn'] ?? '').toString(),
      price: parsedPrice,
      coverUrl: (json['coverUrl'] ?? '').toString(),
      seriesName: json['seriesName']?.toString(),
      volume: parseInt(json['volume']),
      editorName: json['editorName']?.toString(),
      collectionName: json['collectionName']?.toString(),
      pageCount: parseInt(json['pageCount']),
      releaseDate: json['releaseDate']?.toString(),
      description: json['description']?.toString(),
      docType: json['docType']?.toString(),
      height: parseInt(json['height']),
      length: parseInt(json['length']),
      thickness: parseInt(json['thickness']),
      authors: authors,
    );
  }

  final String title;
  final String isbn;
  final int? price;
  final String coverUrl;
  final String? seriesName;
  final int? volume;
  final String? editorName;
  final String? collectionName;
  final int? pageCount;
  final String? releaseDate;
  final String? description;
  final String? docType;
  final int? height;
  final int? length;
  final int? thickness;
  final List<BnfAuthor> authors;

  /// Champs de métadonnées envoyés à `POST /books` lors d'une création rapide
  /// depuis la BnF (identiques à ceux envoyés par l'app Web).
  Map<String, dynamic> toBookFields() {
    return <String, dynamic>{
      if (seriesName != null && seriesName!.trim().isNotEmpty) 'seriesName': seriesName!.trim(),
      if (volume != null) 'volume': volume,
      if (editorName != null && editorName!.trim().isNotEmpty) 'editorName': editorName!.trim(),
      if (collectionName != null && collectionName!.trim().isNotEmpty)
        'collectionName': collectionName!.trim(),
      if (pageCount != null && pageCount! > 0) 'pageCount': pageCount,
      if (height != null && height! > 0) 'height': height,
      if (length != null && length! > 0) 'length': length,
      if (thickness != null && thickness! > 0) 'thickness': thickness,
      if (releaseDate != null && releaseDate!.trim().isNotEmpty) 'releaseDate': releaseDate!.trim(),
      if (description != null && description!.trim().isNotEmpty) 'description': description!.trim(),
      if (docType != null && docType!.trim().isNotEmpty) 'type': docType!.trim(),
      if (authors.isNotEmpty)
        'authors': authors.map((a) => a.toJson()).toList(),
    };
  }
}

class BnfService {
  BnfService({ApiClientNotifier? apiClient}) : _apiClient = apiClient;

  final ApiClientNotifier? _apiClient;

  static String cleanIsbn(String raw) {
    var cleaned = raw.trim().replaceAll(RegExp(r'[^0-9Xx]'), '');
    if (cleaned.length > 13 && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
      cleaned = cleaned.substring(0, 13);
    }
    return cleaned;
  }

  static String? isbn10ToIsbn13(String isbn10) {
    final clean = isbn10.replaceAll(RegExp(r'[^0-9Xx]'), '');
    if (clean.length != 10) return null;
    final base = '978${clean.substring(0, 9)}';
    int sum = 0;
    for (int i = 0; i < 12; i++) {
      final digit = int.tryParse(base[i]);
      if (digit == null) return null;
      sum += (i % 2 == 0) ? digit : digit * 3;
    }
    final check = (10 - (sum % 10)) % 10;
    return '$base$check';
  }

  static String? isbn13ToIsbn10(String isbn13) {
    final clean = isbn13.replaceAll(RegExp(r'[^0-9Xx]'), '');
    if (clean.length != 13 || !clean.startsWith('978')) return null;
    final base = clean.substring(3, 12);
    int sum = 0;
    for (int i = 0; i < 9; i++) {
      final digit = int.tryParse(base[i]);
      if (digit == null) return null;
      sum += digit * (10 - i);
    }
    final rem = (11 - (sum % 11)) % 11;
    final check = rem == 10 ? 'X' : rem.toString();
    return '$base$check';
  }

  Future<List<BnfBookResult>> search(String rawQuery) async {
    final trimmed = rawQuery.trim();
    if (trimmed.isEmpty || _apiClient == null) {
      return [];
    }

    try {
      final encoded = Uri.encodeQueryComponent(trimmed);
      final response = await _apiClient.get('/books/bnf/search?query=$encoded');
      if (response.statusCode != 200 || response.body.isEmpty) {
        return [];
      }

      final decoded = jsonDecode(response.body);
      if (decoded is! List) {
        return [];
      }

      return decoded
          .whereType<Map<String, dynamic>>()
          .map(BnfBookResult.fromJson)
          .where((r) => r.title.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<BnfBookResult?> lookupByIsbn(String rawIsbn) async {
    final clean = cleanIsbn(rawIsbn);
    if (clean.length != 10 && clean.length != 13) {
      return null;
    }
    final results = await search(clean);
    return results.isEmpty ? null : results.first;
  }

  Future<List<BnfBookResult>> searchByTitle(String rawTitle) {
    return search(rawTitle);
  }
}
