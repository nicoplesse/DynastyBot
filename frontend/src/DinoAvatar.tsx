import { api, type CatalogItem, type PlayMode } from './api';
import { catalogAnalog } from './PlayMode';
import './dino-avatar.css';

// Round photo of the real animal a playable mostly plays like (current solo/group mode); the
// in-game cover is the fallback.
export function DinoAvatar({ id, items, mode, size = 'sm' }: { id: string; items: Map<string, CatalogItem>; mode: PlayMode; size?: 'xs' | 'sm' | 'lg' }) {
  const item = items.get(id);
  const main = item ? catalogAnalog(item, mode)?.analogs[0] : null;
  const title = item ? `${item.name}${main ? ` ≈ ${main.de || main.animal}` : ''}` : id;
  return <span className={`dino-avatar ${size}`} title={title}>
    {main?.photo ? <img src={main.photo.image} alt="" style={{ objectPosition: main.photo.focus }} loading="lazy" referrerPolicy="no-referrer" />
      : item?.cover ? <img src={api.imageUrl(id, item.cover.file)} alt="" loading="lazy" /> : <b>{(item?.name || id).charAt(0)}</b>}
  </span>;
}
