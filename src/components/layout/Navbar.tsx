'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', roles: ['admin', 'employee', 'customer'] },
  { href: '/transactions', label: 'Transactions', roles: ['admin', 'employee'] },
  { href: '/vehicles', label: 'Vehicles', roles: ['admin', 'employee', 'customer'] },
  { href: '/pumps', label: 'Pumps', roles: ['admin', 'employee', 'customer'] },
  { href: '/fuel-prices', label: 'Fuel Prices', roles: ['admin', 'employee', 'customer'] },
  { href: '/users', label: 'Users', roles: ['admin'] },
];

export default function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading || !user) return null;

  const visibleLinks = navLinks.filter(l => l.roles.includes(user.role));

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-800 mr-4 text-sm">⛽ FuelTrack</span>
          {visibleLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{user.name}</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{user.role}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition-colors">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
