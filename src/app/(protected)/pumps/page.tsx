'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import Link from 'next/link';

interface Pump { _id: string; name: string; location: string; license: string; created_at: string; }

export default function PumpsPage() {
  const { isAdmin, isEmployee } = useAuth();
  const toast = useToast();
  const [nameFilter, setNameFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editPump, setEditPump] = useState<Pump | null>(null);
  const [form, setForm] = useState({ name: '', location: '', license: '' });
  const [editForm, setEditForm] = useState({ name: '', location: '', license: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetcher = useCallback(async (cursor: string | null, filters: { name: string; location: string; license: string }) => {
    const q = buildQuery({
      cursor,
      limit: 15,
      name: filters.name || undefined,
      location: filters.location || undefined,
      license: filters.license || undefined,
    });
    const res = await apiFetch<{ data: { pumps: Pump[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/pumps/${q}`);
    return { items: res.data.pumps, pagination: res.data.pagination };
  }, []);

  const { items: pumps, hasMore, loading, error, loadMore, refresh } = useCursorList<Pump, { name: string; location: string; license: string }>({
    fetcher, filters: { name: nameFilter, location: locationFilter, license: licenseFilter },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch('/api/pumps/', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false); setForm({ name: '', location: '', license: '' }); refresh();
      toast('Pump created');
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch(`/api/pumps/${editPump!._id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditPump(null); refresh();
      toast('Pump updated');
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (pumpId: string) => {
    if (!confirm('Delete this pump? This will also remove all employee assignments.')) return;
    try {
      await apiFetch(`/api/pumps/${pumpId}`, { method: 'DELETE' });
      refresh(); toast('Pump deleted');
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Pumps</h1>
        {isAdmin && (
          <button onClick={() => { setShowCreate(true); setFormError(''); }}
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">+ New Pump</button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input placeholder="Filter by name…" value={nameFilter} onChange={e => setNameFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        <input placeholder="Filter by location…" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        <input placeholder="Filter by license…" value={licenseFilter} onChange={e => setLicenseFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        {(nameFilter || locationFilter || licenseFilter) && (
          <button onClick={() => { setNameFilter(''); setLocationFilter(''); setLicenseFilter(''); }} className="text-sm text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Name', 'Location', 'License', 'Created', ''].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pumps.map(p => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.location}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.license}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 flex gap-3">
                    {(isAdmin || isEmployee) && (
                      <Link href={`/pumps/${p._id}`} className="text-xs text-blue-600 hover:underline">Employees</Link>
                    )}
                    {isAdmin && (<>
                      <button onClick={() => { setEditPump(p); setEditForm({ name: p.name, location: p.location, license: p.license }); setFormError(''); }}
                        className="text-xs text-gray-500 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(p._id)}
                        className="text-xs text-red-500 hover:underline">Delete</button>
                    </>)}
                  </td>
                </tr>
              ))}
              {pumps.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">No pumps found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {showCreate && (
        <Modal title="Create Pump" onClose={() => setShowCreate(false)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleCreate} className="space-y-3">
            {[{ l: 'Name', k: 'name' }, { l: 'Location', k: 'location' }, { l: 'License', k: 'license' }].map(f => (
              <div key={f.k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.l}</label>
                <input type="text" required value={form[f.k as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
            ))}
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </form>
        </Modal>
      )}

      {editPump && (
        <Modal title="Edit Pump" onClose={() => setEditPump(null)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleEdit} className="space-y-3">
            {[{ l: 'Name', k: 'name' }, { l: 'Location', k: 'location' }, { l: 'License', k: 'license' }].map(f => (
              <div key={f.k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.l}</label>
                <input type="text" value={editForm[f.k as keyof typeof editForm]}
                  onChange={e => setEditForm(p => ({ ...p, [f.k]: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
            ))}
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
