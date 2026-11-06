// Vědomé sdílení s náhledem. Nová chvíle je vždy „Jen já“; sdílet jde až tady,
// po zobrazení přesně té karty, kterou uvidí ostatní. Server bez tokenu z náhledu
// viditelnost nezmění.
import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Vrátí true, pokud uživatel sdílel.
Future<bool> showSharePreviewSheet(
  BuildContext context, {
  required ApiClient api,
  required String activityId,
  required String visibility, // 'PRATELE' nebo 'CHILL_CREW'
  String? crewId,
}) async {
  final shared = await showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.sheet)),
    ),
    builder: (_) => _SharePreviewSheet(api: api, activityId: activityId, visibility: visibility, crewId: crewId),
  );
  return shared ?? false;
}

class _SharePreviewSheet extends StatefulWidget {
  const _SharePreviewSheet({required this.api, required this.activityId, required this.visibility, this.crewId});

  final ApiClient api;
  final String activityId;
  final String visibility;
  final String? crewId;

  @override
  State<_SharePreviewSheet> createState() => _SharePreviewSheetState();
}

class _SharePreviewSheetState extends State<_SharePreviewSheet> {
  late final Future<Map<String, dynamic>> _preview =
      widget.api.sharePreview(widget.activityId, widget.visibility, crewId: widget.crewId);
  bool _sending = false;

  Future<void> _share(String token) async {
    setState(() => _sending = true);
    try {
      await widget.api.share(widget.activityId, widget.visibility, token, crewId: widget.crewId);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: FutureBuilder<Map<String, dynamic>>(
          future: _preview,
          builder: (context, snap) {
            if (snap.hasError) {
              return Text('Náhled se nepodařilo načíst. Nic se nesdílelo.', style: text.bodyMedium);
            }
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final data = snap.data!;
            final card = data['nahled'] as Map<String, dynamic>?;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Takhle to uvidí ostatní', style: text.titleLarge),
                const SizedBox(height: 4),
                Text(data['publikum'] as String, style: text.bodyMedium?.copyWith(color: AppColors.ink2)),
                const SizedBox(height: 16),
                if (card != null)
                  Card(
                    elevation: 0,
                    color: AppColors.surfaceTint,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
                    child: ListTile(
                      title: Text('${card['authorName']} · ${card['label']}'),
                      subtitle: Text('${card['day']}'),
                      // Viditelnost vždy i textem, ne jen barvou
                      trailing: Chip(label: Text(widget.visibility == 'PRATELE' ? 'Přátelé' : 'Skupina')),
                    ),
                  ),
                if (data['poznamka'] != null) ...[
                  const SizedBox(height: 8),
                  Text(data['poznamka'] as String, style: text.bodySmall),
                ],
                const SizedBox(height: 8),
                Text('Nálada ani poznámky se nikdy nesdílí.', style: text.bodySmall?.copyWith(color: AppColors.ink2)),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _sending ? null : () => _share(data['previewToken'] as String),
                  child: const Text('Sdílet'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _sending ? null : () => Navigator.of(context).pop(false),
                  child: const Text('Nechat jen pro mě'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
