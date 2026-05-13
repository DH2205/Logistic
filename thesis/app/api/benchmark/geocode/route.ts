/**
 * GET /api/benchmark/geocode
 *
 * Runs a batch geocoding test against geocodeLocation() using a curated list
 * of location strings (realistic UPS scan formats, country codes, city names,
 * ambiguous / invalid strings).
 *
 * Returns per-location pass/fail + aggregate success rate for thesis evidence.
 */
import { NextResponse } from 'next/server';
import { geocodeLocation } from '@/lib/geocoding';

const TEST_LOCATIONS = [
  // ── Country names (should always resolve) ──────────────────────────────────
  { input: 'Vietnam',                  category: 'country' },
  { input: 'United States',            category: 'country' },
  { input: 'Singapore',                category: 'country' },
  { input: 'United Kingdom',           category: 'country' },
  { input: 'Japan',                    category: 'country' },
  { input: 'China',                    category: 'country' },
  { input: 'Australia',                category: 'country' },
  { input: 'Germany',                  category: 'country' },
  { input: 'France',                   category: 'country' },
  { input: 'India',                    category: 'country' },
  // ── 2-letter ISO codes (should always resolve) ──────────────────────────────
  { input: 'VN',                       category: 'iso_code' },
  { input: 'US',                       category: 'iso_code' },
  { input: 'SG',                       category: 'iso_code' },
  { input: 'GB',                       category: 'iso_code' },
  { input: 'JP',                       category: 'iso_code' },
  { input: 'CN',                       category: 'iso_code' },
  { input: 'AU',                       category: 'iso_code' },
  { input: 'DE',                       category: 'iso_code' },
  { input: 'FR',                       category: 'iso_code' },
  { input: 'IN',                       category: 'iso_code' },
  // ── UPS city,state,country format (realistic scan locations) ────────────────
  { input: 'HO CHI MINH CITY, VN',    category: 'ups_format' },
  { input: 'SINGAPORE, SG',            category: 'ups_format' },
  { input: 'DUBAI, AE',                category: 'ups_format' },
  { input: 'TOKYO, JP',                category: 'ups_format' },
  { input: 'LONDON, GB',               category: 'ups_format' },
  { input: 'LOS ANGELES, CA, US',      category: 'ups_format' },
  { input: 'NEW YORK, NY, US',         category: 'ups_format' },
  { input: 'SHANGHAI, CN',             category: 'ups_format' },
  { input: 'MUMBAI, IN',               category: 'ups_format' },
  { input: 'SYDNEY, AU',               category: 'ups_format' },
  // ── Plain city names (may fall back to Nominatim) ───────────────────────────
  { input: 'Bangkok',                  category: 'city_name' },
  { input: 'Cairo',                    category: 'city_name' },
  { input: 'Nairobi',                  category: 'city_name' },
  { input: 'Paris',                    category: 'city_name' },
  { input: 'Toronto',                  category: 'city_name' },
  { input: 'Jakarta',                  category: 'city_name' },
  { input: 'Moscow',                   category: 'city_name' },
  { input: 'Seoul',                    category: 'city_name' },
  { input: 'Kuala Lumpur',             category: 'city_name' },
  { input: 'Manila',                   category: 'city_name' },
  // ── Ambiguous / partial strings (may or may not resolve) ────────────────────
  { input: 'Ho Chi Minh City, Vietnam', category: 'ambiguous' },
  { input: 'New York, USA',            category: 'ambiguous' },
  { input: 'London, United Kingdom',   category: 'ambiguous' },
  { input: 'Dubai, UAE',               category: 'ambiguous' },
  { input: 'China South',              category: 'ambiguous' },
  // ── Invalid / junk strings (should fail gracefully) ─────────────────────────
  { input: 'XYZ123',                   category: 'invalid' },
  { input: 'Somewhere, Unknown',        category: 'invalid' },
  { input: '!!!@@@###',                category: 'invalid' },
  { input: '',                         category: 'invalid' },
  { input: 'ZZZZZ',                    category: 'invalid' },
];

export async function GET() {
  const results: { input: string; category: string; success: boolean; lat: number | null; lng: number | null }[] = [];
  let totalSuccess = 0;
  let totalFail = 0;

  for (const { input, category } of TEST_LOCATIONS) {
    try {
      const coords = await geocodeLocation(input);
      const success = coords !== null && Number.isFinite(coords.lat) && Number.isFinite(coords.lng);

      if (success) totalSuccess++;
      else totalFail++;

      results.push({
        input,
        category,
        success,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    } catch {
      totalFail++;
      results.push({ input, category, success: false, lat: null, lng: null });
    }
  }

  const total = results.length;
  const successRate = ((totalSuccess / total) * 100).toFixed(2);

  // Per-category breakdown
  const categories = [...new Set(TEST_LOCATIONS.map((t) => t.category))];
  const categoryBreakdown = categories.map((cat) => {
    const subset = results.filter((r) => r.category === cat);
    const passed = subset.filter((r) => r.success).length;
    return {
      category: cat,
      total: subset.length,
      passed,
      failed: subset.length - passed,
      successRatePct: ((passed / subset.length) * 100).toFixed(2),
    };
  });

  return NextResponse.json({
    ok: true,
    summary: {
      total,
      totalSuccess,
      totalFail,
      successRatePct: successRate,
    },
    categoryBreakdown,
    details: results,
  });
}
