import { api, type AnalogAnimal, type ProcessedProfile } from './api';
import './showcase.css';

function shortArtist(artist: string) {
  return artist.length > 42 ? `${artist.slice(0, 40).trim()}…` : artist;
}

function AnimalTile({ analog, index, onOpen }: { analog: AnalogAnimal; index: number; onOpen: (url: string) => void }) {
  const photo = analog.photo;
  const label = index === 0 ? 'Main animal' : 'Second animal';
  return <figure className={`showcase-tile showcase-animal role-${analog.role}`}>
    <button type="button" className="showcase-open" onClick={() => photo && onOpen(photo.image)} aria-label={`Show ${analog.animal} photo full size`} disabled={!photo}>
      {photo ? <img src={photo.image} alt={analog.animal} style={{ objectPosition: photo.focus }} loading={index === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" /> : <span className="showcase-fallback">{analog.animal.charAt(0)}</span>}
    </button>
    <figcaption>
      <span className="showcase-kicker"><b>{index + 1}</b>{label}{analog.share != null && <i>{analog.share}%</i>}</span>
      <strong>{analog.animal}</strong>
      {analog.de && analog.de !== analog.animal && <span className="showcase-de" lang="de">{analog.de}</span>}
    </figcaption>
    {photo?.credit && <a className="showcase-credit" href={photo.credit.page} target="_blank" rel="noreferrer" title={`${photo.credit.artist} · ${photo.credit.license} · Wikimedia Commons`}>Photo: {shortArtist(photo.credit.artist)} · {photo.credit.license}</a>}
  </figure>;
}

// Profile header gallery: the real animal it mostly plays like, the second animal when the profile
// is a mix, then Dynasty's in-game title card, so the choice "which animal do I want to play" is
// made from the first screen.
export function ProfileShowcase({ profile, onOpen }: { profile: ProcessedProfile; onOpen: (url: string) => void }) {
  const animals = profile.analog?.analogs || [];
  const ingameUrl = profile.ingame?.file ? api.imageUrl(profile.id, profile.ingame.file) : null;
  const layout = `animals-${animals.length}${ingameUrl ? '' : ' no-ingame'}`;
  return <div className={`showcase-grid ${layout}`}>
    {animals.map((analog, index) => <AnimalTile key={analog.id} analog={analog} index={index} onOpen={onOpen} />)}
    <figure className="showcase-tile showcase-ingame">
      {ingameUrl
        ? <button type="button" className="showcase-open" onClick={() => onOpen(ingameUrl)} aria-label={`Show ${profile.name} in-game title card full size`}><img src={ingameUrl} alt={`${profile.name} in game`} /></button>
        : <div className="showcase-missing"><strong>{profile.name}</strong><span>No in-game title card uploaded yet.</span></div>}
      <span className="showcase-kicker showcase-ingame-tag"><b>{animals.length + 1}</b>In game{profile.ingame?.kind === 'skins' ? ' · skins' : ''}</span>
    </figure>
  </div>;
}
