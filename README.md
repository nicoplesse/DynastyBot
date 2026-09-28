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

Open the Vite address shown in the terminal (normally `http://localhost:5173`). The local API runs on `http://127.0.0.1:3001`; Vite forwards `/api` requests to it. The API reads its port from `API_PORT`, not `PORT`, so a `PORT` meant for Vite cannot move it.

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

Migration routes are drawn as lines rather than filled areas, so they live in a separate, always-curated `data/raw/<slug>/routes.json` (never touched by the auto-detector): each route is an ordered list of region ids (`via`) that the processor turns into map waypoints and a legible sequence for a chatbot. At processing time each profile gains a resolved `map` block (markers plus `routes` with waypoints) and a `habitat` summary (`biomes`, `moisture`, `regions`, `roles` including `migration`, `isDry`, `isAquatic`). The processor also writes `data/processed/map-index.json`, an inverted index grouping playables by `moisture`, `biome`, `region` and `groups` (dry / aquatic / migration). This lets a chatbot answer questions such as "which playable lives in dry areas?" with a direct lookup (`moisture.arid.dinoIds`) instead of re-analyzing the map images. The Profiles page renders `map` as an interactive POI map with a landscape layer (see below); the API serves the index at `/api/map-index` and the gazetteer at `/api/map`.

All playables carry a map. Three are hand-authored in full detail — `spinosaurus` (freshwater and saltwater variant territories, saltwater roaming grounds and neutral grounds), `megalania` (arid vs. temperate variant ranges) and `leedsichthys` (sea migration loop plus courtship grounds). New imports can be drafted by `npm run detect:pois` (`server/scripts/detect-pois.mjs`), which decodes each shared-projection map image and samples the highlight colours — green preferred-POI/territory, magenta courtship/nesting grounds and yellow neutral grounds. Run `npm run curate:pois` after detection to collapse sampled landmark labels into their enclosing POI areas. Curated area files are marked `"source": "curated-areas"`, so the detector never overwrites them. Re-run `npm run process` after editing POIs. The raw profile text and images are never modified.

### Traced POI outlines

The POI area outlines are not estimated by hand: `npm run trace:regions -w server` (`server/scripts/trace-regions.mjs`) traces them from the map images. Every profile map is the same base map with different areas tinted, and the black POI borders are identical on all of them. The script scales all 61 map images to the shared projection and takes the per-pixel median, which gives a clean base map. It then flood-fills each POI from its label inside the black borders and traces the filled area to a polygon. Borders that only exist on some map versions come from one image of that version: the six Tyrannosaurus territories are traced inside their parent areas, and Steep Run is drawn by hand because white route lines cross its borders on every map that shows it. The few places where a border has no black stroke (a tint edge, or a line across dark water) are closed by short, commented cut lines in the script. The script rewrites only `shape`, `anchor` and `traced` in the gazetteer and also writes `data/map/layers/freshwater.png`, the open fresh water of the base map outside the sea areas.

`npm run audit:pois -w server` (`server/scripts/audit-pois.mjs`) checks every POI list against its own map. It measures how much of each outlined area the profile map tints and reports listed POIs that are not marked on the map, and marked areas that are not listed. Marked areas read 45–95 % tinted and unmarked ones 0–10 %. All auto-drafted POI lists were corrected with it; the hand-authored Spinosaurus, Megalania and Leedsichthys files mark sub-areas and legitimately differ. Re-run `npm run process` after editing POIs.

### Landscapes on the map

Each POI area in the gazetteer has `ecosystems`: its landscape, using the six ecosystem ids of `data/reference/ecosystems.json` (Sea & Coast, Rivers & Swamps, Forest, Plains, Desert & Canyons, Mountains & Cliffs). The first entry is the main character of the area, and a second entry is a strong secondary trait; Dry Fang Canyon, for example, is desert first and cliffs second. The processor adds a `landscapes` list to `/api/map`, gives every POI marker its `ecosystems`, and adds a `landscape` group to `map-index.json` (which playables live in forest, cliffs and so on).

The profile map adds no colour of its own, because the map image already shows the profile's territories, nesting and courtship grounds and routes. POI areas are invisible click targets: hovering outlines the area in white and shows its name, and the side panel lists the POIs by role. The **Landscape** buttons show one landscape at a time as a spotlight. The rest of the map is dimmed, the areas of that landscape keep the map's own colours with a thin white outline, and areas where it is only a secondary trait stay half-lit with a dashed outline. For Rivers & Swamps, lakes, rivers and ponds inside other areas are lit as well. Each button shows how many of the profile's POIs lie in that landscape, and a dot marks the profile's home ecosystem.

## Variants: one profile, several playables

Some official profiles describe two populations that play very differently. Such a profile can be split into separate playables that share its official text, stats, speeds and images. Each variant is a folder `data/raw/<slug>/variants/<variant>/` with:

- `variant.json`: playable `id` and `name`, the `variant` key that matches the `variant` field in the parent's `pois.json`, a `label`, a nickname (`title`) and extra `aliases`;
- its own `analog.json` and `playstyle.json`.

The processor then drops the parent from the catalog and writes one profile per variant. Each has only its own POIs plus the shared ones (`"variant": "both"`), and gets a `variant` block with a link to its sibling. The parent's name stays an alias, so other profiles that mention "Megalania" still reach both variants. Sibling variants count as mutual rivals and prey when the shared text says they hunt the "opposite variant". Images are served from the parent's upload (`source.rawId`), and reference files keyed by imported profile (stat baselines, speeds, in-game covers) stay keyed by the parent. `data/reference/ecosystems.json` has one entry per variant. `server/src/playables.js` lists every playable with its content folder; tests and scripts use it instead of reading `data/raw/`.

Megalania is split this way:

- **Megalania (Arid)**, the "Canyon-Drache": a Komodo dragon and a leopard gecko that lives on the ground between the rocks.
- **Megalania (Temperate)**, the "Baumdrache": a lace monitor that clings to trunks like a tokay gecko, above the water of the swamp forest.

Spinosaurus is split along a line the profile draws itself. Most Spinosaurus "possessively claim territory in freshwater lakes and rivers", while some prefer "a lazy lifestyle touring saltwater areas":

- **Spinosaurus (Freshwater)**, the "Flussherr": the grizzly and saltwater crocodile. It claims one lake, bog or river water (the segmented territories and the bright-green river stretches).
- **Spinosaurus (Saltwater)**, the "Küstenwächter": a leopard seal and grey reef shark. It claims one of the bright-green sea areas of the profile map (Kelp Vale, Coastal Bluffs, Abyssal Depths, Palm Islands, Stonebed Shoal).

Like every Spinosaurus, each variant holds exactly one territory and roams only inside it. The saltwater variant drinks at fresh water outside its territory (POI role `drinking`, `"claimable": false`), which it uses peacefully and never defends.

Sibling variants are one species unless the profile says otherwise. The Spinosaurus variants never appear as each other's prey, while the Megalania variants may hunt each other.

## Counters and matchups

For each playable the processor works out who counters it and who it counters, from data alone (`server/src/matchups.js`). Strength uses combat weight (the dominant factor in a straight fight); diet gates initiation (herbivores rarely start fights); a hunt tier ("may hunt up to Apex") and playstyle tags (ambush, pack, bleed, pounce, venom, armored) are read from the parsed profile text; and encounter likelihood is the shared-POI (region) overlap — so a stronger rival that keeps to different POIs is only a *conditional* threat (e.g. Yutyrannus for Giganotosaurus, who hold different POIs). Each profile gains a `matchups` block (`threats`, `prey`, `traits`) and the processor writes `data/processed/matchups.json` (served at `/api/matchups`) for a chatbot or the Playable Finder. The Profiles page shows this as a **Counters & Matchups** section with strength / encounter / playstyle badges.

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

## Play guide ("So spielst du …")

Every profile page opens with a short play guide in German: a "profile above the profile". It describes how to play the playable like its real animal within the space the profile leaves. The official profile always wins where they differ.

- `data/raw/<id>/playstyle.json` is hand-written for each playable. It has a prose `summary`, a `solo` fit with a note, and three parts in fixed order: `daily` (sleeping, roaming, finding food, with the map's POIs), `hunt` (called "Gefahr & Verteidigung" for herbivores) and `courtship`. The `courtship` part is marked `fixed` because the profile leaves little room there.
- The `solo` fit tells a solo player what to expect. `solo` means the profile describes a natural lone life. `solo-possible` means you can play alone, but with limits or only for a while. `group` means the species depends on its group. The processor copies the guide into the profile and adds the fit to the catalog as `solo`.
- `npm test` checks that every playable has a complete German guide written as prose.

## Chat skills: /dino and /dino-finder

There are two Claude skills in `.claude/skills/` for asking questions in chat.

- **`dino`** answers questions about one playable, such as how it hunts, which rules apply, what to watch out for when nesting, who is dangerous to it, or where it lives.
- **`dino-finder`** recommends the playable that fits a wish. It knows the player mostly plays solo and plays each playable like its real animal, so it prefers solo-friendly playables.

Both skills use progressive disclosure: they read only the files a question needs, never the whole archive. `dino` first looks the playable up in `references/dinos.md` and reads its short `card.md`. That file holds the key facts, the Quick View, the play guide, the animal analog, the POIs, the top matchups and a list of profile sections. It then opens single profile sections (`sections/NN-*.md`), `matchups.md`, `stats.md` or one server rules section (`rules/`) only when needed. A hunting question about the Rex reads about 19 KB instead of about 75 KB. `dino-finder` reads a one-line-per-playable `catalog.md` (with lists by solo fit, animal type and play-style trait), then only the cards of its shortlist. `animals.md` and `ecosystems.md` cover wishes about a specific animal or a landscape.

The `SKILL.md` files are written by hand. Everything under `references/` is generated from `data/processed/` by `npm run skills:build`, which reprocesses first. The build also writes `dist/skills/dino.zip` and `dist/skills/dino-finder.zip` for upload to claude.ai (Settings → Capabilities → Skills). In Claude Code, run in this repository, the skills are available directly as `/dino` and `/dino-finder`. Rebuild after profiles, play guides or rules change, then upload the zips again.

To run the automated API checks, use `npm test`. To create a production frontend build, use `npm run build`.
