-- Optimize user-scoped transaction searches by type and occurrence date.
CREATE INDEX "Transaction_userId_type_occurredAt_idx"
ON "Transaction"("userId", "type", "occurredAt");
