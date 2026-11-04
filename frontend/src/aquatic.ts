// Aquatic Update: the user's own server suggestion, served from the Markdown drafts in
// projects/aquatic-update/ by /api/aquatic.
import { ApiError } from './api';

export type AquaticSide = 'prey' | 'giant' | 'hunter';
export type AquaticListItem = { text: string; children?: AquaticListBlock };
export type AquaticListBlock = { type: 'list'; ordered: boolean; items: AquaticListItem[] };
export type AquaticBlock =
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | AquaticListBlock
  | { type: 'table'; header: string[]; rows: string[][] };

export interface AquaticStats {
  cw: number; health: number; healthNote?: string; armor: number; heal: number; dps: number;
  // null: not read from the game files yet (a mod that is not downloaded).
  swim: number | null; sprint: number | null; oxygen: string;
  // Movement from the blueprints: water acceleration and sprint time; type decides agility in water.
  type: 'Aquatic' | 'Semi-Aquatic'; sprintTime: string; accel: number | null;
}
// A species outside the suggestion that still matters to it (Sarcosuchus), shown for comparison only.
export interface AquaticExtra { id: string; name: string; nickname: string; side: AquaticSide; note: string; stats: AquaticStats }
export type RelationKind = 'hunt' | 'limited' | 'rival' | 'defend' | 'flee' | 'group' | 'ignore' | 'none';
export interface AquaticRelations {
  kinds: Record<RelationKind, string>;
  order: string[];
  relations: Record<string, Record<string, [RelationKind, string]>>;
}
export interface AquaticSummary {
  id: string; name: string; nickname: string; order: number; side: AquaticSide; kind: 'new' | 'changed';
  role: string; classification: string; activity: string; analog: string; home: string; group: string; essence: string;
  dynastyProfile: string | null; mod: { name: string; id?: string } | null;
  stats: AquaticStats; changes: Array<{ label: string; from: string; to: string }>;
}
export interface AquaticDraft {
  title: string; overview: AquaticBlock[]; profile: AquaticBlock[]; markdown: string;
  toc: Array<{ id: string; title: string }>;
}
export interface AquaticProfile extends AquaticSummary {
  draft: AquaticDraft; position: number; count: number; previous: AquaticSummary; next: AquaticSummary;
}
export type HabitatRole = 'home' | 'route' | 'trip' | 'territory' | 'front' | 'nest';
type Point = [number, number];
export interface HabitatArea { id: string; name: string; zone: string; points: Point[]; anchor: Point }
export interface HabitatTerritory { id: string; name: string; label: string; parent: string; cut: number; points: Point[]; anchor: Point }
export interface HabitatSpecies { id: string; route?: boolean; territories?: boolean; text: string; areas: Array<{ id: string; roles: HabitatRole[] }> }
// Who lives where, from projects/aquatic-update/profile-entwuerfe/lebensraum.json on the traced POI outlines.
export interface AquaticHabitat {
  // The part of the shared map the panel shows, in normalized map coordinates.
  view: { x: number; y: number; width: number; height: number };
  roles: Record<HabitatRole, string>;
  zones: Array<{ id: string; label: string; text: string; areas: string[] }>;
  areas: HabitatArea[];
  territories: HabitatTerritory[];
  route: { label: string; layer: string; text: string };
  species: HabitatSpecies[];
}
export interface AquaticIndex {
  title: string; status: string; updatedAt: string; intro: string;
  sides: Array<{ id: AquaticSide; label: string; text: string }>;
  rules: Array<{ title: string; text: string }>;
  count: number; profiles: AquaticSummary[]; habitat: AquaticHabitat;
  extras: AquaticExtra[]; relations: AquaticRelations;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const aquaticApi = {
  // The drafts change while the suggestion is written, so every visit reads them fresh.
  index: async () => json<AquaticIndex>(await fetch('/api/aquatic')),
  profile: async (id: string) => json<AquaticProfile>(await fetch(`/api/aquatic/${encodeURIComponent(id)}`)),
};

export const sideLabels: Record<AquaticSide, string> = { prey: 'Beute-Seite', giant: 'Sanfter Riese', hunter: 'Jäger' };

// Path of Titans: hit = damage × (attacker CW ÷ victim CW) ÷ victim armour.
export function secondsToKill(attacker: AquaticStats, victim: AquaticStats) {
  return victim.health * victim.armor / (attacker.dps * attacker.cw / victim.cw);
}

export function formatDecimal(value: number) { return value.toLocaleString('de-DE', { maximumFractionDigits: 2 }); }
