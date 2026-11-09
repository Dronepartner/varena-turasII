const GLB_V = '20261028b';   // pakeisk, kai atnaujini GLB failus (naršyklės talpykla)
// Mažas 3D „žemėlapis“ panoramoje: kur stovi žiūrovas ir kur žiūri. Kraunamas tik turams su 'mini3d'.
import * as THREE from 'three';
import { GLTFLoader } from './lib/three/GLTFLoader.js';
import { DRACOLoader } from './lib/three/DRACOLoader.js';

const D = THREE.MathUtils.degToRad;
let box, ren, scn, cam, modelis, taskai = {}, kugis, cfg, viewer, rodomas = false, didelis = false;
let az = D(115), el = D(35), atstumas = 1, centras = new THREE.Vector3(), paskutinis = '';
const krovikliai = {};

function sukurtiDom() {
  box = document.createElement('div'); box.id = 'mini3d'; box.hidden = true;
  box.innerHTML = '<canvas></canvas><button class="m3-atgal" hidden></button><span class="m3-uzuomina"></span>';
  document.getElementById('turas').appendChild(box);
  ren = new THREE.WebGLRenderer({ canvas: box.querySelector('canvas'), antialias: true, alpha: true });
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  scn = new THREE.Scene();
  scn.add(new THREE.HemisphereLight(0xffffff, 0x556644, 2.4));
  const s = new THREE.DirectionalLight(0xffffff, 1.6); s.position.set(-40, 70, 50); scn.add(s);
  cam = new THREE.PerspectiveCamera(35, 1, 0.5, 3000);
  // spragtelėjimas: taškas -> ta panorama; kitur -> padidinti / sumažinti
  let pr = null, judino = false;
  box.addEventListener('pointerdown', e => { pr = [e.clientX, e.clientY, az, el]; judino = false; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', e => {
    if (!pr || !didelis) return;
    const dx = e.clientX - pr[0], dy = e.clientY - pr[1];
    if (Math.abs(dx) + Math.abs(dy) > 4) judino = true;
    az = pr[2] - dx * 0.008; el = Math.min(D(85), Math.max(D(8), pr[3] + dy * 0.006)); kamera(); piesti();
  });
  box.addEventListener('pointerup', e => {
    const buvo = pr; pr = null; if (!buvo || judino || e.target.closest('button')) return;
    const r = box.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(m, cam);
    const hit = rc.intersectObjects(Object.values(taskai).map(t => t.zyme))[0];
    if (hit) { const id = hit.object.userData.id; if (viewer.getScene() !== id) viewer.loadScene(id); if (didelis) dydis(false); return; }
    dydis(!didelis);
  });
  box.querySelector('.m3-atgal').onclick = () => dydis(false);
  addEventListener('resize', () => { if (rodomas) { matmenys(); piesti(); } });
}

function dydis(d) {
  didelis = d; box.classList.toggle('didelis', d); box.querySelector('.m3-atgal').hidden = !d;
  matmenys(); kamera(); piesti();
  setTimeout(() => { matmenys(); piesti(); }, 380);   // po CSS animacijos – ryškus vaizdas
}
function matmenys() { const w = box.clientWidth, h = box.clientHeight; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
function kamera() {
  const r = atstumas * (didelis ? 0.85 : 1);
  cam.position.set(centras.x + r * Math.cos(el) * Math.cos(az), centras.y + r * Math.sin(el), centras.z + r * Math.cos(el) * Math.sin(az));
  cam.lookAt(centras);
}
const blend = p => new THREE.Vector3(p[0], p[2], -p[1]);    // Blender (Z aukštyn) -> three (Y aukštyn)

function kugioGeom(fov, ilgis) {             // plokščias matymo sektorius, nukreiptas į +X
  const n = 16, v = [0, 0, 0], idx = [];
  for (let i = 0; i <= n; i++) { const a = D(-fov / 2 + fov * i / n); v.push(ilgis * Math.cos(a), 0, -ilgis * Math.sin(a)); }
  for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); return g;
}

async function uzkrauti(c) {
  if (krovikliai[c.glb]) return krovikliai[c.glb];
  const dl = new DRACOLoader(); dl.setDecoderPath(new URL('./lib/three/draco/', import.meta.url).href);
  const l = new GLTFLoader(); l.setDRACOLoader(dl);
  return (krovikliai[c.glb] = new Promise((ok, ne) => l.load(new URL(c.glb + (c.glb.includes('?') ? '' : '?v=' + GLB_V), document.baseURI).href, g => ok(g.scene), undefined, ne)));
}

async function rodyti(c, v) {
  viewer = v; cfg = c;
  if (!c) { slepti(); return; }
  if (!box) sukurtiDom();
  box.querySelector('.m3-atgal').textContent = c.atgal || '← Atgal į panoramą';
  box.querySelector('.m3-uzuomina').textContent = c.uzuomina || '';
  rodomas = true; box.hidden = false; dydis(false);
  const sc = await uzkrauti(c);
  if (modelis !== sc) {
    if (modelis) scn.remove(modelis);
    modelis = sc; scn.add(sc);
    const zm = c.zMastelis || 1; sc.scale.y = zm;          // reljefo paryškinimas (tik vaizdui)
    sc.traverse(o => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.85; o.material.vertexColors = false;
      if (o.material.map && !o.geometry.attributes.uv) { o.material.map = null; o.material.color.set(0x6e5c4a); }   // tekstūra be UV – vientisa spalva
      for (const [k, v] of Object.entries(c.spalvos || {}))   // medžiagos be tinkamų UV – vientisa spalva
        if (o.material.name.includes(k)) { o.material.map = null; o.material.color.set(v); }
      if (c.sviesumas) o.material.color.multiplyScalar(c.sviesumas);
      o.material.needsUpdate = true; } });
    const bb = new THREE.Box3().setFromObject(sc), sz = bb.getSize(new THREE.Vector3());
    bb.getCenter(centras); atstumas = Math.max(sz.x, sz.z) * 1.15;
    if (c.centras) { centras.copy(blend(c.centras)); centras.y *= zm; }        // dideliems modeliams – rodoma dalis
    if (c.atstumas) atstumas = c.atstumas;
    const rc = new THREE.Raycaster(), zeme = (x, z) => {   // žemės aukštis po tašku (three Y)
      rc.set(new THREE.Vector3(x, bb.max.y + 50, z), new THREE.Vector3(0, -1, 0));
      const h = rc.intersectObject(sc, true)[0]; return h ? h.point.y : null;
    };
    for (const t of Object.values(taskai)) scn.remove(t.g);
    taskai = {};
    const mast = c.mastelis || Math.max(sz.x, sz.z) / 70;
    for (const [id, t] of Object.entries(c.taskai)) {
      const g = new THREE.Group(), p = blend([t.p[0], t.p[1], (t.p[2] ?? 0) * zm]), z0 = zeme(p.x, p.z);
      if (t.p[2] == null) p.y = (z0 ?? 0) + 1.6;          // aukštis nežinomas – 1,6 m virš žemės
      const zyme = new THREE.Mesh(new THREE.SphereGeometry(1.3 * mast, 20, 12), new THREE.MeshBasicMaterial({ color: 0xf3d58a, depthTest: false }));
      zyme.userData.id = id; zyme.renderOrder = 3; g.add(zyme);
      if (z0 != null && p.y - z0 > 4) {        // aukštas taškas: linija iki žemės
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, z0 - p.y, 0)]);
        g.add(new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xf3d58a, dashSize: 1, gapSize: 0.8 })).computeLineDistances());
      }
      g.position.copy(p); scn.add(g); taskai[id] = { g, zyme, h: t.h ?? null };   // h nėra – tik taškas, be krypties
    }
    if (!kugis) {
      kugis = new THREE.Mesh(kugioGeom(90, 1), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false }));
      kugis.renderOrder = 2; scn.add(kugis);
    }
    kugis.userData.ilgis = 16 * mast;
  }
  kamera(); paskutinis = ''; ciklas();
}

let kadras = 0;
function ciklas() {
  cancelAnimationFrame(kadras);
  const zingsnis = () => {
    if (!rodomas || !viewer) return;
    const id = viewer.getScene(), yaw = viewer.getYaw(), fov = viewer.getHfov(), raktas = id + '|' + yaw.toFixed(1) + '|' + fov.toFixed(0);
    if (raktas !== paskutinis) { paskutinis = raktas; atnaujinti(id, yaw, fov); }
    kadras = requestAnimationFrame(zingsnis);
  };
  zingsnis();
}
function atnaujinti(id, yaw, fov) {
  const t = taskai[id];
  for (const [k, v] of Object.entries(taskai)) { v.zyme.material.color.set(k === id ? 0xff5a1f : 0xf3d58a); v.zyme.scale.setScalar(k === id ? 1.25 : 1); }
  box.classList.toggle('be-tasko', !t);
  if (t && kugis && t.h != null) {
    kugis.visible = true; kugis.position.copy(t.g.position);
    kugis.geometry.dispose(); kugis.geometry = kugioGeom(Math.min(fov, 120), kugis.userData.ilgis);
    kugis.rotation.y = D(t.h - yaw);          // Blender kryptis prieš laikrodžio rodyklę, Pannellum yaw – pagal
  } else if (kugis) kugis.visible = false;
  piesti();
}
function piesti() { if (ren && rodomas) ren.render(scn, cam); }
function slepti() { rodomas = false; cancelAnimationFrame(kadras); if (box) { box.hidden = true; dydis(false); } }

window.Mini3D = { rodyti, slepti };
