// One-off script: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('./public/icons', { recursive: true })

/**
 * Build the icon SVG at the given pixel size.
 * Design: dark background #1a1a1a + red overlay, graduation cap (top), open book (bottom).
 */
function buildSvg(size) {
  const r = Math.round((44 / 512) * size)   // border radius
  const cx = size / 2
  const cy = size / 2

  // ── graduation cap ────────────────────────────────────────────────────────
  // Cap board (diamond/square rotated 45°)
  const capW = size * 0.52     // full width of the flat top
  const capH = size * 0.13     // height of the board rhombus
  const capTopY = size * 0.12  // top edge of cap board

  // Mortarboard: flat top represented as a parallelogram/diamond shape
  // We draw it as a simple rhombus centered at (cx, capTopY + capH/2)
  const capCY = capTopY + capH / 2
  const capPoints = [
    `${cx},${capTopY}`,                   // top point
    `${cx + capW / 2},${capCY}`,          // right point
    `${cx},${capTopY + capH}`,            // bottom point
    `${cx - capW / 2},${capCY}`,          // left point
  ].join(' ')

  // Cylindrical base under the board
  const baseW = size * 0.30
  const baseH = size * 0.10
  const baseTop = capTopY + capH * 0.55
  const baseX = cx - baseW / 2

  // Tassel: vertical line + circle on the right
  const tasselX = cx + capW / 2
  const tasselTopY = capCY
  const tasselBotY = capTopY + capH + size * 0.12
  const tasselR = size * 0.035

  // ── open book ─────────────────────────────────────────────────────────────
  const bookTop = size * 0.57
  const bookBot = size * 0.88
  const bookH = bookBot - bookTop
  const bookW = size * 0.62
  const bookX = cx - bookW / 2
  const spineX = cx
  const pageArc = bookW * 0.08  // subtle arc for page curves

  // Left page (brighter)
  const leftPagePts = [
    `${spineX},${bookTop}`,
    `${spineX - bookW / 2 + pageArc},${bookTop + bookH * 0.06}`,
    `${spineX - bookW / 2},${bookTop + bookH * 0.12}`,
    `${spineX - bookW / 2},${bookBot}`,
    `${spineX},${bookBot}`,
  ].join(' ')

  // Right page (slightly dimmer)
  const rightPagePts = [
    `${spineX},${bookTop}`,
    `${spineX + bookW / 2 - pageArc},${bookTop + bookH * 0.06}`,
    `${spineX + bookW / 2},${bookTop + bookH * 0.12}`,
    `${spineX + bookW / 2},${bookBot}`,
    `${spineX},${bookBot}`,
  ].join(' ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="clip">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#1a1a1a"/>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#d64b55" opacity="0.15"/>

  <g clip-path="url(#clip)">
    <!-- Graduation cap board (rhombus) -->
    <polygon points="${capPoints}" fill="white"/>

    <!-- Cap cylindrical base -->
    <rect x="${baseX}" y="${baseTop}" width="${baseW}" height="${baseH}" rx="${baseH * 0.3}" fill="white"/>

    <!-- Tassel line -->
    <line x1="${tasselX}" y1="${tasselTopY}" x2="${tasselX}" y2="${tasselBotY}"
          stroke="#d64b55" stroke-width="${Math.max(2, size * 0.018)}" stroke-linecap="round"/>
    <!-- Tassel circle -->
    <circle cx="${tasselX}" cy="${tasselBotY + tasselR * 0.5}" r="${tasselR}"
            fill="#d64b55"/>

    <!-- Left page -->
    <polygon points="${leftPagePts}" fill="white" opacity="0.92"/>

    <!-- Right page -->
    <polygon points="${rightPagePts}" fill="white" opacity="0.60"/>

    <!-- Spine line -->
    <line x1="${spineX}" y1="${bookTop}" x2="${spineX}" y2="${bookBot}"
          stroke="#1a1a1a" stroke-width="${Math.max(1.5, size * 0.012)}" stroke-linecap="round"/>
  </g>
</svg>`
}

const sizes = [512, 192, 180, 32]

for (const size of sizes) {
  const svg = buildSvg(size)
  const svgBuf = Buffer.from(svg)
  await sharp(svgBuf)
    .png()
    .toFile(`./public/icons/icon-${size}.png`)
  console.log(`✓ icon-${size}.png`)
}

console.log('All icons generated.')
