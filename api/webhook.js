const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripeのplanメタデータ → Firestoreに保存するpremiumPlanのマッピング
function resolvePremiumPlan(rawPlan) {
  if (rawPlan === 'ume' || rawPlan === 'take' || rawPlan === 'matsu') return rawPlan;
  // 旧データ（monthly/yearly）との互換: 明確でなければTAKE相当とみなす
  return 'take';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
 
  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: err.message });
  }
 
  try {
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      // 改行文字を複数パターンで処理
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      // パターン1: \\n → \n
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // パターン2: まだ改行がなければ強制変換
      if (!privateKey.includes('\n')) {
        privateKey = privateKey
          .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
          .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----\n');
      }
 
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    }
    
    const db = admin.firestore();
 
    console.log('Event type:', event.type);
 
    switch (event.type) {
 
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Try multiple places where userId might be stored
        const userId = session.metadata?.userId
                    || session.subscription_data?.metadata?.userId
                    || session.client_reference_id;
        const rawPlan = session.metadata?.plan;
        const premiumPlan = resolvePremiumPlan(rawPlan);
        console.log('checkout completed, userId:', userId, 'plan:', premiumPlan, 'session:', session.id);
 
        if (userId) {
          await db.collection('users').doc(userId).set({
            premium: true,
            premiumPlan: premiumPlan,
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan: premiumPlan === 'matsu' ? 'yearly' : 'monthly',
          }, { merge: true });
          console.log('✅ User upgraded to Premium:', userId, premiumPlan);
        }
        break;
      }
 
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const userId = invoice.parent?.subscription_details?.metadata?.userId 
                    || invoice.lines?.data?.[0]?.metadata?.userId;
        const rawPlan = invoice.parent?.subscription_details?.metadata?.plan
                    || invoice.lines?.data?.[0]?.metadata?.plan;
        console.log('invoice paid, userId:', userId);
 
        if (userId) {
          const updateData = {
            premium: true,
            premiumRenewedAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: invoice.customer,
          };
          // 更新のたびにplanメタデータが取れていれば同期しておく（プラン変更の反映漏れ防止）
          if (rawPlan) updateData.premiumPlan = resolvePremiumPlan(rawPlan);
          await db.collection('users').doc(userId).set(updateData, { merge: true });
          console.log('✅ Premium renewed:', userId);
        }
        break;
      }
 
      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        const obj = event.data.object;
        const customerId = obj.customer;
 
        const usersSnap = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
 
        if (!usersSnap.empty) {
          await usersSnap.docs[0].ref.update({
            premium: false,
            premiumEndedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log('❌ Premium cancelled for:', customerId);
        }
        break;
      }
 
      default:
        console.log('Unhandled event:', event.type);
    }
 
    return res.status(200).json({ received: true });
 
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message });
  }
};
 
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
