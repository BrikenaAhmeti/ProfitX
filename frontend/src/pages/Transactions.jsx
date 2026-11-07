import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/api.js";
import TransactionForm from "../components/TransactionForm.jsx";
import "../styles/transactions.css";

const TRANSACTIONS_ENDPOINT = "/transactions";

const TYPE_LABELS = { INCOME: "Të ardhura", EXPENSE: "Shpenzime" };

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    const nested = Object.values(payload.data).find(Array.isArray);
    if (nested) return nested;
  }
  return [];
};

const fetchList = async (url) => toList((await api.get(url)).data);

const toNameMap = (items) => new Map(items.map((item) => [item.id, item.name]));

const getErrorMessage = (error) =>
  error.response
    ? error.response.data?.message || "Ndodhi një gabim. Provoni përsëri."
    : "Serveri nuk është i arritshëm. Provoni përsëri më vonë.";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const loadTransactions = useCallback(async () => {
    setTransactions(await fetchList(TRANSACTIONS_ENDPOINT));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const [tx, cat, cli, sup] = await Promise.all([
          fetchList(TRANSACTIONS_ENDPOINT),
          fetchList("/categories"),
          fetchList("/clients"),
          fetchList("/suppliers"),
        ]);
        if (cancelled) return;
        setTransactions(tx);
        setCategories(cat);
        setClients(cli);
        setSuppliers(sup);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryMap = useMemo(() => toNameMap(categories), [categories]);
  const clientMap = useMemo(() => toNameMap(clients), [clients]);
  const supplierMap = useMemo(() => toNameMap(suppliers), [suppliers]);

  const rows = useMemo(
    () =>
      [...transactions].sort((a, b) =>
        String(b.occurredAt).localeCompare(String(a.occurredAt))
      ),
    [transactions]
  );

  const categoryName = (t) => t.category?.name ?? categoryMap.get(t.categoryId) ?? "—";
  const partyName = (t) =>
    t.client?.name ??
    clientMap.get(t.clientId) ??
    t.supplier?.name ??
    supplierMap.get(t.supplierId) ??
    "—";

  const handleSaved = async () => {
    try {
      await loadTransactions();
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setEditing(null);
  };

  const handleEdit = (transaction) => {
    setEditing(transaction);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <h1 className="tx-page__title">Transaksione</h1>

      <TransactionForm
        initialData={editing}
        onSaved={handleSaved}
        onCancel={() => setEditing(null)}
      />

      {error && <div className="tx-page__error" role="alert">{error}</div>}

      {loading ? (
        <p className="tx-page__empty">Duke ngarkuar...</p>
      ) : rows.length === 0 ? (
        <p className="tx-page__empty">Nuk ka transaksione ende.</p>
      ) : (
        <div className="tx-table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Lloji</th>
                <th>Kategoria</th>
                <th>Klienti / Furnitori</th>
                <th className="tx-table__num">Shuma</th>
                <th>Përshkrimi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{String(t.occurredAt).slice(0, 10)}</td>
                  <td>{TYPE_LABELS[t.type] ?? t.type}</td>
                  <td>{categoryName(t)}</td>
                  <td>{partyName(t)}</td>
                  <td className="tx-table__num">{Number(t.amount).toFixed(2)}</td>
                  <td>{t.description || "—"}</td>
                  <td>
                    <button type="button" className="tx-table__edit" onClick={() => handleEdit(t)}>
                      Ndrysho
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}