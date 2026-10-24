import { getTable, mutateTable } from "@/lib/auth/db";

export type FinalizeResult =
  | { ok: true; creditsAdded: number; totalRemainingCredits: number; isPro: boolean; planName: string; alreadyProcessed: boolean }
  | { ok: false; status: number; message: string };

// Marks an order paid, records the payment and grants its entitlements.
// Callers must have already authenticated the session and verified payment.
export function finalizePaidOrder(
  orderId: string,
  paymentId: string,
  session: { userId: string; email: string }
): FinalizeResult {
  const order = getTable("orders").find((o) => o.orderId === orderId);
  if (!order) return { ok: false, status: 404, message: "Order not found or expired" };

  if (String(order.userId) !== String(session.userId)) {
    return { ok: false, status: 403, message: "This order does not belong to your account." };
  }

  if (order.status === "paid") {
    return {
      ok: true,
      creditsAdded: order.credits || 0,
      totalRemainingCredits: 0,
      isPro: !!order.isPro,
      planName: order.planName,
      alreadyProcessed: true,
    };
  }

  mutateTable("orders", (currentOrders) =>
    currentOrders.map((o) =>
      o.orderId === orderId
        ? { ...o, status: "paid", paymentId, paid_at: new Date().toISOString() }
        : o
    )
  );

  mutateTable("payments", (payments) => [
    ...payments,
    {
      id: `pay_${Date.now()}`,
      orderId,
      paymentId,
      userId: session.userId,
      userEmail: session.email,
      planName: order.planName,
      amount: order.amount,
      currency: order.currency,
      creditsGranted: order.credits || 0,
      isPro: !!order.isPro,
      status: "captured",
      created_at: new Date().toISOString(),
    },
  ]);

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

  return {
    ok: true,
    creditsAdded: order.credits || 0,
    totalRemainingCredits: updatedCredits,
    isPro: userIsPro,
    planName: order.planName,
    alreadyProcessed: false,
  };
}
