import 'package:flutter/material.dart';
import 'package:flutter_application_1/app/theme.dart';

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  const AppHeader({
    super.key,
    this.title = 'Yet Another Library',
    this.subtitle,
    this.showLogo = true,
    this.leading,
    this.actions,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final bool showLogo;
  final Widget? leading;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;

  @override
  Size get preferredSize => Size.fromHeight(
        (bottom?.preferredSize.height ?? 0.0) + (subtitle != null ? 68.0 : 58.0),
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        border: Border(
          bottom: BorderSide(color: AppTheme.borderSubtle, width: 1),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  if (leading != null) ...[
                    leading!,
                    const SizedBox(width: 8),
                  ] else if (showLogo) ...[
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: AppTheme.logoGradient,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        border: Border.all(
                          color: AppTheme.accentPrimary.withValues(alpha: 0.3),
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: Icon(
                          Icons.menu_book_rounded,
                          size: 18,
                          color: AppTheme.accentPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.02,
                            color: AppTheme.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.textMuted,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  ...?actions,
                ],
              ),
            ),
            ?bottom,
          ],
        ),
      ),
    );
  }
}
