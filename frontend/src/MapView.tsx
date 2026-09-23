import { useMemo, useState } from 'react';
import { api, type PoiMarker, type PoiShape, type ProfileMap } from './api';
import './map.css';

const ROUTE_PALETTE = ['#f0f0f0', '#e79aa0', '#7fd0ff', '#f5c877', '#b79af0'];

const ROLE_META: Record<string, { label: string; color: string }> = {
  territory: { label: 'Territory', color: '#5fbf5f' },
  hunting: { label: 'Hunting', color: '#e07a4a' },
  nesting: { label: 'Nesting', color: '#c07ad0' },
  basking: { label: 'Basking', color: '#e0b84a' },
  resting: { label: 'Resting', color: '#4ab8b0' },
  migration: { label: 'Migration', color: '#5a9fe0' },
  courtship: { label: 'Courtship', color: '#e0d24a' },
  neutral: { label: 'Neutral', color: '#c9b45a' },
  transit: { label: 'Transit', color: '#9a9a9a' },
};
const MOISTURE_META: Record<string, { label: string; color: string }> = {
  arid: { label: 'Dry / Arid', color: '#d9704a' },
  'semi-arid': { label: 'Semi-arid', color: '#d9a24a' },
  mesic: { label: 'Mesic', color: '#7ab86a' },
  wet: { label: 'Wet', color: '#4a90d9' },
  aquatic: { label: 'Aquatic', color: '#3fb0c9' },
};
const FALLBACK = { label: 'Other', color: '#8fa989' };

function markerPoint(shape: PoiShape | null): { x: number; y: number } | null {
  if (!shape) return null;
  if (shape.type === 'point' || shape.type === 'circle') return { x: shape.x, y: shape.y };
  if (shape.type === 'polygon' && shape.points.length) {
    const sx = shape.points.reduce((sum, point) => sum + point[0], 0);
    const sy = shape.points.reduce((sum, point) => sum + point[1], 0);
    return { x: sx / shape.points.length, y: sy / shape.points.length };
  }
  return null;
}

const titleCase = (value: string) => value.replace(/(^|[\s-])\w/g, char => char.toUpperCase());

export function MapView({ profileId, name, map }: { profileId: string; name: string; map: ProfileMap }) {
  const [mode, setMode] = useState<'role' | 'moisture'>('role');
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const routes = map.routes || [];

  const placed = useMemo(
    () => map.markers.map((marker, index) => ({ marker, index, point: markerPoint(marker.shape) }))
      .filter((entry): entry is { marker: PoiMarker; index: number; point: { x: number; y: number } } => Boolean(entry.point)),
    [map],
  );
  const meta = mode === 'role' ? ROLE_META : MOISTURE_META;
  const keyOf = (marker: PoiMarker) => (mode === 'role' ? marker.roles[0] || 'neutral' : marker.moisture || 'mesic');
  const metaOf = (marker: PoiMarker) => meta[keyOf(marker)] || FALLBACK;
  const legendKeys = [...new Set(placed.map(entry => keyOf(entry.marker)))]
    .sort((a, b) => Object.keys(meta).indexOf(a) - Object.keys(meta).indexOf(b));
  const visible = placed.filter(entry => filters.size === 0 || filters.has(keyOf(entry.marker)));
  const selected = selectedId === null ? null : map.markers[selectedId] || null;
  const imageUrl = map.image ? api.imageUrl(profileId, map.image) : null;
  const polygons = placed.filter(entry => entry.marker.shape?.type === 'polygon');

  const toggle = (key: string) => setFilters(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <section className="map-view" id="map">
      <div className="detail-section-title"><span>02</span><h2>Territory Map &amp; POIs</h2></div>
      <div className="map-toolbar">
        <div className="map-mode" role="group" aria-label="Colour markers by">
          <span>Colour by</span>
          <button className={mode === 'role' ? 'on' : ''} onClick={() => setMode('role')}>Role</button>
          <button className={mode === 'moisture' ? 'on' : ''} onClick={() => setMode('moisture')}>Moisture</button>
          {routes.length > 0 && <button className={`map-routes-toggle ${showRoutes ? 'on' : ''}`} onClick={() => setShowRoutes(value => !value)} aria-pressed={showRoutes}>⤳ Routes</button>}
        </div>
        <div className="map-filters">
          {legendKeys.map(key => {
            const info = meta[key] || FALLBACK;
            const active = filters.has(key);
            return <button key={key} className={`map-chip ${active ? 'active' : ''}`} style={{ ['--c' as string]: info.color }} onClick={() => toggle(key)} aria-pressed={active}>
              <i /> {info.label}
            </button>;
          })}
          {filters.size > 0 && <button className="map-chip clear" onClick={() => setFilters(new Set())}>Clear</button>}
        </div>
      </div>

      <div className="map-stage-wrap">
        <div className="map-stage">
          {imageUrl
            ? <img src={imageUrl} alt={`${name} territory map`} loading="lazy" />
            : <div className="map-noimg">No map image linked for this profile.</div>}
          {polygons.length > 0 && <svg className="map-poly" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {polygons.map(({ marker, index }) => {
              const shape = marker.shape as Extract<PoiShape, { type: 'polygon' }>;
              return <polygon key={index} points={shape.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                style={{ fill: metaOf(marker).color, stroke: metaOf(marker).color }} opacity={filters.size === 0 || filters.has(keyOf(marker)) ? 0.28 : 0.05} />;
            })}
          </svg>}
          {routes.length > 0 && showRoutes && <svg className="map-routes" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {routes.map((route, ri) => {
              const points = route.waypoints.map(w => `${w.x},${w.y}`).join(' ');
              return <g key={route.id || ri}>
                <polyline className="route-halo" points={points} />
                <polyline className="route-line" points={points} style={{ stroke: route.color || ROUTE_PALETTE[ri % ROUTE_PALETTE.length] }} />
              </g>;
            })}
          </svg>}
          {visible.map(({ marker, index, point }) => (
            <button key={index} type="button" className={`map-marker ${selectedId === index ? 'selected' : ''}`}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, ['--c' as string]: metaOf(marker).color }}
              onClick={() => setSelectedId(index)} title={marker.name} aria-label={marker.name}>
              <i />
              <span className="map-marker-label">{marker.name}</span>
            </button>
          ))}
        </div>

        {selected
          ? <MarkerDetail marker={selected} onClose={() => setSelectedId(null)} />
          : <aside className="map-detail map-detail-empty">
              <strong>{map.markers.length} points of interest</strong>
              <p>Select a marker to see its biome, water, roles and profile-specific notes. Toggle <em>Moisture</em> to see where {name} lives in dry versus wet ground.</p>
            </aside>}
      </div>

      <div className="map-legend">
        {legendKeys.map(key => { const info = meta[key] || FALLBACK; return <span key={key}><i style={{ background: info.color }} /> {info.label}</span>; })}
      </div>

      {routes.length > 0 && <div className="map-routes-legend">
        {routes.map((route, ri) => (
          <div className="route-item" key={route.id || ri}>
            <span className="route-key" style={{ ['--rc' as string]: route.color || ROUTE_PALETTE[ri % ROUTE_PALETTE.length] }}><i /> {route.name}</span>
            {route.waypoints.length > 0 && <span className="route-seq">{route.waypoints.map(w => w.name).join(' → ')}</span>}
            {route.note && <span className="route-note">{route.note}</span>}
          </div>
        ))}
      </div>}

      {map.anyPoiHunting && <p className="map-footnote"><strong>Any POI:</strong> {map.anyPoiHunting.note}</p>}
      {map.imageSize && <p className="map-footnote subtle">Coordinates are approximate, normalised to the shared {map.imageSize.width}×{map.imageSize.height} base map.</p>}
    </section>
  );
}

function MarkerDetail({ marker, onClose }: { marker: PoiMarker; onClose: () => void }) {
  const rows: Array<[string, string]> = [];
  if (marker.biome) rows.push(['Biome', titleCase(marker.biome)]);
  if (marker.moisture) rows.push(['Moisture', MOISTURE_META[marker.moisture]?.label || titleCase(marker.moisture)]);
  if (marker.water) rows.push(['Water', marker.water.present ? [titleCase(marker.water.type), marker.water.feature && titleCase(marker.water.feature)].filter(Boolean).join(' · ') : 'None']);
  if (marker.variant) rows.push(['Variant', titleCase(marker.variant)]);
  if (marker.territoryTier) rows.push(['Territory', marker.territoryTier]);
  if (marker.claimable !== null) rows.push(['Claimable', marker.claimable ? 'Yes' : 'No']);
  if (marker.season) rows.push(['Season', marker.season]);

  return (
    <aside className="map-detail">
      <button className="map-detail-close" type="button" onClick={onClose} aria-label="Close details">×</button>
      <h3>{marker.name}</h3>
      {marker.roles.length > 0 && <div className="map-detail-roles">{marker.roles.map(role => <span key={role}>{ROLE_META[role]?.label || titleCase(role)}</span>)}</div>}
      {marker.description && <p className="map-detail-desc">{marker.description}</p>}
      {rows.length > 0 && <dl className="map-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {marker.terrain.length > 0 && <div className="map-detail-tags"><span className="map-detail-cap">Terrain</span>{marker.terrain.map(tag => <em key={tag}>{tag}</em>)}</div>}
      {marker.prey && marker.prey.length > 0 && <div className="map-detail-tags"><span className="map-detail-cap">Prey</span>{marker.prey.map(prey => <em key={prey} className="prey">{prey}</em>)}</div>}
      {marker.note && <p className="map-detail-note">{marker.note}</p>}
      {marker.unresolvedRegion && <p className="map-detail-warn">Region id not found in the gazetteer.</p>}
    </aside>
  );
}
