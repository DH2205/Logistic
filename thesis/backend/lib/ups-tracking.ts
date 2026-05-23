/**
 * UPS Tracking API Service
 * 
 * This service integrates with UPS API to track shipments in real-time.
 * Documentation: https://developer.ups.com/api/reference/tracking
 */

interface UPSAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface UPSTrackingActivity {
  date: string;
  time: string;
  // UPS Track API v1 nests address fields under location.address
  location: {
    address?: {
      city?: string;
      stateProvince?: string;
      countryCode?: string;
      postalCode?: string;
    };
  };
  status: {
    type: string;
    description: string;
    code: string;
  };
}

interface UPSPackageDetail {
  trackingNumber: string;
  deliveryDate?: {
    date: string;
    type: string;
  };
  service: {
    description: string;
  };
  weight?: {
    unitOfMeasurement: string;
    weight: string;
  };
  currentStatus: {
    description: string;
    code: string;
    simplifiedTextDescription: string;
  };
  activity: UPSTrackingActivity[];
  packageAddress?: {
    city?: string;
    stateProvince?: string;
    countryCode?: string;
    country?: string;
  };
  shipper?: {
    name?: string;
    address?: {
      city?: string;
      stateProvince?: string;
      countryCode?: string;
    };
  };
  shipTo?: {
    name?: string;
    address?: {
      city?: string;
      stateProvince?: string;
      countryCode?: string;
    };
  };
}

interface UPSTrackingResponse {
  trackResponse: {
    shipment: Array<{
      package: UPSPackageDetail[];
    }>;
  };
}

/** Sort key from UPS "YYYYMMDD HHMMSS" — lexicographic order = chronological order. */
function upsActivitySortKey(timestamp: string): string {
  const [datePart = '', timePart = ''] = (timestamp || '').trim().split(/\s+/);
  const d = datePart.replace(/\D/g, '').padStart(8, '0').slice(0, 8);
  const t = (timePart || '000000').replace(/\D/g, '').padStart(6, '0').slice(0, 6);
  return `${d}${t}`;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  activities: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
  shipperInfo?: {
    name?: string;
    location?: string;
  };
  recipientInfo?: {
    name?: string;
    location?: string;
  };
  packageDetails?: {
    weight?: string;
    service?: string;
  };
}

class UPSTrackingService {
  private clientId: string;
  private clientSecret: string;
  private accountNumber: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.UPS_CLIENT_ID || '';
    this.clientSecret = process.env.UPS_CLIENT_SECRET || '';
    this.accountNumber = process.env.UPS_ACCOUNT_NUMBER || '';
    this.baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com';
  }

  /**
   * Get OAuth access token from UPS
   */
  private async authenticate(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString('base64');

      const response = await fetch(`${this.baseUrl}/security/v1/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        throw new Error(`UPS authentication failed: ${response.statusText}`);
      }

      const data: UPSAuthResponse = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('UPS authentication error:', error);
      throw new Error('Failed to authenticate with UPS API');
    }
  }

  /**
   * Track a shipment by tracking number
   */
  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    try {
      const token = await this.authenticate();

      const response = await fetch(
        `${this.baseUrl}/api/track/v1/details/${trackingNumber}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'transId': `track-${Date.now()}`,
            'transactionSrc': 'LogiShop',
          },
        }
      );

      if (!response.ok) {
        // 400 = invalid/unrecognised tracking number, 404 = not found
        if (response.status === 400 || response.status === 404) {
          // Try to pull a human-readable message out of the UPS error body
          let detail = '';
          try {
            const errBody = await response.json();
            detail = errBody?.response?.errors?.[0]?.message
              || errBody?.errors?.[0]?.message
              || '';
          } catch { /* ignore parse errors */ }
          throw new Error(`NOT_FOUND: ${detail || 'Tracking number not found or invalid'}`);
        }
        throw new Error(`UPS API error: ${response.status} ${response.statusText}`);
      }

      const data: UPSTrackingResponse = await response.json();

      // UPS sometimes returns 200 with an errors array instead of tracking data
      const upsErrors = (data as any)?.response?.errors ?? (data as any)?.errors;
      if (upsErrors?.length) {
        const msg = upsErrors[0]?.message || 'Tracking number not found';
        throw new Error(`NOT_FOUND: ${msg}`);
      }

      // Transform UPS response to our standard format
      return this.transformUPSResponse(data, trackingNumber);
    } catch (error: any) {
      console.error('UPS tracking error:', error);
      throw new Error(error.message || 'Failed to track shipment');
    }
  }

  /**
   * Transform UPS API response to our standard format
   */
  private transformUPSResponse(
    response: UPSTrackingResponse,
    trackingNumber: string
  ): TrackingInfo {
    const shipment = response.trackResponse.shipment[0];
    const packageInfo = shipment.package[0];

    // Format activities
    const activities = packageInfo.activity.map((activity) => {
      const addr = activity.location?.address;
      const location = [
        addr?.city,
        addr?.stateProvince,
        addr?.countryCode,
      ]
        .filter(Boolean)
        .join(', ');

      return {
        timestamp: `${activity.date} ${activity.time}`,
        location: location || '',
        status: activity.status.type,
        description: activity.status.description,
      };
    });

    // UPS does not guarantee package.activity[] is newest-first; sort so index 0 = latest.
    activities.sort((a, b) =>
      upsActivitySortKey(b.timestamp).localeCompare(upsActivitySortKey(a.timestamp))
    );

    // Get current location from latest activity (after sort)
    const latestActivity = activities[0];
    const currentLocation = latestActivity?.location?.trim() || undefined;

    return {
      trackingNumber,
      carrier: 'UPS',
      // Prefer the type code from the latest activity (e.g. "D", "IT", "I") which is
      // what sync-tracking maps to DB status values.  currentStatus.code is a UPS detail
      // sub-code (e.g. "011") that is NOT the type and breaks that mapping.
      status: latestActivity?.status || packageInfo.currentStatus.code,
      statusDescription: packageInfo.currentStatus.simplifiedTextDescription ||
                         packageInfo.currentStatus.description,
      estimatedDelivery: packageInfo.deliveryDate?.date,
      currentLocation: currentLocation || undefined,
      activities,
      shipperInfo: packageInfo.shipper
        ? {
            name: packageInfo.shipper.name,
            location: [
              packageInfo.shipper.address?.city,
              packageInfo.shipper.address?.stateProvince,
              packageInfo.shipper.address?.countryCode,
            ]
              .filter(Boolean)
              .join(', '),
          }
        : undefined,
      recipientInfo: packageInfo.shipTo
        ? {
            name: packageInfo.shipTo.name,
            location: [
              packageInfo.shipTo.address?.city,
              packageInfo.shipTo.address?.stateProvince,
              packageInfo.shipTo.address?.countryCode,
            ]
              .filter(Boolean)
              .join(', '),
          }
        : undefined,
      packageDetails: {
        weight: packageInfo.weight
          ? `${packageInfo.weight.weight} ${packageInfo.weight.unitOfMeasurement}`
          : undefined,
        service: packageInfo.service.description,
      },
    };
  }

  /**
   * Validate if a tracking number is in UPS format
   */
  isValidUPSTrackingNumber(trackingNumber: string): boolean {
    // UPS tracking numbers are typically 18 characters starting with "1Z"
    const upsPattern = /^1Z[A-Z0-9]{16}$/;
    return upsPattern.test(trackingNumber);
  }

  /**
   * Get mock tracking data for testing (when UPS credentials not available)
   */
  getMockTrackingData(trackingNumber: string): TrackingInfo {
    return {
      trackingNumber,
      carrier: 'UPS',
      status: 'IT',
      statusDescription: 'In Transit',
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currentLocation: 'Chicago, IL, US',
      activities: [
        {
          timestamp: new Date().toISOString(),
          location: 'Chicago, IL, US',
          status: 'IT',
          description: 'Package is in transit',
        },
        {
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          location: 'New York, NY, US',
          status: 'DP',
          description: 'Departed from facility',
        },
        {
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          location: 'New York, NY, US',
          status: 'OR',
          description: 'Origin scan',
        },
      ],
      shipperInfo: {
        name: 'Sample Shipper',
        location: 'New York, NY, US',
      },
      recipientInfo: {
        name: 'Sample Recipient',
        location: 'Los Angeles, CA, US',
      },
      packageDetails: {
        weight: '5.5 LBS',
        service: 'UPS Ground',
      },
    };
  }
}

// Export singleton instance
export const upsTrackingService = new UPSTrackingService();
