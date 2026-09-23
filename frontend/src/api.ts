export interface ImageRecord {
  file: string;
  label: string;
  originalFileName: string;
}

export interface Manifest {
  schemaVersion: number;
  id: string;
  name: string;
  importedAt: string;
  profileFile: string;
  images: ImageRecord[];
}

export interface ProfileSummary {
  id: string;
  name: string;
  importedAt: string;
  imageCount: number;
}

export interface ProfileDetail {
  manifest: Manifest;
  profile: string;
}

export interface ProcessedMedia extends ImageRecord { role: 'cover' | 'reference' | 'map-or-reference' }
export type ContentBlock = { type: 'paragraph'; text: string } | { type: 'list'; items: string[] };
export interface StatCurve {
  key: string; group: string; baseValues: number[]; effectiveValues: Array<number | null>;
  adjustments: Array<{ text: string; stage: number; previous: number | null; current: number | null;
    method: 'explicit' | 'calculated' | 'unquantified' | 'profile-header'; mismatch: boolean }>;
}
export interface FullStats {
  baseline: { title: string; url: string; type: string; updatedAt: string | null; fetchedAt: string | null } | null;
  curves: StatCurve[]; unmappedChanges: string[]; warnings: string[];
}
export interface SpeedMode { walk?: number; trot?: number; cruise?: number; sprint: number; sprintDurationSeconds: number }
export interface SpeedSource { id: string; title: string; url: string; type: string; updatedAt: string | null; note: string }
export interface SpeedStats {
  unit: 'game-units-per-second'; snapshotAt: string;
  land: SpeedMode; water: SpeedMode | null; air: SpeedMode | null; sources: SpeedSource[];
}
export type PoiShape =
  | { type: 'point'; x: number; y: number }
  | { type: 'polygon'; points: number[][] }
  | { type: 'circle'; x: number; y: number; r: number };
export interface PoiWater { present: boolean; type: string; feature?: string }
export interface PoiMarker {
  regionId: string | null; name: string; shape: PoiShape | null;
  biome: string | null; moisture: string | null; water: PoiWater | null;
  terrain: string[]; description: string; roles: string[];
  claimable: boolean | null; territoryTier: string | null; variant: string | null;
  prey: string[] | null; season: string | null; note: string; unresolvedRegion: boolean;
}
export interface RouteWaypoint { regionId: string; name: string; x: number; y: number; biome: string | null; moisture: string | null }
export interface MapRoute { id: string | null; name: string; role: string; color: string | null; note: string; via: string[]; waypoints: RouteWaypoint[] }
export interface ProfileMap {
  image: string | null; imageSize: { width: number; height: number } | null;
  legend: Record<string, string> | null;
  variants: Array<{ id: string; name: string; moisture?: string; note?: string }> | null;
  anyPoiHunting: { prey: string[]; note: string } | null;
  markers: PoiMarker[];
  routes: MapRoute[];
}
export interface Habitat {
  classification: string | null; biomes: string[]; moisture: string[]; regions: string[];
  roles: Record<string, string[]>; variants: string[]; isDry: boolean; isAquatic: boolean;
}
export interface MapIndex {
  schemaVersion: number; generatedAt: string; dryMoisture: string[];
  groups: { dry: string[]; aquatic: string[] };
  moisture: Record<string, { label: string; dinoIds: string[] }>;
  biome: Record<string, { dinoIds: string[] }>;
  regions: Record<string, { name: string; biome: string | null; moisture: string | null; dinoIds: string[]; roles: Record<string, string[]> }>;
  dinos: Record<string, { name: string; classification: string | null; isDry: boolean; isAquatic: boolean; moisture: string[]; biomes: string[]; regions: string[]; variants: string[] }>;
}
export type MatchupBand = 'severe' | 'high' | 'meaningful' | 'conditional';
export interface MatchupEntry {
  id: string; name: string; direction: 'threat' | 'opportunity'; band: MatchupBand; kind: string;
  headline: string; summary: string; score: number; tags: string[]; confidence: 'profile-specific' | 'derived' | 'low';
  intent: { allowed: boolean; explicit?: boolean; conditional?: boolean; reason: string };
  chase: { mode: 'land' | 'water' | 'air-to-land'; verdict: string; attackerSpeed: number; targetSpeed: number; speedMarginPct: number; attackerDurationSeconds: number; targetDurationSeconds: number; durationMarginPct: number; label: string };
  fight: { verdict: string; attackerCombatWeight: number; targetCombatWeight: number; attackerGroupLimit: number; targetDefenderLimit: number; attackerGroupUnlimited: boolean; targetDefendersUnlimited: boolean; soloWeightRatio: number; cappedPowerRatio: number | null; label: string };
  encounter: { level: 'frequent' | 'possible' | 'rare'; sharedRegions: string[]; overlap: number; label: string };
  facts: string[];
  evidence: Array<{ profileId: string; profileName: string; section: string; text: string }>;
}
export interface Matchups {
  schemaVersion: number;
  speedKnown: boolean;
  summary: string;
  threats: MatchupEntry[]; opportunities: MatchupEntry[];
  specialRisks: Array<{ title: string; summary: string; evidence: { profileId: string; profileName: string; section: string; text: string } }>;
  traits: { tier: string | null; diet: string | null; habitat: string | null; combatWeight: number | null; sprintSpeed: number | null; sprintDurationSeconds: number | null; waterSprintSpeed: number | null; airSprintSpeed: number | null; huntTier: string | null; huntGroupSize: number; engagementLimit: number; huntGroupUnlimited: boolean; engagementUnlimited: boolean; tags: string[]; excludedGroups: string[]; preferredGroups: string[] };
  methodology: { intent: string; pursuit: string; groups: string; encounter: string };
}
export interface MatchupsIndex { schemaVersion: number; generatedAt: string; speedKnown: boolean; dinos: Record<string, Matchups> }
export type AnalogRole = 'primary' | 'secondary';
export interface AnimalPhoto { image: string; focus: string; credit?: { artist: string; license: string; page: string } }
export interface IngameCover { file: string | null; kind: 'title-card' | 'skins' | 'unreviewed' | 'missing'; note: string | null }
export interface AnalogAnimal {
  id: string; animal: string; de: string | null; scientific: string | null;
  archetype: string; archetypeLabel: string; archetypeDe: string | null;
  share: number | null; role: AnalogRole; covers: string; photo: AnimalPhoto | null;
  relatives?: Array<{ id: string; name: string; role: AnalogRole; share: number | null; headline: string }>;
}
export interface VocabRef { id: string; label: string; de: string | null }
export interface AnalogFacts {
  tier: string | null; diet: string | null; activity: string | null; habitat: string | null;
  combatWeight: number | null; maxHealth: number | null; growthMinutes: number | null;
  landSprint: number | null; landSprintSeconds: number | null; waterSprint: number | null; airSprint: number | null;
  huntTier: string | null; huntGroupSize: number | 'unlimited' | null; engagementLimit: number | 'unlimited' | null;
  mapBiomes: string[]; isDry: boolean; isAquatic: boolean;
}
export interface ProfileAnalog {
  schemaVersion: number; source: string; reviewedAt: string | null;
  label: string; labelDe: string; headline: string; playsLike: string;
  setting: { label: string; note: string; habitats: VocabRef[] };
  analogs: AnalogAnimal[];
  why: Array<{ trait: string; text: string }>;
  notLike: string[]; twist: string; moods: VocabRef[];
  confidence: 'high' | 'medium'; officialInspiration: string | null; facts: AnalogFacts;
}
export interface CatalogAnalog {
  label: string; labelDe: string; headline: string;
  analogs: Array<Pick<AnalogAnimal, 'animal' | 'de' | 'archetype' | 'archetypeLabel' | 'archetypeDe' | 'share' | 'role' | 'photo'>>;
  moods: string[]; habitats: string[];
}
export interface VocabEntry { label: string; de: string; synonyms: string[] }
export interface AnalogIndex {
  schemaVersion: number; generatedAt: string; note: string;
  vocabulary: { archetypes: Record<string, VocabEntry>; moods: Record<string, VocabEntry>; habitats: Record<string, VocabEntry> };
  archetypes: Record<string, { label: string; de: string; dinos: Array<{ id: string; name: string; animal: string; role: AnalogRole; share: number | null; headline: string }> }>;
  animals: Record<string, { animal: string; de: string | null; scientific: string | null; archetype: string; dinos: Array<{ id: string; name: string; role: AnalogRole; share: number | null }> }>;
  moods: Record<string, { label: string; de: string; dinoIds: string[] }>;
  habitats: Record<string, { label: string; de: string; dinoIds: string[] }>;
  dinos: Record<string, {
    name: string; label: string; labelDe: string; headline: string; setting: string; habitats: string[];
    analogs: Array<{ id: string; animal: string; de: string | null; archetype: string; share: number | null; role: AnalogRole }>;
    moods: string[]; tier: string | null; diet: string | null; activity: string | null; classification: string | null;
  }>;
}
export interface AnalogSearchResult {
  query: string;
  matched: { archetypes: string[]; animals: string[]; moods: string[]; habitats: string[] };
  results: Array<{ id: string; name: string; score: number; label: string; labelDe: string; headline: string; setting: string; tier: string | null; diet: string | null; reasons: string[] }>;
}
export interface ProcessedProfile {
  schemaVersion: number; id: string; name: string; aliases: string[]; summary: string; credits: string[];
  classification: { tier: string | null; activity: string | null; habitat: string | null; diet: string | null; label: string | null };
  quickView: string[];
  stats: { growthTime: string | null; growthMinutes: number | null; combatWeight: number | null; changes: Array<{ text: string; current: string | null; previous: string | null; direction: 'up' | 'down' | 'changed' }>; sourceLabel: string };
  speed: SpeedStats;
  fullStats: FullStats;
  sections: Array<{ id: string; title: string; blocks: ContentBlock[] }>;
  videos: Array<{ id: string; url: string }>;
  media: ProcessedMedia[];
  ingame: IngameCover | null;
  ecosystem: ProfileEcosystem | null;
  map: ProfileMap | null;
  habitat: Habitat | null;
  matchups: Matchups | null;
  analog: ProfileAnalog | null;
  source: { importedAt: string; profileFile: string; statsSource: string };
}
export interface CatalogItem {
  id: string; name: string; aliases: string[]; summary: string; classification: ProcessedProfile['classification'];
  stats: { combatWeight: number | null; growthMinutes: number | null; changeCount: number };
  habitat: { classification: string | null; moisture: string[]; biomes: string[]; regions: number; isDry: boolean; hasMap: boolean } | null;
  matchups: { threats: number; opportunities: number } | null;
  analog: CatalogAnalog | null;
  ecosystem: { id: string; level: number; also: string[] } | null;
  cover: ProcessedMedia | null; importedAt: string;
}
export interface FoodChainLevel { level: number; label: string; de: string | null; rule?: string }
export interface ProfileEcosystem {
  id: string; label: string; de: string; reason: string;
  also: Array<{ id: string; label: string; de: string }>;
  foodChain: { level: number; label: string; de: string | null; derived: boolean; reason: string | null };
}
export interface EcosystemMember {
  rank: number; id: string; name: string; ecosystem: string; level: number; combatWeight: number | null; maxHealth: number | null;
  tier: string | null; diet: string | null; also: string[]; reason: string;
}
export interface Ecosystem {
  id: string; label: string; de: string; accent: string; symbol: string; description: string; count: number;
  foodChain: EcosystemMember[]; visitors: Array<{ id: string; name: string; level: number; home: string }>;
}
export interface EcosystemIndex { schemaVersion: number; generatedAt: string; levels: FoodChainLevel[]; ecosystems: Ecosystem[] }
export interface Catalog { schemaVersion: number; generatedAt: string; count: number; profiles: CatalogItem[] }
export interface RulesData {
  schemaVersion: number; id: string; title: string; introduction: ContentBlock[];
  sections: Array<{ id: string; number: number; title: string; rules: Array<{ number: string; text: string }> }>;
  media: ImageRecord[]; source: { importedAt: string; profileFile: string };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function result<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  list: async () => result<ProfileSummary[]>(await fetch('/api/profiles')),
  get: async (id: string) => result<ProfileDetail>(await fetch(`/api/profiles/${encodeURIComponent(id)}`)),
  save: async (form: FormData) => result<Manifest>(await fetch('/api/profiles', { method: 'POST', body: form })),
  remove: async (id: string) => {
    const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) await result(response);
  },
  imageUrl: (id: string, file: string) => `/api/profiles/${encodeURIComponent(id)}/images/${encodeURIComponent(file.split('/').pop() || '')}`,
  catalog: async () => result<Catalog>(await fetch('/api/catalog')),
  ecosystems: async () => result<EcosystemIndex>(await fetch('/api/ecosystems')),
  processedProfile: async (id: string) => result<ProcessedProfile>(await fetch(`/api/catalog/${encodeURIComponent(id)}`)),
  rules: async () => result<RulesData>(await fetch('/api/rules')),
  mapIndex: async () => result<MapIndex>(await fetch('/api/map-index')),
  matchups: async () => result<MatchupsIndex>(await fetch('/api/matchups')),
  analogs: async () => result<AnalogIndex>(await fetch('/api/analogs')),
  analogSearch: async (query: string, limit = 24) => result<AnalogSearchResult>(await fetch(`/api/analogs/search?q=${encodeURIComponent(query)}&limit=${limit}`)),
};
