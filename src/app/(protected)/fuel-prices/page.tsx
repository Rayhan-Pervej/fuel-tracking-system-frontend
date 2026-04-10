'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

interface FuelPrice { _id: string; fuel_type: string; price_per_unit: number; unit: string; currency: string; effective_from: string; created_at: string; }
interface LatestPrices { octane: FuelPrice | null; diesel: FuelPrice | null; petrol: FuelPrice | null; }

export default function FuelPricesPage() {
  const { isAdmin } = useAuth();
  const [fuelFilter, setFuelFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ fuel_type: 'octane', price_per_unit: '', unit: 'liter', currency: 'BDT', effective_from: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [latest, setLatest] = useState<LatestPrices>({ octane: null, diesel: null, petrol: null });

  useEffect(() => {
    ['octane', 'diesel', 'petrol'].forEach(ft => {
      apiFetch<{ data: { fuel_price: FuelPrice } }>(`/api/fuel-prices/latest/${ft}`)
        .then(r => setLatest(prev => ({ ...prev, [ft]: r.data.fuel_price })))
        .catch(() => {});
    });
  }, []);

  const fetcher = useCallback(async (cursor: string | null, filters: { fuel_type: string; from: string; to: string }) => {
    const q = buildQuery({ cursor, limit: 15, fuel_type: filters.fuel_type || undefined, effective_from_after: filters.from || undefined, effective_from_before: filters.to || undefined });
    const res = await apiFetch<{ data: { fuel_prices: FuelPrice[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/fuel-prices/${q}`);
    return { items: res.data.fuel_prices, pagination: res.data.pagination };
  }, []);

  const { items: prices, hasMore, loading, error, loadMore, refresh } = useCursorList<FuelPrice, { fuel_type: string; from: string; to: string }>({
    fetcher, filters: { fuel_type: fuelFilter, from: fromFilter, to: toFilter },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch('/api/fuel-prices/', { method: 'POST', body: JSON.stringify({ ...form, price_per_unit: parseFloat(form.price_per_unit) }) });
      setShowCreate(false); setForm({ fuel_type: 'octane', price_per_unit: '', unit: 'liter', currency: 'BDT', effective_from: '' });
      refresh();
      // refresh latest
      apiFetch<{ data: { fuel_price: FuelPrice } }>(`/api/fuel-prices/latest/${form.fuel_type}`)
        .then(r => setLatest(prev => ({ ...prev, [form.fuel_type]: r.data.fuel_price })))
        .catch(() => {});
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Fuel Prices</h1>
        {isAdmin && (
          <button onClick={() => { setShowCreate(true); setFormError(''); }}
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">+ New Price</button>
        )}
      </div>

      {/* Latest prices */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(['octane', 'diesel', 'petrol'] as const).map(ft => {
          const p = latest[ft];
          return (
            <div key={ft} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1"><Badge value={ft} /><span className="text-xs text-gray-400">Current</span></div>
              {p ? (
                <>
                  <p className="text-2xl font-bold">{p.price_per_unit} <span className="text-sm font-normal text-gray-500">{p.currency}/{p.unit}</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">From {p.effective_from}</p>
                </>
              ) : <p className="text-gray-400 text-sm mt-1">No price set</p>}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <select value={fuelFilter} onChange={e => setFuelFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none">
          <option value="">All types</option>
          <option value="octane">Octane</option>
          <option value="diesel">Diesel</option>
          <option value="petrol">Petrol</option>
        </select>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Effective From</label>
          <input type="date" value={fromFilter} onChange={e => setFromFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Effective To</label>
          <input type="date" value={toFilter} onChange={e => setToFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none" />
        </div>
        {(fuelFilter || fromFilter || toFilter) && (
          <button onClick={() => { setFuelFilter(''); setFromFilter(''); setToFilter(''); }} className="text-sm text-gray-500 hover:text-gray-800 mb-1.5">Clear</button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Fuel', 'Price', 'Unit', 'Currency', 'Effective From', 'Created'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prices.map(p => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2"><Badge value={p.fuel_type} /></td>
                  <td className="px-4 py-2 font-medium">{p.price_per_unit}</td>
                  <td className="px-4 py-2 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-2 text-gray-500">{p.currency}</td>
                  <td className="px-4 py-2">{p.effective_from}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {prices.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No fuel prices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {showCreate && (
        <Modal title="New Fuel Price" onClose={() => setShowCreate(false)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
              <select value={form.fuel_type} onChange={e => setForm(p => ({ ...p, fuel_type: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                <option value="octane">Octane</option>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit</label>
              <input type="number" required min="0.1" step="0.01" value={form.price_per_unit}
                onChange={e => setForm(p => ({ ...p, price_per_unit: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                <option value="liter">Liter</option>
                <option value="gallon">Gallon</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                {['BDT', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
              <input type="date" required value={form.effective_from}
                onChange={e => setForm(p => ({ ...p, effective_from: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
