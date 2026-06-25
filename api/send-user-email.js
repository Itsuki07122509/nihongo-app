const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { type, userName, userEmail } = req.body;
  if (!userEmail) {
    return res.status(400).json({ error: 'userEmail is required' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const name = userName || 'bạn';

  let subject = '';
  let html = '';

  if (type === 'welcome') {
    subject = '🎌 Chào mừng đến với NihonGo! / NihonGo!へようこそ';
    html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFBF7;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1D3557,#457B9D);padding:28px 24px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#fff">🎌 NihonGo!</div>
      </div>
      <div style="padding:28px 24px">
        <h1 style="font-size:20px;color:#1D3557;margin:0 0 8px">Chào mừng ${name}! 🎉</h1>
        <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px">
          Cảm ơn bạn đã đăng ký NihonGo! Hãy bắt đầu hành trình học tiếng Nhật thật vui và thực tế ngay hôm nay nhé.
        </p>
        <div style="background:#fff;border:1.5px solid #F0F0F0;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;color:#1D3557;font-weight:700;margin-bottom:10px">✨ Bạn có thể bắt đầu với:</div>
          <div style="font-size:13px;color:#555;line-height:1.8">
            📖 Hiragana · Katakana · Kanji cơ bản<br>
            🛒 Tiếng Nhật đời thực: siêu thị, nhà hàng, bệnh viện...<br>
            🎯 Quiz vui để ghi nhớ từ vựng<br>
            🎥 Live Lesson cùng người Nhật (Premium)
          </div>
        </div>
        <div style="text-align:center;margin:20px 0">
          <a href="https://nihongo-app-orcin.vercel.app/NihonGo_App.html" style="display:inline-block;background:#C1121F;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:13px 32px;border-radius:24px">
            🚀 Bắt đầu học ngay
          </a>
        </div>
        <p style="font-size:11px;color:#999;text-align:center;margin-top:20px">
          ご登録ありがとうございます！日本語学習を楽しんでください 🌸<br>
          Có câu hỏi gì, liên hệ: nihongoapp.contact@gmail.com
        </p>
      </div>
    </div>`;
  } else if (type === 'premium_thanks') {
    subject = '⭐ Cảm ơn bạn đã đăng ký Premium! / Premium登録ありがとうございます';
    html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFBF7;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(150deg,#0B1B33,#1D3557,#3A2459);padding:28px 24px;text-align:center">
        <div style="font-size:13px;font-weight:800;color:#FFD27A;letter-spacing:2px">✨ PREMIUM</div>
        <div style="font-size:24px;font-weight:900;color:#fff;margin-top:4px">Cảm ơn ${name}! 🎉</div>
      </div>
      <div style="padding:28px 24px">
        <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px">
          Bạn đã chính thức trở thành thành viên <b>Premium</b> của NihonGo! Toàn bộ tính năng đã được mở khóa.
        </p>
        <div style="background:#fff;border:1.5px solid #FDE9C8;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;color:#1D3557;font-weight:700;margin-bottom:10px">⭐ Bạn vừa mở khóa:</div>
          <div style="font-size:13px;color:#555;line-height:1.8">
            📚 6 khóa học theo tình huống (bạn bè, tình yêu, công việc...)<br>
            🔥 Tiếng lóng & ngôn ngữ Gen Z<br>
            🎥 Live Lesson cùng người Nhật (5 buổi/tháng)<br>
            ✏️ Bảng sửa bài bởi người Nhật bản ngữ<br>
            🚫 Không quảng cáo
          </div>
        </div>
        <div style="text-align:center;margin:20px 0">
          <a href="https://nihongo-app-orcin.vercel.app/NihonGo_App.html" style="display:inline-block;background:linear-gradient(135deg,#FFD27A,#F4A261);color:#1D3557;text-decoration:none;font-weight:800;font-size:14px;padding:13px 32px;border-radius:24px">
            ⭐ Khám phá Premium Hub
          </a>
        </div>
        <p style="font-size:11px;color:#999;text-align:center;margin-top:20px">
          ご購入ありがとうございます！プレミアム機能をお楽しみください ⭐<br>
          Có câu hỏi gì, liên hệ: nihongoapp.contact@gmail.com
        </p>
      </div>
    </div>`;
  } else {
    return res.status(400).json({ error: 'invalid type' });
  }

  try {
    await resend.emails.send({
      from: 'NihonGo! <onboarding@resend.dev>',
      to: userEmail,
      subject: subject,
      html: html,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
