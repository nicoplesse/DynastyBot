import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { stagingApi, type StagingIndex, type StagingMessage, type StagingSummary, type StagingThread } from './staging';
import { PageError, PageLoading, go } from './ui';
import './staging.css';

// Aquatic staging: every profile of the suggestion as a thread of the Dynasty Discord forum,
// English only, in the grid of the original profiles. #/staging and #/staging/<id>.
export function StagingPage({ route }: { route: string }) {
  const [index, setIndex] = useState<StagingIndex | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { stagingApi.index().then(setIndex).catch(cause => setError((cause as Error).message)); }, []);
  if (error) return <PageError message={error} />;
  if (!index) return <PageLoading label="Loading staging…" />;
  const id = route.split('/')[2] || index.threads[0]?.id || null;
  return <div className="stg-page">
    <header className="stg-head">
      <div>
        <div className="stg-eyebrow">PROJEKT · AQUATIC UPDATE · STAGING</div>
        <h1>Staging: alle Profile im Discord-Format</h1>
        <p>Jedes Profil des Aquatic Update so, wie es im Dynasty-Forum stehen würde: nur Englisch, gegliedert wie die Original-Profile (Overview-Block, Banner-Abschnitte mit ✦-Unterpunkten, Profile Notes, Rule Exemptions, Quick View). Nachrichten sind nach Discords Grenze von {index.limit} Zeichen geteilt und einzeln kopierbar.</p>
      </div>
      <button type="button" className="stg-ghost" onClick={() => go('/aquatic')}>≋ Zum Aquatic-Update-Tab</button>
    </header>
    <div className="stg-layout">
      <ForumList threads={index.threads} active={id} />
      {id ? <ThreadPane key={id} id={id} /> : <div className="stg-empty">Noch keine Staging-Profile.</div>}
    </div>
  </div>;
}

function ForumList({ threads, active }: { threads: StagingSummary[]; active: string | null }) {
  return <aside className="stg-forum" aria-label="Forum posts">
    <div className="stg-forum-head"><span className="stg-hash">#</span> aquatic-profiles <span className="stg-tag-staging">STAGING</span></div>
    <div className="stg-forum-list">
      {threads.map(thread => <button key={thread.id} type="button" className={`stg-post ${thread.id === active ? 'active' : ''}`} aria-current={thread.id === active ? 'page' : undefined} onClick={() => go(`/staging/${thread.id}`)}>
        <strong>{thread.title}</strong>
        <span className="stg-post-class">{thread.classification ?? '—'}</span>
        <span className="stg-post-tags">
          <span className={`stg-chip ${thread.kind}`}>{thread.kind === 'new' ? 'Neu aufgebaut' : 'Geändert'}</span>
          {thread.raster.missing.length || !thread.raster.inOrder
            ? <span className="stg-chip warn" title={[...thread.raster.missing, ...(thread.raster.inOrder ? [] : ['Banner-Reihenfolge'])].join(', ')}>Raster: {thread.raster.missing.length + (thread.raster.inOrder ? 0 : 1)} offen</span>
            : <span className="stg-chip ok">Raster ✓</span>}
          {thread.notes.length > 0 && <span className="stg-chip note" title="Staging-Hinweise zu offenen Punkten">{thread.notes.length} Hinweis{thread.notes.length === 1 ? '' : 'e'}</span>}
        </span>
        <span className="stg-post-meta">{thread.textMessages} Nachrichten · {thread.chars.toLocaleString('de-DE')} Zeichen</span>
      </button>)}
    </div>
  </aside>;
}

function ThreadPane({ id }: { id: string }) {
  const [thread, setThread] = useState<StagingThread | null>(null);
  const [error, setError] = useState('');
  const [marks, setMarks] = useState(true);
  const [raster, setRaster] = useState(false);
  const [copied, setCopied] = useState('');
  useEffect(() => { stagingApi.thread(id).then(setThread).catch(cause => setError((cause as Error).message)); }, [id]);
  const anchors = useMemo(() => anchorKeys(thread), [thread]);
  if (error) return <PageError message={error} />;
  if (!thread) return <PageLoading label="Loading thread…" />;
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(current => current === key ? '' : current), 1600); }
    catch { setCopied(''); }
  };
  const all = thread.messages.map(message => message.type === 'text' ? message.copy
    : message.type === 'banner' ? `[Banner: ${message.title}]`
      : message.type === 'image' ? `[Image: ${message.caption}]`
        : message.type === 'titlecard' ? '[Title card]'
          : message.type === 'quicklinks' ? quickLinksText(thread) : '').filter(Boolean).join('\n\n');
  const changedCount = thread.messages.filter(message => message.type === 'text' && message.changed).length;
  return <section className="stg-thread" aria-label={`${thread.name} thread`}>
    <div className="stg-thread-bar">
      <div className="stg-thread-title"><span className="stg-forum-icon" aria-hidden="true">▤</span><h2>{thread.title}</h2><span className={`stg-chip ${thread.kind}`}>{thread.kind === 'new' ? 'Neu aufgebaut' : 'Geändert'}</span></div>
      <div className="stg-thread-tools">
        <JumpSelect thread={thread} />
        {thread.kind === 'changed' && changedCount > 0 && <label className="stg-toggle"><input type="checkbox" checked={marks} onChange={event => setMarks(event.target.checked)} /> Änderungen markieren</label>}
        <button type="button" className={`stg-tool ${raster ? 'on' : ''}`} aria-pressed={raster} onClick={() => setRaster(value => !value)}>Raster</button>
        <button type="button" className="stg-tool" onClick={() => copy(all, 'all')}>{copied === 'all' ? 'Kopiert ✓' : 'Ganzes Profil kopieren'}</button>
      </div>
    </div>
    {raster && <RasterPanel thread={thread} />}
    <div className={`dc-channel ${marks ? 'show-marks' : ''}`}>
      <div className="dc-thread-start">
        <div className="dc-thread-icon" aria-hidden="true">▤</div>
        <h3>{thread.title}</h3>
        <p>Staging-Entwurf · {thread.classification ?? thread.name} · {thread.textMessages} Nachrichten · zuletzt geändert {formatStamp(thread.updatedAt)}</p>
      </div>
      {thread.messages.map((message, index) => <Message key={index} index={index} message={message} thread={thread} anchors={anchors} copied={copied === `m${index}`} onCopy={text => copy(text, `m${index}`)} />)}
    </div>
  </section>;
}

function JumpSelect({ thread }: { thread: StagingThread }) {
  const entries = thread.outline.filter(entry => entry.level <= 2);
  return <select className="stg-jump" aria-label="Zu Abschnitt springen" value="" onChange={event => {
    document.getElementById(`stg-${event.target.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }}>
    <option value="">Abschnitt …</option>
    {entries.map((entry, index) => <option key={`${entry.id}-${index}`} value={entry.id}>{entry.level === 1 ? entry.title.toUpperCase() : `   ${entry.title}`}</option>)}
  </select>;
}

function RasterPanel({ thread }: { thread: StagingThread }) {
  const groups = [...new Set(thread.raster.items.map(item => item.group))];
  return <div className="stg-raster">
    <p>Abgleich mit der Gliederung der Original-Profile (Tylosaurus, Parasaurolophus, Leedsichthys). {thread.raster.inOrder ? 'Die Banner stehen in der Original-Reihenfolge.' : 'Achtung: Die Banner stehen nicht in der Original-Reihenfolge.'}</p>
    {groups.map(group => <div key={group} className="stg-raster-row">
      <span className="stg-raster-group">{group === '✦' ? '✦ Unterpunkte' : group}</span>
      <span className="stg-raster-items">{thread.raster.items.filter(item => item.group === group).map(item => <span key={item.label} className={`stg-raster-item ${item.ok ? 'ok' : 'missing'}`}>{item.ok ? '✓' : '✗'} {item.label}</span>)}</span>
    </div>)}
  </div>;
}

function formatStamp(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

function quickLinksText(thread: StagingThread) {
  return ['Quick Links', 'Top', ...thread.links.filter(link => !['profile-notes', 'rules-clarifications'].includes(link.id)).map(link => link.title), 'Preferred POIs', 'Resource Map', 'Terminology', 'Return to directory?'].join('\n');
}

function Author({ thread }: { thread: StagingThread }) {
  return <div className="dc-head">
    <span className="dc-author">Dynasty Realism</span>
    <span className="dc-role" title="Co-Owner" aria-label="Co-Owner">✦</span>
    <span className="dc-op">OP</span>
    <time>— {formatStamp(thread.updatedAt)}</time>
  </div>;
}

function Message({ index, message, thread, anchors, copied, onCopy }: { index: number; message: StagingMessage; thread: StagingThread; anchors: Map<string, string>; copied: boolean; onCopy: (text: string) => void }) {
  const anchorId = anchors.get(String(index));
  if (message.type === 'note') return <div className="stg-note" role="note"><strong>Staging-Hinweis (nicht im Discord):</strong> <Inline text={message.text} /></div>;
  const over = message.type === 'text' && message.chars > thread.limit;
  return <div className={`dc-msg ${message.header ? 'has-header' : ''}`} id={anchorId}>
    {message.header && <div className="dc-avatar" aria-hidden="true">DR</div>}
    <div className="dc-content">
      {message.header && <Author thread={thread} />}
      {message.type === 'text' && <DiscordText text={message.text} anchors={anchors} index={index} />}
      {message.type === 'banner' && <div className="dc-attach dc-banner" role="img" aria-label={`Banner: ${message.title}`}><span>{message.title}</span></div>}
      {message.type === 'image' && (message.src
        ? <a className="dc-attach dc-image-file" href={`/api/staging/media/${message.src}`} target="_blank" rel="noreferrer"><img src={`/api/staging/media/${message.src}`} alt={message.caption} loading="lazy" /></a>
        : <div className="dc-attach dc-image" role="img" aria-label={`Image: ${message.caption}`}><span className="dc-image-icon" aria-hidden="true">🖼</span><span>{message.caption}</span></div>)}
      {message.type === 'titlecard' && <TitleCard thread={thread} />}
      {message.type === 'quicklinks' && <QuickLinks thread={thread} />}
    </div>
    {message.type === 'text' && <div className="dc-tools">
      <span className={`dc-count ${over ? 'over' : ''}`} title={over ? 'Zu lang für eine Discord-Nachricht' : 'Zeichen dieser Nachricht'}>{message.chars.toLocaleString('de-DE')} / {thread.limit}</span>
      <button type="button" onClick={() => onCopy(message.copy)}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
    </div>}
    {message.type === 'quicklinks' && <div className="dc-tools"><button type="button" onClick={() => onCopy(quickLinksText(thread))}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button></div>}
  </div>;
}

function TitleCard({ thread }: { thread: StagingThread }) {
  const level = thread.difficulty ?? 0;
  return <div className="dc-attach dc-titlecard" role="img" aria-label={`${thread.card}: ${thread.title}`}>
    <div className="dc-tc-band">
      <span className="dc-tc-card">{thread.card}</span>
      <span className="dc-tc-name">{thread.title}</span>
      {thread.difficulty && <span className="dc-tc-diff"><span className="dc-tc-boxes" aria-hidden="true">{[1, 2, 3, 4, 5].map(step => <i key={step} className={step <= level ? 'on' : ''} />)}</span>{(thread.difficultyLabel || '').toUpperCase()} DIFFICULTY</span>}
    </div>
    <div className="dc-tc-photo">
      {thread.cover ? <img src={`/api/profiles/${thread.cover}`} alt="" loading="lazy" /> : <><span>Bild folgt</span><span className="dc-tc-logo">DYNASTY<small>REALISM</small></span></>}
    </div>
  </div>;
}

function QuickLinks({ thread }: { thread: StagingThread }) {
  const jump = (target: string) => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const inThread = thread.links.filter(link => !['profile-notes', 'rules-clarifications'].includes(link.id));
  return <div className="dc-text">
    <div className="dc-h2">Quick Links</div>
    <div className="dc-line"><button type="button" className="dc-link" onClick={() => document.querySelector('.dc-thread-start')?.scrollIntoView({ behavior: 'smooth' })}>Top</button></div>
    {inThread.map(link => <div key={link.id} className="dc-line"><button type="button" className="dc-link" onClick={() => jump(`stg-${link.id}`)}>{link.title}</button></div>)}
    <div className="dc-line"><button type="button" className="dc-link" onClick={() => jump('stg-preferred-pois')}>Preferred POIs</button></div>
    <div className="dc-line"><span className="dc-link dead" title="Link auf einen anderen Kanal">Resource Map</span></div>
    <div className="dc-line"><span className="dc-link dead" title="Link auf einen anderen Kanal">Terminology</span></div>
    <div className="dc-line"><span className="dc-link dead" title="Link auf das Verzeichnis">Return to directory?</span></div>
  </div>;
}

// Discord markdown, line by line: a single newline is a line break, as in Discord.
type Line = { kind: 'h1' | 'h2' | 'h3' | 'sub' | 'quote' | 'li' | 'ol' | 'p' | 'blank'; depth: number; text: string; changed: boolean; number?: string };
const CHANGED = /\s*\{\+\}\s*$/;

function parseLines(text: string): Line[] {
  return text.split('\n').map(raw => {
    const changed = CHANGED.test(raw);
    const line = raw.replace(CHANGED, '');
    if (!line.trim()) return { kind: 'blank', depth: 0, text: '', changed };
    let match = line.match(/^(#{1,3})\s+(.*)$/);
    if (match) return { kind: (['h1', 'h2', 'h3'] as const)[match[1].length - 1], depth: 0, text: match[2], changed };
    match = line.match(/^-#\s+(.*)$/);
    if (match) return { kind: 'sub', depth: 0, text: match[1], changed };
    match = line.match(/^>\s?(.*)$/);
    if (match) return { kind: 'quote', depth: 0, text: match[1], changed };
    match = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (match) return { kind: 'li', depth: Math.floor(match[1].length / 2), text: match[2], changed };
    match = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (match) return { kind: 'ol', depth: Math.floor(match[1].length / 2), text: match[3], changed, number: match[2] };
    return { kind: 'p', depth: 0, text: line, changed };
  });
}

const headingId = (text: string) => text.replace(/\*\*/g, '').replace(/^✦\s*/, '').trim().toLowerCase().replace(/✦/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Jump targets: the first banner or heading of each name, keyed "message" or "message:line".
function anchorKeys(thread: StagingThread | null) {
  const keys = new Map<string, string>();
  if (!thread) return keys;
  const seen = new Set<string>();
  const add = (key: string, id: string) => { if (!seen.has(id)) { seen.add(id); keys.set(key, `stg-${id}`); } };
  thread.messages.forEach((message, index) => {
    if (message.type === 'banner') add(String(index), message.id);
    if (message.type === 'text') parseLines(message.text).forEach((line, lineIndex) => {
      if (line.kind === 'h1' || line.kind === 'h2' || line.kind === 'h3') add(`${index}:${lineIndex}`, headingId(line.text));
    });
  });
  return keys;
}

function DiscordText({ text, anchors, index: messageIndex }: { text: string; anchors: Map<string, string>; index: number }) {
  const lines = useMemo(() => parseLines(text), [text]);
  return <div className="dc-text">{lines.map((line, index) => {
    const mark = line.changed ? ' is-changed' : '';
    if (line.kind === 'blank') return <div key={index} className={`dc-blank${mark}`} />;
    if (line.kind === 'h1' || line.kind === 'h2' || line.kind === 'h3') {
      return <div key={index} id={anchors.get(`${messageIndex}:${index}`)} className={`dc-${line.kind}${mark}`}><Inline text={line.text} /></div>;
    }
    if (line.kind === 'sub') return <div key={index} className={`dc-sub${mark}`}><Inline text={line.text} /></div>;
    if (line.kind === 'quote') return <div key={index} className={`dc-quote${mark}`}><Inline text={line.text} /></div>;
    if (line.kind === 'li' || line.kind === 'ol') return <div key={index} className={`dc-li depth-${Math.min(line.depth, 3)}${mark}`}>
      <span className="dc-bullet" aria-hidden="true">{line.kind === 'ol' ? `${line.number}.` : ['•', '◦', '▪', '▪'][Math.min(line.depth, 3)]}</span>
      <span><Inline text={line.text} /></span>
    </div>;
    return <div key={index} className={`dc-line${mark}`}><Inline text={line.text} /></div>;
  })}</div>;
}

// Inline Discord markdown: bold, underline, italics, strike, code and channel mentions.
const INLINE = /(\*\*.+?\*\*|__.+?__|~~.+?~~|`[^`]+`|\*[^*\s](?:[^*]*[^*\s])?\*|#\S*・[\w-]+)/g;
function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(INLINE);
  return <>{parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}><Inline text={part.slice(2, -2)} /></strong>;
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) return <u key={index}><Inline text={part.slice(2, -2)} /></u>;
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) return <s key={index}><Inline text={part.slice(2, -2)} /></s>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}><Inline text={part.slice(1, -1)} /></em>;
    if (part.startsWith('#') && part.includes('・')) return <span key={index} className="dc-mention">#{part.slice(1)}</span>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}
