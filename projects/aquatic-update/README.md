# Aquatic Update

Eigene Suggestion an den Dynasty-Realism-Server (Path of Titans), die das Aquatic Life auf dem Server wieder beleben soll.

**Status:** angelegt am 2026-11-03, noch kein Inhalt. Nichts eingereicht.

## Dateien

```text
projects/aquatic-update/
  README.md       Diese Übersicht: Ziel, Ist-Zustand, offene Fragen
  suggestion.md   Entwurf der Suggestion, wie sie eingereicht wird (Englisch)
  werte.md        Werte-Vergleich: 4 Aquatics + Mods Prognathodon, Xiphactinus, Livyatan
  prognathodon-kurven.txt  Offizielle Standard-Kurven des Prognathodon von den Modmachern
  oekosystem.md   Bewertung: Rollen, Widersprüche, Stat- und Regel-Vorschläge
  tropeognathus.md  Entwurf: Tropeognathus und die Flotilla (kein Wassertier, deshalb nicht im App-Tab)
  profile-entwuerfe/  Profil-Entwürfe auf Englisch: kaiwhekea, eurhinosaurus, leedsichthys, xiphactinus, livyatan, prognathodon, tylosaurus, deinosuchus, spinosaurus
    index.json        Kartenwerte für den App-Tab „Aquatic Update“ (#/aquatic): Rolle, Werte, Änderungen
    lebensraum.json   Wer wo lebt: Zonen, halbe Prog-Reviere, Leeds-Route; Karte im App-Tab
    beziehungen.json  Wer jagt wen, flieht oder wehrt sich (Matrix im App-Tab, mit Sarcosuchus zum Vergleich)
```

Die Suggestion wird auf Englisch eingereicht; diese Übersicht bleibt Deutsch.

## Betroffene Playables

Aus `data/processed/index.json` (Klassifizierung laut Profil):

| Gruppe | Playables |
| --- | --- |
| Aquatic | Tylosaurus (Apex, CW 5000), Leedsichthys (Apex, CW 5500), Kaiwhekea (Medium, CW 4000), Eurhinosaurus (Medium, CW 3000) |
| Semi-Aquatic, Meer/Küste | Deinosuchus Ocean, Spinosaurus Saltwater, Lurdusaurus Coast, Austroraptor |
| Semi-Aquatic, Süßwasser/Ufer | Deinosuchus Shore, Spinosaurus Freshwater, Lurdusaurus Freshwater, Sarcosuchus, Suchomimus, Concavenator, Deinocheirus, Halszkaraptor, Megalania (beide) |
| Fischt aus der Luft | Tropeognathus |

## Regeln im Ist-Zustand

Aus `data/raw/server-rules/profile.txt`, sinngemäß:

- **3.6 / 3.6.1** Terrestrische Arten höchstens 15 s tiefer als knöcheltief im Wasser während eines Kampfs, außer sie werden von einem Semi-Aquatic aus dem Wasser angegriffen.
- **3.7** Semi-Aquatics dürfen Wasser frei nutzen und dorthin fliehen; stirbt man dort an Kampfwunden, gilt das als Body Denial.
- **3.8 / 3.8.1** Terrestrische und fliegende Arten greifen nichts an, solange einer von beiden schwimmt (Ausnahmen: von einem Semi-Aquatic angegriffen, oder AoE trifft einen Semi-Aquatic).
- **3.17** Third Party dürfen nur Deinosuchus, Concavenator, Hatzegopteryx, Quetzalcoatlus, Sarcosuchus, Spinosaurus und Tylosaurus.
- **3.18** Aquatics und Semi-Aquatics dürfen andere Aquatics und Semi-Aquatics nicht third-partyen.
- **4.8.4.1** Beute darf während einer Jagd nicht in Heilwasser laufen, auch Semi-Aquatics nicht.

## Offene Fragen

- Was ist heute das Problem? (zu wenige Spieler im Wasser, zu wenig Beute, Regeln, Balancing, Map …)
- Woran sieht man es auf dem Server? (Beobachtungen, Spielerzahlen, Zitate aus Discord)
- Welche Änderungen sollen vorgeschlagen werden?
- Format der Einreichung: Discord-Post oder Formular? Gibt es eine Längengrenze?

## Nächste Schritte

1. Problem und Beobachtungen sammeln (Abschnitt „Problem“ in `suggestion.md`).
2. Vorschläge formulieren und je Vorschlag die betroffenen Playables und Regeln nennen.
3. Gegenargumente und Balancing prüfen, Entwurf kürzen, einreichen.
