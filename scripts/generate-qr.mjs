// One-off script: node scripts/generate-qr.mjs
import QRCode from 'qrcode'
import sharp from 'sharp'

const URL = 'https://formascuole.vercel.app'
const W = 400
const H = 500
const QR_SIZE = 340
const QR_X = (W - QR_SIZE) / 2   // 30
const QR_Y = 30
const FOOTER_H = 110
const FOOTER_Y = H - FOOTER_H    // 390

// 1. Generate QR as base64 PNG (white bg, black modules)
const qrDataUrl = await QRCode.toDataURL(URL, {
  width: QR_SIZE,
  margin: 1,
  color: { dark: '#1a1a1a', light: '#ffffff' },
})
const qrBase64 = qrDataUrl.replace('data:image/png;base64,', '')

// 2. Build SVG composition
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- White background -->
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <!-- QR code image -->
  <image x="${QR_X}" y="${QR_Y}" width="${QR_SIZE}" height="${QR_SIZE}"
         xlink:href="data:image/png;base64,${qrBase64}"/>

  <!-- Red footer -->
  <rect x="0" y="${FOOTER_Y}" width="${W}" height="${FOOTER_H}" fill="#d64b55"/>

  <!-- Footer text: brand name -->
  <text x="${W / 2}" y="${FOOTER_Y + 36}"
        font-family="system-ui, Arial, sans-serif"
        font-size="26" font-weight="700"
        fill="#ffffff" text-anchor="middle">Formascuole</text>

  <!-- Footer text: URL -->
  <text x="${W / 2}" y="${FOOTER_Y + 62}"
        font-family="system-ui, Arial, sans-serif"
        font-size="15" font-weight="400"
        fill="#ffffff" opacity="0.90" text-anchor="middle">formascuole.vercel.app</text>

  <!-- Footer text: call to action -->
  <text x="${W / 2}" y="${FOOTER_Y + 86}"
        font-family="system-ui, Arial, sans-serif"
        font-size="13" font-weight="400"
        fill="#ffffff" opacity="0.75" text-anchor="middle">Scansiona per accedere alla piattaforma</text>
</svg>`

// 3. Rasterize with sharp
await sharp(Buffer.from(svg)).png().toFile('./public/qr-formascuole.png')

console.log('✓ public/qr-formascuole.png generato (400×500px)')
