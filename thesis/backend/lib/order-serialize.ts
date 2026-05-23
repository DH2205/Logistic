/** Normalize DB origin/destination: json object, plain country string, or JSON string in a text column. */
function coerceLocationField(
  raw: unknown,
  fallbackLabel: unknown
): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{')) {
      try {
        const p = JSON.parse(t) as { country?: string };
        if (p && typeof p.country === 'string') return { country: p.country };
        if (p && typeof p === 'object') return p as Record<string, unknown>;
      } catch {
        /* treat as plain label */
      }
    }
    return { country: t || String(fallbackLabel || 'Unknown') };
  }
  return { country: String(fallbackLabel || 'Unknown') };
}

/** Map raw order_ups row to API / frontend camelCase shape. */
export function serializeOrderUps(order: Record<string, unknown>) {
  return {
    id: order.id,
    orderID: order.order_id,
    userId: order.user_id,
    uniqueIdUser: order.unique_id_user,
    senderName: order.sender_name,
    senderPhone: order.sender_phone,
    senderEmail: order.sender_email,
    senderAddress: order.sender_address,
    receiverName: order.receiver_name,
    receiverAddress: order.receiver_address,
    packageName: order.package_name || `Package for ${order.receiver_name}`,
    length: order.length,
    width: order.width,
    height: order.height,
    weight: order.weight,
    grossWeight: order.gross_weight,
    measurements:
      order.measurements ||
      `${order.length}x${order.width}x${order.height} cm`,
    origin: coerceLocationField(order.origin, order.from_location),
    destination: coerceLocationField(order.destination, order.to_location),

    fromLocation: order.from_location,
    toLocation: order.to_location,
    status: order.status,
    deliveryStatus: order.delivery_status,
    trackingNumber: order.tracking_number,
    carrier: order.carrier || 'UPS',
    submissionTime: order.submission_time,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customerName: order.customer_name,
    sender: order.sender,
    extendedData: order.extended_data || {},
    approvalStatus: order.approval_status ?? 'approved',
    reviewedAt: order.reviewed_at ?? null,
    reviewedBy: order.reviewed_by ?? null,
    staffNotes: order.staff_notes ?? null,
  };
}
