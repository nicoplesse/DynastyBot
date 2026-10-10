{{! TheNPCC · globales Nesting-Template (Discord-Markdown, auf Englisch gepostet).
    Frei anpassbar. Platzhalter und Regeln: siehe SKILL.md › „Template anpassen“.
    Zeilen, die nur aus einem Abschnitts-Tag (Raute, Dach, Schrägstrich) bestehen,
    verschwinden beim Rendern. In diesem Kommentar keine geschweiften Klammern verwenden. }}
## ⟡ {{species}} Nest ⟡
-# {{seasonIcon}} {{seasonLabel}}{{#clutch}} ・ Clutch {{clutch}}{{/clutch}} ・ {{eggs}} {{eggWord}}
{{#tagline}}
> *{{tagline}}*
{{/tagline}}
‧₊˚ ┈┈┈┈┈┈ ⊹ 🐾 ⊹ ┈┈┈┈┈┈ ˚₊‧
{{#parents}}

{{icon}} **{{role}}** ┆ **{{name}}**
{{#player}}
-# {{player}}
{{/player}}
✧ `[D]` {{dominant}}
✧ `[R]` {{recessive}}
{{#details}}
✧ `[{{label}}]` {{value}}
{{/details}}
{{/parents}}

‧₊˚ ┈┈┈┈┈┈ ⊹ 🥚 ⊹ ┈┈┈┈┈┈ ˚₊‧
**E G G S** ・ {{claimed}}/{{eggs}}
{{#slots}}
⤷ {{#taken}}{{#name}}**{{name}}** {{/name}}{{#sex}}{{sex}} {{/sex}}┆ {{who}}{{/taken}}{{^taken}}*open*{{/taken}}
{{/slots}}
{{#eggRoll}}
-# 🎲 [Egg roll]({{eggRoll}})
{{/eggRoll}}

‧₊˚ ┈┈┈┈┈┈ ⊹ 📜 ⊹ ┈┈┈┈┈┈ ˚₊‧
**N E S T   R U L E S**
{{#rules}}
✧ {{.}}
{{/rules}}
{{#speciesNote}}
-# 🦴 {{speciesNote}}
{{/speciesNote}}
{{#note}}

> 💬 *{{note}}*
{{/note}}

‧₊˚ ┈┈┈┈┈┈ ⊹ ✦ ⊹ ┈┈┈┈┈┈ ˚₊‧
{{#full}}
**This nest is full** ・ thank you all! 🤍
{{/full}}
{{^full}}
**React with 🥚 to claim** ・ ping me in {{nestingChat}} when you're ready
{{/full}}
-# ⏳ Nest expires {{expires}}
{{ping}}
