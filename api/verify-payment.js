import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);

    return res.status(405).json({
      verified: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    // --------------------------------------------------
    // 1. Validate Razorpay response
    // --------------------------------------------------

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        verified: false,
        error: 'Missing required Razorpay payment fields.',
      });
    }

    // --------------------------------------------------
    // 2. Environment variables
    // --------------------------------------------------

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey =
       process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials are missing.');

      return res.status(500).json({
        verified: false,
        error: 'Razorpay is not configured correctly.',
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase server credentials are missing.');

      return res.status(500).json({
        verified: false,
        error: 'Supabase server configuration is incomplete.',
      });
    }

    // --------------------------------------------------
    // 3. Get logged-in Supabase user
    // --------------------------------------------------

    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        verified: false,
        error: 'You must be logged in to purchase Premium.',
      });
    }

    const accessToken = authHeader
      .replace('Bearer ', '')
      .trim();

    if (!accessToken) {
      return res.status(401).json({
        verified: false,
        error: 'Authentication token is missing.',
      });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      console.error(
        'Supabase authentication failed:',
        userError
      );

      return res.status(401).json({
        verified: false,
        error: 'Your login session is invalid or expired.',
      });
    }

    // --------------------------------------------------
    // 4. Verify Razorpay signature
    // --------------------------------------------------

    const payload =
      `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(
      expectedSignature,
      'utf8'
    );

    const receivedBuffer = Buffer.from(
      razorpay_signature,
      'utf8'
    );

    const signatureValid =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!signatureValid) {
      console.warn('Invalid Razorpay signature.');

      return res.status(400).json({
        verified: false,
        error: 'Payment verification failed.',
      });
    }

    // --------------------------------------------------
    // 5. Fetch payment directly from Razorpay
    // --------------------------------------------------

    const razorpayAuth =
      'Basic ' +
      Buffer.from(
        `${keyId}:${keySecret}`
      ).toString('base64');

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        razorpay_payment_id
      )}`,
      {
        method: 'GET',
        headers: {
          Authorization: razorpayAuth,
        },
      }
    );

    const paymentData =
      await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        'Razorpay payment lookup failed:',
        paymentData
      );

      return res.status(400).json({
        verified: false,
        error:
          'Unable to confirm payment with Razorpay.',
      });
    }

    // --------------------------------------------------
    // 6. Confirm payment details
    // --------------------------------------------------

    if (Number(paymentData.amount) !== 24900) {
      return res.status(400).json({
        verified: false,
        error:
          'Payment amount does not match the ₹249 Premium plan.',
      });
    }

    if (paymentData.currency !== 'INR') {
      return res.status(400).json({
        verified: false,
        error: 'Invalid payment currency.',
      });
    }

    if (
      paymentData.order_id !==
      razorpay_order_id
    ) {
      return res.status(400).json({
        verified: false,
        error:
          'Payment does not belong to this order.',
      });
    }

    if (paymentData.status !== 'captured') {
      return res.status(400).json({
        verified: false,
        error:
          `Payment is not captured yet. Current status: ${paymentData.status}`,
      });
    }

    // --------------------------------------------------
    // 7. Prevent duplicate payment processing
    // --------------------------------------------------

    const {
      data: existingPayment,
      error: existingPaymentError,
    } = await supabaseAdmin
      .from('subscriptions')
      .select(
        'id, user_id, status, expires_at'
      )
      .eq(
        'payment_id',
        razorpay_payment_id
      )
      .maybeSingle();

    if (existingPaymentError) {
      console.error(
        'Subscription lookup failed:',
        existingPaymentError
      );

      return res.status(500).json({
        verified: false,
        error:
          'Unable to check subscription status.',
      });
    }

    if (existingPayment) {
      if (
        existingPayment.user_id !==
        user.id
      ) {
        return res.status(403).json({
          verified: false,
          error:
            'This payment is already associated with another account.',
        });
      }

      return res.status(200).json({
        verified: true,
        premium: true,
        alreadyProcessed: true,
        expiresAt:
          existingPayment.expires_at,
        orderId:
          razorpay_order_id,
        paymentId:
          razorpay_payment_id,
      });
    }

    // --------------------------------------------------
    // 8. Calculate 249-day Premium period
    // --------------------------------------------------

    const now = new Date();

    let startsAt = new Date(now);
    let expiresAt = new Date(now);

    // --------------------------------------------------
    // 9. Extend existing active Premium if present
    // --------------------------------------------------

    const {
      data: currentSubscription,
      error:
        currentSubscriptionError,
    } = await supabaseAdmin
      .from('subscriptions')
      .select(
        'id, expires_at, status'
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'status',
        'active'
      )
      .order(
        'expires_at',
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (currentSubscriptionError) {
      console.error(
        'Current subscription lookup failed:',
        currentSubscriptionError
      );

      return res.status(500).json({
        verified: false,
        error:
          'Unable to check your Premium subscription.',
      });
    }

    if (
      currentSubscription &&
      currentSubscription.expires_at
    ) {
      const currentExpiry =
        new Date(
          currentSubscription.expires_at
        );

      if (currentExpiry > now) {
        startsAt = currentExpiry;
        expiresAt =
          new Date(currentExpiry);
      }
    }

    expiresAt.setDate(
      expiresAt.getDate() + 249
    );

    // --------------------------------------------------
    // 10. Create Premium subscription
    // --------------------------------------------------

    const {
      data: subscription,
      error: insertError,
    } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan: 'yearly',
        amount: 249,
        status: 'active',
        payment_id:
          razorpay_payment_id,
        starts_at:
          startsAt.toISOString(),
        expires_at:
          expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error(
        'Failed to create subscription:',
        insertError
      );

      return res.status(500).json({
        verified: false,
        error:
          'Payment verified, but Premium activation failed.',
      });
    }

    // --------------------------------------------------
    // 11. Success
    // --------------------------------------------------

    console.log(
      'Premium activated successfully:',
      {
        userId: user.id,
        subscriptionId:
          subscription.id,
        paymentId:
          razorpay_payment_id,
        orderId:
          razorpay_order_id,
        expiresAt:
          expiresAt.toISOString(),
      }
    );

    return res.status(200).json({
      verified: true,
      premium: true,
      subscriptionId:
        subscription.id,
      orderId:
        razorpay_order_id,
      paymentId:
        razorpay_payment_id,
      expiresAt:
        expiresAt.toISOString(),
    });
  } catch (error) {
    console.error(
      'Razorpay verification error:',
      error
    );

    return res.status(500).json({
      verified: false,
      error:
        'Unexpected server error while processing the payment.',
    });
  }
}
