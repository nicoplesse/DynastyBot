import { useSyncExternalStore } from 'react';
import { type CatalogAnalog, type CatalogItem, type ModeVerdict, type PlayMode, type ProcessedProfile, type ProfileAnalog } from './api';
import './play-mode.css';

// Solo or group: one switch for the whole archive. Profiles whose real animal changes when you
// play in a group (or alone) show the matching analog; the others look the same in both modes.
const KEY = 'dynasty.playMode';
const listeners = new Set<() => void>();

function stored(): PlayMode {
  try { return window.localStorage.getItem(KEY) === 'group' ? 'group' : 'solo'; } catch { return 'solo'; }
}

let current: PlayMode = stored();

export function setPlayMode(mode: PlayMode) {
  current = mode;
  try { window.localStorage.setItem(KEY, mode); } catch { /* per-viewer convenience only */ }
  listeners.forEach(listener => listener());
}

export function usePlayMode(): PlayMode {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current);
}

export const modeLabels: Record<PlayMode, string> = { solo: 'Solo', group: 'Gruppe' };
export const verdictLabels: Record<ModeVerdict, string> = { same: 'Gleiches Tier', rebalanced: 'Anders gewichtet', different: 'Anderes Tier' };

export function profileAnalog(profile: ProcessedProfile, mode: PlayMode): ProfileAnalog | null {
  return profile.modes?.[mode].analog ?? profile.analog;
}

export function catalogAnalog(profile: CatalogItem, mode: PlayMode): CatalogAnalog | null {
  return profile.modes?.[mode] ?? profile.analog;
}

const flagLabels: Record<ModeVerdict, string> = { same: '', rebalanced: 'umgewichtet', different: 'anderes Tier' };

// Small flag for a card whose animal in the current mode differs from the other mode.
export function ModeFlag({ modes, mode }: { modes: CatalogItem['modes']; mode: PlayMode }) {
  if (!modes?.[mode]) return null;
  return <span className={`mode-flag verdict-${modes.verdict}`} title={`${modeLabels[mode]}: ${verdictLabels[modes.verdict]}. ${modes.note}`}>
    <i aria-hidden="true">◐</i>{modeLabels[mode]}: {flagLabels[modes.verdict]}
  </span>;
}

export function PlayModeSwitch({ compact = false }: { compact?: boolean }) {
  const mode = usePlayMode();
  const group = mode === 'group';
  return <button type="button" role="switch" aria-checked={group} className={`play-mode-switch ${compact ? 'compact' : ''} mode-${mode}`}
    onClick={() => setPlayMode(group ? 'solo' : 'group')}
    title={group ? 'Gruppenmodus an: Profile zeigen das Tier für das Spiel in der Gruppe. Klicken für Solo.' : 'Solo: Profile zeigen das Tier für das Spiel allein. Klicken für Gruppe.'}>
    <span className={group ? '' : 'on'}>Solo</span>
    <i aria-hidden="true"><b /></i>
    <span className={group ? 'on' : ''}>Gruppe</span>
  </button>;
}
