# Kdo co vidí

Tahle tabulka popisuje, co skutečně vynucuje databáze (pravidla RLS a práva k tabulkám).
Neplatí jen v aplikaci, platí i pro někoho, kdo by se pokusil volat server přímo.

| Údaj | Já | Přátelé | Skupina (Chill crew) | Cizí člověk | Server (app_system) |
|---|---|---|---|---|---|
| Přezdívka | ✓ | ✓ | ✓ (spolučlenové) | ✗ | ✓ (náhled pozvánky) |
| Nastavení (vypnutá hra, noční klid…) | ✓ | ✗ | ✗ | ✗ | ✓ (noční klid) |
| **Nálada a stres** | ✓ (jen se souhlasem) | ✗ | ✗ | ✗ | **✗** |
| Chvíle „Jen já“ | ✓ | ✗ | ✗ | ✗ | ✓ (výpočet odznaků) |
| Chvíle „Přátelé“, splněná | ✓ | ✓ | ✗ | ✗ | ✓ |
| Chvíle „Přátelé“, naplánovaná | ✓ | **✗** | ✗ | ✗ | ✓ |
| Chvíle „Chill crew“, splněná | ✓ | ✗ | ✓ | ✗ | ✓ |
| Příspěvek ke skupinovému cíli | ✓ (svůj) | ✗ | jen **součet** | ✗ | ✓ (počítá součet) |
| Odznaky | ✓ | jen když je sdílím | ✗ | ✗ | ✓ |
| Body a úroveň | ✓ (počítá se, neukládá) | ✗ | ✗ | ✗ | – |
| Seznam přátel | ✓ | ✗ | ✗ | ✗ | ✓ |
| Že někoho blokuji | ✓ | ✗ (ani blokovaný) | ✗ | ✗ | – |
| Moje nahlášení | ✗ (jen odeslat) | ✗ | ✗ | ✗ | ✓ → podpora |
| Povzbuzení | odeslaná i přijatá | ✗ | ✗ | ✗ | ✓ |
| Pozvánka k odpočinku | odeslané i přijaté | ✗ | ✗ | ✗ | ✓ |

## Výchozí stavy

- Nová chvíle: **Jen já**. Databáze jiný stav při vložení ani nepřijme.
- Sdílení: až po náhledu („Takhle to uvidí ostatní“). Bez tokenu z náhledu ho server odmítne.
- Sdílení odznaků přátelům: **vypnuté**.
- Noční klid notifikací: **zapnutý**, 22:00–8:00.
- Text notifikací: vždy obecný („Máš nové povzbuzení.“), bez jmen a obsahu.

## Co se nikdy nezobrazí

- Co kdo **neudělal**: stav „nesplněno“ v databázi vůbec neexistuje.
- Pořadí, žebříčky a čísla po lidech ve skupině.
- „Přišel/a jsi o sérii“: databáze nemá žádné počítadlo série ani žádný trigger.
