import { useState } from 'react';
import { supabase } from './lib/supabase';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-checkout-script')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

export default function PremiumCheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setError(null);
    setLoading(true);

    try {
      // --------------------------------------------------
      // 1. Make sure the user is logged in
      // --------------------------------------------------

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);

        setError('Unable to verify your login session.');
        setLoading(false);
        return;
      }

      if (!session?.access_token) {
        setError('Please sign in before purchasing Premium.');
        setLoading(false);
        return;
      }

      // --------------------------------------------------
      // 2. Load Razorpay
      // --------------------------------------------------

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        setError('Unable to load Razorpay.');
        setLoading(false);
        return;
      }

      // --------------------------------------------------
      // 3. Create Razorpay order
      // --------------------------------------------------

      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        console.error('Create order failed:', orderData);

        setError(
          orderData?.error ||
            'Unable to create the Razorpay order.'
        );

        setLoading(false);
        return;
      }

      // --------------------------------------------------
      // 4. Open Razorpay Checkout
      // --------------------------------------------------

      const options = {
        key: 'rzp_test_TWKBVrmhzbCH1E',

        amount: orderData.amount,

        currency: orderData.currency,

        name: 'Kazan MBBS',

        description: 'Premium Access - 249 Days',

        order_id: orderData.orderId,

        handler: async (response: any) => {
          try {
            // --------------------------------------------------
            // 5. Get latest Supabase session
            // --------------------------------------------------

            const {
              data: { session: latestSession },
            } = await supabase.auth.getSession();

            if (!latestSession?.access_token) {
              setError(
                'Payment succeeded, but your login session expired. Please sign in again.'
              );

              setLoading(false);
              return;
            }

            // --------------------------------------------------
            // 6. Verify payment on server
            // --------------------------------------------------

            const verifyRes = await fetch(
              '/api/verify-payment',
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',

                  Authorization:
                    `Bearer ${latestSession.access_token}`,
                },

                body: JSON.stringify(response),
              }
            );

            const verifyData = await verifyRes.json();

            console.log(
              'Payment verification response:',
              verifyData
            );

            // --------------------------------------------------
            // 7. Payment + Premium activation successful
            // --------------------------------------------------

            if (
              verifyRes.ok &&
              verifyData.verified &&
              verifyData.premium
            ) {
              alert(
                'Premium unlocked successfully!'
              );

              setError(null);

              // Reload so the app can pick up Premium status
              window.location.reload();

              return;
            }

            // --------------------------------------------------
            // 8. Show REAL backend error
            // --------------------------------------------------

            setError(
              verifyData?.error ||
                'Payment verification failed.'
            );
          } catch (error) {
            console.error(
              'Payment verification request failed:',
              error
            );

            setError(
              'Payment was completed, but the server could not verify it. Check the Vercel logs.'
            );
          } finally {
            setLoading(false);
          }
        },

        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },

        theme: {
          color: '#8b5cf6',
        },
      };

      const razorpay =
        new window.Razorpay(options);

      razorpay.on(
        'payment.failed',
        (response: any) => {
          console.error(
            'Razorpay payment failed:',
            response
          );

          setError(
            response?.error?.description ||
              'Payment could not be processed. Please try again.'
          );

          setLoading(false);
        }
      );

      razorpay.open();
    } catch (error) {
      console.error(
        'Payment process error:',
        error
      );

      setError(
        'Something went wrong while starting the payment.'
      );

      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          textAlign: 'center',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            fontSize: '42px',
            fontWeight: 800,
            color: '#ffffff',
          }}
        >
          ₹249
        </div>

        <div
          style={{
            marginTop: '8px',
            fontSize: '15px',
            color: '#cbd5e1',
          }}
        >
          Premium Access for 249 Days
        </div>

        <div
          style={{
            marginTop: '6px',
            fontSize: '13px',
            color: '#94a3b8',
          }}
        >
          Unlimited MCQs • Progress Tracking • Mistake Practice
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: '18px',
          padding: '16px 24px',
          background:
            'linear-gradient(135deg,#8b5cf6 0%,#ec4899 50%,#f59e0b 100%)',
          color: '#fff',
          fontSize: '18px',
          fontWeight: 800,
          cursor: loading
            ? 'not-allowed'
            : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? 'Processing Payment...'
          : '🚀 Unlock Premium Now'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '10px',
            color: '#fca5a5',
            background: 'rgba(239,68,68,0.10)',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
