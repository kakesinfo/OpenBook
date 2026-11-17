import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/books_providers.dart';
import '../../data/retrospective.dart';
import '../retrospective_story_page.dart';

class RetrospectiveStoriesSection extends ConsumerStatefulWidget {
  const RetrospectiveStoriesSection({
    super.key,
    this.referenceDate,
  });

  /// Optional override for current date (useful for testing).
  final DateTime? referenceDate;

  @override
  ConsumerState<RetrospectiveStoriesSection> createState() =>
      _RetrospectiveStoriesSectionState();
}

class _RetrospectiveStoriesSectionState
    extends ConsumerState<RetrospectiveStoriesSection> {
  String? _lastPrefetchSignature;

  void _scheduleSequentialPrefetch(List<int> accessibleYears) {
    if (accessibleYears.isEmpty) return;
    final signature = accessibleYears.join(',');
    if (_lastPrefetchSignature == signature) return;
    _lastPrefetchSignature = signature;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Load the first accessible story first, then load the following ones sequentially.
      for (final year in accessibleYears) {
        if (!mounted) return;
        try {
          await ref.read(retrospectiveByYearProvider(year).future);
        } catch (_) {
          // Ignore prefetch errors; tapping the story will show/retry on demand.
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final yearsAsync = ref.watch(retrospectiveYearsProvider);
    final seenYears = ref.watch(seenRetrospectiveYearsProvider);
    final now = widget.referenceDate ?? DateTime.now();

    final years = yearsAsync.when(
      data: (list) => _mergeWithCurrentYear(list, now.year),
      loading: () => <int>[now.year],
      error: (_, _) => <int>[now.year],
    );

    if (yearsAsync.hasValue) {
      final accessibleYears = years
          .where((y) => YearlyRetrospective.isYearAccessible(y, now))
          .toList();
      _scheduleSequentialPrefetch(accessibleYears);
    }

    if (years.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 102,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 2),
        itemCount: years.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final year = years[index];
          final isAccessible = YearlyRetrospective.isYearAccessible(year, now);
          final isSeen = seenYears.contains(year);

          return _StoryCircleItem(
            year: year,
            isAccessible: isAccessible,
            isSeen: isSeen,
            onTap: () {
              if (!isAccessible) {
                ScaffoldMessenger.of(context).hideCurrentSnackBar();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'La rétrospective $year sera accessible à partir du 1er janvier ${year + 1}.',
                    ),
                    behavior: SnackBarBehavior.floating,
                    backgroundColor: AppTheme.bgElevated,
                  ),
                );
                return;
              }

              Navigator.of(context, rootNavigator: true).push(
                PageRouteBuilder<void>(
                  opaque: true,
                  pageBuilder: (_, _, _) => RetrospectiveStoryPage(year: year),
                  transitionsBuilder: (_, animation, _, child) {
                    return FadeTransition(
                      opacity: animation,
                      child: ScaleTransition(
                        scale: Tween<double>(begin: 0.94, end: 1.0).animate(
                          CurvedAnimation(
                            parent: animation,
                            curve: Curves.easeOutCubic,
                          ),
                        ),
                        child: child,
                      ),
                    );
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }

  static List<int> _mergeWithCurrentYear(List<int> apiYears, int currentYear) {
    final set = <int>{...apiYears, currentYear};
    final sorted = set.toList()..sort((a, b) => b.compareTo(a));
    return sorted;
  }
}

class _StoryCircleItem extends StatelessWidget {
  const _StoryCircleItem({
    required this.year,
    required this.isAccessible,
    required this.isSeen,
    required this.onTap,
  });

  final int year;
  final bool isAccessible;
  final bool isSeen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final showGradientRing = isAccessible && !isSeen;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 68,
                  height: 68,
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: showGradientRing
                        ? LinearGradient(
                            begin: Alignment.topRight,
                            end: Alignment.bottomLeft,
                            colors: [
                              AppTheme.accentPrimary,
                              AppTheme.accentSecondary,
                              AppTheme.accentRose,
                            ],
                          )
                        : null,
                    border: showGradientRing
                        ? null
                        : Border.all(
                            color: isAccessible
                                ? AppTheme.borderMedium
                                : AppTheme.borderSubtle,
                            width: 2,
                          ),
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.bgPrimary,
                    ),
                    padding: const EdgeInsets.all(2.5),
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isAccessible
                            ? AppTheme.bgSurface
                            : AppTheme.bgElevated.withValues(alpha: 0.6),
                        border: Border.all(
                          color: AppTheme.borderSubtle,
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                isAccessible
                                    ? Icons.auto_awesome_rounded
                                    : Icons.lock_clock_rounded,
                                size: 14,
                                color: isAccessible
                                    ? AppTheme.accentPrimary
                                    : AppTheme.textMuted,
                              ),
                              const SizedBox(height: 1),
                              Text(
                                '$year',
                                style: TextStyle(
                                  fontSize: 12,
                                  height: 1.1,
                                  fontWeight: FontWeight.w800,
                                  color: isAccessible
                                      ? AppTheme.textPrimary
                                      : AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                if (!isAccessible)
                  Positioned(
                    right: -2,
                    bottom: -2,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: AppTheme.bgSurface,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppTheme.borderMedium,
                          width: 1.5,
                        ),
                      ),
                      child: Icon(
                        Icons.lock_rounded,
                        size: 12,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              isAccessible ? 'Bilan $year' : '1 jan. ${year + 1}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: showGradientRing ? FontWeight.w700 : FontWeight.w500,
                color: isAccessible ? AppTheme.textSecondary : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
