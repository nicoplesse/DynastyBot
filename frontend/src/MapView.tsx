import { useEffect, useId, useMemo, useState } from 'react';
import { api, type MapLandscape, type MapRegion, type PoiMarker, type PoiShape, type ProfileEcosystem, type ProfileMap, type WorldMap } from './api';
import './map.css';

// The map image already carries the profile's own highlights (territories, nesting and courtship
// grounds, routes). This view adds no colour of its own: POIs are quiet outlines, and the
// landscape layer works as a spotlight that dims everything except one landscape at a time.

const ROUTE_PALETTE = ['#f0f0f0', '#e79aa0', '#7fd0ff', '#f5c877', '#b79af0'];
const ROLE_ORDER = ['territory', 'nesting', 'courtship', 'basking', 'resting', 'hunting', 'drinking', 'migration', 'neutral', 'transit'];
const ROLE_LABEL: Record<string, string> = {
  territory: 'Territory', drinking: 'Drinking (not defended)', hunting: 'Hunting', nesting: 'Nesting', basking: 'Basking', resting: 'Resting',
  migration: 'Migration', courtship: 'Courtship', neutral: 'Neutral ground', transit: 'Transit',
};
const MOISTURE_LABEL: Record<string, string> = { arid: 'Dry / Arid', 'semi-arid': 'Semi-arid', mesic: 'Mesic', wet: 'Wet', aquatic: 'Aquatic' };
// Short chip names; the full ecosystem label is shown in the panel.
const LANDSCAPE_SHORT: Record<string, string> = {
  sea: 'Sea & Coast', freshwater: 'Rivers & Swamps', forest: 'Forest', plains: 'Plains', arid: 'Desert & Canyons', mountains: 'Cliffs & Rock',
};

let worldMapRequest: Promise<WorldMap> | null = null;
function loadWorldMap() {
  worldMapRequest ||= api.worldMap().catch(error => { worldMapRequest = null; throw error; });
  return worldMapRequest;
}

const titleCase = (value: string) => value.replace(/(^|[\s-])\w/g, char => char.toUpperCase());
const polygonPoints = (shape: Extract<PoiShape, { type: 'polygon' }>) => shape.points.map(p => `${p[0]},${p[1]}`).join(' ');

function pointOf(shape: PoiShape | null): { x: number; y: number } | null {
  if (!shape || shape.type === 'polygon') return null;
  return { x: shape.x, y: shape.y };
}

interface Props { profileId: string; name: string; map: ProfileMap; ecosystem?: ProfileEcosystem | null }

export function MapView({ profileId, name, map, ecosystem }: Props) {
  const uid = useId().replace(/:/g, '');
  const [world, setWorld] = useState<WorldMap | null>(null);
  const [landscapeId, setLandscapeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const routes = map.routes || [];

  useEffect(() => { let live = true; loadWorldMap().then(doc => { if (live) setWorld(doc); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => { setSelectedId(null); setHoverId(null); setLandscapeId(null); }, [profileId]);

  const regionsById = useMemo(() => new Map((world?.regions || []).map(region => [region.id, region])), [world]);
  const landscapes = world?.landscapes || [];
  const landscape = landscapes.find(item => item.id === landscapeId) || null;

  // How many of this profile's POIs lie in each landscape (main character or partly).
  const poiCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const marker of map.markers) for (const eco of new Set(marker.ecosystems || [])) counts[eco] = (counts[eco] || 0) + 1;
    return counts;
  }, [map]);

  const markers = map.markers.map((marker, index) => ({ marker, index }));
  const areaMarkers = markers.filter(({ marker }) => marker.shape?.type === 'polygon');
  const pointMarkers = markers.filter(({ marker }) => marker.shape && marker.shape.type !== 'polygon');
  const selected = selectedId === null ? null : map.markers[selectedId] || null;
  const focusId = hoverId ?? selectedId;
  const focus = focusId === null ? null : map.markers[focusId] || null;
  const imageUrl = map.image ? api.imageUrl(profileId, map.image) : null;

  const litMain = landscape ? landscape.regions.map(id => regionsById.get(id)).filter((r): r is MapRegion => Boolean(r)) : [];
  const litPart = landscape ? landscape.also.map(id => regionsById.get(id)).filter((r): r is MapRegion => Boolean(r)) : [];
  const spotlight = Boolean(landscape) || (selected?.shape?.type === 'polygon');

  const toggleLandscape = (id: string) => { setLandscapeId(current => (current === id ? null : id)); setSelectedId(null); };
  const selectMarker = (index: number) => setSelectedId(current => (current === index ? null : index));

  return (
    <section className="map-view" id="map">
      <div className="detail-section-title"><span>02</span><h2>Territory Map &amp; POIs</h2></div>

      <div className="map-toolbar">
        <div className="map-landscapes" role="group" aria-label="Show a landscape on the map">
          <span className="map-toolbar-cap">Landscape</span>
          {landscapes.map(item => {
            const on = item.id === landscapeId;
            const home = ecosystem?.id === item.id;
            return <button key={item.id} type="button" className={`map-land ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleLandscape(item.id)}
              title={`${item.label} (${item.de})${home ? ` · home ecosystem of ${name}` : ''}`}>
              {LANDSCAPE_SHORT[item.id] || item.label}
              {poiCount[item.id] ? <em>{poiCount[item.id]}</em> : null}
              {home && <i className="map-land-home" aria-label="home ecosystem" />}
            </button>;
          })}
        </div>
        {routes.length > 0 && <button type="button" className={`map-routes-toggle ${showRoutes ? 'on' : ''}`} onClick={() => setShowRoutes(value => !value)} aria-pressed={showRoutes}>Route lines</button>}
      </div>

      <div className="map-stage-wrap">
        <div className="map-stage">
          {imageUrl
            ? <img src={imageUrl} alt={`${name} territory map`} loading="lazy" />
            : <div className="map-noimg">No map image linked for this profile.</div>}

          <svg className="map-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {spotlight && <>
              <defs>
                <filter id={`soft-${uid}`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.0025" /></filter>
                <mask id={`lit-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1">
                  <rect width="1" height="1" fill="white" />
                  <g filter={`url(#soft-${uid})`}>
                    {litPart.map(region => region.shape.type === 'polygon' && <polygon key={region.id} points={polygonPoints(region.shape)} fill="#707070" />)}
                    {litMain.map(region => region.shape.type === 'polygon' && <polygon key={region.id} points={polygonPoints(region.shape)} fill="black" />)}
                    {landscape?.water && <image href={api.mapLayerUrl(landscape.water)} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />}
                    {!landscape && selected?.shape?.type === 'polygon' && <polygon points={polygonPoints(selected.shape)} fill="black" />}
                  </g>
                </mask>
              </defs>
              <rect className={`map-veil ${landscape ? '' : 'light'}`} width="1" height="1" mask={`url(#lit-${uid})`} />
              {litPart.map(region => region.shape.type === 'polygon' && <polygon key={region.id} className="map-outline part" points={polygonPoints(region.shape)} />)}
              {litMain.map(region => region.shape.type === 'polygon' && <polygon key={region.id} className="map-outline" points={polygonPoints(region.shape)} />)}
            </>}
            {focus?.shape?.type === 'polygon' && <polygon className="map-outline focus" points={polygonPoints(focus.shape)} />}
            {routes.length > 0 && showRoutes && routes.map((route, ri) => {
              const points = route.waypoints.map(w => `${w.x},${w.y}`).join(' ');
              return <g key={route.id || ri}>
                <polyline className="route-halo" points={points} />
                <polyline className="route-line" points={points} style={{ stroke: route.color || ROUTE_PALETTE[ri % ROUTE_PALETTE.length] }} />
              </g>;
            })}
          </svg>

          {/* Invisible hit areas: the POI shapes themselves are the click targets. */}
          <svg className="map-hits" viewBox="0 0 1 1" preserveAspectRatio="none">
            {areaMarkers.map(({ marker, index }) => (
              <polygon key={index} points={polygonPoints(marker.shape as Extract<PoiShape, { type: 'polygon' }>)}
                onMouseEnter={() => setHoverId(index)} onMouseLeave={() => setHoverId(null)} onClick={() => selectMarker(index)}>
                <title>{marker.name}</title>
              </polygon>
            ))}
          </svg>
          {pointMarkers.map(({ marker, index }) => {
            const point = pointOf(marker.shape);
            if (!point) return null;
            return <button key={index} type="button" className={`map-dot ${selectedId === index ? 'selected' : ''} ${landscape && selectedId !== index ? 'dim' : ''}`}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              onMouseEnter={() => setHoverId(index)} onMouseLeave={() => setHoverId(null)} onClick={() => selectMarker(index)} aria-label={marker.name} title={marker.name} />;
          })}
          {focus && hoverId !== null && <MapTag marker={focus} />}
        </div>

        {selected
          ? <MarkerDetail marker={selected} landscapes={landscapes} onClose={() => setSelectedId(null)} />
          : landscape
            ? <LandscapePanel landscape={landscape} regionsById={regionsById} markers={map.markers} name={name}
                isHome={ecosystem?.id === landscape.id} onSelect={setSelectedId} onHover={setHoverId} onClose={() => setLandscapeId(null)} />
            : <PoiList markers={map.markers} name={name} onSelect={setSelectedId} onHover={setHoverId} />}
      </div>

      {landscape && <p className="map-key">
        <span><i className="key-lit" /> {landscape.label}</span>
        {litPart.length > 0 && <span><i className="key-part" /> partly {landscape.label.toLowerCase()}</span>}
        {landscape.water && <span>Open fresh water in other areas is lit too.</span>}
      </p>}

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
      <p className="map-footnote subtle">Area outlines are traced from the POI borders of the map images; small landmarks are approximate.</p>
    </section>
  );
}

function MapTag({ marker }: { marker: PoiMarker }) {
  const at = marker.anchor || pointOf(marker.shape);
  if (!at) return null;
  return <span className="map-tag" style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}>{marker.name}</span>;
}

function rolesOf(marker: PoiMarker) { return marker.roles.length ? marker.roles : ['neutral']; }

function PoiList({ markers, name, onSelect, onHover }: { markers: PoiMarker[]; name: string; onSelect: (i: number) => void; onHover: (i: number | null) => void }) {
  const groups = new Map<string, number[]>();
  markers.forEach((marker, index) => { const role = rolesOf(marker)[0]; groups.set(role, [...(groups.get(role) || []), index]); });
  const ordered = [...groups.entries()].sort((a, b) => (ROLE_ORDER.indexOf(a[0]) + 99) % 99 - (ROLE_ORDER.indexOf(b[0]) + 99) % 99);
  return (
    <aside className="map-detail map-list">
      <strong className="map-list-title">{markers.length} points of interest</strong>
      <p className="map-list-hint">The highlights on the map are {name}&apos;s own. Pick a landscape above to see where forest, cliffs, water or open country lie.</p>
      {ordered.map(([role, indexes]) => (
        <div className="map-list-group" key={role}>
          <span className="map-detail-cap">{ROLE_LABEL[role] || titleCase(role)}</span>
          <ul>
            {indexes.map(index => (
              <li key={index}>
                <button type="button" onClick={() => onSelect(index)} onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(index)} onBlur={() => onHover(null)}>
                  {markers[index].name}
                  {markers[index].variant && markers[index].variant !== 'both' && <small>{titleCase(markers[index].variant as string)}</small>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

function LandscapePanel({ landscape, regionsById, markers, name, isHome, onSelect, onHover, onClose }: {
  landscape: MapLandscape; regionsById: Map<string, MapRegion>; markers: PoiMarker[]; name: string; isHome: boolean;
  onSelect: (i: number) => void; onHover: (i: number | null) => void; onClose: () => void;
}) {
  // A POI counts for an area when it is that area or a territory drawn inside it.
  const poiIndex = (regionId: string) => markers.findIndex(marker => marker.regionId === regionId || (marker.regionId !== null && regionsById.get(marker.regionId)?.within === regionId));
  const mine = markers.map((marker, index) => ({ marker, index })).filter(({ marker }) => marker.ecosystems?.includes(landscape.id));
  const row = (regionId: string) => {
    const region = regionsById.get(regionId);
    if (!region) return null;
    const index = poiIndex(regionId);
    return <li key={regionId} className={index >= 0 ? 'mine' : ''}>
      {index >= 0
        ? <button type="button" onClick={() => onSelect(index)} onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>{region.name}<small>{name}</small></button>
        : <span>{region.name}</span>}
    </li>;
  };
  return (
    <aside className="map-detail map-land-panel">
      <button className="map-detail-close" type="button" onClick={onClose} aria-label="Hide landscape">×</button>
      <h3>{landscape.label}</h3>
      <p className="map-land-de">{landscape.de}{isHome && <> · <b>home ecosystem of {name}</b></>}</p>
      <p className="map-detail-desc">{landscape.description}</p>
      <span className="map-detail-cap">Mainly</span>
      <ul className="map-land-list">{landscape.regions.map(row)}</ul>
      {landscape.also.length > 0 && <>
        <span className="map-detail-cap">Partly</span>
        <ul className="map-land-list">{landscape.also.map(row)}</ul>
      </>}
      <p className="map-land-mine">{mine.length
        ? <>{mine.length} of {name}&apos;s {markers.length} POIs lie here.</>
        : <>None of {name}&apos;s POIs lie in this landscape.</>}</p>
    </aside>
  );
}

function MarkerDetail({ marker, landscapes, onClose }: { marker: PoiMarker; landscapes: MapLandscape[]; onClose: () => void }) {
  const rows: Array<[string, string]> = [];
  const landLabel = (id: string) => landscapes.find(item => item.id === id)?.label || titleCase(id);
  if (marker.ecosystems?.length) rows.push(['Landscape', marker.ecosystems.map(landLabel).join(' · ')]);
  if (marker.biome) rows.push(['Biome', titleCase(marker.biome)]);
  if (marker.moisture) rows.push(['Moisture', MOISTURE_LABEL[marker.moisture] || titleCase(marker.moisture)]);
  if (marker.water) rows.push(['Water', marker.water.present ? [titleCase(marker.water.type), marker.water.feature && titleCase(marker.water.feature)].filter(Boolean).join(' · ') : 'None']);
  if (marker.variant) rows.push(['Variant', titleCase(marker.variant)]);
  if (marker.territoryTier) rows.push(['Territory', marker.territoryTier]);
  if (marker.claimable !== null) rows.push(['Claimable', marker.claimable ? 'Yes' : 'No']);
  if (marker.season) rows.push(['Season', marker.season]);

  return (
    <aside className="map-detail">
      <button className="map-detail-close" type="button" onClick={onClose} aria-label="Close details">×</button>
      <h3>{marker.name}</h3>
      {marker.roles.length > 0 && <div className="map-detail-roles">{marker.roles.map(role => <span key={role}>{ROLE_LABEL[role] || titleCase(role)}</span>)}</div>}
      {marker.description && <p className="map-detail-desc">{marker.description}</p>}
      {rows.length > 0 && <dl className="map-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {marker.terrain.length > 0 && <div className="map-detail-tags"><span className="map-detail-cap">Terrain</span>{marker.terrain.map(tag => <em key={tag}>{tag}</em>)}</div>}
      {marker.prey && marker.prey.length > 0 && <div className="map-detail-tags"><span className="map-detail-cap">Prey</span>{marker.prey.map(prey => <em key={prey} className="prey">{prey}</em>)}</div>}
      {marker.note && <p className="map-detail-note">{marker.note}</p>}
      {marker.unresolvedRegion && <p className="map-detail-warn">Region id not found in the gazetteer.</p>}
    </aside>
  );
}
