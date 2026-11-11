-- Optimize user-scoped invoice searches by status and due date.
CREATE INDEX "Invoice_userId_status_idx"
ON "Invoice"("userId", "status");

CREATE INDEX "Invoice_userId_dueDate_idx"
ON "Invoice"("userId", "dueDate");
