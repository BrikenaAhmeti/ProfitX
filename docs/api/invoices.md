# API e faturave — verifikimi

Fushat ndjekin modelet `Invoice` dhe `InvoiceItem` ne `backend/prisma/schema.prisma` dhe [ERD](../architecture/erd.md). Rruget nen `/api/invoices` kerkojne `Authorization: Bearer <JWT>`.

| Metoda dhe rruga | Suksesi | Pergjigjja |
| --- | --- | --- |
| `POST /api/invoices` | `201` | `data.invoice`, me artikujt dhe `total` |
| `GET /api/invoices` | `200` | `data`, lista e faturave te perdoruesit, me artikujt dhe totalet |
| `GET /api/invoices/:id` | `200` | `data.invoice`, me artikujt dhe `total` |
| `PUT /api/invoices/:id` | `200` | `data.invoice`, me artikujt dhe totalin e rillogaritur |
| `DELETE /api/invoices/:id` | `200` | `success: true` dhe mesazh; artikujt fshihen me cascade |

## Kerkesa dhe totali

Shembull i trupit per krijim:

```json
{
  "clientId": "UUID-e-klientit-te-perdoruesit",
  "invoiceNumber": "F-2026-001",
  "issueDate": "2026-11-10",
  "dueDate": "2026-11-30",
  "items": [
    { "description": "Sherbim A", "quantity": "2.500", "unitPrice": "12.34" },
    { "description": "Sherbim B", "quantity": 3, "unitPrice": "0.10" }
  ]
}
```

`data.invoice.total` ne pergjigje eshte `"31.15"`. Serveri rrumbullakon cdo artikull ne cent (gjysma lart) dhe mbledh shumat me aritmetike te sakte. Totali nuk ruhet ne databaze dhe nje `total` i derguar nga klienti injorohet.

Klienti, numri (deri ne 50 karaktere) dhe te pakten nje artikull jane te detyrueshem ne POST. Pershkrimi i artikullit kerkohet (deri ne 300 karaktere); sasia duhet te jete pozitive me deri ne 3 shifra dhjetore, cmimi pozitiv me deri ne 2. Sasia e munguar merr vleren 1. Data e leshimit e munguar merr daten aktuale; afati lejohet bosh ose `null`, por nuk mund te jete para dates se leshimit. PUT ruan fushat e paderguara; kur dergohen `items`, lista zevendeson te gjithe artikujt.

Statusi fillestar eshte `DRAFT`, pervec kur dergohet shprehimisht nje status i vlefshem. Kalimet ne PUT dokumentohen ne [rregullat e statusit](../architecture/erd.md#invoice-status-transitions). Gabimet e validimit dhe kalimet e palejuara kthejne `400` me mesazhe sipas fushave ne `errors[]`. Token-i qe mungon ose eshte i pavlefshem kthen `401`. Fatura qe mungon ose i perket dikujt tjeter kthen `404`; klienti i huaj refuzohet me `400`. Numri i dyfishte per te njejtin perdorues kthen `409`; perdorues te ndryshem mund te perdorin te njejtin numer.

## Ekzekutimi i verifikimit

Nga direktoria `backend`, pas `npm install`:

```powershell
node scripts/verify-invoices-api.cjs --mock
```

Ose `npm run verify:invoices -- --mock`. Modaliteti `--mock` zevendeson vetem ruajtjen e te dhenave. Aplikacioni Express, rruga e regjistruar `/api/invoices`, JWT, middleware, validator, controller dhe service jane reale; testi nuk kerkon `.env` ose databaze. Ky modalitet nuk perben verifikim me databaze reale.

Per databaze reale, konfiguro `DATABASE_URL`, `DIRECT_URL` dhe `JWT_SECRET` ne `backend/.env`, sipas [konfigurimit te databazes](../architecture/database-setup.md). Perdorni nje databaze testimi me migrimet e projektit te zbatuara. Gjenero klientin Prisma dhe ekzekuto:

```powershell
npx prisma generate
node scripts/verify-invoices-api.cjs
```

Ose `npm run verify:invoices`. Migrimet per nje databaze testimi te re aplikohen me `npx prisma migrate deploy`, pasi `DIRECT_URL` te jete konfiguruar per ate databaze. Variablat mund te jepen edhe ne mjedisin e procesit; `.env` nuk eshte i detyrueshem kur ato ekzistojne tashme.

Skripti nis API-ne vete ne nje port lokal te lire dhe krijon dy perdorues me UUID/email unik dhe nga nje klient per secilin. Kontrollon:

- Krijimin e fatures bashke me artikujt, sasine e parazgjedhur dhe totalin e serverit.
- Listen dhe detajet me totale, renditjen dhe izolimin mes dy perdoruesve.
- GET/PUT/DELETE te faturave te huaja (`404`) dhe refuzimin e klientit te huaj (`400`).
- Numrin unik per perdorues (`409`) dhe riperdorimin e tij nga perdoruesi tjeter.
- Zevendesimin e artikujve, fshirjen e artikujve te vjeter dhe totalin e rillogaritur.
- Kalimet e lejuara te statusit dhe refuzimin e kalimeve nga `PAID`/`CANCELLED` (`400` me mesazh te qarte), pa ndryshime te pjesshme.
- Validimin, autentikimin, fshirjen e fatures dhe fshirjen me cascade te artikujve.

## Pastrimi, perfshire deshtimet

Blloku `finally` mbyll serverin, fshin vetem faturat/klientet/perdoruesit me UUID-te e ketij ekzekutimi dhe kontrollon qe nuk mbeten as artikuj te tyre. Lidhja Prisma mbyllet edhe nese testet ose pastrimi deshtojne. Nje deshtim i testit ose pastrimit jep kod daljeje `1`; suksesi jep `0` dhe mesazhet `PASS`.

Per te provuar pastrimin pas nje deshtimi te qellimshem, ekzekuto:

```powershell
node scripts/verify-invoices-api.cjs --mock --fail-after-setup
node scripts/verify-invoices-api.cjs --fail-after-setup
```

Te dyja komandat krijojne perdorues, kliente, fatura dhe artikuj, pastaj deshtojne qellimisht me kod daljeje `1`. Para mesazhit te deshtimit duhet te shfaqet `PASS Pastrimi`, qe verifikon se te dhenat e perkohshme jane hequr.
