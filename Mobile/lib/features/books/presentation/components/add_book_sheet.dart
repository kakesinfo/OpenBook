import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../app/theme.dart';
import '../../application/books_providers.dart';
import '../../data/bnf_service.dart';
import '../../data/book.dart';
import 'book_cover.dart';
import 'quick_create_book_sheet.dart';

enum AddBookMode { scan, search }

Future<void> showAddBookSheet(
  BuildContext context, {
  BookStatus? initialStatus,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppTheme.bgSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) {
      return _AddBookSheet(initialStatus: initialStatus);
    },
  );
}

class _AddBookSheet extends ConsumerStatefulWidget {
  const _AddBookSheet({this.initialStatus});

  final BookStatus? initialStatus;

  @override
  ConsumerState<_AddBookSheet> createState() => _AddBookSheetState();
}

class _AddBookSheetState extends ConsumerState<_AddBookSheet> {
  AddBookMode _mode = AddBookMode.scan;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  Timer? _debounceTimer;
  int _searchRequestId = 0;

  bool _isSearching = false;
  String? _searchError;
  List<Book> _searchResults = [];
  List<BnfBookResult> _bnfResults = [];

  // Scanner state
  late final MobileScannerController _scannerController;
  bool _isProcessingScan = false;
  String? _scannedCode;
  Book? _scannedBook;
  bool _scanNotFound = false;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
    );
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    final requestId = ++_searchRequestId;
    final trimmed = query.trim();

    if (trimmed.isEmpty) {
      setState(() {
        _isSearching = false;
        _searchResults = [];
        _bnfResults = [];
        _searchError = null;
      });
      return;
    }

    setState(() {
      _isSearching = true;
      _searchError = null;
    });

    _debounceTimer = Timer(const Duration(milliseconds: 300), () async {
      _executeSearch(trimmed, requestId);
    });
  }

  bool _isIsbn(String raw) {
    final clean = _cleanBarcode(raw);
    return RegExp(r'^[0-9Xx\-]+$').hasMatch(raw.trim()) &&
        (clean.length == 10 || clean.length == 13);
  }

  Future<void> _executeSearch(String trimmed, int requestId) async {
    if (requestId != _searchRequestId) return;

    setState(() {
      _isSearching = true;
      _searchError = null;
      _searchResults = [];
      _bnfResults = [];
    });

    try {
      final repo = ref.read(booksRepositoryProvider);
      final bnfService = ref.read(bnfServiceProvider);

      final dbFuture = repo.searchBooks(trimmed);
      final bnfFuture = bnfService.search(trimmed);

      final results = await dbFuture;
      final bnfs = await bnfFuture;
      if (!mounted || requestId != _searchRequestId) return;

      if (results.isEmpty && _isIsbn(trimmed) && bnfs.isNotEmpty) {
        final bnf = bnfs.first;
        setState(() {
          _isSearching = false;
        });
        await _openQuickCreate(
          initialTitle: bnf.title,
          initialIsbn: bnf.isbn.isNotEmpty ? bnf.isbn : null,
          initialPrice: bnf.price,
          initialCoverUrl: bnf.coverUrl.isNotEmpty ? bnf.coverUrl : null,
          initialBnf: bnf,
        );
        return;
      }

      final dbIsbns = results
          .map((b) => (b.isbn ?? '').replaceAll(RegExp(r'[^0-9Xx]'), '').toUpperCase())
          .where((s) => s.isNotEmpty)
          .toSet();
      final filteredBnfs = bnfs.where((bnf) {
        final clean = bnf.isbn.replaceAll(RegExp(r'[^0-9Xx]'), '').toUpperCase();
        return clean.isEmpty || !dbIsbns.contains(clean);
      }).toList();

      setState(() {
        _searchResults = results;
        _bnfResults = filteredBnfs;
        _isSearching = false;
      });
    } catch (e) {
      if (mounted && requestId == _searchRequestId) {
        setState(() {
          _searchError = 'Erreur lors de la recherche : $e';
          _bnfResults = [];
          _isSearching = false;
        });
      }
    }
  }

  String _cleanBarcode(String raw) {
    var cleaned = raw.trim().replaceAll(RegExp(r'[^0-9Xx]'), '');
    // If barcode includes an EAN-5 addon (e.g. 18 digits) starting with 978 or 979
    if (cleaned.length > 13 && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
      cleaned = cleaned.substring(0, 13);
    }
    return cleaned.isNotEmpty ? cleaned : raw.trim();
  }

  Future<void> _onBarcodeDetected(BarcodeCapture capture) async {
    if (_isProcessingScan) return;

    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue?.trim();
      if (raw != null && raw.isNotEmpty) {
        final code = _cleanBarcode(raw);
        setState(() {
          _isProcessingScan = true;
          _scannedCode = code;
          _scannedBook = null;
          _scanNotFound = false;
        });

        try {
          final repo = ref.read(booksRepositoryProvider);
          var results = await repo.searchBooks(code);
          if (results.isEmpty && code != raw) {
            results = await repo.searchBooks(raw);
          }
          if (!mounted) return;

          if (results.isNotEmpty) {
            setState(() {
              _scannedBook = results.first;
              _scanNotFound = false;
            });
          } else {
            // S'il n'existe pas en BDD, rechercher sur la BNF
            final bnf = await ref.read(bnfServiceProvider).lookupByIsbn(code);
            if (!mounted) return;

            if (bnf != null) {
              // S'il existe sur la BNF, ouvrir le menu de création rapide pré-rempli
              await _openQuickCreate(
                initialTitle: bnf.title,
                initialIsbn: bnf.isbn,
                initialPrice: bnf.price,
                initialCoverUrl: bnf.coverUrl,
                initialBnf: bnf,
              );
              return;
            } else {
              // Sinon comme d'habitude affiche introuvable
              setState(() {
                _scannedBook = null;
                _scanNotFound = true;
              });
            }
          }
        } catch (e) {
          if (!mounted) return;
          setState(() {
            _scannedBook = null;
            _scanNotFound = true;
          });
        }
        break;
      }
    }
  }

  void _resumeScanning() {
    setState(() {
      _isProcessingScan = false;
      _scannedCode = null;
      _scannedBook = null;
      _scanNotFound = false;
    });
  }

  Future<void> _openQuickCreate({
    String? initialTitle,
    String? initialIsbn,
    int? initialPrice,
    String? initialCoverUrl,
    BnfBookResult? initialBnf,
  }) async {
    Navigator.of(context).pop();
    await showQuickCreateBookSheet(
      context,
      initialTitle: initialTitle,
      initialIsbn: initialIsbn,
      initialPrice: initialPrice,
      initialCoverUrl: initialCoverUrl,
      initialStatus: widget.initialStatus,
      initialBnf: initialBnf,
    );
  }

  Future<void> _addBookToUser(Book book, BookStatus status) async {
    final bookId = book.id;
    if (bookId == null) return;

    try {
      await ref.read(booksControllerProvider.notifier).addBook(bookId, status: status);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentPrimary,
            content: Text(
              status == BookStatus.wishlist
                  ? '« ${book.title} » ajouté aux souhaits !'
                  : '« ${book.title} » ajouté à votre collection !',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentRed,
            content: Text('Impossible d\'ajouter le livre : $e'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isWishlistContext = widget.initialStatus == BookStatus.wishlist;
    final sheetTitle = isWishlistContext ? 'Ajouter un souhait' : 'Ajouter un livre';
    final userBooks = ref.watch(booksControllerProvider).value ?? [];

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.borderSubtle,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppTheme.accentPrimaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isWishlistContext ? Icons.favorite_outline_rounded : Icons.menu_book_rounded,
                    color: isWishlistContext ? AppTheme.accentRose : AppTheme.accentPrimary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    sheetTitle,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: AppTheme.textMuted),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          // Mode Selector (Recherche / Scanner)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppTheme.bgCard,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: AppTheme.borderSubtle, width: 1),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _ModeTabButton(
                      title: 'Scanner code-barres',
                      icon: Icons.qr_code_scanner_rounded,
                      isSelected: _mode == AddBookMode.scan,
                      onTap: () {
                        setState(() {
                          _mode = AddBookMode.scan;
                          _resumeScanning();
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _ModeTabButton(
                      title: 'Recherche',
                      icon: Icons.search_rounded,
                      isSelected: _mode == AddBookMode.search,
                      onTap: () {
                        setState(() {
                          _mode = AddBookMode.search;
                        });
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),

          // Content body
          Expanded(
            child: _mode == AddBookMode.search
                ? _buildSearchBody(userBooks, isWishlistContext)
                : _buildScanBody(userBooks, isWishlistContext),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBody(List<Book> userBooks, bool isWishlistContext) {
    return Column(
      children: [
        // Search Input Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.bgElevated,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              onChanged: _onSearchChanged,
              onSubmitted: (query) {
                final trimmed = query.trim();
                if (trimmed.isNotEmpty) {
                  _debounceTimer?.cancel();
                  final requestId = ++_searchRequestId;
                  _executeSearch(trimmed, requestId);
                }
              },
              style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Rechercher par titre, ISBN, auteur...',
                hintStyle: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                prefixIcon: Icon(Icons.search_rounded, color: AppTheme.accentPrimary, size: 22),
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_searchController.text.isNotEmpty)
                      IconButton(
                        icon: Icon(Icons.clear_rounded, color: AppTheme.textMuted, size: 20),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged('');
                        },
                      ),
                    IconButton(
                      icon: Icon(Icons.qr_code_scanner_rounded, color: AppTheme.accentPrimary, size: 22),
                      tooltip: 'Scanner un code-barres',
                      onPressed: () {
                        setState(() {
                          _mode = AddBookMode.scan;
                          _resumeScanning();
                        });
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Results or Status
        Expanded(
          child: _isSearching
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(color: AppTheme.accentPrimary),
                      SizedBox(height: 16),
                      Text(
                        'Recherche en cours...',
                        style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                      ),
                    ],
                  ),
                )
              : _searchError != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          _searchError!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.accentRed, fontSize: 14),
                        ),
                      ),
                    )
                  : _searchController.text.trim().isNotEmpty && _searchResults.isEmpty && _bnfResults.isEmpty
                      ? Center(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.search_off_rounded, color: AppTheme.textMuted, size: 48),
                                const SizedBox(height: 12),
                                Text(
                                  'Aucun livre trouvé pour « ${_searchController.text.trim()} »',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 15),
                                ),
                                const SizedBox(height: 20),
                                // Bouton principal Création Rapide
                                FilledButton.icon(
                                  style: FilledButton.styleFrom(
                                    backgroundColor: AppTheme.accentPrimary,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                    ),
                                  ),
                                  onPressed: () {
                                    final q = _searchController.text.trim();
                                    final isIsbn = RegExp(r'^[0-9Xx\-]+$').hasMatch(q) &&
                                        q.replaceAll(RegExp(r'[^0-9Xx]'), '').length >= 10;
                                    _openQuickCreate(
                                      initialTitle: isIsbn ? null : q,
                                      initialIsbn: isIsbn ? _cleanBarcode(q) : null,
                                    );
                                  },
                                  icon: const Icon(Icons.bolt_rounded, size: 20),
                                  label: const Text(
                                    'Créer ce livre (Création rapide)',
                                    style: TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.textSecondary,
                                    side: BorderSide(color: AppTheme.borderSubtle),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                    ),
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _mode = AddBookMode.scan;
                                      _resumeScanning();
                                    });
                                  },
                                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                                  label: const Text('Scanner le code-barres'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : _searchController.text.trim().isEmpty
                          ? _buildSearchEmptyPlaceholder()
                          : Builder(
                              builder: (context) {
                                final merged = <({Book? dbBook, BnfBookResult? bnf, DateTime? releaseDate})>[
                                  ..._searchResults.map(
                                    (b) => (
                                      dbBook: b,
                                      bnf: null,
                                      releaseDate: b.releaseDate != null ? DateTime.tryParse(b.releaseDate!) : null,
                                    ),
                                  ),
                                  ..._bnfResults.map(
                                    (bnf) => (
                                      dbBook: null,
                                      bnf: bnf,
                                      releaseDate: bnf.releaseDate != null ? DateTime.tryParse(bnf.releaseDate!) : null,
                                    ),
                                  ),
                                ]..sort((a, b) {
                                    if (a.releaseDate == null && b.releaseDate == null) return 0;
                                    if (a.releaseDate == null) return 1;
                                    if (b.releaseDate == null) return -1;
                                    return b.releaseDate!.compareTo(a.releaseDate!);
                                  });

                                return ListView.separated(
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                                  itemCount: merged.length,
                                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                                  itemBuilder: (context, index) {
                                    final entry = merged[index];
                                    if (entry.dbBook != null) {
                                      final book = entry.dbBook!;
                                      final existing = userBooks.where((b) => b.id == book.id).firstOrNull;

                                      return _BookResultTile(
                                        book: book,
                                        existingBook: existing,
                                        isWishlistContext: isWishlistContext,
                                        onAdd: (status) => _addBookToUser(book, status),
                                      );
                                    }

                                    return _buildBnfCard(entry.bnf!);
                                  },
                                );
                              },
                            ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
          decoration: BoxDecoration(
            color: AppTheme.bgSurface,
            border: Border(top: BorderSide(color: AppTheme.borderSubtle, width: 1)),
          ),
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.accentPrimary,
              side: BorderSide(color: AppTheme.accentPrimary.withValues(alpha: 0.4)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              ),
            ),
            onPressed: () {
              final q = _searchController.text.trim();
              final isIsbn = q.isNotEmpty &&
                  RegExp(r'^[0-9Xx\-]+$').hasMatch(q) &&
                  q.replaceAll(RegExp(r'[^0-9Xx]'), '').length >= 10;
              _openQuickCreate(
                initialTitle: q.isEmpty || isIsbn ? null : q,
                initialIsbn: isIsbn ? _cleanBarcode(q) : null,
              );
            },
            icon: const Icon(Icons.edit_note_rounded, size: 20),
            label: const Text(
              'Créer un livre manquant',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBnfCard(BnfBookResult bnf) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgElevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: AppTheme.accentPrimary.withValues(alpha: 0.4),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.account_balance_rounded, size: 16, color: AppTheme.accentPrimary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Trouvé dans la BnF',
                  style: TextStyle(
                    color: AppTheme.accentPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (bnf.isbn.isNotEmpty)
                Text(
                  'ISBN ${bnf.isbn}',
                  style: TextStyle(
                    color: AppTheme.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (bnf.coverUrl.isNotEmpty) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    bnf.coverUrl,
                    width: 56,
                    height: 80,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      width: 56,
                      height: 80,
                      color: AppTheme.bgSurface,
                      child: Icon(Icons.book_rounded, color: AppTheme.textMuted),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bnf.title,
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (bnf.price != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        '${bnf.price} €',
                        style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.accentPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                ),
              ),
              onPressed: () {
                _openQuickCreate(
                  initialTitle: bnf.title,
                  initialIsbn: bnf.isbn.isNotEmpty ? bnf.isbn : null,
                  initialPrice: bnf.price,
                  initialCoverUrl: bnf.coverUrl.isNotEmpty ? bnf.coverUrl : null,
                  initialBnf: bnf,
                );
              },
              icon: const Icon(Icons.add_rounded, size: 20),
              label: const Text(
                'Créer avec la BnF',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickCreateFooterTile(String query) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.bgElevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppTheme.accentPrimaryLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.bolt_rounded, color: AppTheme.accentPrimary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Livre manquant dans le catalogue ?',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Ajoutez-le directement avec la création rapide',
                  style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.accentPrimary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () {
              final isIsbn = RegExp(r'^[0-9Xx\-]+$').hasMatch(query) &&
                  query.replaceAll(RegExp(r'[^0-9Xx]'), '').length >= 10;
              _openQuickCreate(
                initialTitle: isIsbn ? null : query,
                initialIsbn: isIsbn ? _cleanBarcode(query) : null,
              );
            },
            child: const Text('Créer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchEmptyPlaceholder() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppTheme.cardGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.auto_stories_rounded,
                  color: AppTheme.accentPrimary,
                  size: 42,
                ),
                const SizedBox(height: 12),
                Text(
                  'Recherche dans le catalogue',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tapez le titre d\'un livre, le nom d\'un auteur ou un numéro ISBN ci-dessus.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppTheme.textMuted,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 18),
                // Bouton Création rapide direct
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.accentPrimary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  ),
                  onPressed: () => _openQuickCreate(),
                  icon: const Icon(Icons.bolt_rounded, size: 18),
                  label: const Text('Création rapide d\'un livre manquant'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textPrimary,
                    side: BorderSide(color: AppTheme.borderSubtle),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  ),
                  onPressed: () {
                    setState(() {
                      _mode = AddBookMode.scan;
                      _resumeScanning();
                    });
                  },
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                  label: const Text('Scanner le code-barres'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScanBody(List<Book> userBooks, bool isWishlistContext) {
    if (_isProcessingScan && _scannedBook != null) {
      final book = _scannedBook!;
      final existing = userBooks.where((b) => b.id == book.id).firstOrNull;

      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppTheme.accentPrimaryLight,
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, color: AppTheme.accentPrimary, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Code détecté : $_scannedCode',
                    style: TextStyle(
                      color: AppTheme.accentPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                    border: Border.all(color: AppTheme.borderSubtle, width: 1),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      BookCover(book: book, width: 90, height: 130),
                      const SizedBox(height: 16),
                      Text(
                        book.title,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      if (book.author.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          book.author,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                      if (book.series.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          '${book.series}${book.volume != null ? ' - Tome ${book.volume}' : ''}',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      if (existing != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: existing.status == BookStatus.wishlist
                                ? AppTheme.accentRoseLight
                                : AppTheme.accentPrimaryLight,
                            borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                          ),
                          child: Text(
                            existing.status == BookStatus.wishlist
                                ? 'Déjà dans vos souhaits'
                                : 'Déjà dans votre collection',
                            style: TextStyle(
                              color: existing.status == BookStatus.wishlist
                                  ? AppTheme.accentRose
                                  : AppTheme.accentPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        )
                      else ...[
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(
                              backgroundColor: AppTheme.accentPrimary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                              ),
                            ),
                            onPressed: () async {
                              await _addBookToUser(book, BookStatus.unread);
                            },
                            icon: const Icon(Icons.bookmark_add_rounded, size: 20),
                            label: const Text('Ajouter à ma collection'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppTheme.accentRose,
                              side: BorderSide(color: AppTheme.accentRoseBorder),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                              ),
                            ),
                            onPressed: () async {
                              await _addBookToUser(book, BookStatus.wishlist);
                            },
                            icon: const Icon(Icons.favorite_outline_rounded, size: 20),
                            label: const Text('Ajouter aux souhaits'),
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      // Option création rapide si pas la bonne édition
                      TextButton.icon(
                        onPressed: () => _openQuickCreate(initialIsbn: _scannedCode, initialTitle: book.title),
                        icon: Icon(Icons.bolt_rounded, size: 16, color: AppTheme.textMuted),
                        label: Text(
                          'Pas la bonne édition ? Création rapide',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: _resumeScanning,
              icon: Icon(Icons.qr_code_scanner_rounded, color: AppTheme.accentPrimary),
              label: Text(
                'Scanner un autre livre',
                style: TextStyle(color: AppTheme.accentPrimary, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    if (_isProcessingScan && _scanNotFound) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded, color: AppTheme.accentRed, size: 56),
              const SizedBox(height: 16),
              Text(
                'Livre introuvable',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Aucun livre correspondant au code-barres\n« $_scannedCode »\nn\'a été trouvé dans le catalogue.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              // Option de création rapide proposée directement avec le code scanné
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.accentPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  ),
                ),
                onPressed: () => _openQuickCreate(initialIsbn: _scannedCode),
                icon: const Icon(Icons.bolt_rounded, size: 20),
                label: const Text(
                  'Création rapide avec cet ISBN',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.textPrimary,
                      side: BorderSide(color: AppTheme.borderSubtle),
                    ),
                    onPressed: _resumeScanning,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Réessayer'),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.textPrimary,
                      side: BorderSide(color: AppTheme.borderSubtle),
                    ),
                    onPressed: () {
                      setState(() {
                        _mode = AddBookMode.search;
                        _searchController.clear();
                        _searchResults = [];
                        _searchError = null;
                      });
                      _searchFocusNode.requestFocus();
                    },
                    icon: const Icon(Icons.search_rounded, size: 18),
                    label: const Text('Rechercher par titre'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      children: [
        MobileScanner(
          controller: _scannerController,
          onDetect: _onBarcodeDetected,
        ),

        // Reticle / Viewfinder overlay
        Center(
          child: Container(
            width: 260,
            height: 180,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppTheme.accentPrimary,
                width: 2.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  spreadRadius: 2000,
                ),
              ],
            ),
          ),
        ),

        // Scanning Instructions
        Positioned(
          top: 16,
          left: 20,
          right: 20,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              ),
              child: const Text(
                'Placez le code-barres ISBN / EAN dans le cadre',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),

        // Controls at bottom (Flash, Changer de caméra, Création rapide)
        Positioned(
          bottom: 24,
          left: 20,
          right: 20,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.all(12),
                ),
                icon: const Icon(Icons.flash_on_rounded),
                onPressed: () => _scannerController.toggleTorch(),
                tooltip: 'Flash',
              ),
              const SizedBox(width: 14),
              TextButton.icon(
                style: TextButton.styleFrom(
                  backgroundColor: Colors.black87,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    side: BorderSide(color: AppTheme.accentPrimary, width: 1),
                  ),
                ),
                onPressed: () => _openQuickCreate(),
                icon: Icon(Icons.bolt_rounded, size: 18, color: AppTheme.accentPrimary),
                label: const Text(
                  'Création rapide',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 14),
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.all(12),
                ),
                icon: const Icon(Icons.cameraswitch_rounded),
                onPressed: () => _scannerController.switchCamera(),
                tooltip: 'Changer de caméra',
              ),
            ],
          ),
        ),

        if (_isProcessingScan && !_scanNotFound && _scannedBook == null)
          Container(
            color: Colors.black87,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppTheme.accentPrimary),
                  SizedBox(height: 16),
                  Text(
                    'Recherche du livre (catalogue & BnF)...',
                    style: TextStyle(color: Colors.white, fontSize: 15),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _ModeTabButton extends StatelessWidget {
  const _ModeTabButton({
    required this.title,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accentPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 17,
              color: isSelected ? Colors.white : AppTheme.textMuted,
            ),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BookResultTile extends StatelessWidget {
  const _BookResultTile({
    required this.book,
    required this.existingBook,
    required this.isWishlistContext,
    required this.onAdd,
  });

  final Book book;
  final Book? existingBook;
  final bool isWishlistContext;
  final void Function(BookStatus status) onAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          BookCover(book: book, width: 46, height: 66),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  book.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                    height: 1.25,
                  ),
                ),
                if (book.author.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    book.author,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
                if (book.series.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${book.series}${book.volume != null ? ' - Tome ${book.volume}' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.textMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (existingBook != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: existingBook!.status == BookStatus.wishlist
                    ? AppTheme.accentRoseLight
                    : AppTheme.accentPrimaryLight,
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    existingBook!.status == BookStatus.wishlist
                        ? Icons.favorite_rounded
                        : Icons.check_circle_rounded,
                    size: 13,
                    color: existingBook!.status == BookStatus.wishlist
                        ? AppTheme.accentRose
                        : AppTheme.accentPrimary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    existingBook!.status == BookStatus.wishlist ? 'Souhait' : 'Possédé',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: existingBook!.status == BookStatus.wishlist
                          ? AppTheme.accentRose
                          : AppTheme.accentPrimary,
                    ),
                  ),
                ],
              ),
            )
          else if (isWishlistContext)
            IconButton.filled(
              style: IconButton.styleFrom(
                backgroundColor: AppTheme.accentRose,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.all(8),
              ),
              icon: const Icon(Icons.favorite_rounded, size: 18),
              tooltip: 'Ajouter aux souhaits',
              onPressed: () => onAdd(BookStatus.wishlist),
            )
          else
            PopupMenuButton<BookStatus>(
              icon: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add, size: 16, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Ajouter',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              color: AppTheme.bgElevated,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                side: BorderSide(color: AppTheme.borderSubtle),
              ),
              onSelected: onAdd,
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: BookStatus.unread,
                  child: Row(
                    children: [
                      Icon(Icons.bookmark_add_rounded, size: 18, color: AppTheme.accentPrimary),
                      SizedBox(width: 10),
                      Text('À ma collection', style: TextStyle(color: AppTheme.textPrimary)),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: BookStatus.wishlist,
                  child: Row(
                    children: [
                      Icon(Icons.favorite_outline_rounded, size: 18, color: AppTheme.accentRose),
                      SizedBox(width: 10),
                      Text('À mes souhaits', style: TextStyle(color: AppTheme.textPrimary)),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
