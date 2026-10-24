import axios from "axios";
import { create } from "zustand";
import { toast } from "sonner";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayStore {
  amount: number;
  loading: boolean;
  message: string;
  selectedPlanId?: string;

  setAmount: (value: number) => void;
  setSelectedPlanId: (planId: string) => void;
  resetMessage: () => void;
  startPayment: (onSuccessCallback?: () => void) => Promise<void>;
}

export const useRazorpayStore = create<RazorpayStore>((set, get) => ({
  amount: 699,
  loading: false,
  message: "",
  selectedPlanId: undefined,

  setAmount: (value) => set({ amount: value }),
  setSelectedPlanId: (planId) => set({ selectedPlanId: planId }),
  resetMessage: () => set({ message: "" }),

  startPayment: async (onSuccessCallback) => {
    const { amount, selectedPlanId } = get();
    set({ loading: true, message: "" });

    try {
      // 1. Request secure order from server endpoint
      const { data: orderData } = await axios.post(
        "/api/razorpay/create-order",
        { planId: selectedPlanId, customAmount: amount },
        { headers: { "Content-Type": "application/json" } }
      );

      if (!orderData.orderId) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const orderId = orderData.orderId;

      // Handle payment completion
      const applyEntitlementResult = async (verifyRes: Response) => {
        try {
          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            const successMsg = `✅ Payment verified! ${verifyData.creditsAdded ? `Added ${verifyData.creditsAdded} credits.` : ""}`;
            set({ message: successMsg });
            toast.success(successMsg);
            if (onSuccessCallback) onSuccessCallback();
          } else {
            const failMsg = `❌ Payment verification failed: ${verifyData.message}`;
            set({ message: failMsg });
            toast.error(failMsg);
          }
        } catch (err: any) {
          const errMsg = `❌ Verification error: ${err.message}`;
          set({ message: errMsg });
          toast.error(errMsg);
        } finally {
          set({ loading: false });
        }
      };

      const handleVerification = async (paymentResult: RazorpayResponse) => {
        await applyEntitlementResult(
          await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paymentResult),
          })
        );
      };

      // 2. Check if official Razorpay checkout script is loaded and real key is present
      const isLiveKey = orderData.keyId && orderData.keyId.startsWith("rzp_") && !orderData.isSimulated;
      const isRazorpayScriptLoaded = typeof window !== "undefined" && (window as any).Razorpay;

      if (isLiveKey && isRazorpayScriptLoaded) {
        const options: RazorpayOptions = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || "INR",
          name: "Mentlio",
          description: `${orderData.planName || "Career Accelerator"} — Mentlio`,
          order_id: orderId,
          handler: handleVerification,
          prefill: {
            name: "Mentlio User",
            email: "user@mentlio.local",
            contact: "+91 9999999999",
          },
          theme: {
            color: "#4f46e5",
          },
          modal: {
            ondismiss: () => {
              set({ loading: false, message: "Payment checkout cancelled." });
              toast("Payment cancelled");
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else if (orderData.isSimulated) {
        // Development-only payment simulator: the server finalizes the order it
        // created, so no signature is ever forged in the browser.
        console.log("ℹ️ Executing development Test Mode payment simulation for order:", orderId);

        // Emulate realistic payment delay
        await new Promise((resolve) => setTimeout(resolve, 600));

        await applyEntitlementResult(
          await fetch("/api/razorpay/simulate-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          })
        );
      } else {
        const msg = "❌ Payment failed: Razorpay checkout could not be loaded. Please try again.";
        set({ message: msg, loading: false });
        toast.error(msg);
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      const msg = `❌ Payment failed: ${error?.response?.data?.error || error.message || "Please try again."}`;
      set({ message: msg, loading: false });
      toast.error(msg);
    }
  },
}));
