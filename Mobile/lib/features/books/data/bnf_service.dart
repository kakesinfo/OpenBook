import 'dart:async';

import 'package:http/http.dart' as http;

class BnfBookResult {
  const BnfBookResult({
    required this.title,
    required this.isbn,
    this.price,
    required this.coverUrl,
  });

  final String title;
  final String isbn;
  final int? price;
  final String coverUrl;
}

class BnfService {
  BnfService({http.Client? client}) : _client = client;

  final http.Client? _client;

  static const String _bnfSruBaseUrl = 'https://catalogue.bnf.fr/api/SRU';
  static const String _bnfUserAgent = 'YetAnotherLibrary/1.0 (https://github.com/yet-another-library)';

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

  Future<BnfBookResult?> lookupByIsbn(String rawIsbn) async {
    final clean = cleanIsbn(rawIsbn);
    if (clean.length != 10 && clean.length != 13) {
      return null;
    }

    final candidates = <String>[clean];
    if (clean.length == 10) {
      final alt13 = isbn10ToIsbn13(clean);
      if (alt13 != null && !candidates.contains(alt13)) {
        candidates.add(alt13);
      }
    } else if (clean.length == 13 && clean.startsWith('978')) {
      final alt10 = isbn13ToIsbn10(clean);
      if (alt10 != null && !candidates.contains(alt10)) {
        candidates.add(alt10);
      }
    }

    final client = _client ?? http.Client();
    final shouldCloseClient = _client == null;

    try {
      for (final candidate in candidates) {
        final result = await _fetchCandidate(client, candidate, clean);
        if (result != null) {
          return result;
        }
      }
    } catch (_) {
      return null;
    } finally {
      if (shouldCloseClient) {
        client.close();
      }
    }

    return null;
  }

  Future<BnfBookResult?> _fetchCandidate(
    http.Client client,
    String candidate,
    String originalClean,
  ) async {
    try {
      final queryParam = Uri.encodeComponent('bib.isbn all "$candidate"');
      final uri = Uri.parse(
        '$_bnfSruBaseUrl?version=1.2&operation=searchRetrieve&recordSchema=unimarcxchange&maximumRecords=1&query=$queryParam',
      );

      final response = await client.get(
        uri,
        headers: const {
          'User-Agent': _bnfUserAgent,
          'Accept': 'application/xml, text/xml',
        },
      ).timeout(const Duration(seconds: 6));

      if (response.statusCode != 200 || response.body.isEmpty) {
        return null;
      }

      return parseBnfResponse(response.body, originalClean);
    } catch (_) {
      return null;
    }
  }

  static BnfBookResult? parseBnfResponse(String xmlBody, String originalClean) {
    final countMatch = RegExp(r'<(?:\w+:)?numberOfRecords>(\d+)<\/(?:\w+:)?numberOfRecords>').firstMatch(xmlBody);
    if (countMatch == null) return null;
    final count = int.tryParse(countMatch.group(1) ?? '0') ?? 0;
    if (count <= 0) return null;

    // 1. Extraire le titre
    String? title;
    final tag200Match = RegExp(r'<(?:\w+:)?datafield[^>]*tag="200"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>').firstMatch(xmlBody);
    if (tag200Match != null) {
      final fieldContent = tag200Match.group(1)!;
      final subAMatch = RegExp(r'<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>').firstMatch(fieldContent);
      if (subAMatch != null) {
        var mainTitle = _decodeXml(subAMatch.group(1)!);
        final subEMatch = RegExp(r'<(?:\w+:)?subfield[^>]*code="e"[^>]*>([^<]+)<\/(?:\w+:)?subfield>').firstMatch(fieldContent);
        if (subEMatch != null) {
          final subtitle = _decodeXml(subEMatch.group(1)!);
          if (subtitle.isNotEmpty) {
            mainTitle = '$mainTitle : $subtitle';
          }
        }
        title = mainTitle;
      }
    }

    // Fallback Dublin Core titre si le tag 200 est absent
    if (title == null || title.trim().isEmpty) {
      final dcTitleMatch = RegExp(r'<(?:\w+:)?title[^>]*>([^<]+)<\/(?:\w+:)?title>').firstMatch(xmlBody);
      if (dcTitleMatch != null) {
        var rawDc = _decodeXml(dcTitleMatch.group(1)!);
        if (rawDc.contains(' / ')) {
          rawDc = rawDc.split(' / ').first.trim();
        }
        title = rawDc;
      }
    }

    if (title == null || title.trim().isEmpty) {
      return null;
    }

    // Nettoyage de la ponctuation finale résiduelle
    title = title.replaceAll(RegExp(r'\s*[/:]\s*$'), '').trim();

    // 2. Extraire le prix
    int? price;
    final tag010Match = RegExp(r'<(?:\w+:)?datafield[^>]*tag="010"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>').firstMatch(xmlBody);
    if (tag010Match != null) {
      final fieldContent = tag010Match.group(1)!;
      final subDMatch = RegExp(r'<(?:\w+:)?subfield[^>]*code="d"[^>]*>([^<]+)<\/(?:\w+:)?subfield>').firstMatch(fieldContent);
      if (subDMatch != null) {
        final rawPrice = _decodeXml(subDMatch.group(1)!);
        final priceMatch = RegExp(r'([0-9]+(?:[.,][0-9]{1,2})?)').firstMatch(rawPrice);
        if (priceMatch != null) {
          final parsed = double.tryParse(priceMatch.group(1)!.replaceAll(',', '.'));
          if (parsed != null && parsed > 0) {
            price = parsed.round();
          }
        }
      }
    }

    // 3. Déterminer l'ISBN pour la couverture et le modèle
    final isbn13 = originalClean.length == 13 ? originalClean : (isbn10ToIsbn13(originalClean) ?? originalClean);
    final coverUrl = 'https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=$isbn13&couverture=1&taille=originale';

    return BnfBookResult(
      title: title,
      isbn: isbn13,
      price: price,
      coverUrl: coverUrl,
    );
  }

  static String _decodeXml(String text) {
    return text
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&#39;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }
}
