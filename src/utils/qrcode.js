const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateQR(text) {
  const tmpDir = path.join(__dirname, '..', '..', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `qr_${Date.now()}.png`);
  await QRCode.toFile(filePath, text, {
    color: { dark: '#ffffff', light: '#2b2d31' },
    width: 200,
    margin: 2,
  });
  return filePath;
}

module.exports = { generateQR };
