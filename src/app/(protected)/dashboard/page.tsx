'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';

export default function DashboardPage() {
  const { accessToken, user, isLoading, canAccessDashboard } = useAuth();
  const router = useRouter();
  const { stats, transactions, connected } = useSocket(canAccessDashboard ? accessToken : null);
  const [fuelFilter, setFuelFilter] = useState('');
  const [pumpFilter, setPumpFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');

  useEffect(() => {
    if (!isLoading && user && !canAccessDashboard) {
      router.replace('/transactions');
    }
  }, [isLoading, user, canAccessDashboard, router]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">Loading…</div>;
  }

  if (!canAccessDashboard) return null;

  const fuelTotals = stats?.fuel_type_totals;

  const filtered = transactions.filter(t => {
    if (fuelFilter && t.fuel_type !== fuelFilter) return false;
    if (pumpFilter && !t.pump_name.toLowerCase().includes(pumpFilter.toLowerCase())) return false;
    if (vehicleFilter && !t.vehicle_number.toLowerCase().includes(vehicleFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {connected ? '● Live' : '○ Connecting…'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Transactions" value={stats?.total_transactions ?? '—'} />
        <StatCard label="Total Fuel Dispensed" value={stats ? `${stats.total_fuel_dispensed.toFixed(1)} L` : '—'} />
        <StatCard label="Total Revenue" value={stats ? `BDT ${stats.total_revenue.toLocaleString()}` : '—'} />
        <StatCard tone="octane" label="Octane Dispensed" value={typeof fuelTotals?.octane === 'number' ? `${fuelTotals.octane.toFixed(1)} L` : '—'} />
        <StatCard tone="diesel" label="Diesel Dispensed" value={typeof fuelTotals?.diesel === 'number' ? `${fuelTotals.diesel.toFixed(1)} L` : '—'} />
        <StatCard tone="petrol" label="Petrol Dispensed" value={typeof fuelTotals?.petrol === 'number' ? `${fuelTotals.petrol.toFixed(1)} L` : '—'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input placeholder="Filter by vehicle…" value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        <input placeholder="Filter by pump name…" value={pumpFilter} onChange={e => setPumpFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
        <select value={fuelFilter} onChange={e => setFuelFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none">
          <option value="">All fuel types</option>
          <option value="octane">Octane</option>
          <option value="diesel">Diesel</option>
          <option value="petrol">Petrol</option>
        </select>
        {(fuelFilter || pumpFilter || vehicleFilter) && (
          <button onClick={() => { setFuelFilter(''); setPumpFilter(''); setVehicleFilter(''); }}
            className="text-sm text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>

      {/* Live feed */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-700">
          Live Transactions {filtered.length > 0 && <span className="text-gray-400 font-normal">({filtered.length})</span>}
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {['Vehicle', 'Pump', 'Fuel', 'Qty', 'Total', 'Time'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{t.vehicle_number}</td>
                    <td className="px-4 py-2">{t.pump_name}</td>
                    <td className="px-4 py-2"><Badge value={t.fuel_type} /></td>
                    <td className="px-4 py-2">{Number(t.quantity).toFixed(2)} {t.unit}</td>
                    <td className="px-4 py-2">{t.currency} {Number(t.total_price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-gray-400">{new Date(t.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
