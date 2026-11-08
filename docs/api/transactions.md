# ProfitX Transactions API

Base URL lokale: `http://localhost:5000`. Te gjitha rrugat kerkojne `Authorization: Bearer <token>`. Token-i qe mungon ose eshte i pavlefshem kthen `401`. Cdo veprim kufizohet te perdoruesi i kycur.

## Formati i pergjigjeve

Lista e transaksioneve kthehet si array direkt ne `data`:

```json
{
  "success": true,
  "data": [
    {
      "id": "ea209e97-7ca9-4859-b627-7e2d9991fcfd",
      "userId": "bf30d922-d196-4632-a30f-a1c88cd9c796",
      "categoryId": "074dda62-ba72-4586-b2e7-d1944a393c35",
      "clientId": "4b69b66a-83c1-4feb-8e15-86f0ca43c13a",
      "supplierId": null,
      "type": "INCOME",
      "amount": "1250",
      "description": "Pagese per sherbime",
      "occurredAt": "2026-01-15T10:00:00.000Z",
      "createdAt": "2026-11-07T20:10:52.056Z"
    }
  ]
}
```

Nje transaksion i vetem kthehet brenda `data.transaction`:

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "ea209e97-7ca9-4859-b627-7e2d9991fcfd",
      "userId": "bf30d922-d196-4632-a30f-a1c88cd9c796",
      "categoryId": "074dda62-ba72-4586-b2e7-d1944a393c35",
      "clientId": "4b69b66a-83c1-4feb-8e15-86f0ca43c13a",
      "supplierId": null,
      "type": "INCOME",
      "amount": "1250",
      "description": "Pagese per sherbime",
      "occurredAt": "2026-01-15T10:00:00.000Z",
      "createdAt": "2026-11-07T20:10:52.056Z"
    }
  }
}
```

Gabimet e validimit kane `success: false`, `statusCode: 400`, nje `message` te pergjithshem dhe listen `errors`:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Kerkesa permban fusha te pavlefshme.",
  "errors": [
    { "field": "amount", "message": "Shuma duhet te jete me e madhe se zero." }
  ]
}
```

Gabimet e filtrave kane te njejten forme, me mesazh te vecuar:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Filtrat e transaksioneve jane te pavlefshem.",
  "errors": [
    { "field": "dateFrom", "message": "Data duhet te jete date e vlefshme ne formatin YYYY-MM-DD." }
  ]
}
```

Gabimet e sherbimit (p.sh. reference e huaj ose rekord qe mungon) kane vetem `message`:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Kategoria nuk ekziston ose nuk i perket perdoruesit te kycur"
}
```

## Fushat e transaksionit

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

**Percaktim i rendesishem per frontend-in:** `amount` kthehet gjithmone si tekst (p.sh. `"1250"` ose `"1300.25"`), jo si numer, sepse ne databaze ruhet si `Decimal(12,2)`. Per ta shfaqur ose llogaritur, konvertojeni me `Number(amount)`.

## Rrugat

| Metoda | Rruga | Suksesi |
| --- | --- | --- |
| POST | `/api/transactions` | `201`, `data.transaction` permban rekordin e krijuar |
| GET | `/api/transactions` | `200`, `data` eshte array |
| GET | `/api/transactions/:id` | `200`, `data.transaction` |
| PUT | `/api/transactions/:id` | `200`, `data.transaction` i perditesuar |
| DELETE | `/api/transactions/:id` | `200`, mesazh suksesi |

PUT lejon perditesime te pjesshme; fushat qe mungojne mbeten te pandryshuara. Rekordi qe mungon ose i perket dikujt tjeter kthen `404` per GET/PUT/DELETE. Referencat drejt kategorive, klienteve ose furnitoreve te huaj kthejne `400`.

## Lista e transaksioneve

`GET /api/transactions`

Kthen vetem transaksionet e perdoruesit te kycur. Pa filtra kthehen te gjitha, te renditura sipas `occurredAt` zbrites (me te fundit i pari); kur dy transaksione kane te njejten date, renditja behet sipas `createdAt` zbrites.

| Status | Kuptimi |
| --- | --- |
| `200` | Lista u kthye; `data` eshte array (mund te jete bosh). |
| `400` | Nje ose me shume filtra kane format te pavlefshme; perfshihet `errors`. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |

### Filtrat e listes

`GET /api/transactions?type=INCOME&categoryId=<uuid>&dateFrom=2026-11-01&dateTo=2026-11-08`

| Parametri | Formati | Kuptimi |
| --- | --- | --- |
| `type` | `INCOME` ose `EXPENSE` | Pranohen edhe aliaset `te ardhura` dhe `shpenzim`/`shpenzime`, pa dallim te madhesise se shkronjave. |
| `categoryId` | UUID | Kthen vetem transaksionet e asaj kategorie. Nje UUID i vlefshem qe nuk i perket perdoruesit thjesht kthen liste bosh (`200`), jo `400`. |
| `dateFrom` | `YYYY-MM-DD` (UTC) | Data me e hershme e perfshire. |
| `dateTo` | `YYYY-MM-DD` (UTC) | Data me e vone e perfshire; perfshin te gjithe diten. |

Filtrat jane opsionale dhe kombinohen me `AND`. Nje filter qe nuk ka perputhje kthen `data: []`.

Shembull:

```
GET /api/transactions?type=EXPENSE&dateFrom=2026-11-05&dateTo=2026-11-05
```

```json
{
  "success": true,
  "data": [
    {
      "id": "73b55c96-1928-4b7e-ab58-25a28a26bbac",
      "userId": "f0abd1d5-988a-4f62-86ea-2c367371b9e8",
      "categoryId": "1fd92e91-a072-4b1e-bb01-7c2497d03172",
      "clientId": null,
      "supplierId": null,
      "type": "EXPENSE",
      "amount": "50.5",
      "description": "Shpenzim 1",
      "occurredAt": "2026-11-05T10:00:00.000Z",
      "createdAt": "2026-11-08T16:23:38.679Z"
    }
  ]
}
```

Filtri i pavlefshem kthen `400`:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Filtrat e transaksioneve jane te pavlefshem.",
  "errors": [
    { "field": "type", "message": "Lloji duhet te jete INCOME ose EXPENSE." }
  ]
}
```

Mesazhet e filtrave:

| Rasti | `field` | Mesazhi |
| --- | --- | --- |
| `type` i panjohur | `type` | `Lloji duhet te jete INCOME ose EXPENSE.` |
| `categoryId` jo UUID | `categoryId` | `Kategoria duhet te jete UUID e vlefshme.` |
| Date jo ne formatin `YYYY-MM-DD` ose date e pavlefshme | `dateFrom` / `dateTo` | `Data duhet te jete date e vlefshme ne formatin YYYY-MM-DD.` |
| `dateFrom` pas `dateTo` | `dateTo` | `Data deri duhet te jete e njejte ose pas dates nga.` |

## Nje transaksion

`GET /api/transactions/:id`

| Status | Kuptimi |
| --- | --- |
| `200` | Transaksioni u gjet; `data` permban `transaction`. |
| `400` | `id` nuk eshte ne formatin UUID. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Transaksioni nuk ekziston ose i perket nje perdoruesi tjeter. |

## Krijimi i transaksionit

`POST /api/transactions`

Trupi i kerkeses:

```json
{
  "amount": 1250,
  "type": "INCOME",
  "categoryId": "3f1c9b1e-5e0a-4b7a-9d5e-2f0c1a7b8c44",
  "occurredAt": "2026-11-08T10:00:00Z",
  "description": "Pagesa e klientit"
}
```

Pergjigja e suksesit (`201`):

```json
{
  "success": true,
  "message": "Transaksioni u krijua me sukses",
  "data": {
    "transaction": {
      "id": "ea209e97-7ca9-4859-b627-7e2d9991fcfd",
      "userId": "bf30d922-d196-4632-a30f-a1c88cd9c796",
      "categoryId": "074dda62-ba72-4586-b2e7-d1944a393c35",
      "clientId": null,
      "supplierId": null,
      "type": "INCOME",
      "amount": "1250",
      "description": "Pagesa e klientit",
      "occurredAt": "2026-11-08T10:00:00.000Z",
      "createdAt": "2026-11-08T16:23:38.679Z"
    }
  }
}
```

| Status | Kuptimi |
| --- | --- |
| `201` | Transaksioni u krijua; `data` permban `transaction`. |
| `400` | Fusha te munguara ose te pavlefshme, ose `categoryId`/`clientId`/`supplierId` i perket nje perdoruesi tjeter. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |

Mesazhet e validimit (mund te kthehen disa njekohesisht):

| Rasti | `field` | Mesazhi |
| --- | --- | --- |
| `amount` mungon ose nuk eshte numer | `amount` | `Shuma eshte e detyrueshme dhe duhet te jete numer pozitiv.` |
| `amount` zero ose negativ | `amount` | `Shuma duhet te jete me e madhe se zero.` |
| `amount` me shume se dy shifra pas presjes ose mbi kufi | `amount` | `Shuma duhet te kete maksimumi dy shifra pas presjes dhe te mos kaloje 9999999999.99.` |
| `type` mungon ose nuk njihet | `type` | `Lloji eshte i detyrueshem dhe duhet te jete te ardhura (INCOME) ose shpenzim (EXPENSE).` |
| `categoryId` mungon ose jo UUID | `categoryId` | `Kategoria eshte e detyrueshme dhe duhet te jete UUID e vlefshme.` |
| `clientId`/`supplierId` jo UUID | `clientId` / `supplierId` | `clientId duhet te jete UUID e vlefshme.` (mesazhi permend fushen) |
| `occurredAt` jo date ISO | `occurredAt` | `Data e transaksionit duhet te jete date ISO 8601 e vlefshme (p.sh. 2026-11-08 ose 2026-11-08T10:00:00Z).` |
| `description` jo tekst ose mbi 500 karaktere | `description` | `Pershkrimi duhet te jete tekst me maksimumi 500 karaktere.` |
| Trupi nuk eshte objekt JSON | `body` | `Trupi i kerkeses duhet te jete nje objekt JSON.` |

Referencat e huaja kthehen nga sherbimi me mesazh te vetem:

| Rasti | Mesazhi |
| --- | --- |
| `categoryId` i huaj ose qe nuk ekziston | `Kategoria nuk ekziston ose nuk i perket perdoruesit te kycur` |
| `clientId` i huaj ose qe nuk ekziston | `Klienti nuk ekziston ose nuk i perket perdoruesit te kycur` |
| `supplierId` i huaj ose qe nuk ekziston | `Furnitori nuk ekziston ose nuk i perket perdoruesit te kycur` |

## Ndryshimi i transaksionit

`PUT /api/transactions/:id`

Pranon te njejtat fusha si krijimi, por te gjitha jane opsionale. Fushat qe nuk dergohen mbeten te pandryshuara. `clientId` dhe `supplierId` mund te dergohen `null` ose `""` per t'i shkeputur; `description` dergohet bosh ose `null` per t'u ruajtur si `null`. `type` dhe `categoryId` nuk mund te dergohen bosh sepse mbeten te detyrueshme. Per te lene `occurredAt` te pandryshuar, mos e dergo fushen.

Shembull i kerkeses:

```json
{
  "amount": 1300.25,
  "description": ""
}
```

Pergjigja e suksesit (`200`):

```json
{
  "success": true,
  "message": "Transaksioni u perditesua me sukses",
  "data": {
    "transaction": {
      "id": "ea209e97-7ca9-4859-b627-7e2d9991fcfd",
      "userId": "bf30d922-d196-4632-a30f-a1c88cd9c796",
      "categoryId": "074dda62-ba72-4586-b2e7-d1944a393c35",
      "clientId": "4b69b66a-83c1-4feb-8e15-86f0ca43c13a",
      "supplierId": null,
      "type": "INCOME",
      "amount": "1300.25",
      "description": null,
      "occurredAt": "2026-01-15T10:00:00.000Z",
      "createdAt": "2026-11-07T20:10:52.056Z"
    }
  }
}
```

| Status | Kuptimi |
| --- | --- |
| `200` | Transaksioni u perditesua; `data` permban `transaction`. |
| `400` | `id` i pavlefshme ose fusha me format te gabuar / reference te huaja. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Transaksioni nuk ekziston ose i perket nje perdoruesi tjeter. |

## Fshirja e transaksionit

`DELETE /api/transactions/:id`

```json
{
  "success": true,
  "message": "Transaksioni u fshi me sukses"
}
```

| Status | Kuptimi |
| --- | --- |
| `200` | Transaksioni u fshi; pergjigja nuk permban `data`. |
| `400` | `id` nuk eshte ne formatin UUID. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Transaksioni nuk ekziston ose i perket nje perdoruesi tjeter. |

## Rregulla sigurie

- Cdo veprim kufizohet me `userId` te marre nga token-i, jo nga trupi i kerkeses.
- Transaksioni i nje perdoruesi tjeter kthehet gjithmone `404`, qofte per lexim, ndryshim ose fshirje.
- `categoryId`, `clientId` dhe `supplierId` duhet t'i perkasin perdoruesit te kycur; referencat e huaja kthejne `400`, jo `404`.
- Filtrimi me `categoryId` nuk e zbulon a i perket kategoria perdoruesit: nje UUID i vlefshem i huaj kthen liste bosh.
- `userId` nuk pranohet nga trupi i kerkeses; nje vlere e derguar aty injorohet.

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
