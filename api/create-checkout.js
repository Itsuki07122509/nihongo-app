const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 
module.exports = async (req, res) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
 
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
 
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  try {
    const { userId, email, plan } = req.body;
 
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
 
    const siteUrl = process.env.SITE_URL || 'https://nihongo-app-orcin.vercel.app';
 
    const priceId = plan === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;
 
    if (!priceId) {
      return res.status(500).json({ error: 'Price ID not configured' });
    }
 
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      metadata: {
        userId: userId,
        plan: plan || 'monthly',
      },
      customer_email: email || undefined,
      success_url: `${siteUrl}/NihonGo_App.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/NihonGo_App.html?payment=cancelled`,
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });
 
    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
 
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
};
