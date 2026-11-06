# Staging: die Profile im Discord-Format

Jede Datei hier ist ein komplettes Profil des Aquatic Update, so wie es im Dynasty-Forum stehen würde: nur Englisch, gegliedert wie die Original-Profile. Der App-Tab „Aquatic Staging“ (`#/staging`) zeigt sie wie einen Discord-Forenthread.

Die Entwürfe in `../profile-entwuerfe/` bleiben die Arbeitsfassung mit den deutschen Entscheidungen. Ändert sich dort etwas, muss es hier nachgezogen werden.

## Raster (wie Tylosaurus, Parasaurolophus, Leedsichthys)

1. Erste Nachricht: `# Name`, Spitzname, Kurzbeschreibung, Credits, Copyright, Titelkarte.
2. Banner **Overview**: Einstufung fett, dann die Grundzeilen (Bindung, Revier, Wesen, Aas, Gruppen, Mutationen), danach `## Genetics`, optional `## Profile Specific Unique Feature`, `## Group Limits (In-Game Group)`, `## Engagement Limits (Defence & Hunts)`, `## Preferred Prey` oder `## Preferred Diet` (oder `## Resource Challenges`), `## Nesting Limits`, `## Physical Dimorphism`.
3. Banner **Growing Up**, **General Behavior**, **Social Interaction**, **Aggressive Interaction**, **Cross-Species Interaction**, **Hunting Strategy** (Jäger) oder **Predator Reaction** (Beute), **Courtship & Parenthood**, **Elderly**, jeweils mit `### ✦ …`-Unterpunkten.
4. Banner **Profile Notes** und **Rules & Clarifications** mit `### RULE EXEMPTIONS`. Die echten Namen dieser zwei Banner stehen nur im Bild; hier sind sie so benannt.
5. `## Preferred POIs` (Karte), `## Profile - Quick View`, `## Dynasty Adjusted Stats`, Quick Links.

Satzbau wie im Original: eine Aussage pro Zeile. Oben im Overview-Block steht die kurze Regel („Livyatan do not hunt …“) mit „See ✦ …“, unten im passenden Banner die ausführliche Erklärung.

## Format

- Oben Front Matter: `name`, `title`, `nickname`, `order`, `kind` (`new` = neu aufgebaut, `changed` = Original mit Änderungen), `card`, `difficulty` („3 Moderate“), `cover` (Bild aus `data/raw`), `source`.
- Der Text ist Discord-Markdown: `#`/`##`/`###`, `**fett**`, `- ` Punkte, zwei Leerzeichen für Unterpunkte, `1.` für Abläufe, `#🎲・kanal` für Kanäle.
- Steuerzeilen, die nie im Discord-Text landen:
  - `%% titlecard` Titelkarte
  - `%% banner <Abschnitt>` Banner-Bild, beginnt eine neue Nachricht
  - `%% image <Beschriftung>` anderes Bild (Dimorphismus, Karte)
  - `%% post` neue Nachrichtengruppe mit Autorzeile
  - `%% quicklinks` Quick-Links-Nachricht am Ende
  - `%% note <Text>` Hinweis für dich (gelb im Tab, offen oder zu entscheiden)
- `{+}` am Zeilenende: Diese Zeile weicht vom heutigen Profil ab. Nur in geänderten Profilen, im Tab grün markiert.
- Der Server teilt den Text in Nachrichten von höchstens 2000 Zeichen (Discord-Grenze), bevorzugt vor einer Überschrift. Jede Nachricht ist im Tab einzeln kopierbar.

Der Test `server/src/staging.test.js` prüft, dass jedes Profil im Raster liegt, die Banner in Original-Reihenfolge stehen und keine Nachricht zu lang ist.
