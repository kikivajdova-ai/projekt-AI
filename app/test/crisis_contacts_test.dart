import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:odpocivat_spolu/core/crisis_contacts.dart';
import 'package:odpocivat_spolu/widgets/crisis_help_sheet.dart';

void main() {
  test('krizové kontakty jsou napevno v aplikaci a se správnými čísly', () {
    final numbers = crisisContacts.map((c) => c.number).toList();
    expect(numbers, containsAll(['116123', '116111', '155', '112']));
    expect(crisisContacts.firstWhere((c) => c.number == '116123').name, 'Linka první psychické pomoci');
    expect(crisisContacts.firstWhere((c) => c.number == '116111').name, 'Linka bezpečí');
    expect(crisisContacts.firstWhere((c) => c.number == '116123').telUri.toString(), 'tel:116123');
    expect(crisisContacts.firstWhere((c) => c.number == '116123').displayNumber, '116 123');
  });

  testWidgets('panel pomoci ukáže všechny linky bez přihlášení a bez internetu', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CrisisHelpSheet())));
    expect(find.text('Linka první psychické pomoci'), findsOneWidget);
    expect(find.text('116 123'), findsOneWidget);
    expect(find.text('116 111'), findsOneWidget);
    expect(find.text('155'), findsOneWidget);
    expect(find.text('112'), findsOneWidget);
  });
}
