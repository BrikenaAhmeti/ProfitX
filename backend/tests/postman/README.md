# ProfitX Postman

Importo `ProfitX-API.postman_collection.json` ne Postman dhe ekzekuto te gjithe koleksionin ne rendin e ruajtur. `baseUrl` eshte `http://localhost:5000`; backend-i duhet te jete ndezur dhe databaza e testimit e migruar.

Regjistrimi krijon nje email unik. Hyrja ruan automatikisht `authToken` dhe `authUserId`. Dosjet Kliente, Furnitore dhe Kategori krijojne rekordet, ruajne ID-te, testojne GET/PUT/DELETE, validimin dhe aksesin pa token. Pas fshirjes verifikohet 404. Mos i ekzekuto kerkesa te vecanta pa hapin e regjistrimit dhe hyrjes.

## Ekzekutim automatik

Nga `backend`, pas `npm ci`:

```powershell
node tests/postman/run-collection.cjs --mock
```

Newman ekzekuton koleksionin kunder aplikacionit Express real me JWT, validim, controller dhe service reale. Vetem klienti i databazes zevendesohet me ruajtje ne memorie. Ky modalitet nuk verifikon databazen ose kufizimet e saj.

Per databaze reale, konfiguro `DATABASE_URL` dhe `JWT_SECRET` ne `.env`, apliko migrimet dhe gjenero klientin Prisma:

```powershell
npx prisma generate
node tests/postman/run-collection.cjs
```

Runner-i hap server ne port te lire, ekzekuton Newman dhe perfundon me kod 1 nese ka deshtime. Pas perfundimit pastron perdoruesin prove dhe rekordet e lidhura. Ne Postman direkt, perdoruesi prove mbetet ne databaze; perdor vetem databaze testimi. Nuk ruhen token-e ose kredenciale ne koleksion.
