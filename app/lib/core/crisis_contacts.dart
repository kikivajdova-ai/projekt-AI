// Kontakty pomoci jsou NAPEVNO v aplikaci, nezávisle na databázi a internetu.
// Fungují i bez přihlášení, bez signálu k našemu serveru a při výpadku backendu.
// Změnu čísel dělej jen po ověření na oficiálních stránkách linek.

class CrisisContact {
  const CrisisContact({
    required this.name,
    required this.number,
    required this.description,
    this.emergency = false,
  });

  final String name;

  /// Číslo bez mezer, použije se pro `tel:` odkaz.
  final String number;
  final String description;

  /// Tísňová linka při ohrožení života.
  final bool emergency;

  Uri get telUri => Uri(scheme: 'tel', path: number);

  /// Čitelný zápis „116 123“.
  String get displayNumber => number.length == 6
      ? '${number.substring(0, 3)} ${number.substring(3)}'
      : number;
}

const List<CrisisContact> crisisContacts = [
  CrisisContact(
    name: 'Linka první psychické pomoci',
    number: '116123',
    description: 'Když je ti psychicky těžko. Nonstop, zdarma.',
  ),
  CrisisContact(
    name: 'Linka bezpečí',
    number: '116111',
    description: 'Pro děti a studenty do 26 let. Nonstop, zdarma.',
  ),
  CrisisContact(
    name: 'Záchranná služba',
    number: '155',
    description: 'Při ohrožení života nebo zdraví.',
    emergency: true,
  ),
  CrisisContact(
    name: 'Tísňová linka',
    number: '112',
    description: 'Jednotné evropské číslo tísňového volání.',
    emergency: true,
  ),
];
