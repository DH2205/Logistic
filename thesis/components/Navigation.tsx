'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const Navigation = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Only render auth-dependent content after mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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
            <Link href="/shipments" className="text-gray-700 hover:text-red-600">
              Shipments
            </Link>
            <Link href="/database" className="text-gray-700 hover:text-red-600">
              Database
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
