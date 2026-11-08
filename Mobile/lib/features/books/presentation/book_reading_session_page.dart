import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import 'components/app_header.dart';
import 'components/book_completion_dialog.dart';

class BookReadingSessionPage extends ConsumerStatefulWidget {
  const BookReadingSessionPage({
    super.key,
    required this.book,
    this.initialDuration,
  });

  final Book book;
  final Duration? initialDuration;

  @override
  ConsumerState<BookReadingSessionPage> createState() => _BookReadingSessionPageState();
}

class _BookReadingSessionPageState extends ConsumerState<BookReadingSessionPage> {
  late DateTime _sessionDateTime;
  late Duration _duration;
  late int _currentPage;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final progress = ref.read(readingProgressByBookProvider(widget.book)).value;
    _sessionDateTime = DateTime.now();
    _duration = widget.initialDuration ?? Duration.zero;
    _currentPage = progress?.currentPage ?? 0;
  }

  String _formatDateTime(DateTime value) {
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    final year = value.year.toString();
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$minute';
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _pickDateTime() async {
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _sessionDateTime,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (pickedDate == null || !mounted) {
      return;
    }

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_sessionDateTime),
    );
    if (pickedTime == null || !mounted) {
      return;
    }

    setState(() {
      _sessionDateTime = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  Future<void> _editDuration() async {
    final result = await showModalBottomSheet<Duration>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _DurationBottomSheet(initialDuration: _duration),
    );

    if (result != null && mounted) {
      setState(() => _duration = result);
    }
  }

  Future<void> _editPages() async {
    final totalPages = widget.book.totalPages ?? 0;
    final result = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _PageWheelBottomSheet(
        totalPages: totalPages,
        initialPage: totalPages <= 0 ? 0 : _currentPage.clamp(0, totalPages),
      ),
    );

    if (result != null && mounted) {
      setState(() => _currentPage = result);
    }
  }

  Future<void> _save() async {
    final book = widget.book;
    setState(() => _saving = true);
    try {
      final totalPages = book.totalPages;
      final completed = totalPages != null && totalPages > 0 && _currentPage >= totalPages;

      await ref.read(booksControllerProvider.notifier).logReadingSession(
            book: book,
            currentPage: _currentPage,
            sessionDuration: _duration,
            occurredAt: _sessionDateTime,
          );
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();

      if (completed) {
        // Afficher la célébration de complétion si le contexte est toujours disponible
        final currentContext = Navigator.of(context).context;
        await BookCompletionDialog.show(currentContext, book);
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalPages = widget.book.totalPages ?? 0;
    final normalizedPage = totalPages <= 0 ? 0 : _currentPage.clamp(0, totalPages);
    final currentPageText = totalPages <= 0
        ? 'p. $normalizedPage'
        : 'p. $normalizedPage / $totalPages';

    return Scaffold(
      appBar: AppHeader(
        title: 'Enregistrer la session',
        subtitle: widget.book.title,
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
            widget.book.title,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.02,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Renseignez la durée et la progression de votre session de lecture.',
            style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 20),
          _SessionOptionCard(
            icon: Icons.event_rounded,
            title: 'Date et heure',
            subtitle: _formatDateTime(_sessionDateTime),
            iconColor: AppTheme.accentPrimary,
            iconBg: AppTheme.accentPrimaryLight,
            onTap: _pickDateTime,
          ),
          const SizedBox(height: 12),
          _SessionOptionCard(
            icon: Icons.timer_rounded,
            title: 'Temps de lecture',
            subtitle: _formatDuration(_duration),
            iconColor: AppTheme.accentAmber,
            iconBg: AppTheme.accentAmberLight,
            onTap: _editDuration,
          ),
          const SizedBox(height: 12),
          _SessionOptionCard(
            icon: Icons.menu_book_rounded,
            title: 'Pages lues',
            subtitle: currentPageText,
            iconColor: AppTheme.accentSecondary,
            iconBg: AppTheme.accentSecondaryLight,
            onTap: _editPages,
          ),
          const SizedBox(height: 24),
          Container(
            height: 48,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.accentPrimaryGlow,
                  blurRadius: 14,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                onTap: _saving ? null : _save,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      _saving ? 'Enregistrement...' : 'Enregistrer la session',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionOptionCard extends StatelessWidget {
  const _SessionOptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.iconColor,
    required this.iconBg,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color iconColor;
  final Color iconBg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
      ),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          ),
          child: Center(
            child: Icon(icon, color: iconColor, size: 20),
          ),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimary,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
        ),
        trailing: Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
      ),
    );
  }
}

class _DurationBottomSheet extends StatefulWidget {
  const _DurationBottomSheet({required this.initialDuration});

  final Duration initialDuration;

  @override
  State<_DurationBottomSheet> createState() => _DurationBottomSheetState();
}

class _DurationBottomSheetState extends State<_DurationBottomSheet> {
  late final TextEditingController _hoursController;
  late final TextEditingController _minutesController;
  late final TextEditingController _secondsController;

  @override
  void initState() {
    super.initState();
    _hoursController = TextEditingController(text: widget.initialDuration.inHours.toString());
    _minutesController = TextEditingController(
      text: widget.initialDuration.inMinutes.remainder(60).toString(),
    );
    _secondsController = TextEditingController(
      text: widget.initialDuration.inSeconds.remainder(60).toString(),
    );
  }

  @override
  void dispose() {
    _hoursController.dispose();
    _minutesController.dispose();
    _secondsController.dispose();
    super.dispose();
  }

  void _submit() {
    final hours = int.tryParse(_hoursController.text.trim()) ?? 0;
    final minutes = int.tryParse(_minutesController.text.trim()) ?? 0;
    final seconds = int.tryParse(_secondsController.text.trim()) ?? 0;
    final duration = Duration(hours: hours, minutes: minutes, seconds: seconds);
    Navigator.of(context).pop(duration);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Temps de lecture',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _hoursController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Heures'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _minutesController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Minutes'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _secondsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Secondes'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submit,
              child: const Text('Valider'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PageWheelBottomSheet extends StatefulWidget {
  const _PageWheelBottomSheet({required this.totalPages, required this.initialPage});

  final int totalPages;
  final int initialPage;

  @override
  State<_PageWheelBottomSheet> createState() => _PageWheelBottomSheetState();
}

class _PageWheelBottomSheetState extends State<_PageWheelBottomSheet> {
  late final FixedExtentScrollController _controller;
  late int _selectedPage;

  @override
  void initState() {
    super.initState();
    _selectedPage = widget.initialPage;
    _controller = FixedExtentScrollController(initialItem: _selectedPage);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    Navigator.of(context).pop(_selectedPage);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final totalPages = widget.totalPages;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Pages lues',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 240,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  ListWheelScrollView.useDelegate(
                    controller: _controller,
                    itemExtent: 52,
                    perspective: 0.003,
                    diameterRatio: 1.15,
                    physics: const FixedExtentScrollPhysics(),
                    useMagnifier: true,
                    magnification: 1.08,
                    onSelectedItemChanged: (index) {
                      setState(() => _selectedPage = index);
                    },
                    childDelegate: ListWheelChildBuilderDelegate(
                      childCount: totalPages <= 0 ? 1 : totalPages + 1,
                      builder: (context, index) {
                        final selected = index == _selectedPage;
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 150),
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                                color: selected ? AppTheme.accentPrimary : AppTheme.textMuted,
                              ),
                              child: Text(
                                totalPages <= 0 ? 'p. 0' : 'p. $index / $totalPages',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  IgnorePointer(
                    child: Container(
                      width: double.infinity,
                      height: 46,
                      margin: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.accentPrimaryLight,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                          width: 1,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submit,
              child: const Text('Valider'),
            ),
          ],
        ),
      ),
    );
  }
}
