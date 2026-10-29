import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../app/theme.dart';
import '../../application/books_providers.dart';
import '../../data/book.dart';

enum _CoverMode { photo, url }

/// Ouvre la bottom sheet de création rapide d'un livre.
Future<Book?> showQuickCreateBookSheet(
  BuildContext context, {
  String? initialTitle,
  String? initialIsbn,
  BookStatus? initialStatus,
}) {
  return showModalBottomSheet<Book>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppTheme.bgSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) {
      return QuickCreateBookSheet(
        initialTitle: initialTitle,
        initialIsbn: initialIsbn,
        initialStatus: initialStatus,
      );
    },
  );
}

class QuickCreateBookSheet extends ConsumerStatefulWidget {
  const QuickCreateBookSheet({
    super.key,
    this.initialTitle,
    this.initialIsbn,
    this.initialStatus,
  });

  final String? initialTitle;
  final String? initialIsbn;
  final BookStatus? initialStatus;

  @override
  ConsumerState<QuickCreateBookSheet> createState() => _QuickCreateBookSheetState();
}

class _QuickCreateBookSheetState extends ConsumerState<QuickCreateBookSheet> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleController;
  late final TextEditingController _isbnController;
  late final TextEditingController _priceController;
  late final TextEditingController _coverUrlController;

  late BookStatus _targetStatus;
  _CoverMode _coverMode = _CoverMode.photo;
  String? _localCoverPath;
  bool _isSubmitting = false;

  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.initialTitle ?? '');
    _isbnController = TextEditingController(text: widget.initialIsbn ?? '');
    _priceController = TextEditingController();
    _coverUrlController = TextEditingController();
    _targetStatus = widget.initialStatus == BookStatus.wishlist
        ? BookStatus.wishlist
        : BookStatus.unread;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _isbnController.dispose();
    _priceController.dispose();
    _coverUrlController.dispose();
    super.dispose();
  }

  String _cleanBarcode(String raw) {
    var cleaned = raw.trim().replaceAll(RegExp(r'[^0-9Xx]'), '');
    if (cleaned.length > 13 && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
      cleaned = cleaned.substring(0, 13);
    }
    return cleaned.isNotEmpty ? cleaned : raw.trim();
  }

  Future<void> _openIsbnScanner() async {
    final scannedCode = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.black,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _QuickIsbnScannerModal(cleanBarcode: _cleanBarcode),
    );

    if (scannedCode != null && scannedCode.isNotEmpty && mounted) {
      setState(() {
        _isbnController.text = scannedCode;
      });
      HapticFeedback.lightImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.accentPrimary,
          content: Text('ISBN scanné : $scannedCode'),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _takePhoto() async {
    try {
      final photo = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1200,
        maxHeight: 1800,
        imageQuality: 85,
      );

      if (photo != null && mounted) {
        setState(() {
          _localCoverPath = photo.path;
          _coverUrlController.clear();
          _coverMode = _CoverMode.photo;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentRed,
            content: Text('Impossible d\'ouvrir l\'appareil photo : $e'),
          ),
        );
      }
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1800,
        imageQuality: 85,
      );

      if (image != null && mounted) {
        setState(() {
          _localCoverPath = image.path;
          _coverUrlController.clear();
          _coverMode = _CoverMode.photo;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentRed,
            content: Text('Impossible d\'accéder à la galerie : $e'),
          ),
        );
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
    });

    final title = _titleController.text.trim();
    final isbn = _isbnController.text.trim();
    final priceStr = _priceController.text.trim();
    final price = int.tryParse(priceStr);

    String? coverUrl;
    String? localCoverPath;

    if (_coverMode == _CoverMode.photo && _localCoverPath != null) {
      localCoverPath = _localCoverPath;
    } else if (_coverMode == _CoverMode.url && _coverUrlController.text.trim().isNotEmpty) {
      coverUrl = _coverUrlController.text.trim();
    }

    try {
      final createdBook = await ref.read(booksControllerProvider.notifier).quickCreateBook(
        title: title,
        isbn: isbn.isNotEmpty ? isbn : null,
        price: price,
        coverUrl: coverUrl,
        localCoverPath: localCoverPath,
        status: _targetStatus,
      );

      if (mounted) {
        Navigator.of(context).pop(createdBook);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentPrimary,
            content: Text(
              _targetStatus == BookStatus.wishlist
                  ? '« $title » créé et ajouté aux souhaits !'
                  : '« $title » créé et ajouté à votre collection !',
              style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
            ),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
        final msg = e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentRed,
            content: Text(msg),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
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
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(10),
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
                      Icons.bolt_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Création rapide',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Ajoutez un livre manquant au catalogue',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: AppTheme.textMuted),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          Divider(color: AppTheme.borderSubtle, height: 1),

          // Form fields
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Titre
                    _buildFieldLabel('Titre du livre *', Icons.menu_book_rounded),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _titleController,
                      style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: 'ex: Watchmen, Tome 1...',
                        suffixIcon: _titleController.text.isNotEmpty
                            ? IconButton(
                                icon: Icon(Icons.clear_rounded, size: 18, color: AppTheme.textMuted),
                                onPressed: () {
                                  setState(() {
                                    _titleController.clear();
                                  });
                                },
                              )
                            : null,
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Le titre est obligatoire';
                        }
                        return null;
                      },
                      onChanged: (_) => setState(() {}),
                    ),

                    const SizedBox(height: 18),

                    // ISBN et Prix (Row)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ISBN with Quick Scanner button
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildFieldLabel('ISBN / EAN', Icons.qr_code_rounded),
                              const SizedBox(height: 6),
                              TextFormField(
                                controller: _isbnController,
                                keyboardType: TextInputType.text,
                                style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                                decoration: InputDecoration(
                                  hintText: 'ex: 9782809499872',
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.qr_code_scanner_rounded,
                                      color: AppTheme.accentPrimary,
                                      size: 22,
                                    ),
                                    tooltip: 'Scanner rapidement l\'ISBN',
                                    onPressed: _openIsbnScanner,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Prix
                        Expanded(
                          flex: 2,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildFieldLabel('Prix (€)', Icons.euro_rounded),
                              const SizedBox(height: 6),
                              TextFormField(
                                controller: _priceController,
                                keyboardType: TextInputType.number,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                                decoration: const InputDecoration(
                                  hintText: 'ex: 20',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // Destination (Collection ou Souhaits)
                    _buildFieldLabel('Ajouter dans', Icons.bookmark_add_rounded),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(color: AppTheme.borderSubtle, width: 1),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _ChoiceTabButton(
                              title: 'Ma collection',
                              icon: Icons.menu_book_rounded,
                              isSelected: _targetStatus == BookStatus.unread,
                              selectedColor: AppTheme.accentPrimary,
                              onTap: () {
                                setState(() {
                                  _targetStatus = BookStatus.unread;
                                });
                              },
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _ChoiceTabButton(
                              title: 'Mes souhaits',
                              icon: Icons.favorite_rounded,
                              isSelected: _targetStatus == BookStatus.wishlist,
                              selectedColor: AppTheme.accentRose,
                              onTap: () {
                                setState(() {
                                  _targetStatus = BookStatus.wishlist;
                                });
                              },
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Couverture image section
                    _buildFieldLabel('Image de couverture', Icons.image_rounded),
                    const SizedBox(height: 8),
                    _buildCoverSection(),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),

          // Footer buttons
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              border: Border(top: BorderSide(color: AppTheme.borderSubtle, width: 1)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                    ),
                    child: const Text('Annuler'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _isSubmitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.accentPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                    ),
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.check_rounded, size: 20),
                    label: Text(
                      _isSubmitting ? 'Création...' : 'Créer le livre',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(String label, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppTheme.accentPrimary),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildCoverSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sub-tabs: Photo vs URL
          Row(
            children: [
              Expanded(
                child: _CoverSubTab(
                  icon: Icons.camera_alt_rounded,
                  title: 'Photo / Fichier',
                  isActive: _coverMode == _CoverMode.photo,
                  onTap: () {
                    setState(() {
                      _coverMode = _CoverMode.photo;
                    });
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CoverSubTab(
                  icon: Icons.link_rounded,
                  title: 'Lien URL',
                  isActive: _coverMode == _CoverMode.url,
                  onTap: () {
                    setState(() {
                      _coverMode = _CoverMode.url;
                    });
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          if (_coverMode == _CoverMode.photo) ...[
            if (_localCoverPath != null) ...[
              // Preview of the captured photo
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    child: Image.file(
                      File(_localCoverPath!),
                      width: 72,
                      height: 104,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.accentPrimaryLight,
                            borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle_rounded, size: 14, color: AppTheme.accentPrimary),
                              SizedBox(width: 4),
                              Text(
                                'Photo prête',
                                style: TextStyle(
                                  color: AppTheme.accentPrimary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                textStyle: const TextStyle(fontSize: 12),
                              ),
                              onPressed: _takePhoto,
                              icon: const Icon(Icons.camera_alt_rounded, size: 15),
                              label: const Text('Reprendre'),
                            ),
                            TextButton.icon(
                              style: TextButton.styleFrom(
                                foregroundColor: AppTheme.accentRed,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                textStyle: const TextStyle(fontSize: 12),
                              ),
                              onPressed: () {
                                setState(() {
                                  _localCoverPath = null;
                                });
                              },
                              icon: const Icon(Icons.delete_outline_rounded, size: 15),
                              label: const Text('Supprimer'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ] else ...[
              // Quick photo actions
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.accentPrimaryLight,
                        foregroundColor: AppTheme.accentPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        ),
                      ),
                      onPressed: _takePhoto,
                      icon: const Icon(Icons.camera_alt_rounded, size: 18),
                      label: const Text(
                        'Prendre une photo',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        ),
                      ),
                      onPressed: _pickFromGallery,
                      icon: const Icon(Icons.photo_library_rounded, size: 18),
                      label: const Text(
                        'Galerie',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ] else ...[
            TextFormField(
              controller: _coverUrlController,
              style: TextStyle(color: AppTheme.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                hintText: 'https://exemple.com/couverture.jpg',
                contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              onChanged: (_) => setState(() {}),
            ),
            if (_coverUrlController.text.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  child: Image.network(
                    _coverUrlController.text.trim(),
                    height: 100,
                    width: 70,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Text(
                      'Lien d\'image non valide',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _CoverSubTab extends StatelessWidget {
  const _CoverSubTab({
    required this.icon,
    required this.title,
    required this.isActive,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppTheme.accentPrimary.withValues(alpha: 0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: isActive ? AppTheme.accentPrimary : AppTheme.borderSubtle,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isActive ? AppTheme.accentPrimary : AppTheme.textMuted,
            ),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                color: isActive ? AppTheme.accentPrimary : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChoiceTabButton extends StatelessWidget {
  const _ChoiceTabButton({
    required this.title,
    required this.icon,
    required this.isSelected,
    required this.selectedColor,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final bool isSelected;
  final Color selectedColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? selectedColor : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
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

/// Modal plein écran de scan rapide d'un ISBN.
class _QuickIsbnScannerModal extends StatefulWidget {
  const _QuickIsbnScannerModal({required this.cleanBarcode});

  final String Function(String) cleanBarcode;

  @override
  State<_QuickIsbnScannerModal> createState() => _QuickIsbnScannerModalState();
}

class _QuickIsbnScannerModalState extends State<_QuickIsbnScannerModal> {
  late final MobileScannerController _controller;
  bool _detected = false;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_detected) return;

    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue?.trim();
      if (raw != null && raw.isNotEmpty) {
        final code = widget.cleanBarcode(raw);
        if (code.isNotEmpty) {
          _detected = true;
          Navigator.of(context).pop(code);
          break;
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: Stack(
          children: [
            MobileScanner(
              controller: _controller,
              onDetect: _onDetect,
            ),

            // Cadre de visée
            Center(
              child: Container(
                width: 270,
                height: 160,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppTheme.accentPrimary,
                    width: 2.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.55),
                      spreadRadius: 2000,
                    ),
                  ],
                ),
              ),
            ),

            // Consignes en haut
            Positioned(
              top: 20,
              left: 20,
              right: 20,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black87,
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.qr_code_scanner_rounded, color: AppTheme.accentPrimary, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Scannez le code-barres ISBN',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black54,
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            // Contrôles en bas (Flash / Caméra)
            Positioned(
              bottom: 24,
              left: 0,
              right: 0,
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
                    onPressed: () => _controller.toggleTorch(),
                    tooltip: 'Flash',
                  ),
                  const SizedBox(width: 16),
                  IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black54,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.all(12),
                    ),
                    icon: const Icon(Icons.cameraswitch_rounded),
                    onPressed: () => _controller.switchCamera(),
                    tooltip: 'Changer de caméra',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
