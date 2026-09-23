import { type AnalogFacts, type ProfileAnalog } from './api';
import './plays-like.css';

function go(path: string) { window.location.hash = `#${path}`; }

function number(value: number | null) { return value == null ? '—' : value.toLocaleString('en-US'); }

function factTiles(facts: AnalogFacts) {
  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Tier', value: facts.tier || '—', hint: [facts.activity, facts.diet].filter(Boolean).join(' · ') },
    { label: 'Combat weight', value: number(facts.combatWeight), hint: facts.maxHealth ? `${number(facts.maxHealth)} HP adult` : undefined },
    { label: 'Land sprint', value: number(facts.landSprint), hint: facts.landSprintSeconds ? `${Math.round(facts.landSprintSeconds)} s stamina` : undefined },
  ];
  if (facts.waterSprint) tiles.push({ label: 'Water sprint', value: number(facts.waterSprint) });
  if (facts.airSprint) tiles.push({ label: 'Air sprint', value: number(facts.airSprint) });
  if (facts.diet !== 'Herbivore') tiles.push({ label: 'Hunt ceiling', value: facts.huntTier || 'None', hint: facts.huntGroupSize === 1 ? 'hunts alone' : facts.huntGroupSize ? `hunting party up to ${facts.huntGroupSize}` : undefined });
  return tiles;
}

export function PlaysLikeView({ analog, name }: { analog: ProfileAnalog; name: string }) {
  const primary = analog.analogs[0];
  return <section className="plays-like" id="plays-like">
    <div className="detail-section-title"><span>≈</span><h2>Plays Like</h2></div>
    <div className="pl-brief">
      <div className="pl-brief-copy">
        <span className="source-kicker">REAL-ANIMAL ANALOG · {analog.analogs.length > 1 ? 'MIX OF TWO' : 'ONE ANIMAL'}</span>
        <h3>{name} plays like <em>{analog.label}</em></h3>
        <p className="pl-de" lang="de">{analog.labelDe}</p>
        <p className="pl-headline">{analog.headline}</p>
      </div>
      <div className="pl-share" aria-label="How much of each animal">
        <div className="pl-share-bar">{analog.analogs.map(item => <span key={item.id} className={`role-${item.role}`} style={{ flexGrow: item.share || 1 }} title={`${item.animal} · ${item.share}%`} />)}</div>
        <div className="pl-animals">{analog.analogs.map(item => <button type="button" key={item.id} className={`pl-animal role-${item.role}`} onClick={() => go(`/animals?archetype=${encodeURIComponent(item.archetype)}`)} title={`Show every playable that plays like a ${item.archetypeLabel.toLowerCase()}`}>
          <span className="pl-animal-top"><b>{item.animal}</b><i>{item.share}%</i></span>
          <span className="pl-animal-de" lang="de">{item.de}{item.scientific && <em> · {item.scientific}</em>}</span>
          <span className="pl-animal-family">{item.archetypeLabel}{item.archetypeDe ? ` · ${item.archetypeDe}` : ''} ↗</span>
          <span className="pl-animal-covers">{item.covers}</span>
        </button>)}</div>
        {analog.analogs.some(item => item.relatives?.length) && <div className="pl-relatives"><span className="pl-label">SAME ANIMAL, DIFFERENT PLAYABLE</span>{analog.analogs.flatMap(item => (item.relatives || []).map(relative => <button type="button" key={`${item.id}-${relative.id}`} onClick={() => go(`/profiles/${relative.id}`)} title={relative.headline}><b>{relative.name}</b> is {relative.role === 'primary' ? 'mainly' : 'partly'} a {item.animal.replace(/\s*\(.*\)$/, '').toLowerCase()}: <span>{relative.headline}</span></button>))}</div>}
      </div>
    </div>
    <p className="pl-plays">{analog.playsLike}</p>
    <div className="pl-setting">
      <div><span className="pl-label">WHERE IT LIVES</span><strong>{analog.setting.label}</strong><p>{analog.setting.note}</p></div>
      <div className="pl-chips">{analog.setting.habitats.map(habitat => <button type="button" key={habitat.id} onClick={() => go(`/animals?habitat=${habitat.id}`)}>{habitat.label}</button>)}</div>
    </div>
    <div className="pl-facts" aria-label="Profile stats behind the comparison">{factTiles(analog.facts).map(tile => <span key={tile.label}><small>{tile.label.toUpperCase()}</small><strong>{tile.value}</strong>{tile.hint && <em>{tile.hint}</em>}</span>)}</div>
    <div className="pl-columns">
      <div className="pl-why"><h4>Why this animal</h4><ul>{analog.why.map((item, index) => <li key={index}><b>{item.trait}</b><p>{item.text}</p></li>)}</ul></div>
      <div className="pl-side">
        {analog.notLike.length > 0 && <div className="pl-notlike"><h4>Where the comparison breaks</h4><ul>{analog.notLike.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {analog.twist && <div className="pl-twist"><h4>Extra flavour</h4><p>{analog.twist}</p></div>}
        <div className="pl-moods"><h4>Play feel</h4><div className="pl-chips">{analog.moods.map(mood => <button type="button" key={mood.id} onClick={() => go(`/animals?mood=${mood.id}`)}>{mood.label}</button>)}</div></div>
      </div>
    </div>
    <footer className="pl-foot">
      {analog.officialInspiration ? <span>Official profile inspiration: <b>{analog.officialInspiration}</b></span> : <span>No official inspiration is listed in this profile.</span>}
      <span>Curated analog{analog.reviewedAt ? ` · reviewed ${analog.reviewedAt}` : ''} · {analog.confidence} confidence</span>
      <button type="button" onClick={() => go(`/animals?archetype=${encodeURIComponent(primary.archetype)}`)}>Other playables like a {primary.archetypeLabel.toLowerCase()} →</button>
    </footer>
  </section>;
}
