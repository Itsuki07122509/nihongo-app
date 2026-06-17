const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userName, userEmail, theme, date, sessionId } = req.body;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    // あなたへの通知メール
    await resend.emails.send({
      from: 'NihonGo! <onboarding@resend.dev>',
      to: 'nihongoapp.contact@gmail.com',
      subject: `【NihonGo!】新しいZoom登録がありました`,
      text: `
新しいZoom登録がありました！

名前：${userName}
メール：${userEmail}
テーマ：${theme}
日程：${date}
セッション：${sessionId}

Firestoreで確認してください。
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
