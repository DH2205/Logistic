/**
 * GET /api/ups/track/[trackingNumber]
 *
 * Calls the UPS Tracking API directly using Client ID + Secret.
 * Returns raw live tracking data from UPS — not from the database.
 */
import { NextRequest, NextResponse } from 'next/server';

const BASE_URL      = 'https://onlinetools.ups.com';
const CLIENT_ID     = process.env.UPS_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.UPS_CLIENT_SECRET || '';

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
  if (!res.ok) throw new Error(`UPS auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const { trackingNumber } = await params;
    const token = await getToken();

    const res = await fetch(
      `${BASE_URL}/api/track/v1/details/${trackingNumber}?locale=en_US&returnSignature=false`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'transId':       'logishop-track-001',
          'transactionSrc': 'LogiShop',
        },
      }
    );

    const raw = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: raw }, { status: 200 });
    }

    // ── Extract the useful fields ────────────────────────────────────────────
    const shipment  = raw?.trackResponse?.shipment?.[0];
    const pkg       = shipment?.package?.[0];
    const activity  = pkg?.activity ?? [];
    const latest    = activity[0];

    const result = {
      ok:              true,
      trackingNumber,
      service:         shipment?.service?.description ?? null,
      status:          pkg?.currentStatus?.description ?? null,
      statusCode:      pkg?.currentStatus?.code ?? null,
      weight:          pkg?.weight ? `${pkg.weight.weight} ${pkg.weight.unitOfMeasurement}` : null,
      scheduledDelivery: pkg?.deliveryDate?.[0]?.date ?? null,
      latestActivity: latest ? {
        date:        latest.date,
        time:        latest.time,
        description: latest.status?.description,
        location:    [
          latest.location?.address?.city,
          latest.location?.address?.stateProvince,
          latest.location?.address?.countryCode,
        ].filter(Boolean).join(', '),
      } : null,
      allActivities: activity.map((a: any) => ({
        date:        a.date,
        time:        a.time,
        description: a.status?.description,
        location:    [
          a.location?.address?.city,
          a.location?.address?.stateProvince,
          a.location?.address?.countryCode,
        ].filter(Boolean).join(', '),
      })),
      shipper: {
        name:    pkg?.shipTo?.name ?? null,
        address: pkg?.shipTo?.address ?? null,
      },
      rawResponse: raw,
    };

    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
