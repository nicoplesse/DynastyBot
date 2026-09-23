# DynastyBot

DynastyBot is a local archive for Dynasty Realism profiles and server rules. The importer saves the complete pasted profile text and image files under `data/raw/`. The Profiles and Rules pages create readable views from separate files under `data/processed/`; source files are never modified.

## Requirements

- Node.js 20.19+ (or 22.12+)
- npm

## Install and start

```bash
npm install
npm run dev
```

Open the Vite address shown in the terminal (normally `http://localhost:5173`). The local API runs on `http://127.0.0.1:3001`; Vite forwards `/api` requests to it.

## Files

```text
frontend/        React, TypeScript and Vite interface
server/          Local Node.js API
data/raw/        Versionable source profiles: one directory per playable
data/map/        Shared world gazetteer: named regions with coordinates and biome/moisture tags
data/reference/  Local snapshot of publicly listed default stat curves
data/processed/  Generated profile JSON, catalog, structured rules and the map index
```

Each `data/raw/<slug>/` directory contains `manifest.json`, the original `profile.txt`, regular image files in `images/`, and an optional `pois.json` (points of interest for the map, see below). `data/raw/` is intentionally **not** ignored by Git. Generated files include `data/processed/index.json`, one JSON document per profile, `data/processed/rules.json`, `data/processed/map.json` and `data/processed/map-index.json`. This gives later search or chat features a stable structured source while keeping raw data intact.

Processed files are regenerated at server startup and after imports change. They can also be rebuilt manually with `npm run process`.

## Playable stats

Each profile page shows the complete published stat curves for its playable across the five growth stages. The local reference snapshot in `data/reference/baselines.json` comes from [NexLink Core's Path of Titans curve directory](https://nexlinkcore.com/guides/path-of-titans/curve-overrides/alderons/path-of-titans-achillobator). NexLink Core is an independent mirror, **not** Alderon Games or a mod creator. Source URL and update date are retained for every playable. The application makes no network requests for stats while running. To fetch a new snapshot manually and rebuild the processed profiles, run `npm run stats:refresh`.

Dynasty adjustments from each raw profile are applied to a matching curve only when the mapping is clear. A numeric change without a stated final value is marked as open; unmatched changes and differences between the reference and Dynasty wording are shown for review. This avoids presenting uncertain values as verified server stats. The five-stage curves are a snapshot, not a live feed or a substitute for the Dynasty server configuration. None of these operations edit `data/raw/`.

## Map and points of interest

Every playable shares one world map, so its named regions are described once in `data/map/regions.json` (the gazetteer). The large, bold, black-outlined POIs are polygons; smaller white map labels such as ponds, hills and falls remain landmark points inside those areas. Each entry also carries a `biome`, a `moisture` value from `arid` through `aquatic`, water type and terrain tags. A playable references the enclosing POI areas in `data/raw/<slug>/pois.json`, adding profile-specific detail — role (territory, hunting, nesting, courtship, migration, basking…), claimable tier, variant (e.g. Megalania arid/temperate), season, prey and notes. A POI may instead carry its own `shape` for a location not in the gazetteer. Coordinates are normalized to the shared `948×874` base map, so one set aligns across every playable's own map image.

Migration routes are drawn as lines rather than filled areas, so they live in a separate, always-curated `data/raw/<slug>/routes.json` (never touched by the auto-detector): each route is an ordered list of region ids (`via`) that the processor turns into map waypoints and a legible sequence for a chatbot. At processing time each profile gains a resolved `map` block (markers plus `routes` with waypoints) and a `habitat` summary (`biomes`, `moisture`, `regions`, `roles` including `migration`, `isDry`, `isAquatic`). The processor also writes `data/processed/map-index.json`, an inverted index grouping playables by `moisture`, `biome`, `region` and `groups` (dry / aquatic / migration). This lets a chatbot answer questions such as "which playable lives in dry areas?" with a direct lookup (`moisture.arid.dinoIds`) instead of re-analyzing the map images. The Profiles page renders `map` as an interactive, filterable POI map; the API serves the index at `/api/map-index` and the gazetteer at `/api/map`.

All playables carry a map. Three are hand-authored in full detail — `spinosaurus` (freshwater/brackish territories plus neutral grounds), `megalania` (arid vs. temperate variant ranges) and `leedsichthys` (sea migration loop plus courtship grounds). New imports can be drafted by `npm run detect:pois` (`server/scripts/detect-pois.mjs`), which decodes each shared-projection map image and samples the highlight colours — green preferred-POI/territory, magenta courtship/nesting grounds and yellow neutral grounds. Run `npm run curate:pois` after detection to collapse sampled landmark labels into their enclosing POI areas. Curated area files are marked `"source": "curated-areas"`, so the detector never overwrites them. Re-run `npm run process` after editing POIs. The raw profile text and images are never modified.

## Counters and matchups

For each playable the processor works out who counters it and who it counters, from data alone (`server/src/matchups.js`). Strength uses combat weight (the dominant factor in a straight fight); diet gates initiation (herbivores rarely start fights); a hunt tier ("may hunt up to Apex") and playstyle tags (ambush, pack, bleed, pounce, venom, armored) are read from the parsed profile text; and encounter likelihood is the shared-POI (region) overlap — so a stronger rival that keeps to different POIs is only a *conditional* threat (e.g. Tyrannotitan for Tyrannosaurus, who mostly hold different POIs). Each profile gains a `matchups` block (`threats`, `prey`, `traits`) and the processor writes `data/processed/matchups.json` (served at `/api/matchups`) for a chatbot or the Playable Finder. The Profiles page shows this as a **Counters & Matchups** section with strength / encounter / playstyle badges.

**Speed is intentionally omitted.** The stat curves contain only relative speed *multipliers*, not absolute per-creature speeds, and no single reliable, comprehensive source covers this modded roster, so the model leaves speed out (`speedKnown: false`) rather than guess. It can be added later without changing the model once reliable numbers exist. Playstyle tags are best-effort text signals.

## Plays like: real-animal analogs

Every playable is matched to the one or two real animals it plays most like, so choosing a character becomes "do I feel like playing a grizzly bear today?" instead of an abstract profile comparison. The curated source is `data/raw/<slug>/analog.json` (never touched by the importer or the processor):

- `analogs`: one or two real animals with English and German names, scientific name, an animal family (`archetype`), a `share` (the shares add up to 100) and `covers` (which side of the playable that animal explains, e.g. "social life" vs. "how it fights").
- `headline`, `playsLike`: a one-line pitch and a short description of the day-to-day play experience.
- `setting`: where it lives, with curated `habitats` (forest, open, arid, wetland, sea, mountain) chosen from the profile text and the profile map, so "a big cat in the jungle" and "a big cat on the savanna" resolve to different playables.
- `why`: concrete profile rules and stats that make the comparison fit, with verbatim quotes where the profile says it best; `notLike`: where the comparison breaks; `twist`: an optional extra abstraction (for example "scaled up to the largest land animal ever").
- `moods`: the play feel (solitary, pack, herd, ambush, apex, prey, nocturnal…).

Animal families, moods and habitats form a controlled vocabulary with English and German synonyms in `data/reference/analog-vocabulary.json`. At processing time (`server/src/analogs.js`) each profile gains an `analog` block with the curated content, the official "Profile inspired by…" credit, live stat facts (tier, combat weight, HP, sprint speeds, hunt ceiling) and links to other playables built on the same animal. The processor also writes `data/processed/analogs.json`: an index of playables by animal family, animal, mood and habitat, plus a synonym lookup. `GET /api/analogs` serves it and `GET /api/analogs/search?q=…` ranks playables for free text in German or English ("ochse", "Großkatze im Dschungel", "Rudel Wolf", "Krokodil im Sumpf"). The main animal ranks ahead of a partial match, and family words only name an animal as a whole word ("Moschusochse" is not an ox; "Seelöwe" is not a lion). The frontend shows a **Plays Like** section at the top of every profile and an **Animal Finder** page (families, habitat, play-feel and diet filters, free-text search).

## Profile images: animal first, then the game

Each profile card shows a photo of the animal with the highest share, e.g. "60% Grizzly bear" for Spinosaurus. The profile page opens with three images: **1** the main animal, **2** the second animal (only for mixed profiles), **3** Dynasty's in-game title card, which shows the dino with its name on it.

- Animal photos: `data/reference/animal-photos.json`, keyed by animal id. Each entry names the Wikipedia article (`wiki`) and can pin a specific Commons file (`file` + `"pinned": true`) and a crop (`focus`, a CSS `object-position`). `npm run photos:refresh -w server` (`server/scripts/fetch-animal-photos.mjs`) fills in the Wikimedia thumbnail URL, author and licence. Pass animal ids to refetch only those, or `--refresh` to refetch all. The page loads the photos directly from Wikimedia and credits the author and licence on each one.
- In-game title card: `data/reference/ingame-covers.json` records which upload is the title card for each profile. It was checked by eye against every upload. For a profile it does not list yet, the processor picks the first upload shaped like a title card (≈1.615:1, ≤1600 px wide). Sarcosuchus has no title card upload, so it shows its skin sheet. Deinosuchus has only its map, so its page shows a placeholder until a title card is imported.

Re-run `npm run process` after editing either file.

## Ecosystems and food chains

**Profiles → Ecosystems** in the sidebar (and **By ecosystem** on the profile list) opens the ecosystem overview. It has a tab per ecosystem and an **All** view that shows every ecosystem as its own section, one after the other. There are six ecosystems: Sea & Coast, Rivers, Lakes & Swamps, Forest, Plains & Savanna, Desert & Canyons, and Mountains & Cliffs.

- `data/reference/ecosystems.json` is the curated source. It gives every playable one home ecosystem, based on its profile text, its real-animal analogs and its map; Tropeognathus, for example, is a gull and cormorant and lives in Sea & Coast. It also records the ecosystems a playable regularly visits (`also`) and the reason for each choice.
- Food chain: predators come above plant-eaters, from Apex predators (level 1) down to Small prey (level 7). The level comes from diet and game tier. A curated `level` can override it with a reason; Leedsichthys, a filter feeder, sits with the giant grazers. Within a level, higher combat weight comes first, then higher adult health.
- The processor writes `data/processed/ecosystems.json` (served at `GET /api/ecosystems`) with every ecosystem's ranked food chain and its visitors. Each profile also gets an `ecosystem` block, and its profile page links to its ecosystem.

To run the automated API checks, use `npm test`. To create a production frontend build, use `npm run build`.
