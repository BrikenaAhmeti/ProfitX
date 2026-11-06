# ProfitX Categories API

Base URL lokale: `http://localhost:5000`

Te gjitha rrugut e kategorive jane te mbrojtura. Kerkesa duhet te dergoje token te vlefshem:

```
Authorization: Bearer <token>
```

Pa token ose me token te pavlefshem API-ja kthen `401`.

## Formati i pergjigjeve

Suksesi kthen objektin `data`. Lista e kategorive kthehet si array direkt ne `data`:

```json
{
  "success": true,
  "data": [
    {
      "id": "3f1c9b1e-5e0a-4b7a-9d5e-2f0c1a7b8c44",
      "userId": "9a2d4c6e-1b3f-4a5d-8c7e-0f1a2b3c4d5e",
      "name": "Shitje",
      "type": "INCOME",
      "createdAt": "2026-10-31T10:00:00.000Z"
    }
  ]
}
```

Gabimet e validimit kthejne JSON me kete forme:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Kerkesa permban fusha te pavlefshme.",
  "errors": [
    { "field": "type", "message": "Lloji duhet te jete te ardhura (INCOME) ose shpenzim (EXPENSE)." }
  ]
}
```

## Fushat e kategorise

| Fusha | Kerkueshme | Kufizimi |
| --- | --- | --- |
| `name` | Po | Tekst, maksimumi 100 karaktere, nuk mund te jete bosh |
| `type` | Po | `INCOME` (te ardhura) ose `EXPENSE` (shpenzim). Pranohen edhe vlerat `te ardhura` dhe `shpenzim`. |

Emri dhe lloji se bashku jane unik per cdo perdorues. I njejti emer mund te perdoret nje here per te ardhura dhe nje here per shpenzim.

## Lista e kategorive

`GET /api/categories`

Kthen vetem kategorite e perdoruesit te kycur.

| Status | Kuptimi |
| --- | --- |
| `200` | Lista u kthye; `data` eshte array (mund te jete bosh). |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |

## Nje kategori

`GET /api/categories/:id`

| Status | Kuptimi |
| --- | --- |
| `200` | Kategoria u gjet; `data` permban `category`. |
| `400` | `id` nuk eshte ne formatin UUID. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Kategoria nuk ekziston ose i perket nje perdoruesi tjeter. |

## Krijimi i kategorise

`POST /api/categories`

Trupi i kerkeses:

```json
{
  "name": "Shitje",
  "type": "INCOME"
}
```

`userId` nuk dergohet ne trup; lidhet automatikisht me perdoruesin e kycur.

| Status | Kuptimi |
| --- | --- |
| `201` | Kategoria u krijua; `data` permban `category`. |
| `400` | Emri mungon/eshte bosh, ose lloji nuk eshte `INCOME`/`EXPENSE`; perfshihet lista `errors`. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `409` | Perdoruesi ka tashme nje kategori me te njejtin emer dhe lloj. |

## Ndryshimi i kategorise

`PUT /api/categories/:id`

Pranon te njejtat fusha si krijimi, me `name` dhe `type` te detyrueshem.

| Status | Kuptimi |
| --- | --- |
| `200` | Kategoria u perditesua; `data` permban `category`. |
| `400` | `id` i pavlefshem ose fusha me format te gabuar. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Kategoria nuk ekziston ose i perket nje perdoruesi tjeter. |
| `409` | Emri dhe lloji i derguar i perkasin nje kategorie tjeter te te njejtit perdorues. |

## Fshirja e kategorise

`DELETE /api/categories/:id`

| Status | Kuptimi |
| --- | --- |
| `200` | Kategoria u fshi. |
| `400` | `id` nuk eshte ne formatin UUID. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Kategoria nuk ekziston ose i perket nje perdoruesi tjeter. |
| `409` | Kategoria perdoret ne transaksione dhe nuk mund te fshihet. |

## Rregulla sigurie

- Cdo veprim kufizohet me `userId` te marre nga token-i, jo nga trupi i kerkeses.
- Kategoria e nje perdoruesi tjeter kthehet gjithmone `404`, qofte per lexim, ndryshim ose fshirje.
- Perdoruesi nuk mund te krijoje dy kategori me te njejtin emer dhe lloj.

## Validimi i POST dhe PUT

Te dyja rrugat perdorin `category.validators.js`. Emri qe mungon, eshte bosh ose permban vetem hapesira kthen `400`, me `errors` per fushen `name` dhe mesazhin `Emri eshte i detyrueshem.`. Lloji i pavlefshem, p.sh. `OTHER`, kthen `400` me gabim per fushen `type`. PUT kerkon si emrin ashtu edhe llojin.

Lloji normalizohet pa dallim shkronjash te medha/vogla dhe me heqjen e hapesirave anash. Pranohen `INCOME`, `EXPENSE`, `te ardhura`, `te_ardhura`, `shpenzim` dhe `shpenzime`; ne databaze ruhen vetem `INCOME` ose `EXPENSE`.

## Testet Postman

Koleksioni `backend/tests/postman/ProfitX-API.postman_collection.json` permban regjistrimin, hyrjen dhe rastet per kliente, furnitore e kategori. Token-i dhe ID-te ruhen automatikisht gjate ekzekutimit. Ekzekuto koleksionin e plote sipas rendit.

Nga `backend`, ekzekuto `node tests/postman/run-collection.cjs --mock` per kontrollin HTTP me databaze te simuluar, ose `node tests/postman/run-collection.cjs` per databaze reale me `.env` te konfiguruar. Udhezimet dhe pastrimi i te dhenave dokumentohen ne `backend/tests/postman/README.md`.
