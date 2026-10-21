import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/books_providers.dart';
import '../../data/book.dart';
import 'book_cover.dart';

class BookCard extends ConsumerWidget {
  const BookCard({
    super.key,
    required this.book,
    required this.onEdit,
    this.onRecordSession,
  });

  final Book book;
  final VoidCallback onEdit;
  final VoidCallback? onRecordSession;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progressAsync = ref.watch(readingProgressByBookProvider(book));
    final progress = progressAsync.value ?? ReadingProgress.empty(totalPages: book.totalPages);
    final totalPages = progress.totalPages ?? 0;
    final currentPage = progress.currentPage;
    final startedAt = book.startedAt;

    final daysReading = startedAt == null
        ? 0
        : DateTime.now().difference(DateTime(startedAt.year, startedAt.month, startedAt.day)).inDays + 1;

    final remainingTime = (progress.totalSecondsRead > 0 && totalPages > currentPage && currentPage > 0)
      ? ((totalPages - currentPage) * (progress.totalSecondsRead / currentPage)).round()
      : null;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  daysReading <= 0 ? 'Debut non defini' : '$daysReading jours en lecture',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.black54,
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                totalPages <= 0
                    ? 'p. $currentPage'
                    : 'p. $currentPage / $totalPages',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: SizedBox(
            width: double.infinity,
            height: 130,
            child: Card(
              margin: EdgeInsets.zero,
              clipBehavior: Clip.none,
              child: InkWell(
                onTap: onEdit,
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                        child: LinearProgressIndicator(
                          value: totalPages <= 0 ? 0.0 : progress.progress,
                          minHeight: 12,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(104, 22, 72, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: [
                          Text(
                            book.title,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            book.series.isEmpty
                                ? 'Hors serie'
                                : (book.volume == null ? book.series : '${book.series} • Tome ${book.volume}'),
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            remainingTime == null
                                ? 'Temps de lecture indéfini'
                                : '${Duration(seconds: remainingTime).inHours}h ${Duration(seconds: remainingTime).inMinutes.remainder(60)}m restants',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      left: 14,
                      bottom: -14,
                      child: BookCover(
                        book: book,
                        width: 76,
                        height: 112,
                        borderRadius: 10,
                      ),
                    ),
                    if (onRecordSession != null)
                      Positioned(
                        right: 14,
                        bottom: -14,
                        child: Material(
                          elevation: 2,
                          color: Theme.of(context).colorScheme.primaryContainer,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: onRecordSession,
                            child: const SizedBox(
                              width: 48,
                              height: 48,
                              child: Icon(Icons.edit_outlined),
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
      ],
    );
  }
}
