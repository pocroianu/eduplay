import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'thumbnails', 'games')
mkdirSync(OUT, { recursive: true })

const W = 640
const H = 360

const palette = {
  vocabulary: { start: '#f7ba00', end: '#ff9c44', ink: '#4a2d00' },
  math: { start: '#83e881', end: '#006b1b', ink: '#003a0c' },
  shapes: { start: '#ffb877', end: '#ff7a2e', ink: '#5a2500' },
  literacy: { start: '#6aa7ef', end: '#00518f', ink: '#002a47' },
}

const font = `font-family="system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"`

function frame(categoryColors, ribbonTitle, innerSvg) {
  const { start, end, ink } = categoryColors
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${start}"/>
      <stop offset="1" stop-color="${end}"/>
    </linearGradient>
    <radialGradient id="spot" cx="0.2" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#spot)"/>
  <g>${innerSvg}</g>
  <rect x="0" y="${H - 64}" width="${W}" height="64" fill="${ink}" fill-opacity="0.78"/>
  <text x="${W / 2}" y="${H - 23}" ${font} font-size="26" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${ribbonTitle}</text>
</svg>`
}

// Reusable chip used across variants: big rounded square token with a label.
function chip(x, y, label, fill = '#ffffff', stroke = '#ffffff', labelColor = '#1a1a1a') {
  return `
    <g transform="translate(${x},${y})">
      <rect x="-56" y="-44" width="112" height="88" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="3" />
      <text x="0" y="8" ${font} font-size="20" font-weight="700" fill="${labelColor}" text-anchor="middle">${label}</text>
    </g>`
}

function card(x, y, faceUp, faceSvg, tint = '#ffffff') {
  if (faceUp) {
    return `
      <g transform="translate(${x},${y})">
        <rect x="-44" y="-58" width="88" height="116" rx="12" fill="${tint}" stroke="#ffffff" stroke-width="3"/>
        ${faceSvg}
      </g>`
  }
  return `
    <g transform="translate(${x},${y})">
      <rect x="-44" y="-58" width="88" height="116" rx="12" fill="#0f172a" stroke="#ffffff" stroke-width="3"/>
      <text x="0" y="14" ${font} font-size="52" font-weight="800" fill="#ffffff" text-anchor="middle">?</text>
    </g>`
}

function pair(x, label, dot) {
  return `
    <g transform="translate(${x},180)">
      <circle cx="-70" cy="0" r="44" fill="${dot}" stroke="#ffffff" stroke-width="3"/>
      <line x1="-26" y1="0" x2="26" y2="0" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-dasharray="4 8"/>
      <rect x="26" y="-32" width="108" height="64" rx="14" fill="#ffffff"/>
      <text x="80" y="8" ${font} font-size="22" font-weight="800" fill="#1a1a1a" text-anchor="middle">${label}</text>
    </g>`
}

// 1. matching: animals
const animalsMatch = frame(
  palette.vocabulary,
  'Nume de animale',
  `${pair(160, 'pisică', '#f4a261')}
   ${pair(160 + 260, 'câine', '#8ecae6')}`,
)

// 2. matching: food
const foodMatch = frame(
  palette.vocabulary,
  'Mâncarea mea preferată',
  `${pair(160, 'măr', '#ef4444')}
   ${pair(160 + 260, 'banană', '#facc15')}`,
)

const pawFace = `
  <circle cx="0" cy="6" r="18" fill="#7c2d12"/>
  <circle cx="-14" cy="-14" r="7" fill="#7c2d12"/>
  <circle cx="14" cy="-14" r="7" fill="#7c2d12"/>
  <circle cx="-22" cy="6" r="6" fill="#7c2d12"/>
  <circle cx="22" cy="6" r="6" fill="#7c2d12"/>`

const appleFace = `
  <path d="M 0,-24 C -4,-28 -16,-28 -20,-16 C -28,0 -18,24 0,24 C 18,24 28,0 20,-16 C 16,-28 4,-28 0,-24 Z" fill="#dc2626"/>
  <path d="M 0,-24 Q 4,-32 12,-30" stroke="#166534" stroke-width="4" fill="none" stroke-linecap="round"/>`

// 3. memory: animals
const animalsMemory = frame(
  palette.vocabulary,
  'Memoria Animalelor',
  `
    ${card(120, 170, true, pawFace, '#fde68a')}
    ${card(240, 170, false)}
    ${card(380, 170, true, pawFace, '#fde68a')}
    ${card(500, 170, false)}
  `,
)

// 4. memory: food
const foodMemory = frame(
  palette.vocabulary,
  'Memoria Mâncării',
  `
    ${card(120, 170, false)}
    ${card(240, 170, true, appleFace, '#fef3c7')}
    ${card(380, 170, false)}
    ${card(500, 170, true, appleFace, '#fef3c7')}
  `,
)

// 5. categorize: animals habitat (farm vs wild)
const animalsHabitat = frame(
  palette.vocabulary,
  'Casele animalelor',
  `
    <g transform="translate(170, 170)">
      <path d="M -80,-20 L 0,-80 L 80,-20 L 80,40 L -80,40 Z" fill="#ffffff" opacity="0.95"/>
      <rect x="-20" y="-10" width="40" height="50" fill="#7c3aed" opacity="0.85"/>
      <text x="0" y="78" ${font} font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">Fermă</text>
    </g>
    <g transform="translate(470, 170)">
      <polygon points="0,-80 -60,40 60,40" fill="#065f46"/>
      <rect x="-10" y="40" width="20" height="24" fill="#4a2d00"/>
      <polygon points="0,-40 -30,30 30,30" fill="#047857"/>
      <text x="0" y="78" ${font} font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">Pădure</text>
    </g>
    <line x1="320" y1="90" x2="320" y2="250" stroke="#ffffff" stroke-width="3" stroke-dasharray="8 10" opacity="0.7"/>
  `,
)

// 6. categorize: food vs animals
function basket(cx, cy, tint, label) {
  return `
    <g transform="translate(${cx},${cy})">
      <path d="M -90,-20 L 90,-20 L 74,50 L -74,50 Z" fill="${tint}" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
      <rect x="-96" y="-30" width="192" height="16" rx="6" fill="#ffffff"/>
      <text x="0" y="76" ${font} font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle">${label}</text>
    </g>`
}

const foodVsAnimals = frame(
  palette.vocabulary,
  'Mâncare sau animal?',
  `
    ${basket(170, 150, '#fca5a5', 'Mâncare')}
    <g transform="translate(170,130)">
      <circle cx="-30" cy="0" r="22" fill="#ef4444" stroke="#ffffff" stroke-width="3"/>
      <circle cx="28" cy="0" r="22" fill="#facc15" stroke="#ffffff" stroke-width="3"/>
    </g>
    ${basket(470, 150, '#86efac', 'Animale')}
    <g transform="translate(470,130)">
      <circle cx="-30" cy="0" r="22" fill="#a78bfa" stroke="#ffffff" stroke-width="3"/>
      <circle cx="28" cy="0" r="22" fill="#60a5fa" stroke="#ffffff" stroke-width="3"/>
    </g>
  `,
)

// 7. sequence-order: numbers 1–6
function numberRing(cx, cy, r, label, fill = '#ffffff', ink = '#0f172a') {
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="3"/>
      <text x="${cx}" y="${cy + 12}" ${font} font-size="34" font-weight="900" fill="${ink}" text-anchor="middle">${label}</text>
    </g>`
}

function arrow(x1, x2, y) {
  return `<line x1="${x1}" y1="${y}" x2="${x2 - 8}" y2="${y}" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
          <polygon points="${x2 - 10},${y - 6} ${x2},${y} ${x2 - 10},${y + 6}" fill="#ffffff"/>`
}

const numbers1to6 = frame(
  palette.math,
  'Numerele 1–6',
  `
    ${numberRing(80, 170, 36, '1')}
    ${arrow(116, 166, 170)}
    ${numberRing(210, 170, 36, '2')}
    ${arrow(246, 296, 170)}
    ${numberRing(340, 170, 36, '3')}
    ${arrow(376, 426, 170)}
    ${numberRing(470, 170, 36, '4')}
    ${arrow(506, 556, 170)}
    ${numberRing(580, 170, 30, '5', '#fef3c7', '#78350f')}
    <text x="${W / 2}" y="250" ${font} font-size="18" font-weight="600" fill="#ffffff" text-anchor="middle" opacity="0.9">…pune-le în ordine</text>
  `,
)

// 8. sequence-order: numbers 7–12
const numbers7to12 = frame(
  palette.math,
  'Numerele 7–12',
  `
    ${numberRing(80, 170, 32, '7', '#fef3c7', '#78350f')}
    ${arrow(112, 162, 170)}
    ${numberRing(200, 170, 32, '8')}
    ${arrow(232, 282, 170)}
    ${numberRing(320, 170, 32, '9')}
    ${arrow(352, 402, 170)}
    ${numberRing(440, 170, 34, '10')}
    ${arrow(474, 524, 170)}
    ${numberRing(562, 170, 34, '11')}
    <text x="${W / 2}" y="250" ${font} font-size="18" font-weight="600" fill="#ffffff" text-anchor="middle" opacity="0.9">…urmează 12</text>
  `,
)

// 9. tracing: basic shapes (circle, square, triangle, star) with dashed outlines
const shapesBasic = frame(
  palette.shapes,
  'Trasează forme de bază',
  `
    <g fill="none" stroke="#ffffff" stroke-width="5" stroke-dasharray="6 8" stroke-linejoin="round">
      <circle cx="110" cy="170" r="52"/>
      <rect x="210" y="118" width="104" height="104" rx="6"/>
      <polygon points="420,220 370,120 470,120"/>
      <polygon points="550,120 564,156 602,156 572,180 584,218 550,196 516,218 528,180 498,156 536,156"/>
    </g>
    <g fill="#ffffff" opacity="0.18">
      <circle cx="110" cy="170" r="52"/>
    </g>
  `,
)

// 10. tracing: uppercase A–F
function letter(x, y, label, traced = false) {
  if (traced) {
    return `<text x="${x}" y="${y}" ${font} font-size="84" font-weight="900" fill="#ffffff" text-anchor="middle" opacity="0.95">${label}</text>`
  }
  return `<text x="${x}" y="${y}" ${font} font-size="84" font-weight="900" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="6 8" text-anchor="middle">${label}</text>`
}

const uppercaseAtoF = frame(
  palette.literacy,
  'Trasează literele A–F',
  `
    ${letter(96, 200, 'A', true)}
    ${letter(196, 200, 'B')}
    ${letter(296, 200, 'C')}
    ${letter(396, 200, 'D')}
    ${letter(496, 200, 'E')}
    ${letter(596, 200, 'F')}
  `,
)

const assets = [
  { slug: 'animals-match-01', svg: animalsMatch },
  { slug: 'food-match-01', svg: foodMatch },
  { slug: 'animals-memory-01', svg: animalsMemory },
  { slug: 'food-memory-01', svg: foodMemory },
  { slug: 'animals-habitat-01', svg: animalsHabitat },
  { slug: 'food-vs-animals-01', svg: foodVsAnimals },
  { slug: 'numbers-1-to-6', svg: numbers1to6 },
  { slug: 'numbers-7-to-12', svg: numbers7to12 },
  { slug: 'shapes-basic', svg: shapesBasic },
  { slug: 'uppercase-a-to-f', svg: uppercaseAtoF },
]

for (const { slug, svg } of assets) {
  const outFile = join(OUT, `${slug}.png`)
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outFile)
  console.log(`wrote ${outFile}`)
}
