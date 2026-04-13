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

type Filters = { vehicle_number: string; pump_name: string; fuel_type: string; from: string; to: string; _ready: boolean };

export default function TransactionsPage() {
  const { isAdmin, isEmployee } = useAuth();
  const [filters, setFilters] = useState<Filters>({ vehicle_number: '', pump_name: '', fuel_type: '', from: '', to: '', _ready: false });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ vehicle_number: '', pump_id: '', fuel_type: 'octane', quantity: '', totalPrice: '' });
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleResults, setVehicleResults] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleHistory, setVehicleHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState<number | null>(null);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const myPumpsRef = useRef<PumpAssignment[]>([]);
  const vehicleSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pumpsReady, setPumpsReady] = useState(isAdmin);

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
      apiFetch<{ data: { pump?: PumpAssignment | null; assignment?: PumpAssignment | null; pumps?: PumpAssignment[] } }>('/api/pumps/me/pump')
        .then(async r => {
          const assignment = r.data.pump ?? r.data.assignment ?? r.data.pumps?.[0] ?? null;
          const assignments = assignment ? [assignment] : [];
          myPumpsRef.current = assignments;
          const resolved = await Promise.all(
            assignments.map(p =>
              apiFetch<{ data: { pump: { _id: string; name: string } } }>(`/api/pumps/${p.pump_id}`)
                .then(res => ({ _id: p.pump_id, name: res.data.pump.name }))
                .catch(() => ({ _id: p.pump_id, name: p.pump_id }))
            )
          );
          setPumps(resolved);
          if (assignments.length > 0) {
            setForm(prev => ({ ...prev, pump_id: assignments[0].pump_id }));
          }
          setPumpsReady(true);
        }).catch(() => setPumpsReady(true));
    }
  }, [isAdmin, isEmployee]);

  const fetcher = useCallback(async (cursor: string | null, f: Filters) => {
    if (!f._ready) return { items: [], pagination: { next_cursor: null, has_more: false, limit: 15 } };
    if (isAdmin) {
      const q = buildQuery({ cursor, limit: 15, vehicle_number: f.vehicle_number || undefined, pump_name: f.pump_name || undefined, fuel_type: f.fuel_type || undefined, from: f.from || undefined, to: f.to || undefined });
      const res = await apiFetch<{ data: { transactions: Transaction[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/transactions/${q}`);
      return { items: res.data.transactions, pagination: res.data.pagination };
    } else {
      const pumpId = f.pump_name
        ? pumps.find(p => p.name === f.pump_name)?._id ?? myPumpsRef.current[0]?.pump_id
        : myPumpsRef.current[0]?.pump_id;
      if (!pumpId) return { items: [], pagination: { next_cursor: null, has_more: false, limit: 15 } };
      const q = buildQuery({ cursor, limit: 15, fuel_type: f.fuel_type || undefined, from: f.from || undefined, to: f.to || undefined });
      const res = await apiFetch<{ data: { transactions: Transaction[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/transactions/pump/${pumpId}${q}`);
      return { items: res.data.transactions, pagination: res.data.pagination };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, pumps]);

  const { items: txns, hasMore, loading, error, loadMore, refresh } = useCursorList<Transaction, Filters>({
    fetcher, filters,
  });

  const clearFilters = () => setFilters({ vehicle_number: '', pump_name: '', fuel_type: '', from: '', to: '', _ready: pumpsReady });

  const fetchPrice = async (fuelType: string) => {
    setPricePerUnit(null);
    try {
      const res = await apiFetch<{ data: { fuel_price: { price_per_unit: number; unit: string; currency: string } } }>(`/api/fuel-prices/latest/${fuelType}`);
      setPricePerUnit(res.data.fuel_price.price_per_unit);
    } catch { setPricePerUnit(null); }
  };

  const fetchVehicleHistory = async (vehicleId: string) => {
    setHistoryLoading(true);
    setVehicleHistory([]);
    try {
      const res = await apiFetch<{ data: { transactions: Transaction[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/transactions/vehicle/${vehicleId}?limit=5`);
      setVehicleHistory(res.data.transactions);
    } catch { setVehicleHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const calcTotal = (qty: string) => {
    if (pricePerUnit === null || !qty) return '';
    const n = parseFloat(qty);
    if (!Number.isFinite(n)) return '';
    return (n * pricePerUnit).toFixed(2);
  };

  const searchVehicles = async (q: string) => {
    setVehicleSearch(q);
    setForm(p => ({ ...p, vehicle_number: q }));
    setSelectedVehicleId(null);
    setVehicleHistory([]);
    if (vehicleSearchDebounceRef.current) {
      clearTimeout(vehicleSearchDebounceRef.current);
      vehicleSearchDebounceRef.current = null;
    }
    if (q.length < 2) { setVehicleResults([]); return; }

    vehicleSearchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: { vehicles: Vehicle[] } }>(`/api/vehicles/search?q=${encodeURIComponent(q)}&limit=10`);
        setVehicleResults(res.data.vehicles);
      } catch {
        setVehicleResults([]);
      }
    }, 400);
  };

  useEffect(() => () => {
    if (vehicleSearchDebounceRef.current) {
      clearTimeout(vehicleSearchDebounceRef.current);
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch('/api/transactions/', { method: 'POST', body: JSON.stringify({ vehicle_number: form.vehicle_number, pump_id: form.pump_id, fuel_type: form.fuel_type, quantity: parseFloat(form.quantity), total_price: parseFloat(form.totalPrice) }) });
      setShowCreate(false);
      setForm({ vehicle_number: '', pump_id: isEmployee && pumps[0] ? pumps[0]._id : '', fuel_type: 'octane', quantity: '', totalPrice: '' });
      setVehicleSearch(''); setVehicleResults([]); setPricePerUnit(null); setSelectedVehicleId(null); setVehicleHistory([]); refresh();
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
          {isAdmin ? (
            <input type="text" placeholder="Search pump name…" value={filters.pump_name}
              onChange={e => setFilters(p => ({ ...p, pump_name: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
          ) : (
            <select value={filters.pump_name} onChange={e => setFilters(p => ({ ...p, pump_name: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44">
              <option value="">All pumps</option>
              {pumps.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
            </select>
          )}
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
        {(filters.vehicle_number || filters.pump_name || filters.fuel_type || filters.from || filters.to) && (
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
        <Modal title="New Transaction" wide={!!selectedVehicleId} onClose={() => { setShowCreate(false); setVehicleSearch(''); setVehicleResults([]); setPricePerUnit(null); setSelectedVehicleId(null); setVehicleHistory([]); }}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <div className="flex gap-0">
            {/* Form */}
            <form onSubmit={handleCreate} className={`space-y-3 ${selectedVehicleId ? 'flex-1 min-w-0 pr-5' : 'w-full'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                <div className="relative">
                  <input type="text" required placeholder="Type vehicle number…" value={vehicleSearch}
                    onChange={e => searchVehicles(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
                  {vehicleResults.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow mt-1 max-h-40 overflow-y-auto">
                      {vehicleResults.map(v => (
                        <li key={v._id}>
                          <button type="button" onClick={() => { setForm(p => ({ ...p, vehicle_number: v.vehicle_number })); setVehicleSearch(v.vehicle_number); setVehicleResults([]); setSelectedVehicleId(v._id); fetchVehicleHistory(v._id); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 font-mono">{v.vehicle_number}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pump</label>
                {pumps.length === 1 ? (
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
                  <input type="number" required min="0.1" step="0.01" value={form.quantity}
                    onChange={e => {
                      const qty = e.target.value;
                      const total = calcTotal(qty);
                      setForm(p => ({ ...p, quantity: qty, totalPrice: total }));
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
                  <input type="number" required min="0.01" step="0.01" value={form.totalPrice} readOnly
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none bg-gray-50 text-gray-600" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
                {submitting ? 'Recording…' : 'Record Transaction'}
              </button>
            </form>

            {/* History panel */}
            {selectedVehicleId && (
              <div className="w-56 shrink-0 border-l border-gray-200 pl-5 flex flex-col">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Recent Activity</p>
                {historyLoading ? (
                  <p className="text-xs text-gray-400">Loading…</p>
                ) : vehicleHistory.length === 0 ? (
                  <p className="text-xs text-gray-400">No previous transactions</p>
                ) : (
                  <>
                    <ul className="space-y-3 flex-1">
                      {vehicleHistory.map(t => (
                        <li key={t._id} className="text-xs border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="capitalize font-medium text-gray-700">{t.fuel_type ?? '—'}</span>
                            <span className="text-gray-400">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="text-gray-600">{t.quantity} {t.unit ?? 'L'}</div>
                          {t.pump_name && <div className="text-gray-400 truncate mt-0.5">{t.pump_name}</div>}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-400">Total fuel (last {vehicleHistory.length})</p>
                      <p className="text-sm font-semibold text-gray-800">{vehicleHistory.reduce((s, t) => s + t.quantity, 0).toFixed(2)} L</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
