import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getTable } from "@/lib/auth/db";
import { finalizePaidOrder } from "@/lib/payments/finalize-order";

// Development-only payment simulator. Finalizes an order that
// /api/razorpay/create-order explicitly flagged as simulated.
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      return NextResponse.json(
        {
          success: false,
          message: "The payment simulator is disabled in production.",
          code: "PAYMENT_PROVIDER_UNCONFIGURED",
        },
        { status: 503 }
      );
    }

    const session = await getServerSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Authentication required." },
        { status: 401 }
      );
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Missing order id" },
        { status: 400 }
      );
    }

    const order = getTable("orders").find((o) => o.orderId === orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or expired" },
        { status: 404 }
      );
    }

    if (!order.isSimulated) {
      return NextResponse.json(
        { success: false, message: "This order must be verified with a real Razorpay signature." },
        { status: 400 }
      );
    }

    const result = finalizePaidOrder(orderId, `pay_sim_${orderId}`, session);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: result.alreadyProcessed
        ? "Simulated payment already credited"
        : "Simulated payment credited (development mode).",
      creditsAdded: result.creditsAdded,
      totalRemainingCredits: result.totalRemainingCredits,
      isPro: result.isPro,
      planName: result.planName,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error: any) {
    console.error("Error simulating payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to simulate payment" },
      { status: 500 }
    );
  }
}
