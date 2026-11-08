import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';

import '../../data/book.dart';

class BookCover extends StatelessWidget {
  const BookCover({
    super.key,
    required this.book,
    this.width = 56,
    this.height = 80,
    this.borderRadius = AppTheme.radiusMd,
  });

  final Book book;
  final double width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final cover = book.coverUrl.trim();

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppTheme.borderSubtle, width: 1),
        boxShadow: AppTheme.cardShadow,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: cover.isNotEmpty
            ? (cover.startsWith('http://') || cover.startsWith('https://')
                ? Image.network(
                    cover,
                    fit: BoxFit.cover,
                    width: width,
                    height: height,
                    gaplessPlayback: true,
                    errorBuilder: (context, error, stackTrace) => _fallbackCover(context),
                  )
                : Image.file(
                    File(cover),
                    fit: BoxFit.cover,
                    width: width,
                    height: height,
                    gaplessPlayback: true,
                    errorBuilder: (context, error, stackTrace) => _fallbackCover(context),
                  ))
            : _fallbackCover(context),
      ),
    );
  }

  Widget _fallbackCover(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: AppTheme.coverFallbackGradient,
      ),
      padding: const EdgeInsets.all(8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            Icons.menu_book_rounded,
            size: 26,
            color: AppTheme.accentPrimary,
          ),
          const SizedBox(height: 6),
          Text(
            book.title.isEmpty ? '?' : book.title,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppTheme.textSecondary,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
