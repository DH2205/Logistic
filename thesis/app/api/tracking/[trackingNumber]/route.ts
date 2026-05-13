import { NextRequest, NextResponse } from 'next/server';
import { upsTrackingService } from '@/lib/ups-tracking';
import { authenticateToken } from '@/lib/middleware';

/**
 * GET /api/tracking/:trackingNumber
 * 
 * Track a shipment using UPS tracking API
 * This endpoint fetches real-time tracking information from UPS
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    // Get tracking number from params
    const { trackingNumber } = await params;

    if (!trackingNumber) {
      return NextResponse.json(
        { message: 'Tracking number is required' },
        { status: 400 }
      );
    }

    console.log(`📦 Tracking shipment: ${trackingNumber}`);

    // Check if UPS credentials are configured
    const hasUPSCredentials = 
      process.env.UPS_CLIENT_ID && 
      process.env.UPS_CLIENT_SECRET;

    let trackingInfo;

    if (hasUPSCredentials) {
      // Use real UPS API — do NOT fall back to mock on failure
      try {
        trackingInfo = await upsTrackingService.trackShipment(trackingNumber);
        console.log(`✅ Real UPS tracking data retrieved for ${trackingNumber}`);
      } catch (error: any) {
        console.error('UPS API error:', error);

        const msg: string = error.message || 'UPS API error';
        const isNotFound =
          msg.startsWith('NOT_FOUND:') ||
          msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('invalid') ||
          msg.includes('400') ||
          msg.includes('404');

        const displayMsg = isNotFound
          ? 'Tracking number not found. It may be invalid or not yet active in the UPS system.'
          : `Unable to retrieve tracking information from UPS. Please try again later.`;

        return NextResponse.json(
          { success: false, message: displayMsg, code: isNotFound ? 'NOT_FOUND' : 'UPS_ERROR' },
          { status: isNotFound ? 404 : 502 }
        );
      }
    } else {
      // No credentials configured — use mock data for local development only
      console.log('ℹ️ Using mock tracking data (UPS credentials not configured)');
      trackingInfo = upsTrackingService.getMockTrackingData(trackingNumber);
    }

    return NextResponse.json({
      success: true,
      data: trackingInfo,
      source: hasUPSCredentials ? 'ups' : 'mock',
    });

  } catch (error: any) {
    console.error('❌ Tracking error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to retrieve tracking information',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
