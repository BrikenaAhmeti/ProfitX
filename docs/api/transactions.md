# ProfitX Transactions API

Base URL lokale: `http://localhost:5000`. Te gjitha rrugat kerkojne `Authorization: Bearer <token>`. Token-i qe mungon ose eshte i pavlefshem kthen `401`. Cdo veprim kufizohet te perdoruesi i kycur.

## Fushat

| Fusha | Kerkueshme ne POST | Formati |
| --- | --- | --- |
| `amount` | Po | Numer ose tekst numerik pozitiv, maksimumi dy shifra pas presjes dhe `9999999999.99` (`Decimal(12,2)`) |
| `type` | Po | `INCOME` ose `EXPENSE`; pranohen edhe aliaset si `te ardhura` dhe `shpenzim` |
| `categoryId` | Po | UUID e nje kategorie te perdoruesit te kycur |
| `occurredAt` | Jo | Date ISO `YYYY-MM-DD` ose timestamp me timezone, p.sh. `2026-11-08T10:00:00Z`; kur mungon perdoret koha aktuale. Cdo date ISO e vlefshme pranohet, edhe ne te ardhmen. |
| `description` | Jo | Tekst me maksimumi 500 karaktere ose `null` |
| `clientId` | Jo | UUID e klientit te perdoruesit ose `null` |
| `supplierId` | Jo | UUID e furnitorit te perdoruesit ose `null` |

`id`, `createdAt` dhe `userId` caktohen nga serveri. Burimet e modelit jane `backend/prisma/schema.prisma` dhe `docs/architecture/erd.md`.

## Rrugat

| Metoda | Rruga | Suksesi |
| --- | --- | --- |
| POST | `/api/transactions` | `201`, `data.transaction` permban rekordin e krijuar |
| GET | `/api/transactions` | `200`, `data` eshte array |
| GET | `/api/transactions/:id` | `200`, `data.transaction` |
| PUT | `/api/transactions/:id` | `200`, `data.transaction` i perditesuar |
| DELETE | `/api/transactions/:id` | `200`, mesazh suksesi |

PUT lejon perditesime te pjesshme; fushat qe mungojne mbeten te pandryshuara. Rekordi qe mungon ose i perket dikujt tjeter kthen `404` per GET/PUT/DELETE. Referencat drejt kategorive, klienteve ose furnitoreve te huaj kthejne `400`.

Shembull POST:

```json
{
  "amount": "125.50",
  "type": "INCOME",
  "categoryId": "3f1c9b1e-5e0a-4b7a-9d5e-2f0c1a7b8c44",
  "occurredAt": "2026-11-08T10:00:00Z",
  "description": "Pagesa e klientit"
}
```

Pergjigjet e suksesit kane `success: true`. Gabimet e validimit kane `success: false`, `statusCode: 400`, `message` dhe `errors: [{ "field": "amount", "message": "Shuma duhet te jete me e madhe se zero." }]`.

## Filtrat e listes

`GET /api/transactions?type=INCOME&categoryId=<uuid>&dateFrom=2026-11-01&dateTo=2026-11-08`

Filtrat jane opsionale dhe kombinohen. `dateFrom` dhe `dateTo` perdorin `YYYY-MM-DD` ne UTC; kufijte perfshijne te dyja ditet e plota. Data e pavlefshme, intervali i permbysur, lloji i pavlefshem ose UUID e pavlefshme kthen `400` me `errors[]`. Pa filtra kthehen te gjitha transaksionet e perdoruesit. Renditja eshte `occurredAt DESC`, pastaj `createdAt DESC`.

## Ekzekutimi i verifikimit

Nga dosja `backend`, instalo varesite me `npm ci`.

```powershell
node scripts/verify-transactions-api.cjs --mock
```

Modaliteti `--mock` perdor aplikacionin Express, JWT, middleware, validimin, controller dhe service reale; vetem Prisma zevendesohet me ruajtje ne memorie. Ai nuk provon lidhjen ose kufizimet e PostgreSQL.

Per databaze reale, konfiguro lokalisht `DATABASE_URL` dhe `JWT_SECRET` ne `backend/.env`. Perdore nje databaze testimi me migrimet e projektit te aplikuara. Mos ngarko `.env` ne GitHub.

```powershell
npx prisma generate
node scripts/verify-transactions-api.cjs
```

Skripti hap server vetem ne `127.0.0.1` ne nje port te lire; nuk kerkon `npm run dev`. Krijon dy perdorues me email unik, kategori, klient dhe furnitor prove. JWT-te e shkurtra krijohen lokalisht si ne skriptin e furnitoreve; rrjedha e login-it nuk eshte pjese e ketij testi.

Kontrollet perfshijne 57 kerkesa HTTP: krijim dhe lexim, liste me/pa filtra, renditje, kufijte e datave, ndryshim, fshirje, rekord te munguar, izolim ne te dy drejtimet, referenca te huaja, 400 per input/filtra te pavlefshem dhe 401 pa token.

Ne `finally`, skripti fshin vetem transaksionet, referencat dhe perdoruesit qe krijoi, dhe kontrollon me `count` qe asnje prej tyre nuk mbeti. Pastrimi kryhet edhe kur nje test deshton; lidhja Prisma dhe serveri mbyllen. Nderprerja e procesit me force ose humbja e lidhjes me databazen mund ta pengoje pastrimin.

Per te provuar rrugen e pastrimit pas nje deshtimi:

```powershell
node scripts/verify-transactions-api.cjs --mock --fail-after-setup
```

Ky kontroll duhet te shfaqe `PASS Pastrimi` dhe pastaj gabimin e qellimshem, me kod daljeje `1`. Ekzekutimi normal duhet te perfundoje me kod `0` dhe mesazhin e modalitetit perkates. Mungesa e konfigurimit ose deshtimi i testit/pastrimit jep kod `1`.

Gjendja e verifikimit ne kete mjedis:

- [x] Skripti kalon me `--mock`.
- [ ] Skripti kalon me databaze reale: mungon `DATABASE_URL` ne mjedisin lokal.
- [x] Pastrimi verifikohet ne memorie si pas suksesit, ashtu edhe pas deshtimit te qellimshem; pastrimi ne databaze reale mbetet per t'u ekzekutuar.
