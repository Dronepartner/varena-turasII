/* Varėnos poligono virtuali lenta – viršelis.
   Lenta: Leaflet CRS.Simple; apačioje LiDAR reljefas, viršuje ortofoto per trynimo kaukę.
   Plytelių schema: assets/plyteles/{orto|lidar}/{z}/{x}/{y}.webp, z=6 → 0,5 m/px.
   Objektai ir figūrėlės: assets/objektai.json (ruošia _skriptai/paruosti_objektus.py). */
'use strict';

// Didelių failų (panoramų, PDF) vieta: nustatymai.js -> window.VARENA.failuBaze ('' = šalia svetainės)
const BAZE = (window.VARENA && window.VARENA.failuBaze) || '';

const ZN = 6;            // natyvus didžiausias zoom (0,5 m/px)
const MASK_DIV = 6;      // kaukės px = lentos px / 6 (3 m/px) – greitas trynimas visuose įrenginiuose
const BRUSH_PX = 38;     // teptuko spindulys ekrane
const UNDO_N = 12;       // kiek brūkšnių galima atšaukti

let map, orto, lidar, CFG, W, H, bounds, X0, Y0, X1, Y1, PXM, zFit = 2, liesta = false;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lksLL = (X, Y) => map.unproject([(X - X0) / PXM, (Y1 - Y) / PXM], ZN);
const objLL = id => map.unproject(CFG.objektai[id].centras_px, ZN);
const mobilus = () => innerWidth <= 700;

fetch('assets/objektai.json', { cache: 'no-cache' }).then(r => r.json()).then(init).catch(e => console.error('objektai.json', e));

function init(cfg) {
  CFG = cfg; PXM = cfg.pikselis_m;
  ({ X0, Y0, X1, Y1 } = cfg.sritis);
  W = Math.round(cfg.sritis.plotis_m / PXM);
  H = Math.round(cfg.sritis.aukstis_m / PXM);
  map = L.map('map', {
    crs: L.CRS.Simple, zoomControl: false, attributionControl: false, zoomSnap: 0, zoomDelta: 0.5,
    wheelPxPerZoomLevel: 120, maxZoom: 8, minZoom: -2, boxZoom: false, doubleClickZoom: false, keyboard: false,
    bounceAtZoomLimits: false
  });
  bounds = L.latLngBounds(map.unproject([0, H], ZN), map.unproject([W, 0], ZN));
  map.setMaxBounds(bounds.pad(0.6));          // laisvė pastumti kampinius objektus iš po gilzės / lentynos
  pradinisVaizdas();
  const opt = { maxNativeZoom: ZN, minNativeZoom: 0, minZoom: -2, bounds, noWrap: true, keepBuffer: 3 };
  lidar = L.tileLayer('assets/plyteles/lidar/{z}/{x}/{y}.webp', opt).addTo(map);
  initKauke();
  orto = new OrtoLayer(opt).addTo(map);
  tinklelis();
  piestiRema();
  initMoneta();
  initFiguros();
  initGarsas();
  $('#btn-is-naujo').onclick = isNaujo;
  initKalba(); initInfo(); initMokymas(); initPilnas();
  const el = map.getContainer();
  ['wheel', 'touchstart'].forEach(t => el.addEventListener(t, () => { liesta = true; }, { passive: true }));
  map.on('dragstart', () => { liesta = true; });
  map.on('zoom', figMastelis); figMastelis();
  map.on('zoomend', kvadratuEtiketes);
  let rt;
  window.addEventListener('resize', () => {
    piestiRema(); map.invalidateSize();
    clearTimeout(rt); rt = setTimeout(() => { piestiRema(); map.invalidateSize(); if (!liesta) pradinisVaizdas(); else ribotiZoom(); figMastelis(); }, 120);
  });
  if (!saugykla('varena_turasII_mokymas')) setTimeout(() => pradetiMokyma(), 600);
  else setTimeout(uzuominos, 1500);
}

function ribotiZoom() { zFit = map.getBoundsZoom(bounds); map.setMinZoom(zFit - 0.5); }
function pradinisVaizdas() {
  map.invalidateSize(); ribotiZoom();
  const zc = map.getBoundsZoom(bounds, true);          // užpildantis ekraną
  map.setView(bounds.getCenter(), zFit + Math.min(1.5, (zc - zFit) * 0.55), { animate: false });
  kvadratuEtiketes();
}
function kvadratuEtiketes() {          // smulkiuose kvadratuose etiketės slepiamos
  map.getContainer().classList.toggle('be-etikeciu', 1000 * Math.pow(2, map.getZoom() - ZN) < 70);
}

/* ---------- lentos rėmas: kniedytos tilto santvaros (SVG) ---------- */
function piestiRema() {
  const svg = $('#remas'), w = innerWidth, h = innerHeight;
  const T = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--remas')) || 30;
  const c = Math.max(3, T * 0.2), rk = Math.max(1.2, T * 0.06), P0 = T * 1.3;
  const s = [];
  s.push(`<defs>
    <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#94a394"/><stop offset=".45" stop-color="#5b6a5e"/><stop offset="1" stop-color="#2d3630"/></linearGradient>
    <linearGradient id="gV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#94a394"/><stop offset=".45" stop-color="#5b6a5e"/><stop offset="1" stop-color="#2d3630"/></linearGradient>
    <radialGradient id="kn" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#dfe6dc"/><stop offset=".45" stop-color="#7c897e"/><stop offset="1" stop-color="#1f2621"/></radialGradient>
    <linearGradient id="gP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d9c8e"/><stop offset=".5" stop-color="#55635a"/><stop offset="1" stop-color="#2b332e"/></linearGradient>
  </defs>`);
  // juosta: u – išilgai, v – skersai (0..T); hor – ar horizontali
  const juosta = (x0, y0, len, hor) => {
    const n = Math.max(1, Math.round(len / P0)), P = len / n;
    const pt = (u, v) => hor ? `${(x0 + u).toFixed(1)},${(y0 + v).toFixed(1)}` : `${(x0 + v).toFixed(1)},${(y0 + u).toFixed(1)}`;
    const rect = (u, v, du, dv) => hor ? [x0 + u, y0 + v, du, dv] : [x0 + v, y0 + u, dv, du];
    let diag = '', vert = '', kn = '';
    for (let i = 0; i < n; i++) {
      const u = i * P;
      diag += `M${pt(u, T - c / 2)}L${pt(u + P / 2, c / 2)}L${pt(u + P, T - c / 2)}`;
      vert += `M${pt(u + P / 2, c)}L${pt(u + P / 2, T - c)}`;
      for (const du of [0, P / 4, P / 2, 3 * P / 4]) for (const v of [c / 2, T - c / 2]) {
        const [x, y] = pt(u + du, v).split(',');
        kn += `<circle cx="${x}" cy="${y}" r="${rk.toFixed(1)}"/>`;
      }
    }
    const [ax, ay, aw, ah] = rect(0, 0, len, T);
    const [tx, ty, tw, th] = rect(0, 0, len, c), [bx, by, bw, bh] = rect(0, T - c, len, c);
    const g = hor ? 'url(#gH)' : 'url(#gV)';
    s.push(`<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#120c07" fill-opacity=".9"/>`,
      `<path d="${vert}" stroke="#1a201c" stroke-width="${(c * .5 + 2).toFixed(1)}" fill="none"/><path d="${vert}" stroke="#56645a" stroke-width="${(c * .5).toFixed(1)}" fill="none"/>`,
      `<path d="${diag}" stroke="#1a201c" stroke-width="${(c * .8 + 2).toFixed(1)}" fill="none" stroke-linejoin="round"/><path d="${diag}" stroke="#66766a" stroke-width="${(c * .8).toFixed(1)}" fill="none" stroke-linejoin="round"/>`,
      `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="${g}" stroke="#1a201c" stroke-width="1"/>`,
      `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${g}" stroke="#1a201c" stroke-width="1"/>`,
      `<g fill="url(#kn)" stroke="#111" stroke-width=".5">${kn}</g>`);
  };
  juosta(T, 0, w - 2 * T, true); juosta(T, h - T, w - 2 * T, true);
  juosta(0, T, h - 2 * T, false); juosta(w - T, T, h - 2 * T, false);
  // kampų kniedytos plokštės
  for (const [x, y] of [[0, 0], [w - T, 0], [0, h - T], [w - T, h - T]]) {
    const m = T * .22;
    s.push(`<rect x="${x + 1}" y="${y + 1}" width="${T - 2}" height="${T - 2}" rx="${T * .12}" fill="url(#gP)" stroke="#161b17" stroke-width="1.5"/>`,
      `<g fill="url(#kn)" stroke="#111" stroke-width=".5">` +
      [[m, m], [T - m, m], [m, T - m], [T - m, T - m], [T / 2, T / 2]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="${(rk * 1.25).toFixed(1)}"/>`).join('') + '</g>');
  }
  // vidinis kraštas – šešėlis ant žemėlapio
  s.push(`<rect x="${T - .5}" y="${T - .5}" width="${w - 2 * T + 1}" height="${h - 2 * T + 1}" fill="none" stroke="#0c0906" stroke-width="2"/>`);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = s.join('');
}

/* ---------- kvadratų tinklelis 500 m ---------- */
function tinklelis() {
  const g = L.layerGroup(), S = 500, xs = [], ys = [];
  for (let X = Math.ceil(X0 / S) * S; X < X1; X += S) if (X > X0 + 250) xs.push(X);
  for (let Y = Math.floor(Y1 / S) * S; Y > Y0; Y -= S) if (Y < Y1 - 250) ys.push(Y);
  const lo = { className: 'tinklelis', interactive: false };
  xs.forEach(X => L.polyline([lksLL(X, Y0), lksLL(X, Y1)], lo).addTo(g));
  ys.forEach(Y => L.polyline([lksLL(X0, Y), lksLL(X1, Y)], lo).addTo(g));
  [X0, ...xs].forEach((X, i) => [Y1, ...ys].forEach((Y, j) => (X1 - X > 250 && Y - Y0 > 250) && L.marker(lksLL(X, Y), {
    interactive: false, keyboard: false,
    icon: L.divIcon({ className: 'kvadratas', html: String.fromCharCode(65 + i) + (j + 1), iconSize: [30, 14], iconAnchor: [-5, -4] })
  }).addTo(g)));
  g.addTo(map);
}

/* ---------- kaukė (trynimas) ---------- */
let mask, mctx, base, bctx, strokes = [], cur = null;

function initKauke() {
  mask = document.createElement('canvas');
  mask.width = Math.ceil(W / MASK_DIV); mask.height = Math.ceil(H / MASK_DIV);
  mctx = mask.getContext('2d');
  base = document.createElement('canvas'); base.width = mask.width; base.height = mask.height;
  bctx = base.getContext('2d');
}

function teptukas(r) {          // minkštas apvalus teptukas (sprite)
  const c = document.createElement('canvas'), d = Math.ceil(r * 2) + 2;
  c.width = c.height = d;
  const g = c.getContext('2d'), gr = g.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, r);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, d, d);
  return c;
}

function piestiBruksni(ctx, s, nuo = 0) {   // nupiešia brūkšnio taškus [nuo..] į ctx
  if (s.visa) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, mask.width, mask.height); return; }
  const step = Math.max(1, s.r * 0.25), sp = s.sprite || (s.sprite = teptukas(s.r)), h = sp.width / 2;
  for (let i = Math.max(1, nuo); i < s.pts.length; i++) {
    const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = (i === 1 ? 0 : 1); k <= n; k++) ctx.drawImage(sp, x0 + (x1 - x0) * k / n - h, y0 + (y1 - y0) * k / n - h);
  }
  if (s.pts.length === 1 && nuo === 0) ctx.drawImage(sp, s.pts[0][0] - h, s.pts[0][1] - h);
}

function perpiesti() {          // kaukė = pagrindas + likę brūkšniai
  mctx.clearRect(0, 0, mask.width, mask.height);
  mctx.drawImage(base, 0, 0);
  for (const s of strokes) piestiBruksni(mctx, s);
  perpiestiPlyteles();
}

function ikaukesPx(cp) {        // ekrano (map container) taškas → kaukės px
  const p = map.project(map.containerPointToLatLng(cp), ZN);
  return [p.x / MASK_DIV, p.y / MASK_DIV];
}

let paskCp = null;
function pradetiBruksni(cp, pid) {
  const r = BRUSH_PX * Math.pow(2, ZN - map.getZoom()) / MASK_DIV;
  cur = { r, pts: [ikaukesPx(cp)], pid };
  paskCp = cp;
  piestiBruksni(mctx, cur, 0);
  zymetiPlyteles(sritis(cur.pts[0], cur.pts[0], r));
  Garsas.trinti(6);
  pazymeti('tryne');
}

function testiBruksni(cp) {
  const p = ikaukesPx(cp), last = cur.pts[cur.pts.length - 1];
  if (paskCp) Garsas.trinti(cp.distanceTo(paskCp)); paskCp = cp;
  if (Math.hypot(p[0] - last[0], p[1] - last[1]) < cur.r * 0.15) return;
  cur.pts.push(p);
  piestiBruksni(mctx, cur, cur.pts.length - 1);
  zymetiPlyteles(sritis(last, p, cur.r));
}

function baigtiBruksni() {
  Garsas.trinti(0);
  if (!cur) return;
  delete cur.pid; strokes.push(cur); cur = null;
  while (strokes.length > UNDO_N) piestiBruksni(bctx, strokes.shift());
}

function nutrauktiBruksni() { Garsas.trinti(0); if (cur) { cur = null; perpiesti(); } }

function atsaukti() { if (strokes.length) { strokes.pop(); perpiesti(); Garsas.spragt(); } }

function nutrintiViska() {
  strokes.push({ visa: true }); while (strokes.length > UNDO_N) piestiBruksni(bctx, strokes.shift());
  perpiesti(); Garsas.spragt();
  patarimas(tr('p_viska'), 3000);
}

const sritis = (a, b, r) => [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r];

/* ortofoto sluoksnis per kaukę */
const OrtoLayer = L.GridLayer.extend({
  createTile(c, done) {
    const t = document.createElement('canvas'); t.width = t.height = 256;
    t._c = { x: c.x, y: c.y, z: c.z };
    const img = new Image();
    img.onload = () => { t._img = img; piestiPlytele(t); done(null, t); };
    img.onerror = () => done(null, t);
    img.src = `assets/plyteles/orto/${c.z}/${c.x}/${c.y}.webp`;
    return t;
  }
});

function piestiPlytele(t) {
  const g = t.getContext('2d'), c = t._c, s = Math.pow(2, ZN - c.z) * 256 / MASK_DIV;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, 256, 256);
  if (t._img) g.drawImage(t._img, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  const sx = c.x * s, sy = c.y * s;     // kaukės sritis už drobės ribų apkerpama ranka (Safari)
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(mask.width, sx + s), y1 = Math.min(mask.height, sy + s);
  if (x1 > x0 && y1 > y0) g.drawImage(mask, x0, y0, x1 - x0, y1 - y0, (x0 - sx) / s * 256, (y0 - sy) / s * 256, (x1 - x0) / s * 256, (y1 - y0) / s * 256);
}

let nesvaru = null, rafTryn = 0;
function zymetiPlyteles(r) {            // trynimas: plytelės perpiešiamos ne dažniau kaip kartą per kadrą
  nesvaru = nesvaru ? [Math.min(nesvaru[0], r[0]), Math.min(nesvaru[1], r[1]), Math.max(nesvaru[2], r[2]), Math.max(nesvaru[3], r[3])] : r;
  if (!rafTryn) rafTryn = requestAnimationFrame(() => { rafTryn = 0; const q = nesvaru; nesvaru = null; perpiestiPlyteles(q); });
}

function perpiestiPlyteles(r) {
  if (!orto) return;
  for (const k in orto._tiles) {
    const t = orto._tiles[k].el; if (!t._c) continue;
    if (r) {
      const s = Math.pow(2, ZN - t._c.z) * 256 / MASK_DIV, x = t._c.x * s, y = t._c.y * s;
      if (x > r[2] || y > r[3] || x + s < r[0] || y + s < r[1]) continue;
    }
    piestiPlytele(t);
  }
}

/* ---------- moneta ---------- */
let rankoje = false, zymeklis, spust = null;
const pirstai = new Map();

function initMoneta() {
  const coin = $('#moneta'), el = map.getContainer();
  zymeklis = document.createElement('div'); zymeklis.id = 'moneta-zymeklis'; zymeklis.hidden = true;
  zymeklis.style.width = zymeklis.style.height = BRUSH_PX * 2 + 'px';
  document.body.appendChild(zymeklis);
  const cp = e => { const r = el.getBoundingClientRect(); return L.point(e.clientX - r.left, e.clientY - r.top); };
  const virsZemelapio = e => { const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  const rodytiZymekli = e => { zymeklis.hidden = false; zymeklis.style.left = e.clientX + 'px'; zymeklis.style.top = e.clientY + 'px'; };

  // monetos ištraukimas iš dėklo: paspaudus ir tempiant – iškart trina; paspaudus – paima / padeda
  let traukia = null;
  coin.addEventListener('pointerdown', e => {
    e.preventDefault(); coin.setPointerCapture(e.pointerId);
    traukia = { id: e.pointerId, x: e.clientX, y: e.clientY, judejo: false };
  });
  coin.addEventListener('pointermove', e => {
    if (!traukia || e.pointerId !== traukia.id) return;
    if (!traukia.judejo && Math.hypot(e.clientX - traukia.x, e.clientY - traukia.y) > 6) { traukia.judejo = true; nustatytiRankoje(true); }
    if (!traukia.judejo) return;
    rodytiZymekli(e);
    if (virsZemelapio(e)) { if (!cur) pradetiBruksni(cp(e), e.pointerId); else testiBruksni(cp(e)); }
  });
  const atleisti = e => {
    if (!traukia || e.pointerId !== traukia.id) return;
    if (!traukia.judejo) nustatytiRankoje(!rankoje);
    baigtiBruksni(); traukia = null;
    if (e.pointerType !== 'mouse') zymeklis.hidden = true;
  };
  coin.addEventListener('pointerup', atleisti);
  coin.addEventListener('pointercancel', atleisti);

  // moneta rankoje: 1 pirštas / pelė trina, 2 pirštai – slenka / artina (Leaflet)
  el.addEventListener('pointerdown', e => {
    pirstai.set(e.pointerId, e);
    if (!rankoje) return;
    if (pirstai.size > 1) { nutrauktiBruksni(); zymeklis.hidden = true; return; }
    if (e.button > 0) return;
    spust = { id: e.pointerId, x: e.clientX, y: e.clientY };            // v4: gal tai tik spustelėjimas ant objekto ikonos
    pradetiBruksni(cp(e), e.pointerId); rodytiZymekli(e);
  }, true);
  el.addEventListener('pointermove', e => {
    if (!rankoje) return;
    if (e.pointerType === 'mouse' || cur) rodytiZymekli(e);
    if (cur && cur.pid === e.pointerId && pirstai.size === 1) testiBruksni(cp(e));
  }, true);
  const pakelti = e => {
    pirstai.delete(e.pointerId);
    // v4: trinant ikonos įvykių negauna (CSS .trina); spustelėjus ikoną nejudinant – atveriamas objektas
    if (rankoje && spust && spust.id === e.pointerId && e.type === 'pointerup' && Math.hypot(e.clientX - spust.x, e.clientY - spust.y) < 8) {
      const id = Object.keys(FIG).find(k => { const F = FIG[k]; if (!F.padeta || !F.marker) return false;
        const im = F.marker.getElement() && F.marker.getElement().querySelector('img'); if (!im) return false;
        const r = im.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      if (id) { spust = null; nutrauktiBruksni(); nustatytiRankoje(false); atidarytiPortala(id, e.clientX, e.clientY); return; }
    }
    spust = null;
    if (cur && cur.pid === e.pointerId) baigtiBruksni();
    if (e.pointerType !== 'mouse' && pirstai.size === 0) zymeklis.hidden = true;
  };
  el.addEventListener('pointerup', pakelti, true);
  el.addEventListener('pointercancel', pakelti, true);
  el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { zymeklis.hidden = true; pakelti(e); } }, true);

  $('#btn-atsaukti').onclick = atsaukti;
  $('#btn-viska').onclick = nutrintiViska;
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') atsaukti();
    if (e.key === 'Escape') { nustatytiRankoje(false); if (!$('#istorija').hidden) { $('#istorija').hidden = true; return; } uzdarytiPortala(); $('#info').hidden = true; if (!$('#mokymas').hidden) baigtiMokyma(); }
  });
}

function nustatytiRankoje(v) {
  if (rankoje !== v) Garsas.spragt();
  rankoje = v;
  $('#moneta').classList.toggle('rankoje', v);
  map.getContainer().classList.toggle('trina', v);
  if (v) {
    map.dragging.disable();
    patarimas(tr(mobilus() ? 'p_rankoje_tel' : 'p_rankoje_pc'), 3500);
  } else { map.dragging.enable(); zymeklis.hidden = true; }
}

/* ---------- figūrėlės ---------- */
const FIG = {};
let tempiama = null, laukia = null, rafId = 0, kontura = null, svytejimas = null, rodomasId = null;

function figDydis() {                  // visos figūrėlės – vienodo dydžio kortelės (plotis × aukštis)
  return mobilus() ? [72, 50] : [96, 66];
}

function figuraEl(id) {
  const o = CFG.objektai[id], F = FIG[id], f = document.createElement('div');
  f.className = 'figura'; f.dataset.id = id;
  f.innerHTML = `<div class="fig-kortele" style="width:${F.w}px;height:${F.h}px"><img src="${o.kortele || o.figura}" alt="${pavad(id)}" draggable="false"></div><div class="padukas"></div>`;
  return f;
}

/* ikonos ant lentos: ne tikros proporcijos, o tvarka – horizontalūs objektai vienodo aukščio,
   vertikalūs (bokštas, cerkvė) – vienodo aukščio, redutai – didesni; dx/dy – poslinkis, kad neužsidengtų */
const IKONA = { HOR: 60, VERT: 78, MAXW: 210,
  redutai: { h: 124 }, cerkve: { v: 1, dx: 62, dy: 14 }, bokstas: { v: 1, dx: 20, dy: 28 },
  klubas: { dx: -28 }, stotis: { dx: -18, dy: -16 },
  sandeliai: { kortele: 1 }, barakai: { kortele: 1 }, merkio_tiltas: { kortele: 1 } };
function objektoEl(id) {                 // ant žemėlapio – objektas be kortelės fono
  const o = CFG.objektai[id], c = IKONA[id] || {}, f = document.createElement('div');
  const src = c.kortele ? o.kortele : o.figura, [w, h] = c.kortele ? o.kortele_px : o.figura_px;
  const hh = c.h || (c.v ? IKONA.VERT : IKONA.HOR), ww = c.h || c.v ? hh * w / h : Math.min(IKONA.MAXW, hh * w / h);
  f.className = 'figura objektas'; f.dataset.id = id;
  f.style.cssText = `--dx:${c.dx || 0};--dy:${c.dy || 0}`;
  f.innerHTML = `<img src="${src}" alt="${pavad(id)}" draggable="false" style="width:${ww.toFixed(0)}px;height:${hh.toFixed(0)}px"><div class="padukas"></div>`;
  return f;
}

function initFiguros() {
  const lent = $('#figuru-lentyna');
  for (const id in CFG.objektai) {
    const [w, h] = figDydis();
    FIG[id] = { w, h, padeta: false, marker: null };
    const v = document.createElement('div'); v.className = 'vieta'; v.title = pavad(id);
    const f = figuraEl(id); v.appendChild(f); lent.appendChild(v);
    Object.assign(FIG[id], { vieta: v, fig: f });
    f.addEventListener('pointerdown', e => figPaspausta(e, id));
  }
  window.addEventListener('pointermove', figJuda);
  window.addEventListener('pointerup', figAtleista);
  window.addEventListener('pointercancel', figAtleista);
  isdestytiLentyna();
  window.addEventListener('resize', isdestytiLentyna);
}

/* lentyna: visos 9 figūrėlės visada matomos – mažinamos arba dėliojamos į 2–3 eiles */
function isdestytiLentyna() {
  const siaura = innerWidth < 760 || innerHeight > innerWidth * 1.05;
  document.body.classList.toggle('siaura', siaura);
  const lent = $('#figuru-lentyna'), ids = Object.keys(FIG);
  lent.querySelectorAll('.lauzis').forEach(e => e.remove());
  const Wa = lent.clientWidth - 16, gap = siaura ? 8 : 14, maxH = innerHeight * (siaura ? 0.3 : 0.26);
  const baze = ids.map(id => figDydis());
  let geriausias = null;
  for (let n = 1; n <= 3; n++) {
    const per = Math.ceil(ids.length / n);
    let plo = 0, aukst = 0;
    for (let r = 0; r < n; r++) {
      const eil = baze.slice(r * per, (r + 1) * per); if (!eil.length) continue;
      plo = Math.max(plo, eil.reduce((a, [w]) => a + w + 6, 0) + gap * (eil.length - 1));
      aukst += Math.max(...eil.map(([, h]) => h)) + 12;
    }
    const sk = Math.min(1, Wa / plo, maxH / aukst);
    if (!geriausias || sk > geriausias.sk + 0.04) geriausias = { n, per, sk };
    if (sk >= 0.85) break;
  }
  const { per, sk } = geriausias;
  ids.forEach((id, i) => {
    const F = FIG[id], [w, h] = baze[i];
    F.w = Math.round(w * sk); F.h = Math.round(h * sk);
    const sut = el => { el.querySelectorAll('.fig-kortele').forEach(k => { k.style.width = F.w + 'px'; k.style.height = F.h + 'px'; }); };
    sut(F.vieta); if (F.marker) sut(F.marker.getElement());
    if (i > 0 && i % per === 0) { const b = document.createElement('div'); b.className = 'lauzis'; lent.insertBefore(b, F.vieta); }
  });
  lent.style.columnGap = gap + 'px';
  document.documentElement.style.setProperty('--lh', lent.offsetHeight + 'px');
}

function figPaspausta(e, id) {
  if (tempiama || e.button > 0) return;
  if (FIG[id].padeta) {                        // jau padėtas: lentynoje paspaudus vėl atveriamas objektas
    e.stopPropagation(); if (rankoje) nustatytiRankoje(false);
    const r = e.currentTarget.getBoundingClientRect();
    atidarytiPortala(id, r.left + r.width / 2, r.top + r.height / 2);
    return;
  }
  e.stopPropagation();
  if (e.pointerType === 'mouse') e.preventDefault();
  laukia = { id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, tipas: e.pointerType };
}

function figJuda(e) {
  if (tempiama && tempiama.pid === e.pointerId && tempiama.mode === 'drag') { taikinys(e); return; }
  if (!laukia || laukia.pid !== e.pointerId) return;
  const dx = e.clientX - laukia.x0, dy = e.clientY - laukia.y0, d = Math.hypot(dx, dy);
  if (d > (laukia.tipas === 'mouse' ? 4 : 8)) pradetiTempima(e);
}

function taikinys(e) {             // padukas – po pele; telefone šiek tiek virš piršto
  tempiama.tx = e.clientX; tempiama.ty = e.clientY + (tempiama.tipas === 'mouse' ? 10 : -34);
  tempiama.px = e.clientX; tempiama.py = e.clientY;
}

function pradetiTempima(e) {
  const { id, pid, tipas } = laukia; laukia = null;
  const F = FIG[id], r = F.fig.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'skrenda'; el.appendChild(figuraEl(id));
  map.getContainer().classList.add('renkasi');          // padėti objektai susitraukia ir atidengia vietas
  const sh = document.createElement('div'); sh.className = 'seselis';
  sh.style.width = F.w * 0.9 + 'px'; sh.style.height = Math.max(10, F.w * 0.18) + 'px';
  $('#skrydis').append(sh, el);
  F.vieta.classList.add('tuscia');
  tempiama = { id, pid, tipas, el, sh, fig: el.firstChild, x: r.left + r.width / 2, y: r.bottom, vx: 0, vy: 0,
    h: 0, vh: 0, tilt: 0, sc: 1, mode: 'drag', isejo: false, t: 0, kadras: 0 };
  taikinys(e);
  rodytiKontura(id, true);
  Garsas.paimti();
  patarimas(`${pavad(id)}: ${tr('p_nesk')}`, 2500);
  slepUzuomina();
  if (!rafId) rafId = requestAnimationFrame(zingsnis);
}

function figAtleista(e) {
  if (laukia && laukia.pid === e.pointerId) { laukia = null; return; }
  const T = tempiama;
  if (!T || T.pid !== e.pointerId || T.mode !== 'drag') return;
  const el = map.getContainer(), r = el.getBoundingClientRect();
  const virs = T.px >= r.left && T.px <= r.right && T.py >= r.top && T.py <= r.bottom && !virsLentynos(T.px, T.py);
  const cp = L.point(T.tx - r.left, T.ty - r.top), pp = L.point(T.px - r.left, T.py - r.top);
  // sprendžia tai, ką žmogus mato: figūrėlė (prisitraukusi) arti vietos – padedama, net jei pirštas jau virš lentynos
  const traukia = vietosAtstumas(T.id, T.x, T.y) < magnetoR() * 1.15 || vietosAtstumas(T.id, T.tx, T.ty) < magnetoR() * 1.15;
  if (e.type === 'pointerup' && (traukia || (virs && (pataikeI(T.id, cp) || pataikeI(T.id, pp))))) {
    T.mode = 'deti'; T.vh = 280;
  } else {
    T.mode = 'grizti'; T.vh = 520;
    rodytiKontura(null, false);
    if (e.type === 'pointerup') patarimas(tr('p_ne_ta'), 2500);
  }
}

function virsLentynos(x, y) {
  const r = $('#figuru-lentyna').getBoundingClientRect();
  return y > r.top + 10 && x > r.left && x < r.right;
}

function vietosTaskas(T) {          // kur turi nusileisti
  if (T.mode === 'deti') {
    const r = map.getContainer().getBoundingClientRect(), p = map.latLngToContainerPoint(objLL(T.id));
    return [r.left + p.x, r.top + p.y];
  }
  if (T.mode === 'grizti') { const r = FIG[T.id].fig.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom]; }
  return [T.tx, T.ty];
}

function zingsnis(t) {
  const T = tempiama;
  if (!T) { rafId = 0; return; }
  const dt = T.t ? Math.min(0.034, (t - T.t) / 1000) : 0.016; T.t = t;
  const [gx, gy] = vietosTaskas(T);
  const kz = figMastelis.k || 1;
  if (T.mode === 'drag') {
    const K = 230, D = 17;                                   // spyruoklė: figūrėlė vėluoja ir siūbuoja
    let ax = gx, ay = gy;
    // magnetas: ekrano pikseliais, traukia tuo stipriau, kuo arčiau vieta (iki 2R pradeda traukti)
    const R = magnetoR(), [vx, vy] = vietaEkrane(T.id), d = Math.hypot(vx - gx, vy - gy);
    const jega = d < 2 * R ? Math.pow(1 - d / (2 * R), 0.6) : 0;
    ax += (vx - gx) * 0.85 * jega; ay += (vy - gy) * 0.85 * jega;
    T.arti = d < 2 * R;
    if (kontura && kontura._path) kontura._path.classList.toggle('arti', d < R * 1.15);
    T.vx += ((ax - T.x) * K - T.vx * D) * dt; T.vy += ((ay - T.y) * K - T.vy * D) * dt;
    T.h += (26 - T.h) * Math.min(1, dt * 10);
    const r = map.getContainer().getBoundingClientRect();
    const virsZem = T.py < r.bottom - 10 && !virsLentynos(T.px, T.py);
    if (virsZem && T.py < r.bottom - 110) T.isejo = true;
    T.sc += ((virsZem ? Math.max(kz, 0.8) : 1.06) - T.sc) * Math.min(1, dt * 8);
    if (T.isejo && !T.arti && !vietaMatoma(T.id)) autoSlinkti(r, T.px, T.py);   // lenta slenka tik jei vietos nesimato
  } else {
    const K = T.mode === 'deti' ? 160 : 70, D = T.mode === 'deti' ? 22 : 14;
    T.vx += ((gx - T.x) * K - T.vx * D) * dt; T.vy += ((gy - T.y) * K - T.vy * D) * dt;
    T.vh -= 2300 * dt; T.h += T.vh * dt;
    if (T.h <= 0 && T.vh < 0) {
      T.h = 0;
      if (T.vh < -150) { Garsas.padeti(Math.min(1, -T.vh / 700)); T.vh = -T.vh * 0.36; }
      else T.vh = 0;
    }
    T.sc += ((T.mode === 'deti' ? kz : 1) - T.sc) * Math.min(1, dt * 7);
    if (T.h === 0 && T.vh === 0 && Math.hypot(gx - T.x, gy - T.y) < 3 && Math.hypot(T.vx, T.vy) < 40) { nusileido(T); return; }
  }
  T.x += T.vx * dt; T.y += T.vy * dt;
  T.tilt += (clamp(T.vx * 0.03, -24, 24) - T.tilt) * Math.min(1, dt * 12);
  T.el.style.transform = `translate(${T.x.toFixed(1)}px, ${(T.y - T.h).toFixed(1)}px)`;
  T.fig.style.transform = `translate(-50%, -100%) rotate(${T.tilt.toFixed(2)}deg) scale(${(T.sc * (1 + T.h / 260)).toFixed(3)})`;
  const ss = T.sc * (1 + T.h / 70);
  T.sh.style.transform = `translate(${(T.x + T.h * 0.35).toFixed(1)}px, ${(T.y + 2).toFixed(1)}px) translate(-50%, -50%) scale(${ss.toFixed(3)})`;
  T.sh.style.opacity = clamp(0.75 - T.h / 90, 0.2, 0.75).toFixed(2);
  if ((T.kadras++ & 3) === 0) atnaujintiRodykle();
  rafId = requestAnimationFrame(zingsnis);
}

function autoSlinkti(r, x, y) {     // tempiant prie lentos krašto – lenta slenka
  const m = 46, v = 12;
  const dx = x < r.left + m ? -v : x > r.right - m ? v : 0;
  const dy = y < r.top + m ? -v : y > r.bottom - m && !virsLentynos(x, y) ? v : 0;
  if (dx || dy) map.panBy([dx, dy], { animate: false });
}

function nusileido(T) {
  T.el.remove(); T.sh.remove(); tempiama = null; rafId = 0;
  map.getContainer().classList.remove('renkasi');
  if (T.mode === 'deti') {
    rodytiKontura(null, false);
    padetiFigura(T.id);
    pazymeti('padejo');
    setTimeout(() => {
      const r = map.getContainer().getBoundingClientRect(), p = map.latLngToContainerPoint(objLL(T.id));
      atidarytiPortala(T.id, r.left + p.x, r.top + p.y);
    }, 450);
  } else FIG[T.id].vieta.classList.remove('tuscia');
}

const magnetoR = () => (matchMedia('(pointer: coarse)').matches || mobilus() ? 90 : 80);
function vietaEkrane(id) { const r = map.getContainer().getBoundingClientRect(), p = map.latLngToContainerPoint(objLL(id)); return [r.left + p.x, r.top + p.y]; }
function vietosAtstumas(id, x, y) { const [vx, vy] = vietaEkrane(id); return Math.hypot(vx - x, vy - y); }
function saugiZona() {                 // žemėlapio dalis, kurios neuždengia lentyna ir gilzė (piktogramos – atskirai, tik dešinėje viršuje)
  const r = map.getContainer().getBoundingClientRect();
  const apacia = Math.min($('#figuru-lentyna').getBoundingClientRect().top, $('#moneta-dekla').getBoundingClientRect().top);
  return { l: r.left + 40, r: r.right - 40, t: r.top + 40, b: Math.min(r.bottom, apacia) - 40, pk: $('#piktogramos').getBoundingClientRect() };
}
const poPiktogramom = (x, y, z) => x > z.pk.left - 30 && y < z.pk.bottom + 30;
function vietaMatoma(id) { const [x, y] = vietaEkrane(id), z = saugiZona(); return x > z.l && x < z.r && y > z.t && y < z.b && !poPiktogramom(x, y, z); }

function konturaLatLng(id, didinti = 1) {
  const o = CFG.objektai[id], [cx, cy] = o.centras_px;
  return o.kontura_px.map(([x, y]) => map.unproject([cx + (x - cx) * didinti, cy + (y - cy) * didinti], ZN));
}

function pataikeI(id, cp) {
  const pts = konturaLatLng(id, 1.7).map(p => map.latLngToContainerPoint(p));
  let vid = false;                       // taškas daugiakampyje (ray casting)
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if ((pts[i].y > cp.y) !== (pts[j].y > cp.y) && cp.x < (pts[j].x - pts[i].x) * (cp.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) vid = !vid;
  }
  return vid || cp.distanceTo(map.latLngToContainerPoint(objLL(id))) < (mobilus() ? 70 : 85);
}

function rodytiKontura(id, v) {
  if (kontura) { kontura.remove(); svytejimas.remove(); kontura = svytejimas = null; }
  $('#rodykle').hidden = true; rodomasId = null;
  if (!v) return;
  rodomasId = id;
  kontura = L.polygon(konturaLatLng(id, 1.7), { className: 'kontura-svyti', color: '#ffd76a', weight: 4, fillColor: '#ffd76a', fillOpacity: .2, interactive: false }).addTo(map);
  svytejimas = L.circleMarker(objLL(id), { radius: magnetoR() * 0.6, className: 'kontura-svyti', color: '#ffd76a', weight: 3, fillOpacity: .12, interactive: false }).addTo(map);
  atidengtiVieta(id);
  atnaujintiRodykle();
}

function atidengtiVieta(id) {          // paėmus figūrėlę lenta vieną kartą pasistumia, kad vieta būtų matoma saugioje zonoje
  const [x, y] = vietaEkrane(id), z = saugiZona();
  if (vietaMatoma(id)) return;
  const cx = (z.l + z.r) / 2, cy = (z.t + z.b) / 2;
  const sx = z.r - z.l > 120 ? clamp(x, z.l + 50, z.r - 50) : cx, sy = z.b - z.t > 120 ? clamp(y, z.t + 50, z.b - 50) : cy;
  let dx = x - sx, dy = y - sy;
  if (poPiktogramom(sx, sy, z)) dy = y - Math.max(sy, z.pk.bottom + 50);
  if (dx || dy) map.panBy([dx, dy], { duration: 0.45 });
}

function atnaujintiRodykle() {
  const a = $('#rodykle');
  if (!rodomasId || !map) { a.hidden = true; return; }
  const r = map.getContainer().getBoundingClientRect();
  const c = map.latLngToContainerPoint(objLL(rodomasId));
  const m = 44;
  if (c.x >= 0 && c.y >= 0 && c.x <= r.width && c.y <= r.height) { a.hidden = true; return; }
  const cx = r.width / 2, cy = r.height / 2, dx = c.x - cx, dy = c.y - cy;
  const k = Math.min((r.width / 2 - m) / Math.abs(dx || 1e-6), (r.height / 2 - m) / Math.abs(dy || 1e-6));
  a.hidden = false;
  a.style.left = (r.left + cx + dx * k - 27) + 'px'; a.style.top = (r.top + cy + dy * k - 27) + 'px';
  a.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
}

function figMastelis() {               // padėtų figūrėlių dydis pagal artinimą
  const ekr = clamp(Math.min(innerWidth, innerHeight) / 900, 0.45, 1);   // mažame ekrane ikonos mažesnės, kad nesusigrūstų
  const k = clamp(0.5 * Math.pow(1.35, map.getZoom() - zFit), 0.3, 1.0) * ekr;
  figMastelis.k = k;
  map.getContainer().style.setProperty('--fk', k.toFixed(3));
}

function padetiFigura(id) {
  const F = FIG[id];
  F.padeta = true;
  F.marker = L.marker(objLL(id), {
    icon: L.divIcon({ className: 'fig-zymeklis nusileido', html: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
    keyboard: false, riseOnHover: true, zIndexOffset: Math.round(CFG.objektai[id].centras_px[1])
  }).addTo(map);
  const el = F.marker.getElement();
  el.appendChild(objektoEl(id));
  el.title = pavad(id);
  F.marker.on('click', () => {
    if (tempiama) return;
    if (rankoje) nustatytiRankoje(false);      // trintukas rankoje nebeblokuoja objekto atvėrimo
    const p = map.latLngToContainerPoint(F.marker.getLatLng()), r = map.getContainer().getBoundingClientRect();
    atidarytiPortala(id, r.left + p.x, r.top + p.y);
  });
  setTimeout(() => el.classList.remove('nusileido'), 600);
}

/* ---------- portalas: 360° turas (assets/ture/<turas>.json) arba užsklanda „Netrukus“ ---------- */
const TURAI = {};
let viewer = null, dabTuras = null, dabTurasId = null;
const ltEn = o => (o && (o[LANG] ?? o.lt)) || '';

async function gautiTura(t) {
  if (!TURAI[t]) TURAI[t] = await fetch(`assets/ture/${t}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return TURAI[t];
}

async function atidarytiPortala(id, x, y) {
  const p = $('#portalas'), o = CFG.objektai[id];
  p.style.setProperty('--px', x + 'px'); p.style.setProperty('--py', y + 'px');
  Garsas.atverti();
  if (o.turas) {
    try {
      const T = await gautiTura(o.turas);
      p.classList.add('su-turu'); $('#portalo-korta').hidden = true; $('#turas').hidden = false; p.hidden = false;
      dabTuras = T; dabTurasId = o.turas; dabObjektas = null;
      $('#turo-info').classList.toggle('suskleista', mobilus());
      rodytiTura(o.turo_scena || T.pradzia, o.turo_yaw, o.turo_pitch);   // v4: objektas gali nurodyti pradinę kryptį
      const s0 = scenaPagalId(o.turo_scena || T.pradzia);
      if (s0 && s0.galva) rodytiScenosAntraste(s0, T); else rodytiObjektoAntraste(s0 && s0.objektas && CFG.objektai[s0.objektas] ? s0.objektas : id, T);
      return;
    } catch (e) { console.error('turas', o.turas, e); klaidaTure = e; }
  }
  p.classList.remove('su-turu'); $('#turas').hidden = true; $('#portalo-korta').hidden = false;
  $('#portalo-pav').textContent = pavad(id);
  $('#portalo-fig').src = o.figura;
  p.hidden = false;
}
var klaidaTure = null;

function rodytiObjektoAntraste(id, T) {     // bendras turas (stoties zona) – antraštėje pasirinktas objektas
  const o = CFG.objektai[id], vardas = pavad(id), turas = ltEn(T.pavadinimas);
  if (!o.turo_istorija || vardas === turas) return;
  $('#turo-pav').textContent = vardas;
  const sc = scenaPagalId(o.turo_scena || T.pradzia);
  const h = sc && (sc.istorijos || []).find(x => x.antraste.lt === o.turo_istorija);
  $('#turo-ivadas').textContent = (h ? ltEn(h.tekstas) + '\n\n' : '') + turas + '. ' + ltEn(T.ivadas);
  dabObjektas = id;
}
let dabObjektas = null;
function rodytiScenosAntraste(s, T) {     // v4: bendros karinio miestelio scenos - antraštė „Karinis miestelis“, ne paskutinio objekto vardas
  $('#turo-pav').textContent = ltEn(s.galva); $('#turo-ivadas').textContent = ltEn(T.ivadas); dabObjektas = null;
}

function uzdarytiPortala() {
  const b = !$('#portalas').hidden;
  $('#portalas').hidden = true;
  if (viewer) { viewer.destroy(); viewer = null; }
  if (window.Mini3D) window.Mini3D.slepti();
  $('#istorija').hidden = true;
  if (b) setTimeout(uzuominos, 800);
}

function scenaPagalId(id) { return dabTuras.scenos.find(s => s.id === id); }

function hsEtikete(div, tekstas) {           // perėjimo rodyklė su užrašu
  div.innerHTML = '<span class="hs-rodykle"></span>';
  const s = document.createElement('span'); s.className = 'hs-uzrasas'; s.textContent = tekstas; div.appendChild(s);
}
function hsInfo(div, tekstas) {
  div.innerHTML = '<span class="hs-i">i</span>';
  const s = document.createElement('span'); s.className = 'hs-uzrasas'; s.textContent = tekstas; div.appendChild(s);
}

function rodytiTura(pradzia, yaw, pitch) {
  const T = dabTuras, tid = dabTurasId;
  if (viewer) { viewer.destroy(); viewer = null; }
  const scenes = {};
  for (const s of T.scenos) {
    const hs = [];
    for (const p of s.perejimai || []) {
      const tiksl = scenaPagalId(p.i); if (!tiksl) continue;
      hs.push({ yaw: p.yaw, pitch: p.pitch, cssClass: 'hs-perejimas', createTooltipFunc: hsEtikete, createTooltipArgs: ltEn(p.uzrasas || tiksl.pavadinimas),
        clickHandlerFunc: () => pereiti(p) });
    }
    for (const h of s.istorijos || []) {
      hs.push({ yaw: h.yaw, pitch: h.pitch, cssClass: 'hs-istorija', createTooltipFunc: hsInfo, createTooltipArgs: ltEn(h.antraste),
        clickHandlerFunc: () => rodytiIstorija(h) });
    }
    scenes[s.id] = {
      ...(s.mr ? { type: 'multires', multiRes: { ...s.mr, basePath: BAZE + s.mr.basePath } }
               : { type: 'equirectangular', panorama: `${BAZE}assets/pano_web/${tid}/${s.id}.jpg?v=o2` }),
      yaw: s.id === pradzia && yaw !== undefined ? yaw : (s.yaw || 0), pitch: s.id === pradzia && pitch !== undefined ? pitch : (s.pitch || 0),
      hfov: innerHeight > innerWidth ? 65 : (mobilus() ? 90 : 100), minHfov: s.rusis === 'rekonstrukcija' ? 55 : 35, maxHfov: 115,   // rekonstrukcijų neleidžiama per daug priartinti
      compass: s.siaure !== undefined, northOffset: s.siaure || 0, hotSpots: hs
    };
  }
  viewer = pannellum.viewer('pano', {
    default: { firstScene: pradzia, sceneFadeDuration: 900, autoLoad: true, showControls: false, keyboardZoom: true, friction: 0.15 },
    scenes
  });
  const filtras = id => { const sc = scenaPagalId(id), c = document.querySelector('#pano .pnlm-render-container'); if (c) c.style.filter = (sc && sc.filtras) || ''; };
  filtras(pradzia);
  viewer.on('scenechange', sc => { filtras(sc); zymetiScena(sc); const so = scenaPagalId(sc); if (so && so.galva) rodytiScenosAntraste(so, T); else if (so && so.objektas && CFG.objektai[so.objektas]) rodytiObjektoAntraste(so.objektas, T); $('#istorija').hidden = true; $('#turo-info').classList.add('suskleista'); });
  viewer.on('error', e => console.error('pannellum', e));
  rodytiMini3d(T);
  $('#turo-pav').textContent = ltEn(T.pavadinimas);
  $('#turo-ivadas').textContent = ltEn(T.ivadas);
  $('#btn-turo-kalba').textContent = LANG === 'en' ? 'LT' : 'EN';
  const j = $('#turo-juosta'); j.innerHTML = '';
  for (const s of T.scenos) {
    const b = document.createElement('button'); b.className = 'scena'; b.dataset.id = s.id;
    b.innerHTML = `<img src="${BAZE}${s.mr ? s.mr.basePath + '_maza.jpg' : `assets/pano_web/${tid}/${s.id}_maza.jpg?v=o2`}" alt=""><i class="zyma ${s.rusis || ''}"></i><span></span>`;
    b.querySelector('.zyma').textContent = zymaTekstas(s);
    b.querySelector('span').textContent = ltEn(s.pavadinimas);
    b.onclick = () => { if (viewer.getScene() !== s.id) viewer.loadScene(s.id); };
    j.appendChild(b);
  }
  zymetiScena(pradzia);
}

var mini3dModulis = null;                  // mažas 3D žemėlapis (tik turams su 'mini3d'); three.js kraunamas tik tada
function rodytiMini3d(T) {
  if (!T.mini3d) { if (window.Mini3D) window.Mini3D.slepti(); return; }
  const c = { ...T.mini3d, glb: BAZE + T.mini3d.glb, uzuomina: ltEn(T.mini3d.uzuomina), atgal: ltEn(T.mini3d.atgal) }, v = viewer;
  mini3dModulis = mini3dModulis || import('./mini3d.js?v=5');
  mini3dModulis.then(() => { if (viewer === v) window.Mini3D.rodyti(c, v); }).catch(e => console.error('mini3d', e));
}

function pereiti(p) {                        // trumpas „priėjimas“ link rodyklės, tada nauja scena
  Garsas.spragt();
  viewer.lookAt(p.pitch, p.yaw, Math.max(45, viewer.getHfov() - 35), 450, () => {
    if (p.poslinkis !== undefined) viewer.loadScene(p.i, 0, viewer.getYaw() + p.poslinkis, viewer.getHfov() + 35);   // ta pati žiūrėjimo kryptis
    else viewer.loadScene(p.i);
  });
}

const zymaTekstas = s => tr(s.rusis === 'dabar' ? 'z_dabar' : s.rusis === 'oras' ? 'z_oras' : 'z_rekonstr');

function zymetiScena(id) {
  const s = scenaPagalId(id); if (!s) return;
  $('#turo-scena').textContent = ltEn(s.pavadinimas) + ' · ' + (s.pagrindas ? ltEn(s.pagrindas) : zymaTekstas(s));
  document.querySelectorAll('#turo-juosta .scena').forEach(b => {
    const a = b.dataset.id === id; b.classList.toggle('aktyvi', a);
    if (a) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
}

let dabIstorija = null;
function rodytiIstorija(h, tyliai) {
  dabIstorija = h;
  if (!tyliai) Garsas.spragt();
  const k = $('#istorija');
  $('#ist-antraste').textContent = ltEn(h.antraste);
  $('#ist-tekstas').textContent = ltEn(h.tekstas);
  if (h.vaizdas) {
    $('#ist-img').src = (h.vaizdas.startsWith('assets/') ? BAZE : '') + h.vaizdas; $('#ist-paaisk').textContent = ltEn(h.vaizdo_paaiskinimas); $('#ist-fig').hidden = false;
  } else $('#ist-fig').hidden = true;
  k.hidden = false; k.scrollTop = 0;
  $('#turo-info').classList.add('suskleista');
}

function perkrautiTuraKalba() {
  if (!viewer || $('#turas').hidden) return;
  const atvira = !$('#istorija').hidden && dabIstorija;
  rodytiTura(viewer.getScene(), viewer.getYaw(), viewer.getPitch());
  if (dabObjektas) rodytiObjektoAntraste(dabObjektas, dabTuras);
  if (atvira) rodytiIstorija(dabIstorija, true);
}

$('#btn-grizti').onclick = uzdarytiPortala;
$('#btn-i-lenta').onclick = uzdarytiPortala;
$('#portalas').addEventListener('click', e => { if (e.target.id === 'portalas') uzdarytiPortala(); });
$('#istorija .uzdaryti').onclick = () => { $('#istorija').hidden = true; };
$('#btn-ivadas').onclick = () => $('#turo-info').classList.toggle('suskleista');
$('#btn-turo-kalba').onclick = () => $('#btn-kalba').click();


/* ---------- garsas: tik sintezuojamas naršyklėje (WebAudio), žr. kreditai.txt ---------- */
const Garsas = (() => {
  let ctx = null, master, trynG, trynF, trynT;
  let ijungta = saugykla('varena_garsas') !== '0'; // įjungta, kol lankytojas pats neišjungia
  const now = () => ctx.currentTime;
  function triuksmas(sek, rudas) {
    const n = Math.round(ctx.sampleRate * sek), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (rudas) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function saltinis(buf, loop = true) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }
  function lfo(f, gylis, tikslas) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = gylis; o.connect(g).connect(tikslas); o.start(); }
  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = ijungta ? 1 : 0; master.connect(ctx.destination);
    // tylus fonas: vėjas pušyne (rudas triukšmas + aukštesnis ošimas, lėtai banguoja)
    const rudas = triuksmas(8, true), baltas = triuksmas(4, false);
    const v1 = saltinis(rudas), lp = ctx.createBiquadFilter(), g1 = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 420; g1.gain.setValueAtTime(0, now()); g1.gain.linearRampToValueAtTime(0.05, now() + 4);
    v1.connect(lp).connect(g1).connect(master); v1.start(); lfo(0.06, 0.025, g1.gain);
    const v2 = saltinis(baltas), bp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.5; g2.gain.setValueAtTime(0, now()); g2.gain.linearRampToValueAtTime(0.006, now() + 5);
    v2.connect(bp).connect(g2).connect(master); v2.start(); lfo(0.11, 0.004, g2.gain); lfo(0.05, 500, bp.frequency);
    // trynimas: šnaresys, garsumas pagal monetos greitį
    const t = saltinis(baltas); trynF = ctx.createBiquadFilter(); trynG = ctx.createGain();
    trynF.type = 'bandpass'; trynF.frequency.value = 2600; trynF.Q.value = 0.9; trynG.gain.value = 0;
    t.connect(trynF).connect(trynG).connect(master); t.start();
    zymeti();
  }
  function zymeti() { $('#btn-garsas').setAttribute('aria-pressed', String(!!ctx && ijungta)); }
  function trinti(greitis) {
    if (!ctx) return;
    const a = greitis ? Math.min(0.11, 0.015 + greitis * 0.004) : 0;
    trynG.gain.setTargetAtTime(a, now(), a ? 0.02 : 0.06);
    if (greitis) trynF.frequency.setTargetAtTime(Math.min(4200, 1800 + greitis * 45), now(), 0.05);
    clearTimeout(trynT); if (a) trynT = setTimeout(() => trynG.gain.setTargetAtTime(0, now(), 0.08), 110);
  }
  function tonas(tipas, f0, f1, ilgis, garsumas, kada = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = now() + kada;
    o.type = tipas; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + ilgis);
    g.gain.setValueAtTime(garsumas, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + ilgis);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + ilgis + 0.02);
  }
  function pliuptelejimas(f, ilgis, garsumas) {
    const s = saltinis(triuksmas(ilgis, false), false), fl = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = now();
    fl.type = 'lowpass'; fl.frequency.value = f; g.gain.setValueAtTime(garsumas, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + ilgis);
    s.connect(fl).connect(g).connect(master); s.start(t0);
  }
  return {
    start, trinti,
    perjungti() {
      ijungta = !ijungta; saugykla('varena_garsas', ijungta ? '1' : '0');
      if (!ctx) start(); else { if (ijungta && ctx.state === 'suspended') ctx.resume(); master.gain.setTargetAtTime(ijungta ? 1 : 0, now(), 0.05); }
      zymeti();
    },
    // kai langas paslėptas (kitas skirtukas, sumažintas) – garsas visai sustabdomas
    matomumas(matomas) { if (!ctx) return; if (!matomas) ctx.suspend(); else if (ijungta) ctx.resume(); },
    spragt() { if (ctx) tonas('triangle', 1400, 900, 0.05, 0.05); },
    paimti() { if (ctx) { tonas('sine', 520, 760, 0.09, 0.06); pliuptelejimas(2500, 0.05, 0.05); } },
    padeti(s = 1) { if (ctx) { tonas('sine', 190, 105, 0.14, 0.32 * s); tonas('triangle', 420, 260, 0.06, 0.08 * s); pliuptelejimas(1400, 0.07, 0.22 * s); } },
    atverti() {
      if (!ctx) return;
      const s = saltinis(triuksmas(0.9, false), false), f = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = now();
      f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(1600, t0 + 0.7);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.25); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.85);
      s.connect(f).connect(g).connect(master); s.start(t0);
    }
  };
})();

function initGarsas() {
  $('#btn-garsas').onclick = e => { e.stopPropagation(); Garsas.perjungti(); };
  const pirmas = () => { Garsas.start(); window.removeEventListener('pointerdown', pirmas, true); };
  window.addEventListener('pointerdown', pirmas, true);
  document.addEventListener('visibilitychange', () => Garsas.matomumas(!document.hidden));
  window.addEventListener('pagehide', () => Garsas.matomumas(false));
  window.addEventListener('pageshow', () => Garsas.matomumas(!document.hidden));
}

/* ---------- bendra ---------- */
function isNaujo() {
  strokes = []; cur = null; bctx.clearRect(0, 0, base.width, base.height); perpiesti();
  nustatytiRankoje(false);
  if (tempiama) { tempiama.el.remove(); tempiama.sh.remove(); tempiama = null; }
  map.getContainer().classList.remove('renkasi');
  laukia = null;
  for (const id in FIG) {
    const F = FIG[id];
    if (F.marker) { F.marker.remove(); F.marker = null; }
    F.padeta = false; F.vieta.classList.remove('tuscia');
  }
  rodytiKontura(null, false);
  uzdarytiPortala();
  liesta = false;
  pradinisVaizdas();
  $('#figuru-lentyna').scrollLeft = 0;
}

let patTimer;
function patarimas(t, ms) {
  const p = $('#patarimas'); p.textContent = t; p.classList.add('matomas');
  clearTimeout(patTimer); patTimer = setTimeout(() => p.classList.remove('matomas'), ms);
}

// rodyklė seka žemėlapį ir slenkant
setInterval(() => { if (rodomasId && !tempiama) atnaujintiRodykle(); }, 250);

/* ---------- kalbos (LT pagal nutylėjimą / EN) ---------- */
const TXT = {
  lt: {
    t_kalba: 'Switch to English', sk_modeliai: '3D modeliai', sk_ataskaitos: 'Išsami informacija', sk_edukacija: 'Edukacija', info_modeliai: '<h2>3D modeliai</h2><p>Esamos būklės ir atkurtų objektų interaktyvūs 3D modeliai – juos galima sukinėti, artinti ir apžiūrėti iš visų pusių.</p><p class="didelis-saitas"><a href="https://skfb.ly/pFAqX" target="_blank" rel="noopener">Fort-Union projekto galerija Sketchfab’e →</a></p>', info_ataskaitos: '<h2>Išsami informacija</h2><p>Tyrimų ir rekonstrukcijų ataskaitos (PDF). Išsamiose – tyrimų eiga, šaltiniai ir rekonstrukcijos pagrindimas; trumposiose – svarbiausia informacija lankytojui.</p><ul class="dokai"><li><b>Vilniaus karo apygardos artilerijos poligono sandėliai</b><br><a href="assets/docs/Sandeliai_isami_LT.pdf" target="_blank" rel="noopener">išsami (LT)</a> · <a href="assets/docs/Sandeliai_trumpa_LT.pdf" target="_blank" rel="noopener">trumpa (LT)</a> · <a href="assets/docs/Sandeliai_short_EN.pdf" target="_blank" rel="noopener">short (EN)</a></li><li><b>Artileristų pratybų laukas: Artilerijos stotis ir vandens bokštas, karinis miestelis</b><br><a href="assets/docs/Stotis_bokstas_isami_LT.pdf" target="_blank" rel="noopener">išsami (LT)</a> · <a href="assets/docs/Stotis_bokstas_trumpa_LT.pdf" target="_blank" rel="noopener">trumpa (LT)</a> · <a href="assets/docs/Stotis_bokstas_short_EN.pdf" target="_blank" rel="noopener">short (EN)</a></li><li><b>Geležinkelio tiltai: per Varėnę (Glūko) ir Senosios Varėnos per Merkį</b><br><a href="assets/docs/Tiltai_isami_LT.pdf" target="_blank" rel="noopener">išsami (LT)</a> · <a href="assets/docs/Tiltai_trumpa_LT.pdf" target="_blank" rel="noopener">trumpa (LT)</a> · <a href="assets/docs/Tiltai_short_EN.pdf" target="_blank" rel="noopener">short (EN)</a></li><li><b>Lauko įtvirtinimai – redutai</b><br><a href="assets/docs/Redutai_isami_LT.pdf" target="_blank" rel="noopener">išsami (LT)</a> · <a href="assets/docs/Redutai_trumpa_LT.pdf" target="_blank" rel="noopener">trumpa (LT)</a> · <a href="assets/docs/Redutai_short_EN.pdf" target="_blank" rel="noopener">short (EN)</a></li></ul>', info_edukacija: '<h2>Edukacija ir papildomos užduotys</h2><ul class="dokai"><li><b>Artilerijos stoties popierinis modelis 1:87</b><br>A4 iškarpos su klijavimo juostelėmis. <a href="assets/docs/Stotis_popierinis_modelis_1-87.pdf" target="_blank" rel="noopener">Atsisiųsti (PDF)</a></li><li><b>Redutų popierinis modelis</b><br><a href="assets/docs/Redutai_popierinis_modelis.pdf" target="_blank" rel="noopener">Atsisiųsti (PDF)</a></li><li><b>Tiltų spagečių iššūkis</b><br>Užduotis: sukonstruok tiltą iš spagečių. <a href="assets/docs/Tiltai_spagetis_issukis.pdf" target="_blank" rel="noopener">Atsisiųsti (PDF)</a></li><li><b>Karininkų klubo 3D spausdinimo rinkinys 1:200</b><br>STL detalės. <a href="assets/docs/Klubas_3D_spausdinimas_1-200_STL.zip" target="_blank" rel="noopener">Atsisiųsti (ZIP)</a> · <a href="https://skfb.ly/pOQHC" target="_blank" rel="noopener">peržiūra Sketchfab’e</a></li></ul>',  t_pilnas: 'Visas ekranas', t_ivadas: 'Apie šią vietą', z_dabar: 'Šiandien', z_oras: 'Šiandien · iš oro', z_rekonstr: 'Rekonstrukcija', t_info: 'Apie poligoną ir kūrėjus', t_garsas: 'Garsas', t_is_naujo: 'Iš naujo',
    t_moneta: 'Sviedinio gilzė: paimk ir trink žemėlapį', t_atsaukti: 'Atšaukti paskutinį brūkšnį', t_viska: 'Nutrinti viską', uzdaryti: 'Uždaryti',
    netrukus: 'Netrukus', netrukus_txt: 'Čia atsivers 360° panoramos ir objekto istorija.', grizti: 'Grįžti į lentą', lentele_pav: 'Varėnos artilerijos poligonas',
    kaip_zaisti: 'Paleisti trumpą mokymą', sk_naudotis: 'Kaip naudotis', info_naudotis: `<h2>Kaip naudotis</h2>
<ul class="naudotis">
<li><b>Gilzė</b> (apačioje kairėje) – paimk ir trink žemėlapį: po šiandienine nuotrauka atsivers LiDAR reljefas. <b>↶</b> atšaukia paskutinį brūkšnį, <b>⬚</b> nutrina viską.</li>
<li><b>Figūrėlės</b> (apačioje) – objektų rekonstrukcijos. Nešk figūrėlę į žemėlapį: sušvis jos vieta. Padėtą objektą paspausk – atsivers 360° panoramos.</li>
<li><b>Panoramose</b> auksinės rodyklės veda į kitą vietą, <b>i</b> ženklai atveria istorijas, apačioje – visų vietos panoramų juosta, o mažas 3D žemėlapis rodo, kur stovi ir kur žiūri.</li>
<li><b>Mygtukai viršuje dešinėje:</b> EN/LT – kalba, <b>i</b> – ši informacija, garsiakalbis – garsas, rėmelis – visas ekranas, rodyklė ratu – pradėti iš naujo.</li>
<li>Žemėlapį slink ir artink pele arba pirštais.</li>
</ul>`, praleisti: 'Praleisti', toliau: 'Toliau', pradeti: 'Pradėti!',
    p_viska: 'Nutrinta viskas – matai LiDAR reljefą. ↶ grąžina ortofoto.',
    p_rankoje_tel: 'Gilzė rankoje: vienu pirštu trink, dviem – slink ir artink. Padėti – spausk gilzę.',
    p_rankoje_pc: 'Gilzė rankoje: trink pele. Padėti – spausk gilzę arba Esc.',
    p_nesk: 'nešk į švytinčią vietą', p_ne_ta: 'Ne ta vieta – figūrėlę numesk švytinčiame kontūre',
    u_moneta: 'Paimk gilzę ir trink žemėlapį!', u_figura: 'Paimk figūrėlę ir nešk į jos vietą!',
    mok: [
      'Sveiki prie Varėnos artilerijos poligono lentos! Viršuje – šiandieninė aerofotonuotrauka, o po ja slypi LiDAR reljefas: pylimai, grioviai ir pamatai, kurių miške akimi nepamatysi.',
      'Tai sena varinė artilerijos sviedinio gilzė. Paimk ją (spustelėk arba tempk) ir trink žemėlapį – atsivers reljefas.',
      '↶ atšaukia paskutinį brūkšnį, ⬚ nutrina viską iš karto.',
      'Figūrėlės – objektų rekonstrukcijos. Paimk vieną ir nešk: sušvis jos vieta, o jei ji už ekrano – kryptį parodys rodyklė. Numesk į švytintį kontūrą.',
      'Žemėlapį slink ir artink pirštais arba pele. Kai gilzė rankoje, telefone vienu pirštu trini, dviem – slenki.',
      'Čia – kalba, informacija apie poligoną, garsas ir „iš naujo“. Šį mokymą vėl rasi Info lange.'
    ],
    sk_apie: 'Apie poligoną', sk_kurejai: 'Kūrėjai',
    info_apie: `<h2>Varėnos artilerijos poligonas</h2>
<p>1877 m. prie Varėnos (tada Oranų) Rusijos imperijos kariuomenė suplanavo didelį Vilniaus karo apygardos artilerijos poligoną su vasaros stovykla. Jis buvo imperijos karinės infrastruktūros prie vakarinės sienos dalis: čia vasaromis kariuomenė mokėsi šaudyti ir įrengti įtvirtinimus. 1894 m. nutiesta geležinkelio atšaka su Artilerijos stotimi ir vandens bokštu, 1899 m. atidarytas ruožas Varėna–Alytus–Suvalkai–Gardinas su tiltais per Varėnę ir Merkį, apie 1902 m. pastatyti pusiau požeminiai sandėliai. Ant Varėnės skardžio išaugo karinis miestelis: karininkų klubas, medinė cerkvė ir barakai.</p>
<p>Poligono istorija nesibaigė su Rusijos imperija. 1915 m. traukdamiesi rusai susprogdino tiltus, 1915–1918 m. teritoriją valdė vokiečių kariuomenė, kuri dalį pastatų atstatė ir pastatė naujų. 1919–1922 m. stovykla perduota Lietuvai. 1925–1930 m. Lietuvos kariuomenė čia rengė artilerijos ir pėstininkų šaudymo pratybas: štabas buvo Pakoršėje, vėliau Bobriškiuose, šaudyta Perlojos ir Glėbo ežero kryptimis. Buvusiame karininkų klube 1927–1944 m. veikė valstybinė džiovos sanatorija. 1931 m. poligono žemė perduota Miškų departamentui.</p>
<p>Kraštovaizdis per šimtmetį smarkiai pasikeitė. Poligonas buvo kuriamas miškuose, ir rengiant pratybų vietą iškirsta daug miško: parengta apie 28 km² teritorija. XIX a. pabaigoje M. Dobužinskis stovyklos apylinkes apibūdino kaip lygias ir monotoniškas, tik su žemais pušynėliais, o horizontą ribojo tamsi tolimų miškų linija. 1922 m. spaudoje rašyta, kad stovyklai priklausė apie 2000 dešimtinių žemės ir 450 dešimtinių miško. XX a. 3-iajame dešimtmetyje didelė poligono dalis buvo apsėjama javais, buvo pievų ir gyventojų laukų, o aerodromas prie Bobriškių apibūdintas kaip smėlingas ir apaugęs miškeliais. 1931 m. žemę perėmus Miškų departamentui, atviri plotai, tikėtina, palaipsniui apaugo mišku. Šiandien visa buvusi pratybų teritorija yra miškas, po kuriuo pylimus ir pastatų vietas atskleidžia tik LiDAR reljefas.</p>
<p>Šiame ture rekonstruoti redutai, sandėliai, karininkų klubas, cerkvė, barakai, Artilerijos stotis, vandens bokštas ir geležinkelio tiltai per Varėnę ir Merkį. Rekonstrukcijos remiasi fotogrametrine esamos būklės fiksacija, NŽT 2025 m. LiDAR reljefu, istorinėmis nuotraukomis, archyviniais brėžiniais, planais ir rašytiniais šaltiniais; kai kurių vaizdų medžiagas ir šviesą patobulino pagalbinės dirbtinio intelekto priemonės.</p>
<p>Lentoje nutrinkite šiandienę nuotrauką – po ja atsivers LiDAR reljefas, – o figūrėles sustatykite į jų vietas.</p>`,
    info_kurejai: `<h2>Kūrėjai</h2>
<p>Sukūrė <b>Saulius Zaura</b> Varėnos rajono savivaldybės administracijos užsakymu.</p>
<p>Created as part of the project: “Fort-Union – Integration of the Polish–Lithuanian Network of Fortifications for the Development of Representative Tourism Products”</p>
<p class="smulkiai">Žemėlapiai: NŽT ORT10LT 2025 ir LiDAR 2025 (Geoportal.lt). Garsai sukurti naršyklėje (CC0). Leaflet (BSD-2).</p>`
  },
  en: {
    t_kalba: 'Perjungti į lietuvių kalbą', sk_modeliai: '3D models', sk_ataskaitos: 'Reports', sk_edukacija: 'Education', info_modeliai: '<h2>3D models</h2><p>Interactive 3D models of the present state and of the reconstructed sites – rotate, zoom and look at them from every side.</p><p class="didelis-saitas"><a href="https://skfb.ly/pFAqX" target="_blank" rel="noopener">Fort-Union project gallery on Sketchfab →</a></p>', info_ataskaitos: '<h2>Reports</h2><p>Research and reconstruction reports (PDF). The full reports cover the research, sources and the basis of the reconstruction; the summaries give the key information for visitors.</p><ul class="dokai"><li><b>Artillery range magazines of the Vilnius Military District</b><br><a href="assets/docs/Sandeliai_isami_LT.pdf" target="_blank" rel="noopener">full report (LT)</a> · <a href="assets/docs/Sandeliai_trumpa_LT.pdf" target="_blank" rel="noopener">summary (LT)</a> · <a href="assets/docs/Sandeliai_short_EN.pdf" target="_blank" rel="noopener">summary (EN)</a></li><li><b>Artillery training field: Artillery station, water tower and military town</b><br><a href="assets/docs/Stotis_bokstas_isami_LT.pdf" target="_blank" rel="noopener">full report (LT)</a> · <a href="assets/docs/Stotis_bokstas_trumpa_LT.pdf" target="_blank" rel="noopener">summary (LT)</a> · <a href="assets/docs/Stotis_bokstas_short_EN.pdf" target="_blank" rel="noopener">summary (EN)</a></li><li><b>Railway bridges over the Varėnė (Glūkas) and the Merkys (Senoji Varėna)</b><br><a href="assets/docs/Tiltai_isami_LT.pdf" target="_blank" rel="noopener">full report (LT)</a> · <a href="assets/docs/Tiltai_trumpa_LT.pdf" target="_blank" rel="noopener">summary (LT)</a> · <a href="assets/docs/Tiltai_short_EN.pdf" target="_blank" rel="noopener">summary (EN)</a></li><li><b>Field fortifications – the redoubts</b><br><a href="assets/docs/Redutai_isami_LT.pdf" target="_blank" rel="noopener">full report (LT)</a> · <a href="assets/docs/Redutai_trumpa_LT.pdf" target="_blank" rel="noopener">summary (LT)</a> · <a href="assets/docs/Redutai_short_EN.pdf" target="_blank" rel="noopener">summary (EN)</a></li></ul>', info_edukacija: '<h2>Education and extra activities</h2><ul class="dokai"><li><b>Paper model of the Artillery station, 1:87</b><br>A4 cut-outs with glue tabs. <a href="assets/docs/Stotis_popierinis_modelis_1-87.pdf" target="_blank" rel="noopener">Download (PDF)</a></li><li><b>Paper model of the redoubts</b><br><a href="assets/docs/Redutai_popierinis_modelis.pdf" target="_blank" rel="noopener">Download (PDF)</a></li><li><b>Spaghetti bridge challenge</b><br>Task: build a bridge out of spaghetti. <a href="assets/docs/Tiltai_spagetis_issukis.pdf" target="_blank" rel="noopener">Download (PDF)</a></li><li><b>Officers’ club 3D printing kit, 1:200</b><br>STL parts. <a href="assets/docs/Klubas_3D_spausdinimas_1-200_STL.zip" target="_blank" rel="noopener">Download (ZIP)</a> · <a href="https://skfb.ly/pOQHC" target="_blank" rel="noopener">preview on Sketchfab</a></li></ul>',  t_pilnas: 'Full screen', t_ivadas: 'About this place', z_dabar: 'Today', z_oras: 'Today · aerial', z_rekonstr: 'Reconstruction', t_info: 'About the range and credits', t_garsas: 'Sound', t_is_naujo: 'Start over',
    t_moneta: 'Shell casing: pick it up and rub the map', t_atsaukti: 'Undo last stroke', t_viska: 'Rub everything away', uzdaryti: 'Close',
    netrukus: 'Coming soon', netrukus_txt: '360° panoramas and the story of this place will open here.', grizti: 'Back to the board', lentele_pav: 'Varėna Artillery Range',
    kaip_zaisti: 'Start the short guide', sk_naudotis: 'How to use', info_naudotis: `<h2>How to use</h2>
<ul class="naudotis">
<li><b>Shell casing</b> (bottom left) – pick it up and rub the map: the LiDAR relief appears beneath today’s photo. <b>↶</b> undoes the last stroke, <b>⬚</b> rubs everything away.</li>
<li><b>Figures</b> (at the bottom) – reconstructions of the sites. Carry a figure onto the map: its place lights up. Click a placed site to open its 360° panoramas.</li>
<li><b>In the panoramas</b> golden arrows lead to the next spot, <b>i</b> signs open stories, the strip at the bottom shows all panoramas of the place, and the small 3D map shows where you stand and look.</li>
<li><b>Buttons at top right:</b> EN/LT – language, <b>i</b> – this information, speaker – sound, frame – full screen, circular arrow – start over.</li>
<li>Move and zoom the map with the mouse or your fingers.</li>
</ul>`, praleisti: 'Skip', toliau: 'Next', pradeti: 'Start!',
    p_viska: 'Everything rubbed away – you see the LiDAR relief. ↶ brings the photo back.',
    p_rankoje_tel: 'Casing in hand: rub with one finger, move and zoom with two. Tap the casing to put it down.',
    p_rankoje_pc: 'Casing in hand: rub with the mouse. Click the casing or press Esc to put it down.',
    p_nesk: 'carry it to the glowing spot', p_ne_ta: 'Wrong spot – drop the figure inside the glowing outline',
    u_moneta: 'Pick up the casing and rub the map!', u_figura: 'Pick up a figure and carry it to its place!',
    mok: [
      'Welcome to the Varėna artillery range board! On top is today’s aerial photo; underneath lies the LiDAR relief – ramparts, ditches and foundations hidden in the forest.',
      'This is an old brass artillery shell casing. Pick it up (click or drag) and rub the map to reveal the relief.',
      '↶ undoes the last stroke, ⬚ rubs everything away at once.',
      'The figures are reconstructions of the sites. Pick one up and carry it: its place lights up, and an arrow shows the way if it is off-screen. Drop it inside the glowing outline.',
      'Move and zoom the map with your fingers or the mouse. With the casing in hand on a phone, one finger rubs and two fingers move the map.',
      'Here are language, information about the range, sound and “start over”. You can replay this guide from the Info window.'
    ],
    sk_apie: 'About', sk_kurejai: 'Credits',
    info_apie: `<h2>Varėna Artillery Range</h2>
<p>In 1877 the army of the Russian Empire planned a large artillery range of the Vilnius Military District with a summer camp near Varėna (then Orany). It was part of the empire’s military infrastructure near its western border: in summer the army trained here in firing and building fortifications. In 1894 a railway branch with the Artillery station and a water tower was laid, in 1899 the Varėna–Alytus–Suwałki–Grodno line opened with bridges over the Varėnė and the Merkys, and around 1902 semi-underground magazines were built. A military town grew up on the Varėnė bluff: an officers’ club, a wooden Orthodox church and barracks.</p>
<p>The story of the range did not end with the Russian Empire. In 1915 the retreating Russians blew up the bridges; in 1915–1918 the area was held by the German army, which rebuilt some buildings and put up new ones. In 1919–1922 the camp passed to Lithuania. In 1925–1930 the Lithuanian army held artillery and infantry firing exercises here, with headquarters at Pakoršė and later Bobriškiai, firing towards Perloja and Lake Glėbas. In 1927–1944 the former officers’ club housed a state tuberculosis sanatorium. In 1931 the land of the range was handed over to the Forestry Department.</p>
<p>The landscape changed greatly over the century. The range was laid out in forest, and much of it was cleared to prepare the training ground of about 28 km². In the late 19th century M. Dobužinsky described the surroundings of the camp as flat and monotonous, with only low pine copses here and there and a dark line of distant forest on the horizon. A 1922 newspaper wrote that the camp owned about 2,000 desyatinas of land and 450 desyatinas of forest. In the 1920s much of the range was sown with grain, with meadows and farmers’ fields, and the airfield near Bobriškiai was described as sandy and overgrown with small woods. After the land passed to the Forestry Department in 1931, the open areas most likely gradually turned into forest. Today the whole former training area is forest, and only the LiDAR relief reveals the ramparts and building sites beneath it.</p>
<p>This tour reconstructs the redoubts, the magazines, the officers’ club, the church, the barracks, the Artillery station, the water tower and the railway bridges over the Varėnė and the Merkys. The reconstructions are based on photogrammetric recording of the present state, the 2025 NŽT LiDAR relief, historical photographs, archival drawings, plans and written sources; in some images, materials and lighting were refined with auxiliary AI image-processing tools.</p>
<p>On the board, rub away today’s photo to reveal the LiDAR relief, and set the figures in their places.</p>`,
    info_kurejai: `<h2>Credits</h2>
<p>Created by <b>Saulius Zaura</b>, commissioned by Varėna District Municipality Administration.</p>
<p>Created as part of the project: “Fort-Union – Integration of the Polish–Lithuanian Network of Fortifications for the Development of Representative Tourism Products”</p>
<p class="smulkiai">Maps: NŽT ORT10LT 2025 orthophoto and LiDAR 2025 (Geoportal.lt). Sounds synthesised in the browser (CC0). Leaflet (BSD-2).</p>`
  }
};
function saugykla(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
let LANG = saugykla('varena_kalba') === 'en' ? 'en' : 'lt';
const tr = k => TXT[LANG][k] ?? TXT.lt[k] ?? k;
const pavad = id => (LANG === 'en' && CFG.objektai[id].pavadinimas_en) || CFG.objektai[id].pavadinimas;

function taikytiKalba() {
  document.documentElement.lang = LANG;
  document.title = LANG === 'en' ? 'Varėna artillery range – board' : 'Varėnos poligonas – lenta';
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = tr(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(e => { e.title = tr(e.dataset.i18nTitle); e.setAttribute('aria-label', e.title); });
  $('#btn-kalba').textContent = LANG === 'en' ? 'LT' : 'EN';
  $('#info-apie').innerHTML = tr('info_apie'); $('#info-naudotis').innerHTML = tr('info_naudotis'); $('#info-kurejai').innerHTML = tr('info_kurejai');
  for (const k of ['modeliai', 'ataskaitos', 'edukacija']) $('#info-' + k).innerHTML = tr('info_' + k);
  if (BAZE) document.querySelectorAll('#info a[href^="assets/"]').forEach(a => { a.href = BAZE + a.getAttribute('href'); });
  for (const id in FIG) { FIG[id].vieta.title = pavad(id); FIG[id].vieta.querySelectorAll('img').forEach(i => { i.alt = pavad(id); }); }
  if (!$('#mokymas').hidden) rodytiZingsni();
  if (!$('#uzuomina').hidden) uzuominos();
  perkrautiTuraKalba();
}
function initKalba() {
  $('#btn-kalba').onclick = e => { e.stopPropagation(); LANG = LANG === 'lt' ? 'en' : 'lt'; saugykla('varena_kalba', LANG); taikytiKalba(); Garsas.spragt(); };
  taikytiKalba();
}

/* ---------- Info langas ---------- */
function initInfo() {
  const info = $('#info');
  $('#btn-info').onclick = e => { e.stopPropagation(); slepUzuomina(); info.hidden = false; Garsas.atverti(); };
  info.querySelector('.uzdaryti').onclick = () => { info.hidden = true; };
  info.addEventListener('click', e => { if (e.target === info) info.hidden = true; });
  $('#btn-mokymas').onclick = () => { info.hidden = true; pradetiMokyma(); };
  info.querySelectorAll('.kortele').forEach(k => k.onclick = () => {
    info.querySelectorAll('.kortele').forEach(x => x.classList.toggle('aktyvi', x === k));
    info.querySelectorAll('.skirtukas').forEach(x => { x.hidden = x.id !== 'sk-' + k.dataset.skirtukas; });
    info.querySelector('.info-korta').scrollTop = 0;
  });
}

/* ---------- burbulas su rodykle prie taikinio ---------- */
function detiBurbula(b, r) {
  b.classList.remove('virsuje', 'apacioje', 'be-rodykles');
  const bw = b.offsetWidth, bh = b.offsetHeight, m = 16;
  if (!r) {
    b.classList.add('be-rodykles');
    b.style.left = (innerWidth - bw) / 2 + 'px'; b.style.top = Math.max(m, (innerHeight - bh) / 2) + 'px'; return;
  }
  const cx = r.left + r.width / 2, virs = r.top - bh - 18 > m;
  const x = clamp(cx - bw / 2, m, innerWidth - bw - m);
  b.classList.add(virs ? 'virsuje' : 'apacioje');
  b.style.left = x + 'px';
  b.style.top = (virs ? r.top - bh - 16 : Math.min(innerHeight - bh - m, r.top + r.height + 16)) + 'px';
  b.style.setProperty('--ax', clamp(cx - x, 18, bw - 18) + 'px');
}
function matomaDalis(el) {               // elemento dalis, matoma ekrane
  const r = el.getBoundingClientRect();
  const l = Math.max(r.left, 0), t = Math.max(r.top, 0), rr = Math.min(r.right, innerWidth), bb = Math.min(r.bottom, innerHeight);
  return { left: l, top: t, width: rr - l, height: bb - t };
}

/* ---------- mokymas (žaidimo tutorial) ---------- */
const MOK = [() => null, () => $('#moneta'), () => $('#moneta-veiksmai'), () => $('#figuru-lentyna'), () => 'map', () => $('#piktogramos')];
let mokNr = 0;
function initMokymas() {
  $('#mok-toliau').onclick = () => { if (++mokNr >= MOK.length) baigtiMokyma(); else rodytiZingsni(); Garsas.spragt(); };
  $('#mok-praleisti').onclick = baigtiMokyma;
  window.addEventListener('resize', () => { if (!$('#mokymas').hidden) rodytiZingsni(); });
}
function pradetiMokyma() {
  slepUzuomina(); nustatytiRankoje(false);
  mokNr = 0; $('#mokymas').hidden = false; rodytiZingsni();
}
function rodytiZingsni() {
  const t = MOK[mokNr](), spot = $('#mok-spot'), b = $('#mok-burbulas');
  $('#mok-tekstas').textContent = tr('mok')[mokNr];
  $('#mok-nr').textContent = `${mokNr + 1} / ${MOK.length}`;
  $('#mok-toliau').textContent = tr(mokNr === MOK.length - 1 ? 'pradeti' : 'toliau');
  $('#mok-praleisti').hidden = mokNr === MOK.length - 1;
  let r = null;
  if (t === 'map') {
    const m = map.getContainer().getBoundingClientRect(), w = m.width * .5, h = m.height * .4;
    r = { left: m.left + (m.width - w) / 2, top: m.top + m.height * .2, width: w, height: h };
  } else if (t) r = matomaDalis(t);
  const p = 8;
  if (r) {
    r = { left: r.left - p, top: r.top - p, width: r.width + 2 * p, height: r.height + 2 * p };
    spot.classList.remove('visas');
    Object.assign(spot.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    detiBurbula(b, r);
  } else {
    spot.classList.add('visas');
    Object.assign(spot.style, { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '0px', height: '0px' });
    detiBurbula(b, null);
  }
}
function baigtiMokyma() { $('#mokymas').hidden = true; saugykla('varena_turasII_mokymas', '1'); setTimeout(uzuominos, 1200); }

/* ---------- išokančios užuominos prie įrankių ---------- */
const ATLIKTA = { tryne: false, padejo: false };
let uzTaikinys = null, paskVeiksmas = Date.now();
function pazymeti(k) { ATLIKTA[k] = true; slepUzuomina(); }
function slepUzuomina() {
  $('#uzuomina').hidden = true;
  if (uzTaikinys) { uzTaikinys.classList.remove('uzuomina-taikinys'); uzTaikinys = null; }
}
function uzuominos() {
  if (!$('#mokymas').hidden || !$('#portalas').hidden || !$('#info').hidden || tempiama) return;
  let t = null, k = null;
  if (!ATLIKTA.tryne && !rankoje) { t = $('#moneta'); k = 'u_moneta'; }
  else if (!ATLIKTA.padejo) {
    t = [...document.querySelectorAll('.vieta:not(.tuscia) .figura')].find(f => { const r = f.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; });
    k = 'u_figura';
  }
  slepUzuomina();
  if (!t) return;
  const u = $('#uzuomina'); u.querySelector('p').textContent = tr(k);
  u.hidden = false; detiBurbula(u, matomaDalis(t));
  uzTaikinys = t; t.classList.add('uzuomina-taikinys');
}
window.addEventListener('pointerdown', () => { paskVeiksmas = Date.now(); if (!$('#uzuomina').hidden) slepUzuomina(); }, true);
setInterval(() => {
  if (CFG && $('#uzuomina').hidden && Date.now() - paskVeiksmas > 9000 && (!ATLIKTA.tryne || !ATLIKTA.padejo)) uzuominos();
}, 2000);

/* ---------- visas ekranas (kur naršyklė leidžia; iPhone – per „Į pradžios ekraną“) ---------- */
function initPilnas() {
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  const btn = document.querySelectorAll('.btn-pilnas');
  if (!req || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) { btn.forEach(b => { b.hidden = true; }); return; }
  const yra = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const zymeti = () => btn.forEach(b => b.classList.toggle('ijungta', yra()));
  btn.forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (yra()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const r = req.call(el); if (r && r.catch) r.catch(() => {}); }
  });
  document.addEventListener('fullscreenchange', zymeti); document.addEventListener('webkitfullscreenchange', zymeti);
  zymeti();
}
