import { useEffect, useState } from "react";
import api from "../api/api.js";
import "../styles/transaction-form.css";

const TRANSACTIONS_ENDPOINT = "/transactions";
const MAX_DESCRIPTION = 500;

const todayString = () => new Date().toISOString().slice(0, 10);

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const buildInitialValues = (initialData) => ({
  type: initialData?.type ?? "",
  amount: initialData?.amount != null ? String(initialData.amount) : "",
  categoryId: initialData?.categoryId ?? initialData?.category?.id ?? "",
  occurredAt: initialData?.occurredAt
    ? String(initialData.occurredAt).slice(0, 10)
    : todayString(),
  description: initialData?.description ?? "",
});

const validate = (values) => {
  const errors = {};
  if (!values.type) errors.type = "Zgjidh llojin e transaksionit.";

  const amount = values.amount.trim();
  if (!amount) {
    errors.amount = "Shuma është e detyrueshme.";
  } else if (
    !/^\d+(\.\d{1,2})?$/.test(amount) ||
    Number(amount) <= 0 ||
    Number(amount) >= 1e10
  ) {
    errors.amount =
      "Shuma duhet të jetë numër pozitiv me deri në 2 shifra pas presjes.";
  }

  if (!values.categoryId) errors.categoryId = "Zgjidh kategorinë.";

  if (!values.occurredAt || Number.isNaN(new Date(values.occurredAt).getTime())) {
    errors.occurredAt = "Data është e detyrueshme.";
  }

  if (values.description.length > MAX_DESCRIPTION) {
    errors.description = `Përshkrimi mund të ketë deri në ${MAX_DESCRIPTION} karaktere.`;
  }
  return errors;
};

export default function TransactionForm({ initialData = null, onSaved, onCancel }) {
  const isEdit = Boolean(initialData?.id);
  const [values, setValues] = useState(() => buildInitialValues(initialData));
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(buildInitialValues(initialData));
    setFieldErrors({});
    setFormError("");
  }, [initialData?.id]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/categories")
      .then((response) => {
        if (!cancelled) setCategories(toList(response.data));
      })
      .catch(() => {
        if (!cancelled) setCategoriesError("Kategoritë nuk u ngarkuan.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCategories = categories.filter((c) => c.type === values.type);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "type" && prev.type !== value) next.categoryId = "";
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const description = values.description.trim();
    const payload = {
      type: values.type,
      amount: Number(values.amount),
      categoryId: values.categoryId,
      occurredAt: new Date(values.occurredAt).toISOString(),
      ...(description ? { description } : {}),
    };

    setSubmitting(true);
    setFormError("");
    try {
      const response = isEdit
        ? await api.put(`${TRANSACTIONS_ENDPOINT}/${initialData.id}`, payload)
        : await api.post(TRANSACTIONS_ENDPOINT, payload);
      const saved = response.data?.data ?? response.data;
      if (!isEdit) setValues(buildInitialValues(null));
      setFieldErrors({});
      if (onSaved) onSaved(saved);
    } catch (error) {
      if (!error.response) {
        setFormError("Serveri nuk është i arritshëm. Provoni përsëri më vonë.");
      } else {
        const data = error.response.data;
        const details = Array.isArray(data?.errors)
          ? data.errors.map((e) => e.message).join(" ")
          : "";
        setFormError(
          [data?.message, details].filter(Boolean).join(" ") ||
            "Ndodhi një gabim. Provoni përsëri."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="tx-form" onSubmit={handleSubmit} noValidate>
      <h3 className="tx-form__title">
        {isEdit ? "Ndrysho transaksionin" : "Shto transaksion"}
      </h3>

      {formError && <div className="tx-form__error" role="alert">{formError}</div>}
      {categoriesError && <div className="tx-form__error" role="alert">{categoriesError}</div>}

      <div className="tx-form__grid">
        <label className="tx-form__field">
          <span>Lloji *</span>
          <select name="type" value={values.type} onChange={handleChange} disabled={submitting}>
            <option value="">Zgjidh llojin</option>
            <option value="INCOME">Të ardhura</option>
            <option value="EXPENSE">Shpenzime</option>
          </select>
          {fieldErrors.type && <small className="tx-form__field-error">{fieldErrors.type}</small>}
        </label>

        <label className="tx-form__field">
          <span>Kategoria *</span>
          <select
            name="categoryId"
            value={values.categoryId}
            onChange={handleChange}
            disabled={submitting || !values.type}
          >
            <option value="">
              {values.type ? "Zgjidh kategorinë" : "Zgjidh llojin së pari"}
            </option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {fieldErrors.categoryId && (
            <small className="tx-form__field-error">{fieldErrors.categoryId}</small>
          )}
        </label>

        <label className="tx-form__field">
          <span>Shuma *</span>
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={handleChange}
            disabled={submitting}
          />
          {fieldErrors.amount && <small className="tx-form__field-error">{fieldErrors.amount}</small>}
        </label>

        <label className="tx-form__field">
          <span>Data *</span>
          <input
            type="date"
            name="occurredAt"
            value={values.occurredAt}
            onChange={handleChange}
            disabled={submitting}
          />
          {fieldErrors.occurredAt && (
            <small className="tx-form__field-error">{fieldErrors.occurredAt}</small>
          )}
        </label>

        <label className="tx-form__field tx-form__field--wide">
          <span>Përshkrimi</span>
          <textarea
            name="description"
            rows={3}
            maxLength={MAX_DESCRIPTION}
            value={values.description}
            onChange={handleChange}
            disabled={submitting}
          />
          {fieldErrors.description && (
            <small className="tx-form__field-error">{fieldErrors.description}</small>
          )}
        </label>
      </div>

      <div className="tx-form__actions">
        <button type="submit" className="tx-form__submit" disabled={submitting}>
          {submitting ? "Duke ruajtur..." : isEdit ? "Ruaj ndryshimet" : "Shto"}
        </button>
        {onCancel && (
          <button type="button" className="tx-form__cancel" onClick={onCancel} disabled={submitting}>
            Anulo
          </button>
        )}
      </div>
    </form>
  );
}