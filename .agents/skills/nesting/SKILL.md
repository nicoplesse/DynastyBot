---
name: nesting
description: Erstellt einen fertigen Discord-Nesting-Post (Dynasty Realism, Path of Titans) im persönlichen TheNPCC-Template. Aufruf „/nesting <Dino> [Charakter]“ oder „/nesting <Charakter>“, z. B. „/nesting Tyrannotitan“, „/nesting Malenia“, „/nesting Titan Malenia dry 3 Eier“. Eigene Dinos aus „My Dinos“ werden automatisch als Mutter oder Vater eingetragen, Arteigenes (Eierzahl je Saison, /rolleggs-Pflicht, Spielt-sich-wie-Satz) kommt aus dem Profil. Nutze diesen Skill immer, wenn der Nutzer einen Nest-Post, Nesting-Post, eine Nest-Ankündigung oder Eier-Liste für Discord schreiben oder aktualisieren will („Ei 2 ist weg an …“), auch ohne das Wort „Template“.
---

# /nesting – Discord-Nesting-Post im eigenen Template

Du baust aus **einem globalen Template** einen Nest-Post für Discord. Die Teile:

| Datei | Inhalt |
|---|---|
| `template.md` (dieser Ordner) | das globale Layout (Trennlinien, ✧-Zeilen), Discord-Markdown, auf Englisch |
| `config.json` (dieser Ordner) | Spielername, Discord-IDs (eigene ID, @Nesting-Rolle, Kanäle, Profil-Kanäle), Hausregeln, Ablaufzeit, Zeichenlimit |
| `server/scripts/nesting.mjs` | `info` sammelt Profil + „My Dinos“, `render` füllt das Template |

Arteigenes steckt **nicht** in eigenen Templates pro Art, sondern kommt beim Rendern aus dem Profil. Alle Befehle laufen im Repo-Root. Mit dem Nutzer sprichst du **Deutsch**, der Post selbst ist **Englisch** (Server-Sprache).

## Ablauf

1. **Argumente lesen.** `/nesting <Dino> [Charakter]`: Dino = Art, Name oder Spitzname (Titan, Dasp, Para …); Charakter = Name eines eigenen Dinos. Nur ein Name geht auch (`/nesting Malenia`). Weitere Angaben im Aufruf (Saison, Eierzahl, Roll-Link, Partner, Gelege-Nr.) gleich übernehmen.
   ```bash
   node server/scripts/nesting.mjs info <Dino> [Charakter]
   ```
   - `dino` gesetzt → eigener Dino gefunden. `dino.role` sagt, ob er **mother** oder **father** ist, `dino.parent` ist der fertige Elternblock, `dino.missing` listet, was fehlt. Bei `warning` (Charakter ist eine andere Art) kurz nachfragen.
   - `candidates` mit mehreren Einträgen (z. B. „Deino“) → mit **AskUserQuestion** die Art wählen lassen und `info` erneut aufrufen.
   - Ohne Argumente: `node server/scripts/herd.mjs list` und per **AskUserQuestion** fragen, für welchen Dino (eigene Dinos zuerst, „Other“ = andere Art).
   - Kein eigener Dino angegeben, aber `herdOfSpecies` nicht leer → kurz fragen, ob einer davon nistet. Sonst ist es ein **Art-Post**: den eigenen Elternteil (Name, Skins, Subspecies, Augen) erfragst du komplett.

2. **Regel-Check (kurz erwähnen, nicht belehren).** Server-Regel 9: beide Eltern online und am Leben (9.3), Post spätestens 30 min nach dem Nestplatz (9.3.1), keine eigenen Jungtiere bis Adolescent im Spiel (9.3.2), Post nie löschen (9.4). Fällt dir aus den Profildaten eine Besonderheit auf, nenne sie: z. B. Amargasaurus = eigener Post je Männchen mit aufgeteilten Eiern, nicht-dimorphe Para-Weibchen = halbe Eierzahl, Deinosuchus = in der Trockenzeit keine Eier.

3. **Fehlendes in einer einzigen Nachricht erfragen.** Nur, was weder im Aufruf noch in `info` steht:
   - **Saison** (dry / rainy) und **Eierzahl**. `species.nestingLimits` nennt das Limit je Saison. Ist `species.rollEggs` true, muss mit `/rolleggs` gewürfelt werden, und der **Roll-Link** gehört in den Post (Pflicht).
   - **Partner**: Charaktername, Spieler (`@Name | 123-456-789`), Dominant, Recessive, Subspecies, Augenfarbe, Mutation (+ Proof-Link), optional Farben, Bloodline und Discord-ID (dann pingt er echt). Bitte den Nutzer, einfach den Genetik-Roll oder alten Nest-Post des Partners einzufügen, und lies die Werte selbst heraus.
   - Eigene Lücken aus `dino.missing` (meist Subspecies, Augen). `species.dimorphism` nennt oft die erlaubten Subspecies je Geschlecht; schlag die passenden vor.
   - Optional, nur nennen statt nachbohren: **Eltern-Note** (Persönlichkeit, wie „Albino is a strict parent …“).
   - **Gelege-Nr.** (Clutch) ist optional: übernehmen, wenn der Nutzer sie nennt, sonst nicht danach fragen und weglassen.
   - **Keinen Standort / POI** abfragen oder in den Post schreiben.

4. **Species-Note schreiben.** Ein englischer Satz (höchstens ~160 Zeichen) für die Jungen, nur aus `species.offspring` / `species.nestingSection` abgeleitet, z. B. „Whelps hatch precocial; Dad patrols the territory and never comes to the nest.“ Nichts erfinden. Schlägst du eine Eltern-Note vor, kennzeichne sie als Vorschlag.

5. **Payload schreiben und rendern.** Datei ins Scratchpad, z. B. `nest-<dino>.json`:
   ```json
   {
     "playableId": "tyrannotitan",
     "season": "dry",
     "clutch": null,
     "eggs": 3,
     "eggRoll": "https://discord.com/channels/…",
     "mother": { "name": "Malenia", "player": "TheNPCC | 039-974-634", "discordId": "",
                 "dominant": ["Tragopan"], "recessive": ["Melanistic", "Bloodthirsty"],
                 "subspecies": "", "eyes": "", "colours": "", "bloodline": "Blooming Buds",
                 "mutations": [{ "name": "Albino", "proof": "https://…" }] },
     "father": { "…": "gleiches Format" },
     "claims": [],
     "speciesNote": "…",
     "note": "",
     "rules": []
   }
   ```
   Den eigenen Elternteil übernimmst du 1:1 aus `dino.parent` und ergänzt nur die Lücken. `rules` sind **zusätzliche** Nest-Regeln (die Hausregeln aus `config.json` kommen immer dazu); dort darfst du `{profile}`, `{geneticsRolls}`, `{nestingChat}`, `{species}` verwenden.
   ```bash
   node server/scripts/nesting.mjs render <payload.json>
   ```
   Der Post kommt auf stdout, Zeichenzahl und Warnungen auf stderr. Der erste Render trägt `postedAt` in die Datei ein, damit der Ablauf-Timer bei späteren Änderungen gleich bleibt.

6. **Ausgeben.** Den Post **unverändert** in einen Codeblock mit vier Backticks und ohne Sprache setzen, damit der Nutzer ihn mit dem Kopier-Button roh kopieren kann (sonst gehen `**`, `>` und `-#` verloren). Darunter kurz auf Deutsch: Zeichenzahl, Warnungen, und dass der Ablauf-Timer ab jetzt läuft (30 min, Regel 9.4.1). Wartet der Nutzer länger mit dem Posten, `postedAt` aus der Datei löschen und neu rendern.

7. **Eier vergeben (Folgeaufträge).** „Ei an @Kaje | 909-701-183, Ash, M“ → einen Eintrag in `claims` ergänzen (`player`, optional `discordId`, `name`, `sex`), neu rendern und den ganzen Post wieder ausgeben, damit der Nutzer seinen Discord-Post bearbeiten kann. Sind alle Eier vergeben, zeigt das Template automatisch „This nest is full“.

8. **Zurückschreiben in „My Dinos“ (anbieten, nicht ungefragt).** Neue Subspecies, Augenfarbe und Farben kann der Dino behalten. Dafür mit `herd.mjs show` die aktuelle `genetics` holen, in `extra` die Einträge `Subspecies`, `Augenfarbe`, `Farben` setzen oder ersetzen und **genetics vollständig** per `herd.mjs apply` schicken (siehe `/aktualisiere`). `dino.json` nie direkt bearbeiten.

## Discord-Regeln für den Post

- Nur Discord-Markdown: `#`/`###` Überschriften, `-#` kleine Zeile, `>` Zitatblock, `**fett**`, `*kursiv*`, Listen, `[Text](<Link>)` (spitze Klammern unterdrücken die Link-Vorschau).
- **Keine Fancy-Unicode-Schriften** (𝗕𝗼𝗹𝗱, 𝖲𝖺𝗇𝗌): nicht durchsuchbar, auf manchen Handys Kästchen. Deko-Zeichen wie ✧ ⤷ ┆ ⟡ und die Trennlinien im Template sind in Ordnung; gesperrte Überschriften (**E G G S**) bleiben normale Buchstaben.
- Pings funktionieren nur als ID: `<@Nutzer-ID>`, `<@&Rollen-ID>`, `<#Kanal-ID>`. Ein getipptes „@Name“ im kopierten Text pingt nicht. Fehlt eine ID in `config.json`, steht dort Klartext.
- Zeitangaben als Discord-Zeitstempel `<t:UNIX:R>`: Jeder sieht „in 30 Minuten“ bzw. „vor 2 Stunden“ in seiner eigenen Sprache und Zeitzone.
- Limit 2000 Zeichen (ohne Nitro). Wird es zu lang, zuerst `note` und `speciesNote` kürzen, dann Zusatzregeln.
- Namen mit `_` oder `*` escapt das Skript automatisch.

## Template anpassen

`template.md` ist ein kleiner Mustache-Dialekt: `{{feld}}`, `{{#liste}}…{{/liste}}` (wiederholen oder „wenn vorhanden“), `{{^feld}}…{{/feld}}` („wenn leer“), `{{! Kommentar }}`. Zeilen, die nur ein Abschnitts-Tag enthalten, verschwinden.

| Feld | Inhalt |
|---|---|
| `species`, `profile` | Artname; Profil als Kanal-Link (wenn in `profileChannels`) sonst fett |
| `seasonIcon`, `seasonLabel`, `clutch` (optional), `eggs`, `eggWord` | Kopfzeile |
| `tagline` | „Spielt sich wie“-Satz aus dem Profil, oben unter der Überschrift |
| `parents[]` → `icon`, `role`, `name`, `player`, `dominant`, `recessive`, `details[]` (`label`, `value`) | Mutter und Vater; `details` enthält nur vorhandene Werte mit Kurzlabel (SS = Subspecies, EC = Augen, Colours, Bloodline, M = Mutation) |
| `slots[]` → `n`, `taken` (`who`, `name`, `sex` als ♂/♀); `claimed`, `full` | Eier-Liste |
| `eggRoll` | Roll-Link (bereits in `<…>`) |
| `rules[]`, `speciesNote`, `note` | Hausregeln + Zusatzregeln, Art-Hinweis, Eltern-Note |
| `geneticsRolls`, `nestingChat` | Kanal-Erwähnungen |
| `expires`, `expiresAt` | Ablauf relativ / als Uhrzeit |
| `ping` | @Nesting-Ping |

Nach Änderungen am Template oder an `server/src/nesting.js`: `npm test -w server` (prüft u. a., dass der Post unter 2000 Zeichen bleibt).

## Regeln

- Nichts erfinden: Skins, Subspecies, Links und Namen nur aus „My Dinos“, dem Chat oder dem Profil. Unklares erfragen, nicht raten.
- Schreibweise von Skins und Namen exakt übernehmen.
- Profil schlägt Server-Regel; Eierzahl nie über dem Profil-Limit der Saison (außer der Nutzer nennt einen Shop-Perk, Regel 9.3.3).
