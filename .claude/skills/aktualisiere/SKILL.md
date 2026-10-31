---
name: aktualisiere
description: Aktualisiert einen eigenen Dino unter „My Dinos“ (DynastyBot) aus importierten Screenshots. Liest Bloodlines, dominante und rezessive Skins, Mutationen, Geschlecht und Playable aus den rohen Screenshots und trägt sie sauber in data/herd/<dino>/dino.json ein. Nutze diesen Skill, wenn der Nutzer „/aktualisiere“, „aktualisiere Malekit“, „lies meine Dino-Screenshots ein“, „trag die neuen Skins ein“ oder „setz den Mutation-Proof-Link“ sagt, oder allgemein seine eigenen Dinos, deren Bloodlines, Skins, Mutationen, Bindungen (Bonds), Charakter, Stammbaum (Partnerinnen, Kälber, Chronik der ID-Akte) oder Proof-Links pflegen will, z. B. „Torfin bondet jetzt mit Kamoda“, „Mistral hat zwei Kälber mit Arachu“ oder „ich habe einen neuen Tylo“.
---

# /aktualisiere – eigenen Dino aus Screenshots aktualisieren

Der Spieler importiert Screenshots seiner Dinos im Reiter **My Dinos** der DynastyBot-App. Sie liegen roh unter `data/herd/<id>/screenshots/` und werden **nie verändert**. Du liest sie und pflegst nur `dino.json`, und zwar ausschließlich über das Skript `server/scripts/herd.mjs` (es prüft alles und schreibt atomar). Alle Befehle laufen im Repo-Root.

## Ablauf

1. **Dino wählen.** Wurde ein Name mitgegeben (`/aktualisiere Malekit`), nimm ihn und spring zu Schritt 2. Sonst:
   ```bash
   node server/scripts/herd.mjs list
   ```
   Frag dann mit dem **AskUserQuestion**-Tool als Dropdown: „Welchen Dino aktualisierst du?“. Optionen sind die Dinos (Label = Name, Beschreibung = Playable und „N Screenshots neu“ bzw. „nichts Neues“). Dinos mit neuen Screenshots kommen zuerst, höchstens 4 Optionen; weitere erreicht der Nutzer über „Other“. Gibt es keinen Dino, sag, dass er erst im Reiter *My Dinos* Screenshots importieren soll (App: `npm run dev`, dann `#/herd`).

2. **Stand laden.**
   ```bash
   node server/scripts/herd.mjs show "<Name>"
   ```
   Das liefert den aktuellen Datensatz, für jeden Screenshot den absoluten `path` und `pending` sowie `playables` (id → Name aller Playables).

3. **Screenshots lesen.** Öffne jeden Screenshot mit `pending: true` mit dem **Read**-Tool (es zeigt Bilder an). Bei Bedarf auch ältere zum Abgleich. Schreib für jeden gelesenen Screenshot den sichtbaren, relevanten Text wortgetreu ab (Transkript).

4. **Werte bestimmen.**
   - **bloodlines**: Namen der Bloodlines/Blutlinien, so geschrieben wie im Bild.
   - **skins.dominant** / **skins.recessive**: Skin-Gene getrennt nach dominant und rezessiv. Steht nicht eindeutig dabei, was dominant ist, nicht raten: in `extra` als „Skins (unklar)“ ablegen und den Nutzer fragen.
   - **mutations**: Mutationen mit Namen; Wirkung oder Herkunft kurz in `note` (z. B. „vom Skin“, „aus Nest“).
   - **sex**: `female` / `male`, nur wenn sichtbar.
   - **diedAt**: Todestag `JJJJ-MM-TT`, wenn der Nutzer sagt, dass der Dino tot ist („Malekith ist tot“; ohne Datum heute). Der Dino behält alle Daten, verschwindet aus der Übersicht *My Dinos* und liegt dann auf dem **Friedhof** (`#/friedhof`); `/nesting` schlägt ihn nicht mehr als Elternteil vor. `""` macht ihn wieder lebendig. Nie den Ordner löschen.
   - **playableId**: nur setzen, wenn noch leer oder eindeutig anders; die id aus `playables` nehmen (Varianten wie `deinosuchus-shore` beachten, sonst nachfragen).
   - **extra**: weitere sichtbare, für den Dino wichtige Angaben als `{ "label", "value" }` (z. B. Generation, Wachstum, Eltern). Kein Rauschen wie UI-Buttons.
   - **bonds** (Bindungen): Beziehungen zu anderen Dinos, vor allem bei sozialen Playables wie Parasaurolophus (Paarbindung, Harem, Lebenspartner, Familie). Je Eintrag `{ "name", "sex", "kind", "status", "bloodline", "note" }`: `sex` ist `female`/`male`/`null`, `kind` z. B. „Bindung“, „Lebenspartner“, „Harem“, „Familie“, „Freund“, `status` z. B. „bondet gerade“, „fest“, „beendet“, `bloodline` die Bloodline der Partnerin oder des Partners (in der Tylo-Akte umrahmt sie die Mutter und ihre Kälber, die ihren Namen tragen), `note` kurz (Skin, Herkunft). Meist nennt der Nutzer sie im Chat. `bonds` wird als Ganzes ersetzt, schick also immer die vollständige Liste mit den bisherigen Einträgen aus `show`.
   - **character**: `{ "traits": ["ruhig", …], "text": "…" }`, also Charakterzüge als kurze Stichworte und ein freier Text zur Persönlichkeit. Nur eintragen, was der Nutzer sagt. Wird ebenfalls als Ganzes ersetzt.
   - **family** (die ID-Akte, die eigene Tylosaurus als Photo-ID-Katalog mit Stammbaum zeigen, z. B. Mistral): `{ "catalogId", "subspecies", "origin", "mother", "father", "offspring": [...], "log": [...] }`.
     - `catalogId` ist die Katalog-Nr. Tylos werden fortlaufend `TY-01`, `TY-02` … nummeriert, ein neuer Tylo bekommt die nächste freie Nummer.
     - `subspecies` gilt laut Profil nach Geschlecht: Bullen proriger, kansasensis oder rex, Kühe nepaeolicus.
     - `origin` ist frei, z. B. „Wild Spawn“ oder „genistet von …“; `mother`/`father` sind die Namen der Eltern.
     - **Partnerinnen sind Einträge in `bonds`** mit `kind` „Partnerin“ (bzw. „Partner“); die Reihenfolge ergibt „1. Partnerin“, „2. Partnerin“. Eine beendete Bindung bekommt `status` „beendet“ und bleibt mit ihren Kälbern im Stammbaum.
     - **Kälber** stehen in `offspring` als `{ "name", "sex", "mother", "clutch", "born", "status", "note" }`. `mother` muss genau wie der Name der Partnerin in `bonds` geschrieben sein, sonst landet das Kalb unter „Mutter offen“. `clutch` ist die Gelege-Nr. als ganze Zahl ab 1, fortlaufend über alle Partnerinnen des Dinos gezählt (bei Mistral: Crinkle mit Arachu = 1, Cove mit Pike = 2). Kälber aus demselben Nest bekommen dieselbe Nummer. Ein Nest, aus dem keiner ein Ei genommen hat und das abgelaufen ist, zählt als eigenes Gelege ohne Kalb (nur ein Chronik-Eintrag, das nächste Gelege bekommt die folgende Nummer). Ist die Nummer unbekannt, `null`. `born` ist `JJJJ-MM-TT` oder leer. `status` ist z. B. „lebend“, „verstorben“ (wird im Stammbaum durchgestrichen) oder „eigene Matrilinie“.
     - **Chronik** in `log` als `{ "date": "JJJJ-MM-TT", "text", "place" }` (Sichtungsprotokoll, z. B. Gelege, Schlupf, Tod, neue Partnerin; `place` optional ein POI).
     - `family` wird als Ganzes ersetzt: Schick immer die vollständigen Listen aus `show` mit. Ein neues Kalb bekommt meist auch einen Chronik-Eintrag.
   - **proofs**: Links nur setzen, wenn der Nutzer sie im Chat nennt oder sie lesbar im Screenshot stehen (`mutation` = Discord-Link als Mutationsbeweis, `nesting` = Nest-Beweis). Nur vollständige `https://`-Links.

   Screenshots zeigen den **aktuellen Stand**. Übernimm eine Liste komplett aus dem Screenshot, wenn er diesen Bereich zeigt. Zeigt kein neuer Screenshot einen Bereich, behalte die bisherigen Werte aus `show` unverändert. Schicke `genetics` immer **vollständig** (alle vier Felder), weil es als Ganzes ersetzt wird.

5. **Übernehmen.** Schreib den Payload in eine temporäre JSON-Datei (Scratchpad) und wende ihn an:
   ```json
   {
     "sex": "female",
     "playableId": "tyrannotitan",
     "genetics": {
       "bloodlines": ["..."],
       "skins": { "dominant": ["..."], "recessive": ["..."] },
       "mutations": [{ "name": "...", "note": "" }],
       "extra": [{ "label": "...", "value": "..." }]
     },
     "bonds": [{ "name": "...", "sex": "female", "kind": "Bindung", "status": "bondet gerade", "bloodline": "", "note": "" }],
     "character": { "traits": ["..."], "text": "" },
     "family": { "catalogId": "TY-01", "subspecies": "", "origin": "", "mother": "", "father": "", "offspring": [{ "name": "...", "sex": "female", "mother": "...", "clutch": 1, "born": "2026-11-02", "status": "lebend", "note": "" }], "log": [{ "date": "2026-11-02", "text": "...", "place": "" }] },
     "transcripts": { "screenshots/20261001-201500-1.png": "wortgetreuer Text …" },
     "processed": "pending"
   }
   ```
   ```bash
   node server/scripts/herd.mjs apply "<Name>" <payload.json>
   ```
   Felder, die du nicht ändern willst, lässt du weg. `"processed": "pending"` markiert alle neuen Screenshots als gelesen; konntest du einen nicht lesen (unscharf, falscher Inhalt), gib stattdessen die Liste der gelesenen Dateien an und lass den anderen offen.

6. **Rückmeldung auf Deutsch**, kurz: was neu oder geändert ist (die Ausgabe von `apply` zeigt vorher → nachher), was unsicher war, und ob noch etwas fehlt. Hat der Dino Mutationen, aber keinen `mutation`-Proof, oder fehlt der Nest-Proof, biete an, den Link hier im Chat einzutragen (dann nur `{"proofs": {"mutation": "<link>"}}` anwenden), oder verweis auf *Bearbeiten* auf der Dino-Seite.

## Regeln

- Nichts erfinden: Nur was lesbar im Bild steht oder der Nutzer sagt. Unleserliches als offen melden.
- Schreibweise der Namen exakt übernehmen (Groß/Klein, Bindestriche), damit Suche und Abgleich funktionieren.
- Niemals Screenshots oder Fotos löschen, umbenennen oder bearbeiten, und `dino.json` nie direkt editieren, sondern immer `herd.mjs apply`.
- Spielt der Nutzer nach einem Tod als Jungtier aus einem fremden Nest weiter und fügt den Nest-Post ein, leg den neuen Dino an und nimm aus dem Post nur, was ihn betrifft: Eltern (Charaktername, Bloodline, Spieler-@) und ihre Skins als `extra` im Stil der anderen Dinos („Genest von“, „Mutter“, „Vater“, „Eltern-Skins“, „Eltern-Rezessive“, „Gelege“, „Geschwister“). Die eigenen Skins stehen meist unter dem Post. Discord-Nummern fremder Spieler übernimmst du nicht. Die Bloodline des Jungen nicht aus dem Nest-Namen ableiten: Sie kann die des Vaters sein (Radahn trägt Erebus vom Vater, nicht Blooming Buds vom Nest), also nachfragen, wenn der Nutzer sie nicht nennt.
- Einen Dino ohne Screenshots (z. B. „ich habe einen neuen Tylo, Bild folgt“) legst du mit `node server/scripts/herd.mjs create "<Name>" <playableId>` an und füllst ihn dann mit `apply`.
- Schickt der Nutzer ein Foto seines Dinos im Chat (z. B. Bild mit nur dem Namen „Mistral“), setz es mit `node server/scripts/herd.mjs photo "<Name>" <Bildpfad>` als Foto (ersetzt das alte). Ein Foto ist kein Screenshot: nicht transkribieren, nichts daraus in `genetics` eintragen.
- Die App zeigt die Änderung sofort (Reiter *My Dinos* und eingeklappt auf der Profilseite des Playables); ein Neustart ist nicht nötig.
