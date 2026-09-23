# Organische Gefahren- und Jagdkarte

Die Karte beantwortet nicht „Wer hat mehr Combat Weight?“, sondern vier gerichtete Fragen in fester Reihenfolge.

1. **Absicht und Regel:** Darf und würde Profil A Profil B jagen, priorisieren oder aus einem Gebiet vertreiben? Ausdrückliche Beute-, Ausschluss-, Toleranz- und Rivalitätsregeln überschreiben allgemeine Tier-Limits.
2. **Kontakt:** Teilen beide Profile kartierte Gebiete oder beschreibt ein Profil eine direkte Interaktion? Keine Gebietsschnittmenge macht eine Begegnung bedingt, selbst wenn beide stark sind.
3. **Verfolgung:** Land-, Wasser- oder Flug-Speedcap und Sprintdauer entscheiden, ob A Kontakt erzwingen kann. Ein deutlich schnelleres Ziel ist kein praktisches Opfer nur weil A schwerer ist. Ein expliziter Hinterhalt bleibt als Öffnungsrisiko sichtbar.
4. **Legaler Kampf:** Verglichen werden ausschließlich die im Profil erlaubten Jagd- und Engagement-Gruppen. Abnehmender Koordinationsnutzen verhindert, dass Gruppenstärke einfach linear mit der Teilnehmerzahl multipliziert wird. „Unlimited“ bleibt ausdrücklich unlimited und wird nicht in eine erfundene Zahl übersetzt.

## Ergebnis pro Profil

- **Direct dangers:** höchstens sechs normale Einträge; bis zu acht, wenn das Profil selbst mehr direkte Beziehungen nennt.
- **Hunts & risky interactions:** legale Beute und aktive Territorialkonflikte. Wehrhafte Herbivoren werden als riskante Beute bezeichnet, nicht als aktive Jäger.
- **Conditional profile risks:** Kannibalismus, Albino-/Mutationsregeln, Variantenkonflikte und innerartliche Territorialregeln.
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
