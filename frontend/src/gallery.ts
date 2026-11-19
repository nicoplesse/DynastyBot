import { ApiError } from './api';

// Where an image is used: as a dino's photo, or as the evidence photo of a notable kill.
export interface GalleryUse { dinoId: string; dinoName: string; kind: 'photo' | 'event'; date?: string; subject?: string }
// One image in data/gallery/. Without dinos, species or the background flag it is unclassified.
export interface GalleryImage {
  file: string; dinos: string[]; species: string[]; background: boolean; caption: string;
  addedAt: string; originalFileName: string; size: number; classified: boolean; uses: GalleryUse[];
}
export interface GalleryPatch { dinos?: string[]; species?: string[]; background?: boolean; caption?: string }

async function result<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

const path = (file: string) => encodeURIComponent(file);
export const galleryFileUrl = (file: string) => `/api/gallery/files/${path(file)}`;

export const galleryApi = {
  list: async () => result<{ folder: string; images: GalleryImage[] }>(await fetch('/api/gallery')),
  upload: async (files: File[]) => {
    const form = new FormData();
    files.forEach(file => form.append('images', file, file.name));
    return result<GalleryImage[]>(await fetch('/api/gallery', { method: 'POST', body: form }));
  },
  update: async (file: string, patch: GalleryPatch) => result<GalleryImage>(await fetch(`/api/gallery/${path(file)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })),
  remove: async (file: string) => result<{ unlinked: GalleryUse[] }>(await fetch(`/api/gallery/${path(file)}`, { method: 'DELETE' })),
};
