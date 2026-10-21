import 'package:flutter/material.dart';
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
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, stackTrace) => Text(
          'Impossible de charger les sessions: $error',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.redAccent),
        ),
        data: (sessions) {
          if (sessions.isEmpty) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Aucune session enregistree pour ce livre.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                ),
              ],
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

                final colorScheme = Theme.of(context).colorScheme;
                final itemColor = isStart
                    ? colorScheme.primaryContainer.withValues(alpha: 0.35)
                    : isEnd
                        ? Colors.green.withValues(alpha: 0.14)
                        : colorScheme.surfaceContainerLow;
                final chipColor = isStart
                    ? colorScheme.primary.withValues(alpha: 0.14)
                    : isEnd
                        ? Colors.green.withValues(alpha: 0.18)
                        : Colors.black.withValues(alpha: 0.05);
                final chipTextColor = isStart
                    ? colorScheme.primary
                    : isEnd
                        ? Colors.green.shade800
                        : Theme.of(context).textTheme.labelSmall?.color;
                final leadingIcon = isStart
                    ? Icons.play_arrow_rounded
                    : isEnd
                        ? Icons.flag_rounded
                        : Icons.menu_book_outlined;

                final connectsUp = item.inTimeline && index > 0 && timelineSessions[index - 1].inTimeline;
                final connectsDown =
                    item.inTimeline && index < timelineSessions.length - 1 && timelineSessions[index + 1].inTimeline;

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _TimelineMarker(
                        lineColor: item.inTimeline
                            ? colorScheme.primary.withValues(alpha: 0.9)
                            : colorScheme.outline.withValues(alpha: 0.35),
                        baseLineColor: colorScheme.outline.withValues(alpha: 0.28),
                        dotColor: item.inTimeline
                            ? colorScheme.primary
                            : colorScheme.outline.withValues(alpha: 1),
                        drawTop: connectsUp,
                        drawBottom: connectsDown,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.fromLTRB(12, 10, 6, 8),
                            decoration: BoxDecoration(
                              color: itemColor,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    Icon(leadingIcon, size: 18, color: chipTextColor),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '$day/$month/$year a $hour:$minute',
                                        style: Theme.of(context).textTheme.bodyMedium,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: chipColor,
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        session.type.label,
                                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                              color: chipTextColor,
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                    ),
                                    if (isStart || isEnd)
                                      IconButton(
                                        tooltip: 'Supprimer la session',
                                        icon: const Icon(Icons.delete_outline, size: 20),
                                        onPressed: () async {
                                          await ref.read(booksControllerProvider.notifier).deleteReadingSession(
                                                session: session,
                                              );
                                        },
                                      ),
                                  ],
                                ),
                                if (!isStart && !isEnd) const SizedBox(height: 8),
                                if (!isStart && !isEnd)
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Page ${session.currentPage}',
                                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                                        ),
                                      ),
                                      Text(
                                        durationLabel,
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                                      ),
                                      IconButton(
                                        tooltip: 'Supprimer la session',
                                        icon: const Icon(Icons.delete_outline, size: 20),
                                        onPressed: () async {
                                          await ref.read(booksControllerProvider.notifier).deleteReadingSession(
                                                session: session,
                                              );
                                        },
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
