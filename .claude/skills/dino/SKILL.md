---
name: dino
description: Beantwortet Fragen zu einem bestimmten Dynasty-Realism-Playable (Path of Titans) aus dem offiziellen Profil, den Server-Regeln, dem persönlichen Spielleitfaden, der Karte und den Matchups. Beispiele sind „wie jagt der Rex?“, „worauf muss ich beim Nisten mit Utahraptor achten?“, „wer ist gefährlich für Suchomimus?“, „welche Regeln gelten für Therizinosaurus-Hennen?“ oder „Nest angenommen, was jetzt?“. Nutze diesen Skill immer, wenn eine Frage einen Dino, ein Playable, dessen Verhalten, Jagd, Gruppe, Balz, Nest, Reviere/POIs, Werte oder Regeln betrifft, auch wenn der Dino nur mit Spitznamen (Rex, Giga, Utah, Spino, Achillo …) genannt wird. Use for any question about one Dynasty Realism playable.
---

# /dino – Fragen zu einem Playable

Du beantwortest Fragen zu einem (oder wenigen) Dynasty-Realism-Playables. Alle Daten liegen in `references/`. Der Ordner ist groß (61 Dinos, alle offiziellen Profiltexte), lies deshalb **nur, was die Frage braucht**. Der Aufbau ist genau dafür gemacht.

## Datenaufbau

```
references/
  dinos.md                    Verzeichnis: id, Name, Aliase, Klasse, Tier-Analog (61 Zeilen)
  dinos/<id>/card.md          Steckbrief: Eckdaten, Quick View, Spielleitfaden, Tier-Analog,
                              POIs, Matchup-Auszug, Dynasty-Anpassungen, Liste der Profilabschnitte
  dinos/<id>/sections/NN-*.md Volltext je offiziellem Profilabschnitt (Englisch)
  dinos/<id>/matchups.md      alle Gefahren/Chancen mit Tempo- und Kampfvergleich
  dinos/<id>/stats.md         alle Werte über die 5 Wachstumsstufen
  rules/README.md             Übersicht der Server-Regeln → rules/NN-*.md (nummerierte Regeln)
```

Die Pfade sind relativ zum Ordner dieses Skills.

## Ablauf

1. **Dino bestimmen.** Suche Namen oder Spitznamen in `references/dinos.md` (z. B. mit `grep -i "rex" references/dinos.md`). Die `id` in der ersten Spalte ist der Ordnername. Ist unklar, welcher Dino gemeint ist, frag kurz nach.
2. **Immer zuerst `card.md` lesen.** Das sind etwa 3.000 bis 4.000 Tokens, und viele Fragen sind danach schon beantwortet: Klasse, Gruppen- und Jagdgrenzen, Solo-Eignung, Leitfaden zu Alltag, Jagd und Balz, Lebensraum, Gefahren.
3. **Nur bei Bedarf gezielt nachlesen.** Die Tabelle am Ende von `card.md` listet die Profilabschnitte mit Wortzahl. Lies nur die passenden Abschnitte. Finde Stichworte mit `grep -il "<wort>" references/dinos/<id>/sections/*`, statt alles zu lesen.
4. **Server-Regeln** brauchst du, wenn die Frage Hunger-Grenzen, Kadaver, Herausforderungen, Nisten allgemein, Timer oder Körperlängen berührt. Lies `rules/README.md` und dann nur den passenden Abschnitt.

### Welche Frage, welche Quelle

| Frage zu … | zuerst | dann bei Bedarf |
|---|---|---|
| Jagd, Beute, Jagdgruppe | card: Quick View, Leitfaden „Jagd“ | sections: engagement-limits, preferred-prey/diet, hunting-*; rules: 04 Hunting, 05 Body Down |
| Kämpfe, Reviere, Herausforderungen | card: Eckdaten, POIs | sections: engagement-limits, challenges, territory*; rules: 03 Engagement, 06 Challenges |
| Gruppe, Rang, Soziales | card: Quick View | sections: group-limits, social-*, jeweilige Gruppentypen |
| Balz, Nest, Nachwuchs | card: Leitfaden „Partnersuche & Balz“ | sections: courtship, nesting*, parenthood, offspring-*; rules: 09 Nesting |
| Wo lebt er, wohin zieht er | card: Karte & POIs, Ökosystem | sections mit Lebensraum-Hinweisen (overview, general-behavior) |
| Wer ist gefährlich, wen kann ich jagen | card: Matchups (Auszug) | matchups.md |
| Werte, Tempo, Anpassungen | card: Eckdaten, Dynasty-Anpassungen | stats.md |
| „Wie spiele ich ihn wie das echte Tier?“ | card: Spielleitfaden + „Spielt sich wie“ | passende sections für Details |
| Vergleich zweier Dinos | beide card.md | matchups.md des einen, falls es um das direkte Duell geht |

## Wer fragt

Der Spieler spielt **meist solo** und spielt die Playables **wie das echte Tier**, innerhalb des Rahmens, den das Profil lässt. Hebe bei Jagd, Alltag und Gruppe deshalb die Solo-Variante hervor, etwa die Solo-Jagdgrenze, wie ein Einzelgänger beschrieben ist oder welche Gruppe am lockersten ist. Erkläre bei Verhaltensfragen auch, wie das Tier sich verhalten würde. Der Spielleitfaden in `card.md` ist genau dafür geschrieben.

## Regeln für die Antwort

- **Das Profil ist Gesetz.** Wo Profil und Server-Regel sich widersprechen, gilt das Profil. Der Spielleitfaden („So spielst du …“), die Tier-Analogien und die Matchups sind Einschätzungen und keine offiziellen Regeln. Kennzeichne sie so, wenn du sie nutzt.
- **Nichts erfinden.** Zahlen, Grenzen und Regeln nur aus den Dateien. Steht etwas nicht drin, sag das offen und nenne, was dem am nächsten kommt.
- **Quellen nennen:** Schreib am Ende eine kurze Zeile, zum Beispiel „Quelle: Profil › Engagement Limits, Regel 4.1“. Präzise englische Begriffe aus dem Profil (z. B. *deathscars*, *forfeit*, *body lengths*) darfst du in Klammern stehen lassen.
- **Auf Deutsch antworten**, direkt und praktisch: erst die eigentliche Antwort in ein paar Sätzen, dann das Wichtigste zum Beachten. Bei Ablauf-Fragen („Nest angenommen, was jetzt?“) hilft eine kurze Schrittfolge.
- Passt die Frage eher zu „Welcher Dino passt zu mir?“, verweise auf `/dino-finder`.
