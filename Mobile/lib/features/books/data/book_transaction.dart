class BookTransaction {
  const BookTransaction({
    this.id,
    required this.bookId,
    this.userId,
    required this.type,
    this.date,
    this.price,
    this.location,
    this.memo,
    this.createdAt,
  });

  final int? id;
  final int bookId;
  final int? userId;
  final String type; // 'BOUGHT', 'GIFT', 'SOLD'
  final String? date; // YYYY-MM-DD
  final double? price;
  final String? location;
  final String? memo;
  final int? createdAt;

  bool get isBought => type.toUpperCase() == 'BOUGHT';
  bool get isGift => type.toUpperCase() == 'GIFT';
  bool get isSold => type.toUpperCase() == 'SOLD';

  factory BookTransaction.fromJson(Map<String, dynamic> json) {
    return BookTransaction(
      id: (json['id'] as num?)?.toInt(),
      bookId: (json['bookId'] as num?)?.toInt() ?? 0,
      userId: (json['userId'] as num?)?.toInt(),
      type: (json['type'] as String?)?.toUpperCase() ?? 'BOUGHT',
      date: json['date'] as String?,
      price: (json['price'] as num?)?.toDouble(),
      location: json['location'] as String?,
      memo: json['memo'] as String?,
      createdAt: (json['createdAt'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'date': date,
      'price': price,
      'location': location,
      'memo': memo,
    };
  }
}
