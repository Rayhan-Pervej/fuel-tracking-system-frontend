'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

interface Transaction { _id: string; vehicle_id: string; pump_id: string; quantity: number; total_price: number; created_at: string; fuel_type?: string; unit?: string; currency?: string; vehicle_number?: string; pump_name?: string; }
interface Pump { _id: string; name: string; }
interface Vehicle { _id: string; vehicle_number: string; }
interface PumpAssignment { pump_id: string; user_id: string; role: string; }

type Filters = { vehicle_number: string; pump_id: string; fuel_type: string; from: string; to: string; _ready: boolean };

export default function TransactionsPage() {
  const { isAdmin, isEmployee } = useAuth();
  const [filters, setFilters] = useState<Filters>({ vehicle_number: '', pump_id: '', fuel_type: '', from: '', to: '', _ready: false });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', pump_id: '', fuel_type: 'octane', quantity: '', totalPrice: '' });
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleResults, setVehicleResults] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState<number | null>(null);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const myPumpsRef = useRef<PumpAssignment[]>([]);
  const [pumpsReady, setPumpsReady] = useState(isAdmin);

  // When pumpsReady flips true, update applied so useCursorList re-fetches
  useEffect(() => {
    if (pumpsReady) {
      setFilters(p => ({ ...p, _ready: true }));
    }
  }, [pumpsReady]);

  useEffect(() => {
    if (isAdmin) {
      apiFetch<{ data: { pumps: Pump[] } }>('/api/pumps/?limit=100')
        .then(r => { setPumps(r.data.pumps); setPumpsReady(true); }).catch(() => setPumpsReady(true));
    } else {
      // Employee: fetch assigned pumps, then resolve each pump's name
      apiFetch<{ data: { pumps: PumpAssignment[] } }>('/api/pumps/me/pumps')
        .then(async r => {
          myPumpsRef.current = r.data.pumps;

          // resolve pump names
          const resolved = await Promise.all(
            r.data.pumps.map(p =>
              apiFetch<{ data: { pump: { _id: string; name: string } } }>(`/api/pumps/${p.pump_id}`)
                .then(res => ({ _id: p.pump_id, name: res.data.pump.name }))
                .catch(() => ({ _id: p.pump_id, name: p.pump_id }))
            )
          );
          setPumps(resolved);
          if (r.data.pumps.length > 0) {
            setForm(prev => ({ ...prev, pump_id: r.data.pumps[0].pump_id }));
          }
          setPumpsReady(true);
        }).catch(() => setPumpsReady(true));
    }
  }, [isAdmin, isEmployee]);

  const fetcher = useCallback(async (cursor: string | null, f: Filters) => {
    if (!f._ready) return { items: [], pagination: { next_cursor: null, has_more: false, limit: 15 } };
    if (isAdmin) {
      const q = buildQuery({ cursor, limit: 15, vehicle_number: f.vehicle_number || undefined, pump_id: f.pump_id || undefined, fuel_type: f.fuel_type || undefined, from: f.from || undefined, to: f.to || undefined });
      const res = await apiFetch<{ data: { transactions: Transaction[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/transactions/${q}`);
      return { items: res.data.transactions, pagination: res.data.pagination };
    } else {
      const pumpId = f.pump_id || myPumpsRef.current[0]?.pump_id;
      if (!pumpId) return { items: [], pagination: { next_cursor: null, has_more: false, limit: 15 } };
      const q = buildQuery({ cursor, limit: 15, fuel_type: f.fuel_type || undefined, from: f.from || undefined, to: f.to || undefined });
      const res = await apiFetch<{ data: { transactions: Transaction[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/transactions/pump/${pumpId}${q}`);
      return { items: res.data.transactions, pagination: res.data.pagination };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const { items: txns, hasMore, loading, error, loadMore, refresh } = useCursorList<Transaction, Filters>({
    fetcher, filters,
  });

  const clearFilters = () => setFilters({ vehicle_number: '', pump_id: '', fuel_type: '', from: '', to: '', _ready: pumpsReady });

  const fetchPrice = async (fuelType: string) => {
    setPricePerUnit(null);
    try {
      const res = await apiFetch<{ data: { fuel_price: { price_per_unit: number; unit: string; currency: string } } }>(`/api/fuel-prices/latest/${fuelType}`);
      setPricePerUnit(res.data.fuel_price.price_per_unit);
    } catch { setPricePerUnit(null); }
  };

  const searchVehicles = async (q: string) => {
    setVehicleSearch(q);
    if (q.length < 2) { setVehicleResults([]); return; }
    try {
      const res = await apiFetch<{ data: { vehicles: Vehicle[] } }>(`/api/vehicles/search?q=${encodeURIComponent(q)}&limit=10`);
      setVehicleResults(res.data.vehicles);
    } catch { setVehicleResults([]); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch('/api/transactions/', { method: 'POST', body: JSON.stringify({ vehicle_id: form.vehicle_id, pump_id: form.pump_id, fuel_type: form.fuel_type, quantity: parseFloat(form.quantity), total_price: parseFloat(form.totalPrice) }) });
      setShowCreate(false); setForm({ vehicle_id: '', pump_id: isEmployee && pumps[0] ? pumps[0]._id : '', fuel_type: 'octane', quantity: '', totalPrice: '' }); setVehicleSearch(''); setVehicleResults([]); setSelectedVehicle(null); setPricePerUnit(null); refresh();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  if (!isAdmin && !isEmployee) return <p className="text-gray-500 text-sm">Access denied.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <button onClick={() => { setShowCreate(true); setFormError(''); fetchPrice(form.fuel_type); }}
          className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">+ New Transaction</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        {isAdmin && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vehicle</label>
            <input type="text" placeholder="Search vehicle number…" value={filters.vehicle_number}
              onChange={e => setFilters(p => ({ ...p, vehicle_number: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pump</label>
          <select value={filters.pump_id} onChange={e => setFilters(p => ({ ...p, pump_id: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44">
            <option value="">All pumps</option>
            {pumps.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fuel Type</label>
          <select value={filters.fuel_type} onChange={e => setFilters(p => ({ ...p, fuel_type: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none">
            <option value="">All types</option>
            <option value="octane">Octane</option>
            <option value="diesel">Diesel</option>
            <option value="petrol">Petrol</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none" />
        </div>
        {(filters.vehicle_number || filters.pump_id || filters.fuel_type || filters.from || filters.to) && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-800 mb-1.5">Clear</button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Vehicle', 'Pump', 'Fuel', 'Qty', 'Total', 'Date'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txns.map(t => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{t.vehicle_number ?? t.vehicle_id}</td>
                  <td className="px-4 py-2">{t.pump_name ?? t.pump_id}</td>
                  <td className="px-4 py-2">{t.fuel_type ? <Badge value={t.fuel_type} /> : '—'}</td>
                  <td className="px-4 py-2">{t.quantity} {t.unit ?? ''}</td>
                  <td className="px-4 py-2">{t.currency ?? ''} {t.total_price.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {txns.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {showCreate && (
        <Modal title="New Transaction" onClose={() => { setShowCreate(false); setVehicleSearch(''); setVehicleResults([]); setSelectedVehicle(null); setPricePerUnit(null); }}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              {form.vehicle_id ? (
                <div className="flex items-center gap-2 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50">
                  <span className="flex-1 font-mono">{selectedVehicle?.vehicle_number ?? form.vehicle_id}</span>
                  <button type="button" onClick={() => { setForm(p => ({ ...p, vehicle_id: '' })); setSelectedVehicle(null); setVehicleSearch(''); setVehicleResults([]); }}
                    className="text-gray-400 hover:text-gray-700 text-xs">✕ Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" placeholder="Search by vehicle number…" value={vehicleSearch}
                    onChange={e => searchVehicles(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
                  {vehicleResults.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow mt-1 max-h-40 overflow-y-auto">
                      {vehicleResults.map(v => (
                        <li key={v._id}>
                          <button type="button" onClick={() => { setForm(p => ({ ...p, vehicle_id: v._id })); setSelectedVehicle(v); setVehicleResults([]); setVehicleSearch(''); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 font-mono">{v.vehicle_number}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {vehicleSearch.length >= 1 && vehicleResults.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">No vehicles found</p>
                  )}
                </div>
              )}
              {/* hidden required field trick */}
              <input type="text" required value={form.vehicle_id} onChange={() => {}} className="sr-only" tabIndex={-1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pump</label>
              {pumps.length === 1 ? (
                // Single assigned pump — just show it, no dropdown needed
                <div className="border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-700">{pumps[0].name}</div>
              ) : (
                <select required value={form.pump_id} onChange={e => setForm(p => ({ ...p, pump_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select pump…</option>
                  {pumps.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
              <select value={form.fuel_type} onChange={e => { setForm(p => ({ ...p, fuel_type: e.target.value, quantity: '', totalPrice: '' })); fetchPrice(e.target.value); }}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                <option value="octane">Octane</option>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
              </select>
              {pricePerUnit !== null && (
                <p className="text-xs text-gray-500 mt-1">Rate: BDT {pricePerUnit.toLocaleString()} / liter</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" required min="0.1" step="0.1" value={form.quantity}
                  onChange={e => {
                    const qty = e.target.value;
                    const total = pricePerUnit && qty ? (pricePerUnit * parseFloat(qty)).toFixed(2) : '';
                    setForm(p => ({ ...p, quantity: qty, totalPrice: total }));
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
                <input type="number" required min="0.1" step="0.01" value={form.totalPrice}
                  onChange={e => {
                    const total = e.target.value;
                    const qty = pricePerUnit && total ? (parseFloat(total) / pricePerUnit).toFixed(2) : '';
                    setForm(p => ({ ...p, totalPrice: total, quantity: qty }));
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Recording…' : 'Record Transaction'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
