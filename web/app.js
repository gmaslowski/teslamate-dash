const $ = (s) => document.querySelector(s);
const api = (p) => fetch(p).then((r) => r.json());

let cfg = { units: "km", map_style_url: "", demo: false, title: "TeslaMate Dash" };
let driveMap, mapReady = false, drivesById = {};
let currentRange = "all";
let currentCar = ""; // "" = all cars
const show = { drives: true, charging: true };
const AC = "#14B8A6", DC = "#F59E0B";

// Speed (km/h) to colour: a single-hue blue sequential, light = slow, deep = fast.
// Perceptually ordered so "faster" reads intuitively, and dark enough at the low
// end to stay legible on the light basemap.
const SPEED_COLOR = [
  "interpolate", ["linear"], ["coalesce", ["get", "speed"], 0],
  0, "#C2D6FA", 35, "#5B8DEF", 80, "#2F5FCC", 130, "#1E3A8A",
];
const EMPTY_FC = { type: "FeatureCollection", features: [] };

function km(v) {
  if (cfg.units === "mi") return (v * 0.621371).toFixed(0) + " mi";
  return Math.round(v) + " km";
}
function spd(v) {
  if (cfg.units === "mi") return Math.round(v * 0.621371) + " mph";
  return Math.round(v) + " km/h";
}
function dur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + " h " : "") + m + " min";
}
function fmtDate(s) {
  const d = new Date(s);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// query builds the shared ?from=&car= filter from the selected timeframe and car.
// "all" timeframe and "" car each contribute nothing, so the backend widens.
function query() {
  const p = [];
  if (currentRange !== "all") {
    const now = new Date(), from = new Date(now);
    if (currentRange === "year") from.setFullYear(now.getFullYear() - 1);
    if (currentRange === "90d") from.setDate(now.getDate() - 90);
    if (currentRange === "30d") from.setDate(now.getDate() - 30);
    p.push("from=" + encodeURIComponent(from.toISOString()));
  }
  if (currentCar) p.push("car=" + encodeURIComponent(currentCar));
  return p.length ? "?" + p.join("&") : "";
}

async function boot() {
  cfg = await api("/api/config");
  $("#title").textContent = cfg.title;
  document.title = cfg.title;
  if (cfg.demo) $("#demo-badge").hidden = false;
  await setupCars();
  await renderStats();
  initMap();
  setupRange();
  setupLayers();
}

// setupCars fills the header selector with the real car names from TeslaMate and
// defaults to the first car, so its given name shows. "All cars" merges them.
async function setupCars() {
  const cars = await api("/api/cars");
  const sel = $("#car");
  if (!Array.isArray(cars) || cars.length === 0) { sel.hidden = true; return; }
  const label = (c) => c.name || (c.model ? "Model " + c.model : "Car " + c.id);
  let html = cars.length > 1 ? `<option value="">All cars</option>` : "";
  html += cars.map((c) => `<option value="${c.id}">${esc(label(c))}</option>`).join("");
  sel.innerHTML = html;
  currentCar = String(cars[0].id);
  sel.value = currentCar;
  sel.hidden = false;
  sel.addEventListener("change", () => { currentCar = sel.value; renderStats(); loadData(true); });
}

async function renderStats() {
  const s = await api("/api/stats" + query());
  $("#stats").innerHTML = [
    ["Distance", km(s.distance_km)],
    ["Drives", s.drives],
    ["Energy", Math.round(s.energy_kwh) + " kWh"],
    ["Sessions", s.sessions],
  ].map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
}

function newMap(el, opts) {
  return new maplibregl.Map(Object.assign({
    container: el,
    style: cfg.map_style_url,
    center: [19.94, 50.06],
    zoom: 3.4,
    attributionControl: true,
    maxPitch: 85,
  }, opts || {}));
}

function initMap() {
  driveMap = newMap("map");
  driveMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  // Register load synchronously so the event can never be missed; data arrives
  // afterwards via loadData().
  driveMap.on("load", () => {
    try { driveMap.setProjection({ type: "globe" }); } catch (e) { /* older renderer */ }
    tintBasemap(driveMap);
    addBuildings(driveMap);

    driveMap.addSource("drives", { type: "geojson", data: EMPTY_FC });
    driveMap.addLayer({
      id: "drives-glow", type: "line", source: "drives",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": SPEED_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3, 12, 9],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 2, 12, 6],
        "line-opacity": 0.25,
      },
    });
    driveMap.addLayer({
      id: "drives-line", type: "line", source: "drives",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": SPEED_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 12, 2.8],
        "line-opacity": 0.95,
      },
    });

    driveMap.addSource("charging", { type: "geojson", data: EMPTY_FC });
    driveMap.addLayer({
      id: "charging-pts", type: "circle", source: "charging",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 6, 5, 11, 25, 17, 100, 24],
        "circle-color": ["match", ["get", "kind"], "DC", DC, AC],
        "circle-opacity": 0.85,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });
    driveMap.addLayer({
      id: "charging-count", type: "symbol", source: "charging",
      filter: [">", ["get", "count"], 1],
      layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["get", "count"], 1, 10, 100, 15],
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });

    driveMap.on("click", "drives-line", onRouteClick);
    driveMap.on("click", "charging-pts", onChargeClick);
    ["drives-line", "charging-pts"].forEach((id) => {
      driveMap.on("mouseenter", id, () => driveMap.getCanvas().style.cursor = "pointer");
      driveMap.on("mouseleave", id, () => driveMap.getCanvas().style.cursor = "");
    });

    mapReady = true;
    applyVisibility();
    loadData(true);
  });
}

// tintBasemap nudges the light basemap into the brand's cool teal range so the
// coloured routes and charging markers sit on a cohesive palette instead of a
// busy multicolour map. Each setPaintProperty is guarded: layers vary by style.
function tintBasemap(map) {
  const paint = (id, prop, val) => { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, val); } catch (e) { /* layer absent */ } };
  paint("background", "background-color", "#eef1f5");
  paint("water", "fill-color", "#dbe3f0");
  paint("waterway", "line-color", "#dbe3f0");
  ["park", "landcover_wood"].forEach((id) => paint(id, "fill-color", "#e8ebf0"));
  paint("landuse_residential", "fill-color", "#eef1f5");
  ["boundary_2", "boundary_3"].forEach((id) => paint(id, "line-color", "#cfd5e0"));
}

// addBuildings extrudes the basemap building footprints into 3D. Flat from
// straight overhead, they rise into volumes as you tilt/zoom into a city.
function addBuildings(map) {
  if (!map.getSource("openmaptiles") || map.getLayer("3d-buildings")) return;
  try {
    map.addLayer({
      id: "3d-buildings", source: "openmaptiles", "source-layer": "building",
      type: "fill-extrusion", minzoom: 13,
      paint: {
        "fill-extrusion-color": [
          "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0],
          0, "#e6e9ef", 60, "#dde1ea", 150, "#ccd3e0",
        ],
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"],
          13, 0, 14, ["coalesce", ["get", "render_height"], 0]],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.7,
      },
    });
  } catch (e) { /* style without building layer */ }
}

async function loadData(animate) {
  $("#loading").hidden = false;
  try {
    const q = query();
    const [fc, drives, charges] = await Promise.all([
      api("/api/paths" + q),
      api("/api/drives" + q),
      api("/api/charging" + q),
    ]);
    drivesById = {};
    (Array.isArray(drives) ? drives : []).forEach((d) => { drivesById[d.id] = d; });

    const routeData = fc && Array.isArray(fc.features) ? fc : EMPTY_FC;
    const chargeData = chargingToFC(Array.isArray(charges) ? charges : []);

    if (!mapReady) return;
    driveMap.getSource("drives").setData(routeData);
    driveMap.getSource("charging").setData(chargeData);
    $("#legend").hidden = !(show.drives && routeData.features.length);
    fitTo(driveMap, routeData, chargeData, animate);
  } finally {
    $("#loading").hidden = true;
  }
}

const CLUSTER_M = 50; // group charge sessions within this many metres into one point

// chargingToFC clusters sessions that happen within CLUSTER_M of each other
// (same driveway, same supercharger) into a single marker carrying the session
// count, total energy and AC/DC split. Greedy nearest-seed grouping; with a few
// hundred fixed locations it is plenty.
function chargingToFC(rows) {
  const pts = rows.filter((r) => r.lat && r.lon);
  const clusters = [];
  for (const r of pts) {
    let host = null;
    for (const c of clusters) {
      if (haversineM(c.lat, c.lon, r.lat, r.lon) <= CLUSTER_M) { host = c; break; }
    }
    if (host) host.rows.push(r);
    else clusters.push({ lat: r.lat, lon: r.lon, rows: [r] });
  }
  return {
    type: "FeatureCollection",
    features: clusters.map((c) => {
      const n = c.rows.length;
      const energy = c.rows.reduce((a, r) => a + r.energy_kwh, 0);
      const dc = c.rows.filter((r) => r.kind === "DC").length;
      const lat = c.rows.reduce((a, r) => a + r.lat, 0) / n;
      const lon = c.rows.reduce((a, r) => a + r.lon, 0) / n;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
          location: mode(c.rows.map((r) => r.location)),
          count: n, energy: energy, dc: dc, ac: n - dc,
          kind: dc >= n - dc ? "DC" : "AC",
        },
      };
    }),
  };
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mode(arr) {
  const c = {}; let best = arr[0], n = 0;
  arr.forEach((v) => { c[v] = (c[v] || 0) + 1; if (c[v] > n) { n = c[v]; best = v; } });
  return best;
}

function onRouteClick(e) {
  const f = e.features[0];
  const d = drivesById[f.properties.drive_id];
  const html = d
    ? `<div class="pop-t">${esc(d.from)} &rarr; ${esc(d.to)}</div>
       <div class="pop-m">${fmtDate(d.start)}</div>
       <div class="pop-m">${km(d.distance_km)} &middot; ${dur(d.duration_min)} &middot; max ${spd(d.speed_max)}</div>`
    : `<div class="pop-t">Drive ${f.properties.drive_id}</div>
       <div class="pop-m">max ${spd(f.properties.speed || 0)}</div>`;
  new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(html).addTo(driveMap);
}

function onChargeClick(e) {
  const p = e.features[0].properties;
  const split = p.count > 1 ? ` <span class="pop-m">(${p.ac} AC / ${p.dc} DC)</span>` : "";
  const sessions = p.count > 1 ? `${p.count} sessions` : "1 session";
  const html = `<div class="pop-t">${esc(p.location)} <span class="chip ${p.kind === "DC" ? "dc" : ""}">${p.kind}</span></div>
     <div class="pop-m">${sessions}${split}</div>
     <div class="pop-m">${Number(p.energy).toFixed(0)} kWh total</div>`;
  new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(html).addTo(driveMap);
}

function fitTo(map, routeFC, chargeFC, animate) {
  const b = new maplibregl.LngLatBounds();
  let any = false;
  if (show.drives) (routeFC.features || []).forEach((f) => f.geometry.coordinates.forEach((c) => { b.extend(c); any = true; }));
  if (show.charging) (chargeFC.features || []).forEach((f) => { b.extend(f.geometry.coordinates); any = true; });
  if (!any) return;
  map.fitBounds(b, { padding: 60, maxZoom: 13, pitch: 0, bearing: 0, duration: animate ? 1600 : 0, essential: true });
}

function applyVisibility() {
  if (!mapReady) return;
  const set = (id, on) => { if (driveMap.getLayer(id)) driveMap.setLayoutProperty(id, "visibility", on ? "visible" : "none"); };
  set("drives-glow", show.drives);
  set("drives-line", show.drives);
  set("charging-pts", show.charging);
  set("charging-count", show.charging);
  $("#legend").hidden = !show.drives;
}

function setupRange() {
  document.querySelectorAll(".range-btn").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.range === currentRange) return;
      document.querySelectorAll(".range-btn").forEach((x) => x.classList.toggle("on", x === b));
      currentRange = b.dataset.range;
      renderStats();
      loadData(true);
    });
  });
}

function setupLayers() {
  document.querySelectorAll(".lyr").forEach((b) => {
    b.addEventListener("click", () => {
      const layer = b.dataset.layer;
      show[layer] = !show[layer];
      b.classList.toggle("on", show[layer]);
      applyVisibility();
    });
  });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

boot();
