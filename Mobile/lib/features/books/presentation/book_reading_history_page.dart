import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/reading_cycle.dart';
import '../data/reading_session.dart';
import 'components/app_header.dart';
import 'components/common_reading_ribbon.dart';

enum ReadingCycleStatus {
  inProgress,
  completed,
  unfinished,
}

extension ReadingCycleStatusX on ReadingCycleStatus {
  String get label {
    switch (this) {
      case ReadingCycleStatus.inProgress:
        return 'En cours';
      case ReadingCycleStatus.completed:
        return 'Terminée';
      case ReadingCycleStatus.unfinished:
        return 'Non terminée';
    }
  }
}

class ReadingCycle {
  const ReadingCycle({
    this.cycleId,
    required this.readingNumber,
    required this.sessions,
    required this.status,
    required this.isCommon,
    required this.startedAt,
    required this.endedAt,
    required this.lastActivityAt,
    required this.totalSecondsRead,
    required this.maxPage,
  });

  final int? cycleId;
  final int readingNumber;
  final List<ReadingSession> sessions;
  final ReadingCycleStatus status;
  final bool isCommon;
  final DateTime startedAt;
  final DateTime? endedAt;
  final DateTime lastActivityAt;
  final int totalSecondsRead;
  final int maxPage;

  bool get isInProgress => status == ReadingCycleStatus.inProgress;
  bool get isCompleted => status == ReadingCycleStatus.completed;

  List<ReadingSession> get sessionsChronological {
    final sorted = [...sessions]
      ..sort((a, b) {
        final typeCmp = a.type.index.compareTo(b.type.index);
        if (typeCmp != 0) return typeCmp;
        final cmp = a.createdAt.compareTo(b.createdAt);
        if (cmp != 0) return cmp;
        return (a.id ?? 0).compareTo(b.id ?? 0);
      });
    return sorted;
  }

  List<ReadingSession> get sessionsDescending {
    final sorted = [...sessions]
      ..sort((a, b) {
        final cmp = b.createdAt.compareTo(a.createdAt);
        if (cmp != 0) return cmp;
        final typeCmp = b.type.index.compareTo(a.type.index);
        if (typeCmp != 0) return typeCmp;
        return (b.id ?? 0).compareTo(a.id ?? 0);
      });
    return sorted;
  }
}

/// Regroupe les sessions chronologiques d'un livre en lectures successives
/// (en priorité via readingCycleId issu de la BDD, ou par découpage
/// début -> sessions -> fin en repli), retournées de la plus récente à la plus ancienne.
List<ReadingCycle> groupSessionsIntoReadingCycles(
  List<ReadingSession> sessions, {
  BookStatus? bookStatus,
}) {
  if (sessions.isEmpty) {
    return const <ReadingCycle>[];
  }

  final ascending = [...sessions]
    ..sort((a, b) {
      final cmp = a.createdAt.compareTo(b.createdAt);
      if (cmp != 0) return cmp;
      final typeCmp = a.type.index.compareTo(b.type.index);
      if (typeCmp != 0) return typeCmp;
      return (a.id ?? 0).compareTo(b.id ?? 0);
    });

  final allHaveCycleId = ascending.every((s) => s.readingCycleId != null);
  final rawGroups = <List<ReadingSession>>[];

  if (allHaveCycleId) {
    final byCycleId = <int, List<ReadingSession>>{};
    for (final session in ascending) {
      byCycleId
          .putIfAbsent(session.readingCycleId!, () => <ReadingSession>[])
          .add(session);
    }
    rawGroups.addAll(byCycleId.values);
    rawGroups.sort((a, b) =>
        (a.first.readingCycleId ?? 0).compareTo(b.first.readingCycleId ?? 0));
  } else {
    var current = <ReadingSession>[];
    for (final session in ascending) {
      if (session.type == ReadingSessionType.start) {
        if (current.isNotEmpty) {
          rawGroups.add(current);
          current = <ReadingSession>[];
        }
        current.add(session);
      } else if (session.type == ReadingSessionType.end) {
        current.add(session);
        rawGroups.add(current);
        current = <ReadingSession>[];
      } else {
        current.add(session);
      }
    }
    if (current.isNotEmpty) {
      rawGroups.add(current);
    }
  }

  final cycles = <ReadingCycle>[];
  for (var i = 0; i < rawGroups.length; i++) {
    final group = rawGroups[i];
    final isLatest = i == rawGroups.length - 1;

    ReadingSession? startSession;
    ReadingSession? endSession;
    var totalSeconds = 0;
    var maxPage = 0;
    var isCommon = false;
    int? cycleId;

    for (final session in group) {
      cycleId ??= session.readingCycleId;
      if (session.type == ReadingSessionType.start && startSession == null) {
        startSession = session;
      }
      if (session.type == ReadingSessionType.end) {
        endSession = session;
      }
      if (session.isCommon) {
        isCommon = true;
      }
      totalSeconds += session.totalSecondsRead;
      if (session.currentPage > maxPage) {
        maxPage = session.currentPage;
      }
    }

    final ReadingCycleStatus status;
    if (endSession != null) {
      status = ReadingCycleStatus.completed;
    } else if (isLatest) {
      status = bookStatus == BookStatus.read
          ? ReadingCycleStatus.completed
          : ReadingCycleStatus.inProgress;
    } else {
      status = ReadingCycleStatus.unfinished;
    }

    final startedAt = startSession?.createdAt ?? group.first.createdAt;
    final endedAt = endSession?.createdAt ??
        (status == ReadingCycleStatus.completed ? group.last.createdAt : null);

    cycles.add(
      ReadingCycle(
        cycleId: cycleId,
        readingNumber: i + 1,
        sessions: List<ReadingSession>.unmodifiable(group),
        status: status,
        isCommon: isCommon,
        startedAt: startedAt,
        endedAt: endedAt,
        lastActivityAt: group.last.createdAt,
        totalSecondsRead: totalSeconds,
        maxPage: maxPage,
      ),
    );
  }

  return cycles.reversed.toList();
}

/// Construit les cycles directement depuis les enregistrements backend
/// (`GET /user/readingCycles/{bookId}`), y compris les cycles sans aucune session.
List<ReadingCycle> buildReadingCyclesFromRecords(
  List<ReadingCycleRecord> records, {
  BookStatus? bookStatus,
}) {
  if (records.isEmpty) {
    return const <ReadingCycle>[];
  }

  final sortedRecords = [...records]..sort((a, b) => a.id.compareTo(b.id));
  final cycles = <ReadingCycle>[];

  for (var i = 0; i < sortedRecords.length; i++) {
    final record = sortedRecords[i];
    final isLatest = i == sortedRecords.length - 1;

    final sortedSessions = [...record.sessions]
      ..sort((a, b) {
        final cmp = a.createdAt.compareTo(b.createdAt);
        if (cmp != 0) return cmp;
        final typeCmp = a.type.index.compareTo(b.type.index);
        if (typeCmp != 0) return typeCmp;
        return (a.id ?? 0).compareTo(b.id ?? 0);
      });

    ReadingSession? endSession;
    var totalSeconds = 0;
    var maxPage = 0;
    var isCommon = record.isCommon;

    for (final session in sortedSessions) {
      if (session.type == ReadingSessionType.end) {
        endSession = session;
      }
      if (session.isCommon) {
        isCommon = true;
      }
      totalSeconds += session.totalSecondsRead;
      if (session.currentPage > maxPage) {
        maxPage = session.currentPage;
      }
    }

    final ReadingCycleStatus status;
    if (record.endedAt != null || endSession != null) {
      status = ReadingCycleStatus.completed;
    } else if (isLatest) {
      status = bookStatus == BookStatus.read
          ? ReadingCycleStatus.completed
          : ReadingCycleStatus.inProgress;
    } else {
      status = ReadingCycleStatus.unfinished;
    }

    final startedAt = record.startedAt;
    final endedAt = record.endedAt ??
        endSession?.createdAt ??
        (status == ReadingCycleStatus.completed && sortedSessions.isNotEmpty
            ? sortedSessions.last.createdAt
            : null);
    final lastActivityAt = sortedSessions.isNotEmpty
        ? sortedSessions.last.createdAt
        : (endedAt ?? startedAt);

    cycles.add(
      ReadingCycle(
        cycleId: record.id,
        readingNumber: i + 1,
        sessions: List<ReadingSession>.unmodifiable(sortedSessions),
        status: status,
        isCommon: isCommon,
        startedAt: startedAt,
        endedAt: endedAt,
        lastActivityAt: lastActivityAt,
        totalSecondsRead: totalSeconds,
        maxPage: maxPage,
      ),
    );
  }

  return cycles.reversed.toList();
}

Future<void> _confirmAndDeleteCycle(
  BuildContext context,
  WidgetRef ref, {
  required Book book,
  required ReadingCycle cycle,
  bool popOnSuccess = false,
}) async {
  final bookId = book.id;
  final cycleId = cycle.cycleId;
  if (bookId == null || cycleId == null) return;

  final sessionCount = cycle.sessions.length;
  final message = sessionCount == 0
      ? 'Ce cycle ne contient aucune session. Voulez-vous le supprimer ?'
      : 'Ce cycle contient $sessionCount session${sessionCount > 1 ? 's' : ''}. Toutes ses sessions seront également supprimées.';

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: AppTheme.bgSurface,
      title: Text(
        'Supprimer la lecture #${cycle.readingNumber} ?',
        style: TextStyle(
          color: AppTheme.textPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 17,
        ),
      ),
      content: Text(
        message,
        style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text('Annuler', style: TextStyle(color: AppTheme.textMuted)),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(
            'Supprimer',
            style: TextStyle(
              color: AppTheme.accentRed,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );

  if (confirmed != true) return;

  try {
    await ref.read(booksControllerProvider.notifier).deleteReadingCycle(
          bookId: bookId,
          cycleId: cycleId,
        );
    if (popOnSuccess && context.mounted) {
      Navigator.of(context).pop();
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Impossible de supprimer le cycle : $error')),
      );
    }
  }
}

class BookReadingHistoryPage extends ConsumerWidget {
  const BookReadingHistoryPage({
    super.key,
    required this.book,
  });

  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loadedBooks = ref.watch(booksControllerProvider).value ?? const <Book>[];
    final activeBook = loadedBooks.firstWhere(
      (item) => item.id != null && item.id == book.id,
      orElse: () => book,
    );
    final cyclesAsync = ref.watch(readingCyclesForBookProvider(activeBook));

    return Scaffold(
      appBar: AppHeader(
        title: 'Historique des lectures',
        subtitle: activeBook.title,
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        children: [
          Text(
            activeBook.title,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Toutes les lectures enregistrées pour cet ouvrage.',
            style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 20),
          cyclesAsync.when(
            loading: () => SizedBox(
              height: 56,
              child: Center(
                child: CircularProgressIndicator(color: AppTheme.accentPrimary),
              ),
            ),
            error: (error, _) => Text(
              'Impossible de charger les lectures : $error',
              style: TextStyle(color: AppTheme.accentRed),
            ),
            data: (records) {
              final cycles = buildReadingCyclesFromRecords(
                records,
                bookStatus: activeBook.status,
              );

              if (cycles.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppTheme.bgSurface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(color: AppTheme.borderSubtle, width: 1),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.history_rounded, size: 36, color: AppTheme.textMuted),
                      const SizedBox(height: 12),
                      Text(
                        'Aucune lecture enregistrée pour ce livre.',
                        style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < cycles.length; i++) ...[
                    if (i > 0) const SizedBox(height: 12),
                    _ReadingCycleCard(
                      cycle: cycles[i],
                      totalPages: activeBook.totalPages,
                      onDelete: cycles[i].cycleId != null && activeBook.id != null
                          ? () => _confirmAndDeleteCycle(
                                context,
                                ref,
                                book: activeBook,
                                cycle: cycles[i],
                              )
                          : null,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => BookReadingCycleSessionsPage(
                              book: activeBook,
                              initialCycle: cycles[i],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ReadingCycleCard extends StatelessWidget {
  const _ReadingCycleCard({
    required this.cycle,
    required this.totalPages,
    required this.onTap,
    this.onDelete,
  });

  final ReadingCycle cycle;
  final int? totalPages;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final isInProgress = cycle.isInProgress;
    final isCompleted = cycle.isCompleted;

    final statusColor = isInProgress || isCompleted
        ? AppTheme.accentPrimary
        : AppTheme.textSecondary;
    final statusBg = isInProgress || isCompleted
        ? AppTheme.accentPrimaryLight
        : AppTheme.bgElevated;
    final leadingIcon = isInProgress
        ? Icons.auto_stories_rounded
        : isCompleted
            ? Icons.check_circle_outline_rounded
            : Icons.history_rounded;

    final sessionCount = cycle.sessions.length;
    final sessionLabel = sessionCount == 0
        ? 'Aucune session'
        : '$sessionCount session${sessionCount > 1 ? 's' : ''}';
    final durationLabel = _formatCycleDuration(cycle.totalSecondsRead);
    final pageLabel = cycle.maxPage > 0
        ? (totalPages != null && totalPages! > 0
            ? 'p. ${cycle.maxPage} / $totalPages'
            : 'p. ${cycle.maxPage}')
        : null;

    return Container(
      decoration: BoxDecoration(
        gradient: AppTheme.cardGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: isInProgress
              ? AppTheme.accentPrimary.withValues(alpha: 0.45)
              : AppTheme.borderSubtle,
          width: 1,
        ),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.28),
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: Icon(leadingIcon, color: statusColor, size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Lecture #${cycle.readingNumber}',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                              letterSpacing: -0.01,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _formatDateRange(cycle),
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (onDelete != null)
                      IconButton(
                        tooltip: 'Supprimer le cycle',
                        visualDensity: VisualDensity.compact,
                        icon: Icon(
                          Icons.delete_outline_rounded,
                          color: AppTheme.textMuted,
                          size: 20,
                        ),
                        onPressed: onDelete,
                      ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppTheme.textMuted,
                      size: 22,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _CycleStatusPill(
                      label: cycle.status.label,
                      color: statusColor,
                      bgColor: statusBg,
                    ),
                    if (cycle.isCommon) const CommonReadingBadge(compact: true),
                  ],
                ),
                const SizedBox(height: 10),
                Divider(height: 1, color: AppTheme.borderSubtle),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    _CycleMetaItem(
                      icon: Icons.timeline_rounded,
                      label: sessionLabel,
                    ),
                    if (durationLabel.isNotEmpty)
                      _CycleMetaItem(
                        icon: Icons.schedule_rounded,
                        label: durationLabel,
                      ),
                    if (pageLabel != null)
                      _CycleMetaItem(
                        icon: Icons.menu_book_rounded,
                        label: pageLabel,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CycleStatusPill extends StatelessWidget {
  const _CycleStatusPill({
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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        border: Border.all(
          color: color.withValues(alpha: 0.35),
          width: 1,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: color,
          height: 1.0,
          letterSpacing: 0.1,
        ),
      ),
    );
  }
}

class _CycleMetaItem extends StatelessWidget {
  const _CycleMetaItem({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppTheme.textMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}

class BookReadingCycleSessionsPage extends ConsumerWidget {
  BookReadingCycleSessionsPage({
    super.key,
    required this.book,
    required ReadingCycle initialCycle,
  })  : initialCycleId = initialCycle.cycleId,
        initialReadingNumber = initialCycle.readingNumber,
        initialSessionIds = {
          for (final s in initialCycle.sessions)
            if (s.id != null) s.id!,
        };

  final Book book;
  final int? initialCycleId;
  final int initialReadingNumber;
  final Set<int> initialSessionIds;

  ReadingCycle? _resolveCycle(List<ReadingCycle> cycles) {
    if (cycles.isEmpty) return null;

    if (initialCycleId != null) {
      for (final cycle in cycles) {
        if (cycle.cycleId == initialCycleId) {
          return cycle;
        }
      }
      return null;
    }

    if (initialSessionIds.isNotEmpty) {
      ReadingCycle? bestMatch;
      var bestOverlap = 0;
      for (final cycle in cycles) {
        final overlap = cycle.sessions
            .where((s) => s.id != null && initialSessionIds.contains(s.id))
            .length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = cycle;
        }
      }
      return bestMatch;
    }

    for (final cycle in cycles) {
      if (cycle.readingNumber == initialReadingNumber) {
        return cycle;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loadedBooks = ref.watch(booksControllerProvider).value ?? const <Book>[];
    final activeBook = loadedBooks.firstWhere(
      (item) => item.id != null && item.id == book.id,
      orElse: () => book,
    );
    final cyclesAsync = ref.watch(readingCyclesForBookProvider(activeBook));

    final resolvedCycle = cyclesAsync.maybeWhen(
      data: (records) => _resolveCycle(
        buildReadingCyclesFromRecords(
          records,
          bookStatus: activeBook.status,
        ),
      ),
      orElse: () => null,
    );

    final titleNumber = resolvedCycle?.readingNumber ?? initialReadingNumber;

    return Scaffold(
      appBar: AppHeader(
        title: 'Lecture #$titleNumber',
        subtitle: activeBook.title,
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          if (resolvedCycle != null &&
              resolvedCycle.cycleId != null &&
              activeBook.id != null)
            IconButton(
              tooltip: 'Supprimer le cycle',
              icon: Icon(Icons.delete_outline_rounded, color: AppTheme.accentRed),
              onPressed: () => _confirmAndDeleteCycle(
                context,
                ref,
                book: activeBook,
                cycle: resolvedCycle,
                popOnSuccess: true,
              ),
            ),
        ],
      ),
      body: cyclesAsync.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: AppTheme.accentPrimary),
        ),
        error: (error, _) => Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            'Impossible de charger les sessions : $error',
            style: TextStyle(color: AppTheme.accentRed),
          ),
        ),
        data: (records) {
          final cycles = buildReadingCyclesFromRecords(
            records,
            bookStatus: activeBook.status,
          );
          final cycle = _resolveCycle(cycles);

          if (cycle == null) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.history_rounded, size: 36, color: AppTheme.textMuted),
                    const SizedBox(height: 12),
                    Text(
                      'Ce cycle de lecture n\'existe plus.',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded, size: 18),
                      label: const Text('Retour aux lectures'),
                    ),
                  ],
                ),
              ),
            );
          }

          final orderedSessions = cycle.sessionsChronological;
          final statusColor = cycle.isInProgress || cycle.isCompleted
              ? AppTheme.accentPrimary
              : AppTheme.textSecondary;
          final statusBg = cycle.isInProgress || cycle.isCompleted
              ? AppTheme.accentPrimaryLight
              : AppTheme.bgElevated;
          final durationLabel = _formatCycleDuration(cycle.totalSecondsRead);

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            children: [
              // Summary card for this reading
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: AppTheme.cardGradient,
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                  border: Border.all(color: AppTheme.borderSubtle, width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _CycleStatusPill(
                          label: cycle.status.label,
                          color: statusColor,
                          bgColor: statusBg,
                        ),
                        if (cycle.isCommon) const CommonReadingBadge(compact: true),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _formatDateRange(cycle),
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 14,
                      runSpacing: 6,
                      children: [
                        _CycleMetaItem(
                          icon: Icons.timeline_rounded,
                          label: orderedSessions.isEmpty
                              ? 'Aucune session'
                              : '${orderedSessions.length} session${orderedSessions.length > 1 ? 's' : ''}',
                        ),
                        if (durationLabel.isNotEmpty)
                          _CycleMetaItem(
                            icon: Icons.schedule_rounded,
                            label: durationLabel,
                          ),
                        if (cycle.maxPage > 0)
                          _CycleMetaItem(
                            icon: Icons.menu_book_rounded,
                            label: activeBook.totalPages != null && activeBook.totalPages! > 0
                                ? 'p. ${cycle.maxPage} / ${activeBook.totalPages}'
                                : 'p. ${cycle.maxPage}',
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Sessions de lecture',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              if (orderedSessions.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.bgSurface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(color: AppTheme.borderSubtle, width: 1),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.timeline_rounded, size: 30, color: AppTheme.textMuted),
                      const SizedBox(height: 8),
                      Text(
                        'Aucune session enregistrée pour ce cycle.',
                        style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: List.generate(orderedSessions.length, (index) {
                    final session = orderedSessions[index];
                    final isStart = session.type == ReadingSessionType.start;
                    final isEnd = session.type == ReadingSessionType.end;
                    final duration = Duration(seconds: session.totalSecondsRead);
                    final sessionDurationLabel =
                        '${duration.inHours.toString().padLeft(2, '0')}:${duration.inMinutes.remainder(60).toString().padLeft(2, '0')}:${duration.inSeconds.remainder(60).toString().padLeft(2, '0')}';

                    final itemColor = isStart || isEnd
                        ? AppTheme.accentPrimaryLight
                        : AppTheme.bgSurface;
                    final chipColor = isStart || isEnd
                        ? AppTheme.accentPrimaryLight
                        : AppTheme.bgElevated;
                    final chipTextColor = isStart || isEnd
                        ? AppTheme.accentPrimary
                        : AppTheme.textSecondary;
                    final leadingIcon = isStart
                        ? Icons.play_arrow_rounded
                        : isEnd
                            ? Icons.flag_rounded
                            : Icons.menu_book_rounded;

                    final connectsUp = index > 0;
                    final connectsDown = index < orderedSessions.length - 1;
                    final isHighlighted = cycle.isInProgress || cycle.isCompleted;

                    return IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _TimelineMarker(
                            lineColor: isHighlighted
                                ? AppTheme.accentPrimary.withValues(alpha: 0.9)
                                : AppTheme.borderSubtle,
                            baseLineColor: AppTheme.borderSubtle,
                            dotColor:
                                isHighlighted ? AppTheme.accentPrimary : AppTheme.textMuted,
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
                                  border: Border.all(
                                    color: AppTheme.borderSubtle,
                                    width: 1,
                                  ),
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
                                            _formatDateTime(session.createdAt),
                                            style: TextStyle(
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
                                            borderRadius:
                                                BorderRadius.circular(AppTheme.radiusFull),
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
                                            icon: Icon(
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
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: AppTheme.textSecondary,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                          Text(
                                            sessionDurationLabel,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.textMuted,
                                            ),
                                          ),
                                          IconButton(
                                            tooltip: 'Supprimer la session',
                                            icon: Icon(
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
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

String _formatDate(DateTime date) {
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final year = date.year.toString();
  return '$day/$month/$year';
}

String _formatDateTime(DateTime date) {
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '${_formatDate(date)} à $hour:$minute';
}

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

String _formatDateRange(ReadingCycle cycle) {
  if (cycle.isInProgress) {
    return 'Depuis le ${_formatDate(cycle.startedAt)}';
  }
  final end = cycle.endedAt ?? cycle.lastActivityAt;
  if (_isSameDay(cycle.startedAt, end)) {
    return 'Le ${_formatDate(cycle.startedAt)}';
  }
  return 'Du ${_formatDate(cycle.startedAt)} au ${_formatDate(end)}';
}

String _formatCycleDuration(int totalSeconds) {
  if (totalSeconds <= 0) return '';
  final hours = totalSeconds ~/ 3600;
  final minutes = (totalSeconds % 3600) ~/ 60;
  final seconds = totalSeconds % 60;
  if (hours > 0) {
    return minutes > 0 ? '${hours}h ${minutes}m' : '${hours}h';
  }
  if (minutes > 0) {
    return '$minutes min';
  }
  return '$seconds s';
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
