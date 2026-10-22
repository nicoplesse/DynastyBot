// The Isle (Evrima) short profiles: a separate game, served from data/isle/ by /api/isle.
import { ApiError } from './api';

export type IsleDiet = 'carnivore' | 'herbivore' | 'omnivore';
export type IsleStageId = 'hatchling' | 'juvenile' | 'subadult' | 'adult';
export type IsleNutrientId = 'alpha' | 'beta' | 'gamma';

export interface IsleStage { id: IsleStageId; label: string; range: string; text: string }
export interface IsleNutrient { id: IsleNutrientId; symbol: string; label: string; en: string; bonus: string }
export interface IsleTopic { id: string; title: string; text: string }
export interface IsleSource { label: string; url: string }
export interface IsleBasics {
  game: string; branch: string; patch: string; patchDate: string; reviewedAt: string; intro: string;
  stages: IsleStage[]; nutrients: IsleNutrient[]; topics: IsleTopic[];
  keys: Array<{ keys: string; text: string }>; upcoming: string; sources: IsleSource[];
}
export interface IsleStats {
  adultWeightKg: number; primeWeightKg?: number; sprintKmh: number; bite: number; groupLimit: number;
  nest: 'mound' | 'debris'; eggs: number; hungerMinutes: number; thirstMinutes: number;
  growthMinutes: Record<IsleStageId, number | null>;
}
export type IsleTraitId = 'activity' | 'range' | 'social' | 'rest';
export type IslePhase = 'dawn' | 'day' | 'dusk' | 'night';
export type IsleThreatLevel = 'high' | 'medium' | 'low';
export interface IsleThreat { name: string; id?: string; level: IsleThreatLevel; where: string; answer: string }
// Natural behaviour, reasoned from the game's mechanics: what the animal needs, what kills it,
// and what follows from both for its place, its day and its group.
export interface IsleBehavior {
  essence: string; traits: Record<IsleTraitId, string>; needs: string; threats: IsleThreat[];
  logic: Array<{ because: string; so: string }>; home: string;
  day: Array<{ phase: IslePhase; text: string }>; group: string; analog: { animals: string; text: string };
}
// Optional route to Prime Elder for one playable, distilled from current creator videos.
export interface IslePrimeVideo { channel: string; title: string; date: string; url: string }
export interface IslePrime {
  summary: string; steps: Array<{ title: string; when: string; text: string }>;
  afterPrime: string; pitfalls: string[]; videos: IslePrimeVideo[]; checkedAt: string;
}
export interface IsleSummary {
  id: string; name: string; nickname: string | null; diet: IsleDiet; role: string; tagline: string; since: string | null; order: number;
  growthTotalMinutes: number | null; essence: string; traits: IsleBehavior['traits'];
  stats: Pick<IsleStats, 'adultWeightKg' | 'sprintKmh' | 'groupLimit'>;
}
export interface IsleLink { id: string; name: string; diet: IsleDiet; nutrient: IsleNutrientId }
export interface IslePlayable extends Omit<IsleSummary, 'stats'> {
  summary: string; stats: IsleStats; nutrients: Record<IsleNutrientId, string[]>;
  behavior: IsleBehavior;
  hunt: { title: string; text: string };
  growth: Array<{ stage: IsleStageId; text: string }>;
  abilities: Array<{ keys: string; name: string; text: string }>;
  tips: string[]; notes?: string[]; prime?: IslePrime; sources: IsleSource[];
  eats: IsleLink[]; eatenBy: IsleLink[];
  position: number; count: number; previous: IsleSummary; next: IsleSummary;
}
export interface IsleIndex { basics: IsleBasics; count: number; playables: IsleSummary[] }

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

let indexRequest: Promise<IsleIndex> | null = null;
export const isleApi = {
  // The index is small and static while the app runs, so one request serves every page.
  index: () => (indexRequest ||= fetch('/api/isle').then(response => json<IsleIndex>(response)).catch(error => { indexRequest = null; throw error; })),
  playable: async (id: string) => json<IslePlayable>(await fetch(`/api/isle/${encodeURIComponent(id)}`)),
};

export const dietLabels: Record<IsleDiet, string> = { carnivore: 'Fleischfresser', herbivore: 'Pflanzenfresser', omnivore: 'Allesfresser' };
export const nestLabels: Record<IsleStats['nest'], string> = { mound: 'Erdhügel', debris: 'Reisignest' };
export const traitLabels: Record<IsleTraitId, string> = { activity: 'Aktiv', range: 'Raum', social: 'Sozial', rest: 'Schlaf' };
export const phaseLabels: Record<IslePhase, string> = { dawn: 'Morgen', day: 'Tag', dusk: 'Abend', night: 'Nacht' };
export const threatLabels: Record<IsleThreatLevel, string> = { high: 'Lebensgefahr', medium: 'Gefahr', low: 'Vorsicht' };

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null) return 'unbekannt';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatWeight(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t` : `${kg.toLocaleString('de-DE')} kg`;
}

export function formatNumber(value: number) { return value.toLocaleString('de-DE', { maximumFractionDigits: 1 }); }
