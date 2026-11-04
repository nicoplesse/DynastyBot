# Ökosystem im Wasser: Bewertung der Ideen

Stand 2026-11-04. Diese Datei bewertet die Grundidee und schlägt Rollen, Profil-Änderungen und Werte vor.

**Entschieden (03.11.):** Kaiwhekea wird der Para des Meeres, Eurhinosaurus wird reiner Fischfresser. Alles andere ist noch Vorschlag. Die Profil-Entwürfe dazu liegen in `profile-entwuerfe/`. Zahlen kommen aus `werte.md`, Kill-Zeiten nach der Projekt-Formel: Schaden × (CW Angreifer ÷ CW Ziel) ÷ Armor.

**Wichtig zu allen Kampfzahlen (Hinweis vom 03.11.):** Die Simulationen sind reine Bissduelle. Wendigkeit und Skill fehlen. Aquatic-Kämpfe entscheidet aber fast immer die Wendigkeit: Ein einzelner Tylo macht einen Spino im Wasser fertig, obwohl er das Bissduell verliert, weil er einfach um ihn herumschwimmt. Die Zahlen zeigen deshalb nur, wer im Stillstand gewinnt. Regeln, die an einem knappen Bissduell hängen, sind vorläufig:
- **Sachi gegen Spino und Deino:** Im Bissduell verliert ein einzelner Sachi gegen beide. Wie zuvor beim Prog gilt: Im Wasser ist er als voller Aquatic der Wendigere, deshalb darf er beide auch allein jagen.
- **Sachi gegen Tylo:** Im Bissduell ein Münzwurf, siehe die Tabelle unten.

**Prognathodon ersetzt durch Sachicasaurus (entschieden am 04.11.).** Der Prog-Mod von Arazoa ist kaum dokumentiert, und ob er beim Clampen beißen kann, steht nirgends. Der Sachicasaurus von Primordial Tyrants füllt dieselbe Lücke (nächtlicher Revierhalter in den Ozeanen) und ist mit allen Fähigkeiten dokumentiert. Primordial Tyrants stellt auf Dynasty schon rund 20 Mods. Das Gift fällt weg, dafür kommen Clamp und Knochenbruch. Weil er kein Tiefseetier ist (9:48 Luft, 20 Schaden/s ohne Luft, Beachcomber), lebt er in Kelp, Riffen, Untiefen und an Stränden. Entwurf: `profile-entwuerfe/sachicasaurus.md`.

**Tylo gegen Sachi: wer ist stärker?** Tylo-Werte aus den Blueprints und Kurven, Sachi-Werte aus NexLink (2026) und dem Path-of-Titans-Wiki. Das Schwimmtempo des Sachi fehlt noch, weil der Mod nicht heruntergeladen ist.

| | Tylosaurus | Sachicasaurus | Vorteil |
| --- | --- | --- | --- |
| CW / Health / Armor | 5000 / 1000 / 1 | 5500 / 900 / 1,1 (Ironclad +10 %?) | gleich |
| Heilung/s | 2,0 | 1,0 | Tylo |
| Ausdauer-Regeneration/s | 0,9 | 0,66 | Tylo |
| Sprintdauer | 3:42 | ~2:32 an der Oberfläche, ~5:03 getaucht | Tylo oben, Sachi unten |
| Luft unter Wasser | 11:07 | 9:48, 20 Schaden/s ohne Luft | Tylo |
| Tragkraft | 3000, mit Wide Gape 3700 | 4001 | Sachi: packt als einziger adulte Kai |
| Knochenbruch | Bone Snap 30, Crushing Bite 20 | Bone Snap 40, nachts 48 | Sachi |
| Bissduell (DPS 51,5 gegen 40,8) | gewinnt knapp (21 s, behält 5 %) | mit Ironclad gewinnt er knapp (22 s, 4 %) | gleich |
| Paar gegen Paar | gewinnt knapp (31 s, 7 %) | – | gleich |

- **Im offenen Wasser und im langen Kampf ist Tylo stärker.** Mehr Ausdauer, schnellere Heilung, längerer Sprint an der Oberfläche. Er bestimmt Abstand und Zeitpunkt.
- **Sachi gewinnt den ersten Moment.** Clamp, Knochenbruch bei Nacht und vermutlich die längste Sprintdauer unter Wasser.
- **Jeder hat ein eigenes Vorrecht:** Nur Tylo-Paare dürfen den adulten Livy jagen. Nur Sachi kann einen adulten Kai packen.
- **Für den Livy sind beide gleich schwer:** Livy gegen Sachi 19 s (behält 76 %), gegen Tylo 18 s (74 %); gegen ein Paar 38 s (27 %) bzw. 35 s (23 %).
- **Community:** Die einzige Quelle ist die Fandom-Wiki-Seite (Stand September 2024). Dort steht einmal „pretty op“, im Trivia-Teil aber, er gelte oft als „unviable“, weil neuere Meeres-Mods ihn bei Tempo, Ausdauer und Werten schlagen. Gegen den Standard-Tylo (CW 4500, Health 900) gewinnt er klar (18 s gegen 24 s). Gegen den gebufften Dynasty-Tylo ist es ausgeglichen.
- **Wendewerte:** Ein Feld für die Wendegeschwindigkeit lässt sich in den Blueprints nicht sicher benennen. Die Felder, die ich zuerst dafür hielt (30 bei Kai, 50 bei Tylo, 270 bei Spino), sind die Gehgeschwindigkeit an Land. Sicher vergleichbar sind nur Tempo, Beschleunigung, Sprintdauer und Luft, siehe die Tempo-Tabelle im Tab.
- **Xiph gegen Krokodile:** Die Mindestzahlen (Sarco ab 4, Deino ab 5) sind vorsichtig. Xiph ist der schnellste Schwimmer, im Wasser reichen vermutlich weniger. Als Vorsichtsregel passen sie trotzdem.

Harte Wendigkeitswerte gibt es weder in den Kurven noch sicher benennbar in den Blueprints. In den Kurven stehen nur Faktoren, fast alle 1, bei Xiph ein Wenderadius-Faktor von 1,3.

## Kurzfassung

- **Die Grundidee stimmt.** Im Wasser gibt es heute nur Fleischfresser. Alle vier Aquatics sind als „Carnivore“ eingestuft, eine Beute-Seite wie den Para gibt es dort nicht.
- **Para des Meeres:** Dafür passt **Kaiwhekea**. Eurhinosaurus kommt als schneller Wächter und Schwarmpartner dazu, beide fressen nur Fisch.
- **Jäger:**
  - Tylosaurus bleibt der Jäger an der Küste.
  - Sachicasaurus wird der nächtliche Revierhalter und Flotilla-Jäger (ersetzt den Prognathodon).
  - Livyatan jagt aus der Tiefe die großen Tiere.
  - Xiphactinus wird das Raptor-Profil.
- **Leedsichthys** bleibt der friedliche Riese. Er darf mit einer Kai-Gruppe gruppieren (1 Leeds je Gruppe). Verteidigt wird nicht, weder von ihm noch für ihn.
- **Ohne einzelne Wertänderungen klappt es nicht.** Kai fällt heute zu schnell um. Livyatan schlägt Tylosaurus nur knapp. Der Sachicasaurus braucht keine Änderung.
- **Xiphactinus gewinnt durch kluges Spiel, nicht durch Werte.** Die Beute bekommt keinen Schutz durch Regeln. Sie schützt sich durch eigenes Verhalten.

## Was den Para ausmacht

| | Para (Land) | Kai heute | Eurhino heute |
| --- | --- | --- | --- |
| Einstufung | Apex Herbivore | Medium Carnivore | Medium Carnivore |
| CW / Health / Armor | 5500 / 1400 / 1,1 | 4000 / 750 / 1 | 3000 / 600 / 1 |
| Wie lange der Haupt-Jäger zum Töten braucht | T-Rex: 26 s | Tylo: 12 s | Tylo: 7 s |
| Gruppe | 20 Sub/Adults, Mischherden mit 6 Arten | 8 (6 ♀, 2 ♂) | unbegrenzt |
| Bindung | Harem, nach 5 Gelegen lebenslanges Paar | promiskuitiv | promiskuitiv |
| Jagt Spieler | nein | bis Large | Kai und Leeds-Junge „als Sport“ |

Der Para fällt nicht sofort um, weil seine Werte fast die eines Apex sind. Zur Beute machen ihn erst die Regeln: Er flieht vor Apexen, hat höchstens 2 aktive Verteidiger und einen Schutzkreis um die Jungen. Diese Aufteilung sollte das Wasser übernehmen: robuste Werte, und die Regeln machen das Tier zur Beute.

## Rollen

| Rolle | Art | Vorbild aus der Tierwelt | Lebensraum |
| --- | --- | --- | --- |
| Para des Meeres | Kaiwhekea | Delfin-Schule, Seekuh-Herde | Küste, Lagunen, offenes Flachwasser |
| Schneller Schwarm, Wächter | Eurhinosaurus | Delfine, Lachs | Küste und Flussmündungen |
| Sanfter Riese | Leedsichthys | Walhai mit Pilotfischen | offenes Meer, Wanderrouten |
| Raptor | Xiphactinus | Barrakuda- und Makrelen-Rudel | nur die Salzwasser-Flussengen |
| Küsten-Apex | Tylosaurus | Orca, Seeleopard | Ozeane und Flussengen |
| Nächtlicher Flotilla-Jäger | Sachicasaurus | Jaguar, Leistenkrokodil | Kelp, Riffe, Untiefen und Strände der Ozeane, halbe Reviere |
| Apex der Apexe | Livyatan | Pottwal mit Orca-Jagdweise | alle Ozeane außer Palm Islands |

### Wer wen im offenen Wasser einholt

Sprint-Schwimmen: Xiph 1200 › Eurhino 1050 › Kai 990 › Tylo 900 › Livy 750 › Leeds 600. Sachi fehlt noch, der Mod ist nicht heruntergeladen.

- **Xiphactinus** holt jeden ein. Damit ist er der natürliche Jäger der schnellen Beute, wie der Gepard bei der Gazelle.
- **Kai und Eurhino** entkommen Tylo und Livy auf freier Strecke; Sachis Tempo ist noch offen. Die Apexe müssen also lauern, und genau das gibt ihre Ausstattung her. Sachi muss nicht verfolgen: Was er gepackt hat, entkommt nicht.
- **Livyatan** holt keinen anderen Apex ein. Er funktioniert nur aus dem Hinterhalt (siehe unten).

## Bewertung je Idee

### Basis: Kaiwhekea als Para des Meeres

**Passt gut:**
- Das Profil ist schon heute tolerant, neugierig und nomadisch und lebt in Gruppen (bale). Kai bringen Landtieren Fundstücke vom Meeresgrund.
- Vorbild ist die Meeresschildkröte.
- Biologisch ist „nur Fisch“ richtiger als die heutige Jagd bis Large. Das eigene Profil sagt, Kaiwhekea jagt „kleine, weiche Beute wie Fisch“. Plesiosaurier brachten lebende Junge zur Welt (Polycotylus-Fund, 2011), was zu Brutpflege und Bindung passt.

**Widersprüche:**
1. **Kai fällt zu schnell um.** Tylo braucht 12 s für einen Kai, der T-Rex 26 s für einen Para.
   - Lösung: nur Health 750 → 1000, die CW bleibt 4000. Dann braucht Tylo 16 s und gewinnt das Duell weiterhin (Kai bräuchte 22 s).
   - Die anfangs vorgeschlagene CW 4500 ist gestrichen. Sie hätte Xiphactinus zu stark geschwächt.
2. **Kai hat den höchsten DPS im Wasser (56,9) und starke Gruppen-Buffs.** In einer großen Gruppe wäre das zu viel.
   - Lösung nach dem Para-Muster: Call to Arms (+25 % Schaden) dürfen nur die aktiven Verteidiger nutzen.
   - Hustle (Flucht) und Rejuvenating Roar (Heilung) bleiben frei.
   - Regel 8.1.1 sieht solche Einschränkungen für Mischgruppen schon vor.
3. **Mischgruppen sind für Fleischfresser verboten** (Regel 8.1). Kai und Eurhino gelten als Carnivore. Nötig ist eine Einstufung „Piscivore“ (frisst nur Fisch, jagt keine Spieler), die für Gruppenregeln wie ein Herbivore zählt.

**Vorschlag:**
- Kai frisst nur Fisch, Krebse und Muscheln und jagt keine Spieler. Gekämpft wird nur zur Verteidigung.
- Bindung wie beim Para: Harem oder Paar, nach mehreren Gelegen ein lebenslanges Paar.
- Bale bis 16 Sub/Adults, Mischgruppen mit Eurhinosaurus.
- Zur Verteidigung bis zu 2 aktive Verteidiger und ein Schutzring um die Kälber, die im Flachwasser warten.
- Vor Apexen flieht Kai auf Sicht, außer am Nest.

### Eurhinosaurus als Schwarm und Wächter

**Passt gut:**
- Schwärme ohne Obergrenze und feste Freundschaften.
- „Man hört sie, bevor man sie sieht.“
- Farbwechsel durch Häutung, Pflicht in der Balz: genau die Individualität, die beim Para über Skins läuft.
- Laut eigenem Profil lebt Eurhinosaurus „am liebsten passiv von Fisch und Krebsen“.

**Widerspruch:**
- Das heutige Profil jagt Kai „über alles andere, als grausamen Sport“. Als Kais Mischgruppen-Partner geht das nicht. Das ist die größte Änderung an einem bestehenden Profil.
- Wenn Eurhino Jäger bleibt, stehen nur Kai und Leeds als Beute fünf Jägern gegenüber.

**Vorschlag:**
- Eurhino frisst nur Fisch. In der Mischgruppe mit Kai übernimmt er die Rolle von Citipati und Struthiomimus beim Para: Er warnt früh durch laute Rufe.
- Er überlebt durch Tempo (schnellster Sprint nach Xiph, längste Sprintdauer) und den Schwarm.
- Werte bleiben unverändert. Mit 600 Health ist er die Beute, die Xiphactinus sicher erlegen kann, wenn er sie erwischt.

### Tylosaurus

Das Profil passt fast so, wie es ist. Nötig sind nur Anpassungen an die neuen Arten:
- **Beute:** Xiphactinus kommt zur Beute dazu.
- **Livyatan:** Ein einzelner Tylo flieht vor Livy. Ein Tylo-Paar darf ihn jagen, bei jedem Hunger, als einzige Ausnahme von der Apex-Grenze (entschieden am 03.11.). Im Bissduell verliert es gegen einen adulten Livy mit CW 8000 und Health 2000 (Livy behält 22 %), gewinnen kann es nur durch Hit-and-Run. Die Pflicht-Beute (Kai, Eurhino, Leeds) geht vor (entschieden am 04.11.), und selbst Tylo traut sich kaum an einen Livy heran.
- **Sachicasaurus:** Ebenbürtiger Rivale. Adulte Sachi jagt Tylo nur bei Hunger ≤ 35 %, wie Spino und Deino. Revier-Herausforderungen nimmt er an: Verliert er, muss er gehen (6.7.2). Gewinnt er, muss der Sachi ihn 15 min dulden (6.7.3.1).
- **Xiphactinus:** Tylo darf ihn jagen, wenn er allein oder in Gruppen bis 3 ist. Gegen 6 Xiph verliert ein einzelner Tylo.
- Entwurf: `profile-entwuerfe/tylosaurus.md`.

### Sachicasaurus als nächtlicher Flotilla-Jäger („Tyrannotitan der Meere“)

Ersetzt den Prognathodon (entschieden am 04.11.). Reviere, Sozialstruktur und Beaching-Regeln stammen aus dem Prog-Entwurf, die Jagdweise ist neu.

**Passt gut:**
- Die Struktur des Tyrannotitan lässt sich übernehmen: Männchen halten das Revier, oft als Bruderpaar. Weibchen sind nomadisch und nisten im Revier eines Männchens. Aktiv ist er nachts.
- Kräftig, aber wendig: Pliosaurier mit großem Kopf und vier Flossen. Aileron Roll, Breach und Lunge passen zum Hinterhalt.
- Moonlight Hunter (+20 % Knochenbruch nachts), Fisch-Tracker und gute Sicht unter Wasser passen zum Nachtjäger, der zwischen den Jagden fischt.
- Er hat wenig Luft (9:48) und nimmt ohne Luft 20 Schaden pro Sekunde. Dazu kommt Beachcomber. Das spricht für Kelp, Untiefen und Strände und trennt ihn sauber von Livyatan in der Tiefe. Das echte Tier lebte in einem flachen Binnenmeer (Paja-Formation, Kolumbien).
- **Seine besondere Art:** Mit Tragkraft 4001 ist er der einzige Jäger, der einen adulten Kai packen kann. Er sprengt mit Aileron Roll eine schlafende Flotilla, packt einen Kai am Rand und zieht ihn ins Kelp. Was er gepackt hat, entkommt nicht, egal wie schnell es ist.

**Kein Widerspruch bei den Werten:** Die Mod-Werte (CW 5500, Health 900, Armor 1,1) passen ohne Änderung. Gegen Tylo ist es ein Münzwurf, für Livy ist er so schwer wie ein Tylo (siehe oben).

**Was man beobachten sollte:**
1. **Ein gepackter Kai ist verloren** (Entscheidung vom 04.11.). Kai fliehen vor Apexen, die Bale hilft ihm also nicht.
   - Hält der Sachi einen Kai, macht er rund 19 Schaden pro Sekunde (Kauen und Thrash). Für einen vollen Kai braucht er damit etwa eine Minute. Ob seine Ausdauer dafür reicht, muss das Spiel zeigen.
   - Der Schutz der Kai liegt vor dem Griff: Nachtwache, Ruhe weg von Kelp und Riffen, und hohe Felsen, auf die der Sachi nicht kommt.
   - Beobachten, ob ein Sachi unter einem Felsen wartet, bis der Kai bei 50 % Durst ins Wasser zurück muss (rund 20 min).
2. **Heilung 1,0/s.** Für einen Revierhalter niedrig. Erst anheben (auf 1,5), wenn er im Test seine Reviere nicht halten kann.
3. **Tempo und Wendigkeit** sind noch nicht aus den Mod-Dateien gelesen.

**Im Entwurf (`profile-entwuerfe/sachicasaurus.md`) festgelegt:**
- Er lebt in Kelp, Riffen, Untiefen und an den Stränden der Ozeane. Männchen halten allein oder als Bruderpaar (brace) einen halben Ozean-POI. Weibchen ziehen allein oder als Paar (drift) umher. Abyssal Depths meidet er.
- Herausgefordert werden Tylo, fremde Sachi-Männchen und auf Palm Islands auch Deino und Spino. Er jagt Deino und Spino gern, muss aber nicht, auch allein. Xiph begegnet er kaum, denn der lebt nur in den Flussengen. Vor Livy flieht er; in Kelp und Untiefen ist er vor ihm sicher.
- Tagsüber ziehen Kai-Gruppen unbehelligt durch sein Revier, nachts entscheidet ihr Ruheplatz.
- Kai fliehen vor Apexen auf Sicht. Die Nachtwache schlägt also Alarm, statt zu kämpfen. Er muss aus dem Hinterhalt packen, sonst entkommt die Beute.
- Nur am Nest stellen sich Kai, und 2 Eltern schlagen einen einzelnen Sachi.

### Livyatan als Jäger aus der Tiefe

**So funktioniert Echolocation:**
- Ein Emote zeigt 5 Sekunden lang Ziele im Umkreis von 150 m. Danach folgen 30 Sekunden Abklingzeit.
- Dazu kommen zwei Stimm-Fähigkeiten:
  - **Dreadful Clicking:** −15 % Tempo und Armor beim nächsten Tier im Umkreis von 60 m, 15 s lang. Nur außerhalb des Kampfes nutzbar.
  - **Concussive Blast:** −25 % Tempo und −50 % Beschleunigung für alle im Umkreis von 30 m, 10 s lang.

**Passt gut:** Die Ausstattung ist genau deine Idee.
- Er findet das Ziel per Echo und nähert sich ungesehen von unten.
- Ab 60 m bremst er es, ab 30 m lähmt er es. Unter Concussive Blast sinkt Tylo von 900 auf 675.
- Pressurized Hide (+50 % Sauerstoff) macht ihn zum Tieftaucher. Mit dem verdoppelten Vorrat (entschieden am 04.11.) bleibt er ~22:13 unten, mit dem Trait ~33:20.
- Für die Sozialstruktur gibt es Fähigkeiten für die Gruppe (Leviathan's Call, Pod Migration) und für Einzelgänger (Solo Singer). Das passt zum Pottwal: Weibchen in kleinen Gruppen, Bullen allein.

**Widersprüche:**
1. **Er ist der langsamste Apex.** Auf freier Strecke holt er Tylo nicht ein. Das ist in Ordnung, solange er nur aus dem Hinterhalt jagt; das sollte das Profil so festschreiben. Optional: Schwimmen 500 → 550, damit er einem gemütlich schwimmenden Tylo überhaupt folgen kann.
2. **Er gewinnt gegen Tylo nur knapp** (23 s gegen 24 s). Für den „Apex der Apexe“ ist das zu wenig. → **Entschieden (03.11.): CW 6000 → 8000, Health 950 → 2000.** Dann schlägt er einzelne Tylo, Sachi und Leeds klar und auch Paare von Tylo und Sachi. Nur Kai-Gruppen ab 3 Tieren schlagen ihn noch.
3. **Die Tiefsee ist kreative Freiheit.** Die Fossilien stammen aus einem Küstenmeer in Peru. Belegt ist dagegen, dass er die größte Beute seiner Zeit jagte, nämlich Bartenwale. Deshalb sollte Leeds, als Pendant zu den Bartenwalen, seine Hauptbeute sein, Tylo und Sachi kommen danach.
4. **Regel 3.18:** Aquatics dürfen sich nicht in Kämpfe anderer Aquatics einmischen. Er räumt also nur Apexe ab, die gerade nicht selbst jagen. **Ausnahme (entschieden am 04.11.):** Jagt ein Räuber einen seiner Schützlinge (Styracosterna und ihre Herdenbegleiter), darf der Livy im offenen Wasser eingreifen. Das gilt gegen jeden Fleischfresser bei einer aktiven Jagd, auch gegen Landjäger wie den Tyrannosaurus, die ihrer Beute ins Wasser folgen, und gegen Meeresjäger wie Tylo und Sachi. Jagt ein Räuber etwas anderes, darf er nie third-partyen; dann lässt er ihn die Arbeit machen und fordert danach den Körper per Body Contest heraus. Den Körper eines toten Schützlings ficht er nicht an, denn er frisst nie davon.

**Im Entwurf (`profile-entwuerfe/livyatan.md`) festgelegt:**
- **Stufe Giant** (entschieden am 03.11.), wie Argentinosaurus. Sachi darf nur bis Apex jagen und sich gegen einen adulten Livy nur wehren. **Tylo-Paare dürfen ihn jagen** (entschieden am 03.11.), bei jedem Hunger; das ist die einzige Ausnahme von der Apex-Grenze. Adoleszente Livys zählen als Apex.
- Höchstens 2 Weibchen, die sich mit demselben Bullen gepaart haben (oder nur eine von beiden), Bullen immer allein (entschieden am 03.11.). Große Gruppen würden den stillen Jäger verraten. Er lebt in allen Ozeanen außer Palm Islands. **Gejagt wird nur allein** (entschieden am 03.11.), wie bei echten Pottwalen, die in Familien leben, aber einzeln in die Tiefe tauchen. Leviathan's Call dient nur der Verteidigung der Kälber.
- Einzelne Leeds, Tylo und Sachi müssen zuerst gejagt werden; Sachi zählt nur im offenen Wasser, in Kelp und Untiefen folgt Livy nicht. Paare von Tylo und Sachi darf er auch jagen. Kai und Eurhino sind erst ab 35 % Hunger oder ohne große Beute erlaubt.
- Er kommt nicht ins Flachwasser, außer zum Nisten an den Inseln von Coastal Bluffs und am Rand von Stonebed Shoal.
- Simulation mit CW 8000 und Health 2000 (% = Health, die dem Livy bleibt):
  - Livy schlägt einen einzelnen Tylo (18 s, 74 %) und einen einzelnen Sachi (19 s, 76 %).
  - Einen Leeds schlägt er klar: 39 s mit 65 %, wenn der Leeds 1000 Health hat, 78 s mit 29 % bei 2000. Der Dynasty-Wert des Leeds ist unbekannt.
  - Ein Tylo-Paar schlägt er in 35 s (22 %), ein Sachi-Paar in 38 s (27 %). Mit Sonic Disruption bleiben ihm gegen das Tylo-Paar 38 %.
- Gegen eine Kai-Gruppe mit 3 Verteidigern verliert ein einzelner Livy in 26 s. Genau so steht auch ein einzelner T-Rex gegen 3 Paras da. Deshalb müssen Kai wie der Para vor Apexen fliehen, statt sich zu stellen.

**Folge für Tylosaurus und Sachicasaurus:** Ein einzelner Tylo flieht vor Livy, ein Tylo-Paar darf ihn jagen. Sachi flieht, allein und als Paar; ein Sachi-Paar darf sich wehren, verliert aber. Für Livy sind beide gleich schwer zu töten, die Livy-Jagd bleibt aber das Vorrecht der Tylo-Paare. Das steht so in `profile-entwuerfe/tylosaurus.md` und `profile-entwuerfe/sachicasaurus.md`.

**Rivalen der Tiefe: Livy und Leeds** (entschieden am 04.11.):
- Der Leeds flieht nie vor dem Livy. Fliehen brächte nichts, denn der Livy ist schneller (750 gegen 600), und in der Tiefe gibt es kein Versteck. Vorbild sind Buckelwale, die auf jagende Orcas losgehen.
- Er zieht jeden Kampf in die Tiefe, wo er nie Luft holen muss. Ohne Junge ist er aggressiv (duldet keinen Livy im Umkreis von 5 Körperlängen, respektiert dessen Forfeit), als Vater mit Jungen headstrong (greift auch nach einem Forfeit oder während der Livy Luft holt weiter an, bis der Livy den POI oder die Sichtweite verlässt). Das gilt nur gegenüber dem Livy.
- **Luft-Regel für den Livy:** Unter 25 % Sauerstoff muss er abbrechen und auftauchen; das zählt als Forfeit. Im Bissduell gewinnt der Livy klar, der Kampf wird aber ein Rennen gegen die eigene Luft, wie beim Pottwal gegen den Riesenkalmar. Die 25 % müssen im Spiel getestet werden. Mit dem doppelten Sauerstoff-Vorrat erreicht er die Grenze erst nach ~16:40 unter Wasser (mit Pressurized Hide ~25:00), knapp wird es also vor allem nach einer langen Suche in der Tiefe.

### Xiphactinus als Raptor

**Passt gut:**
- Er ist der schnellste Schwimmer im Spiel.
- Seine Ausstattung ist die eines Raptors: Blutung (Tearing Bite, Chomp), Armor −15 %, Flash blendet und bremst um 25 %. Agility Mentality ist ein Gruppen-Buff, Sanguine Hunger bringt +20 % Schaden.
- Als Einzelner verliert er jedes Duell. Das ist auch beim Utahraptor gegen den Para so.
- Schwarm (battery) bis 6 Tiere, alle dürfen jagen. Laut Simulation schlagen 4 Xiphactinus einen allein stehenden Kai mit den neuen Werten, 3 schaffen es nicht. Gegen einen Kai mit 2 Verteidigern verlieren selbst 6. Erfolg hat ein Schwarm also nur, wenn er ein Tier von der Gruppe trennt. Entwurf: `profile-entwuerfe/xiphactinus.md`.
- Seine Beute sind Eurhinosaurus, von der Gruppe getrennte Kai, Leeds-Junge und die Jungen aller Arten. Adulte Leeds greift er nie an.

**Widersprüche:**
1. **Raptor und Pilotfisch zugleich geht nicht.** Ein Jäger würde den Schutz des Leeds als Deckung für die Jagd ausnutzen. Xiphactinus folgt dem Leeds also nicht.
2. **Durst (geklärt):** Laut Mod-Kurve ist er nach ~6 min leer, bei Livyatan nach ~8 min. Das Wiki sagt aber, dass Aquatics Durst nur an Land verlieren. Bei Tylosaurus steht „Durst: N/A“ und „0,41 Durstverbrauch pro Sekunde an Land“, bei Kaiwhekea „0,165 an Land“. Die Mods nutzen sehr wahrscheinlich dieselbe Mechanik, und Xiphactinus geht als Fisch ohnehin nicht an Land. Das sollte man einmal im Spiel bestätigen, ein Hindernis ist es aber nicht.

**Werte:** Keine Änderung nötig. Laut Simulation brauchen 4 Xiphactinus einen allein stehenden Kai (Health 1000). Achillobator braucht für einen Para genauso viele, Utahraptor sogar 5.

#### Wie Xiphactinus durch kluges Spiel gewinnt

- **Tempo:** Er holt alles ein (1200).
  - Eurhino (1050) entkommt nur mit rund 250 m Vorsprung, also nur, wenn die Wache früh warnt.
  - Ein Kai (990) muss innerhalb von 30 s zur Gruppe zurück, sonst bekommt er keine Verteidiger. Xiph gewinnt, wenn er ihn von der Gruppe abschneidet.
- **Wendigkeit:** Sein Wende-Wert liegt laut Kurve bei 1,3, bei allen anderen bei 1. Kai hat dafür die stärkste Beschleunigung (1900 gegen 1300). Sein Konter ist also ein plötzlicher Antritt mit Haken.
- **Flash:** Blendet und bremst Tempo und Wenden 5 s lang um 25 %. Damit bestraft er einen Haken.
- **Blutung:** Zubeißen, abdrehen, bluten lassen. Dieses Hit-and-Run kostet ihn kaum etwas.
- **Regel 4.5:** In einer Mischgruppe darf er das Ziel zwischen Kai und Eurhino wechseln, ohne aufzugeben.
- **Beute, die es immer gibt:**
  - Eurhinosaurus
  - Hatchlings und Juveniles aller Arten, jederzeit jagbar nach Regel 4.3.3
  - Leeds-Junge
  - vereinzelte Kai
- **Was er nicht kann:** eine intakte Kai-Gruppe mit 2 Verteidigern und Schutzring frontal angreifen. Raptoren gegen eine Para-Herde geht es an Land genauso.

#### Vertiefung am 04.11. (zu entscheiden)

Leitbild vom Nutzer: **von außen absolutes Chaos, von innen absolute Kontrolle.** Vorbilder sind Piranha und Hai, für die Rollen die Gelbsattel-Meerbarbe. Details und alle offenen Entscheidungen stehen in `profile-entwuerfe/xiphactinus.md`.
- **Entschieden:**
  - Er bleibt Cathemeral, ohne feste Jagdzeiten, ist aber in der Dämmerung am aktivsten.
  - Treiber und Sperrer bleiben.
  - Zur Balz treffen sich alle in Coastland Swamp.
  - Dimorphismus ist Pflicht, und die Weibchen beißen die Männchen.
- **Der Kessel:** Der Schwarm schließt die abgeschnittene Beute in einem trommelnden Ring ein. Jedes Tier hat seinen festen Platz, beißt einmal zu und kehrt sofort zurück, wie bei Piranhas.
- **Rangordnung** 1 bis 6 nach Zeit im Schwarm, ohne Rangkämpfe. Rang 1 führt.
- **Die Raserei:** Die Weibchen beißen die Männchen (nur Bite, keine Blutung). Wer unter 50 % fällt, ist raus. Sie endet, sobald nicht mehr Männchen übrig sind als Weibchen balzen. Damit gibt es keinen extremen Männchenüberschuss: Es scheiden nur so viele aus, wie zu viele da sind.
- **Farb-Dimorphismus:** Der Mod hat keine Unterarten, nur 10 Skins. Weibchen tragen dunkle Farben, Männchen helle.
- **Bleibt:** Drei Versuche je Gruppe (danach 15 Minuten Ruhe). Ein Kai bei seiner Bale ist für den Versuch sicher. Krokodile nur im offenen Wasser, 3 Körperlängen vom Ufer.
- **Widerspruch:** Der Kai-Entwurf lässt die Kälber „in full daylight“ ziehen, weil die Dämmerung dem Xiph gehört. Mit Cathemeral ist das nur noch eine kluge Gewohnheit, kein Schutz.
- **Beobachten:** 6 Xiph können ein Ziel mit Flash 30 s am Stück bremsen, genau so lange, wie ein Kai für den Rückweg zu seiner Bale hat. Begrenzt ist das nicht, weil die Beute keinen Regelschutz bekommt.

### Leedsichthys in der Kai-Gruppe (entschieden 03.11.)

- Ein Leeds darf mit Kai und Eurhinosaurus gruppieren: 1 Leeds plus die Bale mit bis zu 16 Kai und Eurhino zusammen. Seine eigenen Jungen darf er mitbringen.
- **Name** (entschieden am 04.11.): Eine Gruppe, mit der ein Leeds zieht, heißt **Flotilla**. Die Kai-Gruppe bleibt eine Bale, auch wenn Eurhinos mitschwimmen. Die reine Eurhino-Gruppe bleibt eine Shoal.
- **Tropeognathus und die Flotilla** (entschieden am 04.11.): Tropes suchen eine Flotilla und fliegen mit, ohne zu stören. Gruppieren dürfen sie nicht. Kommt die Flotilla an eine Fischansammlung, bedienen sie sich selbst. Kai und Eurhino vertreiben sie dann, weil sie dieselben Fische wollen; der Leeds bleibt passiv, er frisst keinen Fisch. Ein vertriebener Trope muss aus dem Wasser und den nächsten ruhigen Moment abwarten. Wehren kann er sich im Wasser nicht (3.8). Entwurf: `tropeognathus.md`.
- **Niemand verteidigt den anderen.** Leeds verteidigt nur sich selbst und, wie bisher, seine eigenen Jungen. Kai und Eurhino verteidigen den Leeds nicht.
- **Kein Stufenschutz.** Die anfangs vorgeschlagene Pilotfisch-Regel (Begleiter zählen als Apex) ist gestrichen. Sie hätte Xiphactinus die Beute genommen und Kai und Eurhino vom Leeds abhängig gemacht.

**Widersprüche, die dabei auftauchen:**
1. **Looming Presence wäre ein heimlicher Schutz über Werte.** Alle nicht gruppierten Tiere bis CW 4250 im Umkreis von 50 m verlieren 25 % Armor. In den Kurven hat die Fähigkeit keine Abklingzeit, ist also sehr wahrscheinlich passiv.
   - In der Gruppe trifft das Xiphactinus (CW 2400), aber nicht die gruppierten Kai und Eurhino. Ein Kai tötet einen Xiph dann in 5 s statt 6 s.
   - Vorschlag: In einer gemischten Gruppe darf Leeds Looming Presence nicht ausrüsten. Vorbild ist Regel 8.1.1.
2. **Weitere Leeds-Fähigkeiten, die Gegner schwächen oder heranziehen**, darf er nur nutzen, wenn er selbst angegriffen wird. Laut Kurven sind das Resonant Call, Shattering Cry, Acoustic Debilitation, Undertow, Inhale und Crushing Pressure.
3. **Shoaling** ist ein Gruppen-Buff (+15 % Ausdauer-Regeneration). Laut Kurve ist er beim adulten Leeds auf 10 % abgeschwächt, also kaum spürbar. Das sollte man im Spiel prüfen.
4. **Leeds-Weibchen töten heute jedes Kai- und Eurhino-Junge.** Diese Regel fällt weg, weil Kai und Eurhino keine Leeds-Jungen mehr fressen.

**Was die Gruppe dann noch bringt:**
- Gemeinschaft und Rollenspiel.
- Deckung durch Bewegung: Kai und Eurhino dürfen sich hinter oder unter dem Leeds verstecken. Leeds selbst darf sich aber nicht gezielt in den Weg stellen.
- Ein Xiph-Rudel kontert das, indem es von zwei Seiten kommt.
- Der Vorteil ist klein und hängt vom Spielen ab. Abhängig vom Leeds werden Kai und Eurhino dadurch nicht.

## Stat-Vorschläge

| Art | Wert | Jetzt | Vorschlag | Warum |
| --- | --- | --- | --- | --- |
| Kaiwhekea | Health | 750 | **1000** | Para-Rolle: soll nicht sofort umfallen; CW bleibt 4000, damit Xiph nicht zu schwach wird |
| Livyatan | CW | 6000 | **8000** | zweiter Giant nach Argentinosaurus (9000) |
| Livyatan | Health | 950 | **2000** | soll Tylo und Sachi sicher schlagen, auch als Paar |
| Livyatan | Max. Sauerstoff | 100 (11:07) | **200 (22:13)** | Körpermasse: Wale speichern den Sauerstoff in Blut und Muskeln, je größer der Körper, desto mehr; entschieden am 04.11. |
| Livyatan | Schwimmen | 500 | 550 (optional) | einem gemütlichen Tylo folgen können |

Tylosaurus, Eurhinosaurus, Leedsichthys, Xiphactinus und Sachicasaurus bleiben unverändert. Die Prog-Buffs (Health 900, Armor 1,1, Heilung 1,5) entfallen mit dem Wechsel zum Sachi, der Health 900 und Armor 1,1 schon mitbringt.

### 1 gegen 1 mit den Vorschlägen (Sekunden bis zum Kill)

| Angreifer ↓ / Ziel → | Tylo | Kai | Eurhino | Leeds | Sachi | Xiph | Livy | Bilanz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tylo | – | 16 s | 7 s | 43 s | 21 s | 6 s | 68 s | 4–2 |
| Kai | 22 s | – | 8 s | 48 s | 24 s | 6 s | 77 s | 2–4 |
| Eurhino | 51 s | 41 s | – | 112 s | 55 s | 15 s | 179 s | 1–5 |
| Leeds | 31 s | 25 s | 11 s | – | 34 s | 9 s | 110 s | 5–1 |
| Sachi | 22 s | 18 s | 8 s | 49 s | – | 6 s | 78 s | 3–3 |
| Xiph | 56 s | 45 s | 20 s | 124 s | 61 s | – | 198 s | 0–6 |
| Livy | 18 s | 14 s | 6 s | 39 s | 19 s | 5 s | – | 6–0 |

Daraus ergibt sich diese Rangordnung: Livy (CW 8000, Health 2000) gewinnt jedes Duell, auch gegen Leeds. Leeds schlägt alle anderen, jagt aber nie. Danach kommen Tylo und Sachi, fast gleichauf (21 s gegen 22 s; zählt Ironclad, gewinnt Sachi). Kai verliert gegen Tylo, hält aber 16 s statt 12 s durch. Eurhino und Xiph überleben durch Tempo und Gruppe.

### Rudel gegen Einzeltier

So viele Raptoren braucht es, um ein allein stehendes Beutetier zu töten (ohne Blutung):

| Jäger gegen Beute | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- |
| Utahraptor gegen Para (Land) | verliert | verliert | verliert | gewinnt |
| Achillobator gegen Para (Land) | verliert | verliert | gewinnt | gewinnt |
| Xiphactinus gegen Kai heute (750 Health) | verliert | gewinnt | gewinnt | gewinnt |
| Xiphactinus gegen Kai neu (1000 Health) | verliert | verliert | gewinnt (13 s) | gewinnt |
| Xiphactinus gegen Eurhinosaurus | gewinnt (10 s) | gewinnt | gewinnt | gewinnt |

Mit der neuen Kai-Health liegt Xiphactinus auf dem Niveau der Land-Raptoren. Mit der zuerst vorgeschlagenen CW 4500 hätte er 17 s statt 13 s gebraucht.

## Nötige Regeländerungen

1. **Neue Einstufung „Piscivore“:** frisst nur Fisch, Krebse und Muscheln und jagt keine Spieler. Für Gruppen- und Mischgruppen-Regeln (8.1) zählt sie wie ein Herbivore.
2. **Leeds in der Kai-Gruppe:** 1 Leeds je Gruppe, keine Verteidigung in beide Richtungen, kein Stufenschutz. Looming Presence ist in gemischten Gruppen nicht erlaubt (Vorbild 8.1.1).
3. **Reviere im Wasser:** Sachi hält einen halben Ozean-POI, so wie Spino im Inland geteilte Reviere hat. Deino und Spino teilen sich die Reviere der Flussengen. Gezählt wird nur das Wasser.
4. **Lebensräume:** Ozeane für Sachi, Livy und Tylo. Flussengen für Xiph, Deino und Spino, Tylo zieht durch. Palm Islands ist die einzige Front zwischen Sachi und Deino oder Spino.
5. **Third Party für den Livy:** Ausnahme von 3.17 und 3.18 im Livy-Profil, gegen jeden Fleischfresser bei einer aktiven Jagd im Wasser, aber nur zum Schutz der Styracosterna (Parasaurolophus, Lambeosaurus, Barsboldia, Iguanodon, Lurdusaurus) und ihrer Herdenbegleiter (Bonapartenykus, Camptosaurus, Citipati, Struthiomimus, Halszkaraptor).

## Größtes Risiko: zu viele Jäger

Im Meer jagen heute schon Tylosaurus, Spinosaurus und Deinosuchus. Kai und Eurhino fliehen vor allen dreien. Mit Sachicasaurus, Livyatan und Xiphactinus wären es sechs Jäger auf drei Beute-Arten.

- An Land trägt sich das, weil der Para so beliebt ist und viele Spieler ihn wählen.
- Im Wasser muss die Beute-Seite zuerst funktionieren, sonst verhungern die neuen Jäger.

Wenn der Server nicht alles auf einmal nimmt, ist das meine Reihenfolge:
1. Kai, Eurhino und Leeds umbauen. Das kostet keinen Mod.
2. Livyatan dazu, weil er eine eigene Nische hat.
3. Xiphactinus dazu, weil die Beute-Seite einen schnellen Jäger braucht.
4. Sachicasaurus zuletzt, weil er sich mit Tylo am meisten überschneidet. Mit Primordial Tyrants läuft auf Dynasty aber schon ein Team, dem der Server vertraut, und der Kai-Griff gibt ihm eine eigene Nische.

## Offene Entscheidungen

- Kai als Para des Meeres und Eurhino als Fischfresser: einverstanden?
- Sollen Kai und Eurhino eine gemeinsame Mischgruppe bilden oder nur nebeneinander leben?
- ~~Revier des nächtlichen Revierhalters (damals Prognathodon): der Wasserteil eines Küsten-POIs oder ein ganzer POI wie beim Tyrannotitan?~~ Entschieden: ein halber Ozean-POI.
- ~~Prognathodon behalten oder ersetzen?~~ Entschieden am 04.11.: ersetzt durch Sachicasaurus.
- Sachicasaurus: Schwimmtempo und Wendigkeit aus den Mod-Dateien lesen, sobald der Mod heruntergeladen ist. Ob Ironclad die Armor erhöht, im Spiel prüfen.
- ~~Sarcosuchus braucht eine Zeile zu Xiph~~ Nicht nötig: Sein heutiges Profil erlaubt schon die Jagd bis Apex im Wasser und bevorzugt Beute, die er clampen kann.
- ~~Darf der Revierhalter (damals Prog) adulte Spino allein jagen?~~ Entschieden: ja, gilt jetzt für Sachi.
- ~~Sollen Xiph-Schwärme auch adulte Deino jagen dürfen?~~ Entschieden: ja, einen einzelnen ab 5 Tieren und mit großer Vorsicht; keine bevorzugte Beute.
- Big Tree Overlook: Liegt auf der Leeds-Route, ist aber ein Fluss. Gehört er zu den Flussengen (dann lebt dort auch Xiph und Deino) oder bleibt er Süßwasser?
- Livyatan: Hinterhalt-Jäger mit Tempo 750 oder etwas schneller?
- ~~Können Xiphactinus und Livyatan im Meer trinken?~~ Geklärt: Aquatics verlieren Durst nur an Land.
- ~~Gibt es auf der Karte tiefe Zonen?~~ Geklärt: **Abyssal Depths**, laut Karte „Deep eastern ocean“ mit Tiefsee und offenem Wasser. Dort lebt Livyatan.

## Orte auf der Karte (Riparia)

**Entschieden (03.11.):** Die Wasserwelt hat drei Zonen. Die Karte dazu steht im App-Tab (#/aquatic, „Lebensräume und Reviere“), die Daten in `profile-entwuerfe/lebensraum.json`.

- **Ozeane:** Kelp Vale, Coastal Bluffs, Abyssal Depths, Palm Islands, Stonebed Shoal. Kühles, offenes Wasser mit den wertvollsten Fischen.
- **Salzwasser-Flussengen:** die warmen Kanäle zwischen den Inseln, also Volcano Islands, Twisted Forest, Stillwater Bog, Mudflats und Coastland Swamp. Das sind genau die geteilten Reviere der Spino-Karte im Osten.
- **Süßwasser-Flüsse:** Big Tree Overlook, Tallbrush Coasts, Cliff Edge Falls und Redwood Wind. Von den Wasser-Jägern lebt dort nur Spino.

| Art | Zuhause | Weitere Orte |
| --- | --- | --- |
| Kaiwhekea | Route des Leedsichthys: Flussengen und Abstecher in Kelp Vale, Abyssal Depths, Palm Islands und Stonebed Shoal | Nester auf Palm Islands, Castaway Isle und Volcano Islands; nachts Ruhe in den Untiefen |
| Eurhinosaurus | dieselbe Route, oft in derselben Gruppe | Nistfluss wie bisher |
| Leedsichthys | Schleife durch die warmen Flussengen, zum Abkühlen in die Ozeane | Balzgründe wie bisher; schläft nachts bei seiner Gruppe |
| Xiphactinus | nur die Flussengen, nie der offene Ozean | Kinderstube in Coastland Swamp und Mudflats Venule; flieht vor Tylo, Deino und Sarco |
| Tylosaurus | unverändert: Ozeane und Flussengen | einziger Apex in beiden Zonen |
| Sachicasaurus | Kelp, Riffe, Untiefen und Strände der Ozeane: 8 halbe Reviere in Kelp Vale, Coastal Bluffs, Palm Islands und Stonebed Shoal | meidet Abyssal Depths; Palm ist die Front zu Deino und Spino; am Strand dieselben Beaching-Regeln wie Tylo |
| Livyatan | alle Ozeane außer Palm Islands, Zuhause Abyssal Depths | Nester an den Inseln von Coastal Bluffs und am Rand von Stonebed Shoal |
| Deinosuchus | nur Flussengen und Palm Islands, mit Spinos Revierkarte | auf Palm Revierkämpfe mit Sachi |
| Spinosaurus | Seen, Flüsse und Flussengen wie bisher; vom Meer nur Palm Islands | auf Palm Revierkämpfe mit Sachi |

**Was die Aufteilung bewirkt:**
- **Kai und Eurhino haben keinen sicheren Ort, nur bessere Zeiten.** In den Flussengen lauern Xiph, Deino und Spino, in den Ozeanen Tylo, nachts Sachi in Kelp und Untiefen und außer bei Palm Livy. Die Route selbst wird zum Spiel.
- **Xiph hat Fressfeinde** (entschieden am 03.11.): alles, was ihn clampen kann. Tylo (Tragkraft 3000), Deino (3900) und Sarco (3100) packen einen adulten Xiph mit CW 2400. Vor Tylo flieht er wie der Weiße Hai vor dem Orca. Krokodile jagen ihn mit Vergnügen und versuchen, ihn aus dem Wasser zu tragen. Sachi könnte ihn clampen (4001), trifft ihn aber nicht. Austroraptor packt Xiph-Junge bis Juvenile. Spino und Xiph ignorieren sich vollständig.
- **Krokodile jagen ist für Xiph ein gefährliches Vergnügen.** Einen einzelnen Sarco darf ein Schwarm ab 4 jagen: 4 gewinnen (10 s), verlieren aber 2 Tiere, 6 verlieren eines, 3 verlieren alles. Einen einzelnen adulten Deino ab 5 Tieren, als einzige Ausnahme von der Apex-Grenze (entschieden am 03.11.): 4 verlieren immer, 5 gewinnen in 21 s und verlieren 3, 6 gewinnen in 15 s und verlieren 2. Krokodile sind keine bevorzugte Beute und werden nur mit großer Vorsicht gejagt.
- **Palm Islands ist die Front.** Sachi, Deino und Spino kämpfen dort um Reviere, und Livy kommt nie hin. Für Sachi ist Palm damit das sicherste und zugleich härteste Revier.
- **Ein adulter Livy hat genau einen Jäger: Tylo-Paare** (entschieden am 03.11.). Sie dürfen ihn bei jedem Hunger jagen, aber erst, wenn keine Pflicht-Beute im POI ist. Sie verlieren das Bissduell und gewinnen nur durch Hit-and-Run, deshalb traut sich kaum ein Tylo an ihn heran. Tylo ist schneller (900 gegen 750), sprintet länger (3:42 gegen 2:47) und heilt schneller (2,0 gegen 1,5/s). Deinosuchus dürfte ihn als Giant ebenfalls jagen, lebt aber nicht mehr in Livys Ozeanen. Gebremst wird Livy außerdem durch die Solo-Jagd, sein geringes Tempo, das Flachwasser und Kai-Gruppen ab 3 Tieren.

**Sachi gegen Deino und Spino** (Mod-Werte, ohne Blutung und Knochenbruch):

| Kampf | Ergebnis |
| --- | --- |
| 1 Sachi gegen 1 Deino | verliert (21 s, Deino behält 29 %) |
| 2 Sachi gegen 1 Deino | gewinnt (15 s, beide überleben) |
| 1 Sachi gegen 1 Spino | verliert (13 s, Spino behält 61 %) |
| 2 Sachi gegen 1 Spino | gewinnt (20 s), ein Sachi stirbt |

Sachi jagt Deino und Spino gern, muss aber nicht. Er darf beide auch allein jagen (für den Prog entschieden am 03.11., übernommen). Im Bissduell verliert ein einzelner Sachi gegen beide, im Wasser ist er als voller Aquatic aber der Wendigere. Das kommt selten vor, weil sie nur Palm Islands teilen. Die Regel ist vorläufig, bis das Tempo des Sachi bekannt ist.
