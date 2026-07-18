const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// プラン → Stripe価格ID(環境変数名) のマッピング
// UME:  月額 75,000₫  相当（スタミナ無制限＋少々のコンテンツ）
// TAKE: 月額 149,000₫ 相当（全機能）
// MATSU: 年額 1,490,000₫ 相当（TAKE全機能＋限定特典）
const PRICE_ENV_MAP = {
  ume: 'STRIPE_PRICE_UME',
  take: 'STRIPE_PRICE_TAKE',
  matsu: 'STRIPE_PRICE_MATSU',
};

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

    const normalizedPlan = (plan === 'ume' || plan === 'take' || plan === 'matsu') ? plan : 'take';

    const siteUrl = process.env.SITE_URL || 'https://nihongo-app-orcin.vercel.app';

    const envVarName = PRICE_ENV_MAP[normalizedPlan];
    const priceId = process.env[envVarName];

    if (!priceId) {
      console.error(`Price ID not configured for plan "${normalizedPlan}" (expected env var ${envVarName})`);
      return res.status(500).json({ error: `Price ID not configured for plan: ${normalizedPlan}` });
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
        plan: normalizedPlan,
      },
      client_reference_id: userId,  // backup userId
      customer_email: email || undefined,
      success_url: `${siteUrl}/NihonGo_App.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/NihonGo_App.html?payment=cancelled`,
      subscription_data: {
        metadata: {
          userId: userId,
          plan: normalizedPlan,
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
