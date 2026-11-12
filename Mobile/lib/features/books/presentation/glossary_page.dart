import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/glossary_word.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/book_cover.dart';

class GlossaryPage extends ConsumerStatefulWidget {
  const GlossaryPage({super.key, this.initialCreate = false});

  final bool initialCreate;

  @override
  ConsumerState<GlossaryPage> createState() => _GlossaryPageState();
}

class _GlossaryPageState extends ConsumerState<GlossaryPage> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedLetter = 'ALL';
  int? _filterBookId;

  @override
  void initState() {
    super.initState();
    if (widget.initialCreate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _openWordEditorSheet(context);
        }
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _openWordEditorSheet(BuildContext context, {GlossaryWord? existingWord}) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _WordEditorSheet(existingWord: existingWord),
    );
  }

  Future<void> _confirmDelete(BuildContext context, GlossaryWord item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer le terme'),
        content: Text('Voulez-vous vraiment supprimer « ${item.word} » du glossaire ?'),
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
        await ref.read(wordsControllerProvider.notifier).deleteWord(item.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Terme supprimé du glossaire'),
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
    final wordsAsync = ref.watch(wordsControllerProvider);
    final allWords = wordsAsync.value ?? const <GlossaryWord>[];

    // Collect distinct books referenced across glossary words
    final referencedBooksById = <int, Book>{};
    final activeLetters = <String>{};
    for (final w in allWords) {
      activeLetters.add(w.initialLetter);
      for (final b in w.books) {
        if (b.id != null) {
          referencedBooksById[b.id!] = b;
        }
      }
    }
    final referencedBooks = referencedBooksById.values.toList()
      ..sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
    final sortedLetters = activeLetters.toList()..sort();

    final q = _searchQuery.trim().toLowerCase();
    final filteredWords = allWords.where((w) {
      if (_selectedLetter != 'ALL' && w.initialLetter != _selectedLetter) {
        return false;
      }
      if (_filterBookId != null) {
        final hasBook = w.books.any((b) => b.id == _filterBookId);
        if (!hasBook) return false;
      }
      if (q.isEmpty) return true;
      final wordMatch = w.word.toLowerCase().contains(q);
      final defMatch = w.definition.toLowerCase().contains(q);
      final bookMatch = w.books.any(
        (b) =>
            b.title.toLowerCase().contains(q) ||
            b.series.toLowerCase().contains(q),
      );
      return wordMatch || defMatch || bookMatch;
    }).toList();

    return Scaffold(
      appBar: AppHeader(
        title: 'Glossaire',
        subtitle: allWords.isEmpty
            ? 'Lexique & définitions par livre'
            : '${allWords.length} terme${allWords.length > 1 ? 's' : ''} défini${allWords.length > 1 ? 's' : ''}',
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            tooltip: 'Nouveau terme',
            onPressed: () => _openWordEditorSheet(context),
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
        onPressed: () => _openWordEditorSheet(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nouveau terme'),
      ),
      body: RefreshIndicator(
        color: AppTheme.accentPrimary,
        onRefresh: () => ref.read(wordsControllerProvider.notifier).reload(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Search Bar
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
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
                      hintText: 'Rechercher un mot, une définition ou un livre...',
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

            // Book Filter Bar (if any words have associated books)
            if (referencedBooks.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        Icon(Icons.menu_book_rounded, size: 15, color: AppTheme.textMuted),
                        const SizedBox(width: 8),
                        ChoiceChip(
                          label: const Text('Tous les livres'),
                          selected: _filterBookId == null,
                          onSelected: (_) => setState(() => _filterBookId = null),
                          visualDensity: VisualDensity.compact,
                        ),
                        const SizedBox(width: 6),
                        ...referencedBooks.map((b) {
                          final selected = _filterBookId == b.id;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(
                                b.volume != null ? '${b.title} (T.${b.volume})' : b.title,
                              ),
                              selected: selected,
                              onSelected: (_) => setState(() {
                                _filterBookId = selected ? null : b.id;
                              }),
                              visualDensity: VisualDensity.compact,
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ),
              ),

            // Alphabet Filter Pills
            if (sortedLetters.length > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _LetterPill(
                          label: 'Tous',
                          isSelected: _selectedLetter == 'ALL',
                          onTap: () => setState(() => _selectedLetter = 'ALL'),
                        ),
                        const SizedBox(width: 6),
                        ...sortedLetters.map(
                          (letter) => Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: _LetterPill(
                              label: letter,
                              isSelected: _selectedLetter == letter,
                              onTap: () => setState(() {
                                _selectedLetter = _selectedLetter == letter ? 'ALL' : letter;
                              }),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            wordsAsync.when(
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
                          'Impossible de charger le glossaire',
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
                          onPressed: () => ref.read(wordsControllerProvider.notifier).reload(),
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Réessayer'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              data: (_) {
                if (filteredWords.isEmpty) {
                  final hasFilters =
                      q.isNotEmpty || _selectedLetter != 'ALL' || _filterBookId != null;
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
                                color: AppTheme.accentSecondaryLight,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppTheme.accentSecondary.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.spellcheck_rounded,
                                  size: 30,
                                  color: AppTheme.accentSecondary,
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),
                            Text(
                              hasFilters
                                  ? 'Aucun terme correspondant'
                                  : 'Votre glossaire est vide',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              hasFilters
                                  ? 'Aucun mot ne correspond aux filtres sélectionnés.'
                                  : 'Ajoutez des mots, concepts ou personnages avec leur définition et associez-les à un ou plusieurs livres.',
                              style: TextStyle(
                                fontSize: 13,
                                color: AppTheme.textMuted,
                                height: 1.4,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 20),
                            if (hasFilters)
                              OutlinedButton.icon(
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {
                                    _searchQuery = '';
                                    _selectedLetter = 'ALL';
                                    _filterBookId = null;
                                  });
                                },
                                icon: const Icon(Icons.filter_alt_off_rounded, size: 18),
                                label: const Text('Réinitialiser les filtres'),
                              )
                            else
                              FilledButton.icon(
                                onPressed: () => _openWordEditorSheet(context),
                                icon: const Icon(Icons.add_rounded, size: 18),
                                label: const Text('Ajouter mon premier terme'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 96),
                  sliver: SliverList.separated(
                    itemCount: filteredWords.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = filteredWords[index];
                      return Container(
                        decoration: BoxDecoration(
                          color: AppTheme.bgSurface,
                          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                          border: Border.all(color: AppTheme.borderSubtle, width: 1),
                          boxShadow: AppTheme.cardShadow,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(15),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: AppTheme.accentPrimaryLight,
                                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                                      border: Border.all(
                                        color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                                      ),
                                    ),
                                    child: Center(
                                      child: Text(
                                        item.initialLetter,
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: AppTheme.accentPrimary,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      item.word,
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.textPrimary,
                                        letterSpacing: -0.01,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'Modifier',
                                    visualDensity: VisualDensity.compact,
                                    onPressed: () =>
                                        _openWordEditorSheet(context, existingWord: item),
                                    icon: Icon(
                                      Icons.edit_outlined,
                                      size: 18,
                                      color: AppTheme.textSecondary,
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'Supprimer',
                                    visualDensity: VisualDensity.compact,
                                    onPressed: () => _confirmDelete(context, item),
                                    icon: Icon(
                                      Icons.delete_outline_rounded,
                                      size: 18,
                                      color: AppTheme.accentRed,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.bgCard,
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                  border: Border.all(color: AppTheme.borderSubtle),
                                ),
                                child: SelectableText(
                                  item.definition,
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    height: 1.48,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                              ),
                              if (item.books.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: item.books.map((book) {
                                    final label = book.volume != null
                                        ? '${book.title} • T.${book.volume}'
                                        : book.title;
                                    return InkWell(
                                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                      onTap: () => Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) => BookDetailsPage(book: book),
                                        ),
                                      ),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 5,
                                        ),
                                        decoration: BoxDecoration(
                                          color: AppTheme.bgElevated,
                                          borderRadius:
                                              BorderRadius.circular(AppTheme.radiusFull),
                                          border: Border.all(color: AppTheme.borderSubtle),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              Icons.menu_book_rounded,
                                              size: 12,
                                              color: AppTheme.accentPrimary,
                                            ),
                                            const SizedBox(width: 6),
                                            ConstrainedBox(
                                              constraints: const BoxConstraints(maxWidth: 210),
                                              child: Text(
                                                label,
                                                style: TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppTheme.textSecondary,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ],
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

class _LetterPill extends StatelessWidget {
  const _LetterPill({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? AppTheme.accentPrimary : AppTheme.bgSurface,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(
              color: isSelected ? AppTheme.accentPrimary : AppTheme.borderSubtle,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isSelected ? Colors.white : AppTheme.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _WordEditorSheet extends ConsumerStatefulWidget {
  const _WordEditorSheet({this.existingWord});

  final GlossaryWord? existingWord;

  @override
  ConsumerState<_WordEditorSheet> createState() => _WordEditorSheetState();
}

class _WordEditorSheetState extends ConsumerState<_WordEditorSheet> {
  late final TextEditingController _wordController;
  late final TextEditingController _definitionController;
  final TextEditingController _bookSearchController = TextEditingController();
  String _bookSearchQuery = '';
  final Set<int> _selectedBookIds = <int>{};
  bool _submitting = false;

  bool get _isEditing => widget.existingWord != null;

  @override
  void initState() {
    super.initState();
    _wordController = TextEditingController(text: widget.existingWord?.word ?? '');
    _definitionController = TextEditingController(text: widget.existingWord?.definition ?? '');
    if (widget.existingWord != null) {
      for (final b in widget.existingWord!.books) {
        if (b.id != null) {
          _selectedBookIds.add(b.id!);
        }
      }
    }
  }

  @override
  void dispose() {
    _wordController.dispose();
    _definitionController.dispose();
    _bookSearchController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final word = _wordController.text.trim();
    final definition = _definitionController.text.trim();
    if (word.isEmpty || definition.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Veuillez renseigner le mot et sa définition'),
          backgroundColor: AppTheme.accentAmber,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      if (_isEditing) {
        await ref.read(wordsControllerProvider.notifier).updateWord(
              id: widget.existingWord!.id,
              word: word,
              definition: definition,
              bookIds: _selectedBookIds.toList(),
            );
      } else {
        await ref.read(wordsControllerProvider.notifier).createWord(
              word: word,
              definition: definition,
              bookIds: _selectedBookIds.toList(),
            );
      }

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditing ? 'Terme mis à jour' : 'Terme ajouté au glossaire'),
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
                  _isEditing ? 'Modifier le terme' : 'Nouveau terme',
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

            Text(
              'Terme / Mot *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _wordController,
              style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Ex: Épice, Géne Béné Gesserit, Chakra...',
              ),
            ),
            const SizedBox(height: 14),

            Text(
              'Définition *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _definitionController,
              minLines: 4,
              maxLines: 8,
              style: TextStyle(color: AppTheme.textPrimary, fontSize: 14, height: 1.45),
              decoration: const InputDecoration(
                hintText: 'Rédigez la définition ou l\'explication du terme...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 14),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Livres associés',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textSecondary,
                  ),
                ),
                if (_selectedBookIds.isNotEmpty)
                  Text(
                    '${_selectedBookIds.length} sélectionné${_selectedBookIds.length > 1 ? 's' : ''}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.accentPrimary,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),

            // Selected books chips
            selectableBooksAsync.when(
              loading: () => Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: CircularProgressIndicator(color: AppTheme.accentPrimary),
                ),
              ),
              error: (err, _) => Text(
                'Impossible de charger les livres : $err',
                style: TextStyle(fontSize: 12, color: AppTheme.accentRed),
              ),
              data: (books) {
                final bookMap = <int, Book>{
                  for (final b in books)
                    if (b.id != null) b.id!: b,
                };
                if (widget.existingWord != null) {
                  for (final b in widget.existingWord!.books) {
                    if (b.id != null) {
                      bookMap.putIfAbsent(b.id!, () => b);
                    }
                  }
                }

                final selectedBooks = _selectedBookIds
                    .map((id) => bookMap[id])
                    .whereType<Book>()
                    .toList();

                final q = _bookSearchQuery.trim().toLowerCase();
                final matches = q.isEmpty
                    ? books
                    : books.where((b) {
                        return b.title.toLowerCase().contains(q) ||
                            b.series.toLowerCase().contains(q) ||
                            b.author.toLowerCase().contains(q);
                      }).toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (selectedBooks.isNotEmpty) ...[
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: selectedBooks.map((b) {
                          return InputChip(
                            label: Text(
                              b.volume != null ? '${b.title} (T.${b.volume})' : b.title,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.accentPrimary,
                              ),
                            ),
                            selected: true,
                            selectedColor: AppTheme.accentPrimaryLight,
                            deleteIconColor: AppTheme.accentPrimary,
                            onDeleted: () {
                              setState(() => _selectedBookIds.remove(b.id));
                            },
                            visualDensity: VisualDensity.compact,
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),
                    ],
                    TextField(
                      controller: _bookSearchController,
                      onChanged: (val) => setState(() => _bookSearchQuery = val),
                      style: TextStyle(color: AppTheme.textPrimary, fontSize: 13.5),
                      decoration: InputDecoration(
                        hintText: 'Rechercher un ou plusieurs livres à associer...',
                        prefixIcon:
                            Icon(Icons.search_rounded, color: AppTheme.accentPrimary, size: 18),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      constraints: const BoxConstraints(maxHeight: 165),
                      decoration: BoxDecoration(
                        color: AppTheme.bgPrimary,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(color: AppTheme.borderSubtle),
                      ),
                      child: matches.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.all(14),
                              child: Center(
                                child: Text(
                                  'Aucun livre trouvé',
                                  style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                ),
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              itemCount: matches.length,
                              separatorBuilder: (_, _) =>
                                  Divider(height: 1, color: AppTheme.borderSubtle),
                              itemBuilder: (context, idx) {
                                final b = matches[idx];
                                final isSelected =
                                    b.id != null && _selectedBookIds.contains(b.id!);
                                return ListTile(
                                  dense: true,
                                  contentPadding:
                                      const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                                  leading: BookCover(
                                    book: b,
                                    width: 28,
                                    height: 42,
                                    borderRadius: 5,
                                  ),
                                  title: Text(
                                    b.title,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight:
                                          isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: isSelected
                                          ? AppTheme.accentPrimary
                                          : AppTheme.textPrimary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  subtitle: b.series.isNotEmpty
                                      ? Text(
                                          b.volume != null
                                              ? '${b.series} • T.${b.volume}'
                                              : b.series,
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: AppTheme.textMuted,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        )
                                      : null,
                                  trailing: Icon(
                                    isSelected
                                        ? Icons.check_circle_rounded
                                        : Icons.radio_button_unchecked_rounded,
                                    size: 20,
                                    color: isSelected
                                        ? AppTheme.accentPrimary
                                        : AppTheme.textMuted,
                                  ),
                                  onTap: () {
                                    if (b.id == null) return;
                                    setState(() {
                                      if (isSelected) {
                                        _selectedBookIds.remove(b.id!);
                                      } else {
                                        _selectedBookIds.add(b.id!);
                                      }
                                    });
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                );
              },
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
                    : Icon(_isEditing ? Icons.check_rounded : Icons.add_rounded, size: 18),
                label: Text(_isEditing ? 'Enregistrer les modifications' : 'Ajouter au glossaire'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
