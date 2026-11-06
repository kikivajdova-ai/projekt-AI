// Tlačítko „Potřebuješ pomoc hned?“ a spodní panel s linkami pomoci.
// Je dostupné vždy (dej ho do horní lišty každé hlavní obrazovky), nejen při špatné náladě.
// Žádné herní prvky, žádné body, klidný tón.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/crisis_contacts.dart';
import '../core/theme.dart';

class CrisisHelpButton extends StatelessWidget {
  const CrisisHelpButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Potřebuješ pomoc hned?',
      icon: const Icon(Icons.support_outlined),
      onPressed: () => showCrisisHelpSheet(context),
    );
  }
}

Future<void> showCrisisHelpSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.sheet)),
    ),
    builder: (_) => const CrisisHelpSheet(),
  );
}

class CrisisHelpSheet extends StatelessWidget {
  const CrisisHelpSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Pomoc je na dosah', style: text.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Nemusíš na to být sám ani sama. Tyhle linky jsou tu pro tebe, '
              'zdarma a kdykoli. Aplikace ani kamarádi odbornou pomoc nenahradí.',
              style: text.bodyMedium?.copyWith(color: AppColors.ink2),
            ),
            const SizedBox(height: 16),
            for (final c in crisisContacts) _ContactTile(contact: c),
          ],
        ),
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({required this.contact});

  final CrisisContact contact;

  Future<void> _call(BuildContext context) async {
    final ok = await launchUrl(contact.telUri);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Zavolej prosím na ${contact.displayNumber}.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Card(
      elevation: 0,
      color: contact.emergency ? AppColors.surfaceTint : AppColors.surface,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
      child: Semantics(
        button: true,
        label: 'Zavolat ${contact.name}, ${contact.displayNumber}',
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.card),
          onTap: () => _call(context),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(contact.name, style: text.titleMedium),
                      const SizedBox(height: 4),
                      Text(contact.description,
                          style: text.bodySmall?.copyWith(color: AppColors.ink2)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                  onPressed: () => _call(context),
                  icon: const Icon(Icons.call),
                  label: Text(contact.displayNumber),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
