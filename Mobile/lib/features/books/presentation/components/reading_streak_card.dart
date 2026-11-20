import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/books_providers.dart';
import '../../application/streak_utils.dart';
import '../reading_calendar_page.dart';

class ReadingStreakCard extends ConsumerWidget {
  const ReadingStreakCard({super.key});

  static const _fireGold = Color(0xFFFFD60A);
  static const _fireOrange = Color(0xFFFF9500);
  static const _fireCoral = Color(0xFFFF5E3A);
  static const _fireTodayEnd = Color(0xFFFF6B35);
  static const _fireBeigeText = Color(0xFFD95F02);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(allReadingSessionsProvider);
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final fireAccentText = isBeige ? _fireBeigeText : _fireOrange;

    final streakCount = sessionsAsync.maybeWhen(
      data: (sessions) => calculateReadingStreakDays(sessions),
      orElse: () => 0,
    );
    final hasActiveStreak = streakCount > 0;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: hasActiveStreak
              ? _fireOrange.withValues(alpha: isBeige ? 0.30 : 0.24)
              : AppTheme.borderSubtle,
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const ReadingCalendarPage(mode: ReadingCalendarMode.streak),
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
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            gradient: hasActiveStreak
                                ? const LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [_fireGold, _fireOrange, _fireCoral],
                                  )
                                : null,
                            color: hasActiveStreak ? null : AppTheme.bgElevated,
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            boxShadow: hasActiveStreak
                                ? [
                                    BoxShadow(
                                      color: _fireOrange.withValues(alpha: 0.35),
                                      blurRadius: 10,
                                      offset: const Offset(0, 3),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Center(
                            child: Icon(
                              Icons.local_fire_department_rounded,
                              color: hasActiveStreak ? Colors.white : AppTheme.textMuted,
                              size: 19,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Série de lecture',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            sessionsAsync.when(
                              loading: () => Text(
                                'Calcul...',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              error: (_, _) => Text(
                                '0 jour',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              data: (sessions) {
                                final count = calculateReadingStreakDays(sessions);
                                final label = '$count jour${count > 1 ? 's' : ''}';
                                return Text(
                                  label,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: count > 0 ? fireAccentText : AppTheme.textMuted,
                                    fontWeight: FontWeight.w700,
                                  ),
                                );
                              },
                            ),
                          ],
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
                  loading: () => const SizedBox(
                    height: 48,
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: _fireOrange,
                        ),
                      ),
                    ),
                  ),
                  error: (_, _) => _buildWeekRow(
                    activeDayIndices: const {},
                    isBeige: isBeige,
                  ),
                  data: (sessions) {
                    final now = DateTime.now();
                    final readDayIndices = currentWeekReadDayIndices(
                      sessions,
                      referenceNow: now,
                    );

                    return _buildWeekRow(
                      activeDayIndices: readDayIndices,
                      currentDayIndex: now.weekday - 1,
                      isBeige: isBeige,
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
    required bool isBeige,
  }) {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    final todayLabelColor = isBeige ? _fireBeigeText : _fireOrange;

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
                  color: isToday ? todayLabelColor : AppTheme.textMuted,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: hasRead
                      ? LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: isToday
                              ? const [_fireGold, _fireTodayEnd]
                              : const [_fireOrange, _fireCoral],
                        )
                      : null,
                  color: hasRead
                      ? null
                      : (isToday ? AppTheme.bgElevated : AppTheme.bgCard),
                  border: hasRead
                      ? null
                      : Border.all(
                          color: isToday
                              ? _fireOrange.withValues(alpha: 0.75)
                              : AppTheme.borderSubtle,
                          width: isToday ? 1.6 : 1,
                        ),
                  boxShadow: hasRead
                      ? [
                          BoxShadow(
                            color: (isToday ? _fireOrange : _fireCoral)
                                .withValues(alpha: isToday ? 0.46 : 0.30),
                            blurRadius: isToday ? 12 : 8,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : null,
                ),
                child: Center(
                  child: hasRead
                      ? const Icon(
                          Icons.local_fire_department_rounded,
                          color: Colors.white,
                          size: 18,
                        )
                      : Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isToday
                                ? _fireOrange.withValues(alpha: 0.85)
                                : AppTheme.borderMedium,
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
