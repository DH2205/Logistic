'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole, normalizeApprovalStatus } from '@/lib/roles';
import { ordersAPI } from '@/lib/api';

const Navigation = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  // Only render auth-dependent content after mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    const role = normalizeRole(user.role);
    if (role !== 'staff' && role !== 'admin') {
      setPendingQueueCount(0);
      return;
    }

    let cancelled = false;
    const loadPending = async () => {
      try {
        const res = await ordersAPI.getAll();
        const raw = res.data;
        const orders = (Array.isArray(raw) ? raw : []) as { approvalStatus?: string }[];
        const n = orders.filter(
          (o) => normalizeApprovalStatus(o.approvalStatus) === 'pending_review'
        ).length;
        if (!cancelled) setPendingQueueCount(n);
      } catch {
        if (!cancelled) setPendingQueueCount(0);
      }
    };

    loadPending();
    const interval = setInterval(loadPending, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mounted, user, pathname]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">
            LogiShop
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/" className="text-gray-700 hover:text-red-600">
              Home
            </Link>

            {!mounted ? (
              // Render placeholder during SSR to match initial client render
              <div className="flex items-center gap-4">
                <div className="w-20 h-6"></div>
                <div className="w-24 h-10"></div>
              </div>
            ) : user ? (
              <>
                <Link href="/orders" className="text-gray-700 hover:text-red-600">
                  Orders
                </Link>
                {(normalizeRole(user.role) === 'staff' ||
                  normalizeRole(user.role) === 'admin') && (
                  <Link
                    href="/staff/orders"
                    className="relative inline-flex items-center gap-1.5 text-gray-700 hover:text-red-600"
                  >
                    <span className="relative inline-flex shrink-0">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                      {pendingQueueCount > 0 && (
                        <span
                          className="absolute -top-2 -right-2 min-h-[1.125rem] min-w-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white leading-none shadow-sm tabular-nums"
                          aria-label={`${pendingQueueCount} pending orders`}
                        >
                          {pendingQueueCount > 99 ? '99+' : pendingQueueCount}
                        </span>
                      )}
                    </span>
                    Queue
                  </Link>
                )}
                {normalizeRole(user.role) === 'admin' && (
                  <Link href="/admin" className="text-gray-700 hover:text-red-600">
                    Staff
                  </Link>
                )}
                <Link href="/settings/exchange-rates" className="text-gray-700 hover:text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  FX Rates
                </Link>
                <div className="flex items-center gap-4">
                  <span className="text-gray-700">Hello, {user.name}</span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-red-600"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
