import { ApiError } from './api';

export interface HerdScreenshot { file: string; originalFileName: string; addedAt: string; processedAt: string | null; transcript: string }
export interface HerdGenetics {
  bloodlines: string[];
  skins: { dominant: string[]; recessive: string[] };
  mutations: Array<{ name: string; note: string }>;
  extra: Array<{ label: string; value: string }>;
  updatedAt: string;
}
export interface HerdBond { name: string; sex: 'female' | 'male' | null; kind: string; status: string; note: string }
export interface HerdCharacter { traits: string[]; text: string }
export interface HerdDino {
  schemaVersion: number; id: string; name: string; playableId: string | null; sex: 'female' | 'male' | null;
  photo: string | null; proofs: { mutation: string; nesting: string }; notes: string;
  genetics: HerdGenetics | null; bonds?: HerdBond[]; character?: HerdCharacter;
  screenshots: HerdScreenshot[]; createdAt: string; updatedAt: string;
}
export type HerdPatch = Partial<Pick<HerdDino, 'name' | 'playableId' | 'sex' | 'notes' | 'proofs' | 'bonds' | 'character'>> & { genetics?: Omit<HerdGenetics, 'updatedAt'> | null };

async function result<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const herdApi = {
  list: async (playable?: string) => result<HerdDino[]>(await fetch(`/api/herd${playable ? `?playable=${encodeURIComponent(playable)}` : ''}`)),
  get: async (id: string) => result<HerdDino>(await fetch(`/api/herd/${encodeURIComponent(id)}`)),
  upload: async (form: FormData) => result<HerdDino>(await fetch('/api/herd', { method: 'POST', body: form })),
  update: async (id: string, patch: HerdPatch) => result<HerdDino>(await fetch(`/api/herd/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })),
  removeFile: async (id: string, file: string) => result<HerdDino>(await fetch(`/api/herd/${encodeURIComponent(id)}/files/${file}`, { method: 'DELETE' })),
  remove: async (id: string) => {
    const response = await fetch(`/api/herd/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) await result(response);
  },
  fileUrl: (dino: Pick<HerdDino, 'id'>, file: string) => `/api/herd/${encodeURIComponent(dino.id)}/files/${file}`,
};

export const pendingCount = (dino: HerdDino) => dino.screenshots.filter(shot => !shot.processedAt).length;
// Older records were saved before bonds and character existed.
export const bondsOf = (dino: HerdDino) => dino.bonds || [];
export const characterOf = (dino: HerdDino): HerdCharacter => dino.character || { traits: [], text: '' };
export const sexSymbol = (sex: HerdDino['sex']) => sex === 'female' ? '♀' : sex === 'male' ? '♂' : '';

// Discord web links (discord.com, ptb./canary., discordapp.com) open in the desktop app via its own protocol.
const discordWeb = /^https?:\/\/(?:(?:www|ptb|canary)\.)?discord(?:app)?\.com(\/[^\s]*)?$/i;
export const isDiscordUrl = (url: string) => discordWeb.test(url.trim());
export const linkHref = (url: string) => {
  const match = url.trim().match(discordWeb);
  return match ? `discord://-${match[1] || '/'}` : url.trim();
};
