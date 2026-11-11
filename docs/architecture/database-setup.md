# ProfitX — Database Setup

## Neon connection

ProfitX uses the Neon PostgreSQL database named `profitx`.

In `backend/.env`, configure `DATABASE_URL` with the pooled Neon URL and `DIRECT_URL` with the direct URL used by Prisma migrations. Keep `backend/.env` local and do not commit it.

## Prisma setup

Run from the repository root:

```powershell
cd backend
npm install
npx prisma validate
npm run db:check
npx prisma migrate dev --name init
npx prisma generate
npx prisma migrate status
```

Prisma reads the migration URL from `DIRECT_URL` in `prisma.config.ts`. The initial migration is stored under `backend/prisma/migrations/`.

## Seed demo data

After configuring `backend/.env` and applying the database migration, run from `backend/`:

```powershell
npm run db:seed
```

The command creates or updates a demo account (`demo@profitx.local`), two categories, two clients, and two suppliers. The sections below also cover the seeded transactions and invoices. The demo account password is `ProfitXDemo123!`; change it before using the account outside local testing. The seed uses unique keys to safely run more than once without duplicating records.

To verify the rows in Neon's SQL Editor, select database `profitx` and run:

```sql
SELECT 'User' AS table_name, COUNT(*) AS rows
FROM "User"
WHERE email = 'demo@profitx.local'
UNION ALL
SELECT 'Category', COUNT(*)
FROM "Category" c
JOIN "User" u ON u.id = c."userId"
WHERE u.email = 'demo@profitx.local'
UNION ALL
SELECT 'Client', COUNT(*)
FROM "Client" c
JOIN "User" u ON u.id = c."userId"
WHERE u.email = 'demo@profitx.local'
UNION ALL
SELECT 'Supplier', COUNT(*)
FROM "Supplier" s
JOIN "User" u ON u.id = s."userId"
WHERE u.email = 'demo@profitx.local';
```

The expected counts are 1 user, 2 categories, 2 clients, and 2 suppliers. Run the query before and after a second `npm run db:seed` invocation to confirm counts remain the same.

## Verify the tables in Neon

In Neon SQL Editor, select database `profitx` and run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

The initial schema includes `User`, `Client`, `Supplier`, `Category`, `Transaction`, `Invoice`, and `InvoiceItem`, plus Prisma's `_prisma_migrations` table.

## References

- [Prisma 7 migrate dev](https://www.prisma.io/docs/cli/v7/migrate/dev)
- [Neon: Manage databases](https://neon.com/docs/manage/databases)

## Verify seeded transactions

The demo seed also creates one income and one expense transaction for `demo@profitx.local`, using the seeded `Shitje` and `Shpenzime operative` categories, `Klienti Demo`, and `Furnitori Demo`. The transaction records are keyed by the demo user's ID, description, and fixed occurrence timestamp, so repeated seed runs do not create duplicates.

In Neon's SQL Editor, confirm the transactions with:

```sql
SELECT t.type, t.amount, t.description, t."occurredAt"
FROM "Transaction" t
JOIN "User" u ON u.id = t."userId"
WHERE u.email = 'demo@profitx.local'
  AND t.description LIKE 'Seed:%'
ORDER BY t."occurredAt";
```

The query should return one `INCOME` and one `EXPENSE` row. Run `npm run db:seed` twice and confirm the query still returns only those two rows.

## Verify seeded invoices

The demo seed adds four invoices for `demo@profitx.local`, each with at least one item, covering the `PAID`, `SENT`, `DRAFT`, and `OVERDUE` statuses. They use `Klienti Demo` and `Klienti Shembull` and fixed invoice numbers, so repeated seed runs skip existing ones instead of creating duplicates.

In Neon's SQL Editor, confirm the invoices and item counts with:

```sql
SELECT i."invoiceNumber", i.status, i."issueDate", i."dueDate",
       COUNT(ii.id) AS item_count
FROM "Invoice" i
JOIN "User" u ON u.id = i."userId"
LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
WHERE u.email = 'demo@profitx.local'
GROUP BY i.id
ORDER BY i."invoiceNumber";
```

The query should return four invoices (`F-2026-0001` to `F-2026-0004`) with five items in total. Run `npm run db:seed` twice and confirm the invoice and item counts stay the same.
