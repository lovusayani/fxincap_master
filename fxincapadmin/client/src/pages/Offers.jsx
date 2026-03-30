import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'

export const Offers = () => {
  const { token } = useAuth()
  const [message, setMessage] = useState(null)
  const [offers, setOffers] = useState([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offerSaving, setOfferSaving] = useState(false)
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [offerForm, setOfferForm] = useState({
    title: '',
    description: '',
    badge: '',
    sortOrder: 0,
    active: true,
  })

  const fetchOffers = async () => {
    try {
      setOffersLoading(true)
      const response = await fetch('/api/admin/deposit-offers', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Failed to fetch offers')
      setOffers(Array.isArray(data?.data) ? data.data : [])
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Failed to load offers' })
    } finally {
      setOffersLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchOffers()
    }
  }, [token])

  const resetOfferForm = () => {
    setEditingOfferId(null)
    setOfferForm({
      title: '',
      description: '',
      badge: '',
      sortOrder: 0,
      active: true,
    })
  }

  const handleOfferSubmit = async () => {
    try {
      if (!offerForm.title.trim() || !offerForm.description.trim()) {
        setMessage({ type: 'error', text: 'Offer title and description are required' })
        return
      }

      setOfferSaving(true)
      const url = editingOfferId ? `/api/admin/deposit-offers/${editingOfferId}` : '/api/admin/deposit-offers'
      const method = editingOfferId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: offerForm.title.trim(),
          description: offerForm.description.trim(),
          badge: offerForm.badge.trim(),
          sortOrder: Number(offerForm.sortOrder || 0),
          active: offerForm.active,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save offer')
      }

      setMessage({ type: 'success', text: editingOfferId ? 'Offer updated' : 'Offer added' })
      resetOfferForm()
      await fetchOffers()
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save offer' })
    } finally {
      setOfferSaving(false)
    }
  }

  const handleOfferEdit = (offer) => {
    setEditingOfferId(offer.id)
    setOfferForm({
      title: offer.title || '',
      description: offer.description || '',
      badge: offer.badge || '',
      sortOrder: Number(offer.sortOrder || 0),
      active: offer.active !== false,
    })
  }

  const handleOfferDelete = async (id) => {
    if (!window.confirm('Delete this offer?')) return

    try {
      const response = await fetch(`/api/admin/deposit-offers/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete offer')
      }

      setMessage({ type: 'success', text: 'Offer deleted' })
      await fetchOffers()
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Failed to delete offer' })
    }
  }

  return (
    <div className="w-full max-w-none p-3 md:p-5 xl:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">Offers</h1>
        <p className="mt-1 text-sm text-slate-400">Manage deposit offers shown on the trade platform.</p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-md border px-4 py-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Deposit Offers Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offerTitle">Title</Label>
            <input
              id="offerTitle"
              value={offerForm.title}
              onChange={(e) => setOfferForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Offer title"
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offerDescription">Description</Label>
            <textarea
              id="offerDescription"
              rows={3}
              value={offerForm.description}
              onChange={(e) => setOfferForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Offer details for deposit page slider"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="offerBadge">Badge</Label>
              <input
                id="offerBadge"
                value={offerForm.badge}
                onChange={(e) => setOfferForm((prev) => ({ ...prev, badge: e.target.value }))}
                placeholder="Optional"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offerSortOrder">Sort Order</Label>
              <input
                id="offerSortOrder"
                type="number"
                value={offerForm.sortOrder}
                onChange={(e) => setOfferForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offerActive">Status</Label>
              <Select
                id="offerActive"
                value={offerForm.active ? 'active' : 'inactive'}
                onChange={(e) => setOfferForm((prev) => ({ ...prev, active: e.target.value === 'active' }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleOfferSubmit} disabled={offerSaving}>
              {offerSaving ? 'Saving...' : editingOfferId ? 'Update Offer' : 'Add Offer'}
            </Button>
            {editingOfferId && (
              <Button variant="secondary" onClick={resetOfferForm}>
                Cancel Edit
              </Button>
            )}
          </div>

          <div className="rounded-md border border-slate-700">
            <div className="border-b border-slate-700 px-3 py-2 text-sm font-medium text-slate-200">Current Offers</div>
            <div className="max-h-72 overflow-y-auto">
              {offersLoading ? (
                <p className="px-3 py-3 text-sm text-slate-400">Loading offers...</p>
              ) : offers.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-400">No offers found.</p>
              ) : (
                offers.map((offer) => (
                  <div key={offer.id} className="border-b border-slate-800 px-3 py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{offer.title}</p>
                        <p className="text-xs text-slate-400">{offer.description}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Badge: {offer.badge || '-'} | Sort: {offer.sortOrder || 0} | {offer.active ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOfferEdit(offer)}
                          className="rounded-md border border-blue-500/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOfferDelete(offer.id)}
                          className="rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}