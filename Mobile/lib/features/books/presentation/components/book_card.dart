import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
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

    final seriesText = book.series.isEmpty
        ? 'Hors série'
        : (book.volume == null ? book.series : '${book.series} • Tome ${book.volume}');

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.timer_outlined, size: 14, color: AppTheme.textMuted),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        daysReading <= 0 ? 'Début non défini' : '$daysReading jours en lecture',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textMuted,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.accentPrimaryLight,
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  border: Border.all(
                    color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Text(
                  totalPages <= 0 ? 'p. $currentPage' : 'p. $currentPage / $totalPages',
                  style: const TextStyle(
                    color: AppTheme.accentPrimary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Container(
            width: double.infinity,
            height: 140,
            decoration: BoxDecoration(
              gradient: AppTheme.cardGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x66000000),
                  blurRadius: 16,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onEdit,
                borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // Top Progress Bar
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(AppTheme.radiusLg),
                        ),
                        child: LinearProgressIndicator(
                          value: totalPages <= 0 ? 0.0 : progress.progress,
                          minHeight: 4,
                          backgroundColor: AppTheme.borderSubtle,
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            AppTheme.accentPrimary,
                          ),
                        ),
                      ),
                    ),
                    // Content Info
                    Padding(
                      padding: const EdgeInsets.fromLTRB(112, 18, 72, 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            book.title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                              letterSpacing: -0.01,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            seriesText,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(
                                Icons.access_time_rounded,
                                size: 13,
                                color: AppTheme.textMuted,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  remainingTime == null
                                      ? 'Temps restant indéfini'
                                      : '${Duration(seconds: remainingTime).inHours}h ${Duration(seconds: remainingTime).inMinutes.remainder(60)}m restants',
                                  style: const TextStyle(
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
                    // Overlapping Book Cover
                    Positioned(
                      left: 14,
                      bottom: -12,
                      child: BookCover(
                        book: book,
                        width: 82,
                        height: 124,
                        borderRadius: AppTheme.radiusMd,
                      ),
                    ),
                    // Quick Action Button (log session)
                    if (onRecordSession != null)
                      Positioned(
                        right: 14,
                        bottom: -10,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: AppTheme.primaryGradient,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.accentPrimary.withValues(alpha: 0.35),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Material(
                            color: Colors.transparent,
                            shape: const CircleBorder(),
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: onRecordSession,
                              child: const SizedBox(
                                width: 44,
                                height: 44,
                                child: Icon(
                                  Icons.edit_note_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                              ),
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
