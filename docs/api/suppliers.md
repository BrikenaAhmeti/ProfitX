# ProfitX Suppliers API

Base URL lokale: `http://localhost:5000`

Te gjitha rrugut e furnitoreve jane te mbrojtura. Kerkesa duhet te dergoje token te vlefshem:

```
Authorization: Bearer <token>
```

Pa token ose me token te pavlefshem API-ja kthen `401`.

## Formati i pergjigjeve

Suksesi kthen objektin `data`. Lista e furnitoreve kthehet si array direkt ne `data`:

```json
{
  "success": true,
  "data": [
    {
      "id": "3f1c9b1e-5e0a-4b7a-9d5e-2f0c1a7b8c44",
      "userId": "9a2d4c6e-1b3f-4a5d-8c7e-0f1a2b3c4d5e",
      "name": "Furnitori Shembull",
      "email": "furnitori@example.test",
      "phone": "+383 44 123 456",
      "address": "Rr. Nena Tereze 1",
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
    { "field": "email", "message": "Email-i nuk eshte ne format te vlefshem." }
  ]
}
```

## Fushat e furnitorit

| Fusha | Kerkueshme | Kufizimi |
| --- | --- | --- |
| `name` | Po | Tekst, maksimumi 150 karaktere, nuk mund te jete bosh |
| `email` | Jo | Format i vlefshem email-i, maksimumi 255 karaktere; ruhet me shkronja te vogla |
| `phone` | Jo | Tekst, maksimumi 30 karaktere; lejohen numra, hapesira, `+`, `-`, `(`, `)`, `.`, `/` |
| `address` | Jo | Tekst, maksimumi 300 karaktere |

Fushat opsionale qe dergohen bosh (`""`) ose `null` ruhen si `null`. Email-i duhet te jete unik per cdo perdorues, por te njejtin email mund ta perdorin perdorues te ndryshem.

## Lista e furnitoreve

`GET /api/suppliers`

Kthen vetem furnitoret e perdoruesit te kycur, te renditur sipas emrit.

| Status | Kuptimi |
| --- | --- |
| `200` | Lista u kthye; `data` eshte array (mund te jete bosh). |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |

## Nje furnitor

`GET /api/suppliers/:id`

| Status | Kuptimi |
| --- | --- |
| `200` | Furnitori u gjet; `data` permban `supplier`. |
| `400` | `id` nuk eshte ne formatin UUID. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Furnitori nuk ekziston ose i perket nje perdoruesi tjeter. |

## Krijimi i furnitorit

`POST /api/suppliers`

Trupi i kerkeses:

```json
{
  "name": "Furnitori Shembull",
  "email": "furnitori@example.test",
  "phone": "+383 44 123 456",
  "address": "Rr. Nena Tereze 1"
}
```

Vetem `name` eshte i detyrueshem. `userId` nuk dergohet ne trup; lidhet automatikisht me perdoruesin e kycur.

| Status | Kuptimi |
| --- | --- |
| `201` | Furnitori u krijua; `data` permban `supplier`. |
| `400` | Ka fusha qe mungojne ose jane me format te pavlefshme; perfshihet lista `errors`. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `409` | Ky email eshte regjistruar me pare per nje furnitor te te njejtit perdorues. |

## Ndryshimi i furnitorit

`PUT /api/suppliers/:id`

Pranon te njejtat fusha si krijimi, me `name` te detyrueshem. Fushat opsionale qe nuk dergohen mbeten te pandryshuara; fushat qe dergohen bosh ruhen si `null`.

| Status | Kuptimi |
| --- | --- |
| `200` | Furnitori u perditesua; `data` permban `supplier`. |
| `400` | `id` i pavlefshem ose fusha me format te gabuar. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Furnitori nuk ekziston ose i perket nje perdoruesi tjeter. |
| `409` | Email-i i derguar i perket nje furnitori tjeter te te njejtit perdorues. |

## Fshirja e furnitorit

`DELETE /api/suppliers/:id`

| Status | Kuptimi |
| --- | --- |
| `200` | Furnitori u fshi. |
| `400` | `id` nuk eshte ne formatin UUID. |
| `401` | Token-i mungon ose nuk eshte i vlefshem. |
| `404` | Furnitori nuk ekziston ose i perket nje perdoruesi tjeter. |

## Rregulla sigurie

- Cdo veprim kufizohet me `userId` te marre nga token-i, jo nga trupi i kerkeses.
- Furnitori i nje perdoruesi tjeter kthehet gjithmone `404`, qofte per lexim, ndryshim ose fshirje.
- Perdoruesi nuk mund te krijoje dy furnitore me te njejtin email.

## Verifikimi

Nga direktoria `backend`, ekzekuto:

```powershell
node scripts/verify-suppliers-api.cjs --mock
```

Ky test perdor HTTP, JWT, middleware, validator, controller dhe service reale, me ruajtje te simuluar. Kontrollon per POST dhe PUT emrin bosh (400 dhe mesazhin ne `errors`), email-in e pasakte (400), te dhenat e sakta dhe telefonin opsional.

Per verifikim ne databaze reale, konfiguro `DATABASE_URL` dhe `JWT_SECRET` ne `backend/.env`, gjenero klientin Prisma dhe ekzekuto:

```powershell
node scripts/verify-suppliers-api.cjs
```

Testi krijon dy perdorues te perkohshem dhe i pastron bashke me furnitoret e tyre pas testimit.
