\# FinTrack — Database Setup



\## Neon connection



ProfitX uses the Neon PostgreSQL database named `profitx`.



In `backend/.env`, configure:



\- `DATABASE\_URL`: pooled Neon URL for the application.

\- `DIRECT\_URL`: direct Neon URL for Prisma migrations.



Keep `backend/.env` local and do not commit it.



\## Prisma commands



Run these commands from the repository root:



```powershell

cd backend

npm install

npx prisma validate

npm run db:check

npx prisma migrate dev --name init

npx prisma generate

npx prisma migrate status

```



Prisma reads the migration URL from `DIRECT\_URL` in `prisma.config.ts`. The initial migration is stored under `backend/prisma/migrations/`.



\## Verify the tables in Neon



In Neon SQL Editor, select database `profitx` and run:



```sql

SELECT table\_name

FROM information\_schema.tables

WHERE table\_schema = 'public'

ORDER BY table\_name;

```



The initial schema includes `User`, `Client`, `Supplier`, `Category`, `Transaction`, `Invoice`, and `InvoiceItem`, plus Prisma's `\_prisma\_migrations` table.



\## References



\- \[Prisma 7 migrate dev](https://www.prisma.io/docs/cli/v7/migrate/dev)

\- \[Neon: Manage databases](https://neon.com/docs/manage/databases)


## Seed test data

From `backend/`, run `npm run db:seed`. The seed creates or reuses the test user `prova@example.test`, its income and expense categories, a sample client and supplier, and one income plus one expense transaction. The test password is `Test123456`.

The seed is safe to run repeatedly: it upserts supporting records and identifies each sample transaction by its user, description, and fixed occurrence timestamp before inserting it. Income links to the sample client and expenses link to the sample supplier.

To confirm the seeded rows in Neon SQL Editor, run:

```sql
SELECT u.email, t.type, t.amount, t.description, t."occurredAt"
FROM "Transaction" t
JOIN "User" u ON u.id = t."userId"
WHERE u.email = 'prova@example.test'
  AND t.description LIKE 'Seed:%'
ORDER BY t."occurredAt";
```

The query should return one `INCOME` and one `EXPENSE` row. Rerunning the seed should leave those two rows unchanged.
