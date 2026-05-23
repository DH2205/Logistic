'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roles';

export default function DatabasePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const r = normalizeRole(user.role);
    if (r !== 'staff' && r !== 'admin') {
      router.replace('/orders');
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
      </div>
    );
  }

  if (normalizeRole(user.role) !== 'staff' && normalizeRole(user.role) !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Database View</h1>

      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="text-6xl mb-4">💾</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Raw Database Access</h2>
        <p className="text-gray-600 mb-6">
          View and export your database contents
        </p>
        <p className="text-sm text-gray-500">
          This feature allows you to view the raw JSON database for debugging purposes.
        </p>
      </div>
    </div>
  );
}
