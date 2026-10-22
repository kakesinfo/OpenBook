import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_application_1/app/theme.dart';

import '../../data/book.dart';

Future<BookDraft?> showBookFormSheet(
  BuildContext context, {
  Book? existingBook,
  BookStatus? initialStatus,
}) {
  return showModalBottomSheet<BookDraft>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppTheme.bgSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) {
      return _BookFormSheet(
        existingBook: existingBook,
        initialStatus: initialStatus,
      );
    },
  );
}

class _BookFormSheet extends StatefulWidget {
  const _BookFormSheet({this.existingBook, this.initialStatus});

  final Book? existingBook;
  final BookStatus? initialStatus;

  @override
  State<_BookFormSheet> createState() => _BookFormSheetState();
}

class _BookFormSheetState extends State<_BookFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _authorController;
  late final TextEditingController _seriesController;
  late final TextEditingController _volumeController;
  late final TextEditingController _coverController;
  late final TextEditingController _totalPagesController;
  late BookStatus _status;
  late CoverSourceType _coverSourceType;
  String? _selectedCoverPath;

  @override
  void initState() {
    super.initState();
    final book = widget.existingBook;
    _titleController = TextEditingController(text: book?.title ?? '');
    _authorController = TextEditingController(text: book?.author ?? '');
    _seriesController = TextEditingController(text: book?.series ?? '');
    _volumeController = TextEditingController(text: book?.volume?.toString() ?? '');
    final draft = book == null ? null : BookDraft.fromBook(book);
    _coverController = TextEditingController(text: draft?.coverUrl ?? '');
    _totalPagesController = TextEditingController(text: draft?.totalPages?.toString() ?? '');
    _status = book?.status ?? widget.initialStatus ?? BookStatus.unread;
    _coverSourceType = draft?.coverSourceType ?? CoverSourceType.none;
    _selectedCoverPath = draft?.coverFilePath;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _authorController.dispose();
    _seriesController.dispose();
    _volumeController.dispose();
    _coverController.dispose();
    _totalPagesController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final volumeText = _volumeController.text.trim();
    final totalPagesText = _totalPagesController.text.trim();
    Navigator.of(context).pop(
      BookDraft(
        title: _titleController.text.trim(),
        author: _authorController.text.trim(),
        series: _seriesController.text.trim(),
        volume: volumeText.isEmpty ? null : int.tryParse(volumeText),
        coverUrl: _coverSourceType == CoverSourceType.url ? _coverController.text.trim() : '',
        coverFilePath: _coverSourceType == CoverSourceType.file ? _selectedCoverPath : null,
        coverSourceType: _coverSourceType,
        totalPages: totalPagesText.isEmpty ? null : int.tryParse(totalPagesText),
        status: _status,
      ),
    );
  }

  Future<void> _pickCoverImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png'],
    );

    final filePath = result?.files.single.path;
    if (filePath == null || filePath.isEmpty) {
      return;
    }

    setState(() {
      _coverSourceType = CoverSourceType.file;
      _selectedCoverPath = filePath;
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        widget.existingBook == null ? 'Ajouter un livre' : 'Modifier le livre',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _titleController,
                    decoration: const InputDecoration(labelText: 'Titre'),
                    textInputAction: TextInputAction.next,
                    validator: (value) => (value == null || value.trim().isEmpty)
                        ? 'Le titre est requis'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _authorController,
                    decoration: const InputDecoration(labelText: 'Auteur'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextFormField(
                          controller: _seriesController,
                          decoration: const InputDecoration(labelText: 'Série'),
                          textInputAction: TextInputAction.next,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _volumeController,
                          decoration: const InputDecoration(labelText: 'Tome'),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Image de couverture',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Aucune'),
                        selected: _coverSourceType == CoverSourceType.none,
                        onSelected: (_) => setState(() {
                          _coverSourceType = CoverSourceType.none;
                          _selectedCoverPath = null;
                          _coverController.clear();
                        }),
                      ),
                      ChoiceChip(
                        label: const Text('Lien URL'),
                        selected: _coverSourceType == CoverSourceType.url,
                        onSelected: (_) => setState(() {
                          _coverSourceType = CoverSourceType.url;
                          _selectedCoverPath = null;
                        }),
                      ),
                      ChoiceChip(
                        label: const Text('Fichier local'),
                        selected: _coverSourceType == CoverSourceType.file,
                        onSelected: (_) => setState(() {
                          _coverSourceType = CoverSourceType.file;
                          _coverController.clear();
                        }),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (_coverSourceType == CoverSourceType.url)
                    TextFormField(
                      controller: _coverController,
                      decoration: const InputDecoration(
                        labelText: 'URL de couverture (http/https)',
                        hintText: 'https://...',
                      ),
                      textInputAction: TextInputAction.next,
                    ),
                  if (_coverSourceType == CoverSourceType.file)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        OutlinedButton.icon(
                          onPressed: _pickCoverImage,
                          icon: const Icon(Icons.upload_file_outlined),
                          label: const Text('Choisir une image JPG/PNG'),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _selectedCoverPath == null
                              ? 'Aucune image sélectionnée'
                              : 'Fichier : ${_selectedCoverPath!.split(RegExp(r'[\\/]')).last}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _totalPagesController,
                          decoration: const InputDecoration(labelText: 'Pages totales'),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<BookStatus>(
                    initialValue: _status,
                    dropdownColor: AppTheme.bgElevated,
                    decoration: const InputDecoration(labelText: 'Statut'),
                    items: BookStatus.values
                        .map(
                          (status) => DropdownMenuItem(
                            value: status,
                            child: Text(
                              status.label,
                              style: const TextStyle(color: AppTheme.textPrimary),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _status = value);
                      }
                    },
                  ),
                  const SizedBox(height: 24),
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: AppTheme.primaryGradient,
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x4D10B981),
                          blurRadius: 12,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                        onTap: _submit,
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_rounded, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Enregistrer',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                      ),
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
