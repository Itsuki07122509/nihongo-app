const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 
module.exports = async (req, res) => {
  // CORS
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
    // Firebase Admin を毎回初期化
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined,
        }),
      });
    }
    
    const db = admin.firestore();
 
    console.log('Event type:', event.type);
 
    switch (event.type) {
 
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId || session.subscription_data?.metadata?.userId;
        console.log('checkout completed, userId:', userId);
 
        if (userId) {
          await db.collection('users').doc(userId).set({
            premium: true,
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan: session.metadata?.plan || 'monthly',
          }, { merge: true });
          console.log('✅ User upgraded to Premium:', userId);
        }
        break;
      }
 
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const userId = invoice.parent?.subscription_details?.metadata?.userId 
                    || invoice.lines?.data?.[0]?.metadata?.userId;
        console.log('invoice paid, userId:', userId);
 
        if (userId) {
          await db.collection('users').doc(userId).set({
            premium: true,
            premiumRenewedAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: invoice.customer,
          }, { merge: true });
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
