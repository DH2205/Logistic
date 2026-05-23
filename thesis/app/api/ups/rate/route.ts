/**
 * POST /api/ups/rate
 *
 * Calls the UPS Rating API to get a real price quote for a shipment.
 * Uses the same OAuth credentials as the tracking service.
 *
 * Body:
 *  {
 *    weightKg: number,       // actual package weight in kg
 *    lengthCm: number,       // package length in cm
 *    widthCm: number,        // package width in cm
 *    heightCm: number,       // package height in cm
 *    originCountryCode: string,      // e.g. "VN"
 *    destinationCountryCode: string  // e.g. "US"
 *  }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_RATES_2026 } from '@/app/api/exchange-rates/route';
import { buildUpsRatingAddress } from '@/lib/ups-rating-address';

/** Host only (no trailing /api). OAuth is /security/...; rating is /api/rating/... */
function upsApiHost(): string {
  const raw = (process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com').replace(/\/$/, '');
  if (raw.endsWith('/api')) return raw.slice(0, -4);
  return raw || 'https://onlinetools.ups.com';
}

const BASE_URL      = upsApiHost();
const CLIENT_ID     = process.env.UPS_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.UPS_CLIENT_SECRET || '';
const ACCOUNT_NO    = process.env.UPS_ACCOUNT_NUMBER || '';

// ── OAuth ────────────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/security/v1/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`UPS auth failed: ${res.status} — ${txt}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// ── Rate request ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'UPS OAuth is not configured (missing UPS_CLIENT_ID or UPS_CLIENT_SECRET).',
          hint: 'Add them to .env.local locally, or to Vercel / hosting → Environment Variables for production.',
        },
        { status: 200 }
      );
    }
    if (!String(ACCOUNT_NO).trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UPS shipper number is not configured (UPS_ACCOUNT_NUMBER).',
          hint: 'Use the 6-character UPS account number from your UPS Billing Center.',
        },
        { status: 200 }
      );
    }

    const body = await request.json();
    const {
      weightKg            = 5,
      lengthCm            = 10,
      widthCm             = 20,
      heightCm            = 20,
      originCountryCode      = 'VN',
      destinationCountryCode = 'US',
      packageDate,   // optional ISO date string — used to pick the correct monthly FX rate
    } = body;

    // ── Resolve the correct monthly FX rate from DB ───────────────────────────
    const period = packageDate
      ? new Date(packageDate).toISOString().slice(0, 7)   // "2026-04"
      : new Date().toISOString().slice(0, 7);

    let vndPerUsd = 26300; // safe fallback
    if (supabase) {
      const { data: rateRow } = await supabase
        .from('exchange_rates')
        .select('rate_per_usd')
        .eq('period', period)
        .eq('currency_from', 'USD')
        .eq('currency_to', 'VND')
        .maybeSingle();
      if (rateRow?.rate_per_usd) {
        vndPerUsd = rateRow.rate_per_usd;
      } else {
        // Fall back to hardcoded defaults if DB not yet seeded
        const fallback = DEFAULT_RATES_2026.find(r => r.period === period);
        if (fallback) vndPerUsd = fallback.rate_per_usd;
      }
    }

    const token = await getToken();

    const shipFromAddr = buildUpsRatingAddress(String(originCountryCode));
    const shipToAddr = buildUpsRatingAddress(String(destinationCountryCode));

    const ratePayload = {
      RateRequest: {
        Request: {
          RequestOption: 'Shop', // returns all available services + prices
          TransactionReference: { CustomerContext: 'LogiShop Cost Analysis' },
        },
        Shipment: {
          Shipper: {
            Name: 'LogiShop Sender',
            ShipperNumber: ACCOUNT_NO,
            Address: shipFromAddr,
          },
          ShipTo: {
            Name: 'LogiShop Receiver',
            Address: shipToAddr,
          },
          ShipFrom: {
            Name: 'LogiShop Sender',
            Address: shipFromAddr,
          },
          Package: {
            PackagingType: { Code: '02', Description: 'Package' },
            Dimensions: {
              UnitOfMeasurement: { Code: 'CM' },
              Length: lengthCm.toFixed(1),
              Width:  widthCm.toFixed(1),
              Height: heightCm.toFixed(1),
            },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'KGS' },
              Weight: weightKg.toFixed(2),
            },
          },
        },
      },
    };

    const rateRes = await fetch(`${BASE_URL}/api/rating/v2205/Shop`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'transId':       'logishop-rate-001',
        'transactionSrc': 'LogiShop',
      },
      body: JSON.stringify(ratePayload),
    });

    const rateData = await rateRes.json();

    if (!rateRes.ok) {
      const alerts = rateData?.RateResponse?.Response?.Alert;
      const firstAlert =
        Array.isArray(alerts) && alerts[0]?.Description
          ? String(alerts[0].Description)
          : null;
      const errObj = rateData?.response?.errors?.[0];
      const apiMsg =
        firstAlert ||
        (errObj?.message ? String(errObj.message) : null) ||
        (typeof errObj === 'string' ? errObj : null);
      return NextResponse.json({
        ok: false,
        status: rateRes.status,
        error: rateData,
        hint:
          apiMsg ||
          'UPS Rating API rejected the request. Check UPS_ACCOUNT_NUMBER, API permissions (Rating), and that production keys match https://onlinetools.ups.com.',
      }, { status: 200 });
    }

    // ── Currency conversion rates (resolved from DB for the package's month) ──
    const FX: Record<string, number> = {
      USD: 1,
      VND: 1 / vndPerUsd,
      EUR: 1.08,
      GBP: 1.27,
    };

    const SERVICE_NAMES: Record<string, string> = {
      '07': 'UPS Worldwide Express',
      '08': 'UPS Worldwide Expedited',
      '54': 'UPS Worldwide Express Plus',
      '65': 'UPS Worldwide Saver',
      '11': 'UPS Standard',
      '96': 'UPS Worldwide Express Freight',
    };

    // ── Parse the response ───────────────────────────────────────────────────
    const rated: Array<{
      serviceCode: string;
      serviceName: string;
      currency: string;
      totalChargeLocal: number;
      totalChargeUSD: number;
      billableWeightLbs: number;
      billableWeightKg: number;
    }> = [];

    const ratedShipments = rateData?.RateResponse?.RatedShipment ?? [];
    for (const s of ratedShipments) {
      const code     = s.Service?.Code ?? '—';
      const total    = parseFloat(s.TotalCharges?.MonetaryValue ?? '0');
      const currency = s.TotalCharges?.CurrencyCode ?? 'USD';
      const bwRaw    = parseFloat(s.BillingWeight?.Weight ?? weightKg.toFixed(2));
      const bwUnit   = s.BillingWeight?.UnitOfMeasurement?.Code ?? 'KGS';
      const bwKg     = bwUnit === 'LBS' ? bwRaw / 2.20462 : bwRaw;
      const bwLbs    = bwUnit === 'LBS' ? bwRaw : bwRaw * 2.20462;

      const fxRate   = FX[currency] ?? 1;
      const totalUSD = total * fxRate;

      rated.push({
        serviceCode:       code,
        serviceName:       SERVICE_NAMES[code] ?? `UPS Service ${code}`,
        currency,
        totalChargeLocal:  Math.round(total),
        totalChargeUSD:    Math.round(totalUSD * 100) / 100,
        billableWeightLbs: Math.round(bwLbs * 100) / 100,
        billableWeightKg:  Math.round(bwKg  * 100) / 100,
      });
    }

    // Sort cheapest first
    rated.sort((a, b) => a.totalChargeUSD - b.totalChargeUSD);

    const localCurrency = ratedShipments[0]?.TotalCharges?.CurrencyCode ?? 'USD';
    const usedFxRate    = FX[localCurrency] ?? 1;

    const [periodYear, periodMonth] = period.split('-');
    const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodLabel = `${MONTH_NAMES[parseInt(periodMonth)] ?? periodMonth} ${periodYear}`;

    return NextResponse.json({
      ok: true,
      exchangeRate: {
        from: localCurrency,
        to: 'USD',
        rate: usedFxRate,
        period,
        note: localCurrency === 'USD'
          ? '1 USD = 1 USD'
          : `1 USD = ${vndPerUsd.toLocaleString()} ${localCurrency} (mid-market, ${periodLabel})`,
      },
      packageSpecs: {
        actualWeightKg:      weightKg,
        dimensionalWeightKg: Math.round((lengthCm * widthCm * heightCm / 5000) * 100) / 100,
        billableWeightKg:    rated[0]?.billableWeightKg ?? null,
        dimensions:          `${lengthCm}×${widthCm}×${heightCm} cm`,
        origin:              originCountryCode,
        destination:         destinationCountryCode,
      },
      rates: rated,
      cheapest: rated[0] ?? null,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const hint =
      message.includes('UPS auth failed') || message.includes('401')
        ? 'OAuth failed: verify UPS_CLIENT_ID, UPS_CLIENT_SECRET, and that the app is subscribed to the Rating API in the UPS developer portal.'
        : message;
    return NextResponse.json(
      { ok: false, error: message, hint },
      { status: 200 }
    );
  }
}
