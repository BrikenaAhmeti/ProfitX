import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api/api'
import '../styles/invoice-form.css'

const INVOICES_ENDPOINT = '/invoices'
const CLIENTS_ENDPOINT = '/clients'
const MAX_INVOICE_NUMBER = 50
const MAX_ITEM_DESCRIPTION = 300

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

const parseQuantityForTotal = (value) => {
  const trimmed = String(value).trim()
  if (!trimmed || !/^\d+(\.\d{1,3})?$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!(n > 0)) return null
  return n
}

const parseUnitPriceForTotal = (value) => {
  const trimmed = String(value).trim()
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!(n > 0)) return null
  return n
}

const computeTotalCents = (rows) => {
  let cents = 0
  for (const row of rows) {
    const quantity = parseQuantityForTotal(row.quantity)
    const unitPrice = parseUnitPriceForTotal(row.unitPrice)
    if (quantity == null || unitPrice == null) continue
    cents += Math.round(quantity * unitPrice * 100)
  }
  return cents
}

const formatTotal = (cents) => (cents / 100).toFixed(2)

const buildInitialItems = (initialData, createRowId) => {
  const list = initialData?.items
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item) => ({
      rowId: createRowId(),
      description: item.description ?? '',
      quantity: item.quantity != null ? String(item.quantity) : '1',
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
    }))
  }
  return [createEmptyItemRow(createRowId)]
}

const createEmptyItemRow = (createRowId) => ({
  rowId: createRowId(),
  description: '',
  quantity: '1',
  unitPrice: '',
})

const validateInvoiceFields = (values) => {
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

const validateItemRows = (rows) => {
  const errors = {}

  rows.forEach((row) => {
    const rowErrors = {}
    const description = row.description.trim()

    if (!description) {
      rowErrors.description = 'Përshkrimi është i detyrueshëm.'
    } else if (description.length > MAX_ITEM_DESCRIPTION) {
      rowErrors.description = `Përshkrimi mund të ketë deri në ${MAX_ITEM_DESCRIPTION} karaktere.`
    }

    const quantity = row.quantity.trim()
    if (!quantity) {
      rowErrors.quantity = 'Sasia është e detyrueshme.'
    } else if (!/^\d+(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
      rowErrors.quantity = 'Sasia duhet të jetë numër më i madh se zero.'
    }

    const unitPrice = row.unitPrice.trim()
    if (!unitPrice) {
      rowErrors.unitPrice = 'Çmimi për njësi është i detyrueshëm.'
    } else if (!/^\d+(\.\d{1,2})?$/.test(unitPrice) || Number(unitPrice) <= 0) {
      rowErrors.unitPrice = 'Çmimi për njësi duhet të jetë numër më i madh se zero.'
    }

    if (Object.keys(rowErrors).length > 0) {
      errors[row.rowId] = rowErrors
    }
  })

  return errors
}

const buildPayload = (values) => {
  const invoiceNumber = values.invoiceNumber.trim()
  return {
    clientId: values.clientId,
    invoiceNumber,
    status: values.status,
    issueDate: values.issueDate,
    dueDate: values.dueDate || null,
  }
}

export default function InvoiceForm({ initialData = null, onSaved, onCancel }) {
  const isEdit = Boolean(initialData?.id)
  const rowIdRef = useRef(0)
  const createRowId = () => {
    rowIdRef.current += 1
    return `inv-item-${rowIdRef.current}`
  }

  const [values, setValues] = useState(() => buildInitialValues(initialData))
  const [items, setItems] = useState(() => buildInitialItems(initialData, createRowId))
  const [fieldErrors, setFieldErrors] = useState({})
  const [itemErrors, setItemErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [clients, setClients] = useState([])
  const [clientsError, setClientsError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalCents = useMemo(() => computeTotalCents(items), [items])

  useEffect(() => {
    rowIdRef.current = 0
    setValues(buildInitialValues(initialData))
    setItems(buildInitialItems(initialData, createRowId))
    setFieldErrors({})
    setItemErrors({})
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

  const handleItemChange = (rowId, field, value) => {
    setItems((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)),
    )
    setItemErrors((prev) => ({
      ...prev,
      [rowId]: prev[rowId] ? { ...prev[rowId], [field]: undefined } : undefined,
    }))
    setFormError('')
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItemRow(createRowId)])
    setFormError('')
  }

  const handleRemoveItem = (rowId) => {
    setItems((prev) => prev.filter((row) => row.rowId !== rowId))
    setItemErrors((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    if (items.length === 0) {
      setFormError('Shto të paktën një artikull.')
      return
    }

    const invoiceErrors = validateInvoiceFields(values)
    const rowErrors = validateItemRows(items)
    setFieldErrors(invoiceErrors)
    setItemErrors(rowErrors)

    if (Object.keys(invoiceErrors).length > 0 || Object.keys(rowErrors).length > 0) {
      return
    }

    const payload = buildPayload(values)

    setSubmitting(true)
    try {
      const response = isEdit
        ? await api.put(`${INVOICES_ENDPOINT}/${initialData.id}`, payload)
        : await api.post(INVOICES_ENDPOINT, payload)
      const saved = response.data?.data ?? response.data
      if (!isEdit) {
        rowIdRef.current = 0
        setValues(buildInitialValues(null))
        setItems([createEmptyItemRow(createRowId)])
      }
      setFieldErrors({})
      setItemErrors({})
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

      <div className="inv-form__items">
        <h4 className="inv-form__items-title">Artikujt</h4>

        {items.map((row) => (
          <div key={row.rowId} className="inv-form__item-row">
            <label className="inv-form__field inv-form__field--grow">
              <span>Përshkrimi *</span>
              <input
                type="text"
                maxLength={MAX_ITEM_DESCRIPTION}
                value={row.description}
                onChange={(e) => handleItemChange(row.rowId, 'description', e.target.value)}
                disabled={submitting}
              />
              {itemErrors[row.rowId]?.description && (
                <small className="inv-form__field-error">
                  {itemErrors[row.rowId].description}
                </small>
              )}
            </label>

            <label className="inv-form__field">
              <span>Sasia *</span>
              <input
                type="text"
                inputMode="decimal"
                value={row.quantity}
                onChange={(e) => handleItemChange(row.rowId, 'quantity', e.target.value)}
                disabled={submitting}
              />
              {itemErrors[row.rowId]?.quantity && (
                <small className="inv-form__field-error">
                  {itemErrors[row.rowId].quantity}
                </small>
              )}
            </label>

            <label className="inv-form__field">
              <span>Çmimi për njësi *</span>
              <input
                type="text"
                inputMode="decimal"
                value={row.unitPrice}
                onChange={(e) => handleItemChange(row.rowId, 'unitPrice', e.target.value)}
                disabled={submitting}
              />
              {itemErrors[row.rowId]?.unitPrice && (
                <small className="inv-form__field-error">
                  {itemErrors[row.rowId].unitPrice}
                </small>
              )}
            </label>

            <div className="inv-form__item-actions">
              <button
                type="button"
                className="inv-form__remove-item"
                onClick={() => handleRemoveItem(row.rowId)}
                disabled={submitting}
              >
                Hiq
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="inv-form__add-item"
          onClick={handleAddItem}
          disabled={submitting}
        >
          Shto artikull
        </button>

        <p className="inv-form__total" aria-live="polite">
          Totali: {formatTotal(totalCents)}
        </p>
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
