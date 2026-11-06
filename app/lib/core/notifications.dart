// Notifikace s ohledem na soukromí:
//  - Text posílá server už obecný („Máš nové povzbuzení.“), bez jmen a obsahu.
//  - Na Androidu je kanál i každá notifikace PRIVATE: na zamčené obrazovce se ukáže
//    jen název aplikace, obsah až po odemčení.
//  - Noční klid hlídá server (výchozí 22:00–8:00, zapnutý). Tady nic neodkládáme,
//    aby se pravidlo nedalo obejít úpravou aplikace.
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

const _channel = AndroidNotificationChannel(
  'odpocivat_spolu_obecne',
  'Odpočívat spolu',
  description: 'Povzbuzení a pozvánky od kamarádů',
  importance: Importance.defaultImportance,
);

final _local = FlutterLocalNotificationsPlugin();
bool _listenersAttached = false;

/// Volat po přihlášení. O oprávnění žádáme až tady (v kontextu), ne při startu aplikace.
Future<void> setupNotifications(ApiClient api, {void Function(String type, String refId)? onOpen}) async {
  final messaging = FirebaseMessaging.instance;
  final permission = await messaging.requestPermission(alert: true, badge: true, sound: true);
  if (permission.authorizationStatus == AuthorizationStatus.denied) return;

  await _local
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(_channel);
  await _local.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ),
    onDidReceiveNotificationResponse: (r) {
      final parts = (r.payload ?? '').split('|');
      if (parts.length == 2) onOpen?.call(parts[0], parts[1]);
    },
  );

  final token = await messaging.getToken();
  if (token != null) await api.registerPushToken(token, Platform.isIOS ? 'IOS' : 'ANDROID');

  // Klepnutí na notifikaci, která aplikaci spustila „ze studena“
  final initial = await messaging.getInitialMessage();
  final initialType = initial?.data['type'] as String?;
  final initialRef = initial?.data['refId'] as String?;
  if (initialType != null && initialRef != null) onOpen?.call(initialType, initialRef);

  // Posluchače připojíme jen jednou, i když se setupNotifications zavolá po každém přihlášení.
  if (_listenersAttached) return;
  _listenersAttached = true;
  messaging.onTokenRefresh.listen((t) => api.registerPushToken(t, Platform.isIOS ? 'IOS' : 'ANDROID'));

  // Aplikace je otevřená: zobrazíme sami, se stejnými pravidly soukromí.
  FirebaseMessaging.onMessage.listen((m) {
    final n = m.notification;
    if (n == null) return;
    _local.show(
      m.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          visibility: NotificationVisibility.private,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: '${m.data['type']}|${m.data['refId']}',
    );
  });

  FirebaseMessaging.onMessageOpenedApp.listen((m) {
    final type = m.data['type'] as String?;
    final refId = m.data['refId'] as String?;
    if (type != null && refId != null) onOpen?.call(type, refId);
  });
}

/// Volat při odhlášení: token se odregistruje na serveru i v zařízení,
/// aby notifikace nechodily dalšímu člověku na sdíleném telefonu.
Future<void> teardownNotifications(ApiClient api) async {
  final token = await FirebaseMessaging.instance.getToken();
  if (token != null) {
    try {
      await api.removePushToken(token);
    } catch (_) {
      // odhlášení nesmí selhat kvůli síti; token se smaže i v zařízení
    }
  }
  await FirebaseMessaging.instance.deleteToken();
}
