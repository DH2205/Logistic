/** Canonical delivery_status values stored in order_ups (underscore form). */
export const DELIVERY_STATUS_VALUES = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
] as const;

export type DeliveryStatusValue = (typeof DELIVERY_STATUS_VALUES)[number];

export const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatusValue; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function isValidDeliveryStatus(v: string): v is DeliveryStatusValue {
  return (DELIVERY_STATUS_VALUES as readonly string[]).includes(v);
}

/** Normalize API/UI input (hyphens, spaces, case) to a canonical value, or null if unknown. */
export function parseDeliveryStatusInput(raw: unknown): DeliveryStatusValue | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  if (isValidDeliveryStatus(v)) return v;
  return null;
}

/** Map stored/raw strings from DB or legacy UPS sync to a canonical select value. */
export function coerceDeliveryStatusForDisplay(raw: string | undefined | null): DeliveryStatusValue {
  const parsed = parseDeliveryStatusInput(raw ?? '');
  return parsed ?? 'pending';
}
