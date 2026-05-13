// API route to fetch order routes belonging to the authenticated user
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticateToken } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    // Authenticate – only return routes owned by this user
    const authResult = await authenticateToken(req);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Filter to only this user's rows
    const { data: routes, error } = await supabase
      .from("order_ups")
      .select("id, order_id, from_location, to_location, status, created_at")
      .eq("unique_id_user", authResult.userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API /api/routes] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch routes", details: error.message },
        { status: 500 }
      );
    }

    // Keep only routes that have both endpoints geocodable
    const validRoutes = (routes || []).filter(
      (route) => route.from_location && route.to_location
    );

    console.log(
      `[API /api/routes] User ${authResult.userId}: ${validRoutes.length} valid routes`
    );

    return NextResponse.json({
      success: true,
      data: validRoutes,
      count: validRoutes.length,
    });
  } catch (error: any) {
    console.error("[API /api/routes] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
