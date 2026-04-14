'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';

interface Vehicle { _id: string; vehicle_number: string; created_at: string; }

export default function VehiclesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [searchFilter, setSearchFilter] = useState('');
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState({ vehicle_number: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetcher = useCallback(async (cursor: string | null, filters: { search: string }) => {
    const q = buildQuery({ cursor, limit: 15, search: filters.search || undefined });
    const res = await apiFetch<{ data: { vehicles: Vehicle[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/vehicles/${q}`);
    return { items: res.data.vehicles, pagination: res.data.pagination };
  }, []);

  const { items: vehicles, hasMore, loading, error, loadMore, refresh } = useCursorList<Vehicle, { search: string }>({
    fetcher, filters: { search: searchFilter },
  });

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch(`/api/vehicles/${editVehicle!._id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditVehicle(null); refresh();
      toast('Vehicle updated');
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await apiFetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
      refresh(); toast('Vehicle deleted');
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  if (!isAdmin) return <p className="text-gray-500 text-sm">Access denied.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Vehicles</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Search vehicle number…" value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        {searchFilter && (
          <button onClick={() => setSearchFilter('')} className="text-sm text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Number', 'Created', ''].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v => (
                <tr key={v._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium">{v.vehicle_number}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(v.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 flex gap-3">
                    <button onClick={() => { setEditVehicle(v); setEditForm({ vehicle_number: v.vehicle_number }); setFormError(''); }}
                      className="text-xs text-gray-500 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(v._id)}
                      className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && !loading && (
                <tr><td colSpan={3} className="text-center text-gray-400 py-8">No vehicles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {editVehicle && (
        <Modal title="Edit Vehicle" onClose={() => setEditVehicle(null)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input type="text" required value={editForm.vehicle_number} onChange={e => setEditForm({ vehicle_number: e.target.value })}
                minLength={2} maxLength={10}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
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
