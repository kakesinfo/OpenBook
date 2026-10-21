import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_reading_history_page.dart';
import 'components/book_cover.dart';
import 'components/book_form_sheet.dart';

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Détail du livre'),
        actions: [
          IconButton(
            tooltip: 'Modifier',
            icon: const Icon(Icons.edit_outlined),
            onPressed: () async {
              final draft = await showBookFormSheet(context, existingBook: activeBook);
              if (draft != null && context.mounted) {
                await ref.read(booksControllerProvider.notifier).saveBook(existingBook: activeBook, draft: draft);
              }
            },
          ),
          IconButton(
            tooltip: 'Historique des sessions',
            icon: const Icon(Icons.history_outlined),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookReadingHistoryPage(book: activeBook),
                ),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        children: [
          Center(
            child: BookCover(
              book: activeBook,
              width: 180,
              height: 260,
              borderRadius: 20,
            ),
          ),
          const SizedBox(height: 24),
          _BookStatusActions(
            book: activeBook,
            onStatusSelected: (status) async {
              await ref.read(booksControllerProvider.notifier).saveBook(
                    existingBook: activeBook,
                    draft: _draftWithStatus(activeBook, status),
                  );
            },
          ),
          const SizedBox(height: 16),
          _InfoCard(
            title: activeBook.title,
            author: activeBook.author,
            series: activeBook.series,
            volume: activeBook.volume,
            totalPages: activeBook.totalPages,
          ),
          const SizedBox(height: 16),
          if (_canStartReading(activeBook.status)) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () async {
                  await ref.read(booksControllerProvider.notifier).startReadingSession(book: activeBook);
                },
                icon: const Icon(Icons.play_arrow_outlined),
                label: const Text('Commencer a lire'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.title,
    required this.author,
    required this.series,
    required this.volume,
    required this.totalPages,
  });

  final String title;
  final String author;
  final String series;
  final int? volume;
  final int? totalPages;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            _InfoLine(label: 'Auteur', value: author.isEmpty ? 'Non renseigné' : author),
            _InfoLine(label: 'Série', value: series.isEmpty ? 'Non renseignée' : series),
            _InfoLine(label: 'Tome', value: volume?.toString() ?? 'Non renseigné'),
            _InfoLine(label: 'Pages totales', value: totalPages?.toString() ?? 'Non renseigné'),
          ],
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
      _StatusActionData(
        status: BookStatus.read,
        label: 'Lu',
        icon: Icons.check_circle_outline,
      ),
      _StatusActionData(
        status: BookStatus.wishlist,
        label: 'Souhaité',
        icon: Icons.favorite_border,
      ),
      _StatusActionData(
        status: BookStatus.lent,
        label: 'Prêté',
        icon: Icons.handshake_outlined,
      ),
      _StatusActionData(
        status: BookStatus.sold,
        label: 'Vendu',
        icon: Icons.sell_outlined,
      ),
    ];

    return Wrap(
      spacing: 16,
      runSpacing: 12,
      alignment: WrapAlignment.center,
      children: actions
          .map(
            (action) => _RoundStatusButton(
              label: action.label,
              icon: action.icon,
              selected: book.status == action.status,
              onPressed: () async {
                final targetStatus = action.status == BookStatus.read && book.status == BookStatus.read
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
    final colorScheme = Theme.of(context).colorScheme;
    final fillColor = selected ? colorScheme.primary : colorScheme.surfaceContainerHighest;
    final iconColor = selected ? colorScheme.onPrimary : colorScheme.onSurfaceVariant;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: fillColor,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPressed,
            child: SizedBox(
              width: 56,
              height: 56,
              child: Icon(icon, color: iconColor, size: 24),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
        ),
      ],
    );
  }
}

bool _canStartReading(BookStatus status) {
  return status != BookStatus.reading &&
      status != BookStatus.sold &&
      status != BookStatus.lent &&
      status != BookStatus.wishlist;
}

BookDraft _draftWithStatus(Book book, BookStatus status) {
  final draft = BookDraft.fromBook(book);
  return BookDraft(
    title: draft.title,
    author: draft.author,
    series: draft.series,
    volume: draft.volume,
    coverUrl: draft.coverUrl,
    coverFilePath: draft.coverFilePath,
    coverSourceType: draft.coverSourceType,
    totalPages: draft.totalPages,
    status: status,
  );
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: RichText(
        text: TextSpan(
          style: Theme.of(context).textTheme.bodyMedium,
          children: [
            TextSpan(
              text: '$label : ',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }
}
