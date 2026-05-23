// API route to refresh/sync order data and tracking
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authorizeOrderTrackingAccess } from "@/lib/order-access";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const gate = await authorizeOrderTrackingAccess(req, id);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

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
        
        const authHeader = req.headers.get("authorization");
        const syncHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authHeader) syncHeaders.Authorization = authHeader;

        // Call the sync-tracking endpoint
        const syncResponse = await fetch(
          `${req.nextUrl.origin}/api/orders/${id}/sync-tracking`,
          {
            method: "POST",
            headers: syncHeaders,
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

    // Augment the order with live UPS route hints from sync-tracking (not delivery status — staff-controlled).
    if (trackingUpdate) {
      const oLoc =
        trackingUpdate.originLocation != null &&
        String(trackingUpdate.originLocation).trim() !== ''
          ? String(trackingUpdate.originLocation).trim()
          : null;
      const dLoc =
        trackingUpdate.latestLocation != null &&
        String(trackingUpdate.latestLocation).trim() !== ''
          ? String(trackingUpdate.latestLocation).trim()
          : null;
      // Prefer live UPS scan bookends over stale DB placement
      if (oLoc) {
        response.order.fromLocation = oLoc;
        response.order.origin = { country: oLoc };
      }
      if (dLoc) {
        response.order.toLocation = dLoc;
        response.order.destination = { country: dLoc };
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
