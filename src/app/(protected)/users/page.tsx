'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, buildQuery } from '@/lib/api';
import { clearAuth } from '@/lib/auth';
import { useCursorList } from '@/hooks/useCursorList';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

interface User { _id: string; name: string; email: string; role: string; license: string; created_at: string; }

export default function UsersPage() {
  const { isAdmin, user, logout } = useAuth();
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', license: '' });
  const [editForm, setEditForm] = useState({ name: '', license: '', role: 'employee' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [roleNotice, setRoleNotice] = useState('');

  const fetcher = useCallback(async (cursor: string | null, filters: { role: string; email: string }) => {
    const q = buildQuery({ cursor, limit: 15, role: filters.role || undefined, email: filters.email || undefined });
    const res = await apiFetch<{ data: { users: User[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/users/${q}`);
    return { items: res.data.users, pagination: res.data.pagination };
  }, []);

  const { items: users, hasMore, loading, error, loadMore, refresh } = useCursorList<User, { role: string; email: string }>({
    fetcher, filters: { role: roleFilter, email: emailFilter },
  });

  if (!isAdmin) return <p className="text-gray-500 text-sm">Access denied.</p>;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    try {
      await apiFetch('/api/users/', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false); setForm({ name: '', email: '', password: '', role: 'employee', license: '' }); refresh();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError('');
    const roleChanged = editForm.role !== editUser!.role;
    const isSelf = editUser!._id === user?.id;
    try {
      await apiFetch(`/api/users/${editUser!._id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditUser(null); refresh();
      if (roleChanged) {
        if (isSelf) {
          // Own role changed — JWT is stale, must re-login
          clearAuth();
          router.replace('/login');
        } else {
          setRoleNotice(`Role updated. That user must log out and log back in for the change to take effect.`);
        }
      }
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user? This will also delete their vehicles and pump assignments.')) return;
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      refresh();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Users</h1>
        <button onClick={() => setShowCreate(true)} className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">+ New User</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="employee">Employee</option>
          <option value="customer">Customer</option>
        </select>
        <input type="text" placeholder="Search by email…" value={emailFilter}
          onChange={e => setEmailFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-52" />
        {(roleFilter || emailFilter) && (
          <button onClick={() => { setRoleFilter(''); setEmailFilter(''); }} className="text-sm text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>

      {roleNotice && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-700">
          <span className="flex-1">{roleNotice}</span>
          <button onClick={() => setRoleNotice('')} className="text-amber-500 hover:text-amber-800 text-xs">✕</button>
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Name', 'Email', 'Role', 'License', 'Created'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}<th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2"><Badge value={u.role} /></td>
                  <td className="px-4 py-2 font-mono text-xs">{u.license}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 flex gap-3">
                    <button onClick={() => { setEditUser(u); setEditForm({ name: u.name, license: u.license, role: u.role }); setFormError(''); setRoleNotice(''); }}
                      className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(u._id)}
                      className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create User" onClose={() => { setShowCreate(false); setFormError(''); }}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <form onSubmit={handleCreate} className="space-y-3">
            {[{l:'Name',k:'name',t:'text',min:2,max:100},{l:'Email',k:'email',t:'email'},{l:'Password',k:'password',t:'password',min:8},{l:'License',k:'license',t:'text',min:3,max:10}].map(f => (
              <div key={f.k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.l}</label>
                <input type={f.t} required value={form[f.k as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                  minLength={f.min} maxLength={f.max}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editUser && (
        <Modal title="Edit User" onClose={() => { setEditUser(null); setFormError(''); }}>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2 truncate">{editUser.email}</p>
          </div>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                minLength={2} maxLength={100}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License</label>
              <input type="text" value={editForm.license} onChange={e => setEditForm(p => ({ ...p, license: e.target.value }))}
                minLength={3} maxLength={10}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="customer">Customer</option>
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
