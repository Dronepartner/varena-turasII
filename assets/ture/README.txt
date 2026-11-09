360° turai – kaip pridėti ar taisyti

Tekstai: assets/ture/<turas>.json (lt / en). Taisyti galima tiesiog teksto redaktoriumi (UTF-8).
  pavadinimas, ivadas – turo antraštė ir įvadas;
  scenos[] – kiekviena panorama:
    id          – trumpas vardas (raidės, _ ), pagal jį vadinamas web failas;
    failas      – Sauliaus failas assets/pano/<Objektas>/<failas> (šie failai NEKEIČIAMI);
    rusis       – "dabar" (šiandieninė nuotrauka) arba "rekonstrukcija";
    pavadinimas – scenos vardas juostoje;
    yaw, pitch  – pradinė žiūrėjimo kryptis (yaw 0 = panoramos vidurys, + į dešinę; pitch + aukštyn), laipsniais;
    siaure      – (nebūtina) panoramos vidurio azimutas; jei nurodytas, rodomas kompasas;
    perejimai[] – rodyklės į kitas scenas: { "i": scenos id, "yaw", "pitch", "uzrasas" (nebūtina) };
    istorijos[] – „i“ taškai: { "yaw", "pitch", "antraste", "tekstas", "vaizdas" (nebūtina), "vaizdo_paaiskinimas" }.

Nauja panorama (pvz. aerofoto):
  1. įmesti failą į assets/pano/<Objektas>/;
  2. JSON'e pridėti scenos įrašą (ir rodyklę iš kitos scenos, jei reikia);
  3. paleisti iš svetaine\:  uv run --with pillow python _skriptai/paruosti_panoramas.py
     (sukuria assets/pano_web/<turas>/<id>.jpg ir _maza.jpg; esamų neperdaro).
Yaw/pitch tašką lengviausia rasti naršyklės konsolėje: atidarius turą, viewer.getYaw(), viewer.getPitch().

Objektų susiejimas su turais: _skriptai/paruosti_objektus.py (TURAI) -> assets/objektai.json ("turas", "turo_scena").
