import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'book_details_page.dart';
import 'components/app_header.dart';
import 'components/book_cover.dart';

class ReadingCalendarPage extends ConsumerStatefulWidget {
  const ReadingCalendarPage({super.key});

  @override
  ConsumerState<ReadingCalendarPage> createState() => _ReadingCalendarPageState();
}

class _ReadingCalendarPageState extends ConsumerState<ReadingCalendarPage> {
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

    return Scaffold(
      appBar: AppHeader(
        title: 'Calendrier de lectures',
        subtitle: 'Historique et activité de lecture',
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: sessionsAsync.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: AppTheme.accentPrimary),
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
          // Group sessions by day string (yyyy-MM-dd)
          final sessionsByDay = <String, List<dynamic>>{};
          for (final s in sessions) {
            final key =
                '${s.createdAt.year}-${s.createdAt.month.toString().padLeft(2, '0')}-${s.createdAt.day.toString().padLeft(2, '0')}';
            sessionsByDay.putIfAbsent(key, () => []).add(s);
          }

          // Total days read this month
          final daysInMonthCount = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0).day;
          int daysReadInMonth = 0;
          for (int d = 1; d <= daysInMonthCount; d++) {
            final key =
                '${_focusedMonth.year}-${_focusedMonth.month.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
            if (sessionsByDay.containsKey(key)) {
              daysReadInMonth++;
            }
          }

          final selectedDayKey = _selectedDay == null
              ? null
              : '${_selectedDay!.year}-${_selectedDay!.month.toString().padLeft(2, '0')}-${_selectedDay!.day.toString().padLeft(2, '0')}';
          final sessionsOnSelectedDay =
              selectedDayKey != null ? (sessionsByDay[selectedDayKey] ?? const []) : const [];

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
                              color: AppTheme.textMuted,
                              fontWeight: FontWeight.w500,
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
                      border: Border.all(color: AppTheme.borderSubtle, width: 1),
                    ),
                    child: _buildMonthCalendar(sessionsByDay),
                  ),
                ),
              ),

              // Selected Day Sessions Details
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                  child: Row(
                    children: [
                      Icon(Icons.event_note_rounded, size: 18, color: AppTheme.accentPrimary),
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
                                            color: AppTheme.accentPrimary,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Page ${session.currentPage}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.accentPrimary,
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
                                              session.minutesRead > 0
                                                  ? '${session.minutesRead} min'
                                                  : '${session.secondsRead} s',
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
                      },
                      childCount: sessionsOnSelectedDay.length,
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 40)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMonthCalendar(Map<String, List<dynamic>> sessionsByDay) {
    const weekDayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

    final firstDayOfMonth = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    final daysInMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0).day;
    final startingWeekday = firstDayOfMonth.weekday; // 1 = Monday, 7 = Sunday
    final totalCells = ((startingWeekday - 1 + daysInMonth + 6) ~/ 7) * 7;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return Column(
      children: [
        // Weekday header
        Row(
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
        ),
        const SizedBox(height: 6),
        // Days
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: totalCells,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            childAspectRatio: 1.0,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
          ),
          itemBuilder: (context, index) {
            final dayOffset = index - (startingWeekday - 1);
            if (dayOffset < 0 || dayOffset >= daysInMonth) {
              return const SizedBox.shrink();
            }

            final dayNumber = dayOffset + 1;
            final cellDate = DateTime(_focusedMonth.year, _focusedMonth.month, dayNumber);
            final key =
                '${cellDate.year}-${cellDate.month.toString().padLeft(2, '0')}-${dayNumber.toString().padLeft(2, '0')}';
            final hasRead = sessionsByDay.containsKey(key);
            final isToday = cellDate.isAtSameMomentAs(today);
            final isSelected = _selectedDay != null && cellDate.isAtSameMomentAs(_selectedDay!);

            return InkWell(
              onTap: () {
                setState(() {
                  _selectedDay = cellDate;
                });
              },
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              child: Container(
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppTheme.accentPrimary.withValues(alpha: 0.18)
                      : (isToday ? AppTheme.bgElevated : Colors.transparent),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border: Border.all(
                    color: isSelected
                        ? AppTheme.accentPrimary
                        : (isToday ? AppTheme.borderMedium : Colors.transparent),
                    width: 1.5,
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    if (hasRead)
                      Icon(
                        Icons.local_fire_department_rounded,
                        size: 20,
                        color: AppTheme.accentAmber,
                      )
                    else
                      Text(
                        '$dayNumber',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isToday ? FontWeight.w800 : FontWeight.w500,
                          color: isToday ? AppTheme.textPrimary : AppTheme.textSecondary,
                        ),
                      ),
                    if (hasRead)
                      Positioned(
                        bottom: 2,
                        child: Text(
                          '$dayNumber',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.accentAmber.withValues(alpha: 0.9),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
