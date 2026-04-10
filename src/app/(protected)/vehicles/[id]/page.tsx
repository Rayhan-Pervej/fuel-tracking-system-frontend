'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, buildQuery } from '@/lib/api';
import { useCursorList } from '@/hooks/useCursorList';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

interface Vehicle { _id: string; vehicle_number: string; vehicle_type: string; user_id: string; created_at: string; }
interface Transaction { _id: string; quantity: number; total_price: number; created_at: string; fuel_type?: string; pump_name?: string; }

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    apiFetch<{ data: { vehicle: Vehicle } }>(`/api/vehicles/${id}`)
      .then(r => setVehicle(r.data.vehicle))
      .catch(() => {});
  }, [id]);

  const fetcher = useCallback(async (cursor: string | null) => {
    const q = buildQuery({ cursor, limit: 15 });
    const res = await apiFetch<{ data: { transactions: Transaction[]; pagination: { next_cursor: string | null; has_more: boolean; limit: number } } }>(`/api/transactions/vehicle/${id}${q}`);
    return { items: res.data.transactions, pagination: res.data.pagination };
  }, [id]);

  const { items: txns, hasMore, loading, loadMore } = useCursorList<Transaction, object>({ fetcher, filters: {} });

  if (!vehicle) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold font-mono">{vehicle.vehicle_number}</h1>
        <div className="flex gap-2 mt-1 text-sm text-gray-500">
          <Badge value={vehicle.vehicle_type} />
          <span>Owner: {vehicle.user_id}</span>
          <span>· {new Date(vehicle.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <h2 className="text-base font-medium mb-3">Transactions</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>{['Pump', 'Fuel', 'Qty', 'Total', 'Date'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txns.map(t => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{t.pump_name ?? '—'}</td>
                  <td className="px-4 py-2">{t.fuel_type ? <Badge value={t.fuel_type} /> : '—'}</td>
                  <td className="px-4 py-2">{t.quantity}</td>
                  <td className="px-4 py-2">{t.total_price.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {txns.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">No transactions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination hasMore={hasMore} loading={loading} onLoadMore={loadMore} />
    </div>
  );
}
