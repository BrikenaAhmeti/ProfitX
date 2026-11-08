# ProfitX Postman

Importo `ProfitX-API.postman_collection.json` ne Postman dhe ekzekuto te gjithe koleksionin ne rendin e ruajtur. `baseUrl` eshte `http://localhost:5000`; backend-i duhet te jete ndezur dhe databaza e testimit e migruar.

Regjistrimi krijon nje email unik; dosja Transaksione krijon edhe nje perdorues te dyte me email unik. Hyrja e perdoruesit A ruan `authToken`, kurse perdoruesi B perdor `authTokenB`. Dosjet Kliente, Furnitore dhe Kategori krijojne rekordet, ruajne ID-te, testojne GET/PUT/DELETE, validimin dhe aksesin pa token. Dosja Transaksione kontrollon CRUD, filtrat sipas llojit, kategorise dhe intervalit te datave, izolimin A/B (GET/PUT/DELETE te huaj kthejne 404), refuzimin e kategorise/klientit te huaj dhe rastet kufitare te shumes/datave. Data ISO e vlefshme ne te ardhmen pranohet; data e pavlefshme dhe fushat e detyrueshme qe mungojne kthejne 400 me gabime per fushat perkatese. Ekzekutoje koleksionin nga lart-poshte; mos i ekzekuto kerkesa te vecanta pa hapat e regjistrimit dhe hyrjes.

## Ekzekutim automatik

Nga `backend`, pas `npm ci`:

```powershell
node tests/postman/run-collection.cjs --mock
```

Newman ekzekuton koleksionin kunder aplikacionit Express real me JWT, validim, controller dhe service reale. Klienti Prisma zevendesohet me ruajtje ne memorie per perdoruesit, kategorite, klientet, furnitoret dhe transaksionet. Ky modalitet nuk verifikon databazen reale ose kufizimet e saj.

Per databaze reale, konfiguro `DATABASE_URL` dhe `JWT_SECRET` ne `.env`, apliko migrimet dhe gjenero klientin Prisma:

```powershell
npx prisma generate
node tests/postman/run-collection.cjs
```

Runner-i hap server ne port te lire, ekzekuton Newman dhe perfundon me kod 1 nese ka deshtime. Pas perfundimit pastron perdoruesit prove A/B dhe rekordet e lidhura. Ne Postman direkt, perdoruesit prove mbeten ne databaze; perdor vetem databaze testimi. Nuk ruhen token-e ose kredenciale ne koleksion.
