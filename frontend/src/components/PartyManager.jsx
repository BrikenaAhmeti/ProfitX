import { useCallback, useEffect, useState } from 'react'
import api from '../api/api'
import '../styles/party.css'

const emptyForm = { name: '', email: '', phone: '', address: '' }

function extractList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  return []
}

function errorMessage(err) {
  if (!err.response) return 'Nuk u lidh me serverin.'
  const data = err.response.data
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.message).join(' ')
  }
  return data?.message || data?.error || 'Ndodhi një gabim. Provoni përsëri.'
}

export default function PartyManager({ title, singular, endpoint }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(endpoint)
      setItems(extractList(res.data))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    load()
  }, [load])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const name = form.name.trim()
    const email = form.email.trim()
    if (!name) {
      setError('Emri është i detyrueshëm.')
      return
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Formati i email-it nuk është i saktë.')
      return
    }

    const payload = {
      name,
      email,
      phone: form.phone.trim(),
      address: form.address.trim(),
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(endpoint + '/' + editingId, payload)
      } else {
        await api.post(endpoint, payload)
      }
      resetForm()
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (item) => {
    if (!window.confirm('Të fshihet ' + singular + ' "' + item.name + '"?')) return
    setError('')
    try {
      await api.delete(endpoint + '/' + item.id)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="party-page">
      <h2>{title}</h2>

      {error && <div className="party-error">{error}</div>}

      <form className="party-form" onSubmit={handleSubmit}>
        <h3>{editingId ? 'Ndrysho ' + singular : 'Shto ' + singular}</h3>
        <div className="party-grid">
          <input name="name" placeholder="Emri *" value={form.name} onChange={handleChange} />
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
          <input name="phone" placeholder="Telefoni" value={form.phone} onChange={handleChange} />
          <input name="address" placeholder="Adresa" value={form.address} onChange={handleChange} />
        </div>
        <div className="party-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Duke ruajtur...' : editingId ? 'Ruaj ndryshimet' : 'Shto'}
          </button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Anulo
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Duke ngarkuar...</p>
      ) : items.length === 0 ? (
        <p className="party-empty">Nuk ka të dhëna ende.</p>
      ) : (
        <div className="party-table-wrap">
          <table className="party-table">
            <thead>
              <tr>
                <th>Emri</th>
                <th>Email</th>
                <th>Telefoni</th>
                <th>Adresa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email || '-'}</td>
                  <td>{item.phone || '-'}</td>
                  <td>{item.address || '-'}</td>
                  <td className="party-row-actions">
                    <button type="button" className="secondary" onClick={() => handleEdit(item)}>
                      Ndrysho
                    </button>
                    <button type="button" className="danger" onClick={() => handleDelete(item)}>
                      Fshi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}