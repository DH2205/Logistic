'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ExchangeRate {
  id: string;
  period: string;           // "2026-01"
  currency_from: string;    // "USD"
  currency_to: string;      // "VND"
  rate_per_usd: number;     // 26211
  source: string | null;
  updated_at: string;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May',     '06': 'June',     '07': 'July',  '08': 'August',
  '09': 'September','10': 'October', '11': 'November','12': 'December',
};

function periodLabel(period: string) {
  const [year, month] = period.split('-');
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}

export default function ExchangeRatesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // period being edited
  const [editValue, setEditValue] = useState('');
  const [editSource, setEditSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { router.push('/login'); return; }
    fetchRates();
  }, [mounted, user]);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/exchange-rates');
      const data = await res.json();
      setRates(data.rates ?? []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load exchange rates.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `Seeded ${data.inserted} rate(s) for Jan–May 2026.` });
        fetchRates();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Seed failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error during seed.' });
    } finally {
      setSeeding(false);
    }
  };

  const startEdit = (rate: ExchangeRate) => {
    setEditing(rate.period);
    setEditValue(String(rate.rate_per_usd));
    setEditSource(rate.source ?? '');
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
    setEditSource('');
  };

  const handleSave = async (period: string) => {
    const val = Number(editValue);
    if (!val || val < 1000) {
      setMessage({ type: 'error', text: 'Rate must be a valid number (e.g. 26300).' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/exchange-rates/${period}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate_per_usd: val, source: editSource }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `Rate for ${periodLabel(period)} updated.` });
        setEditing(null);
        fetchRates();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Save failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error during save.' });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-red-600 hover:text-red-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Exchange Rate Settings
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Monthly USD → VND reference rates used for UPS shipment cost calculations.
                Each package is priced using the rate from its shipment month.
              </p>
            </div>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {seeding ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              Seed Jan–May 2026
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">USD / VND Monthly Reference Rates</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading rates…
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">No rates found.</p>
              <p className="text-sm">Click <strong>Seed Jan–May 2026</strong> to populate the default rates.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Month</th>
                  <th className="px-6 py-3">1 USD =</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id ?? r.period} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-800">{periodLabel(r.period)}</td>

                    {editing === r.period ? (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                              placeholder="26300"
                            />
                            <span className="text-gray-500 text-xs">VND</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSave(r.period)}
                              disabled={saving}
                              className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300 transition"
                            >
                              {saving ? '…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-300 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">
                            {r.rate_per_usd.toLocaleString()} VND
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => startEdit(r)}
                            className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          These rates are applied automatically when generating UPS price quotes. Each order uses the rate from its creation month.
        </p>
      </div>
    </div>
  );
}
