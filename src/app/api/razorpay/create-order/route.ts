import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getServerSession } from "@/lib/auth/session";
import { mutateTable } from "@/lib/auth/db";

// Server-trusted pricing catalog
export const TRUSTED_PLANS: Record<
  string,
  { name: string; type: "subscription" | "topup"; amountInINR: number; credits: number; isPro: boolean }
> = {
  pro_monthly: {
    name: "Pro Plan (Monthly)",
    type: "subscription",
    amountInINR: 699,
    credits: 100,
    isPro: true,
  },
  pro_yearly: {
    name: "Pro Plan (Yearly)",
    type: "subscription",
    amountInINR: 559, // 699 * 0.8
    credits: 100,
    isPro: true,
  },
  topup_25: {
    name: "Top Up 25 Credits",
    type: "topup",
    amountInINR: 410, // 25 * 20 - 90
    credits: 25,
    isPro: false,
  },
  topup_50: {
    name: "Top Up 50 Credits",
    type: "topup",
    amountInINR: 910, // 50 * 20 - 90
    credits: 50,
    isPro: false,
  },
  topup_100: {
    name: "Top Up 100 Credits",
    type: "topup",
    amountInINR: 1910, // 100 * 20 - 90
    credits: 100,
    isPro: false,
  },
  topup_200: {
    name: "Top Up 200 Credits",
    type: "topup",
    amountInINR: 3910, // 200 * 20 - 90
    credits: 200,
    isPro: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Authentication required to initiate payment." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { planId, customAmount, currency = "INR" } = body;

    // Resolve plan and verify amount server-side
    let trustedPlan = planId ? TRUSTED_PLANS[planId] : undefined;
    let verifiedAmountInINR: number;
    let grantedCredits = 0;
    let planName = "Custom Top Up";
    let isPro = false;

    if (trustedPlan) {
      verifiedAmountInINR = trustedPlan.amountInINR;
      grantedCredits = trustedPlan.credits;
      planName = trustedPlan.name;
      isPro = trustedPlan.isPro;
    } else if (typeof customAmount === "number" && customAmount > 0) {
      // Find matching plan if amount matches a standard topup or subscription
      const match = Object.values(TRUSTED_PLANS).find((p) => p.amountInINR === customAmount);
      if (match) {
        verifiedAmountInINR = match.amountInINR;
        grantedCredits = match.credits;
        planName = match.name;
        isPro = match.isPro;
      } else {
        verifiedAmountInINR = Math.round(customAmount);
        grantedCredits = Math.max(10, Math.floor(verifiedAmountInINR / 20));
      }
    } else {
      return NextResponse.json(
        { error: "Invalid payment plan or amount requested." },
        { status: 400 }
      );
    }

    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    const receipt = `rcpt_${Date.now()}_${session.userId.slice(-6)}`;
    let orderId: string;
    let isSimulated = false;

    // Check if real Razorpay credentials are configured
    const hasLiveKeys =
      key_id &&
      key_secret &&
      !key_id.includes("dummy") &&
      key_id.startsWith("rzp_");

    if (hasLiveKeys) {
      const razorpay = new Razorpay({
        key_id,
        key_secret,
      });

      const options = {
        amount: verifiedAmountInINR * 100, // paise
        currency,
        receipt,
        payment_capture: 1,
        notes: {
          userId: session.userId,
          userEmail: session.email,
          planName,
          credits: grantedCredits,
        },
      };

      const order = await razorpay.orders.create(options);
      orderId = order.id;
    } else {
      // High-fidelity Test Simulator Order (Cryptographically tied and verified)
      isSimulated = true;
      orderId = `order_test_${crypto.randomBytes(8).toString("hex")}`;
    }

    // Persist pending order in orders database table
    const orderRecord = {
      orderId,
      receipt,
      userId: session.userId,
      userEmail: session.email,
      planName,
      amount: verifiedAmountInINR,
      amountInPaise: verifiedAmountInINR * 100,
      currency,
      credits: grantedCredits,
      isPro,
      isSimulated,
      status: "created",
      created_at: new Date().toISOString(),
    };

    mutateTable("orders", (orders) => [...orders, orderRecord]);

    return NextResponse.json({
      orderId,
      amount: verifiedAmountInINR * 100,
      amountInINR: verifiedAmountInINR,
      currency,
      keyId: hasLiveKeys ? key_id : "rzp_test_mentlio_simulator",
      planName,
      credits: grantedCredits,
      isSimulated,
    });
  } catch (error: any) {
    console.error("Error creating payment order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment order" },
      { status: 500 }
    );
  }
}