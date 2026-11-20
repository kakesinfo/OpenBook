import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../application/books_providers.dart';
import '../data/achievement.dart';
import 'achievement_celebration_page.dart';
import 'components/achievement_medal.dart';

enum _AchievementFilter { all, unlocked, locked }

class AchievementsPage extends ConsumerStatefulWidget {
  const AchievementsPage({super.key, this.initialCreate = false});

  final bool initialCreate;

  @override
  ConsumerState<AchievementsPage> createState() => _AchievementsPageState();
}

class _AchievementsPageState extends ConsumerState<AchievementsPage> {
  _AchievementFilter _filter = _AchievementFilter.all;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.initialCreate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openFormSheet();
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _updateSteps(Achievement achievement, int nextSteps) async {
    final clamped = nextSteps.clamp(0, achievement.totalSteps);
    if (clamped == achievement.completedSteps) return;

    final wasUnlocked = achievement.unlocked;
    try {
      final updated = await ref
          .read(achievementsControllerProvider.notifier)
          .updateAchievement(
            id: achievement.id,
            completedSteps: clamped,
          );

      if (!mounted) return;
      if (!wasUnlocked && updated.unlocked) {
        final list = ref.read(achievementsControllerProvider).value ?? const [];
        final unlockedCount = list.where((a) => a.unlocked).length;
        await AchievementCelebrationPage.show(
          context,
          achievement: updated,
          unlockedCount: unlockedCount,
          totalCount: list.length,
        );
      }
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Impossible de mettre à jour le succès : $err'),
          backgroundColor: AppTheme.accentRed,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _toggleAchievement(Achievement achievement) {
    return _updateSteps(
      achievement,
      achievement.unlocked ? 0 : achievement.totalSteps,
    );
  }

  Future<void> _confirmDelete(Achievement achievement) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        ),
        title: Text(
          'Supprimer le succès',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: Text(
          'Voulez-vous vraiment supprimer « ${achievement.name} » ?',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Annuler', style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.accentRed,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    try {
      await ref
          .read(achievementsControllerProvider.notifier)
          .deleteAchievement(achievement.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Succès supprimé'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de la suppression : $err'),
            backgroundColor: AppTheme.accentRed,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _openCardActions(Achievement achievement) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: AppTheme.borderSubtle,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Text(
                achievement.name,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              ListTile(
                leading: Icon(
                  achievement.unlocked
                      ? Icons.replay_rounded
                      : Icons.check_circle_rounded,
                  color: AppTheme.accentPrimary,
                ),
                title: Text(
                  achievement.unlocked
                      ? 'Marquer comme non débloqué'
                      : 'Valider le succès',
                  style: TextStyle(color: AppTheme.textPrimary),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _toggleAchievement(achievement);
                },
              ),
              ListTile(
                leading: Icon(Icons.edit_rounded, color: AppTheme.textSecondary),
                title: Text(
                  'Modifier',
                  style: TextStyle(color: AppTheme.textPrimary),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _openFormSheet(editing: achievement);
                },
              ),
              ListTile(
                leading: Icon(Icons.delete_rounded, color: AppTheme.accentRed),
                title: Text(
                  'Supprimer',
                  style: TextStyle(color: AppTheme.accentRed),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _confirmDelete(achievement);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openFormSheet({Achievement? editing}) async {
    final result = await showModalBottomSheet<Achievement>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AchievementFormSheet(editing: editing),
    );

    if (result != null && mounted) {
      final wasUnlocked = editing?.unlocked ?? false;
      if (!wasUnlocked && result.unlocked) {
        final list = ref.read(achievementsControllerProvider).value ?? const [];
        final unlockedCount = list.where((a) => a.unlocked).length;
        await AchievementCelebrationPage.show(
          context,
          achievement: result,
          unlockedCount: unlockedCount,
          totalCount: list.length,
        );
      }
    }
  }

  String _formatDate(DateTime date) {
    const months = [
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final achievementsAsync = ref.watch(achievementsControllerProvider);
    final achievements = achievementsAsync.value ?? const <Achievement>[];

    final unlockedCount = achievements.where((a) => a.unlocked).length;
    final lockedCount = achievements.length - unlockedCount;
    final progressPercent = achievements.isNotEmpty
        ? ((unlockedCount / achievements.length) * 100).round()
        : 0;
    final rankLabel = achievementRankLabel(unlockedCount, achievements.length);

    final query = _searchQuery.trim().toLowerCase();
    final filtered = achievements.where((a) {
      if (_filter == _AchievementFilter.unlocked && !a.unlocked) return false;
      if (_filter == _AchievementFilter.locked && a.unlocked) return false;
      if (query.isNotEmpty && !a.name.toLowerCase().contains(query)) {
        return false;
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Succès'),
        actions: [
          IconButton(
            tooltip: 'Créer un succès',
            icon: const Icon(Icons.add_rounded),
            onPressed: () => _openFormSheet(),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.accentPrimary,
        onRefresh: () =>
            ref.read(achievementsControllerProvider.notifier).reload(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Gamified Summary Banner
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              sliver: SliverToBoxAdapter(
                child: _AchievementsSummaryBanner(
                  unlockedCount: unlockedCount,
                  totalCount: achievements.length,
                  progressPercent: progressPercent,
                  rankLabel: rankLabel,
                ),
              ),
            ),

            // Search + Filter Chips
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  children: [
                    TextField(
                      controller: _searchController,
                      onChanged: (value) =>
                          setState(() => _searchQuery = value),
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Rechercher un succès...',
                        hintStyle: TextStyle(color: AppTheme.textMuted),
                        prefixIcon: Icon(Icons.search_rounded,
                            color: AppTheme.textMuted, size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: Icon(Icons.close_rounded,
                                    color: AppTheme.textMuted, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: AppTheme.bgSurface,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusMd),
                          borderSide: BorderSide(color: AppTheme.borderSubtle),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusMd),
                          borderSide: BorderSide(color: AppTheme.borderSubtle),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusMd),
                          borderSide: BorderSide(color: AppTheme.accentPrimary),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _FilterChip(
                          label: 'Tous (${achievements.length})',
                          selected: _filter == _AchievementFilter.all,
                          onTap: () =>
                              setState(() => _filter = _AchievementFilter.all),
                        ),
                        const SizedBox(width: 8),
                        _FilterChip(
                          label: 'Débloqués ($unlockedCount)',
                          selected: _filter == _AchievementFilter.unlocked,
                          onTap: () => setState(
                              () => _filter = _AchievementFilter.unlocked),
                        ),
                        const SizedBox(width: 8),
                        _FilterChip(
                          label: 'À débloquer ($lockedCount)',
                          selected: _filter == _AchievementFilter.locked,
                          onTap: () => setState(
                              () => _filter = _AchievementFilter.locked),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Grid or Empty state
            if (achievementsAsync.isLoading && achievements.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (filtered.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.emoji_events_rounded,
                          size: 48,
                          color: AppTheme.textMuted.withValues(alpha: 0.5),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          achievements.isEmpty
                              ? 'Aucun succès pour le moment'
                              : 'Aucun succès trouvé',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          achievements.isEmpty
                              ? 'Crée ton premier défi de lecture et valide-le pour débloquer ton trophée !'
                              : 'Essaie un autre filtre ou une autre recherche.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13.5,
                            color: AppTheme.textMuted,
                          ),
                        ),
                        if (achievements.isEmpty) ...[
                          const SizedBox(height: 18),
                          ElevatedButton.icon(
                            onPressed: () => _openFormSheet(),
                            icon: const Icon(Icons.add_rounded),
                            label: const Text('Créer un succès'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 36),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 14,
                    childAspectRatio: 0.68,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final achievement = filtered[index];
                      return _AchievementGridCard(
                        achievement: achievement,
                        formattedDate: achievement.unlockedAt != null
                            ? _formatDate(achievement.unlockedAt!)
                            : null,
                        onToggle: () => _toggleAchievement(achievement),
                        onStepChange: (next) => _updateSteps(achievement, next),
                        onOpenMenu: () => _openCardActions(achievement),
                      );
                    },
                    childCount: filtered.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AchievementsSummaryBanner extends StatelessWidget {
  const _AchievementsSummaryBanner({
    required this.unlockedCount,
    required this.totalCount,
    required this.progressPercent,
    required this.rankLabel,
  });

  final int unlockedCount;
  final int totalCount;
  final int progressPercent;
  final String rankLabel;

  static const _gold = Color(0xFFFFD60A);
  static const _orange = Color(0xFFFF9500);
  static const _coral = Color(0xFFFF5E3A);

  @override
  Widget build(BuildContext context) {
    final isActive = unlockedCount > 0;
    final isBeige = AppTheme.currentMode == AppThemeMode.beige;
    final progress = totalCount > 0
        ? (unlockedCount / totalCount).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
        boxShadow: AppTheme.cardShadow,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Stack(
          children: [
            if (isActive)
              Positioned(
                top: -28,
                left: -20,
                width: 220,
                height: 130,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: const Alignment(-0.4, 0.0),
                        radius: 0.9,
                        colors: [
                          _orange.withValues(alpha: isBeige ? 0.14 : 0.16),
                          _coral.withValues(alpha: 0.04),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: isActive
                          ? const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [_gold, _orange, _coral],
                            )
                          : null,
                      color: isActive ? null : AppTheme.bgElevated,
                      border: Border.all(
                        color: isActive
                            ? Colors.white.withValues(alpha: 0.25)
                            : AppTheme.borderSubtle,
                      ),
                      boxShadow: isActive
                          ? [
                              BoxShadow(
                                color: _orange.withValues(alpha: 0.38),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : null,
                    ),
                    child: Icon(
                      Icons.emoji_events_rounded,
                      color: isActive ? Colors.white : AppTheme.textMuted,
                      size: 21,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: '$unlockedCount',
                                    style: TextStyle(
                                      fontSize: 15.5,
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.textPrimary,
                                    ),
                                  ),
                                  TextSpan(
                                    text: ' / $totalCount',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              'succès débloqués',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: AppTheme.textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? _orange.withValues(alpha: 0.14)
                                    : AppTheme.bgElevated,
                                borderRadius: BorderRadius.circular(
                                    AppTheme.radiusFull),
                                border: Border.all(
                                  color: isActive
                                      ? _orange.withValues(alpha: 0.38)
                                      : AppTheme.borderSubtle,
                                ),
                              ),
                              child: Text(
                                rankLabel,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: isActive
                                      ? (isBeige
                                          ? const Color(0xFFD95F02)
                                          : _orange)
                                      : AppTheme.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: SizedBox(
                                height: 10,
                                child: LayoutBuilder(
                                  builder: (context, constraints) {
                                    final w = constraints.maxWidth;
                                    return Stack(
                                      alignment: Alignment.centerLeft,
                                      children: [
                                        Container(
                                          height: 7,
                                          decoration: BoxDecoration(
                                            color: AppTheme.bgElevated,
                                            borderRadius:
                                                BorderRadius.circular(999),
                                          ),
                                        ),
                                        Container(
                                          height: 7,
                                          width: (w * progress).clamp(0.0, w),
                                          decoration: BoxDecoration(
                                            gradient: const LinearGradient(
                                              colors: [_gold, _orange, _coral],
                                            ),
                                            borderRadius:
                                                BorderRadius.circular(999),
                                            boxShadow: isActive
                                                ? [
                                                    BoxShadow(
                                                      color: _orange.withValues(
                                                          alpha: 0.4),
                                                      blurRadius: 6,
                                                    ),
                                                  ]
                                                : null,
                                          ),
                                        ),
                                        for (final m in const [
                                          0.25,
                                          0.50,
                                          0.75,
                                          1.0
                                        ])
                                          Positioned(
                                            left: (w * m - 3.5)
                                                .clamp(0.0, w - 7),
                                            child: Container(
                                              width: 7,
                                              height: 7,
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                color: progress >= m
                                                    ? _gold
                                                    : AppTheme.bgSurface,
                                                border: Border.all(
                                                  color: progress >= m
                                                      ? _coral
                                                      : AppTheme.borderSubtle,
                                                  width: 1.4,
                                                ),
                                              ),
                                            ),
                                          ),
                                      ],
                                    );
                                  },
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '$progressPercent%',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: isActive
                                    ? (isBeige
                                        ? const Color(0xFFD95F02)
                                        : _orange)
                                    : AppTheme.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: selected ? AppTheme.accentPrimary : AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              border: Border.all(
                color: selected ? AppTheme.accentPrimary : AppTheme.borderSubtle,
              ),
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : AppTheme.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AchievementGridCard extends StatelessWidget {
  const _AchievementGridCard({
    required this.achievement,
    required this.formattedDate,
    required this.onToggle,
    required this.onStepChange,
    required this.onOpenMenu,
  });

  final Achievement achievement;
  final String? formattedDate;
  final VoidCallback onToggle;
  final ValueChanged<int> onStepChange;
  final VoidCallback onOpenMenu;

  @override
  Widget build(BuildContext context) {
    final medalColor = achievement.parsedIconColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Square visual showcase tile (BookCard style)
        Expanded(
          child: GestureDetector(
            onTap: onOpenMenu,
            onLongPress: onOpenMenu,
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(
                  color: achievement.unlocked
                      ? medalColor.withValues(alpha: 0.38)
                      : AppTheme.borderSubtle,
                ),
                boxShadow: AppTheme.cardShadow,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    if (achievement.unlocked)
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: RadialGradient(
                              center: const Alignment(0, 0),
                              radius: 0.85,
                              colors: [
                                medalColor.withValues(alpha: 0.22),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                    // Top bar pills
                    Positioned(
                      top: 8,
                      left: 8,
                      right: 8,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: achievement.unlocked
                                  ? const Color(0xE610B981)
                                  : achievement.completedSteps > 0
                                      ? const Color(0xE68B5CF6)
                                      : const Color(0xD9475569),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusFull),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  achievement.unlocked
                                      ? Icons.check_rounded
                                      : Icons.lock_rounded,
                                  size: 10,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  achievement.unlocked
                                      ? 'Débloqué'
                                      : achievement.completedSteps > 0
                                          ? 'En cours'
                                          : 'Verrouillé',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (achievement.totalSteps > 1)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xD90F172A),
                                borderRadius: BorderRadius.circular(
                                    AppTheme.radiusFull),
                              ),
                              child: Text(
                                '${achievement.completedSteps}/${achievement.totalSteps}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    // Medal
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: AchievementMedalWidget(
                        icon: achievement.icon,
                        ornament: achievement.ornament,
                        iconColor: medalColor,
                        backgroundColor: achievement.parsedBackgroundColor,
                        size: 98,
                        unlocked: achievement.unlocked,
                      ),
                    ),
                    // Bottom progress strip for multi-step
                    if (achievement.totalSteps > 1)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: LinearProgressIndicator(
                          value: achievement.progress,
                          minHeight: 3.5,
                          backgroundColor:
                              AppTheme.bgElevated.withValues(alpha: 0.6),
                          valueColor: AlwaysStoppedAnimation<Color>(
                            achievement.unlocked
                                ? medalColor
                                : AppTheme.accentPrimary,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        // Title + meta
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Text(
            achievement.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: achievement.unlocked
                  ? AppTheme.textPrimary
                  : AppTheme.textSecondary,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Text(
            achievement.unlocked
                ? (formattedDate ?? 'Débloqué')
                : achievement.totalSteps > 1
                    ? '${achievement.completedSteps} / ${achievement.totalSteps} étapes'
                    : 'Non débloqué',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: AppTheme.textMuted,
            ),
          ),
        ),
        const SizedBox(height: 6),
        // Quick action bar
        if (achievement.totalSteps > 1)
          Row(
            children: [
              _MiniIconBtn(
                icon: Icons.remove_rounded,
                enabled: achievement.completedSteps > 0,
                onTap: () => onStepChange(achievement.completedSteps - 1),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _MiniIconBtn(
                  icon: Icons.add_rounded,
                  label: '+1',
                  enabled: achievement.completedSteps < achievement.totalSteps,
                  onTap: () => onStepChange(achievement.completedSteps + 1),
                ),
              ),
              const SizedBox(width: 6),
              _MiniIconBtn(
                icon: Icons.check_rounded,
                active: achievement.unlocked,
                activeColor: medalColor,
                onTap: onToggle,
              ),
            ],
          )
        else
          SizedBox(
            height: 30,
            child: Material(
              color: achievement.unlocked
                  ? medalColor.withValues(alpha: 0.16)
                  : AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(8),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: onToggle,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: achievement.unlocked
                          ? medalColor.withValues(alpha: 0.45)
                          : AppTheme.borderSubtle,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: achievement.unlocked
                            ? medalColor
                            : AppTheme.textSecondary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        achievement.unlocked ? 'Débloqué' : 'Valider',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: achievement.unlocked
                              ? medalColor
                              : AppTheme.textSecondary,
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

class _MiniIconBtn extends StatelessWidget {
  const _MiniIconBtn({
    required this.icon,
    required this.onTap,
    this.label,
    this.enabled = true,
    this.active = false,
    this.activeColor,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? label;
  final bool enabled;
  final bool active;
  final Color? activeColor;

  @override
  Widget build(BuildContext context) {
    final fg = active
        ? (activeColor ?? AppTheme.accentPrimary)
        : enabled
            ? AppTheme.textPrimary
            : AppTheme.textMuted.withValues(alpha: 0.4);

    return Material(
      color: active
          ? (activeColor ?? AppTheme.accentPrimary).withValues(alpha: 0.16)
          : AppTheme.bgSurface,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: enabled ? onTap : null,
        child: Container(
          height: 30,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: active
                  ? (activeColor ?? AppTheme.accentPrimary)
                      .withValues(alpha: 0.45)
                  : AppTheme.borderSubtle,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: fg),
              if (label != null) ...[
                const SizedBox(width: 2),
                Text(
                  label!,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AchievementFormSheet extends ConsumerStatefulWidget {
  const _AchievementFormSheet({this.editing});

  final Achievement? editing;

  @override
  ConsumerState<_AchievementFormSheet> createState() =>
      _AchievementFormSheetState();
}

class _AchievementFormSheetState extends ConsumerState<_AchievementFormSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _stepsController;
  late String _icon;
  late String _ornament;
  late String _iconColor;
  late String _bgColor;
  DateTime? _unlockedAt;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final e = widget.editing;
    _nameController = TextEditingController(text: e?.name ?? '');
    _stepsController = TextEditingController(text: '${e?.totalSteps ?? 1}');
    _icon = e?.icon ?? 'trophy';
    _ornament = e?.ornament ?? 'laurel';
    _iconColor = e?.iconColor ?? '#f59e0b';
    _bgColor = e?.backgroundColor ?? '#fef3c7';
    _unlockedAt = e?.unlockedAt;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _stepsController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    final steps = (int.tryParse(_stepsController.text.trim()) ?? 1).clamp(1, 9999);

    setState(() => _submitting = true);
    try {
      final controller = ref.read(achievementsControllerProvider.notifier);
      final Achievement saved;
      if (widget.editing != null) {
        saved = await controller.updateAchievement(
          id: widget.editing!.id,
          name: name,
          totalSteps: steps,
          completedSteps: _unlockedAt != null ? steps : null,
          icon: _icon,
          ornament: _ornament,
          iconColor: _iconColor,
          backgroundColor: _bgColor,
          unlockedAt: _unlockedAt,
        );
      } else {
        saved = await controller.createAchievement(
          name: name,
          totalSteps: steps,
          icon: _icon,
          ornament: _ornament,
          iconColor: _iconColor,
          backgroundColor: _bgColor,
          unlockedAt: _unlockedAt,
        );
      }
      if (mounted) Navigator.of(context).pop(saved);
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Impossible d\'enregistrer : $err'),
            backgroundColor: AppTheme.accentRed,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final parsedIcon = parseHexColor(_iconColor, const Color(0xFFF59E0B));
    final parsedBg = parseHexColor(_bgColor, const Color(0xFFFEF3C7));

    return Container(
      margin: const EdgeInsets.only(top: 48),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottomInset),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppTheme.borderSubtle,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              Text(
                widget.editing != null
                    ? 'Modifier le succès'
                    : 'Créer un succès',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 14),
              // Compact Locked vs Unlocked preview
              Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.bgElevated,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    Column(
                      children: [
                        AchievementMedalWidget(
                          icon: _icon,
                          ornament: _ornament,
                          iconColor: parsedIcon,
                          backgroundColor: parsedBg,
                          size: 76,
                          unlocked: false,
                        ),
                        const SizedBox(height: 2),
                        Text('Grisé',
                            style: TextStyle(
                                fontSize: 11, color: AppTheme.textSecondary)),
                      ],
                    ),
                    Column(
                      children: [
                        AchievementMedalWidget(
                          icon: _icon,
                          ornament: _ornament,
                          iconColor: parsedIcon,
                          backgroundColor: parsedBg,
                          size: 76,
                          unlocked: true,
                        ),
                        const SizedBox(height: 2),
                        Text('Débloqué',
                            style: TextStyle(
                                fontSize: 11, color: AppTheme.textSecondary)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _nameController,
                style: TextStyle(color: AppTheme.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Nom du succès',
                  hintText: 'Ex : Lire 10 mangas',
                  filled: true,
                  fillColor: AppTheme.bgElevated,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _stepsController,
                      keyboardType: TextInputType.number,
                      style: TextStyle(color: AppTheme.textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Nombre d\'étapes',
                        filled: true,
                        fillColor: AppTheme.bgElevated,
                        border: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusSm),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _unlockedAt ?? DateTime.now(),
                          firstDate: DateTime(2000),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setState(() => _unlockedAt = picked);
                        }
                      },
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'Date (optionnel)',
                          filled: true,
                          fillColor: AppTheme.bgElevated,
                          border: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSm),
                          ),
                        ),
                        child: Text(
                          _unlockedAt != null
                              ? '${_unlockedAt!.day.toString().padLeft(2, '0')}/${_unlockedAt!.month.toString().padLeft(2, '0')}/${_unlockedAt!.year}'
                              : 'Aucune',
                          style: TextStyle(
                            color: _unlockedAt != null
                                ? AppTheme.textPrimary
                                : AppTheme.textMuted,
                            fontSize: 13.5,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _ornament,
                dropdownColor: AppTheme.bgSurface,
                style: TextStyle(color: AppTheme.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Ornement',
                  filled: true,
                  fillColor: AppTheme.bgElevated,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                ),
                items: kAchievementOrnamentOptions
                    .map((o) =>
                        DropdownMenuItem(value: o.id, child: Text(o.label)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _ornament = v);
                },
              ),
              const SizedBox(height: 12),
              Text(
                'Icône',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: kAchievementIconOptions.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, idx) {
                    final opt = kAchievementIconOptions[idx];
                    final selected = _icon == opt.id;
                    return InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => setState(() => _icon = opt.id),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: selected
                              ? AppTheme.accentPrimary
                              : AppTheme.bgElevated,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: selected
                                ? AppTheme.accentPrimary
                                : AppTheme.borderSubtle,
                          ),
                        ),
                        child: Icon(
                          opt.iconData ?? Icons.emoji_events_rounded,
                          size: 20,
                          color: selected
                              ? Colors.white
                              : AppTheme.textSecondary,
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              _ColorPresetStrip(
                label: 'Couleur de l\'icône',
                presets: kAchievementIconColorPresets,
                selected: _iconColor,
                onSelect: (c) => setState(() => _iconColor = c),
              ),
              const SizedBox(height: 10),
              _ColorPresetStrip(
                label: 'Couleur de fond',
                presets: kAchievementBgColorPresets,
                selected: _bgColor,
                onSelect: (c) => setState(() => _bgColor = c),
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 46,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _save,
                  child: Text(widget.editing != null ? 'Enregistrer' : 'Créer'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ColorPresetStrip extends StatelessWidget {
  const _ColorPresetStrip({
    required this.label,
    required this.presets,
    required this.selected,
    required this.onSelect,
  });

  final String label;
  final List<String> presets;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: AppTheme.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 30,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: presets.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, idx) {
              final hex = presets[idx];
              final isSelected = hex.toLowerCase() == selected.toLowerCase();
              return GestureDetector(
                onTap: () => onSelect(hex),
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: parseHexColor(hex, Colors.amber),
                    border: Border.all(
                      color: isSelected
                          ? AppTheme.accentPrimary
                          : Colors.black.withValues(alpha: 0.25),
                      width: isSelected ? 2.5 : 1,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
