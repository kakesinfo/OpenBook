import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/reading_session.dart';

class BookReadingHistoryPage extends ConsumerWidget {
  const BookReadingHistoryPage({
    super.key,
    required this.book,
  });

  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(readingSessionsForBookProvider(book));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Historique des sessions'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        children: [
          Text(
            book.title,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Toutes les sessions de lecture enregistrées pour cet ouvrage.',
            style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 20),
          _ReadingSessionsHistoryCard(sessionsAsync: sessionsAsync),
        ],
      ),
    );
  }
}

class _ReadingSessionsHistoryCard extends ConsumerWidget {
  const _ReadingSessionsHistoryCard({required this.sessionsAsync});

  final AsyncValue<List<ReadingSession>> sessionsAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: sessionsAsync.when(
        loading: () => const SizedBox(
          height: 56,
          child: Center(child: CircularProgressIndicator(color: AppTheme.accentPrimary)),
        ),
        error: (error, _) => Text(
          'Impossible de charger les sessions : $error',
          style: const TextStyle(color: AppTheme.accentRed),
        ),
        data: (sessions) {
          if (sessions.isEmpty) {
            return Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: AppTheme.borderSubtle, width: 1),
              ),
              child: const Column(
                children: [
                  Icon(Icons.history_rounded, size: 36, color: AppTheme.textMuted),
                  SizedBox(height: 12),
                  Text(
                    'Aucune session enregistrée pour ce livre.',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }

          final sortedSessions = [...sessions]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
          final timelineSessions = _buildTimelineSessions(sortedSessions);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...List.generate(timelineSessions.length, (index) {
                final item = timelineSessions[index];
                final session = item.session;
                final isStart = session.type == ReadingSessionType.start;
                final isEnd = session.type == ReadingSessionType.end;
                final date = session.createdAt;
                final day = date.day.toString().padLeft(2, '0');
                final month = date.month.toString().padLeft(2, '0');
                final year = date.year.toString();
                final hour = date.hour.toString().padLeft(2, '0');
                final minute = date.minute.toString().padLeft(2, '0');
                final duration = Duration(seconds: session.totalSecondsRead);
                final durationLabel =
                    '${duration.inHours.toString().padLeft(2, '0')}:${duration.inMinutes.remainder(60).toString().padLeft(2, '0')}:${duration.inSeconds.remainder(60).toString().padLeft(2, '0')}';

                final itemColor = isStart
                    ? AppTheme.accentPrimaryLight
                    : isEnd
                        ? const Color(0x1F10B981)
                        : AppTheme.bgSurface;

                final chipColor = isStart
                    ? AppTheme.accentPrimaryLight
                    : isEnd
                        ? const Color(0x2810B981)
                        : const Color(0x1AFFFFFF);

                final chipTextColor = isStart
                    ? AppTheme.accentPrimary
                    : isEnd
                        ? const Color(0xFF34D399)
                        : AppTheme.textSecondary;

                final leadingIcon = isStart
                    ? Icons.play_arrow_rounded
                    : isEnd
                        ? Icons.flag_rounded
                        : Icons.menu_book_rounded;

                final connectsUp =
                    item.inTimeline && index > 0 && timelineSessions[index - 1].inTimeline;
                final connectsDown = item.inTimeline &&
                    index < timelineSessions.length - 1 &&
                    timelineSessions[index + 1].inTimeline;

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _TimelineMarker(
                        lineColor: item.inTimeline
                            ? AppTheme.accentPrimary.withValues(alpha: 0.9)
                            : AppTheme.borderSubtle,
                        baseLineColor: AppTheme.borderSubtle,
                        dotColor: item.inTimeline ? AppTheme.accentPrimary : AppTheme.textMuted,
                        drawTop: connectsUp,
                        drawBottom: connectsDown,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.fromLTRB(14, 12, 8, 10),
                            decoration: BoxDecoration(
                              color: itemColor,
                              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                              border: Border.all(color: AppTheme.borderSubtle, width: 1),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(leadingIcon, size: 18, color: chipTextColor),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '$day/$month/$year à $hour:$minute',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: AppTheme.textPrimary,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: chipColor,
                                        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                                      ),
                                      child: Text(
                                        session.type.label,
                                        style: TextStyle(
                                          color: chipTextColor,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                    if (isStart || isEnd)
                                      IconButton(
                                        tooltip: 'Supprimer la session',
                                        icon: const Icon(
                                          Icons.delete_outline_rounded,
                                          size: 18,
                                          color: AppTheme.textMuted,
                                        ),
                                        onPressed: () async {
                                          await ref
                                              .read(booksControllerProvider.notifier)
                                              .deleteReadingSession(
                                                session: session,
                                              );
                                        },
                                      ),
                                  ],
                                ),
                                if (!isStart && !isEnd) ...[
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Page ${session.currentPage}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.textSecondary,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        durationLabel,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppTheme.textMuted,
                                        ),
                                      ),
                                      IconButton(
                                        tooltip: 'Supprimer la session',
                                        icon: const Icon(
                                          Icons.delete_outline_rounded,
                                          size: 18,
                                          color: AppTheme.textMuted,
                                        ),
                                        onPressed: () async {
                                          await ref
                                              .read(booksControllerProvider.notifier)
                                              .deleteReadingSession(
                                                session: session,
                                              );
                                        },
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}

class _TimelineSession {
  const _TimelineSession({
    required this.session,
    required this.inTimeline,
  });

  final ReadingSession session;
  final bool inTimeline;
}

List<_TimelineSession> _buildTimelineSessions(List<ReadingSession> sortedSessions) {
  var inRange = false;
  final items = <_TimelineSession>[];

  for (final session in sortedSessions) {
    final isEnd = session.type == ReadingSessionType.end;
    final isStart = session.type == ReadingSessionType.start;

    if (isEnd) {
      inRange = true;
    }

    final isInTimeline = inRange;
    items.add(_TimelineSession(session: session, inTimeline: isInTimeline));

    if (isStart && inRange) {
      inRange = false;
    }
  }

  return items;
}

class _TimelineMarker extends StatelessWidget {
  const _TimelineMarker({
    required this.lineColor,
    required this.baseLineColor,
    required this.dotColor,
    required this.drawTop,
    required this.drawBottom,
  });

  final Color lineColor;
  final Color baseLineColor;
  final Color dotColor;
  final bool drawTop;
  final bool drawBottom;

  @override
  Widget build(BuildContext context) {
    const markerWidth = 20.0;
    const lineWidth = 3.0;
    const dotSize = 12.0;
    final segment = Expanded(
      child: Center(
        child: Container(
          width: lineWidth,
          color: lineColor,
        ),
      ),
    );

    return SizedBox(
      width: markerWidth,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Center(
            child: Container(
              width: lineWidth,
              color: baseLineColor,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.max,
            children: [
              if (drawTop) segment else const Spacer(),
              SizedBox(
                width: markerWidth,
                height: dotSize,
                child: Center(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: dotColor,
                      shape: BoxShape.circle,
                    ),
                    child: const SizedBox.square(dimension: dotSize),
                  ),
                ),
              ),
              if (drawBottom) segment else const Spacer(),
            ],
          ),
        ],
      ),
    );
  }
}
