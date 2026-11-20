import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const root = path.resolve("public/art")
fs.mkdirSync(path.join(root, "champions"), { recursive: true })
fs.mkdirSync(path.join(root, "items"), { recursive: true })
fs.mkdirSync("public/icons", { recursive: true })

const svg = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>\n`

function portrait(p) {
  const skinL = p.skinL
  const skin = p.skin
  const skinD = p.skinD
  const id = p.id
  const hx = p.hx ?? 256
  const hy = p.hy ?? 214
  const feminine = p.frame === "femme"
  const orc = p.frame === "orc" || p.frame === "witch"
  const rx = feminine ? 68 : orc ? 84 : 74
  const ry = feminine ? 86 : orc ? 78 : 90
  const beard = p.beard ?? (feminine ? "none" : "full")
  const hair = p.hair
  const glow = p.glow
  return `
  <defs>
    <linearGradient id="sk${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${skinL}"/>
      <stop offset="0.55" stop-color="${skin}"/>
      <stop offset="1" stop-color="${skinD}"/>
    </linearGradient>
    <radialGradient id="bg${id}" cx="48%" cy="32%" r="68%">
      <stop offset="0" stop-color="${glow}"/>
      <stop offset="0.45" stop-color="#1a120e"/>
      <stop offset="1" stop-color="#070605"/>
    </radialGradient>
    <linearGradient id="iron${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d7d2c8"/>
      <stop offset="0.4" stop-color="#8d928f"/>
      <stop offset="1" stop-color="#3e4448"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg${id})"/>
  <path d="M20 512 L70 292 Q170 236 ${hx} 268 Q${hx + 120} 230 450 300 L492 512 Z" fill="${p.cloak}"/>
  <path d="M150 512 L186 330 Q256 300 330 334 L360 512 Z" fill="${p.armor}"/>
  <path d="M210 360 Q256 388 304 360 L292 470 L220 470 Z" fill="#120e0c" opacity="0.35"/>
  <path d="M${hx - 28} 300 Q${hx} 250 ${hx + 26} 304 L${hx + 18} 340 Q${hx} 352 ${hx - 18} 338 Z" fill="url(#sk${id})"/>
  ${hairBack(hair, hx, hy, p.hairColor)}
  <path d="M${hx - rx} ${hy - 10} Q${hx - rx + 6} ${hy + 70} ${hx - 20} ${hy + ry - 6} Q${hx} ${hy + ry + 18} ${hx + rx - 16} ${hy + ry - 16} Q${hx + rx} ${hy + 40} ${hx + rx - 8} ${hy - 16} Q${hx} ${hy - ry - 8} ${hx - rx} ${hy - 10} Z" fill="url(#sk${id})"/>
  <path d="M${hx} ${hy - ry + 10} Q${hx + rx} ${hy - 20} ${hx + rx - 4} ${hy + ry - 20} Q${hx + 10} ${hy + ry + 8} ${hx} ${hy - ry + 10} Z" fill="#000" opacity="0.38"/>
  ${eyes(hx, hy, p)}
  ${nose(hx, hy)}
  ${beardLayer(beard, hx, hy, p)}
  ${wrinkles(p, hx, hy)}
  ${scar(p, hx, hy)}
  ${helm(p, hx, hy)}
  ${weapon(p.weapon, p.metal || "#c5ccd1")}
  <rect width="512" height="512" fill="url(#bg${id})" opacity="0.08"/>
  <radialGradient id="vig${id}" cx="50%" cy="45%" r="62%">
    <stop offset="62%" stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.72)"/>
  </radialGradient>
  <rect width="512" height="512" fill="url(#vig${id})"/>
  `
}

function eyes(hx, hy, p) {
  const y = hy - 4
  const gap = p.frame === "orc" || p.frame === "witch" ? 28 : 24
  const c = p.eye || "#f4efe4"
  const pupil = p.pupil || "#1a120c"
  const angry = p.angry ?? (p.frame === "orc" ? 8 : 3)
  return `
    <path d="M${hx - gap - 16} ${y - 16 + angry} Q${hx - gap} ${y - 26} ${hx - gap + 16} ${y - 14}" stroke="#1a120c" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M${hx + gap - 16} ${y - 14} Q${hx + gap} ${y - 26 - angry} ${hx + gap + 16} ${y - 16 + angry}" stroke="#1a120c" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="${hx - gap}" cy="${y}" rx="9" ry="5.5" fill="${c}"/>
    <ellipse cx="${hx + gap}" cy="${y}" rx="9" ry="5.5" fill="${c}"/>
    <ellipse cx="${hx - gap + 1}" cy="${y}" rx="3.2" ry="3.4" fill="${pupil}"/>
    <ellipse cx="${hx + gap + 1}" cy="${y}" rx="3.2" ry="3.4" fill="${pupil}"/>
    <ellipse cx="${hx - gap - 2}" cy="${y - 1.5}" rx="1.3" ry="1.1" fill="#fff" opacity="0.8"/>
    <ellipse cx="${hx + gap - 2}" cy="${y - 1.5}" rx="1.3" ry="1.1" fill="#fff" opacity="0.8"/>
  `
}

function nose(hx, hy) {
  return `<path d="M${hx - 2} ${hy + 6} Q${hx - 8} ${hy + 28} ${hx - 4} ${hy + 36} Q${hx + 8} ${hy + 34} ${hx + 6} ${hy + 24}" fill="none" stroke="#3a2418" stroke-width="3" opacity="0.55" stroke-linecap="round"/>`
}

function hairBack(style, hx, hy, color) {
  if (style === "bald") return ""
  if (style === "hood") {
    return `<path d="M${hx - 100} ${hy + 20} Q${hx - 90} ${hy - 120} ${hx} ${hy - 130} Q${hx + 96} ${hy - 120} ${hx + 104} ${hy + 30} L${hx + 78} ${hy + 80} Q${hx} ${hy - 20} ${hx - 74} ${hy + 70} Z" fill="${color}"/>`
  }
  if (style === "long" || style === "white") {
    return `<path d="M${hx - 86} ${hy + 10} Q${hx - 78} ${hy - 130} ${hx} ${hy - 138} Q${hx + 86} ${hy - 124} ${hx + 90} ${hy + 20} L${hx + 70} ${hy + 150} L${hx + 40} ${hy + 40} Q${hx} ${hy - 40} ${hx - 40} ${hy + 46} L${hx - 74} ${hy + 160} Z" fill="${color}"/>`
  }
  if (style === "braid") {
    return `<path d="M${hx - 78} ${hy} Q${hx - 70} ${hy - 120} ${hx} ${hy - 128} Q${hx + 78} ${hy - 114} ${hx + 80} ${hy + 8} L${hx + 48} ${hy + 36} Q${hx} ${hy - 30} ${hx - 46} ${hy + 34} Z" fill="${color}"/>
      <path d="M${hx + 18} ${hy + 20} Q${hx + 70} ${hy + 80} ${hx + 40} ${hy + 190}" stroke="${color}" stroke-width="16" fill="none"/>
      <circle cx="${hx + 40}" cy="${hy + 196}" r="6" fill="#e2c07a"/>`
  }
  if (style === "mohawk") {
    return `<path d="M${hx - 16} ${hy - 40} Q${hx} ${hy - 160} ${hx + 16} ${hy - 36} Q${hx} ${hy - 20} ${hx - 16} ${hy - 40} Z" fill="${color}"/>`
  }
  return `<path d="M${hx - 78} ${hy - 8} Q${hx - 70} ${hy - 112} ${hx} ${hy - 118} Q${hx + 74} ${hy - 108} ${hx + 78} ${hy - 4} L${hx + 48} ${hy + 16} Q${hx} ${hy - 50} ${hx - 50} ${hy + 14} Z" fill="${color}"/>`
}

function beardLayer(beard, hx, hy, p) {
  const c = p.hairColor
  if (beard === "tusks") {
    return `<path d="M${hx - 54} ${hy + 24} Q${hx} ${hy + 78} ${hx + 58} ${hy + 22} Q${hx + 20} ${hy + 46} ${hx} ${hy + 36} Q${hx - 18} ${hy + 48} ${hx - 54} ${hy + 24} Z" fill="${c}" opacity="0.9"/>
      <path d="M${hx - 22} ${hy + 42} L${hx - 30} ${hy + 70} L${hx - 12} ${hy + 48} Z" fill="#f4efe4"/>
      <path d="M${hx + 22} ${hy + 42} L${hx + 32} ${hy + 72} L${hx + 12} ${hy + 48} Z" fill="#f4efe4"/>`
  }
  if (beard === "none") {
    return `<path d="M${hx - 18} ${hy + 48} Q${hx} ${hy + 58} ${hx + 20} ${hy + 46}" stroke="#6a3b32" stroke-width="3" fill="none" stroke-linecap="round"/>`
  }
  if (beard === "short") {
    return `<path d="M${hx - 40} ${hy + 28} Q${hx} ${hy + 78} ${hx + 42} ${hy + 26} Q${hx} ${hy + 48} ${hx - 40} ${hy + 28} Z" fill="${c}"/>`
  }
  return `<path d="M${hx - 58} ${hy + 18} Q${hx - 20} ${hy + 120} ${hx} ${hy + 132} Q${hx + 24} ${hy + 118} ${hx + 60} ${hy + 16} Q${hx + 16} ${hy + 40} ${hx} ${hy + 28} Q${hx - 16} ${hy + 42} ${hx - 58} ${hy + 18} Z" fill="${c}"/>`
}

function wrinkles(p, hx, hy) {
  if (!p.elder) return ""
  return `<path d="M${hx - 46} ${hy - 18} Q${hx - 24} ${hy - 10} ${hx - 12} ${hy - 20}" stroke="#6d4c38" stroke-width="2" fill="none" opacity="0.7"/>
    <path d="M${hx + 14} ${hy - 20} Q${hx + 28} ${hy - 8} ${hx + 48} ${hy - 16}" stroke="#6d4c38" stroke-width="2" fill="none" opacity="0.7"/>`
}

function scar(p, hx, hy) {
  if (!p.scar) return ""
  return `<path d="M${hx - 40} ${hy - 28} L${hx - 18} ${hy + 8}" stroke="#8a3a32" stroke-width="3" fill="none"/>`
}

function helm(p, hx, hy) {
  if (p.helm === "nasal") {
    return `<path d="M${hx - 78} ${hy - 24} Q${hx} ${hy - 150} ${hx + 78} ${hy - 20} L${hx + 64} ${hy - 8} Q${hx} ${hy - 70} ${hx - 64} ${hy - 10} Z" fill="#5e666c"/>
      <path d="M${hx - 4} ${hy - 70} L${hx - 4} ${hy + 8}" stroke="#d7d2c8" stroke-width="6"/>
      <path d="M${hx - 70} ${hy - 18} H${hx + 70}" stroke="#e2c07a" stroke-width="4"/>`
  }
  if (p.helm === "circlet") {
    return `<path d="M${hx - 62} ${hy - 48} Q${hx} ${hy - 78} ${hx + 64} ${hy - 46}" stroke="#e2c07a" stroke-width="8" fill="none"/>
      <path d="M${hx - 8} ${hy - 70} L${hx} ${hy - 96} L${hx + 10} ${hy - 68}" fill="#e2c07a"/>`
  }
  if (p.helm === "wings") {
    return `<path d="M${hx - 70} ${hy - 40} Q${hx - 130} ${hy - 90} ${hx - 150} ${hy - 20} Q${hx - 100} ${hy - 30} ${hx - 64} ${hy - 18}" fill="#e2c07a"/>
      <path d="M${hx + 70} ${hy - 40} Q${hx + 130} ${hy - 90} ${hx + 150} ${hy - 20} Q${hx + 100} ${hy - 30} ${hx + 64} ${hy - 18}" fill="#e2c07a"/>
      <path d="M${hx - 66} ${hy - 36} Q${hx} ${hy - 64} ${hx + 66} ${hy - 34}" stroke="#f0e2b8" stroke-width="6" fill="none"/>`
  }
  if (p.helm === "bone") {
    return `<path d="M${hx - 70} ${hy - 78} Q${hx} ${hy - 130} ${hx + 74} ${hy - 76}" stroke="#e6e0d2" stroke-width="10" fill="none"/>
      <circle cx="${hx - 48}" cy="${hy - 96}" r="8" fill="#e6e0d2"/>
      <circle cx="${hx}" cy="${hy - 112}" r="9" fill="#e6e0d2"/>
      <circle cx="${hx + 50}" cy="${hy - 94}" r="8" fill="#e6e0d2"/>`
  }
  if (p.helm === "wolf") {
    return `<path d="M${hx - 90} ${hy - 10} Q${hx - 40} ${hy - 150} ${hx} ${hy - 90} Q${hx + 40} ${hy - 150} ${hx + 90} ${hy - 10} L${hx + 60} ${hy + 20} Q${hx} ${hy - 40} ${hx - 60} ${hy + 20} Z" fill="#6d6258"/>
      <path d="M${hx - 18} ${hy - 78} L${hx} ${hy - 50} L${hx + 18} ${hy - 78}" fill="#1a120c"/>`
  }
  if (p.helm === "horns") {
    return `<path d="M${hx - 70} ${hy - 20} Q${hx - 120} ${hy - 110} ${hx - 70} ${hy - 130}" stroke="#e6e0d2" stroke-width="10" fill="none"/>
      <path d="M${hx + 70} ${hy - 20} Q${hx + 120} ${hy - 110} ${hx + 70} ${hy - 130}" stroke="#e6e0d2" stroke-width="10" fill="none"/>
      <path d="M${hx - 74} ${hy - 30} Q${hx} ${hy - 80} ${hx + 74} ${hy - 28}" stroke="#3e4448" stroke-width="14" fill="none"/>`
  }
  return ""
}

function weapon(kind) {
  if (kind === "greataxe") {
    return `<g transform="translate(360,40)">
      <path d="M28 20 C80 -10 96 80 40 120 C10 78 8 40 28 20 Z" fill="#b7c0c6" stroke="#2c3338" stroke-width="4"/>
      <path d="M36 78 L36 360" stroke="#6b4124" stroke-width="12" stroke-linecap="round"/>
    </g>`
  }
  if (kind === "axes") {
    return `<g transform="translate(40,80)"><path d="M30 10 C70 0 78 70 34 96 C14 60 12 24 30 10 Z" fill="#c5ccd1"/><path d="M34 70 L70 250" stroke="#6b4124" stroke-width="10"/></g>
      <g transform="translate(390,90)"><path d="M20 10 C60 0 68 70 24 96 C4 60 2 24 20 10 Z" fill="#c5ccd1"/><path d="M24 70 L-10 250" stroke="#6b4124" stroke-width="10"/></g>`
  }
  if (kind === "shieldaxe") {
    return `<g transform="translate(36,150)">
      <circle cx="70" cy="90" r="68" fill="#6e2a24" stroke="#e2c07a" stroke-width="8"/>
      <path d="M40 90 H100 M70 52 V128" stroke="#e2c07a" stroke-width="6"/>
      <circle cx="70" cy="90" r="10" fill="#e2c07a"/>
    </g>
    <g transform="translate(360,70)"><path d="M24 16 C64 0 74 74 30 104 C8 66 8 30 24 16 Z" fill="#d5dde2"/><path d="M30 78 L30 300" stroke="#6b4124" stroke-width="12"/></g>`
  }
  if (kind === "spear") {
    return `<g transform="translate(378,16)"><path d="M20 150 L20 430" stroke="#6b4124" stroke-width="10"/><path d="M20 20 L46 150 H-6 Z" fill="#e7eef2"/></g>`
  }
  if (kind === "spearshield") {
    return `<g transform="translate(24,160)"><circle cx="78" cy="96" r="74" fill="#24343c" stroke="#e2c07a" stroke-width="8"/><path d="M78 48 L104 110 H52 Z" fill="#e2c07a"/></g>
      <g transform="translate(390,20)"><path d="M18 160 L18 420" stroke="#6b4124" stroke-width="10"/><path d="M18 24 L42 150 H-6 Z" fill="#e7eef2"/></g>`
  }
  if (kind === "sword") {
    return `<g transform="translate(372,36)"><path d="M28 18 L28 300" stroke="#d5dde2" stroke-width="12"/><path d="M8 300 H48" stroke="#e2c07a" stroke-width="10"/><path d="M28 300 L28 360" stroke="#6b4124" stroke-width="8"/><path d="M28 18 L40 70 H16 Z" fill="#fff"/></g>`
  }
  if (kind === "bow") {
    return `<g transform="translate(350,40)" fill="none" stroke="#e6d2a8" stroke-width="8"><path d="M30 20 Q120 180 30 360"/><path d="M30 30 L30 350" stroke="#f4efe4" stroke-width="2"/></g>`
  }
  if (kind === "staff") {
    return `<g transform="translate(368,24)"><path d="M30 80 L30 430" stroke="#3a2a1c" stroke-width="12"/><circle cx="30" cy="64" r="28" fill="#7eb6d8" stroke="#e2c07a" stroke-width="4"/><path d="M30 20 L30 48" stroke="#e2c07a" stroke-width="4"/></g>`
  }
  if (kind === "lightning") {
    return `<g transform="translate(360,20)"><path d="M40 90 L40 430" stroke="#2a241c" stroke-width="12"/><path d="M64 20 L28 90 H52 L18 160 L70 78 H40 Z" fill="#d7ecff" stroke="#7eb6ff" stroke-width="3"/></g>`
  }
  if (kind === "knives") {
    return `<g transform="translate(48,200)"><path d="M20 80 L20 10 L48 70 Z" fill="#e7eef2"/><path d="M28 80 L28 150" stroke="#6b4124" stroke-width="6"/></g>
      <g transform="translate(400,190)"><path d="M30 80 L30 8 L4 72 Z" fill="#e7eef2"/><path d="M24 80 L24 156" stroke="#6b4124" stroke-width="6"/></g>`
  }
  if (kind === "hammer") {
    return `<g transform="translate(340,60)"><rect x="8" y="40" width="90" height="44" rx="6" fill="#8d928f" stroke="#222" stroke-width="4"/><path d="M48 84 L48 360" stroke="#6b4124" stroke-width="12"/></g>`
  }
  if (kind === "dane") {
    return `<g transform="translate(348,30)"><path d="M34 24 C100 10 110 140 36 180 C6 110 8 50 34 24 Z" fill="#d5dde2" stroke="#2c3338" stroke-width="4"/><path d="M36 120 L36 400" stroke="#6b4124" stroke-width="12"/></g>`
  }
  if (kind === "cleaver") {
    return `<g transform="translate(330,50)"><path d="M20 20 H120 V90 Q120 170 40 170 V70 H20 Z" fill="#9aa3a8" stroke="#222" stroke-width="4"/><path d="M40 170 L40 390" stroke="#4a301c" stroke-width="14"/></g>`
  }
  if (kind === "maul") {
    return `<g transform="translate(330,70)"><rect x="4" y="20" width="120" height="56" rx="8" fill="#6e5438" stroke="#e2c07a" stroke-width="4"/><path d="M60 76 L60 370" stroke="#3a2a1c" stroke-width="16"/></g>`
  }
  if (kind === "skullstaff") {
    return `<g transform="translate(360,24)"><path d="M36 120 L36 440" stroke="#3a2a1c" stroke-width="12"/><circle cx="36" cy="78" r="36" fill="#e6e0d2"/><circle cx="22" cy="74" r="6" fill="#1a120c"/><circle cx="48" cy="74" r="6" fill="#1a120c"/><path d="M22 96 Q36 108 50 96" stroke="#1a120c" fill="none" stroke-width="3"/></g>`
  }
  if (kind === "wolf") {
    return `<g transform="translate(330,250)"><ellipse cx="70" cy="70" rx="70" ry="36" fill="#5c564e"/><circle cx="120" cy="40" r="28" fill="#6d6258"/><path d="M108 20 L120 0 L132 24" fill="#6d6258"/><circle cx="128" cy="38" r="3" fill="#e2c07a"/></g>`
  }
  return ""
}

const people = [
  ["ralph", "elder", "viking", "#e6d3bf", "#c9aa8d", "#8a6248", "#efeae2", "white", "full", "none", "greataxe", "#6e2430", "#8a8175", "#6a3030", false],
  ["donna", "elderfemme", "viking", "#f0d8c4", "#d2ae96", "#8d6752", "#d9d4dc", "braid", "none", "circlet", "staff", "#243246", "#3d4c5c", "#24485c", false],
  ["ryan", "masc", "viking", "#f0c8a4", "#c48b62", "#7a4e34", "#3a2418", "short", "short", "nasal", "shieldaxe", "#6e2a24", "#5c5148", "#8a3030", true],
  ["billy", "masc", "viking", "#f2c7a2", "#d08a58", "#7a4528", "#e0b056", "mohawk", "short", "none", "axes", "#8a1e1e", "#6a3a2a", "#a02020", true],
  ["landin", "masc", "viking", "#e7c2a4", "#c08860", "#6d4632", "#2a211c", "short", "short", "nasal", "spearshield", "#24343c", "#4a5560", "#1e3a44", false],
  ["gavin", "masc", "viking", "#efc6a6", "#c48460", "#734832", "#3a2a22", "short", "short", "none", "sword", "#3e2a55", "#6a6248", "#3a2458", false],
  ["haydin", "masc", "viking", "#e8c2a4", "#b88862", "#6a4634", "#2a241c", "hood", "short", "none", "bow", "#3d4a32", "#4a4034", "#2a3820", false],
  ["kali", "femme", "viking", "#f3d0b4", "#d09a74", "#8a5840", "#6a3318", "braid", "none", "nasal", "shieldaxe", "#7a1f2a", "#5a463c", "#6a2030", false],
  ["area", "femme", "viking", "#f0d2bc", "#c89274", "#7a5040", "#1c1a28", "hood", "none", "none", "lightning", "#1c2438", "#2a3348", "#4a78c8", false],
  ["jesse", "masc", "viking", "#e8bea0", "#c08058", "#6e4030", "#4a3428", "short", "short", "none", "greataxe", "#24343c", "#3a4038", "#1a3330", true],
  ["jayden", "femme", "viking", "#f2d0b2", "#d09a70", "#8a583c", "#2a1c16", "short", "none", "none", "knives", "#3a2a22", "#4a4038", "#3a2418", false],
  ["james", "masc", "viking", "#e0b898", "#b07a52", "#6a4030", "#2a2420", "short", "full", "none", "hammer", "#5a2a1c", "#6a5344", "#a85a20", false],
  ["lana", "femme", "viking", "#f6d4ba", "#d4a07c", "#8d5c42", "#c4552a", "braid", "none", "none", "bow", "#5a2a32", "#4a4038", "#6a3038", false],
  ["anna", "femme", "viking", "#f7dcc8", "#e0b498", "#a06c50", "#f0e2c4", "braid", "none", "circlet", "staff", "#f0e6d0", "#e6d2b0", "#c4a060", false],
  ["alain", "masc", "viking", "#efc8a8", "#c88a60", "#7a4c34", "#d8d2c8", "short", "short", "nasal", "dane", "#6a1c28", "#8a9094", "#8a2030", false],
  ["emma", "femme", "viking", "#f4d2bc", "#d09a78", "#8a5842", "#f2e6c8", "long", "none", "wings", "spear", "#f7f1e4", "#e6d7b0", "#e2c07a", false],
  ["gorgrath", "orc", "grog", "#b7c47a", "#7f9448", "#3e5224", "#1a1a18", "mohawk", "tusks", "horns", "cleaver", "#4a1c14", "#6a4a32", "#6a2018", true],
  ["mogdura", "witch", "grog", "#a8b86e", "#6e8440", "#3a4a22", "#c8c2b4", "hood", "tusks", "bone", "skullstaff", "#2a241c", "#4a4038", "#6a4488", false],
  ["brakka", "orc", "grog", "#9aaa62", "#66783a", "#33441e", "none", "bald", "tusks", "none", "maul", "#3a2418", "#6a5038", "#5a3018", true],
  ["zug", "orc", "grog", "#c2ce86", "#8aa050", "#465828", "#2a120e", "mohawk", "tusks", "none", "axes", "#5a140e", "#6a3028", "#a01810", true],
  ["sharga", "femme", "grog", "#b2c472", "#789044", "#3c4e22", "#141210", "braid", "tusks", "none", "bow", "#2a1c18", "#4a3828", "#1a1814", false],
  ["krull", "orc", "grog", "#a8bc6a", "#6e863c", "#36481c", "#4a4038", "hood", "tusks", "wolf", "wolf", "#3a2a22", "#5a4634", "#6a5430", true],
  ["grimtusk", "orc", "grog", "#9eb064", "#667438", "#314218", "#2a241c", "short", "tusks", "none", "hammer", "#3a2a22", "#5a4030", "#c45a20", false],
  ["urzog", "orc", "grog", "#8ea25a", "#5a7030", "#2c3c16", "#1a1814", "bald", "tusks", "horns", "maul", "#2a221c", "#4a4038", "#3a2418", true],
]

function rowToPerson(r) {
  const [id, frame, , skinL, skin, skinD, hairColor, hair, beard, helm, weaponName, cloak, armor, glow, scar] = r
  const elder = frame === "elder" || frame === "elderfemme"
  const realFrame = frame === "elder" ? "masc" : frame === "elderfemme" ? "femme" : frame === "witch" ? "witch" : frame
  return {
    id,
    frame: realFrame,
    skinL,
    skin,
    skinD,
    hairColor: hairColor === "none" ? "#2a241c" : hairColor,
    hair: hair === "bald" ? "bald" : hair,
    beard,
    helm: helm === "none" ? "none" : helm,
    weapon: weaponName,
    cloak,
    armor,
    glow,
    scar,
    elder,
    angry: realFrame === "orc" || realFrame === "witch" ? 8 : elder ? 1 : 3,
    eye: realFrame === "orc" || realFrame === "witch" ? "#d6e27a" : "#f4efe4",
    pupil: realFrame === "orc" || realFrame === "witch" ? "#1a1408" : "#1a120c",
  }
}

for (const r of people) {
  const p = rowToPerson(r)
  fs.writeFileSync(path.join(root, "champions", `${p.id}.svg`), svg(portrait(p)))
}

function itemPlate(inner, tint) {
  return svg(`
    <defs>
      <radialGradient id="ig" cx="50%" cy="40%" r="65%">
        <stop offset="0" stop-color="${tint}"/>
        <stop offset="0.5" stop-color="#1a1410"/>
        <stop offset="1" stop-color="#070605"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" fill="url(#ig)"/>
    <ellipse cx="256" cy="400" rx="120" ry="22" fill="#000" opacity="0.35"/>
    ${inner}
  `)
}

const itemDraw = {
  "trail-worn-clan-leather": [cloak("#6b4a32", "#cbb48a", "#5a3a28"), "#6b3a28"],
  "frostfjord-hall-guard": [armor("#8aa4b8", "#dfe7ee", "#2a3a44"), "#2a4458"],
  "wolf-pelt-raider": [cloak("#6d6258", "#9a8b78", "#3a2418"), "#4a3a2a"],
  "runebound-seer-cloak": [cloak("#1e3a4a", "#7eb6d8", "#142028"), "#1a3850"],
  "gold-wing-valkyrie": [wings(), "#6a5420"],
  "gorgrath-war-paint": [paint("#7f9448", "#c4492c"), "#5a3018"],
  "bone-crown-shaman": [crown(), "#3a3428"],
  "scrap-tyrant-plate": [armor("#7a5a3a", "#c4a070", "#3a2418"), "#5a3018"],
  "raven-of-nash": [ship("#1a120c", "#6e2430", "raven"), "#2a1c18"],
  "wolf-prowed-drakkar": [ship("#4a301c", "#e6d2a8", "wolf"), "#3a2418"],
  "gorgrath-war-hulk": [ship("#3a2418", "#6a2018", "hulk"), "#4a2018"],
  "ash-wood-hand-axe": [handAxe("#6b4124", "#d5dde2"), "#3a3028"],
  "scrap-choppa": [handAxe("#3a2a1c", "#9aa36a"), "#3a3018"],
  "sky-piercer": [spearIcon(), "#2a3840"],
  "bone-howl-bow": [bowIcon("#e6e0d2"), "#3a3428"],
  "hall-breaker": [bigAxe(), "#3a3028"],
  "storm-bit-staff": [staffIcon("#9fd0ff"), "#1a3050"],
  "jarls-due": [daneAxe(), "#4a3018"],
  "skullsplitter-cleaver": [cleaverIcon(), "#3a2018"],
  "grimtusk-war-maul": [maulIcon(), "#4a3018"],
  "mogduras-skull-staff": [skullStaffIcon(), "#3a2848"],
  "field-poultice": [poultice(), "#3a4030"],
  "annas-healing-draught": [bottle("#f0d78a", "#e6c25a"), "#6a5420"],
  "berserker-mead": [horn(), "#6a3018"],
  "rune-ward-tonic": [bottle("#8ec8e6", "#2a6a88"), "#1a3850"],
  "mogduras-bloodrite": [bottle("#6a1020", "#a02030"), "#4a1020"],
  "ironhide-draught": [bottle("#b8b2a4", "#5a5848"), "#3a3830"],
}

function cloak(cloth, trim, shadow) {
  return `<path d="M170 150 Q256 90 342 150 L380 390 Q256 430 132 390 Z" fill="${cloth}"/>
    <path d="M200 160 Q256 120 312 160 L300 250 Q256 230 212 250 Z" fill="${shadow}"/>
    <path d="M176 168 Q256 118 336 168" fill="none" stroke="${trim}" stroke-width="8"/>
    <circle cx="256" cy="176" r="10" fill="${trim}"/>`
}
function armor(plate, trim, dark) {
  return `<path d="M176 150 H336 L360 250 L330 400 H182 L152 250 Z" fill="${plate}"/>
    <path d="M200 170 H312 L300 250 H212 Z" fill="${dark}" opacity="0.35"/>
    <path d="M176 150 H336" stroke="${trim}" stroke-width="8"/>
    <circle cx="256" cy="220" r="16" fill="${trim}"/>`
}
function wings() {
  return `<path d="M70 230 Q150 80 250 200 Q250 120 256 200 Q262 120 262 200 Q360 80 442 230 Q320 180 256 250 Q190 180 70 230 Z" fill="#e2c07a"/>
    <path d="M210 190 L256 360 L302 190 Q256 230 210 190 Z" fill="#f7f1e4" stroke="#b8923e" stroke-width="4"/>`
}
function paint(skin, mark) {
  return `<circle cx="256" cy="230" r="110" fill="${skin}"/>
    <path d="M180 200 Q256 250 332 190" stroke="${mark}" stroke-width="16" fill="none"/>
    <path d="M200 250 L230 300 L256 240 L290 310 L320 240" stroke="${mark}" stroke-width="10" fill="none"/>
    <circle cx="214" cy="210" r="8" fill="#1a1408"/>
    <circle cx="300" cy="206" r="8" fill="#1a1408"/>`
}
function crown() {
  return `<path d="M140 250 Q160 120 200 230 Q230 80 256 210 Q290 70 330 220 Q360 120 380 250 Z" fill="#e6e0d2" stroke="#6a6048" stroke-width="4"/>
    <circle cx="200" cy="180" r="10" fill="#6a1020"/>
    <circle cx="256" cy="150" r="12" fill="#6a1020"/>
    <circle cx="320" cy="176" r="10" fill="#6a1020"/>`
}
function ship(hull, sail, prow) {
  const head = prow === "raven"
    ? `<path d="M430 210 Q470 180 450 240 Q470 230 430 250" fill="#1a120c"/>`
    : prow === "wolf"
      ? `<path d="M420 200 L470 180 L450 230 L470 240 L410 250 Z" fill="#6d6258"/>`
      : `<path d="M410 200 H490 L470 250 H420 Z" fill="#6a2018"/><circle cx="450" cy="220" r="8" fill="#e6e0d2"/>`
  return `<path d="M50 300 Q90 390 256 400 Q430 390 470 280 L420 300 Q256 360 90 310 Z" fill="${hull}"/>
    <path d="M250 300 L250 120" stroke="#2a1a10" stroke-width="10"/>
    <path d="M250 130 Q360 180 250 280" fill="${sail}"/>
    ${head}
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${140 + i * 42}" cy="318" r="12" fill="#6e2430" stroke="#e2c07a" stroke-width="3"/>`).join("")}`
}
function handAxe(haft, head) {
  return `<path d="M250 150 L250 420" stroke="${haft}" stroke-width="16" stroke-linecap="round"/>
    <path d="M230 70 C330 40 350 180 250 210 C190 150 190 100 230 70 Z" fill="${head}" stroke="#222" stroke-width="4"/>`
}
function spearIcon() {
  return `<path d="M256 120 L256 430" stroke="#6b4124" stroke-width="12"/>
    <path d="M256 40 L310 180 H202 Z" fill="#e7eef2" stroke="#2c3338" stroke-width="4"/>`
}
function bowIcon(color) {
  return `<path d="M180 80 Q340 256 180 430" fill="none" stroke="${color}" stroke-width="12"/>
    <path d="M190 100 L190 410" stroke="#f4efe4" stroke-width="3"/>`
}
function bigAxe() {
  return `<path d="M250 160 L250 430" stroke="#6b4124" stroke-width="16"/>
    <path d="M220 40 C360 20 390 200 240 250 C150 160 160 70 220 40 Z" fill="#d5dde2" stroke="#222" stroke-width="4"/>`
}
function staffIcon(gem) {
  return `<path d="M256 150 L256 440" stroke="#3a2a1c" stroke-width="14"/>
    <circle cx="256" cy="110" r="46" fill="${gem}" stroke="#e2c07a" stroke-width="6"/>`
}
function daneAxe() {
  return `<path d="M250 180 L250 430" stroke="#6b4124" stroke-width="14"/>
    <path d="M230 50 C370 30 400 230 250 280 C140 180 150 80 230 50 Z" fill="#e7eef2" stroke="#8a1e1e" stroke-width="6"/>`
}
function cleaverIcon() {
  return `<path d="M160 80 H390 V200 Q390 320 220 320 V180 H160 Z" fill="#9aa3a8" stroke="#222" stroke-width="6"/>
    <path d="M230 320 L230 450" stroke="#4a301c" stroke-width="18"/>`
}
function maulIcon() {
  return `<rect x="120" y="90" width="270" height="90" rx="12" fill="#6e5438" stroke="#e2c07a" stroke-width="6"/>
    <path d="M256 180 L256 450" stroke="#3a2a1c" stroke-width="20"/>`
}
function skullStaffIcon() {
  return `<path d="M256 180 L256 450" stroke="#3a2a1c" stroke-width="14"/>
    <circle cx="256" cy="120" r="58" fill="#e6e0d2"/>
    <circle cx="234" cy="114" r="10" fill="#1a120c"/>
    <circle cx="278" cy="114" r="10" fill="#1a120c"/>
    <path d="M236 146 Q256 162 276 146" stroke="#1a120c" fill="none" stroke-width="4"/>`
}
function poultice() {
  return `<rect x="150" y="160" width="210" height="150" rx="16" fill="#d9c7a4" stroke="#6b4124" stroke-width="6"/>
    <path d="M170 200 H340 M170 230 H340" stroke="#8a9a62" stroke-width="8"/>
    <path d="M230 150 Q256 80 282 150" fill="none" stroke="#3d4a32" stroke-width="8"/>`
}
function bottle(liquid, glass) {
  return `<rect x="232" y="70" width="48" height="40" rx="6" fill="#cbb48a"/>
    <path d="M200 130 h112 v30 c10 150 -132 150 -112 0 z" fill="${glass}" opacity="0.85" stroke="#e7eef2" stroke-width="4"/>
    <path d="M206 200 h100 v90 c0 40 -100 40 -100 0 z" fill="${liquid}"/>`
}
function horn() {
  return `<path d="M160 280 Q220 80 360 150 Q300 180 250 300 Q200 360 150 340 Z" fill="#e6d2a8" stroke="#6b4124" stroke-width="6"/>
    <ellipse cx="176" cy="300" rx="28" ry="40" fill="#f4efe4"/>
    <path d="M200 200 Q240 230 220 270" stroke="#fff" stroke-width="6" fill="none" opacity="0.7"/>`
}

for (const [id, [inner, tint]] of Object.entries(itemDraw)) {
  fs.writeFileSync(path.join(root, "items", `${id}.svg`), itemPlate(inner, tint))
}

fs.writeFileSync(path.join(root, "banner-viking.svg"), svg(`<rect width="512" height="512" fill="#1a120e"/>
  <path d="M156 40 H356 L320 472 H192 Z" fill="#6e2430" stroke="#e2c07a" stroke-width="10"/>
  <path d="M220 150 H292 L256 250 Z" fill="#e2c07a"/>`))
fs.writeFileSync(path.join(root, "banner-grog.svg"), svg(`<rect width="512" height="512" fill="#140e0c"/>
  <path d="M150 50 H362 L330 460 H180 Z" fill="#5a2014" stroke="#c45a32" stroke-width="10"/>
  <circle cx="256" cy="210" r="36" fill="#c45a32"/>`))
fs.writeFileSync(path.join(root, "militia.svg"), svg(`<rect width="512" height="512" fill="#1a1410"/>
  <circle cx="256" cy="230" r="120" fill="#3a342c" stroke="#8a7040" stroke-width="10"/>
  <path d="M256 150 L300 250 H212 Z" fill="#cbb48a"/>`))
fs.writeFileSync("public/favicon.svg", svg(`<rect width="512" height="512" rx="96" fill="#120e0b"/>
  <path d="M256 46 L430 120 L400 300 L256 470 L112 300 L82 120 Z" fill="#6e2430" stroke="#e2c07a" stroke-width="16"/>
  <path d="M250 120 L250 360" stroke="#e2c07a" stroke-width="18"/>
  <path d="M230 130 C320 110 340 230 236 250 C190 190 190 150 230 130 Z" fill="#e2c07a"/>`))

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function inPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi) inside = !inside
  }
  return inside
}
function makePng(size) {
  const s = size
  const poly = [
    [0.5 * s, 0.08 * s],
    [0.84 * s, 0.22 * s],
    [0.76 * s, 0.58 * s],
    [0.5 * s, 0.92 * s],
    [0.24 * s, 0.58 * s],
    [0.16 * s, 0.22 * s],
  ]
  const raw = Buffer.alloc((s * 4 + 1) * s)
  for (let y = 0; y < s; y++) {
    raw[(s * 4 + 1) * y] = 0
    for (let x = 0; x < s; x++) {
      const o = (s * 4 + 1) * y + 1 + x * 4
      let r = 12, g = 10, b = 8, a = 255
      if (inPoly(x, y, poly)) {
        r = 110; g = 36; b = 32
        const edge = !inPoly(x + 2, y, poly) || !inPoly(x - 2, y, poly) || !inPoly(x, y + 2, poly) || !inPoly(x, y - 2, poly)
        if (edge) { r = 226; g = 192; b = 122 }
        const nx = x / s
        const ny = y / s
        if (Math.abs(nx - 0.5) < 0.02 && ny > 0.28 && ny < 0.72) { r = 226; g = 192; b = 122 }
        if (ny > 0.3 && ny < 0.48 && nx > 0.42 && nx < 0.66) {
          const axe = (nx - 0.48) ** 2 / 0.02 + (ny - 0.36) ** 2 / 0.012
          if (axe < 1 && nx > 0.48) { r = 226; g = 192; b = 122 }
        }
      }
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(s, 0)
  ihdr.writeUInt32BE(s, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))])
}

for (const size of [180, 192, 512]) {
  fs.writeFileSync(`public/icons/icon-${size}.png`, makePng(size))
}
fs.copyFileSync("public/icons/icon-180.png", "public/apple-touch-icon.png")
console.log("art written", people.length, "champions", Object.keys(itemDraw).length, "items")
