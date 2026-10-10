export type GroupChoice = number | 'max';
export type BleedModel = 'off' | 'assumed';
export type FightVerdict = 'attacker-advantage' | 'close' | 'defender-advantage';

export interface AttackRef { label: string; damage: number; cooldown: number; situational?: boolean }
export interface CombatStats {
  id: string; name: string; cw: number; hp: number; armor: number; dps: number;
  primary: AttackRef | null; burst: AttackRef | null; attacks: string[];
  bleedPerSecond: number; bleedHealRate: number; estimated: boolean;
  huntLimit: number; huntUnlimited: boolean; engagementLimit: number; engagementUnlimited: boolean;
}
export interface CombatSide extends CombatStats { limit: number; unlimited: boolean }

export interface FightSim {
  winner: 'attacker' | 'defender' | 'none'; seconds: number;
  attackersLeft: number; defendersLeft: number; attackerHpShare: number; defenderHpShare: number;
  firstDown: { side: 'attacker' | 'defender'; seconds: number } | null;
}
export interface DuelNumbers {
  attackerHit: number; defenderHit: number; attackerBurst: number; defenderBurst: number;
  attackerHitsToKill: number | null; defenderHitsToKill: number | null;
  attackerDps: number; defenderDps: number; attackerTimeToKill: number | null; defenderTimeToKill: number | null;
  attackerBleed: number; defenderBleed: number; attackerBleedOutpacesHeal: boolean; defenderBleedOutpacesHeal: boolean;
}
export interface FightResult {
  attackers: number | null; defenders: number | null; attackerChoice: GroupChoice; defenderChoice: GroupChoice;
  bleed: BleedModel; duel: DuelNumbers; verdict: FightVerdict; sim: FightSim | null; label: string; detail?: string;
}
export interface EntryCore {
  direction: 'threat' | 'opportunity'; attackerName: string; targetName: string; chaseVerdict: string; chaseLabel: string;
  baseScore: number; scoreCap: number | null; conditional: boolean; explicit: boolean; relationKind: string | null; summaryLead: string;
}
export type MatchupBand = 'severe' | 'high' | 'meaningful' | 'conditional';

export const FIGHT_POINTS: Record<FightVerdict, number>;
export const HIDE_BELOW_SCORE: number;
export const MAX_PICKABLE_GROUP: number;
export const ASSUMED_BLEED_SHARE: number;
export function combatSide(stats: CombatStats, role: 'attacker' | 'defender'): CombatSide;
export function hitOn(attacker: { cw: number }, victim: { cw: number; armor: number }, damage: number): number;
export function dpsOn(attacker: CombatSide, victim: CombatSide): number;
export function bleedOn(attacker: CombatSide, victim: CombatSide): number;
export function simulateFight(attacker: CombatSide, attackers: number, defender: CombatSide, defenders: number, options?: { bleed?: BleedModel }): FightSim;
export function duelNumbers(attacker: CombatSide, defender: CombatSide): DuelNumbers;
export function resolveCount(choice: GroupChoice, side: { limit: number; unlimited: boolean }): number | null;
export function evaluateFight(attacker: CombatSide, defender: CombatSide, attackerChoice: GroupChoice, defenderChoice: GroupChoice, options?: { bleed?: BleedModel }): FightResult;
export function dangerBand(score: number, conditional: boolean): MatchupBand;
export function presentEntry(core: EntryCore, fight: { verdict: FightVerdict; label: string }): { score: number; band: MatchupBand; headline: string; kind: string; summary: string; visible: boolean };
export function survivalSummary(name: string, threats: Array<{ band: MatchupBand; chase: { verdict: string } }>, setup: string): string;
