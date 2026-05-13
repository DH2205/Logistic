/**
 * PUT /api/exchange-rates/[period]
 * Update the rate_per_usd (and optionally source) for a specific period (e.g. "2026-04").
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ period: string }> },
) {
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const { period } = await params;
  const body = await request.json();
  const { currency_from = 'USD', currency_to = 'VND', rate_per_usd, source } = body;

  if (!rate_per_usd || isNaN(Number(rate_per_usd))) {
    return NextResponse.json({ error: 'rate_per_usd must be a valid number' }, { status: 400 });
  }

  const update: Record<string, unknown> = { rate_per_usd: Number(rate_per_usd), updated_at: new Date().toISOString() };
  if (source !== undefined) update.source = source;

  const { data, error } = await supabase
    .from('exchange_rates')
    .update(update)
    .eq('period', period)
    .eq('currency_from', currency_from)
    .eq('currency_to', currency_to)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rate: data });
}
