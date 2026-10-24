import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "@/lib/auth/session";
import { getTable } from "@/lib/auth/db";
import { finalizePaidOrder } from "@/lib/payments/finalize-order";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Authentication required." },
        { status: 401 }
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Missing payment verification parameters" },
        { status: 400 }
      );
    }

    // 1. Look up pending order from database
    const orders = getTable("orders");
    const order = orders.find((o) => o.orderId === razorpay_order_id);

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or expired" },
        { status: 404 }
      );
    }

    // 2. Signature verification against the live Razorpay merchant secret.
    // Test-simulator orders are finalized only by the dev-only simulate endpoint,
    // so a browser can never self-credit by guessing a signature.
    if (order.isSimulated) {
      return NextResponse.json(
        { success: false, message: "Simulated orders cannot be verified here." },
        { status: 400 }
      );
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      return NextResponse.json(
        { success: false, message: "Server payment configuration missing" },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "utf8");
    const provided = Buffer.from(String(razorpay_signature), "utf8");
    const isValid =
      expected.length === provided.length && crypto.timingSafeEqual(expected, provided);

    if (!isValid) {
      console.warn("❌ Invalid payment signature detected for order:", razorpay_order_id);
      return NextResponse.json(
        { success: false, message: "Invalid payment signature verification failed" },
        { status: 400 }
      );
    }

    // 3. Mark paid, record the payment and grant entitlements.
    const result = finalizePaidOrder(razorpay_order_id, razorpay_payment_id, session);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.alreadyProcessed
        ? "Payment already verified and credited"
        : "Payment verified successfully! Entitlements updated.",
      paymentId: razorpay_payment_id,
      creditsAdded: result.creditsAdded,
      totalRemainingCredits: result.totalRemainingCredits,
      isPro: result.isPro,
      planName: result.planName,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}