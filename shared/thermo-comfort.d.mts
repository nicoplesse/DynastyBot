export type ComfortLevel = 'cold' | 'cool' | 'ok' | 'warm' | 'hot';
export interface Comfort { level: ComfortLevel; best: ComfortLevel; refuge: 'shade' | 'den' | 'water' | null; resting: boolean; side: 'heat' | 'cold' | null }
export declare const LEVELS: ComfortLevel[];
export declare function levelOf(band: number[], value: number): ComfortLevel;
export declare function bodyTemps(values: { air: number; feel: number; feelSun?: number | null; ground?: number | null }, ectotherm: boolean): { open: number; shade: number };
export declare const inWater: (temperature: number, ectotherm: boolean) => number;
export declare function comfort(band: number[], options: { open: number; shade: number; den?: number | null; water?: { cool: number; warm: number } | null; ectotherm?: boolean; resting?: boolean }): Comfort;
export declare const ACTIVE_HOURS: Record<string, [number, number][]>;
export declare function isActive(activity: string | null | undefined, hour: number): boolean;
