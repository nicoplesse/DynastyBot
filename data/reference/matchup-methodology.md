# Organische Gefahren- und Jagdkarte

Die Karte beantwortet nicht „Wer hat mehr Combat Weight?“, sondern vier gerichtete Fragen in fester Reihenfolge.

1. **Absicht und Regel:** Darf und würde Profil A Profil B jagen, priorisieren oder aus einem Gebiet vertreiben? Ausdrückliche Beute-, Ausschluss-, Toleranz- und Rivalitätsregeln überschreiben allgemeine Tier-Limits.
2. **Kontakt:** Teilen beide Profile kartierte Gebiete oder beschreibt ein Profil eine direkte Interaktion? Keine Gebietsschnittmenge macht eine Begegnung bedingt, selbst wenn beide stark sind.
3. **Verfolgung:** Land-, Wasser- oder Flug-Speedcap und Sprintdauer entscheiden, ob A Kontakt erzwingen kann. Ein deutlich schnelleres Ziel ist kein praktisches Opfer nur weil A schwerer ist. Ein expliziter Hinterhalt bleibt als Öffnungsrisiko sichtbar.
4. **Kampf mit echten Werten:** Jeder Treffer wird nach der Path-of-Titans-Formel gerechnet: Schaden × (CW Angreifer ÷ CW Ziel) ÷ Armor des Ziels. Die Werte stammen aus den adulten Stat-Kurven inklusive Dynasty-Anpassungen. Beide Seiten konzentrieren ihren Schaden auf ein Ziel nach dem anderen. Standard ist „du solo gegen die volle legale Gruppe des Gegners“; beide Seiten sind im Frontend frei einstellbar, begrenzt durch die Profil-Limits. „Unlimited“ bleibt ausdrücklich unlimited und wird nicht in eine erfundene Zahl übersetzt.

## Kampfmodell im Detail

- **Quelle:** `server/src/combat.js` liest pro Profil alle Kurven `<Name>Damage` mit passender `<Name>Cooldown` als Attacken, dazu Leben, Armor, CW und Bleed-Heilrate. Die Rechnung selbst liegt in `shared/combat-sim.mjs` und läuft identisch im Prozessor und im Browser.
- **Rotation:** bester Dauerangriff (Cooldown ≤ 2 s) plus bis zu zwei Fähigkeiten, deren Treffer mehr bringt als die ersetzten Grundangriffe. Kein Angriff ist schneller als 1 s (Animationsgrenze).
- **Nicht in der Rotation, aber als größter Treffer sichtbar:** Angriffe nur im Festbeißen (Shred, Pounced) und Spezialschläge über dem Sechsfachen des Hauptangriffs (Big Stomp).
- **Bleed:** skaliert mit dem CW-Verhältnis, ignoriert Armor, stapelt ohne Limit und blockiert Heilung (belegt). Die Umrechnung in Leben ist nicht dokumentiert; deshalb zählt Bleed standardmäßig nur als Druck-Anzeige. Im Frontend kann eine Schätzung (1 Bleed-Punkt = 1 % max. Leben pro Sekunde) zugeschaltet werden.
- **Annahmen:** Jeder Schlag trifft, Treffer auf den Körper (Kopf ×1,2 und Schwanz ×0,25 bleiben außen vor), adulte Tiere, keine Buffs aus passiven Fähigkeiten. Kleine, wendige Spieler schneiden durch Ausweichen besser ab als gerechnet.
- **Urteil:** Gewinnt eine Seite mit mindestens 35 % Restleben, ist es ein klarer Vorteil; sonst gilt der Kampf als knapp. Ein verlorener Kampf kann nie ein Top-Band („Severe/High“ bzw. „Strong fit/Favourable“) tragen.

## Ergebnis pro Profil

- **Direct dangers:** höchstens sechs normale Einträge; bis zu acht, wenn das Profil selbst mehr direkte Beziehungen nennt.
- **Hunts & risky interactions:** legale Beute und aktive Territorialkonflikte. Wehrhafte Herbivoren werden als riskante Beute bezeichnet, nicht als aktive Jäger.
- **Conditional profile risks:** Kannibalismus, Albino-/Mutationsregeln, Variantenkonflikte und innerartliche Territorialregeln.
- **Reserve:** Gegner, die erst bei anderen Gruppengrößen relevant werden, liegen unter `reserve`; das Frontend sortiert die Listen bei jeder Einstellung neu.
- Jeder Eintrag enthält Urteil, natürliche Kurzbeschreibung, Verfolgungsvergleich, erlaubte Gruppengrößen, Gebietskontakt und die ursächliche Profilpassage.

Die maschinenlesbare Gesamtkarte liegt nach der Verarbeitung in `data/processed/matchup-map.json`; derselbe Ausschnitt wird in jedem verarbeiteten Profil unter `matchups` gespeichert.

## Wichtige Invarianten

- Ein schwerer Gegner ohne Jagdabsicht und ohne direkte Aggressionsregel ist keine automatische Gefahr.
- Ein schnelleres Ziel mit längerer Sprintdauer kann einen generischen Jäger normalerweise ablehnen.
- Eine explizite Beutepräferenz bleibt sichtbar, auch wenn der Kampf für den Jäger riskant ist.
- Pflanzenfresser erscheinen nicht als aktive Jäger; direkte Angriffe aus Territorial- oder Verteidigungsregeln bleiben als Konflikte sichtbar.
- Aquatische Geschwindigkeiten werden nur verwendet, wenn beide Seiten über relevante Wasserwerte verfügen. Gegen Landtiere beschreibt ein aquatischer Jäger ein Ufer-/Öffnungsrisiko, keine endlose Landverfolgung.
- Ein terrestrischer Jäger erhält ohne ausdrückliche Profilregel kein reguläres aquatisches oder fliegendes Ziel.

## Kontrollbeispiele

- **Deinonychus gegen Tyrannosaurus:** Rex wird nicht als praktischer Direktkonter geführt; der Geschwindigkeits- und Ausdauerabstand verhindert eine erzwungene Verfolgung, und acht Deinonychus werden nicht zu einer beliebigen Masse erweitert.
- **Achillobator:** Kelenken bleibt wegen der ausdrücklich genannten Jagdpräferenz relevant. Iguanodon, Parasaurolophus, Pachyrhinosaurus und Eotriceratops erscheinen als bevorzugte, teils riskante Jagden; Latenivenatrix ist ein Jagdpartner und keine Beute.
- **Tyrannosaurus gegen Eotriceratops:** Eotriceratops ist legale, aber wehrhafte Beute. Die Karte zeigt die knappen Geschwindigkeiten und erlaubten Verteidiger statt einen automatischen Sieg zu behaupten.
- **Tyrannosaurus gegen Tyrannotitan/Giganotosaurus:** Rivalitätsregeln bleiben sichtbar, geringe Gebietsschnittmenge kennzeichnet sie jedoch als bedingt.
- **Albino Tyrannosaurus:** Die innerartliche Albino-/Kannibalismus-Ausnahme steht separat unter den bedingten Profilrisiken.
