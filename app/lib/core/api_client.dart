// Tenký klient našeho API (Edge Function `api`). Aplikace NEsahá na databázi přímo:
// tabulky nejsou pro telefon dostupné, všechno jde přes API, které hlídá pravidla.
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client}) : _http = client ?? http.Client();

  /// Např. https://<projekt>.supabase.co/functions/v1/api
  final String baseUrl;
  final http.Client _http;
  static const _uuid = Uuid();

  /// Id nových záznamů vzniká v telefonu: opakované odeslání při slabém signálu
  /// se na serveru nezapočítá dvakrát.
  static String newId() => _uuid.v4();

  Future<Map<String, String>> _headers() async {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    if (token == null) throw ApiException(401, 'Přihlas se prosím.');
    return {'authorization': 'Bearer $token', 'content-type': 'application/json'};
  }

  Future<dynamic> _send(String method, String path, [Map<String, dynamic>? body]) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'))..headers.addAll(await _headers());
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _http.send(req));
    if (res.statusCode == 204) return null;
    final decoded = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      final msg = (decoded is Map ? decoded['error']?['message'] : null) as String?;
      throw ApiException(res.statusCode, msg ?? 'Něco se pokazilo. Zkus to prosím za chvíli.');
    }
    return decoded;
  }

  // --- pozvánky k odpočinku: odpověď je jen stav ---
  Future<void> answerRestInvite(String invitationId, {required bool join}) =>
      _send('POST', '/rest-invitations/$invitationId/answer', {'odpoved': join ? 'PRIDAM_SE' : 'TED_NE'});

  // --- sdílení s náhledem ---
  Future<Map<String, dynamic>> sharePreview(String activityId, String visibility, {String? crewId}) async =>
      (await _send('POST', '/activities/$activityId/share-preview', {
        'visibility': visibility,
        if (crewId != null) 'crewId': crewId,
      })) as Map<String, dynamic>;

  Future<void> share(String activityId, String visibility, String previewToken, {String? crewId}) =>
      _send('POST', '/activities/$activityId/share', {
        'visibility': visibility,
        'previewToken': previewToken,
        if (crewId != null) 'crewId': crewId,
      });

  // --- povzbuzení jedním klepnutím ---
  Future<void> sendPing(String recipientId, String kind) =>
      _send('POST', '/pings', {'id': newId(), 'recipientId': recipientId, 'kind': kind});

  Future<void> registerPushToken(String token, String platform) =>
      _send('POST', '/push-tokens', {'token': token, 'platform': platform});

  Future<void> removePushToken(String token) => _send('DELETE', '/push-tokens', {'token': token});
}
