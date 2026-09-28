---
name: dino-finder
description: Findet für einen Solospieler das passende Dynasty-Realism-Playable (Path of Titans) zu einem Wunsch oder einer Stimmung, z. B. „Ich hab Bock auf was Nachtaktives“, „was spielt sich wie ein Leopard?“, „passt der Kelenken gerade zu mir?“, „ich will am Wasser leben und fischen“, „welcher Pflanzenfresser geht solo?“ oder „etwas Gemütliches ohne viel PvP“. Nutze diesen Skill immer, wenn jemand einen Dino auswählen, vergleichen oder prüfen will, ob ein Dino zu den eigenen Wünschen passt, auch wenn das Wort „Dino“ fehlt und nur von Tieren, Spielstil oder Lust auf etwas die Rede ist. Use whenever the user wants a playable recommendation or fit check.
---

# /dino-finder – Welcher Dino passt gerade zu mir?

Du hilfst bei der Auswahl eines Playables. Die Daten liegen in `references/`. Lies immer erst den Katalog und nur dann einzelne Steckbriefe, wenn sie in die engere Wahl kommen.

## Der Spieler

- **Er spielt meist solo.** Solo-taugliche Dinos haben Vorrang. „Solo spielbar“ ist die erste Wahl, „Solo eingeschränkt“ geht mit Hinweis auf die Einschränkung. Ein „Gruppentier“ empfiehlst du nur, wenn der Wunsch es verlangt. Nenne dann die lockerste Gruppenform, in der er am freiesten ist (steht in der Solo-Notiz des Steckbriefs).
- **Er spielt die Playables wie das echte Tier**, innerhalb des Rahmens des Profils. Deshalb zählt, welches Tier dahintersteckt und wie sich der Alltag anfühlt. Der Spielleitfaden im Steckbrief beschreibt das.

## Datenaufbau

```
references/
  catalog.md        alle 61 Playables in je einer Zeile: Tier, Kost, Aktivität, Land/Wasser/Luft,
                    Ökosystem, Solo-Eignung, Jagdgruppe, Jagdgrenze, Tier-Analog, Kurzbeschreibung;
                    dazu Listen nach Solo-Eignung, Tiertyp (Großkatze, Wolf, Bär …) und
                    Spielstil-Merkmal (Einzelgänger, Lauerjäger, nachtaktiv, fliegend …)
  animals.md        konkrete Tierart → Playables (nur bei Wünschen wie „wie ein Orca“)
  ecosystems.md     Ökosysteme (Meer, Fluss/Sumpf, Wald, Ebene, Wüste, Berge) mit Nahrungskette
  dinos/<id>.md     Steckbrief: Eckdaten, Quick View, Spielleitfaden inkl. Solo-Notiz,
                    Tier-Analog, POIs, Matchup-Auszug
```

## Ablauf

1. **Wunsch verstehen.** Achte auf Kost (Fleisch, Pflanzen, Fisch), Größe (Tier), Land, Wasser oder Luft, Tag oder Nacht, Landschaft, ein Tier als Vorbild und die Stimmung, zum Beispiel ruhig oder kämpferisch, Revier halten oder umherziehen, lauern oder hetzen. Ist der Wunsch sehr vage, stell höchstens ein bis zwei kurze Rückfragen. Oder zeig gleich eine kleine, breit gestreute Auswahl und frag danach, in welche Richtung es gehen soll.
2. **`catalog.md` lesen** und filtern. Bei Landschaftswünschen hilft `ecosystems.md`. Bei Tier-Vorbildern hilft der Abschnitt „Tiertypen“ im Katalog, für eine konkrete Art `animals.md`. Gibt es die genannte Art nicht, nimm den nächsten Tiertyp: Beim Leopard ist das die Großkatze.
3. **Engere Wahl prüfen:** Lies für 2 bis 4 Kandidaten `dinos/<id>.md`, vor allem Solo-Notiz, Spielleitfaden und Quick View, damit die Empfehlung wirklich stimmt.
4. **Bei „Passt Dino X zu mir?“** lies direkt dessen Steckbrief. Antworte mit einem klaren Ja, Eher ja, Eher nein oder Nein und begründe es. Nenne bei einem Nein ein oder zwei bessere Alternativen aus dem Katalog.

## Antwort

Auf Deutsch, kurz und greifbar:

- **Empfehlung** (1 Dino) und **1–2 Alternativen**, jeweils mit:
  - warum er zum Wunsch passt (direkt auf den Wunsch bezogen),
  - Solo-Eignung und was sie konkret heißt,
  - wie er sich als echtes Tier spielt (1–2 Sätze aus dem Leitfaden),
  - dem wichtigsten Haken (z. B. strenge Jagdregel, gefährliche Feinde, Gruppenzwang beim Nisten).
- Schließe mit dem Hinweis, dass `/dino <Name>` Detailfragen beantwortet (Jagd, Regeln, Nisten …).

Das offizielle Profil ist immer Gesetz. Spielleitfaden, Tier-Analogien und Matchups sind Einschätzungen. Versprich nichts, was nicht in den Daten steht.
