// api/check-premium.js
// フロントエンドからPremium状態を確認するAPI

let admin;
let db;

function initFirebase() {
  if (db) return;
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
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    initFirebase();
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return res.status(200).json({ premium: false });

    const data = doc.data();
    return res.status(200).json({
      premium: data.premium === true,
      plan: data.plan || 'monthly',
      since: data.premiumSince?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
