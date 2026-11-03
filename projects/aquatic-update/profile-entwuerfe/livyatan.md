# Entwurf: Livyatan als Jäger aus der Tiefe

Neues Profil für den Mod `ArazoaLivy` (`UGC_M_YNRE311081_SK`). Dynasty hat dafür noch kein Profil. Der Text unten ist auf Englisch, wie zur Einreichung.

**Idee:** Ein Raubwal, der aus der Tiefe kommt und sich um die Großen kümmert: Leedsichthys, Tylosaurus und Prognathodon. Vorbilder sind der Pottwal (Tiefe, Echolot, Weibchen-Gruppen, einsame Bullen) und der Orca, der Großwale und Weiße Haie jagt.

**Seine Werkzeuge** (aus der Mod-Beschreibung):

| Fähigkeit | Wirkung |
| --- | --- |
| Echolocation (Emote) | zeigt 5 s lang Ziele im Umkreis von 150 m, danach 30 s Abklingzeit |
| Dreadful Clicking | nächstes Tier im Umkreis von 60 m: −15 % Tempo und Armor für 15 s; nur außerhalb des Kampfes |
| Concussive Blast | alle im Umkreis von 30 m: −25 % Tempo, −50 % Beschleunigung für 10 s |
| Sonic Disruption | nicht gruppierte Tiere im Umkreis von 30 m: −20 % Schaden, keine Ausdauer-Regeneration für 15 s |
| Leviathan's Call | +15 % Schaden für gruppierte Wale im Umkreis von 30 m, 30 s, bis 3× stapelbar; nur zur Verteidigung der Kälber |
| Piercing Bite | 110 Schaden, Blutung, Gegner macht 10 s lang 10 % weniger Schaden |
| Pressurized Hide | +50 % Sauerstoff (~16:40 unter Wasser), +7,5 % Tempo und Wenden, etwas weniger Armor |
| Solo Singer | ohne Gruppe: 20 % kürzere Abklingzeit der Stimm-Fähigkeiten, +15 % Ausdauer-Regeneration |

So ergibt sich die Jagd:
1. Per Echo das Ziel finden.
2. Unentdeckt von unten nähern.
3. Bei 60 m bremsen (Dreadful Clicking).
4. Bei 30 m lähmen (Concussive Blast).
5. Zubeißen.

Unter Concussive Blast fällt Tylo von 900 auf 675 und Prog von 820 auf 615. Livyatan selbst sprintet mit 750.

**Kampfwerte mit CW 8000 und Health 2000** (Simulation, ohne Blutung; % = Health, die dem Sieger bleibt):

| Kampf | Ergebnis |
| --- | --- |
| 1 Livy gegen 1 Tylo | Livy gewinnt (18 s, 74 %) |
| 1 Livy gegen 1 Prog (Health 900, Armor 1,1) | Livy gewinnt (20 s, 69 %) |
| 1 Livy gegen 1 Leeds (Health 1000) | Livy gewinnt (39 s, 65 %) |
| 1 Livy gegen 1 Leeds (Health 2000) | Livy gewinnt (78 s, 29 %) |
| 1 Livy gegen 2 Tylo | Livy gewinnt (35 s, 22 %); mit Sonic Disruption 38 % |
| 1 Livy gegen 2 Prog | Livy gewinnt knapp (40 s, 7 %); mit Sonic Disruption 26 % |
| 1 Livy gegen 6 Xiph | Livy gewinnt (31 s, 46 %) |
| 1 Livy gegen 3 Kai | Livy verliert (26 s, die Kai behalten 52 %) |

Der Dynasty-Wert für die Health des Leeds ist unbekannt („Boosted health“), deshalb stehen zwei Annahmen in der Tabelle.

**Entscheidungen im Entwurf:**
- **Stufe Giant** (entschieden am 03.11.), wie bisher nur Argentinosaurus.
  - Tylo und Prog dürfen nur bis Apex jagen, einen adulten Livy also nicht. Sie dürfen sich nur wehren.
  - Jagen dürfte ihn nur, wer „jede Stufe“ jagen darf. Im Wasser wäre das Deinosuchus, der aber nur noch in den Flussengen und auf Palm lebt, wo Livy nie hinkommt. Ein adulter Livy hat damit keinen Jäger, nur Gegner, die sich wehren.
  - Adoleszente Livys zählen eine Stufe tiefer, also als Apex, und bleiben für Tylo und Prog jagbar.
- **Lebensraum** (entschieden am 03.11.): alle Ozeane außer Palm Islands, also Kelp Vale, Coastal Bluffs, Abyssal Depths und Stonebed Shoal. Zuhause ist Abyssal Depths. Palm ist zu flach für einen Jäger der Tiefe, und so bleibt Palm das eine Meer, in dem Prog vor ihm sicher ist.
- **Gruppe** (entschieden am 03.11.): höchstens 2 Weibchen, die sich mit demselben Bullen gepaart haben. Hat sich nur eine von beiden mit ihm gepaart, ist das auch in Ordnung, etwa bei Mutter und Tochter. Bullen bleiben immer allein. Große Gruppen würden den Livy verraten, denn er jagt durch Stille und Überraschung.
- **Livyatan jagt nur allein** (entschieden am 03.11.). Das passt zum Vorbild: Pottwale leben in Familien, tauchen und jagen in der Tiefe aber jeder für sich.
  - Leviathan's Call nutzt die Familie nur zur Verteidigung der Kälber.
  - Paare von Tylo und Prog sind vor ihm nicht mehr sicher: Er schlägt ein Tylo-Paar (35 s, mit 22 % Health) und knapp auch ein Prog-Paar (40 s, mit 7 %). Er darf beide jagen, zieht aber Einzeltiere vor.
  - Gefährlich bleiben ihm nur Kai-Gruppen ab 3 Tieren, die sich stellen. Kai fliehen aber vor Giants auf Sicht.
- **Leeds ist seine Hauptbeute, und der Livy ist ihm klar überlegen** (39 s mit 65 % Health bei einem Leeds mit 1000 Health, 78 s mit 29 % bei 2000). Den Leeds rettet nicht der Kampf, sondern das Flachwasser, in das der Livy ihm nicht folgt.
- **Beutepflicht für die Großen:** Einzelne Leeds, Tylo und Prog müssen zuerst gejagt werden, wenn sie im POI sind. Kai und Eurhino sind erst ab großem Hunger oder ohne große Beute dran. Das schützt die Beute-Seite durch eine Regel über das Verhalten, nicht durch Werte.
- **Meidet Flachwasser:** Livyatan kommt nicht in die Untiefen, nur zum Nisten an die geschützten Inseln von Coastal Bluffs und an den Rand von Stonebed Shoal. Die Untiefen bleiben so ein Rückzugsort vor ihm, nicht aber vor Tylo, Prog oder Xiph.
- **Werte** (entschieden am 03.11.): CW 6000 → 8000, Health 950 → 2000. Armor (1,1) und Tempo bleiben wie im Mod. Er liegt damit zwischen Leeds (CW 5500) und Argentinosaurus (CW 9000, Health 2500), dem einzigen anderen Giant. Schwimmen 500 bleibt, er ist ein Hinterhalt-Jäger. Optional 550, falls er gemütlich schwimmenden Tylos gar nicht folgen kann.

**Realismus:** Die Tiefsee ist kreative Freiheit, denn die Fossilien stammen aus einem Küstenmeer in Peru. Belegt sind die riesigen Zähne in beiden Kiefern, und dass er große Beute jagte, vermutlich Bartenwale. Leeds als Hauptbeute ist deshalb die realistischste Beziehung im ganzen Ökosystem.

---

Livyatan melvillei was a giant raptorial sperm whale of the Miocene, around 9 million years ago, found in what is now Peru. Reaching an estimated 13 to 17 meters, it carried the largest biting teeth of any known animal, in both upper and lower jaws. Unlike modern sperm whales, which suck in squid, Livyatan seized and tore apart large prey, most likely medium-sized baleen whales. Its name honours Herman Melville, author of Moby-Dick.

Profile inspired by sperm whales, orcas and Livyatan paleobiology.

## Overview

**Giant Cathemeral Aquatic Carnivore**

- Livyatan cows live in small units of two. Bulls are always solitary and form temporary bonds with cows during courtship.
- Livyatan are nomadic within the open oceans: Kelp Vale, Coastal Bluffs, the Abyssal Depths and Stonebed Shoal, centred on the Abyssal Depths.
- Livyatan never enter Palm Islands. Their shallow waters are no place for a hunter of the deep.
- Livyatan have a tolerant nature towards other Livyatan, and an aggressive nature towards large aquatic predators.
- Livyatan are not scavengers.
- Livyatan tolerate albino and melanistic individuals.

## Genetics

Skins that are considered mutations for Livyatan include: Albino, Melanistic.
Players must roll in genetics-rolls to use these skins in game. This is one roll per species, per character.

## Group Limits (In-Game Group)

- **Unit:** Up to 2 Sub/Adult cows that have mated with the same bull, with unlimited offspring and adoptees. A unit in which only one of the two cows has mated with that bull is allowed as well, such as a mother and her daughter.
- **Bulls:** Bulls are always solitary. They never group, not even with a unit during courtship.
- **Why so small:** Larger groups give a Livyatan away. A hunter that relies on silence and surprise cannot travel in a loud family.

## Engagement Limits (Defence & Hunts)

- Livyatan always hunt alone. Only one Sub/Adult Livyatan may take part in a hunt, and members of its unit do not join or assist.
- All members of a unit may defend their calves.
- Livyatan may hunt up to Apex tier.
- **Giant tier:** As a Giant, an adult Livyatan cannot be hunted by species limited to Apex tier, such as Tylosaurus and Prognathodon. They may still defend themselves against it. Livyatan keep a wider distance from engagements they are not part of, as the server rules ask of Giant species.
- Livyatan only hunt in open and deep water. They do not follow prey into the shallows, and never attack creatures on land or within one body length of the shore.
- Adolescent Livyatan do not assist with hunts.

## Preferred Prey

- **Large prey first:** Livyatan must target solitary Leedsichthys, Tylosaurus and Prognathodon first, if they are present in the POI. Tylosaurus and Prognathodon pairs may be hunted as well.
- **Smaller prey:** Only when none of these are present, or at 35% hunger or below, may Livyatan hunt Kaiwhekea and Eurhinosaurus.
- **Leedsichthys:** Leedsichthys are Livyatan's main prey. A grown Livyatan overpowers an adult Leedsichthys, but the hunt is long, and the Leedsichthys will try to reach shallow water, where Livyatan do not follow.
- **Spinosaurus & Deinosuchus:** Both keep to the saltwater channels and Palm Islands, where Livyatan do not go. Adults that stray into open, deep water may be hunted.
- **Third-party:** Livyatan do not third-party engagements (3.18).

## Nesting Limits

- 🌧️ Rainy Season: 2 🥚 per 4 hours.
- ☀️ Dry Season: 1 🥚 per 4 hours.

Livyatan nest in sheltered, deeper water close to the islands of Coastal Bluffs, or at the edge of Stonebed Shoal. This is the only time units come close to the shallows.

## Physical Dimorphism

- ♀️ Cows are smaller and slimmer, with smooth heads.
- ♂️ Bulls are much larger and bulkier. Their heads are covered in scars from ramming contests.

Suitable subspecies and skins depend on the options the mod offers. Physical dimorphism is not mandatory, but individuals that differ from the typical dimorphism may face difficulties during courtship.

## Growing Up

### Offspring Behavior

- **Hatching:** Livyatan calves hatch near the islands and stay close to their mother's side.
- **First dives:** Calves cannot dive deep or hold their breath for long. While their mothers dive to hunt, the rest of the unit stays near the surface with the calves and guards them in turn, like sperm whale babysitters.
- **Juvenile:** At Juvenile, the unit leaves the islands and returns to open water. Calves begin to follow on short dives.
- **Learning:** Calves learn to click and listen by copying their mothers.
- **Leaving:** Young bulls leave at Sub-Adult and live alone from then on. A unit has room for only two cows, so a mother may keep one daughter with her. Other daughters leave to start a unit of their own.

### Orphaned Behavior

Orphaned calves call constantly, and search for any unit that answers. Units readily adopt orphans. Calves that find no unit stay close to islands and reefs, where they can surface safely, until they are large enough to venture into deep water.

## General Behavior

- **Hunting by sound:** Livyatan hunt by sound. In the darkness of deep water they send out clicks and listen to the echoes, which tell them where prey is long before they can see it.
- **Diving:** They spend much of their time deep below, and rise to the surface to breathe in long, slow rolls.
- **Pressurized Hide:** Individuals that wear Pressurized Hide can stay down far longer than any other aquatic.
- **Pace:** Livyatan are not fast. They conserve their strength, cruising slowly, and only burst into speed for the final attack.
- **Silence:** Units are vocal among themselves, with soft coda clicks, but fall completely silent while stalking prey.

## Social Interaction

- **Units:** Units are close, female-led families. Cows share the care of all calves, rest together at the surface in a tight formation, and greet each other with long exchanges of clicks after every dive. A unit is led by its oldest cow, who remembers the best hunting grounds.
- **Hunting alone:** Although units live together, every Livyatan hunts alone. Members spread out before a dive, and meet again at the surface.
- **Bulls:** Bulls lead a solitary life. They range far, and only seek out units during the courting season.
- **Encounters between bulls:** Two bulls that meet outside of courtship usually ignore each other.
- **Encounters between units:** When two units meet, they may travel together for a while, but they do not group in game.

## Aggressive Interaction

- **Ramming contests:** During courtship, rival bulls fight by ramming each other head-on with their massive heads, and by Tail Slams. These contests end when one bull turns away. They leave deep scars, but rarely kill.
- **Cows:** Cows do not fight over bulls.

## Cross-Species Interaction

- **Leedsichthys:** Leedsichthys are Livyatan's preferred prey, the closest thing to the great baleen whales they once hunted. Lone hunters track them by sound along their migration routes and rise from below.
- **Tylosaurus & Prognathodon:**
  - Livyatan see these predators as competitors and as prey.
  - A Livyatan that hears a Tylosaurus or Prognathodon in its waters hunts it down, or drives it out.
  - Echolocation is especially useful against hidden Prognathodon, which rest in caves and reefs during the day.
- **Kaiwhekea, Eurhinosaurus & Xiphactinus:**
  - These are too small and too fast to be worth the chase.
  - Livyatan usually ignore them, unless they are hungry or no larger prey is available.
- **Spinosaurus & Deinosuchus:** Treated with caution near the coast, where they have the advantage. In open water they are fair game.
- **Terrestrial species:** Terrestrial species are of no interest to Livyatan. Units sometimes watch them from a distance when nesting near the islands.

## Hunting Strategy

Livyatan hunt from below and by sound, not by speed.

1. **Finding:** A clicking scan (Echolocation) reveals prey within 150 meters.
2. **Approaching:** The hunter dives below its target and closes in silently from the dark.
3. **Weakening:** Out of combat, a burst of Dreadful Clicking slows the target and weakens its armour.
4. **Stunning:** At close range, Concussive Blast stuns the water around the target. It loses speed and acceleration, and the hunter can close the gap.
5. **Striking:** Piercing Bite tears deep wounds and weakens the target's own bite. Tail Slam drives it away from the shore.

A Livyatan always hunts alone. It prefers targets that are alone, but a grown Livyatan can overpower a Tylosaurus or Prognathodon pair as well. Only a bale of three or more Kaiwhekea standing together could turn the fight against it. When a hunt fails and the target escapes into the shallows, Livyatan let it go.

## Courtship & Parenthood

- **Calls:** In the courting season, bulls leave the deep and seek out units, announcing themselves with slow, powerful clicks that carry over great distances.
- **Bulls:** Rival bulls settle their claims by ramming contests.
- **Cows:** Cows choose a bull by swimming alongside him and answering his clicks. A bull may court both cows of a unit. He stays close to it, without grouping, until the eggs are laid. He then leaves and takes no part in raising the calves.
- **Rearing:** Cows of a unit nest close together and raise their calves as one family.

## Elderly & End of Life (Optional)

Old Livyatan dive less deeply and spend more time near the surface. Old bulls become even more solitary. Old cows remain with their unit, which shields them as it shields its calves. When a Livyatan dies, it sinks slowly into the depths, feeding the deep for years to come.

## Rule Exemptions

- None required. The shallow-water limit is a profile restriction, not an exemption (see Engagement Limits).

## Dynasty Adjusted Stats

- Growth Time (hatchling–juvenile, juvenile–adolescent, adolescent–sub, sub–adult, in minutes): 20–60–75–85 = 240 total (proposal, like Leedsichthys)
- Combat Weight: 8000 (mod default 6000)
- Adjusted Stats: Health 2000 (mod default 950)

## Profile – Quick View

- Livyatan are Giant Cathemeral Aquatic Carnivores.
- Cows live in units of two, usually sharing the same bull. Bulls are always solitary.
- They live in every ocean except Palm Islands, centred on the Abyssal Depths.
- Livyatan always hunt alone.
- They must target solitary Leedsichthys, Tylosaurus and Prognathodon first. Pairs of Tylosaurus or Prognathodon are no match for them either.
- They hunt from the deep by sound: Echolocation, then Dreadful Clicking, then Concussive Blast, then the bite.
- They never follow prey into the shallows.
