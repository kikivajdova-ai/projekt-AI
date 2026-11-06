// Design tokeny podle skillu mobile-app-ux-ui: jeden akcent, klidné neutrální barvy,
// zaoblené karty, pilulková tlačítka. Barvy se nepoužívají jako jediný nositel významu.
import 'package:flutter/material.dart';

abstract final class AppColors {
  static const bg = Color(0xFFF6F5F1);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceTint = Color(0xFFE4E8C8);
  static const ink = Color(0xFF23301A);
  static const ink2 = Color(0xFF6B7064);
  static const primary = Color(0xFF5F7424);
  static const onPrimary = Color(0xFFFFFFFF);
}

abstract final class AppRadius {
  static const card = 24.0;
  static const sheet = 28.0;
  static const pill = 999.0;
}

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, colorSchemeSeed: AppColors.primary);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    textTheme: base.textTheme.apply(bodyColor: AppColors.ink, displayColor: AppColors.ink),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        shape: const StadiumBorder(),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        foregroundColor: AppColors.ink,
        shape: const StadiumBorder(),
      ),
    ),
  );
}
