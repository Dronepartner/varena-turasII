# Varėnos artilerijos poligono virtualus turas – instrukcija administratoriui

**Lietuviškai** · [English below](#english)

## Kas tai
Statinė svetainė: HTML, JavaScript, paveikslai, PDF. Nereikia nei duomenų bazės, nei PHP ar Node.js. Visos nuorodos santykinės, todėl aplanką galima įkelti į bet kurią serverio vietą (domeno šaknį arba poaplankį, pvz. `/turas/`).

## Įdiegimas
1. Nukopijuokite **visą** šio aplanko turinį į serverio viešąjį katalogą (pvz. `public_html/turas/`).
2. Atidarykite naršyklėje `https://jūsų-domenas.lt/turas/`. Viskas – nieko konfigūruoti nereikia.

Serverio nustatymai, kuriuos verta patikrinti:
- MIME tipai: `.webp` → `image/webp`, `.json` → `application/json`, `.js` → `text/javascript` (dažniausiai jau nustatyta).
- Pageidautina įjungti gzip/brotli suspaudimą `.js`, `.css`, `.json`, `.html` failams.
- HTTPS – rekomenduojama (viso ekrano režimas ir kai kurios naršyklių funkcijos geriausiai veikia per HTTPS).

## Dydis
Apie 300 MB. Didžiausia dalis:
- `assets/plyteles/` – žemėlapio plytelės (~60 MB, ~4300 failų);
- `assets/pano_web/` – 360° panoramos (~55 MB);
- `assets/docs/` – ataskaitų PDF ir edukacinė medžiaga (~180 MB).

## Jei didelius failus norite laikyti kitur
Panoramas (`assets/pano_web/`) ir dokumentus (`assets/docs/`) galima perkelti į atskirą saugyklą (CDN, failų serverį):
1. Nukopijuokite ten tuos aplankus **ta pačia struktūra**: `.../assets/pano_web/...`, `.../assets/docs/...`.
2. Faile `nustatymai.js` įrašykite saugyklos adresą (su „/“ gale):
   ```js
   window.VARENA = { failuBaze: 'https://saugykla.jusu-domenas.lt/varena/' };
   ```
3. Jei saugykla kitame domene, joje turi būti leidžiamas CORS (`Access-Control-Allow-Origin`) paveikslams – panoramų žiūryklė juos krauna per WebGL.

Daugiau nieko keisti nereikia.

## Turinio atnaujinimas
- 360° turų tekstai ir taškai: `assets/ture/*.json` (LT/EN), aprašyta `assets/ture/README.txt`.
- Info lango tekstai: `app.js`, objektas `TXT` (lt / en).
- Atnaujinus failus, naršyklės gali rodyti seną versiją iš podėlio – `index.html` padidinkite `?v=` numerį prie `style.css` ir `app.js`.

## Išorinės nuorodos
- 3D modeliai: Sketchfab (https://skfb.ly/pFAqX, https://skfb.ly/pOQHC).
- Daugiau išorinių paslaugų svetainė nenaudoja: nėra slapukų, analitikos ar išorinių šriftų.

---

<a id="english"></a>
# Varėna Artillery Range virtual tour – administrator notes

## What it is
A static website: HTML, JavaScript, images, PDFs. No database, PHP or Node.js needed. All links are relative, so the folder can be placed anywhere on a server (domain root or a subfolder such as `/tour/`).

## Installation
1. Copy the **entire** contents of this folder to the server's public directory (e.g. `public_html/tour/`).
2. Open `https://your-domain/tour/` in a browser. That's it – no configuration needed.

Server settings worth checking:
- MIME types: `.webp` → `image/webp`, `.json` → `application/json`, `.js` → `text/javascript` (usually already set).
- Enable gzip/brotli compression for `.js`, `.css`, `.json`, `.html` if possible.
- HTTPS is recommended (full-screen mode and some browser features work best over HTTPS).

## Size
About 300 MB. The largest parts:
- `assets/plyteles/` – map tiles (~60 MB, ~4,300 files);
- `assets/pano_web/` – 360° panoramas (~55 MB);
- `assets/docs/` – report PDFs and educational materials (~180 MB).

## Storing large files elsewhere
The panoramas (`assets/pano_web/`) and documents (`assets/docs/`) can be moved to separate storage (CDN, file server):
1. Copy those folders there with **the same structure**: `.../assets/pano_web/...`, `.../assets/docs/...`.
2. In `nustatymai.js`, set the storage address (ending with "/"):
   ```js
   window.VARENA = { failuBaze: 'https://storage.your-domain/varena/' };
   ```
3. If the storage is on another domain, it must allow CORS (`Access-Control-Allow-Origin`) for images – the panorama viewer loads them via WebGL.

Nothing else needs to change.

## Updating content
- 360° tour texts and hotspots: `assets/ture/*.json` (LT/EN), see `assets/ture/README.txt`.
- Info window texts: `app.js`, object `TXT` (lt / en).
- After updating files, browsers may show a cached version – increase the `?v=` number for `style.css` and `app.js` in `index.html`.

## External links
- 3D models: Sketchfab (https://skfb.ly/pFAqX, https://skfb.ly/pOQHC).
- The site uses no other external services: no cookies, analytics or external fonts.
