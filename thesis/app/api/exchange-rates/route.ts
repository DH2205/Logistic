/**
 * GET  /api/exchange-rates          — list all stored rates
 * POST /api/exchange-rates          — upsert a rate { period, currency_from, currency_to, rate_per_usd, source? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ── Default 2026 rates (State Bank of Vietnam / mid-market) ──────────────────
export const DEFAULT_RATES_2026 = [
  { period: '2026-01', currency_from: 'USD', currency_to: 'VND', rate_per_usd: 26211, source: 'findexify.com monthly avg' },
  { period: '2026-02', currency_from: 'USD', currency_to: 'VND', rate_per_usd: 25957, source: 'findexify.com monthly avg' },
  { period: '2026-03', currency_from: 'USD', currency_to: 'VND', rate_per_usd: 26249, source: 'findexify.com monthly avg' },
  { period: '2026-04', currency_from: 'USD', currency_to: 'VND', rate_per_usd: 26335, source: 'findexify.com monthly avg' },
  { period: '2026-05', currency_from: 'USD', currency_to: 'VND', rate_per_usd: 26300, source: 'Yahoo Finance mid-market May 12' },
];

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .order('period', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rates: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const body = await request.json();

  // Bulk seed: POST { seed: true }
  if (body.seed) {
    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert(DEFAULT_RATES_2026, { onConflict: 'period,currency_from,currency_to' })
      .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  }

  // Single upsert
  const { period, currency_from, currency_to, rate_per_usd, source } = body;
  if (!period || !currency_from || !currency_to || !rate_per_usd) {
    return NextResponse.json({ error: 'period, currency_from, currency_to, rate_per_usd are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('exchange_rates')
    .upsert({ period, currency_from, currency_to, rate_per_usd, source: source ?? null }, { onConflict: 'period,currency_from,currency_to' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rate: data });
}
