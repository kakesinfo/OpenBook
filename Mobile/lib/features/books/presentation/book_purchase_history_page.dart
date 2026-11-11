import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/books_providers.dart';
import '../data/book.dart';
import '../data/book_transaction.dart';
import 'components/add_book_purchase_sheet.dart';
import 'components/app_header.dart';

class BookPurchaseHistoryPage extends ConsumerWidget {
  const BookPurchaseHistoryPage({
    super.key,
    required this.book,
  });

  final Book book;

  void _openAddPurchaseSheet(BuildContext context, WidgetRef ref) {
    if (book.id == null) return;

    final bookDetails = ref.read(bookDetailsProvider(book.id!)).value;
    final bookPrice = (bookDetails?['price'] as num?)?.toDouble();

    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => AddBookPurchaseSheet(
        bookId: book.id!,
        initialPrice: bookPrice,
        onSubmit: (tx) async {
          await ref.read(booksControllerProvider.notifier).addBookTransaction(
                bookId: book.id!,
                transaction: tx,
              );
        },
      ),
    ).then((added) {
      if (added == true && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Achat enregistré avec succès !'),
            backgroundColor: AppTheme.accentPrimary,
          ),
        );
      }
    });
  }

  Future<void> _deleteTransaction(BuildContext context, WidgetRef ref, BookTransaction tx) async {
    if (tx.id == null || book.id == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cette ligne ?'),
        content: const Text('Voulez-vous vraiment supprimer cette ligne d\'historique d\'achat ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.accentRed),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );

    if (confirm == true && context.mounted) {
      await ref.read(booksControllerProvider.notifier).deleteBookTransaction(
            bookId: book.id!,
            transactionId: tx.id!,
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Ligne supprimée'),
            backgroundColor: AppTheme.accentPrimary,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (book.id == null) {
      return Scaffold(
        appBar: AppHeader(
          title: 'Historique d\'achat',
          showLogo: false,
          leading: IconButton(
            tooltip: 'Retour',
            icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: const Center(child: Text('Identifiant d\'album introuvable')),
      );
    }

    final txsAsync = ref.watch(bookTransactionsProvider(book.id!));

    return Scaffold(
      appBar: AppHeader(
        title: 'Historique d\'achat',
        subtitle: book.title,
        showLogo: false,
        leading: IconButton(
          tooltip: 'Retour',
          icon: Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.accentPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_shopping_cart_rounded),
        label: const Text('Ajouter un achat'),
        onPressed: () => _openAddPurchaseSheet(context, ref),
      ),
      body: txsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Erreur de chargement: $err', style: TextStyle(color: AppTheme.accentRed)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => ref.invalidate(bookTransactionsProvider(book.id!)),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
        data: (transactions) {
          final totalBought = transactions
              .where((t) => t.isBought && t.price != null)
              .fold<double>(0.0, (acc, t) => acc + t.price!);
          final giftsCount = transactions.where((t) => t.isGift).length;
          final totalSold = transactions
              .where((t) => t.isSold && t.price != null)
              .fold<double>(0.0, (acc, t) => acc + t.price!);
          final hasBought = transactions.any((t) => t.isBought);
          final hasGift = giftsCount > 0;
          final hasSold = transactions.any((t) => t.isSold);

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 80),
            children: [
              Text(
                book.title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.02,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Historique des achats, cadeaux reçus et transactions pour cet album.',
                style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 18),

              // Résumé / Statut
              if (transactions.isNotEmpty) ...[
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (hasBought)
                      _SummaryPill(
                        label: 'Total acheté',
                        value: '${totalBought.toStringAsFixed(2)} €',
                        color: AppTheme.accentPrimary,
                        icon: Icons.shopping_cart_outlined,
                      ),
                    if (hasGift)
                      _SummaryPill(
                        label: 'Cadeaux reçus',
                        value: '$giftsCount',
                        color: AppTheme.accentSecondary,
                        icon: Icons.card_giftcard_rounded,
                      ),
                    if (hasSold)
                      _SummaryPill(
                        label: 'Total vendu',
                        value: '${totalSold.toStringAsFixed(2)} €',
                        color: AppTheme.accentAmber,
                        icon: Icons.monetization_on_outlined,
                      ),
                  ],
                ),
                const SizedBox(height: 20),
              ],

              if (transactions.isEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                    border: Border.all(color: AppTheme.borderMedium),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 48, color: AppTheme.textMuted),
                      const SizedBox(height: 12),
                      Text(
                        'Aucun historique d\'achat',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Vous pouvez consigner la date, le lieu, le prix ou indiquer un cadeau reçu.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                      ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppTheme.accentPrimary,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
                        ),
                        icon: const Icon(Icons.add_shopping_cart_rounded),
                        label: const Text('Ajouter un achat'),
                        onPressed: () => _openAddPurchaseSheet(context, ref),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: transactions.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (ctx, index) {
                    final tx = transactions[index];
                    return _TransactionCard(
                      tx: tx,
                      onDelete: () => _deleteTransaction(context, ref, tx),
                    );
                  },
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            '$label : ',
            style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _TransactionCard extends StatelessWidget {
  const _TransactionCard({
    required this.tx,
    required this.onDelete,
  });

  final BookTransaction tx;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final isBuy = tx.isBought;
    final isGift = tx.isGift;

    final badgeColor = isBuy
        ? AppTheme.accentPrimary
        : isGift
            ? AppTheme.accentSecondary
            : AppTheme.accentAmber;

    final badgeIcon = isBuy
        ? Icons.shopping_cart_rounded
        : isGift
            ? Icons.card_giftcard_rounded
            : Icons.monetization_on_rounded;

    final badgeLabel = isBuy
        ? 'Acheté'
        : isGift
            ? 'Cadeau reçu'
            : 'Vendu';

    final priceText = isGift
        ? 'Offert'
        : tx.price != null
            ? '${tx.price!.toStringAsFixed(2)} €'
            : '- €';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppTheme.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // En-tête : Badge type + Prix à droite + bouton supprimer
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border: Border.all(color: badgeColor.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(badgeIcon, size: 14, color: badgeColor),
                    const SizedBox(width: 4),
                    Text(
                      badgeLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: badgeColor,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                priceText,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: badgeColor,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                visualDensity: VisualDensity.compact,
                iconSize: 18,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                tooltip: 'Supprimer',
                icon: Icon(Icons.delete_outline_rounded, color: AppTheme.accentRed),
                onPressed: onDelete,
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Ligne 1 : Date d'achat
          Row(
            children: [
              Icon(Icons.calendar_today_rounded, size: 15, color: AppTheme.textMuted),
              const SizedBox(width: 6),
              Text(
                tx.date ?? 'Date non renseignée',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),

          // Ligne 2 : Lieu d'achat / Offert par
          if (tx.location != null && tx.location!.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(
                  isGift ? Icons.card_giftcard_rounded : Icons.storefront_rounded,
                  size: 15,
                  color: AppTheme.textMuted,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    tx.location!,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],

          // Ligne 3 : Mémo / Remarque
          if (tx.memo != null && tx.memo!.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.notes_rounded, size: 15, color: AppTheme.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '« ${tx.memo!} »',
                    style: TextStyle(
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      color: AppTheme.textMuted,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
