import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/book_note.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/book_cover.dart';

class NotesPage extends ConsumerStatefulWidget {
  const NotesPage({super.key, this.initialCreate = false});

  final bool initialCreate;

  @override
  ConsumerState<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends ConsumerState<NotesPage> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    if (widget.initialCreate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _openNoteEditorSheet(context);
        }
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    final local = date.toLocal();
    const months = [
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ];
    final m = months[(local.month - 1).clamp(0, 11)];
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '${local.day} $m ${local.year} • $hh:$mm';
  }

  String _bookSubtitle(Book? book) {
    if (book == null) return '';
    final parts = <String>[];
    if (book.series.isNotEmpty) {
      parts.add(book.volume != null ? '${book.series} • Tome ${book.volume}' : book.series);
    } else if (book.volume != null) {
      parts.add('Tome ${book.volume}');
    }
    if (book.author.isNotEmpty) {
      parts.add(book.author);
    }
    return parts.join(' · ');
  }

  void _openNoteEditorSheet(BuildContext context, {BookNote? existingNote}) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _NoteEditorSheet(
        existingNote: existingNote,
        onSwitchToExisting: (note) {
          Navigator.of(context).pop();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              _openNoteEditorSheet(context, existingNote: note);
            }
          });
        },
      ),
    );
  }

  void _openNoteDetailSheet(BuildContext context, BookNote note, Book resolvedBook) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) {
        final subtitle = _bookSubtitle(resolvedBook);
        return DraggableScrollableSheet(
          initialChildSize: 0.68,
          minChildSize: 0.45,
          maxChildSize: 0.92,
          expand: false,
          builder: (_, scrollController) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppTheme.borderMedium,
                        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  // Book header
                  InkWell(
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    onTap: () {
                      Navigator.of(sheetCtx).pop();
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => BookDetailsPage(book: resolvedBook),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(color: AppTheme.borderSubtle),
                      ),
                      child: Row(
                        children: [
                          BookCover(
                            book: resolvedBook,
                            width: 48,
                            height: 70,
                            borderRadius: AppTheme.radiusSm,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  resolvedBook.title,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.textPrimary,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (subtitle.isNotEmpty) ...[
                                  const SizedBox(height: 3),
                                  Text(
                                    subtitle,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textSecondary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.schedule_rounded,
                                      size: 12,
                                      color: AppTheme.textMuted,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        _formatDate(note.updatedAt ?? note.createdAt),
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.textMuted,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.open_in_new_rounded,
                            size: 16,
                            color: AppTheme.textMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.bgPrimary,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(color: AppTheme.borderSubtle),
                      ),
                      child: SingleChildScrollView(
                        controller: scrollController,
                        child: SelectableText(
                          note.content,
                          style: TextStyle(
                            fontSize: 14.5,
                            height: 1.6,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.of(sheetCtx).pop();
                            _confirmDelete(context, note, resolvedBook.title);
                          },
                          icon: Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.accentRed),
                          label: Text(
                            'Supprimer',
                            style: TextStyle(color: AppTheme.accentRed),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: AppTheme.accentRed.withValues(alpha: 0.35)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () {
                            Navigator.of(sheetCtx).pop();
                            _openNoteEditorSheet(context, existingNote: note);
                          },
                          icon: const Icon(Icons.edit_rounded, size: 18),
                          label: const Text('Modifier'),
                          style: FilledButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _confirmDelete(BuildContext context, BookNote note, String bookTitle) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer la note'),
        content: Text('Voulez-vous vraiment supprimer votre note pour « $bookTitle » ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Annuler', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.accentRed),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        await ref.read(notesControllerProvider.notifier).deleteNote(note.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Note supprimée'),
              backgroundColor: AppTheme.accentPrimary,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Erreur : $e'),
              backgroundColor: AppTheme.accentRed,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(notesControllerProvider);
    final userBooks = ref.watch(booksControllerProvider).value ?? const <Book>[];
    final bookById = <int, Book>{
      for (final b in userBooks)
        if (b.id != null) b.id!: b,
    };

    final allNotes = notesAsync.value ?? const <BookNote>[];
    final q = _searchQuery.trim().toLowerCase();
    final filteredNotes = q.isEmpty
        ? allNotes
        : allNotes.where((n) {
            final b = n.book ?? bookById[n.bookId];
            final title = (b?.title ?? '').toLowerCase();
            final series = (b?.series ?? '').toLowerCase();
            final author = (b?.author ?? '').toLowerCase();
            final content = n.content.toLowerCase();
            return title.contains(q) || series.contains(q) || author.contains(q) || content.contains(q);
          }).toList();

    return Scaffold(
      appBar: AppHeader(
        title: 'Notes de lecture',
        subtitle: allNotes.isEmpty
            ? 'Carnet de lecture personnel'
            : '${allNotes.length} note${allNotes.length > 1 ? 's' : ''} enregistrée${allNotes.length > 1 ? 's' : ''}',
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            tooltip: 'Nouvelle note',
            onPressed: () => _openNoteEditorSheet(context),
            icon: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppTheme.accentPrimaryLight,
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                border: Border.all(
                  color: AppTheme.accentPrimary.withValues(alpha: 0.35),
                ),
              ),
              child: Icon(
                Icons.add_rounded,
                color: AppTheme.accentPrimary,
                size: 20,
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openNoteEditorSheet(context),
        icon: const Icon(Icons.edit_note_rounded),
        label: const Text('Nouvelle note'),
      ),
      body: RefreshIndicator(
        color: AppTheme.accentPrimary,
        onRefresh: () => ref.read(notesControllerProvider.notifier).reload(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Search Bar
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppTheme.bgSurface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(color: AppTheme.borderSubtle, width: 1),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Rechercher par livre, série ou contenu...',
                      hintStyle: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      fillColor: Colors.transparent,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      prefixIcon: Icon(Icons.search_rounded, color: AppTheme.accentPrimary, size: 20),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: Icon(Icons.clear_rounded, color: AppTheme.textMuted, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                    ),
                  ),
                ),
              ),
            ),

            notesAsync.when(
              loading: () => SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppTheme.accentPrimary),
                ),
              ),
              error: (error, _) => SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline_rounded, color: AppTheme.accentRed, size: 36),
                        const SizedBox(height: 12),
                        Text(
                          'Impossible de charger les notes',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          error.toString(),
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: () => ref.read(notesControllerProvider.notifier).reload(),
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Réessayer'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              data: (_) {
                if (filteredNotes.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: AppTheme.accentPrimaryLight,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.sticky_note_2_outlined,
                                  size: 30,
                                  color: AppTheme.accentPrimary,
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),
                            Text(
                              q.isNotEmpty
                                  ? 'Aucune note correspondante'
                                  : 'Aucune note pour le moment',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              q.isNotEmpty
                                  ? 'Aucune note ne correspond à « $_searchQuery ».'
                                  : 'Rédigez des fiches de lecture, résumés ou citations sur vos livres (une note par livre).',
                              style: TextStyle(
                                fontSize: 13,
                                color: AppTheme.textMuted,
                                height: 1.4,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            if (q.isEmpty) ...[
                              const SizedBox(height: 20),
                              FilledButton.icon(
                                onPressed: () => _openNoteEditorSheet(context),
                                icon: const Icon(Icons.add_rounded, size: 18),
                                label: const Text('Créer ma première note'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  sliver: SliverList.separated(
                    itemCount: filteredNotes.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final note = filteredNotes[index];
                      final resolvedBook = note.book ??
                          bookById[note.bookId] ??
                          Book(
                            id: note.bookId,
                            title: 'Livre #${note.bookId}',
                            status: BookStatus.unread,
                          );
                      final subtitle = _bookSubtitle(resolvedBook);

                      return Container(
                        decoration: BoxDecoration(
                          color: AppTheme.bgSurface,
                          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                          border: Border.all(color: AppTheme.borderSubtle, width: 1),
                          boxShadow: AppTheme.cardShadow,
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                            onTap: () => _openNoteDetailSheet(context, note, resolvedBook),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      GestureDetector(
                                        onTap: () => Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (_) => BookDetailsPage(book: resolvedBook),
                                          ),
                                        ),
                                        child: BookCover(
                                          book: resolvedBook,
                                          width: 50,
                                          height: 74,
                                          borderRadius: AppTheme.radiusSm,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              resolvedBook.title,
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w700,
                                                color: AppTheme.textPrimary,
                                                letterSpacing: -0.01,
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            if (subtitle.isNotEmpty) ...[
                                              const SizedBox(height: 3),
                                              Text(
                                                subtitle,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: AppTheme.textSecondary,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                            const SizedBox(height: 6),
                                            Row(
                                              children: [
                                                Icon(
                                                  Icons.schedule_rounded,
                                                  size: 12,
                                                  color: AppTheme.textMuted,
                                                ),
                                                const SizedBox(width: 4),
                                                Expanded(
                                                  child: Text(
                                                    _formatDate(note.updatedAt ?? note.createdAt),
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: AppTheme.textMuted,
                                                    ),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                            tooltip: 'Modifier',
                                            visualDensity: VisualDensity.compact,
                                            onPressed: () =>
                                                _openNoteEditorSheet(context, existingNote: note),
                                            icon: Icon(
                                              Icons.edit_outlined,
                                              size: 18,
                                              color: AppTheme.textSecondary,
                                            ),
                                          ),
                                          IconButton(
                                            tooltip: 'Supprimer',
                                            visualDensity: VisualDensity.compact,
                                            onPressed: () =>
                                                _confirmDelete(context, note, resolvedBook.title),
                                            icon: Icon(
                                              Icons.delete_outline_rounded,
                                              size: 18,
                                              color: AppTheme.accentRed,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppTheme.bgCard,
                                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                      border: Border.all(color: AppTheme.borderSubtle),
                                    ),
                                    child: Text(
                                      note.content,
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        color: AppTheme.textPrimary,
                                        height: 1.48,
                                      ),
                                      maxLines: 5,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _NoteEditorSheet extends ConsumerStatefulWidget {
  const _NoteEditorSheet({
    this.existingNote,
    required this.onSwitchToExisting,
  });

  final BookNote? existingNote;
  final void Function(BookNote note) onSwitchToExisting;

  @override
  ConsumerState<_NoteEditorSheet> createState() => _NoteEditorSheetState();
}

class _NoteEditorSheetState extends ConsumerState<_NoteEditorSheet> {
  late final TextEditingController _contentController;
  final TextEditingController _bookSearchController = TextEditingController();
  String _bookSearchQuery = '';
  Book? _selectedBook;
  bool _submitting = false;

  bool get _isEditing => widget.existingNote != null;

  @override
  void initState() {
    super.initState();
    _contentController = TextEditingController(text: widget.existingNote?.content ?? '');
    _selectedBook = widget.existingNote?.book;
  }

  @override
  void dispose() {
    _contentController.dispose();
    _bookSearchController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Veuillez saisir le contenu de la note'),
          backgroundColor: AppTheme.accentAmber,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (!_isEditing && (_selectedBook == null || _selectedBook!.id == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Veuillez sélectionner un livre'),
          backgroundColor: AppTheme.accentAmber,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      if (_isEditing) {
        await ref.read(notesControllerProvider.notifier).updateNote(
              id: widget.existingNote!.id,
              content: content,
            );
      } else {
        await ref.read(notesControllerProvider.notifier).createNote(
              bookId: _selectedBook!.id!,
              content: content,
            );
      }

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditing ? 'Note mise à jour' : 'Note créée avec succès'),
            backgroundColor: AppTheme.accentPrimary,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: AppTheme.accentRed,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectableBooksAsync = ref.watch(selectableBooksProvider);
    final existingNotes = ref.watch(notesControllerProvider).value ?? const <BookNote>[];
    final noteByBookId = <int, BookNote>{
      for (final n in existingNotes) n.bookId: n,
    };

    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: bottomInset + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.borderMedium,
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _isEditing ? 'Modifier la note' : 'Nouvelle note',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, color: AppTheme.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Book selector or read-only book badge
            if (_isEditing) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.bgCard,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Row(
                  children: [
                    if (_selectedBook != null) ...[
                      BookCover(
                        book: _selectedBook!,
                        width: 40,
                        height: 58,
                        borderRadius: AppTheme.radiusSm,
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _selectedBook?.title ?? 'Livre #${widget.existingNote!.bookId}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          if (_selectedBook != null && _selectedBook!.series.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              _selectedBook!.volume != null
                                  ? '${_selectedBook!.series} • Tome ${_selectedBook!.volume}'
                                  : _selectedBook!.series,
                              style: TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (_selectedBook != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.accentPrimaryLight,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(
                    color: AppTheme.accentPrimary.withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  children: [
                    BookCover(
                      book: _selectedBook!,
                      width: 40,
                      height: 58,
                      borderRadius: AppTheme.radiusSm,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _selectedBook!.title,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (_selectedBook!.series.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              _selectedBook!.volume != null
                                  ? '${_selectedBook!.series} • Tome ${_selectedBook!.volume}'
                                  : _selectedBook!.series,
                              style: TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _selectedBook = null),
                      child: Text(
                        'Changer',
                        style: TextStyle(
                          color: AppTheme.accentPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Text(
                'Livre associé *',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _bookSearchController,
                onChanged: (val) => setState(() => _bookSearchQuery = val),
                style: TextStyle(color: AppTheme.textPrimary, fontSize: 13.5),
                decoration: InputDecoration(
                  hintText: 'Rechercher un livre à associer...',
                  prefixIcon: Icon(Icons.search_rounded, color: AppTheme.accentPrimary, size: 18),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                constraints: const BoxConstraints(maxHeight: 190),
                decoration: BoxDecoration(
                  color: AppTheme.bgPrimary,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: selectableBooksAsync.when(
                  loading: () => Padding(
                    padding: const EdgeInsets.all(20),
                    child: Center(
                      child: CircularProgressIndicator(color: AppTheme.accentPrimary),
                    ),
                  ),
                  error: (err, _) => Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Impossible de charger les livres : $err',
                      style: TextStyle(fontSize: 12, color: AppTheme.accentRed),
                    ),
                  ),
                  data: (books) {
                    final q = _bookSearchQuery.trim().toLowerCase();
                    final matches = q.isEmpty
                        ? books
                        : books.where((b) {
                            return b.title.toLowerCase().contains(q) ||
                                b.series.toLowerCase().contains(q) ||
                                b.author.toLowerCase().contains(q);
                          }).toList();

                    if (matches.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.all(16),
                        child: Center(
                          child: Text(
                            'Aucun livre trouvé',
                            style: TextStyle(fontSize: 12.5, color: AppTheme.textMuted),
                          ),
                        ),
                      );
                    }

                    return ListView.separated(
                      shrinkWrap: true,
                      itemCount: matches.length,
                      separatorBuilder: (_, _) => Divider(height: 1, color: AppTheme.borderSubtle),
                      itemBuilder: (context, idx) {
                        final b = matches[idx];
                        final existingForBook = b.id != null ? noteByBookId[b.id!] : null;

                        return ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                          leading: BookCover(
                            book: b,
                            width: 30,
                            height: 44,
                            borderRadius: 6,
                          ),
                          title: Text(
                            b.title,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: b.series.isNotEmpty
                              ? Text(
                                  b.volume != null ? '${b.series} • T.${b.volume}' : b.series,
                                  style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                )
                              : null,
                          trailing: existingForBook != null
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppTheme.accentAmberLight,
                                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                  ),
                                  child: Text(
                                    'Modifier la note',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.accentAmber,
                                    ),
                                  ),
                                )
                              : Icon(
                                  Icons.add_circle_outline_rounded,
                                  size: 18,
                                  color: AppTheme.accentPrimary,
                                ),
                          onTap: () {
                            if (existingForBook != null) {
                              widget.onSwitchToExisting(existingForBook.copyWith(book: b));
                            } else {
                              setState(() => _selectedBook = b);
                            }
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ],

            const SizedBox(height: 16),
            Text(
              'Contenu de la note *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _contentController,
              minLines: 6,
              maxLines: 12,
              style: TextStyle(color: AppTheme.textPrimary, fontSize: 14, height: 1.45),
              decoration: const InputDecoration(
                hintText: 'Écrivez vos impressions, citations, résumé ou éléments clés...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Icon(_isEditing ? Icons.check_rounded : Icons.save_outlined, size: 18),
                label: Text(_isEditing ? 'Enregistrer les modifications' : 'Créer la note'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
