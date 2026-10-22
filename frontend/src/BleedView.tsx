import { useState } from 'react';
import { type BleedHits, type BleedTable, type CatalogItem, type PlayMode } from './api';
import { DinoAvatar } from './DinoAvatar';
import './bleed.css';

// Bleed table: how many hits of the strongest bleeding attack bring each prey down when you bite
// and let go. "Läuft weg" = the prey trots off (bleed heals slower), "Setzt sich" = it sits down
// to heal (twice as fast). "Ohne Bleed" is the same attack counted on raw damage alone.

const SHOWN = 20;

function Hits({ value, max }: { value: BleedHits | null; max: number }) {
  if (!value) return <span className="bleed-hits none">{max}+</span>;
  return <span className="bleed-hits"><b>{value.hits}</b><small>{value.seconds} s</small></span>;
}

export function BleedView({ bleed, name, items, mode }: { bleed: BleedTable; name: string; items: Map<string, CatalogItem>; mode: PlayMode }) {
  const [all, setAll] = useState(false);
  const rows = all ? bleed.rows : bleed.rows.filter((row, index) => row.rank != null || index < SHOWN);
  const { attack } = bleed;
  const number = (value: number) => value.toLocaleString('de-DE');
  return <section className="bleed-view" id="bleed">
    <div className="detail-section-title"><span>BL</span><h2>Bleed · Bisse bis die Beute liegt</h2></div>
    <p className="bleed-attack" lang="de"><b>{attack.label}</b> · {number(attack.damage)} Schaden · {number(attack.bleed)} Bleed · alle {number(attack.cooldown)} s · {name} {bleed.setup.toLowerCase()}</p>
    <table className="bleed-table">
      <thead><tr><th>Beute</th><th title="Rang im Profil">Rang</th><th title="Nach dem letzten Biss trabt die Beute weg (heilt Bleed langsamer)">Läuft weg</th><th title="Nach dem letzten Biss setzt sie sich hin (heilt doppelt so schnell)">Setzt sich</th><th title="Dieselbe Attacke nur mit dem direkten Schaden">Ohne Bleed</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td><a href={`#/profiles/${row.id}`} className="bleed-prey"><DinoAvatar id={row.id} items={items} mode={mode} /><span>{row.name}{row.young && <i title="Laut Profil nur Jungtiere">nur Jung</i>}</span></a></td>
        <td><span className={`bleed-rank ${row.rank != null ? 'fav' : ''}`}>{row.rank ?? (row.kind === 'special' ? '◇' : '•')}</span></td>
        <td><Hits value={row.trot} max={bleed.maxHits} /></td>
        <td><Hits value={row.sit} max={bleed.maxHits} /></td>
        <td><span className={`bleed-hits raw ${row.trot && row.trot.hits < row.direct ? 'saved' : ''}`}><b>{row.direct}</b></span></td>
      </tr>)}</tbody>
    </table>
    {bleed.rows.length > rows.length || all ? <button type="button" className="bleed-more" onClick={() => setAll(value => !value)}>{all ? 'Weniger zeigen' : `Alle ${bleed.rows.length} zeigen`}</button> : null}
    <p className="bleed-note" lang="de">Erwachsene Tiere, jeder Biss trifft, die Beute schlägt nicht zurück. Bleed = Wert × dein CW ÷ ihr CW, ignoriert Rüstung, stapelt und blockiert ihre Heilung. Wie viel HP ein Bleed-Punkt pro Sekunde kostet, ist nicht offiziell: angenommen sind 1 % der Max-HP pro Punkt und Sekunde. Zeit = vom ersten Biss, bis sie liegt.</p>
  </section>;
}
