import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';

/// Résultat du bottom sheet « Commencez à lire ! ».
class StartReadingResult {
  const StartReadingResult({
    required this.startedAt,
    required this.isCommon,
  });

  final DateTime startedAt;
  final bool isCommon;
}

/// Bottom sheet affiché quand on commence à lire un livre :
/// permet de définir la date de début de lecture (aujourd'hui par défaut)
/// et de cocher si c'est une lecture commune.
class StartReadingSheet extends StatefulWidget {
  const StartReadingSheet({super.key, this.initialDate});

  final DateTime? initialDate;

  static Future<StartReadingResult?> show(BuildContext context, {DateTime? initialDate}) {
    return showModalBottomSheet<StartReadingResult>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => StartReadingSheet(initialDate: initialDate),
    );
  }

  @override
  State<StartReadingSheet> createState() => _StartReadingSheetState();
}

class _StartReadingSheetState extends State<StartReadingSheet> {
  late DateTime _selectedDate;
  late final TextEditingController _dateController;
  bool _isCommon = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate ?? DateTime.now();
    _dateController = TextEditingController(text: _formatDate(_selectedDate));
  }

  @override
  void dispose() {
    _dateController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) {
    final day = d.day.toString().padLeft(2, '0');
    final month = d.month.toString().padLeft(2, '0');
    final year = d.year.toString().padLeft(4, '0');
    return '$day/$month/$year';
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      final now = DateTime.now();
      final isToday = picked.year == now.year &&
          picked.month == now.month &&
          picked.day == now.day;
      setState(() {
        _selectedDate = isToday
            ? now
            : DateTime(picked.year, picked.month, picked.day, 12, 0);
        _dateController.text = _formatDate(_selectedDate);
      });
    }
  }

  void _handleSubmit() {
    Navigator.of(context).pop(
      StartReadingResult(startedAt: _selectedDate, isCommon: _isCommon),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.borderMedium,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(
                  Icons.play_circle_fill_rounded,
                  color: AppTheme.accentPrimary,
                  size: 24,
                ),
                const SizedBox(width: 10),
                Text(
                  'Commencez à lire !',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Date de début de lecture
            Text(
              'Date de début de lecture',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.textMuted,
              ),
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: _selectDate,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              child: IgnorePointer(
                child: TextFormField(
                  controller: _dateController,
                  decoration: const InputDecoration(
                    hintText: 'JJ/MM/AAAA',
                    prefixIcon: Icon(Icons.calendar_today_rounded, size: 20),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Lecture commune
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              decoration: BoxDecoration(
                color: AppTheme.bgCard,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(
                  color: _isCommon ? AppTheme.accentSecondary.withValues(alpha: 0.5) : AppTheme.borderMedium,
                ),
              ),
              child: CheckboxListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                ),
                title: Text(
                  'Lecture commune',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary,
                  ),
                ),
                subtitle: Text(
                  'Comme dans un club de lecture : plusieurs personnes lisent le même livre',
                  style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
                value: _isCommon,
                activeColor: AppTheme.accentSecondary,
                onChanged: (val) {
                  setState(() {
                    _isCommon = val ?? false;
                  });
                },
              ),
            ),
            const SizedBox(height: 24),

            // Bouton Commencer
            FilledButton.icon(
              onPressed: _handleSubmit,
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text(
                'Commencer',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.accentPrimary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
