import { type Playstyle, type SoloFit } from './api';
import './playstyle.css';

const soloLabels: Record<SoloFit, string> = { solo: 'Solo spielbar', 'solo-possible': 'Solo eingeschränkt', group: 'Gruppentier' };

// Personal play guide shown above the official profile: how to live as the real animal inside
// the profile's rules. The profile always wins where the two differ.
export function PlaystyleView({ playstyle, name }: { playstyle: Playstyle; name: string }) {
  return <section className="playstyle" id="playstyle" lang="de">
    <div className="ps-head">
      <div><span className="ps-kicker">PROFIL ÜBER DEM PROFIL</span><h2>So spielst du {name}</h2></div>
      <span className={`ps-solo fit-${playstyle.solo.fit}`} title={playstyle.solo.note}>{soloLabels[playstyle.solo.fit]}</span>
    </div>
    <p className="ps-summary">{playstyle.summary}</p>
    <p className="ps-solo-note"><b>Solo:</b> {playstyle.solo.note}</p>
    <div className="ps-parts">{playstyle.parts.map(part => <article key={part.id} className={`ps-part part-${part.id}`}>
      <h3>{part.title}{part.fixed && <span className="ps-fixed" title="Hier lässt das Profil kaum Spielraum">wie im Profil</span>}</h3>
      <p>{part.text}</p>
    </article>)}</div>
    <p className="ps-foot">Persönlicher Spielleitfaden. Wo er vom offiziellen Profil abweicht, gilt immer das Profil.</p>
  </section>;
}
