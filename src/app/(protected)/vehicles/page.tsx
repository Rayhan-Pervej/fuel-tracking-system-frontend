'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Link from 'next/link';

interface Vehicle { _id: string; user_id: string; vehicle_number: string; vehicle_type: string; created_at: string; }

export default function VehiclesPage() {
  const { user, isAdmin } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ user_id: '', vehicle_number: '', vehicle_type: 'car' });
  const [editForm, setEditForm] = useState({ vehicle_number: '', vehicle_type: 'car' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetcher = useCallback(async (cursor: string | null, filters: { type: string; search: string; user_email: string }) => {
    let url: string;
    if (isAdmin) {
      const q = buildQuery({ cursor, limit: 15, type: filters.type || undefined, search: filters.search || undefined, user_email: filters.user_email || undefined });
      url = `/api/vehicles/${q}`;
    } else {
      const q = buildQuery({ cursor, limit: 15, search: filters.search || undefined });
      url = `/api/vehicles/user/${user!.id}${q}`;
    }
    const res = await apiFetch<{ data: { vehicles: Vehicle[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(url);
    return { items: res.data.vehicles, pagination: res.data.pagination };
  }, [isAdmin, user]);

  const { items: vehicles, hasMore, loading, error, loadMore, refresh } = useCursorList<Vehicle, { type: string; search: string; user_email: string }>({
    fetcher, filters: { type: typeFilter, search: searchFilter, user_email: emailFilter },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch('/api/vehicles/', { method: 'POST', body: JSON.stringify({ ...form, user_id: user!.id }) });
      setShowCreate(false); setForm({ user_id: '', vehicle_number: '', vehicle_type: 'car' }); refresh();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch(`/api/vehicles/${editVehicle!._id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditVehicle(null); refresh();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await apiFetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
      refresh();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Vehicles</h1>
        <button onClick={() => { setShowCreate(true); setFormError(''); }}
          className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">+ Add Vehicle</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Search vehicle number…" value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        {isAdmin && (<>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none">
            <option value="">All types</option>
            {['car', 'truck', 'bike', 'bus'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" placeholder="Filter by owner email…" value={emailFilter}
            onChange={e => setEmailFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-52" />
        </>)}
        {(searchFilter || typeFilter || emailFilter) && (
          <button onClick={() => { setSearchFilter(''); setTypeFilter(''); setEmailFilter(''); }} className="text-sm text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Number', 'Type', 'Created', ''].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v => (
                <tr key={v._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium">{v.vehicle_number}</td>
                  <td className="px-4 py-2"><Badge value={v.vehicle_type} /></td>
                  <td className="px-4 py-2 text-gray-400">{new Date(v.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 flex gap-3">
                    <Link href={`/vehicles/${v._id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                    <button onClick={() => { setEditVehicle(v); setEditForm({ vehicle_number: v.vehicle_number, vehicle_type: v.vehicle_type }); setFormError(''); }}
                      className="text-xs text-gray-500 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(v._id)}
                      className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && !loading && (
                <tr><td colSpan={4} className="text-center text-gray-400 py-8">No vehicles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Vehicle" onClose={() => setShowCreate(false)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input type="text" required value={form.vehicle_number} onChange={e => setForm(p => ({ ...p, vehicle_number: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.vehicle_type} onChange={e => setForm(p => ({ ...p, vehicle_type: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                {['car', 'truck', 'bike', 'bus'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Vehicle'}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editVehicle && (
        <Modal title="Edit Vehicle" onClose={() => setEditVehicle(null)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input type="text" value={editForm.vehicle_number} onChange={e => setEditForm(p => ({ ...p, vehicle_number: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={editForm.vehicle_type} onChange={e => setEditForm(p => ({ ...p, vehicle_type: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                {['car', 'truck', 'bike', 'bus'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
