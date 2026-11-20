import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/reading_session.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/book_cover.dart';

enum ReadingCalendarMode {
  streak,
  covers,
}

class MonthlyBookSummary {
  const MonthlyBookSummary({
    required this.bookId,
    required this.pagesRead,
    required this.totalSecondsRead,
    required this.lastReadAt,
  });

  final int bookId;
  final int pagesRead;
  final int totalSecondsRead;
  final DateTime lastReadAt;
}

/// Computes per-book reading totals for [focusedMonth], sorted from most recent to oldest.
List<MonthlyBookSummary> computeMonthlyBookSummaries(
  List<ReadingSession> sessions,
  DateTime focusedMonth,
) {
  final sessionsByBook = <int, List<ReadingSession>>{};
  for (final s in sessions) {
    sessionsByBook.putIfAbsent(s.bookId, () => []).add(s);
  }

  final summaries = <MonthlyBookSummary>[];
  for (final entry in sessionsByBook.entries) {
    final bookSessions = [...entry.value]
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    int prevPage = 0;
    int monthPages = 0;
    int monthSeconds = 0;
    DateTime? lastReadInMonth;

    for (final s in bookSessions) {
      final int delta;
      if (s.type == ReadingSessionType.start) {
        prevPage = s.currentPage;
        delta = 0;
      } else {
        delta = s.currentPage > prevPage ? s.currentPage - prevPage : 0;
        prevPage = s.currentPage;
      }

      if (s.createdAt.year == focusedMonth.year &&
          s.createdAt.month == focusedMonth.month) {
        monthPages += delta;
        monthSeconds += s.totalSecondsRead;
        if (lastReadInMonth == null || s.createdAt.isAfter(lastReadInMonth)) {
          lastReadInMonth = s.createdAt;
        }
      }
    }

    if (lastReadInMonth != null) {
      summaries.add(
        MonthlyBookSummary(
          bookId: entry.key,
          pagesRead: monthPages,
          totalSecondsRead: monthSeconds,
          lastReadAt: lastReadInMonth,
        ),
      );
    }
  }

  summaries.sort((a, b) => b.lastReadAt.compareTo(a.lastReadAt));
  return summaries;
}

String formatReadingDuration(int totalSeconds) {
  if (totalSeconds <= 0) return '0 min';
  final hours = totalSeconds ~/ 3600;
  final minutes = (totalSeconds % 3600) ~/ 60;
  final seconds = totalSeconds % 60;
  if (hours > 0) {
    return minutes > 0 ? '$hours h $minutes min' : '$hours h';
  }
  if (minutes > 0) {
    return '$minutes min';
  }
  return '$seconds s';
}

class ReadingCalendarPage extends ConsumerStatefulWidget {
  const ReadingCalendarPage({
    super.key,
    this.mode = ReadingCalendarMode.covers,
  });

  final ReadingCalendarMode mode;

  @override
  ConsumerState<ReadingCalendarPage> createState() => _ReadingCalendarPageState();
}

class _ReadingCalendarPageState extends ConsumerState<ReadingCalendarPage> {
  static const _fireGold = Color(0xFFFFD60A);
  static const _fireOrange = Color(0xFFFF9500);
  static const _fireCoral = Color(0xFFFF5E3A);
  static const _fireTodayEnd = Color(0xFFFF6B35);
  static const _fireBeigeText = Color(0xFFD95F02);

  DateTime _focusedMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedDay = DateTime(now.year, now.month, now.day);
  }

  void _previousMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1, 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 1);
    });
  }

  String _dayKey(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _formatMonthYear(DateTime date) {
    const months = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    return '${months[date.month - 1]} ${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(allReadingSessionsProvider);
    final booksAsync = ref.watch(booksControllerProvider);
    final booksMap = <int, Book>{};
    for (final b in booksAsync.value ?? const <Book>[]) {
      if (b.id != null) booksMap[b.id!] = b;
    }

    final isStreakMode = widget.mode == ReadingCalendarMode.streak;
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final fireAccentText = isBeige ? _fireBeigeText : _fireOrange;

    return Scaffold(
      appBar: AppHeader(
        title: isStreakMode ? 'Série de lecture' : 'Calendrier de lectures',
        subtitle: isStreakMode
            ? 'Jours consécutifs de lecture'
            : 'Couvertures et lectures du mois',
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: sessionsAsync.when(
        loading: () => Center(
          child: CircularProgressIndicator(
            color: isStreakMode ? _fireOrange : AppTheme.accentPrimary,
          ),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Erreur lors du chargement : $error',
              style: TextStyle(color: AppTheme.accentRed),
            ),
          ),
        ),
        data: (sessions) {
          final sessionsByDay = <String, List<ReadingSession>>{};
          for (final s in sessions) {
            final key = _dayKey(s.createdAt);
            sessionsByDay.putIfAbsent(key, () => []).add(s);
          }

          final daysInMonthCount = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0).day;
          int daysReadInMonth = 0;
          for (int d = 1; d <= daysInMonthCount; d++) {
            final key = _dayKey(DateTime(_focusedMonth.year, _focusedMonth.month, d));
            if (sessionsByDay.containsKey(key)) {
              daysReadInMonth++;
            }
          }

          final selectedDayKey = _selectedDay == null ? null : _dayKey(_selectedDay!);
          final sessionsOnSelectedDay =
              selectedDayKey != null ? (sessionsByDay[selectedDayKey] ?? const <ReadingSession>[]) : const <ReadingSession>[];

          final monthlyBookSummaries = isStreakMode
              ? const <MonthlyBookSummary>[]
              : computeMonthlyBookSummaries(sessions, _focusedMonth);

          return CustomScrollView(
            slivers: [
              // Month navigation header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        tooltip: 'Mois précédent',
                        icon: Icon(Icons.chevron_left_rounded, color: AppTheme.textPrimary),
                        onPressed: _previousMonth,
                      ),
                      Column(
                        children: [
                          Text(
                            _formatMonthYear(_focusedMonth),
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$daysReadInMonth jour${daysReadInMonth > 1 ? 's' : ''} de lecture',
                            style: TextStyle(
                              fontSize: 12,
                              color: isStreakMode && daysReadInMonth > 0
                                  ? fireAccentText
                                  : AppTheme.textMuted,
                              fontWeight: isStreakMode && daysReadInMonth > 0
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        tooltip: 'Mois suivant',
                        icon: Icon(Icons.chevron_right_rounded, color: AppTheme.textPrimary),
                        onPressed: _nextMonth,
                      ),
                    ],
                  ),
                ),
              ),

              // Calendar Grid
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.bgSurface,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      border: Border.all(
                        color: isStreakMode
                            ? _fireOrange.withValues(alpha: isBeige ? 0.28 : 0.22)
                            : AppTheme.borderSubtle,
                        width: 1,
                      ),
                    ),
                    child: isStreakMode
                        ? _buildStreakMonthCalendar(sessionsByDay)
                        : _buildCoversMonthCalendar(sessionsByDay, booksMap),
                  ),
                ),
              ),

              if (isStreakMode) ...[
                // Selected Day Sessions Details
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                    child: Row(
                      children: [
                        Icon(Icons.local_fire_department_rounded, size: 19, color: fireAccentText),
                        const SizedBox(width: 8),
                        Text(
                          _selectedDay == null
                              ? 'Sélectionne un jour'
                              : 'Lectures du ${_selectedDay!.day.toString().padLeft(2, '0')}/${_selectedDay!.month.toString().padLeft(2, '0')}/${_selectedDay!.year}',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (sessionsOnSelectedDay.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppTheme.bgSurface,
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                          border: Border.all(color: AppTheme.borderSubtle, width: 1),
                        ),
                        child: Center(
                          child: Text(
                            'Aucune session enregistrée pour ce jour.',
                            style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                          ),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final session = sessionsOnSelectedDay[index];
                          final book = booksMap[session.bookId];
                          return _buildSessionCard(session, book);
                        },
                        childCount: sessionsOnSelectedDay.length,
                      ),
                    ),
                  ),
              ] else ...[
                // Monthly Books List (most recent to oldest)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                    child: Row(
                      children: [
                        Icon(Icons.menu_book_rounded, size: 18, color: AppTheme.accentPrimary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Livres lus en ${_formatMonthYear(_focusedMonth)}',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                        ),
                        if (monthlyBookSummaries.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.accentPrimaryLight,
                              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                            ),
                            child: Text(
                              '${monthlyBookSummaries.length}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.accentPrimary,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                if (monthlyBookSummaries.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppTheme.bgSurface,
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                          border: Border.all(color: AppTheme.borderSubtle, width: 1),
                        ),
                        child: Center(
                          child: Text(
                            'Aucun livre lu pendant ce mois.',
                            style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                          ),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final summary = monthlyBookSummaries[index];
                          final book = booksMap[summary.bookId];
                          return _buildMonthlyBookCard(summary, book);
                        },
                        childCount: monthlyBookSummaries.length,
                      ),
                    ),
                  ),
              ],

              const SliverToBoxAdapter(child: SizedBox(height: 40)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildWeekdayHeader() {
    const weekDayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    return Row(
      children: weekDayLabels
          .map(
            (label) => Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textMuted,
                    ),
                  ),
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _buildStreakMonthCalendar(Map<String, List<ReadingSession>> sessionsByDay) {
    final firstDayOfMonth = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    final daysInMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0).day;
    final startingWeekday = firstDayOfMonth.weekday; // 1 = Monday, 7 = Sunday
    final numWeeks = ((startingWeekday - 1 + daysInMonth + 6) ~/ 7);

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final fireAccentText = isBeige ? _fireBeigeText : _fireOrange;

    return Column(
      children: [
        _buildWeekdayHeader(),
        const SizedBox(height: 6),
        ...List.generate(numWeeks, (weekIndex) {
          return Padding(
            padding: EdgeInsets.only(bottom: weekIndex < numWeeks - 1 ? 6 : 0),
            child: Row(
              children: List.generate(7, (col) {
                final index = weekIndex * 7 + col;
                final dayOffset = index - (startingWeekday - 1);
                if (dayOffset < 0 || dayOffset >= daysInMonth) {
                  return const Expanded(child: SizedBox(height: 46));
                }

                final dayNumber = dayOffset + 1;
                final cellDate = DateTime(_focusedMonth.year, _focusedMonth.month, dayNumber);
                final hasRead = sessionsByDay.containsKey(_dayKey(cellDate));
                final isToday = cellDate.isAtSameMomentAs(today);
                final isSelected = _selectedDay != null && cellDate.isAtSameMomentAs(_selectedDay!);

                final prevDate = cellDate.subtract(const Duration(days: 1));
                final nextDate = cellDate.add(const Duration(days: 1));
                final connectLeft = hasRead &&
                    col > 0 &&
                    dayNumber > 1 &&
                    sessionsByDay.containsKey(_dayKey(prevDate));
                final connectRight = hasRead &&
                    col < 6 &&
                    dayNumber < daysInMonth &&
                    sessionsByDay.containsKey(_dayKey(nextDate));

                final pillRadius = BorderRadius.horizontal(
                  left: connectLeft ? Radius.zero : const Radius.circular(22),
                  right: connectRight ? Radius.zero : const Radius.circular(22),
                );

                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedDay = cellDate;
                      });
                    },
                    child: SizedBox(
                      height: 46,
                      child: hasRead
                          ? Container(
                              margin: EdgeInsets.only(
                                left: connectLeft ? 0 : 2,
                                right: connectRight ? 0 : 2,
                                top: 2,
                                bottom: 2,
                              ),
                              decoration: BoxDecoration(
                                color: _fireOrange.withValues(
                                  alpha: isBeige ? 0.16 : 0.18,
                                ),
                                borderRadius: pillRadius,
                              ),
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  if (isSelected)
                                    Container(
                                      width: 38,
                                      height: 38,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: isToday
                                              ? const [_fireGold, _fireTodayEnd]
                                              : const [_fireOrange, _fireCoral],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: (isToday ? _fireOrange : _fireCoral)
                                                .withValues(alpha: 0.45),
                                            blurRadius: 10,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                    )
                                  else if (isToday)
                                    Container(
                                      width: 38,
                                      height: 38,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: _fireOrange,
                                          width: 1.6,
                                        ),
                                      ),
                                    ),
                                  Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.local_fire_department_rounded,
                                        size: 18,
                                        color: isSelected ? Colors.white : _fireOrange,
                                      ),
                                      Text(
                                        '$dayNumber',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w700,
                                          color: isSelected ? Colors.white : fireAccentText,
                                          height: 1.0,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            )
                          : Container(
                              margin: const EdgeInsets.all(2),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? _fireOrange.withValues(alpha: 0.16)
                                    : (isToday ? AppTheme.bgElevated : Colors.transparent),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected
                                      ? _fireOrange
                                      : (isToday
                                          ? _fireOrange.withValues(alpha: 0.7)
                                          : Colors.transparent),
                                  width: isSelected ? 1.8 : 1.5,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  '$dayNumber',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isToday || isSelected
                                        ? FontWeight.w800
                                        : FontWeight.w500,
                                    color: isSelected || isToday
                                        ? fireAccentText
                                        : AppTheme.textSecondary,
                                  ),
                                ),
                              ),
                            ),
                    ),
                  ),
                );
              }),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildCoversMonthCalendar(
    Map<String, List<ReadingSession>> sessionsByDay,
    Map<int, Book> booksMap,
  ) {
    final firstDayOfMonth = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    final daysInMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0).day;
    final startingWeekday = firstDayOfMonth.weekday; // 1 = Monday, 7 = Sunday
    final numWeeks = ((startingWeekday - 1 + daysInMonth + 6) ~/ 7);

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return Column(
      children: [
        _buildWeekdayHeader(),
        const SizedBox(height: 6),
        ...List.generate(numWeeks, (weekIndex) {
          return Padding(
            padding: EdgeInsets.only(bottom: weekIndex < numWeeks - 1 ? 6 : 0),
            child: Row(
              children: List.generate(7, (col) {
                final index = weekIndex * 7 + col;
                final dayOffset = index - (startingWeekday - 1);
                if (dayOffset < 0 || dayOffset >= daysInMonth) {
                  return const Expanded(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 2),
                      child: AspectRatio(aspectRatio: 0.78),
                    ),
                  );
                }

                final dayNumber = dayOffset + 1;
                final cellDate = DateTime(_focusedMonth.year, _focusedMonth.month, dayNumber);
                final daySessions = sessionsByDay[_dayKey(cellDate)] ?? const <ReadingSession>[];
                final dayBookIds = <int>[];
                for (final s in daySessions) {
                  if (!dayBookIds.contains(s.bookId)) {
                    dayBookIds.add(s.bookId);
                  }
                }

                final isToday = cellDate.isAtSameMomentAs(today);
                final hasBooks = dayBookIds.isNotEmpty;

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: AspectRatio(
                      aspectRatio: 0.78,
                      child: Container(
                        decoration: BoxDecoration(
                          color: isToday && !hasBooks ? AppTheme.bgElevated : Colors.transparent,
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          border: Border.all(
                            color: isToday
                                ? AppTheme.accentPrimary
                                : (hasBooks ? AppTheme.borderSubtle : Colors.transparent),
                            width: isToday ? 1.5 : 1,
                          ),
                        ),
                        child: hasBooks
                            ? _buildDayCoversCell(dayBookIds, booksMap)
                            : Center(
                                child: Text(
                                  '$dayNumber',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isToday ? FontWeight.w800 : FontWeight.w500,
                                    color: isToday ? AppTheme.textPrimary : AppTheme.textSecondary,
                                  ),
                                ),
                              ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildDayCoversCell(
    List<int> bookIds,
    Map<int, Book> booksMap,
  ) {
    Widget miniCover(int bookId) {
      final book = booksMap[bookId];
      if (book == null) {
        return Container(
          decoration: BoxDecoration(
            color: AppTheme.bgElevated,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Center(
            child: Icon(Icons.book_rounded, size: 16, color: AppTheme.textMuted),
          ),
        );
      }
      return ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: FittedBox(
          fit: BoxFit.cover,
          child: BookCover(
            book: book,
            width: 56,
            height: 80,
            borderRadius: 4,
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTheme.radiusSm - 1),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (bookIds.length == 1)
            miniCover(bookIds.first)
          else
            LayoutBuilder(
              builder: (context, constraints) {
                const pad = 2.0;
                final coverW = (constraints.maxWidth - pad * 2) * 0.74;
                final coverH = (constraints.maxHeight - pad * 2) * 0.78;
                return Stack(
                  children: [
                    // Back cover (top-right)
                    Positioned(
                      top: pad,
                      right: pad,
                      width: coverW,
                      height: coverH,
                      child: Opacity(
                        opacity: 0.92,
                        child: miniCover(bookIds[1]),
                      ),
                    ),
                    // Front cover (bottom-left)
                    Positioned(
                      bottom: pad,
                      left: pad,
                      width: coverW,
                      height: coverH,
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppTheme.bgSurface, width: 1.2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.28),
                              blurRadius: 3,
                              offset: const Offset(1, -1),
                            ),
                          ],
                        ),
                        child: miniCover(bookIds.first),
                      ),
                    ),
                  ],
                );
              },
            ),
          if (bookIds.length > 2)
            Positioned(
              bottom: 2,
              right: 2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: AppTheme.accentPrimary,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '+${bookIds.length - 2}',
                  style: const TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMonthlyBookCard(MonthlyBookSummary summary, Book? book) {
    final pagesLabel = '${summary.pagesRead} page${summary.pagesRead > 1 ? 's' : ''} lue${summary.pagesRead > 1 ? 's' : ''}';
    final durationLabel = formatReadingDuration(summary.totalSecondsRead);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: book == null
              ? null
              : () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => BookDetailsPage(book: book),
                    ),
                  );
                },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.borderSubtle, width: 1),
            ),
            child: Row(
              children: [
                if (book != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    child: SizedBox(
                      width: 48,
                      height: 70,
                      child: FittedBox(
                        fit: BoxFit.cover,
                        child: BookCover(
                          book: book,
                          width: 56,
                          height: 80,
                        ),
                      ),
                    ),
                  )
                else
                  Container(
                    width: 48,
                    height: 70,
                    decoration: BoxDecoration(
                      color: AppTheme.bgElevated,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Icon(Icons.book_rounded, color: AppTheme.textMuted),
                  ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        book?.title ?? 'Livre #${summary.bookId}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 12,
                        runSpacing: 4,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.auto_stories_rounded,
                                size: 13,
                                color: AppTheme.accentPrimary,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                pagesLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.accentPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.timer_outlined,
                                size: 13,
                                color: AppTheme.textMuted,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                durationLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (book != null)
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.textMuted,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSessionCard(ReadingSession session, Book? book) {
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final sessionAccent = widget.mode == ReadingCalendarMode.streak
        ? (isBeige ? _fireBeigeText : _fireOrange)
        : AppTheme.accentPrimary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.bgSurface,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: AppTheme.borderSubtle, width: 1),
        ),
        child: Row(
          children: [
            if (book != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                child: BookCover(
                  book: book,
                  width: 44,
                  height: 64,
                ),
              )
            else
              Container(
                width: 44,
                height: 64,
                decoration: BoxDecoration(
                  color: AppTheme.bgElevated,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Icon(Icons.book_rounded, color: AppTheme.textMuted),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    book?.title ?? 'Livre #${session.bookId}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.auto_stories_rounded,
                        size: 13,
                        color: sessionAccent,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Page ${session.currentPage}',
                        style: TextStyle(
                          fontSize: 12,
                          color: sessionAccent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (session.minutesRead > 0 || session.secondsRead > 0) ...[
                        const SizedBox(width: 10),
                        Icon(
                          Icons.timer_outlined,
                          size: 13,
                          color: AppTheme.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          formatReadingDuration(session.totalSecondsRead),
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            if (book != null)
              IconButton(
                tooltip: 'Voir le livre',
                icon: Icon(
                  Icons.chevron_right_rounded,
                  color: AppTheme.textMuted,
                ),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => BookDetailsPage(book: book),
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
