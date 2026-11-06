// Aquatic staging: every profile of the suggestion as a Discord forum thread, served from
// projects/aquatic-update/staging/ by /api/staging.
import { ApiError } from './api';

export type StagingMessage =
  | { type: 'text'; header: boolean; text: string; copy: string; chars: number; changed: boolean }
  | { type: 'banner'; header: boolean; title: string; id: string }
  | { type: 'image'; header: boolean; caption: string }
  | { type: 'titlecard'; header: boolean }
  | { type: 'quicklinks'; header: boolean }
  | { type: 'note'; header: boolean; text: string };

export interface StagingRaster {
  items: Array<{ group: string; label: string; ok: boolean }>;
  inOrder: boolean;
  missing: string[];
}

export interface StagingSummary {
  id: string; name: string; title: string; nickname: string | null; order: number; kind: 'new' | 'changed';
  card: string; difficulty: number | null; difficultyLabel: string | null; cover: string | null; source: string | null;
  classification: string | null; notes: string[]; chars: number; textMessages: number; overLimit: number; updatedAt: string;
  raster: { inOrder: boolean; missing: string[] };
}

export interface StagingThread extends Omit<StagingSummary, 'raster'> {
  messages: StagingMessage[];
  outline: Array<{ level: number; title: string; id: string }>;
  links: Array<{ title: string; id: string }>;
  raster: StagingRaster;
  limit: number; position: number; count: number;
}

export interface StagingIndex {
  limit: number;
  raster: Array<{ group: string; label: string }>;
  count: number;
  threads: StagingSummary[];
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const stagingApi = {
  // The profiles change while the suggestion is written, so every visit reads them fresh.
  index: async () => json<StagingIndex>(await fetch('/api/staging')),
  thread: async (id: string) => json<StagingThread>(await fetch(`/api/staging/${encodeURIComponent(id)}`)),
};
