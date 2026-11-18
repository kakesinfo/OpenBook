import 'package:material_ui/material_ui.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_application_1/features/books/data/book_transaction.dart';

class AddBookPurchaseSheet extends StatefulWidget {
  const AddBookPurchaseSheet({
    super.key,
    required this.bookId,
    this.initialPrice,
    required this.onSubmit,
  });

  final int bookId;
  final double? initialPrice;
  final Future<void> Function(BookTransaction tx) onSubmit;

  @override
  State<AddBookPurchaseSheet> createState() => _AddBookPurchaseSheetState();
}

class _AddBookPurchaseSheetState extends State<AddBookPurchaseSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _dateController;
  late final TextEditingController _priceController;
  late final TextEditingController _locationController;
  late final TextEditingController _memoController;

  bool _isGift = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _dateController = TextEditingController(
      text: _formatDate(now),
    );
    _priceController = TextEditingController(
      text: widget.initialPrice != null ? widget.initialPrice!.toStringAsFixed(2) : '',
    );
    _locationController = TextEditingController();
    _memoController = TextEditingController();
  }

  @override
  void dispose() {
    _dateController.dispose();
    _priceController.dispose();
    _locationController.dispose();
    _memoController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) {
    final year = d.year.toString().padLeft(4, '0');
    final month = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  Future<void> _selectDate() async {
    final currentText = _dateController.text.trim();
    DateTime initial = DateTime.now();
    if (currentText.isNotEmpty) {
      final parsed = DateTime.tryParse(currentText);
      if (parsed != null) {
        initial = parsed;
      }
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );

    if (picked != null) {
      setState(() {
        _dateController.text = _formatDate(picked);
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final priceVal = _priceController.text.trim().replaceAll(',', '.');
      final priceDouble = !_isGift && priceVal.isNotEmpty ? double.tryParse(priceVal) : null;

      final tx = BookTransaction(
        bookId: widget.bookId,
        type: _isGift ? 'GIFT' : 'BOUGHT',
        date: _dateController.text.trim().isNotEmpty ? _dateController.text.trim() : null,
        price: priceDouble,
        location: _locationController.text.trim().isNotEmpty ? _locationController.text.trim() : null,
        memo: _memoController.text.trim().isNotEmpty ? _memoController.text.trim() : null,
      );

      await widget.onSubmit(tx);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: AppTheme.accentRed,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
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
      child: Form(
        key: _formKey,
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
                    _isGift ? Icons.card_giftcard_rounded : Icons.shopping_cart_rounded,
                    color: _isGift ? AppTheme.accentSecondary : AppTheme.accentPrimary,
                    size: 24,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    _isGift ? 'Ajouter un cadeau reçu' : 'Ajouter un achat',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Option cadeau reçu
              Container(
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(
                    color: _isGift ? AppTheme.accentSecondary.withValues(alpha: 0.5) : AppTheme.borderMedium,
                  ),
                ),
                child: SwitchListTile(
                  title: Text(
                    'Cadeau reçu (sans prix)',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    'Cochez si cet album vous a été offert',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                  value: _isGift,
                  activeThumbColor: AppTheme.accentSecondary,
                  onChanged: (val) {
                    setState(() {
                      _isGift = val;
                    });
                  },
                ),
              ),
              const SizedBox(height: 16),

              // Date d'achat
              Text(
                _isGift ? 'Date de réception' : 'Date d\'achat',
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
                    decoration: InputDecoration(
                      hintText: 'AAAA-MM-JJ',
                      prefixIcon: const Icon(Icons.calendar_today_rounded, size: 20),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () => _dateController.clear(),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Lieu d'achat
              Text(
                _isGift ? 'Offert par / Occasion' : 'Lieu d\'achat',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textMuted,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _locationController,
                decoration: InputDecoration(
                  hintText: _isGift ? 'Ex: Anniversaire, Ami, Famille...' : 'Ex: Librairie, Fnac, Brocante...',
                  prefixIcon: Icon(
                    _isGift ? Icons.card_giftcard_rounded : Icons.storefront_rounded,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Prix d'achat (si non-cadeau)
              if (!_isGift) ...[
                Text(
                  'Prix d\'achat (€)',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textMuted,
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _priceController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    hintText: 'Ex: 15.00',
                    prefixIcon: Icon(Icons.euro_rounded, size: 20),
                  ),
                  validator: (value) {
                    if (_isGift) return null;
                    if (value == null || value.trim().isEmpty) {
                      return null;
                    }
                    final parsed = double.tryParse(value.trim().replaceAll(',', '.'));
                    if (parsed == null || parsed < 0) {
                      return 'Entrez un prix valide';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
              ],

              // Mémo / Remarque
              Text(
                'Mémo / Remarque',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textMuted,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _memoController,
                maxLines: 2,
                decoration: const InputDecoration(
                  hintText: 'Ex: Édition spéciale, état neuf, dédicacé...',
                  prefixIcon: Icon(Icons.notes_rounded, size: 20),
                ),
              ),
              const SizedBox(height: 24),

              // Bouton Enregistrer
              FilledButton.icon(
                onPressed: _isLoading ? null : _handleSubmit,
                icon: _isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.check_rounded),
                label: Text(
                  _isLoading ? 'Enregistrement...' : 'Enregistrer',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: _isGift ? AppTheme.accentSecondary : AppTheme.accentPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
