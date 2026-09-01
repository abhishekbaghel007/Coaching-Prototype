export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({
      error: 'Server configuration error: Razorpay credentials are not configured.',
    });
  }

  try {
    const receipt = `kazan_${Date.now()}`;

    const orderPayload = {
      amount: 24900,
      currency: 'INR',
      receipt,
      notes: {
        product: 'Kazan MBBS Premium',
        duration: '249 days',
      },
    };

    const authHeader =
      'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      return res.status(razorpayResponse.status).json({
        error:
          (data && data.error && data.error.description) ||
          'Failed to create Razorpay order.',
      });
    }

    return res.status(200).json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Unexpected server error while creating the order.',
    });
  }
}
