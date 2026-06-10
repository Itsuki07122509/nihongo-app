// api/webhook.js
// Stripe決済完了後にFirestoreのユーザーをPremiumにする
 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 
// Firebase Admin SDK
let admin;
let db;
 
function initFirebase() {
  if (db) return; // already initialized
  if (!admin) {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }
  db = admin.firestore();
}
 
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
 
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
 
  let event;
  try {
    // Stripeの署名を検証（セキュリティ上必須）
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
 
  try {
    initFirebase();
 
    switch (event.type) {
 
      // ✅ 決済成功 → Premiumに昇格
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
 
        if (userId) {
          await db.collection('users').doc(userId).set({
            premium: true,
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan: session.metadata?.plan || 'monthly',
          }, { merge: true });
 
          console.log(`✅ User ${userId} upgraded to Premium`);
        }
        break;
      }
 
      // ✅ サブスクリプション更新成功（毎月の支払い）
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
 
        // customerId から userId を取得
        const usersSnap = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
 
        if (!usersSnap.empty) {
          await usersSnap.docs[0].ref.update({
            premium: true,
            premiumRenewedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`✅ Subscription renewed for customer ${customerId}`);
        }
        break;
      }
 
      // ❌ 支払い失敗 → Premiumを停止
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
          console.log(`❌ Premium cancelled for customer ${customerId}`);
        }
        break;
      }
 
      default:
        console.log(`Unhandled event: ${event.type}`);
    }
 
    return res.status(200).json({ received: true });
 
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message });
  }
};
 
// Vercelでraw bodyを取得するヘルパー
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
