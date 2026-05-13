// API route to refresh/sync order data and tracking
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    console.log(`[API /api/orders/${id}/refresh] Refreshing order data...`);

    // 1. Fetch current order data
    const { data: order, error: fetchError } = await supabase
      .from("order_ups")
      .select("*")
      .eq("order_id", id)
      .single();

    if (fetchError) {
      // PGRST116 = no rows returned by .single() → order genuinely not found
      if (fetchError.code === "PGRST116") {
        console.error(`[API] Order not found: ${id}`);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      // Any other code is a real DB/RLS/connection error → 500 so callers can distinguish
      console.error(`[API] Supabase error fetching order ${id}:`, fetchError);
      return NextResponse.json(
        { error: "Database error", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!order) {
      console.error(`[API] Order not found: ${id}`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Sync with UPS API if tracking number exists
    let trackingUpdate = null;
    if (order.tracking_number) {
      try {
        console.log(`[API] Syncing tracking for: ${order.tracking_number}`);
        
        // Call the sync-tracking endpoint
        const syncResponse = await fetch(
          `${req.nextUrl.origin}/api/orders/${id}/sync-tracking`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (syncResponse.ok) {
          trackingUpdate = await syncResponse.json();
          console.log(`[API] Tracking synced successfully`);
        } else {
          console.warn(`[API] Tracking sync failed: ${syncResponse.statusText}`);
        }
      } catch (syncError) {
        console.warn(`[API] Could not sync tracking:`, syncError);
        // Continue anyway - return current data
      }
    }

    // 3. Re-fetch updated order data
    const { data: updatedOrder, error: refetchError } = await supabase
      .from("order_ups")
      .select("*")
      .eq("order_id", id)
      .single();

    if (refetchError) {
      console.error(`[API] Error refetching order:`, refetchError);
      return NextResponse.json(
        { error: "Failed to fetch updated order" },
        { status: 500 }
      );
    }

    // 4. Format response
    const response = {
      success: true,
      order: {
        id: updatedOrder.id,
        orderId: updatedOrder.order_id,
        senderName: updatedOrder.sender_name,
        senderPhone: updatedOrder.sender_phone,
        senderEmail: updatedOrder.sender_email,
        senderAddress: updatedOrder.sender_address,
        receiverName: updatedOrder.receiver_name,
        receiverAddress: updatedOrder.receiver_address,
        packageName: updatedOrder.package_name,
        length: updatedOrder.length,
        width: updatedOrder.width,
        height: updatedOrder.height,
        weight: updatedOrder.weight,
        grossWeight: updatedOrder.gross_weight,
        origin: {
          country:
            updatedOrder.from_location ||
            (typeof updatedOrder.origin === 'string'
              ? updatedOrder.origin
              : updatedOrder.origin?.country) ||
            'Unknown',
        },
        destination: {
          country:
            updatedOrder.to_location ||
            (typeof updatedOrder.destination === 'string'
              ? updatedOrder.destination
              : updatedOrder.destination?.country) ||
            'Unknown',
        },
        fromLocation: updatedOrder.from_location,
        toLocation: updatedOrder.to_location,
        status: updatedOrder.status,
        deliveryStatus: updatedOrder.delivery_status,
        trackingNumber: updatedOrder.tracking_number,
        createdAt: updatedOrder.created_at,
        updatedAt: updatedOrder.updated_at,
      },
      trackingUpdate: trackingUpdate || null,
      refreshedAt: new Date().toISOString(),
    };

    // Augment the order with live UPS data from sync-tracking.
    // When the Supabase DB update silently fails (RLS / network), the re-fetched
    // order still carries stale values.  We prefer any live-derived status that
    // is more specific than "pending" (i.e. "delivered" or "in_transit").
    if (trackingUpdate) {
      const liveStatus: string | null = trackingUpdate.derivedStatus ?? null;
      const currentStatus: string = response.order.deliveryStatus || response.order.status || 'pending';
      if (liveStatus && liveStatus !== 'pending' && currentStatus === 'pending') {
        response.order.deliveryStatus = liveStatus;
        response.order.status = liveStatus;
      }
      // Fill missing location strings with live UPS scan data
      if (trackingUpdate.originLocation && !response.order.fromLocation) {
        response.order.fromLocation = trackingUpdate.originLocation;
      }
      if (trackingUpdate.latestLocation && !response.order.toLocation) {
        response.order.toLocation = trackingUpdate.latestLocation;
      }
    }

    console.log(`[API] Order refreshed successfully: ${id}`);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[API /api/orders/refresh] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
