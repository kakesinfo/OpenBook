import 'package:material_ui/material_ui.dart';

class Achievement {
  const Achievement({
    required this.id,
    required this.name,
    required this.totalSteps,
    required this.completedSteps,
    required this.icon,
    required this.ornament,
    required this.iconColor,
    required this.backgroundColor,
    required this.unlocked,
    this.unlockedAt,
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final String name;
  final int totalSteps;
  final int completedSteps;
  final String icon;
  final String ornament;
  final String iconColor;
  final String backgroundColor;
  final bool unlocked;
  final DateTime? unlockedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  double get progress =>
      totalSteps > 0 ? (completedSteps / totalSteps).clamp(0.0, 1.0) : 0.0;

  int get progressPercent => (progress * 100).round();

  Color get parsedIconColor =>
      parseHexColor(iconColor, const Color(0xFFF59E0B));

  Color get parsedBackgroundColor =>
      parseHexColor(backgroundColor, const Color(0xFFFEF3C7));

  Achievement copyWith({
    int? id,
    String? name,
    int? totalSteps,
    int? completedSteps,
    String? icon,
    String? ornament,
    String? iconColor,
    String? backgroundColor,
    bool? unlocked,
    DateTime? unlockedAt,
    bool clearUnlockedAt = false,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Achievement(
      id: id ?? this.id,
      name: name ?? this.name,
      totalSteps: totalSteps ?? this.totalSteps,
      completedSteps: completedSteps ?? this.completedSteps,
      icon: icon ?? this.icon,
      ornament: ornament ?? this.ornament,
      iconColor: iconColor ?? this.iconColor,
      backgroundColor: backgroundColor ?? this.backgroundColor,
      unlocked: unlocked ?? this.unlocked,
      unlockedAt: clearUnlockedAt ? null : (unlockedAt ?? this.unlockedAt),
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory Achievement.fromJson(Map<String, dynamic> map) {
    DateTime? parseDate(dynamic value) {
      if (value == null) return null;
      return DateTime.tryParse(value.toString());
    }

    return Achievement(
      id: (map['id'] as num).toInt(),
      name: (map['name'] ?? '').toString(),
      totalSteps: (map['totalSteps'] as num?)?.toInt() ?? 1,
      completedSteps: (map['completedSteps'] as num?)?.toInt() ?? 0,
      icon: (map['icon'] ?? 'trophy').toString(),
      ornament: (map['ornament'] ?? 'laurel').toString(),
      iconColor: (map['iconColor'] ?? '#f59e0b').toString(),
      backgroundColor: (map['backgroundColor'] ?? '#fef3c7').toString(),
      unlocked: map['unlocked'] == true,
      unlockedAt: parseDate(map['unlockedAt']),
      createdAt: parseDate(map['createdAt']),
      updatedAt: parseDate(map['updatedAt']),
    );
  }
}

Color parseHexColor(String hex, Color fallback) {
  final cleaned = hex.trim().replaceFirst('#', '');
  if (cleaned.length == 6) {
    final value = int.tryParse('FF$cleaned', radix: 16);
    if (value != null) return Color(value);
  } else if (cleaned.length == 8) {
    final value = int.tryParse(cleaned, radix: 16);
    if (value != null) return Color(value);
  }
  return fallback;
}

String achievementRankLabel(int unlockedCount, int totalCount) {
  if (totalCount <= 0 || unlockedCount <= 0) return 'Débutant';
  final percent = ((unlockedCount / totalCount) * 100).round();
  if (percent >= 100) return 'Légende';
  if (percent >= 75) return 'Maître';
  if (percent >= 50) return 'Collectionneur';
  if (percent >= 25) return 'Explorateur';
  return 'Apprenti';
}

class AchievementOption {
  const AchievementOption(this.id, this.label, [this.iconData]);

  final String id;
  final String label;
  final IconData? iconData;
}

const List<AchievementOption> kAchievementOrnamentOptions = [
  AchievementOption('laurel', 'Laurier'),
  AchievementOption('stars', 'Étoiles'),
  AchievementOption('wings', 'Ailes'),
  AchievementOption('royal', 'Rayons'),
  AchievementOption('ribbon', 'Ruban'),
  AchievementOption('none', 'Aucun'),
];

const List<AchievementOption> kAchievementIconOptions = [
  AchievementOption('trophy', 'Coupe légendaire', Icons.emoji_events_rounded),
  AchievementOption('crown', 'Couronne royale', Icons.workspace_premium_rounded),
  AchievementOption('medal', 'Médaille d\'honneur', Icons.military_tech_rounded),
  AchievementOption('star', 'Étoile nova', Icons.star_rounded),
  AchievementOption('gem', 'Diamant taillé', Icons.diamond_rounded),
  AchievementOption('fire', 'Flamme éternelle', Icons.local_fire_department_rounded),
  AchievementOption('bolt', 'Foudre', Icons.bolt_rounded),
  AchievementOption('book', 'Grimoire', Icons.menu_book_rounded),
  AchievementOption('book-open', 'Livre enchanté', Icons.auto_stories_rounded),
  AchievementOption('coffee', 'Pause lecture', Icons.coffee_rounded),
  AchievementOption('bookmark', 'Ruban d\'or', Icons.bookmark_rounded),
  AchievementOption('feather', 'Plume d\'écrivain', Icons.edit_rounded),
  AchievementOption('glasses', 'Érudit', Icons.visibility_rounded),
  AchievementOption('dragon', 'Dragon', Icons.pets_rounded),
  AchievementOption('shield', 'Écu héroïque', Icons.shield_rounded),
  AchievementOption('wand', 'Arcane', Icons.auto_fix_high_rounded),
  AchievementOption('rocket', 'Astronef', Icons.rocket_launch_rounded),
  AchievementOption('compass', 'Boussole', Icons.explore_rounded),
  AchievementOption('flag', 'Bannière', Icons.flag_rounded),
  AchievementOption('heart', 'Cœur sacré', Icons.favorite_rounded),
  AchievementOption('award', 'Laurier', Icons.verified_rounded),
];

IconData achievementIconData(String id) {
  for (final opt in kAchievementIconOptions) {
    if (opt.id == id && opt.iconData != null) {
      return opt.iconData!;
    }
  }
  return Icons.emoji_events_rounded;
}

const List<String> kAchievementIconColorPresets = [
  '#ffd700',
  '#d4af37',
  '#c0c0c0',
  '#94a3b8',
  '#cd7f32',
  '#a97142',
  '#f59e0b',
  '#eab308',
  '#ea580c',
  '#ef4444',
  '#f43f5e',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#22c55e',
  '#1e293b',
  '#ffffff',
];

const List<String> kAchievementBgColorPresets = [
  '#fef08a',
  '#785616',
  '#e2e8f0',
  '#475569',
  '#e6ccb2',
  '#5c3a21',
  '#fef3c7',
  '#ffedd5',
  '#fee2e2',
  '#fce7f3',
  '#f3e8ff',
  '#e0e7ff',
  '#dbeafe',
  '#cffafe',
  '#d1fae5',
  '#dcfce7',
  '#2d6a4f',
  '#1b4332',
  '#1e293b',
  '#312e81',
];
