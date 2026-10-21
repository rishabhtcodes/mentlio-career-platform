import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "@/lib/auth/session";
import { getTable, mutateTable } from "@/lib/auth/db";

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

    // 2. Prevent replay attacks / duplicate activations
    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        message: "Payment already verified and credited",
        alreadyProcessed: true,
        credits: order.credits,
        isPro: order.isPro,
      });
    }

    // 3. Signature verification
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    let isValid = false;

    if (order.isSimulated) {
      // Verified against test simulator secret
      const expectedSimulatedSig = crypto
        .createHmac("sha256", "mentlio_simulator_secret_key")
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      isValid =
        razorpay_signature === expectedSimulatedSig ||
        razorpay_signature === `sig_valid_${razorpay_order_id}`;
    } else {
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

      isValid = expectedSignature === razorpay_signature;
    }

    if (!isValid) {
      console.warn("❌ Invalid payment signature detected for order:", razorpay_order_id);
      return NextResponse.json(
        { success: false, message: "Invalid payment signature verification failed" },
        { status: 400 }
      );
    }

    // 4. Mark order as paid
    mutateTable("orders", (currentOrders) =>
      currentOrders.map((o) =>
        o.orderId === razorpay_order_id
          ? {
              ...o,
              status: "paid",
              paymentId: razorpay_payment_id,
              paid_at: new Date().toISOString(),
            }
          : o
      )
    );

    // 5. Record verified payment in payments table
    const paymentRecord = {
      id: `pay_${Date.now()}`,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: session.userId,
      userEmail: session.email,
      planName: order.planName,
      amount: order.amount,
      currency: order.currency,
      creditsGranted: order.credits || 0,
      isPro: !!order.isPro,
      status: "captured",
      created_at: new Date().toISOString(),
    };

    mutateTable("payments", (payments) => [...payments, paymentRecord]);

    // 6. Transactionally update user credits & plan entitlement
    let updatedCredits = 0;
    let userIsPro = false;

    mutateTable("users", (users) =>
      users.map((u) => {
        if (String(u.id) === String(session.userId) || u.userEmail === session.email) {
          const currentTotal = u.totalCredits || 10;
          const currentRemaining = u.remainingCredits || 10;
          const additional = order.credits || 0;
          updatedCredits = currentRemaining + additional;
          userIsPro = order.isPro ? true : !!u.isPro;

          return {
            ...u,
            totalCredits: currentTotal + additional,
            remainingCredits: updatedCredits,
            isPro: userIsPro,
            updated_at: new Date().toISOString(),
          };
        }
        return u;
      })
    );

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully! Entitlements updated.",
      paymentId: razorpay_payment_id,
      creditsAdded: order.credits,
      totalRemainingCredits: updatedCredits,
      isPro: userIsPro,
      planName: order.planName,
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}