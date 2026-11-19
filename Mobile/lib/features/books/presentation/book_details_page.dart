import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/books_repository.dart';
import 'book_purchase_history_page.dart';
import 'book_reading_history_page.dart';
import 'book_reading_session_page.dart';
import 'components/app_header.dart';
import 'components/book_completion_dialog.dart';
import 'components/book_cover.dart';
import 'components/common_reading_ribbon.dart';
import 'components/edit_book_sheet.dart';
import 'components/reading_timer_modal.dart';
import 'components/start_reading_sheet.dart';

class BookDetailsPage extends ConsumerWidget {
  const BookDetailsPage({
    super.key,
    required this.book,
  });

  final Book book;

  void _navigateToBook(
    BuildContext context,
    WidgetRef ref,
    int targetBookId,
    Map<String, dynamic>? summaryData,
  ) {
    final loadedBooks = ref.read(booksControllerProvider).value ?? const <Book>[];
    Book? targetBook;
    for (final b in loadedBooks) {
      if (b.id == targetBookId) {
        targetBook = b;
        break;
      }
    }

    targetBook ??= Book(
      id: targetBookId,
      title: summaryData?['title']?.toString() ?? 'Album',
      author: summaryData?['author']?.toString() ?? '',
      series: summaryData?['seriesName']?.toString() ?? '',
      volume: (summaryData?['volume'] as num?)?.toInt(),
      coverUrl: BooksRepository.resolveCoverUrl(
        summaryData?['coverUrl']?.toString(),
        ref.read(apiClientProvider).baseUrl,
      ),
      status: BookStatus.unread,
    );

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => BookDetailsPage(book: targetBook!),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loadedBooks = ref.watch(booksControllerProvider).value ?? const <Book>[];
    final activeBook = loadedBooks.firstWhere(
      (item) => item.id == book.id,
      orElse: () => book,
    );

    final bookDetailsAsync = activeBook.id != null
        ? ref.watch(bookDetailsProvider(activeBook.id!))
        : const AsyncValue<Map<String, dynamic>>.data({});
    final bookDetails = bookDetailsAsync.value;

    final progressAsync = ref.watch(readingProgressByBookProvider(activeBook));
    final isCommonReading = progressAsync.value?.isCommon ?? false;

    int? prevId = (bookDetails?['previousBookId'] as num?)?.toInt();
    Map<String, dynamic>? prevBook = bookDetails?['previousBook'] as Map<String, dynamic>?;
    int? nextId = (bookDetails?['nextBookId'] as num?)?.toInt();
    Map<String, dynamic>? nxtBook = bookDetails?['nextBook'] as Map<String, dynamic>?;

    if (prevId == null && activeBook.series.isNotEmpty && activeBook.volume != null && activeBook.volume! > 1) {
      for (final b in loadedBooks) {
        if (b.series.toLowerCase() == activeBook.series.toLowerCase() && b.volume == activeBook.volume! - 1) {
          prevId = b.id;
          prevBook = {'title': b.title, 'volume': b.volume, 'coverUrl': b.coverUrl};
          break;
        }
      }
    }
    if (nextId == null && activeBook.series.isNotEmpty && activeBook.volume != null) {
      for (final b in loadedBooks) {
        if (b.series.toLowerCase() == activeBook.series.toLowerCase() && b.volume == activeBook.volume! + 1) {
          nextId = b.id;
          nxtBook = {'title': b.title, 'volume': b.volume, 'coverUrl': b.coverUrl};
          break;
        }
      }
    }

    final seriesMap = bookDetails?['series'] as Map<String, dynamic>?;
    final totalVolumes = (seriesMap?['totalVolumes'] as num?)?.toInt();

    final hasPrevious = prevId != null;
    final canHavePrevious = activeBook.series.isNotEmpty && activeBook.volume != null && activeBook.volume! > 1;
    final showPrevious = hasPrevious || canHavePrevious;

    final hasNext = nextId != null;
    final canHaveNext = activeBook.series.isNotEmpty &&
        activeBook.volume != null &&
        (totalVolumes != null ? activeBook.volume! < totalVolumes : true);
    final showNext = hasNext || canHaveNext;

    final isWishlisted = activeBook.status == BookStatus.wishlist;

    return Scaffold(
      appBar: AppHeader(
        title: 'Détail de l\'album',
        subtitle: activeBook.series.isNotEmpty
            ? (activeBook.volume != null ? '${activeBook.series} • Tome ${activeBook.volume}' : activeBook.series)
            : (activeBook.author.isNotEmpty ? activeBook.author : null),
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            tooltip: 'Historique des sessions',
            icon: Icon(Icons.history_rounded, color: AppTheme.textPrimary),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookReadingHistoryPage(book: activeBook),
                ),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert_rounded, color: AppTheme.textPrimary),
            tooltip: 'Menu de l\'album',
            color: AppTheme.bgElevated,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              side: BorderSide(color: AppTheme.borderSubtle),
            ),
            onSelected: (value) async {
              if (value == 'history') {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => BookPurchaseHistoryPage(book: activeBook),
                  ),
                );
              } else if (value == 'edit') {
                showEditBookSheet(
                  context,
                  book: activeBook,
                  initialDetails: bookDetails,
                );
              } else if (value == 'delete') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Supprimer ce livre ?'),
                    content: Text(
                      'Êtes-vous sûr de vouloir supprimer « ${activeBook.title} » ? Cette action est irréversible.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        child: const Text('Annuler'),
                      ),
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: AppTheme.accentRed),
                        onPressed: () => Navigator.of(ctx).pop(true),
                        child: const Text('Supprimer'),
                      ),
                    ],
                  ),
                );

                if (confirm == true && context.mounted) {
                  await ref.read(booksControllerProvider.notifier).deleteBook(activeBook);
                  if (context.mounted) {
                    Navigator.of(context).pop();
                  }
                }
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'history',
                child: Row(
                  children: [
                    Icon(Icons.receipt_long_rounded, color: AppTheme.accentPrimary, size: 20),
                    const SizedBox(width: 10),
                    Text(
                      'Historique d\'achat',
                      style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'edit',
                child: Row(
                  children: [
                    Icon(Icons.edit_outlined, color: AppTheme.accentPrimary, size: 20),
                    const SizedBox(width: 10),
                    Text(
                      'Modifier les informations',
                      style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete_outline_rounded, color: AppTheme.accentRed, size: 20),
                    const SizedBox(width: 10),
                    Text(
                      'Supprimer le livre',
                      style: TextStyle(color: AppTheme.accentRed, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
        children: [
          // Centered Cover with previous / next volume arrows on each side
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (showPrevious || showNext) ...[
                _VolumeNavArrow(
                  icon: Icons.chevron_left_rounded,
                  tooltip: hasPrevious
                      ? (prevBook?['title'] != null
                          ? 'Tome précédent : ${prevBook!['title']}'
                          : 'Tome précédent')
                      : (canHavePrevious
                          ? 'Tome précédent non disponible dans la bibliothèque'
                          : ''),
                  isEnabled: hasPrevious,
                  isVisible: showPrevious,
                  onPressed: hasPrevious
                      ? () => _navigateToBook(context, ref, prevId!, prevBook)
                      : null,
                ),
                const SizedBox(width: 12),
              ],
              Stack(
                children: [
                  BookCover(
                    book: activeBook,
                    width: 170,
                    height: 250,
                    borderRadius: AppTheme.radiusLg,
                  ),
                  if (isCommonReading)
                    const Positioned(
                      top: 0,
                      left: 8,
                      child: CommonReadingRibbon(),
                    ),
                ],
              ),
              if (showPrevious || showNext) ...[
                const SizedBox(width: 12),
                _VolumeNavArrow(
                  icon: Icons.chevron_right_rounded,
                  tooltip: hasNext
                      ? (nxtBook?['title'] != null
                          ? 'Tome suivant : ${nxtBook!['title']}'
                          : 'Tome suivant')
                      : (canHaveNext
                          ? 'Tome suivant non disponible dans la bibliothèque'
                          : ''),
                  isEnabled: hasNext,
                  isVisible: showNext,
                  onPressed: hasNext
                      ? () => _navigateToBook(context, ref, nextId!, nxtBook)
                      : null,
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),

          // Badges / Tags row (similar to BookPage.tsx)
          Center(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                _TagPill(
                  label: activeBook.status.label,
                  color: isWishlisted
                      ? AppTheme.accentRose
                      : (activeBook.status == BookStatus.reading
                          ? AppTheme.accentAmber
                          : (activeBook.status == BookStatus.paused
                              ? AppTheme.textSecondary
                              : (activeBook.status == BookStatus.abandoned
                                  ? AppTheme.accentRed
                                  : AppTheme.accentPrimary))),
                  bgColor: isWishlisted
                      ? AppTheme.accentRoseLight
                      : (activeBook.status == BookStatus.reading
                          ? AppTheme.accentAmberLight
                          : (activeBook.status == BookStatus.paused
                              ? AppTheme.bgElevated
                              : (activeBook.status == BookStatus.abandoned
                                  ? AppTheme.accentRedLight
                                  : AppTheme.accentPrimaryLight))),
                ),
                if (activeBook.volume != null && activeBook.volume! > 0)
                  _TagPill(
                    label: 'Tome ${activeBook.volume}',
                    color: AppTheme.accentSecondary,
                    bgColor: AppTheme.accentSecondaryLight,
                  ),
                if (activeBook.series.isNotEmpty)
                  _TagPill(
                    label: activeBook.series,
                    color: AppTheme.textSecondary,
                    bgColor: AppTheme.bgElevated,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Title & Author
          Center(
            child: Text(
              activeBook.title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppTheme.textPrimary,
                letterSpacing: -0.02,
              ),
            ),
          ),
          if (activeBook.author.isNotEmpty) ...[
            const SizedBox(height: 6),
            Center(
              child: Text(
                'Par ${activeBook.author}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.textSecondary,
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),

          // Status Action Buttons (Collection, Souhaits, Lu, En cours, Vendu)
          _BookStatusActions(
            book: activeBook,
            onStatusSelected: (status) async {
              await ref.read(booksControllerProvider.notifier).updateBookStatus(
                    activeBook,
                    status,
                  );
              if (status == BookStatus.read && context.mounted) {
                await BookCompletionDialog.show(context, activeBook);
              }
            },
          ),
          const SizedBox(height: 20),

          // Technical Details Card matching BookPage.tsx
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppTheme.cardGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.tune_rounded, size: 18, color: AppTheme.accentPrimary),
                    const SizedBox(width: 8),
                    Text(
                      'Détails techniques',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.01,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 12),
                _SpecItem(
                  icon: Icons.person_outline_rounded,
                  label: 'Auteur',
                  value: activeBook.author.isEmpty ? 'Non renseigné' : activeBook.author,
                ),
                _SpecItem(
                  icon: Icons.auto_stories_outlined,
                  label: 'Série',
                  value: activeBook.series.isEmpty ? 'Hors série' : activeBook.series,
                ),
                if (activeBook.volume != null)
                  _SpecItem(
                    icon: Icons.bookmark_outline_rounded,
                    label: 'Tome',
                    value: 'Tome ${activeBook.volume}',
                  ),
                _SpecItem(
                  icon: Icons.description_outlined,
                  label: 'Pages totales',
                  value: activeBook.totalPages != null && activeBook.totalPages! > 0
                      ? '${activeBook.totalPages} pages'
                      : (bookDetails?['pageCount'] != null && (bookDetails!['pageCount'] as num) > 0
                          ? '${bookDetails['pageCount']} pages'
                          : 'Non renseigné'),
                ),
                if (bookDetails?['isbn'] != null && bookDetails!['isbn'].toString().trim().isNotEmpty)
                  _SpecItem(
                    icon: Icons.qr_code_rounded,
                    label: 'ISBN / EAN',
                    value: bookDetails['isbn'].toString().trim(),
                  ),
                _SpecItem(
                  icon: Icons.flag_outlined,
                  label: 'Statut',
                  value: activeBook.status.label,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Reading Action CTA
          if (_canStartReading(activeBook.status)) ...[
            Container(
              height: 48,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.accentPrimaryGlow,
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  onTap: () async {
                    final result = await StartReadingSheet.show(context);
                    if (result == null || !context.mounted) {
                      return;
                    }
                    await ref
                        .read(booksControllerProvider.notifier)
                        .startReadingSession(
                          book: activeBook,
                          startedAt: result.startedAt,
                          isCommon: result.isCommon,
                        );
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_arrow_rounded, color: Colors.white, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Commencer à lire',
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
          ] else if (activeBook.isCurrentlyReading) ...[
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: AppTheme.primaryGradient,
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.accentPrimaryGlow,
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => BookReadingSessionPage(book: activeBook),
                            ),
                          );
                        },
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.edit_note_rounded, color: Colors.white, size: 22),
                            SizedBox(width: 8),
                            Text(
                              'Enregistrer une session',
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
                ),
                const SizedBox(width: 10),
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    color: AppTheme.bgElevated,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppTheme.borderMedium,
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.25),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => ReadingTimerModal.show(context, activeBook),
                      child: Tooltip(
                        message: 'Chronomètre de lecture',
                        child: Icon(
                          Icons.timer_outlined,
                          color: AppTheme.accentPrimary,
                          size: 22,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _TagPill extends StatelessWidget {
  const _TagPill({
    required this.label,
    required this.color,
    required this.bgColor,
  });

  final String label;
  final Color color;
  final Color bgColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        border: Border.all(color: color.withValues(alpha: 0.3), width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _VolumeNavArrow extends StatelessWidget {
  const _VolumeNavArrow({
    required this.icon,
    required this.tooltip,
    required this.isEnabled,
    required this.isVisible,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final bool isEnabled;
  final bool isVisible;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    if (!isVisible) {
      return const SizedBox(width: 44, height: 44);
    }

    Widget button = Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isEnabled
            ? AppTheme.bgSurface
            : AppTheme.bgSurface.withValues(alpha: 0.35),
        border: Border.all(
          color: isEnabled
              ? AppTheme.borderMedium
              : AppTheme.borderSubtle.withValues(alpha: 0.5),
          width: 1,
        ),
        boxShadow: isEnabled
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: isEnabled ? onPressed : null,
          child: Center(
            child: Icon(
              icon,
              size: 26,
              color: isEnabled
                  ? AppTheme.accentPrimary
                  : AppTheme.textMuted.withValues(alpha: 0.3),
            ),
          ),
        ),
      ),
    );

    if (tooltip.isNotEmpty) {
      button = Tooltip(
        message: tooltip,
        child: button,
      );
    }

    return button;
  }
}

class _BookStatusActions extends StatelessWidget {
  const _BookStatusActions({
    required this.book,
    required this.onStatusSelected,
  });

  final Book book;
  final Future<void> Function(BookStatus status) onStatusSelected;

  @override
  Widget build(BuildContext context) {
    final isWishlisted = book.status == BookStatus.wishlist;
    final isOwned = book.isOwned;

    // Determine current reading status for the selector
    BookStatus currentReadingStatus;
    if (book.status == BookStatus.reading ||
        book.status == BookStatus.read ||
        book.status == BookStatus.paused ||
        book.status == BookStatus.abandoned) {
      currentReadingStatus = book.status;
    } else {
      currentReadingStatus = BookStatus.unread;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Ligne 1 : Boutons ronds Collection et Souhait
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _RoundStatusButton(
              label: 'Collection',
              icon: isOwned
                  ? Icons.collections_bookmark_rounded
                  : Icons.collections_bookmark_outlined,
              selected: isOwned,
              activeColor: AppTheme.accentPrimary,
              activeBgColor: AppTheme.accentPrimaryLight,
              onPressed: () async {
                final targetStatus = isOwned
                    ? (book.status == BookStatus.unread
                        ? BookStatus.wishlist
                        : BookStatus.unread)
                    : BookStatus.unread;
                await onStatusSelected(targetStatus);
              },
            ),
            const SizedBox(width: 28),
            _RoundStatusButton(
              label: 'Souhaits',
              icon: isWishlisted
                  ? Icons.favorite_rounded
                  : Icons.favorite_border_rounded,
              selected: isWishlisted,
              activeColor: AppTheme.accentRose,
              activeBgColor: AppTheme.accentRoseLight,
              onPressed: () async {
                final targetStatus =
                    isWishlisted ? BookStatus.unread : BookStatus.wishlist;
                await onStatusSelected(targetStatus);
              },
            ),
          ],
        ),
        const SizedBox(height: 18),
        // Ligne 2 : Sélecteur de statut de lecture
        Container(
          constraints: const BoxConstraints(maxWidth: 320),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: AppTheme.bgSurface,
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border: Border.all(
              color: isOwned ? AppTheme.accentPrimary.withValues(alpha: 0.35) : AppTheme.borderSubtle,
              width: 1,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<BookStatus>(
              value: currentReadingStatus,
              isExpanded: true,
              dropdownColor: AppTheme.bgSurface,
              icon: Icon(Icons.arrow_drop_down_rounded, color: AppTheme.textSecondary),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              onChanged: (newStatus) async {
                if (newStatus != null && newStatus != book.status) {
                  await onStatusSelected(newStatus);
                }
              },
              items: [
                _buildReadingDropdownItem(
                  status: BookStatus.unread,
                  label: 'Non lu',
                  icon: Icons.menu_book_rounded,
                  color: AppTheme.accentSecondary,
                ),
                _buildReadingDropdownItem(
                  status: BookStatus.reading,
                  label: 'En cours',
                  icon: Icons.auto_stories_rounded,
                  color: AppTheme.accentAmber,
                ),
                _buildReadingDropdownItem(
                  status: BookStatus.read,
                  label: 'Lu',
                  icon: Icons.check_circle_rounded,
                  color: AppTheme.accentPrimary,
                ),
                _buildReadingDropdownItem(
                  status: BookStatus.paused,
                  label: 'En pause',
                  icon: Icons.pause_circle_rounded,
                  color: AppTheme.textSecondary,
                ),
                _buildReadingDropdownItem(
                  status: BookStatus.abandoned,
                  label: 'Abandonné',
                  icon: Icons.do_not_disturb_on_outlined,
                  color: AppTheme.accentRed,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  DropdownMenuItem<BookStatus> _buildReadingDropdownItem({
    required BookStatus status,
    required String label,
    required IconData icon,
    required Color color,
  }) {
    return DropdownMenuItem<BookStatus>(
      value: status,
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundStatusButton extends StatelessWidget {
  const _RoundStatusButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onPressed,
    this.activeColor,
    this.activeBgColor,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onPressed;
  final Color? activeColor;
  final Color? activeBgColor;

  @override
  Widget build(BuildContext context) {
    final effectiveActiveColor = activeColor ?? AppTheme.accentPrimary;
    final effectiveActiveBg = activeBgColor ?? AppTheme.accentPrimaryLight;

    final fillColor = selected ? effectiveActiveBg : AppTheme.bgSurface;
    final iconColor = selected ? effectiveActiveColor : AppTheme.textMuted;
    final borderColor = selected
        ? effectiveActiveColor.withValues(alpha: 0.4)
        : AppTheme.borderSubtle;

    return SizedBox(
      width: 58,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: fillColor,
              shape: BoxShape.circle,
              border: Border.all(color: borderColor, width: 1.5),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: effectiveActiveColor.withValues(alpha: 0.25),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Material(
              color: Colors.transparent,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onPressed,
                child: Center(
                  child: Icon(icon, color: iconColor, size: 22),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: selected ? effectiveActiveColor : AppTheme.textSecondary,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _SpecItem extends StatelessWidget {
  const _SpecItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.textMuted),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppTheme.textSecondary,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

bool _canStartReading(BookStatus status) {
  return status != BookStatus.reading &&
      status != BookStatus.sold &&
      status != BookStatus.lent &&
      status != BookStatus.wishlist;
}
