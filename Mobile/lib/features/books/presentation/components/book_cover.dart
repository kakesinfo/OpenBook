import 'dart:io';

import 'package:flutter/material.dart';

import '../../data/book.dart';

class BookCover extends StatelessWidget {
  const BookCover({
    super.key,
    required this.book,
    this.width = 56,
    this.height = 80,
    this.borderRadius = 8,
  });

  final Book book;
  final double width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final cover = book.coverUrl.trim();

    if (cover.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: SizedBox(
          width: width,
          height: height,
          child: cover.startsWith('http://') || cover.startsWith('https://')
              ? Image.network(
                  cover,
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  errorBuilder: (context, error, stackTrace) => _fallbackCover(context),
                )
              : Image.file(
                  File(cover),
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  errorBuilder: (context, error, stackTrace) => _fallbackCover(context),
                ),
        ),
      );
    }

    return _fallbackCover(context);
  }

  Widget _fallbackCover(BuildContext context) {
    final trimmedTitle = book.title.trim();
    final initials = trimmedTitle.isEmpty ? '?' : trimmedTitle.substring(0, 1).toUpperCase();

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF5B8DEF), Color(0xFF1D4ED8)],
        ),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: Center(
        child: Text(
          initials,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}