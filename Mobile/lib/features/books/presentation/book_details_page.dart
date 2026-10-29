import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_reading_history_page.dart';
import 'book_reading_session_page.dart';
import 'components/book_cover.dart';

class BookDetailsPage extends ConsumerWidget {
  const BookDetailsPage({
    super.key,
    required this.book,
  });

  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loadedBooks = ref.watch(booksControllerProvider).value ?? const <Book>[];
    final activeBook = loadedBooks.firstWhere(
      (item) => item.id == book.id,
      orElse: () => book,
    );

    final isWishlisted = activeBook.status == BookStatus.wishlist;
    final isOwned = activeBook.isOwned;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Détail du livre'),
        actions: [
          IconButton(
            tooltip: 'Historique des sessions',
            icon: const Icon(Icons.history_rounded),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookReadingHistoryPage(book: activeBook),
                ),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            color: AppTheme.bgElevated,
            onSelected: (value) async {
              if (value == 'delete') {
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
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete_outline_rounded, color: AppTheme.accentRed, size: 20),
                    SizedBox(width: 8),
                    Text('Supprimer le livre', style: TextStyle(color: AppTheme.accentRed)),
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
          // Centered Cover with shadow
          Center(
            child: BookCover(
              book: activeBook,
              width: 170,
              height: 250,
              borderRadius: AppTheme.radiusLg,
            ),
          ),
          const SizedBox(height: 20),

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
                          : AppTheme.accentPrimary),
                  bgColor: isWishlisted
                      ? AppTheme.accentRoseLight
                      : (activeBook.status == BookStatus.reading
                          ? AppTheme.accentAmberLight
                          : AppTheme.accentPrimaryLight),
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
                    bgColor: const Color(0x1AFFFFFF),
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

          // Action Buttons matching Web Client (Wishlist toggle & Collection toggle)
          Row(
            children: [
              Expanded(
                child: _BookActionButton(
                  icon: Icons.favorite_rounded,
                  label: isWishlisted ? 'Dans les souhaits' : 'Liste de souhaits',
                  isActive: isWishlisted,
                  activeColor: AppTheme.accentRose,
                  activeBgColor: AppTheme.accentRoseLight,
                  activeBorderColor: AppTheme.accentRoseBorder,
                  onPressed: () async {
                    final targetStatus =
                        isWishlisted ? BookStatus.unread : BookStatus.wishlist;
                    await ref.read(booksControllerProvider.notifier).updateBookStatus(
                          activeBook,
                          targetStatus,
                        );
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _BookActionButton(
                  icon: Icons.collections_bookmark_rounded,
                  label: isOwned ? 'Dans la collection' : 'Ajouter à la collection',
                  isActive: isOwned,
                  activeColor: AppTheme.accentPrimary,
                  activeBgColor: AppTheme.accentPrimaryLight,
                  activeBorderColor: AppTheme.accentPrimary.withValues(alpha: 0.3),
                  onPressed: () async {
                    final targetStatus = isOwned ? BookStatus.wishlist : BookStatus.unread;
                    await ref.read(booksControllerProvider.notifier).updateBookStatus(
                          activeBook,
                          targetStatus,
                        );
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Detailed Status Buttons
          _BookStatusActions(
            book: activeBook,
            onStatusSelected: (status) async {
              await ref.read(booksControllerProvider.notifier).updateBookStatus(
                    activeBook,
                    status,
                  );
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
                    SizedBox(width: 8),
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
                      : 'Non renseigné',
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
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x4D10B981),
                    blurRadius: 14,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  onTap: () async {
                    await ref
                        .read(booksControllerProvider.notifier)
                        .startReadingSession(book: activeBook);
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
            Container(
              height: 48,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x4D10B981),
                    blurRadius: 14,
                    offset: Offset(0, 4),
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

class _BookActionButton extends StatelessWidget {
  const _BookActionButton({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.activeColor,
    required this.activeBgColor,
    required this.activeBorderColor,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final Color activeColor;
  final Color activeBgColor;
  final Color activeBorderColor;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: isActive ? activeBgColor : AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: isActive ? activeBorderColor : AppTheme.borderSubtle,
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isActive ? Icons.check_rounded : icon,
                  size: 18,
                  color: isActive ? activeColor : AppTheme.textSecondary,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isActive ? activeColor : AppTheme.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
    final actions = <_StatusActionData>[
      const _StatusActionData(
        status: BookStatus.read,
        label: 'Lu',
        icon: Icons.check_circle_outline,
      ),
      const _StatusActionData(
        status: BookStatus.reading,
        label: 'En cours',
        icon: Icons.auto_stories_outlined,
      ),
      const _StatusActionData(
        status: BookStatus.lent,
        label: 'Prêté',
        icon: Icons.handshake_outlined,
      ),
      const _StatusActionData(
        status: BookStatus.sold,
        label: 'Vendu',
        icon: Icons.sell_outlined,
      ),
    ];

    return Wrap(
      spacing: 12,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: actions
          .map(
            (action) => _RoundStatusButton(
              label: action.label,
              icon: action.icon,
              selected: book.status == action.status,
              onPressed: () async {
                final targetStatus =
                    action.status == BookStatus.read && book.status == BookStatus.read
                        ? BookStatus.unread
                        : action.status;
                await onStatusSelected(targetStatus);
              },
            ),
          )
          .toList(),
    );
  }
}

class _StatusActionData {
  const _StatusActionData({
    required this.status,
    required this.label,
    required this.icon,
  });

  final BookStatus status;
  final String label;
  final IconData icon;
}

class _RoundStatusButton extends StatelessWidget {
  const _RoundStatusButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final fillColor = selected ? AppTheme.accentPrimaryLight : AppTheme.bgSurface;
    final iconColor = selected ? AppTheme.accentPrimary : AppTheme.textMuted;
    final borderColor = selected
        ? AppTheme.accentPrimary.withValues(alpha: 0.4)
        : AppTheme.borderSubtle;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: fillColor,
            shape: BoxShape.circle,
            border: Border.all(color: borderColor, width: 1),
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
          style: TextStyle(
            fontSize: 11,
            color: selected ? AppTheme.accentPrimary : AppTheme.textSecondary,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
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


