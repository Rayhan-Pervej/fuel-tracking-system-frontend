'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

export interface DashboardStats {
  total_transactions: number;
  total_fuel_dispensed: number;
  total_revenue: number;
}

export interface LiveTransaction {
  _id: string;
  vehicle_id: string;
  pump_id: string;
  fuel_price_id: string;
  quantity: number;
  total_price: number;
  created_at: string;
  fuel_type: string;
  unit: string;
  currency: string;
  vehicle_number: string;
  pump_name: string;
}

const MAX_LIVE = 100;

export function useSocket(token: string | null) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<LiveTransaction[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);

    const onConnect = () => {
      setConnected(true);
      // init fires automatically on fresh connect — no need to request it
    };
    const onDisconnect = () => setConnected(false);
    const onInit = (data: { stats: DashboardStats; transactions: LiveTransaction[] }) => {
      setStats(data.stats);
      setTransactions(data.transactions.slice(0, MAX_LIVE));
    };
    const onNewTransaction = (data: { transaction: LiveTransaction; stats: DashboardStats }) => {
      setStats(data.stats);
      setTransactions(prev => [data.transaction, ...prev].slice(0, MAX_LIVE));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('init', onInit);
    socket.on('new_transaction', onNewTransaction);

    if (socket.connected) {
      // Already connected from a previous page — request fresh data
      setConnected(true);
      socket.emit('request_init');
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('init', onInit);
      socket.off('new_transaction', onNewTransaction);
      // Do NOT disconnect — keep socket alive across pages
    };
  }, [token]);

  return { stats, transactions, connected };
}
