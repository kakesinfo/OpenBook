import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/books_providers.dart';
import '../reading_calendar_page.dart';

class ReadingStreakCard extends ConsumerWidget {
  const ReadingStreakCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(allReadingSessionsProvider);

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const ReadingCalendarPage(),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppTheme.accentAmberLight,
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          ),
                          child: Center(
                            child: Icon(
                              Icons.local_fire_department_rounded,
                              color: AppTheme.accentAmber,
                              size: 18,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Série de lecture',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppTheme.textMuted,
                      size: 20,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                sessionsAsync.when(
                  loading: () => SizedBox(
                    height: 48,
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.accentAmber,
                        ),
                      ),
                    ),
                  ),
                  error: (_, _) => _buildWeekRow(activeDayIndices: const {}),
                  data: (sessions) {
                    final now = DateTime.now();
                    final today = DateTime(now.year, now.month, now.day);
                    // Monday is weekday 1
                    final startOfWeek = today.subtract(Duration(days: today.weekday - 1));

                    final readDayIndices = <int>{};
                    for (final s in sessions) {
                      final sDate = DateTime(s.createdAt.year, s.createdAt.month, s.createdAt.day);
                      final diffDays = sDate.difference(startOfWeek).inDays;
                      if (diffDays >= 0 && diffDays < 7) {
                        readDayIndices.add(diffDays);
                      }
                    }

                    return _buildWeekRow(
                      activeDayIndices: readDayIndices,
                      currentDayIndex: today.weekday - 1,
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWeekRow({
    required Set<int> activeDayIndices,
    int? currentDayIndex,
  }) {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(7, (index) {
        final label = days[index];
        final hasRead = activeDayIndices.contains(index);
        final isToday = currentDayIndex == index;

        return Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                  color: isToday ? AppTheme.accentPrimary : AppTheme.textMuted,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: hasRead
                      ? AppTheme.accentAmberLight
                      : (isToday ? AppTheme.bgElevated : AppTheme.bgCard),
                  border: Border.all(
                    color: hasRead
                        ? AppTheme.accentAmber.withValues(alpha: 0.4)
                        : (isToday ? AppTheme.borderMedium : AppTheme.borderSubtle),
                    width: isToday ? 1.5 : 1,
                  ),
                ),
                child: Center(
                  child: hasRead
                      ? Icon(
                          Icons.local_fire_department_rounded,
                          color: AppTheme.accentAmber,
                          size: 18,
                        )
                      : Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isToday ? AppTheme.textSecondary : AppTheme.borderMedium,
                          ),
                        ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
