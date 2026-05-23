import type { OrderReviewInput } from './validation';

type ShipmentPatchFields = Omit<OrderReviewInput, 'approvalStatus' | 'staffNotes'>;

/**
 * Apply validated shipment patch fields onto a DB `assign` updates object (snake_case).
 */
export function mergeShipmentPatchIntoDbUpdates(
  data: ShipmentPatchFields,
  updates: Record<string, unknown>
): void {
  if (data.trackingNumber !== undefined) {
    updates.tracking_number =
      data.trackingNumber.trim() === '' ? null : data.trackingNumber.trim();
  }

  if (data.senderName !== undefined) updates.sender_name = data.senderName;
  if (data.senderPhone !== undefined) updates.sender_phone = data.senderPhone;
  if (data.senderEmail !== undefined) updates.sender_email = data.senderEmail;
  if (data.senderAddress !== undefined) updates.sender_address = data.senderAddress;
  if (data.receiverName !== undefined) updates.receiver_name = data.receiverName;
  if (data.receiverAddress !== undefined) updates.receiver_address = data.receiverAddress;
  if (data.weight !== undefined) updates.weight = data.weight;
  if (data.length !== undefined) updates.length = data.length;
  if (data.width !== undefined) updates.width = data.width;
  if (data.height !== undefined) updates.height = data.height;
  if (data.grossWeight !== undefined) updates.gross_weight = data.grossWeight;
  if (data.carrier !== undefined) updates.carrier = data.carrier;

  if (data.packageName !== undefined) updates.package_name = data.packageName;
  if (data.measurements !== undefined) updates.measurements = data.measurements;

  if (data.customerName !== undefined) updates.customer_name = data.customerName;
  if (data.sender !== undefined) updates.sender = data.sender;

  if (data.fromLocation !== undefined) {
    updates.from_location = data.fromLocation;
    updates.origin = { country: data.fromLocation };
  }
  if (data.toLocation !== undefined) {
    updates.to_location = data.toLocation;
    updates.destination = { country: data.toLocation };
  }
}

export function countMeaningfulShipmentKeys(updates: Record<string, unknown>): number {
  return Object.keys(updates).filter((k) => k !== 'updated_at').length;
}
