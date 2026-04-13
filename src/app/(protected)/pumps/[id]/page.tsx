'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

interface Pump { _id: string; name: string; location: string; license: string; }
interface PumpEmployee { _id: string; user_id: string; role: string; added_by: string; created_at: string; }
interface UserInfo { name: string; email: string; }
type AddMode = 'existing' | 'new';

export default function PumpDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isEmployee, user } = useAuth();
  // pump_admin of THIS pump (pump-scoped role check is server-enforced; track locally for UI hints)
  const isPumpAdmin = (employees: PumpEmployee[]) =>
    !isAdmin && employees.some(e => e.user_id === user?.id && e.role === 'pump_admin');
  const hasPumpAdmin = (employees: PumpEmployee[]) =>
    employees.some(e => e.role === 'pump_admin');
  const [pump, setPump] = useState<Pump | null>(null);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ mode: 'existing' as AddMode, name: '', email: '', password: '', role: 'employee' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    apiFetch<{ data: { pump: Pump } }>(`/api/pumps/${id}`)
      .then(r => setPump(r.data.pump))
      .catch(() => { });
  }, [id]);

  const fetcher = useCallback(async (cursor: string | null) => {
    const q = buildQuery({ cursor, limit: 15 });
    const res = await apiFetch<{ data: { employees: PumpEmployee[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/pumps/${id}/employees${q}`);
    return { items: res.data.employees, pagination: res.data.pagination };
  }, [id]);

  const { items: employees, hasMore, loading, loadMore, refresh } = useCursorList<PumpEmployee, object>({ fetcher, filters: {} });

  // Fetch user info for any employees not yet in userMap
  useEffect(() => {
    const missing = employees.filter(e => !userMap[e.user_id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(e =>
        apiFetch<{ data: { user: { _id: string; name: string; email: string } } }>(`/api/users/${e.user_id}`)
          .then(r => ({ id: e.user_id, name: r.data.user.name, email: r.data.user.email }))
          .catch(() => ({ id: e.user_id, name: e.user_id, email: '' }))
      )
    ).then(results => {
      setUserMap(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.id] = { name: r.name, email: r.email }; });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      const payload = addForm.mode === 'existing'
        ? { mode: 'existing', email: addForm.email, role: addForm.role }
        : { mode: 'new', name: addForm.name, email: addForm.email, password: addForm.password, role: addForm.role };

      await apiFetch(`/api/pumps/${id}/employees`, { method: 'POST', body: JSON.stringify(payload) });
      setShowAdd(false);
      setAddForm({ mode: 'existing', name: '', email: '', password: '', role: 'employee' });
      refresh();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this employee?')) return;
    try {
      await apiFetch(`/api/pumps/${id}/employees/${userId}`, { method: 'DELETE' });
      refresh();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/api/pumps/${id}/employees/${userId}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      refresh();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  if (!isAdmin && !isEmployee) return <p className="text-gray-500 text-sm">Access denied.</p>;

  if (!pump) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{pump.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{pump.location} · <span className="font-mono">{pump.license}</span></p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium">Employees</h2>
        {(isAdmin || isPumpAdmin(employees)) && (
          <button onClick={() => {
            setShowAdd(true);
            setFormError('');
            setAddForm({ mode: 'existing', name: '', email: '', password: '', role: 'employee' });
          }}
            className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700">+ Add Employee</button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Employee', 'Pump Role', 'Added', (isAdmin || isPumpAdmin(employees)) ? 'Actions' : ''].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map(emp => (
                <tr key={emp._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <p className="font-medium text-sm">{userMap[emp.user_id]?.name ?? '…'}</p>
                    <p className="text-xs text-gray-400">{userMap[emp.user_id]?.email ?? emp.user_id}</p>
                  </td>
                  <td className="px-4 py-2"><Badge value={emp.role} /></td>
                  <td className="px-4 py-2 text-gray-400">{new Date(emp.created_at).toLocaleDateString()}</td>
                  {(isAdmin || isPumpAdmin(employees)) && (
                    <td className="px-4 py-2 flex gap-2 items-center">
                      <select value={emp.role}
                        onChange={e => handleRoleChange(emp.user_id, e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none">
                        <option value="employee">employee</option>
                        {/* pump_admin can only assign pump_admin if none exists yet; admin can always */}
                        {(isAdmin || !hasPumpAdmin(employees) || emp.role === 'pump_admin') && (
                          <option value="pump_admin">pump_admin</option>
                        )}
                      </select>
                      {/* pump_admin cannot be removed directly — must reassign role first */}
                      {emp.role !== 'pump_admin' ? (
                        <button onClick={() => handleRemove(emp.user_id)}
                          className="text-xs text-red-500 hover:underline">Remove</button>
                      ) : (
                        <span className="text-xs text-gray-300" title="Reassign role before removing">Remove</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {employees.length === 0 && !loading && (
                <tr><td colSpan={(isAdmin || isPumpAdmin(employees)) ? 4 : 3} className="text-center text-gray-400 py-8">No employees assigned</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {showAdd && (
        <Modal title="Add Employee" onClose={() => setShowAdd(false)}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-100 p-1">
                <button type="button"
                  onClick={() => setAddForm(p => ({ ...p, mode: 'existing', name: '', email: '', password: '', role: 'employee' }))}
                  className={`rounded px-3 py-2 text-sm transition-colors ${addForm.mode === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                  Existing User
                </button>
                <button type="button"
                  onClick={() => setAddForm(p => ({ ...p, mode: 'new', name: '', email: '', password: '', role: 'employee' }))}
                  className={`rounded px-3 py-2 text-sm transition-colors ${addForm.mode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                  New User
                </button>
              </div>
            </div>
            {addForm.mode === 'new' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" required value={addForm.name}
                  onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Email</label>
              <input type="email" required value={addForm.email}
                onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            {addForm.mode === 'new' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required minLength={8} value={addForm.password}
                  onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                <option value="employee">employee</option>
                {/* in new mode, only global admin can create brand-new pump_admin */}
                {(isAdmin || addForm.mode === 'existing') && (isAdmin || !hasPumpAdmin(employees)) && (
                  <option value="pump_admin">pump_admin</option>
                )}
              </select>
            </div>
            {addForm.mode === 'new' && !isAdmin && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                In new mode, only admins can create a new user directly as pump admin.
              </p>
            )}
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
