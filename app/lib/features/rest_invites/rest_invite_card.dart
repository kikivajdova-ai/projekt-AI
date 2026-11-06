// Karta pozvánky k odpočinku: „Tom jde na procházku, přidáš se?“
// Odmítnutí je JEDNO klepnutí na „Teď ne“: žádný dialog, žádné pole pro důvod,
// žádné „opravdu?“. Odesílatel uvidí jen neutrální „Tentokrát to nevyjde“.
import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

class RestInviteCard extends StatefulWidget {
  const RestInviteCard({
    super.key,
    required this.api,
    required this.invitationId,
    required this.fromName,
    required this.activityLabel,
    this.onAnswered,
  });

  final ApiClient api;
  final String invitationId;
  final String fromName;

  /// Např. „Procházka“
  final String activityLabel;
  final VoidCallback? onAnswered;

  @override
  State<RestInviteCard> createState() => _RestInviteCardState();
}

enum _State { open, sending, joined, declined }

class _RestInviteCardState extends State<RestInviteCard> {
  _State _state = _State.open;

  Future<void> _answer({required bool join}) async {
    setState(() => _state = _State.sending);
    try {
      await widget.api.answerRestInvite(widget.invitationId, join: join);
      if (!mounted) return;
      setState(() => _state = join ? _State.joined : _State.declined);
      widget.onAnswered?.call();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _state = _State.open);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Card(
      elevation: 0,
      color: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${widget.fromName} tě zve', style: text.labelMedium?.copyWith(color: AppColors.ink2)),
            const SizedBox(height: 4),
            Text('${widget.activityLabel}: přidáš se?', style: text.titleMedium),
            const SizedBox(height: 16),
            switch (_state) {
              _State.joined => const _Result('Super, užijte si to spolu.'),
              // Uklidnění: odmítnout je normální a nic se vysvětlovat nemusí.
              _State.declined => const _Result('V pohodě. Nic vysvětlovat nemusíš.'),
              _ => Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _state == _State.sending ? null : () => _answer(join: false),
                        child: const Text('Teď ne'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _state == _State.sending ? null : () => _answer(join: true),
                        child: const Text('Přidám se'),
                      ),
                    ),
                  ],
                ),
            },
          ],
        ),
      ),
    );
  }
}

class _Result extends StatelessWidget {
  const _Result(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Text(message, style: Theme.of(context).textTheme.bodyMedium),
      );
}
