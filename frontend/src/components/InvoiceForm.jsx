import { useEffect, useState } from 'react'
import api from '../api/api'
import '../styles/invoice-form.css'

const INVOICES_ENDPOINT = '/invoices'
const CLIENTS_ENDPOINT = '/clients'
const MAX_INVOICE_NUMBER = 50

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']

const STATUS_LABELS = {
  DRAFT: 'Draft',
  SENT: 'Dërguar',
  PAID: 'Paguar',
  OVERDUE: 'Vonuar',
  CANCELLED: 'Anuluar',
}

const todayString = () => new Date().toISOString().slice(0, 10)

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (payload?.data && typeof payload.data === 'object') {
    const nested = Object.values(payload.data).find(Array.isArray)
    if (nested) return nested
  }
  return []
}

const fetchClientList = async () => toList((await api.get(CLIENTS_ENDPOINT)).data)

const dateFromValue = (value) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const buildInitialValues = (initialData) => ({
  clientId: initialData?.clientId ?? initialData?.client?.id ?? '',
  invoiceNumber: initialData?.invoiceNumber ?? '',
  issueDate: initialData?.issueDate
    ? dateFromValue(initialData.issueDate)
    : todayString(),
  dueDate: initialData?.dueDate ? dateFromValue(initialData.dueDate) : '',
  status: initialData?.status ?? 'DRAFT',
})

const validate = (values) => {
  const errors = {}

  if (!values.clientId) {
    errors.clientId = 'Zgjidh klientin.'
  }

  const invoiceNumber = values.invoiceNumber.trim()
  if (!invoiceNumber) {
    errors.invoiceNumber = 'Numri i faturës është i detyrueshëm.'
  } else if (invoiceNumber.length > MAX_INVOICE_NUMBER) {
    errors.invoiceNumber = `Numri i faturës mund të ketë deri në ${MAX_INVOICE_NUMBER} karaktere.`
  }

  if (!values.issueDate || Number.isNaN(new Date(values.issueDate).getTime())) {
    errors.issueDate = 'Data e lëshimit është e detyrueshme.'
  }

  if (values.dueDate) {
    if (Number.isNaN(new Date(values.dueDate).getTime())) {
      errors.dueDate = 'Data e afatit nuk është e vlefshme.'
    } else if (values.issueDate && values.dueDate < values.issueDate) {
      errors.dueDate = 'Afati nuk mund të jetë para datës së lëshimit.'
    }
  }

  return errors
}

const buildPayload = (values) => {
  const invoiceNumber = values.invoiceNumber.trim()
  const payload = {
    clientId: values.clientId,
    invoiceNumber,
    status: values.status,
    issueDate: values.issueDate,
    dueDate: values.dueDate || null,
  }
  return payload
}

export default function InvoiceForm({ initialData = null, onSaved, onCancel }) {
  const isEdit = Boolean(initialData?.id)
  const [values, setValues] = useState(() => buildInitialValues(initialData))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [clients, setClients] = useState([])
  const [clientsError, setClientsError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setValues(buildInitialValues(initialData))
    setFieldErrors({})
    setFormError('')
  }, [initialData?.id])

  useEffect(() => {
    let cancelled = false
    fetchClientList()
      .then((list) => {
        if (!cancelled) setClients(list)
      })
      .catch(() => {
        if (!cancelled) setClientsError('Nuk u ngarkuan klientët.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    setFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = validate(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const payload = buildPayload(values)

    setSubmitting(true)
    setFormError('')
    try {
      const response = isEdit
        ? await api.put(`${INVOICES_ENDPOINT}/${initialData.id}`, payload)
        : await api.post(INVOICES_ENDPOINT, payload)
      const saved = response.data?.data ?? response.data
      if (!isEdit) {
        setValues(buildInitialValues(null))
      }
      setFieldErrors({})
      if (onSaved) onSaved(saved)
    } catch (error) {
      if (!error.response) {
        setFormError('Serveri nuk është i arritshëm. Provoni përsëri më vonë.')
      } else {
        const data = error.response.data
        const details = Array.isArray(data?.errors)
          ? data.errors.map((e) => e.message).join(' ')
          : ''
        setFormError(
          [data?.message, details].filter(Boolean).join(' ') ||
            'Ndodhi një gabim. Provoni përsëri.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="inv-form" onSubmit={handleSubmit} noValidate>
      <h3 className="inv-form__title">
        {isEdit ? 'Ndrysho faturën' : 'Shto faturë'}
      </h3>

      {formError && (
        <div className="inv-form__error" role="alert">
          {formError}
        </div>
      )}
      {clientsError && (
        <div className="inv-form__error" role="alert">
          {clientsError}
        </div>
      )}

      <div className="inv-form__grid">
        <label className="inv-form__field">
          <span>Klienti *</span>
          <select
            name="clientId"
            value={values.clientId}
            onChange={handleChange}
            disabled={submitting}
          >
            <option value="">Zgjidh klientin</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {fieldErrors.clientId && (
            <small className="inv-form__field-error">{fieldErrors.clientId}</small>
          )}
        </label>

        <label className="inv-form__field">
          <span>Numri i faturës *</span>
          <input
            type="text"
            name="invoiceNumber"
            maxLength={MAX_INVOICE_NUMBER}
            value={values.invoiceNumber}
            onChange={handleChange}
            disabled={submitting}
          />
          {fieldErrors.invoiceNumber && (
            <small className="inv-form__field-error">{fieldErrors.invoiceNumber}</small>
          )}
        </label>

        <label className="inv-form__field">
          <span>Data e lëshimit *</span>
          <input
            type="date"
            name="issueDate"
            value={values.issueDate}
            onChange={handleChange}
            disabled={submitting}
          />
          {fieldErrors.issueDate && (
            <small className="inv-form__field-error">{fieldErrors.issueDate}</small>
          )}
        </label>

        <label className="inv-form__field">
          <span>Afati</span>
          <input
            type="date"
            name="dueDate"
            value={values.dueDate}
            onChange={handleChange}
            disabled={submitting}
          />
          {fieldErrors.dueDate && (
            <small className="inv-form__field-error">{fieldErrors.dueDate}</small>
          )}
        </label>

        <label className="inv-form__field">
          <span>Statusi</span>
          <select
            name="status"
            value={values.status}
            onChange={handleChange}
            disabled={submitting}
          >
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] || status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="inv-form__actions">
        <button type="submit" className="inv-form__submit" disabled={submitting}>
          {submitting ? 'Duke ruajtur...' : isEdit ? 'Ruaj ndryshimet' : 'Shto'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="inv-form__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Anulo
          </button>
        )}
      </div>
    </form>
  )
}
