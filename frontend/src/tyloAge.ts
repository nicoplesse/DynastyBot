// Age of an own Tylosaurus in "orca years", from two things only: the real days it lives and its clutches.
//
//   Alter = A_reif · (1 − e^(−d/τ))  +  j · c_eff
//   c_eff = min(c, 20 · d / T_min, 20)     j = (A_max − A_reif) / 20     τ = T_min / 2
//
// The first part is youth: it climbs fast and stops at sexual maturity, so a Tylo without a clutch stays young
// however long it lives. Each clutch then adds a fixed share of the rest of an orca-like life (cow 4.4 years,
// bull 2.25). c_eff never counts more clutches than the days allow at the fastest pace (20 clutches in 14 days
// for a cow, 7 for a bull), and τ = T_min / 2 lets both sexes arrive at about 98 % of their maximum at that pace.

export type TyloSex = 'female' | 'male';

export const tyloAgeRules: Record<TyloSex, { max: number; mature: number; fastest: number }> = {
  female: { max: 100, mature: 12, fastest: 14 }, // orca cows: mature ~12, up to ~100 years
  male: { max: 60, mature: 15, fastest: 7 }, // orca bulls: mature ~15, up to ~60 years
};
export const maxClutches = 20;

export interface TyloAge {
  years: number; // unrounded
  days: number; // real days counted
  clutches: number; // as recorded
  counted: number; // c_eff after the pace limit
  youth: number; // years from the days
  breeding: number; // years from the clutches
  stage: string;
  fromHatch: boolean; // false = counted from the day it joined the register
}

const dayNumber = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function tyloAge({ sex, hatchedAt, createdAt, diedAt, clutches }: { sex: TyloSex | null; hatchedAt?: string; createdAt: string; diedAt?: string; clutches: number }, today = new Date()): TyloAge | null {
  if (!sex) return null;
  const rules = tyloAgeRules[sex];
  const start = hatchedAt || localDay(new Date(createdAt));
  const end = diedAt || localDay(today);
  const days = Math.max(0, dayNumber(end) - dayNumber(start));
  const c = Math.max(0, Math.min(maxClutches, Math.floor(clutches) || 0));
  const counted = Math.min(c, (maxClutches * days) / rules.fastest);
  const youth = rules.mature * (1 - Math.exp(-days / (rules.fastest / 2)));
  const breeding = ((rules.max - rules.mature) / maxClutches) * counted;
  const years = youth + breeding;
  return { years, days, clutches: c, counted, youth, breeding, stage: stageOf(sex, years), fromHatch: !!hatchedAt };
}

function stageOf(sex: TyloSex, years: number) {
  const { max, mature } = tyloAgeRules[sex];
  if (years < 1) return 'Kalb';
  if (years < mature) return sex === 'female' ? 'Jungkuh' : 'Jungbulle';
  if (years >= max * 0.8) return sex === 'female' ? 'Matriarchin' : 'alter Bulle';
  return sex === 'female' ? 'erwachsene Kuh' : 'erwachsener Bulle';
}

export const formatYears = (age: TyloAge) => age.years < 1 ? 'unter 1 Jahr' : `${Math.round(age.years)} Jahre`;
