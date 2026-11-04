# Ökosystem im Wasser: Bewertung der Ideen

Stand 2026-11-03. Diese Datei bewertet die Grundidee und schlägt Rollen, Profil-Änderungen und Werte vor.

**Entschieden (03.11.):** Kaiwhekea wird der Para des Meeres, Eurhinosaurus wird reiner Fischfresser. Alles andere ist noch Vorschlag. Die Profil-Entwürfe dazu liegen in `profile-entwuerfe/`. Zahlen kommen aus `werte.md`, Kill-Zeiten nach der Projekt-Formel: Schaden × (CW Angreifer ÷ CW Ziel) ÷ Armor.

**Wichtig zu allen Kampfzahlen (Hinweis vom 03.11.):** Die Simulationen sind reine Bissduelle. Wendigkeit und Skill fehlen. Aquatic-Kämpfe entscheidet aber fast immer die Wendigkeit: Ein einzelner Tylo macht einen Spino im Wasser fertig, obwohl er das Bissduell verliert, weil er einfach um ihn herumschwimmt. Die Zahlen zeigen deshalb nur, wer im Stillstand gewinnt. Regeln, die an einem knappen Bissduell hängen, sind vorläufig:
- **Prog gegen Spino:** „Allein chancenlos, deshalb nur zu zweit“ galt nur im Bissduell. Entschieden: Prog darf adulte Spino auch allein jagen.
- **Prog gegen Deino:** Das knappe Bissduell kippt im Wasser vermutlich zu Prog.
- **Prog gegen Tylo:** Hier gilt es umgekehrt, siehe die Tabelle unten. Der Health-Buff für Prog ist eher nötiger als gedacht.

**Tylo gegen Prog: wer ist stärker?** Die Bewegungswerte stammen direkt aus den Blueprints (Bewegungs-Bauteil), Ausdauer und Luft aus den Kurven.

| | Tylosaurus | Prognathodon | Vorteil |
| --- | --- | --- | --- |
| Schwimmen | 550 | 550 | gleich |
| Beschleunigung im Wasser | 1300 | 1300 | gleich |
| Sprint-Schwimmen | 900 | 820 | Tylo (+10 %) |
| Sprintdauer | 3:42 | 2:47, getaucht 2:05 | Tylo |
| Ausdauer-Regeneration/s | 0,9 | 0,7 | Tylo |
| Luft unter Wasser | 11:07 | 9:48 | Tylo |
| Übrige Bewegungsfelder | – | – | identisch; Prog ist im Bewegungs-Bauteil fast eine Kopie von Tylo, mit zwei zusätzlichen Feldern unbekannter Bedeutung |
| Wende-Traits | in den Kurven keine fürs Wasser | Streamlined, Hypocercal Fin (+15 % Beschleunigung), Ravenous Toxin | Prog, nur mit Traits |
| Bissduell (neue Werte) | verliert (Prog tötet in 19 s) | gewinnt | Prog |
| Bremsen und Fesseln | Bone Snap (Knochenbruch), Headbutt | Neuro Toxin Snap (Sprint-Ausdauer und Luft weg), Fin Tear (−5 % Tempo), Breaching Clamp | Prog |

- **Im offenen Wasser ist Tylo stärker.** Er hat dieselbe Grundwendigkeit, sprintet schneller und länger und braucht weniger Luft. Damit bestimmt er Abstand und Zeitpunkt. Einen Kampf, den er nicht will, kann er verlassen.
- **Prog gewinnt nur, wenn er den Kampf anfängt.** Erstschlag von unten, dann Neuro Toxin Snap gegen Tylos Sprint und Fin Tear gegen sein Tempo. Steht der Kampf erst, gewinnt Prog das Bissduell.
- **Das passt zum Entwurf:** Prog ist der nächtliche Lauerjäger, Tylo der offene Jäger. Ohne Health-Buff würde Prog beides verlieren, Bewegung und Bissduell.
- **Wendewerte:** Ein Feld für die Wendegeschwindigkeit lässt sich in den Blueprints nicht sicher benennen. Die Felder, die ich zuerst dafür hielt (30 bei Kai, 50 bei Tylo, 270 bei Spino), sind die Gehgeschwindigkeit an Land. Sicher vergleichbar sind nur Tempo, Beschleunigung, Sprintdauer und Luft, siehe die Tempo-Tabelle im Tab.
- **Xiph gegen Krokodile:** Die Mindestzahlen (Sarco ab 4, Deino ab 5) sind vorsichtig. Xiph ist der schnellste Schwimmer, im Wasser reichen vermutlich weniger. Als Vorsichtsregel passen sie trotzdem.

Harte Wendigkeitswerte gibt es weder in den Kurven noch sicher benennbar in den Blueprints. In den Kurven stehen nur Faktoren, fast alle 1, bei Xiph ein Wenderadius-Faktor von 1,3.

## Kurzfassung

- **Die Grundidee stimmt.** Im Wasser gibt es heute nur Fleischfresser. Alle vier Aquatics sind als „Carnivore“ eingestuft, eine Beute-Seite wie den Para gibt es dort nicht.
- **Para des Meeres:** Dafür passt **Kaiwhekea**. Eurhinosaurus kommt als schneller Wächter und Schwarmpartner dazu, beide fressen nur Fisch.
- **Jäger:**
  - Tylosaurus bleibt der Jäger an der Küste.
  - Prognathodon wird der nächtliche Revierhalter.
  - Livyatan jagt aus der Tiefe die großen Tiere.
  - Xiphactinus wird das Raptor-Profil.
- **Leedsichthys** bleibt der friedliche Riese. Er darf mit einer Kai-Gruppe gruppieren (1 Leeds je Gruppe). Verteidigt wird nicht, weder von ihm noch für ihn.
- **Ohne einzelne Wertänderungen klappt es nicht.** Kai fällt heute zu schnell um. Livyatan schlägt Tylosaurus nur knapp, Prognathodon ist für einen Revierhalter zu zerbrechlich.
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
| Nächtlicher Revierhalter | Prognathodon | Jaguar, Riesenzackenbarsch | nur Ozeane, halbe Reviere |
| Apex der Apexe | Livyatan | Pottwal mit Orca-Jagdweise | alle Ozeane außer Palm Islands |

### Wer wen im offenen Wasser einholt

Sprint-Schwimmen: Xiph 1200 › Eurhino 1050 › Kai 990 › Tylo 900 › Prog 820 › Livy 750 › Leeds 600.

- **Xiphactinus** holt jeden ein. Damit ist er der natürliche Jäger der schnellen Beute, wie der Gepard bei der Gazelle.
- **Kai und Eurhino** entkommen allen drei Apexen auf freier Strecke. Die Apexe müssen also lauern, und genau das gibt ihre Ausstattung her.
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
- Bale bis 12 Sub/Adults, Mischgruppen mit Eurhinosaurus.
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
- **Prognathodon:** Adulte Prog jagt Tylo nur bei Hunger ≤ 35 %, wie Spino und Deino. Revier-Herausforderungen nimmt er an: Verliert er, muss er gehen (6.7.2). Gewinnt er, muss der Prog ihn 15 min dulden (6.7.3.1).
- **Xiphactinus:** Tylo darf ihn jagen, wenn er allein oder in Gruppen bis 3 ist. Gegen 6 Xiph verliert ein einzelner Tylo.
- Entwurf: `profile-entwuerfe/tylosaurus.md`.

### Prognathodon als nächtlicher Revierhalter („Tyrannotitan der Meere“)

**Passt gut:**
- Die Struktur des Tyrannotitan lässt sich übernehmen: Männchen halten das Revier, oft als Bruderpaar (sett). Weibchen sind nomadisch und nisten im Revier eines Männchens. Aktiv ist er nachts.
- Seine Ausstattung passt zum Lauerjäger: Ambusher-Trait, Toxic Lunge, Breaching Clamp aus dem Sprung, Gift. Shell Crusher Song (Armor −15 %) passt zum echten Prognathodon, dessen massive Zähne für harte Beute wie Schildkröten gebaut waren.
- Er hat den schlechtesten Sauerstoff (9:48). Das spricht für Flachwasser und Riffe und trennt ihn sauber von Livyatan in der Tiefe.

**Widersprüche:**
1. **Für einen Revierhalter ist er zu zerbrechlich.** Er hat nur 700 Health bei CW 5700 und heilt am langsamsten (0,83/s). Ein Revier zu halten heißt aber, immer wieder zu kämpfen. → Health 900, Armor 1,1, Heilung 1,5, also die Werte des Tyrannotitan. Dann schlägt er Tylo im Duell (18 s gegen 22 s), verliert aber gegen Livyatan.
2. **Die Regeln kennen kein „mittleres“ Revier.** Para beansprucht kleine Reviere am Nest, Tyrannotitan einen ganzen POI.
   - Entschieden (03.11.): Das Revier ist ein halber Ozean-POI, so wie Spino im Inland geteilte Reviere hat. Es gibt acht, in Kelp Vale, Coastal Bluffs, Palm Islands und Stonebed Shoal.
   - Landtiere im selben POI bleiben davon unberührt.
3. **Lauerjäger oder Brutalo:** Tyrannotitan ist laut und brutal, Prognathodons Ausstattung ist die eines Lauerjägers. Mein Vorschlag: Er ist still, bis er herausfordert. Gerufen wird nur nach Regel 6.7.

**Im Entwurf (`profile-entwuerfe/prognathodon.md`) festgelegt:**
- Prog lebt nur in den Ozeanen. Männchen halten allein oder als Bruderpaar (brace) einen halben Ozean-POI. Weibchen ziehen allein oder als Paar (drift) umher.
- Herausgefordert werden Tylo, fremde Prog-Männchen und auf Palm Islands auch Deino und Spino. Er jagt Deino und Spino gern, muss aber nicht; adulte Spino nur zu zweit. Xiph begegnet er kaum, denn der lebt nur in den Flussengen. Vor Livy flieht er.
- Tagsüber ziehen Kai-Gruppen unbehelligt durch sein Revier, nachts entscheidet ihr Ruheplatz.
- Kai fliehen vor Apexen auf Sicht. Die Nachtwache schlägt also Alarm, statt zu kämpfen. Er muss mit dem ersten Biss den Sprint der Beute nehmen (Neuro Toxin Snap), sonst entkommt sie.
- Nur am Nest stellen sich Kai, und 2 Eltern schlagen einen einzelnen Prog.

### Livyatan als Jäger aus der Tiefe

**So funktioniert Echolocation:**
- Ein Emote zeigt 5 Sekunden lang Ziele im Umkreis von 150 m. Danach folgen 30 Sekunden Abklingzeit.
- Dazu kommen zwei Stimm-Fähigkeiten:
  - **Dreadful Clicking:** −15 % Tempo und Armor beim nächsten Tier im Umkreis von 60 m, 15 s lang. Nur außerhalb des Kampfes nutzbar.
  - **Concussive Blast:** −25 % Tempo und −50 % Beschleunigung für alle im Umkreis von 30 m, 10 s lang.

**Passt gut:** Die Ausstattung ist genau deine Idee.
- Er findet das Ziel per Echo und nähert sich ungesehen von unten.
- Ab 60 m bremst er es, ab 30 m lähmt er es. Unter Concussive Blast sinkt Tylo von 900 auf 675, Prog von 820 auf 615.
- Pressurized Hide (+50 % Sauerstoff, ~16:40) macht ihn zum Tieftaucher.
- Für die Sozialstruktur gibt es Fähigkeiten für die Gruppe (Leviathan's Call, Pod Migration) und für Einzelgänger (Solo Singer). Das passt zum Pottwal: Weibchen in kleinen Gruppen, Bullen allein.

**Widersprüche:**
1. **Er ist der langsamste Apex.** Auf freier Strecke holt er weder Tylo noch Prog ein. Das ist in Ordnung, solange er nur aus dem Hinterhalt jagt; das sollte das Profil so festschreiben. Optional: Schwimmen 500 → 550, damit er einem gemütlich schwimmenden Tylo überhaupt folgen kann.
2. **Er gewinnt gegen Tylo nur knapp** (23 s gegen 24 s). Für den „Apex der Apexe“ ist das zu wenig. → **Entschieden (03.11.): CW 6000 → 8000, Health 950 → 2000.** Dann schlägt er einzelne Tylo, Prog und Leeds klar und auch Paare von Tylo und Prog. Nur Kai-Gruppen ab 3 Tieren schlagen ihn noch.
3. **Die Tiefsee ist kreative Freiheit.** Die Fossilien stammen aus einem Küstenmeer in Peru. Belegt ist dagegen, dass er die größte Beute seiner Zeit jagte, nämlich Bartenwale. Deshalb sollte Leeds, als Pendant zu den Bartenwalen, seine Hauptbeute sein, Tylo und Prog kommen danach.
4. **Regel 3.18:** Aquatics dürfen sich nicht in Kämpfe anderer Aquatics einmischen. Er räumt also nur Apexe ab, die gerade nicht selbst jagen. **Ausnahme (entschieden am 04.11.):** Jagt ein Räuber einen seiner Schützlinge (Styracosterna und ihre Herdenbegleiter), darf der Livy im offenen Wasser eingreifen. Gemeint sind Räuber, die er selbst jagen darf, etwa ein Tylo, der sie jagt, oder ein Tyrannotitan, der ihnen hinterherschwimmt. Sonst darf er nie third-partyen, Körper anderer Räuber gibt es nur über einen Body Contest. Den Körper eines toten Schützlings ficht er nicht an, denn er frisst nie davon.

**Im Entwurf (`profile-entwuerfe/livyatan.md`) festgelegt:**
- **Stufe Giant** (entschieden am 03.11.), wie Argentinosaurus. Prog darf nur bis Apex jagen und sich gegen einen adulten Livy nur wehren. **Tylo-Paare dürfen ihn jagen** (entschieden am 03.11.), bei jedem Hunger; das ist die einzige Ausnahme von der Apex-Grenze. Adoleszente Livys zählen als Apex.
- Höchstens 2 Weibchen, die sich mit demselben Bullen gepaart haben (oder nur eine von beiden), Bullen immer allein (entschieden am 03.11.). Große Gruppen würden den stillen Jäger verraten. Er lebt in allen Ozeanen außer Palm Islands. **Gejagt wird nur allein** (entschieden am 03.11.), wie bei echten Pottwalen, die in Familien leben, aber einzeln in die Tiefe tauchen. Leviathan's Call dient nur der Verteidigung der Kälber.
- Einzelne Leeds, Tylo und Prog müssen zuerst gejagt werden. Paare von Tylo und Prog darf er auch jagen. Kai und Eurhino sind erst ab 35 % Hunger oder ohne große Beute erlaubt.
- Er kommt nicht ins Flachwasser, außer zum Nisten an den Inseln von Coastal Bluffs und am Rand von Stonebed Shoal.
- Simulation mit CW 8000 und Health 2000 (% = Health, die dem Livy bleibt):
  - Livy schlägt einen einzelnen Tylo (18 s, 74 %) und einen einzelnen Prog (20 s, 69 %).
  - Einen Leeds schlägt er klar: 39 s mit 65 %, wenn der Leeds 1000 Health hat, 78 s mit 29 % bei 2000. Der Dynasty-Wert des Leeds ist unbekannt.
  - Ein Tylo-Paar schlägt er in 35 s (22 %), ein Prog-Paar knapp in 40 s (7 %). Mit Sonic Disruption bleiben ihm 38 % bzw. 26 %.
- Gegen eine Kai-Gruppe mit 3 Verteidigern verliert ein einzelner Livy in 26 s. Genau so steht auch ein einzelner T-Rex gegen 3 Paras da. Deshalb müssen Kai wie der Para vor Apexen fliehen, statt sich zu stellen.

**Folge für Tylosaurus und Prognathodon:** Ein einzelner Tylo flieht vor Livy, ein Tylo-Paar darf ihn jagen. Prog flieht, allein und als Paar; ein Prog-Paar darf sich wehren, verliert aber knapp. Das steht so in `profile-entwuerfe/tylosaurus.md` und `profile-entwuerfe/prognathodon.md`.

**Rivalen der Tiefe: Livy und Leeds** (entschieden am 04.11.):
- Der Leeds flieht nie vor dem Livy. Fliehen brächte nichts, denn der Livy ist schneller (750 gegen 600), und in der Tiefe gibt es kein Versteck. Vorbild sind Buckelwale, die auf jagende Orcas losgehen.
- Er zieht jeden Kampf in die Tiefe, wo er nie Luft holen muss. Ohne Junge ist er aggressiv (duldet keinen Livy im Umkreis von 5 Körperlängen, respektiert dessen Forfeit), als Vater mit Jungen headstrong (greift auch nach einem Forfeit oder während der Livy Luft holt weiter an, bis der Livy den POI oder die Sichtweite verlässt). Das gilt nur gegenüber dem Livy.
- **Luft-Regel für den Livy:** Unter 25 % Sauerstoff muss er abbrechen und auftauchen; das zählt als Forfeit. Im Bissduell gewinnt der Livy klar, der Kampf wird aber ein Rennen gegen die eigene Luft, wie beim Pottwal gegen den Riesenkalmar. Die 25 % müssen im Spiel getestet werden.

### Xiphactinus als Raptor

**Passt gut:**
- Er ist der schnellste Schwimmer im Spiel.
- Seine Ausstattung ist die eines Raptors: Blutung (Tearing Bite, Chomp), Armor −15 %, Flash blendet und bremst um 25 %. Agility Mentality ist ein Gruppen-Buff, Sanguine Hunger bringt +20 % Schaden.
- Als Einzelner verliert er jedes Duell. Das ist auch beim Utahraptor gegen den Para so.
- Schwarm (battery) bis 6 Tiere, alle dürfen jagen. Laut Simulation schlagen 4 Xiphactinus einen allein stehenden Kai mit den neuen Werten, 3 schaffen es nicht. Gegen einen Kai mit 2 Verteidigern verlieren selbst 6. Erfolg hat ein Schwarm also nur, wenn er ein Tier von der Gruppe trennt. Entwurf: `profile-entwuerfe/xiphactinus.md`.
- Statt Kai und Eurhino jagt er künftig die Leeds-Jungen.

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

### Leedsichthys in der Kai-Gruppe (entschieden 03.11.)

- Ein Leeds darf mit Kai und Eurhinosaurus gruppieren: 1 Leeds plus die Bale mit bis zu 12 Kai und Eurhino zusammen. Seine eigenen Jungen darf er mitbringen.
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
| Prognathodon | Health | 700 | **900** | Revier halten heißt wiederholt kämpfen |
| Prognathodon | Armor | 1 | **1,1** | wie Tyrannotitan |
| Prognathodon | Heilung/s | 0,83 | **1,5** | wie Tyrannotitan |
| Livyatan | CW | 6000 | **8000** | zweiter Giant nach Argentinosaurus (9000) |
| Livyatan | Health | 950 | **2000** | soll Tylo und Prog sicher schlagen, auch als Paar |
| Livyatan | Schwimmen | 500 | 550 (optional) | einem gemütlichen Tylo folgen können |

Tylosaurus, Eurhinosaurus, Leedsichthys und Xiphactinus bleiben unverändert.

### 1 gegen 1 mit den Vorschlägen (Sekunden bis zum Kill)

| Angreifer ↓ / Ziel → | Tylo | Kai | Eurhino | Leeds | Prog | Xiph | Livy | Bilanz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tylo | – | 16 s | 7 s | 43 s | 22 s | 6 s | 68 s | 3–3 |
| Kai | 22 s | – | 8 s | 48 s | 25 s | 6 s | 77 s | 2–4 |
| Eurhino | 51 s | 41 s | – | 112 s | 57 s | 15 s | 179 s | 1–5 |
| Leeds | 31 s | 25 s | 11 s | – | 35 s | 9 s | 110 s | 5–1 |
| Prog | 18 s | 15 s | 7 s | 40 s | – | 5 s | 64 s | 4–2 |
| Xiph | 56 s | 45 s | 20 s | 124 s | 63 s | – | 198 s | 0–6 |
| Livy | 18 s | 14 s | 6 s | 39 s | 20 s | 5 s | – | 6–0 |

Daraus ergibt sich diese Rangordnung: Livy (CW 8000, Health 2000) gewinnt jedes Duell, auch gegen Leeds. Leeds schlägt alle anderen, jagt aber nie. Danach kommen Prog und Tylo. Kai verliert gegen Tylo, hält aber 16 s statt 12 s durch. Eurhino und Xiph überleben durch Tempo und Gruppe.

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
3. **Reviere im Wasser:** Prog hält einen halben Ozean-POI, so wie Spino im Inland geteilte Reviere hat. Deino und Spino teilen sich die Reviere der Flussengen. Gezählt wird nur das Wasser.
4. **Lebensräume:** Ozeane für Prog, Livy und Tylo. Flussengen für Xiph, Deino und Spino, Tylo zieht durch. Palm Islands ist die einzige Front zwischen Prog und Deino oder Spino.
5. **Third Party für den Livy:** Ausnahme von 3.17 und 3.18 im Livy-Profil, nur gegen Räuber, die er selbst jagen darf, und nur zum Schutz der Styracosterna (Parasaurolophus, Lambeosaurus, Barsboldia, Iguanodon, Lurdusaurus) und ihrer Herdenbegleiter (Bonapartenykus, Camptosaurus, Citipati, Struthiomimus, Halszkaraptor).

## Größtes Risiko: zu viele Jäger

Im Meer jagen heute schon Tylosaurus, Spinosaurus und Deinosuchus. Kai und Eurhino fliehen vor allen dreien. Mit Prognathodon, Livyatan und Xiphactinus wären es sechs Jäger auf drei Beute-Arten.

- An Land trägt sich das, weil der Para so beliebt ist und viele Spieler ihn wählen.
- Im Wasser muss die Beute-Seite zuerst funktionieren, sonst verhungern die neuen Jäger.

Wenn der Server nicht alles auf einmal nimmt, ist das meine Reihenfolge:
1. Kai, Eurhino und Leeds umbauen. Das kostet keinen Mod.
2. Livyatan dazu, weil er eine eigene Nische hat.
3. Xiphactinus dazu, weil die Beute-Seite einen schnellen Jäger braucht.
4. Prognathodon zuletzt, weil er sich mit Tylo am meisten überschneidet.

## Offene Entscheidungen

- Kai als Para des Meeres und Eurhino als Fischfresser: einverstanden?
- Sollen Kai und Eurhino eine gemeinsame Mischgruppe bilden oder nur nebeneinander leben?
- ~~Revier des Prognathodon: der Wasserteil eines Küsten-POIs oder ein ganzer POI wie beim Tyrannotitan?~~ Entschieden: ein halber Ozean-POI.
- ~~Sarcosuchus braucht eine Zeile zu Xiph~~ Nicht nötig: Sein heutiges Profil erlaubt schon die Jagd bis Apex im Wasser und bevorzugt Beute, die er clampen kann.
- ~~Darf Prog adulte Spino allein jagen?~~ Entschieden: ja.
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
| Prognathodon | nur Ozeane: 8 halbe Reviere in Kelp Vale, Coastal Bluffs, Palm Islands und Stonebed Shoal | Abyssal Depths ohne Reviere; Palm ist die Front zu Deino und Spino; am Strand dieselben Beaching-Regeln wie Tylo |
| Livyatan | alle Ozeane außer Palm Islands, Zuhause Abyssal Depths | Nester an den Inseln von Coastal Bluffs und am Rand von Stonebed Shoal |
| Deinosuchus | nur Flussengen und Palm Islands, mit Spinos Revierkarte | auf Palm Revierkämpfe mit Prog |
| Spinosaurus | Seen, Flüsse und Flussengen wie bisher; vom Meer nur Palm Islands | auf Palm Revierkämpfe mit Prog |

**Was die Aufteilung bewirkt:**
- **Kai und Eurhino haben keinen sicheren Ort, nur bessere Zeiten.** In den Flussengen lauern Xiph, Deino und Spino, in den Ozeanen Tylo, nachts Prog und außer bei Palm Livy. Die Route selbst wird zum Spiel.
- **Xiph hat Fressfeinde** (entschieden am 03.11.): alles, was ihn clampen kann. Tylo (Tragkraft 3000), Deino (3900) und Sarco (3100) packen einen adulten Xiph mit CW 2400. Vor Tylo flieht er wie der Weiße Hai vor dem Orca. Krokodile jagen ihn mit Vergnügen und versuchen, ihn aus dem Wasser zu tragen. Prog könnte ihn clampen (2500), trifft ihn aber nicht. Austroraptor packt Xiph-Junge bis Juvenile. Spino und Xiph ignorieren sich vollständig.
- **Krokodile jagen ist für Xiph ein gefährliches Vergnügen.** Einen einzelnen Sarco darf ein Schwarm ab 4 jagen: 4 gewinnen (10 s), verlieren aber 2 Tiere, 6 verlieren eines, 3 verlieren alles. Einen einzelnen adulten Deino ab 5 Tieren, als einzige Ausnahme von der Apex-Grenze (entschieden am 03.11.): 4 verlieren immer, 5 gewinnen in 21 s und verlieren 3, 6 gewinnen in 15 s und verlieren 2. Krokodile sind keine bevorzugte Beute und werden nur mit großer Vorsicht gejagt.
- **Palm Islands ist die Front.** Prog, Deino und Spino kämpfen dort um Reviere, und Livy kommt nie hin. Für Prog ist Palm damit das sicherste und zugleich härteste Revier.
- **Ein adulter Livy hat genau einen Jäger: Tylo-Paare** (entschieden am 03.11.). Sie dürfen ihn bei jedem Hunger jagen, aber erst, wenn keine Pflicht-Beute im POI ist. Sie verlieren das Bissduell und gewinnen nur durch Hit-and-Run, deshalb traut sich kaum ein Tylo an ihn heran. Tylo ist schneller (900 gegen 750), sprintet länger (3:42 gegen 2:47) und heilt schneller (2,0 gegen 1,5/s). Deinosuchus dürfte ihn als Giant ebenfalls jagen, lebt aber nicht mehr in Livys Ozeanen. Gebremst wird Livy außerdem durch die Solo-Jagd, sein geringes Tempo, das Flachwasser und Kai-Gruppen ab 3 Tieren.

**Prog gegen Deino und Spino** (neue Werte, ohne Blutung):

| Kampf | Ohne Shell Crusher Song | Mit Song (Armor −15 %) |
| --- | --- | --- |
| 1 Prog gegen 1 Deino | verliert knapp (22 s, Deino behält 10 %) | gewinnt knapp (21 s, Prog behält 4 %) |
| 2 Prog gegen 1 Deino | gewinnt (12 s) | gewinnt (11 s) |
| 1 Prog gegen 1 Spino | verliert (13 s, Spino behält 51 %) | verliert (13 s, Spino behält 43 %) |
| 2 Prog gegen 1 Spino | gewinnt (14 s), ein Prog stirbt | gewinnt (12 s), beide überleben |

Prog jagt Deino und Spino gern, muss aber nicht. Er darf beide auch allein jagen (entschieden am 03.11.). Im Bissduell verliert ein einzelner Prog gegen Spino klar, im Wasser ist er als voller Aquatic aber der Wendigere. Das kommt selten vor, weil beide nur Palm Islands teilen.
