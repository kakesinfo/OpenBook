import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme.dart';
import '../../application/books_providers.dart';
import '../../data/book.dart';

Future<bool?> showEditBookSheet(
  BuildContext context, {
  required Book book,
  Map<String, dynamic>? initialDetails,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppTheme.bgSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) {
      return EditBookSheet(
        book: book,
        initialDetails: initialDetails,
      );
    },
  );
}

class EditBookSheet extends ConsumerStatefulWidget {
  const EditBookSheet({
    super.key,
    required this.book,
    this.initialDetails,
  });

  final Book book;
  final Map<String, dynamic>? initialDetails;

  @override
  ConsumerState<EditBookSheet> createState() => _EditBookSheetState();
}

class _EditBookSheetState extends ConsumerState<EditBookSheet> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleController;
  late final TextEditingController _authorController;
  late final TextEditingController _seriesController;
  late final TextEditingController _volumeController;
  late final TextEditingController _pagesController;
  late final TextEditingController _isbnController;
  late final TextEditingController _descriptionController;

  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final d = widget.initialDetails;
    _titleController = TextEditingController(text: widget.book.title);
    _authorController = TextEditingController(text: widget.book.author);
    _seriesController = TextEditingController(text: widget.book.series);
    _volumeController = TextEditingController(
      text: widget.book.volume != null ? widget.book.volume.toString() : '',
    );
    final pageCount = d?['pageCount'] ?? widget.book.totalPages;
    _pagesController = TextEditingController(
      text: pageCount != null && (pageCount as num) > 0 ? pageCount.toString() : '',
    );
    _isbnController = TextEditingController(text: d?['isbn']?.toString() ?? '');
    _descriptionController = TextEditingController(text: d?['description']?.toString() ?? '');
  }

  @override
  void dispose() {
    _titleController.dispose();
    _authorController.dispose();
    _seriesController.dispose();
    _volumeController.dispose();
    _pagesController.dispose();
    _isbnController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    final bookId = widget.book.id;
    if (bookId == null) return;

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      final volText = _volumeController.text.trim();
      final pagesText = _pagesController.text.trim();

      await ref.read(booksControllerProvider.notifier).updateBookInfo(
        bookId: bookId,
        title: _titleController.text.trim(),
        seriesName: _seriesController.text.trim(),
        volume: volText.isNotEmpty ? int.tryParse(volText) : null,
        author: _authorController.text.trim(),
        pageCount: pagesText.isNotEmpty ? int.tryParse(pagesText) : null,
        isbn: _isbnController.text.trim(),
        description: _descriptionController.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Informations mises à jour avec succès'),
            backgroundColor: AppTheme.accentPrimary,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            const SizedBox(height: 12),
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.borderSubtle,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppTheme.accentPrimaryLight,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Center(
                      child: Icon(Icons.edit_note_rounded, color: AppTheme.accentPrimary, size: 22),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Modifier l\'album',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        Text(
                          'Modifier les informations et la tomaison',
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
                    onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Divider(height: 1),

            // Form content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.accentRedLight,
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            border: Border.all(color: AppTheme.accentRed.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.error_outline_rounded, color: AppTheme.accentRed, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: TextStyle(color: AppTheme.accentRed, fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      _buildFieldLabel('Titre de l\'album *'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _titleController,
                        style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                        decoration: _inputDecoration(
                          hint: 'ex: Astérix le Gaulois',
                          icon: Icons.menu_book_rounded,
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Le titre est obligatoire';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      _buildFieldLabel('Auteur(s)'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _authorController,
                        style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                        decoration: _inputDecoration(
                          hint: 'ex: René Goscinny, Albert Uderzo',
                          icon: Icons.person_outline_rounded,
                        ),
                      ),
                      const SizedBox(height: 16),

                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Série'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _seriesController,
                                  style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                                  decoration: _inputDecoration(
                                    hint: 'ex: Astérix',
                                    icon: Icons.auto_stories_outlined,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 2,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Tome n°'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _volumeController,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                                  decoration: _inputDecoration(
                                    hint: 'ex: 1',
                                    icon: Icons.bookmark_outline_rounded,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Nombre de pages'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _pagesController,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                                  decoration: _inputDecoration(
                                    hint: 'ex: 48',
                                    icon: Icons.description_outlined,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('ISBN / EAN'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _isbnController,
                                  style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                                  decoration: _inputDecoration(
                                    hint: 'ex: 9782012101333',
                                    icon: Icons.qr_code_rounded,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      _buildFieldLabel('Description / Résumé'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _descriptionController,
                        maxLines: 3,
                        style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                        decoration: _inputDecoration(
                          hint: 'Résumé de l\'album...',
                          icon: Icons.notes_rounded,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Actions
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                ),
                                side: BorderSide(color: AppTheme.borderSubtle),
                              ),
                              child: Text(
                                'Annuler',
                                style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _isSaving ? null : _handleSave,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.accentPrimary,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                ),
                              ),
                              child: _isSaving
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'Enregistrer',
                                      style: TextStyle(fontWeight: FontWeight.w700),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppTheme.textSecondary,
      ),
    );
  }

  InputDecoration _inputDecoration({required String hint, required IconData icon}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: AppTheme.textMuted, fontSize: 13),
      prefixIcon: Icon(icon, size: 20, color: AppTheme.textMuted),
      filled: true,
      fillColor: AppTheme.bgElevated,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        borderSide: BorderSide(color: AppTheme.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        borderSide: BorderSide(color: AppTheme.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        borderSide: BorderSide(color: AppTheme.accentPrimary),
      ),
    );
  }
}
