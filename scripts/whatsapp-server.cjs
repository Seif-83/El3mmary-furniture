const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 2785;
const AUTH_DIR = path.join(__dirname, '..', 'whatsapp_session');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let qrCodeRaw = null;
let qrCodeDataUrl = null;
let isConnected = false;
let connectedUser = null;
let isConnecting = false;

const logger = pino({ level: 'silent' });

async function connectToWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: true,
      browser: ['El-Ammari Furniture', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeRaw = qr;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { scale: 8, margin: 2 });
        } catch (err) {
          console.error('Error generating QR code image:', err);
        }
        isConnected = false;
        console.log('\n[WhatsApp] رمز QR جديد جاهز للمسح. افتح http://localhost:' + PORT + ' لمسحه.\n');
      }

      if (connection === 'close') {
        isConnected = false;
        qrCodeRaw = null;
        qrCodeDataUrl = null;
        connectedUser = null;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[WhatsApp] تم قطع الاتصال (السبب: ${statusCode}). إعادة المحاولة: ${shouldReconnect}`);

        if (shouldReconnect) {
          isConnecting = false;
          setTimeout(connectToWhatsApp, 3000);
        } else {
          console.log('[WhatsApp] تم تسجيل الخروج. يرجى مسح الـ QR مجدداً.');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
          isConnecting = false;
          setTimeout(connectToWhatsApp, 2000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        isConnecting = false;
        qrCodeRaw = null;
        qrCodeDataUrl = null;
        connectedUser = sock?.user?.id || 'Connected';
        const cleanPhone = connectedUser.split(':')[0] || connectedUser.split('@')[0];
        console.log(`\n======================================================`);
        console.log(`[WhatsApp] ✅ متصل بنجاح برقم مفروشات العماري: +${cleanPhone}`);
        console.log(`======================================================\n`);
      }
    });
  } catch (err) {
    console.error('[WhatsApp] خطأ أثناء بدء الاتصال:', err);
    isConnecting = false;
    setTimeout(connectToWhatsApp, 5000);
  }
}

connectToWhatsApp();

const app = express();
app.use(express.json());

// Enable CORS for frontend on port 3000
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// HTML Dashboard for easy QR scanning and status check
app.get('/', (req, res) => {
  const phone = connectedUser ? connectedUser.split(':')[0] || connectedUser.split('@')[0] : '';
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خادم واتساب مفروشات العماري</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <meta http-equiv="refresh" content="${isConnected ? 15 : 3}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    body { font-family: 'Cairo', sans-serif; }
  </style>
</head>
<body class="bg-[#faf8f5] text-zinc-900 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-zinc-200/80 text-center">
    <div class="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
      <svg class="w-9 h-9 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.983.54 1.769.814 2.796.814 3.182 0 5.768-2.587 5.768-5.766 0-3.18-2.586-5.766-5.768-5.766zm6.812 5.766c0 3.757-3.056 6.813-6.812 6.813-.996 0-2.023-.275-2.923-.746l-4.108 1.077 1.096-4.004c-.562-.976-.877-2.008-.877-3.14 0-3.757 3.056-6.813 6.812-6.813 3.756 0 6.812 3.056 6.812 6.813z"/>
      </svg>
    </div>

    <h1 class="text-2xl font-bold mb-1">بوابة واتساب مفروشات العماري</h1>
    <p class="text-xs text-zinc-500 mb-6">خادم إرسال رسائل الـ OTP وتحديثات التصنيع تلقائياً للعملاء</p>

    ${
      isConnected
        ? `
      <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
        <div class="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 class="text-lg font-bold text-emerald-800 mb-1">متصل بنجاح ✅</h2>
        <p class="text-sm font-mono text-emerald-700 dir-ltr">+${phone}</p>
        <p class="text-xs text-emerald-600 mt-2">الخادم جاهز لإرسال الـ OTP فوراً لأي عميل يكتب رقمه في الموقع.</p>
      </div>

      <button onclick="fetch('/api/sessions/default/logout', {method:'POST'}).then(()=>location.reload())" class="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer underline">
        تسجيل الخروج وربط رقم آخر
      </button>
    `
        : qrCodeDataUrl
        ? `
      <div class="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 mb-6">
        <p class="text-xs font-bold text-zinc-700 mb-3">امسح الـ QR Code من تطبيق واتساب الخاص بالعماري:</p>
        <img src="${qrCodeDataUrl}" alt="WhatsApp QR Code" class="w-64 h-64 mx-auto rounded-xl shadow-md bg-white p-2 border border-zinc-200">
        <p class="text-[11px] text-zinc-400 mt-3 animate-pulse">يتجدد الرمز تلقائياً كل بضع ثوانٍ...</p>
      </div>

      <div class="text-right text-xs text-zinc-600 space-y-1.5 bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4">
        <p class="font-bold text-amber-900 mb-1">خطوات الربط (مرة واحدة فقط):</p>
        <p>1. افتح تطبيق واتساب على هاتف العماري.</p>
        <p>2. اضغط على <strong>القائمة (⋮)</strong> أو <strong>الإعدادات</strong> > <strong>الأجهزة المرتبطة (Linked Devices)</strong>.</p>
        <p>3. اضغط <strong>ربط جهاز (Link a device)</strong> ووجّه الكاميرا نحو هذا المربع.</p>
      </div>
    `
        : `
      <div class="py-12">
        <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-sm text-zinc-500">جاري بدء جلسة واتساب وتوليد الـ QR Code...</p>
      </div>
    `
    }

    <div class="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
      <span>الحالة: ${isConnected ? '<span class="text-emerald-600 font-bold">متصل</span>' : '<span class="text-amber-600 font-bold">في انتظار المسح</span>'}</span>
      <span>المنفذ: ${PORT}</span>
    </div>
  </div>
</body>
</html>
  `;
  res.send(html);
});

// Status endpoint compatible with OpenWA
app.get('/api/sessions/:sessionId/status', (req, res) => {
  res.json({
    status: isConnected ? 'CONNECTED' : (qrCodeDataUrl ? 'SCAN_QR_CODE' : 'DISCONNECTED'),
    connected: isConnected,
    user: connectedUser,
  });
});

// Send message endpoint compatible with OpenWA
app.post('/api/sessions/:sessionId/messages/send-text', async (req, res) => {
  const { chatId, text } = req.body;

  if (!isConnected || !sock) {
    return res.status(503).json({
      success: false,
      error: 'خادم واتساب غير متصل حالياً. يرجى مسح رمز الـ QR Code أولاً على http://localhost:' + PORT,
    });
  }

  if (!chatId || !text) {
    return res.status(400).json({
      success: false,
      error: 'chatId and text are required',
    });
  }

  try {
    let target = chatId.trim();
    // Format: if it ends with @c.us change to @s.whatsapp.net for Baileys
    if (target.endsWith('@c.us')) {
      target = target.replace('@c.us', '@s.whatsapp.net');
    } else if (!target.includes('@')) {
      target = `${target}@s.whatsapp.net`;
    }

    console.log(`[WhatsApp] 📤 إرسال رسالة إلى: ${target}...`);
    const sent = await sock.sendMessage(target, { text });
    console.log(`[WhatsApp] ✅ تم الإرسال بنجاح! Message ID: ${sent?.key?.id}`);

    res.json({
      success: true,
      messageId: sent?.key?.id,
    });
  } catch (err) {
    console.error('[WhatsApp] ❌ خطأ أثناء إرسال الرسالة:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send WhatsApp message',
    });
  }
});

// Logout endpoint
app.post('/api/sessions/:sessionId/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    isConnected = false;
    qrCodeRaw = null;
    qrCodeDataUrl = null;
    connectedUser = null;
    setTimeout(connectToWhatsApp, 1000);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 خادم واتساب مفروشات العماري يعمل الآن على:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});
