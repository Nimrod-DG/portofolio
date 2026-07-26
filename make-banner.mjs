// Generates a club banner from the product's own palette. Composed rather
// than sourced: no stock photo means no licensing question, and pitch
// markings are more on-subject than a generic gradient.
//   node make-banner.mjs
import sharp from "sharp";

const W = 1920;
const H = 640;

const NAVY_DEEP = "#03203f";
const NAVY = "#05447d";
const ORANGE = "#f77509";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${NAVY}"/>
      <stop offset="55%"  stop-color="${NAVY_DEEP}"/>
      <stop offset="100%" stop-color="#021629"/>
    </linearGradient>

    <radialGradient id="floodlight" cx="0.78" cy="0.12" r="0.62">
      <stop offset="0%"   stop-color="${ORANGE}" stop-opacity="0.42"/>
      <stop offset="45%"  stop-color="${ORANGE}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${ORANGE}" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="60%"  stop-color="#ffffff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>

    <pattern id="grass" width="120" height="${H}" patternUnits="userSpaceOnUse">
      <rect width="60"  height="${H}" fill="#ffffff" opacity="0.018"/>
      <rect x="60" width="60" height="${H}" fill="#000000" opacity="0.018"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#ground)"/>
  <rect width="${W}" height="${H}" fill="url(#grass)"/>

  <!-- pitch markings, drawn as if the camera sits off the halfway line -->
  <g fill="none" stroke="url(#fade)" stroke-width="3">
    <line x1="${W * 0.5}" y1="-20" x2="${W * 0.5}" y2="${H + 20}"/>
    <circle cx="${W * 0.5}" cy="${H * 0.5}" r="150"/>
    <circle cx="${W * 0.5}" cy="${H * 0.5}" r="7" fill="#ffffff" fill-opacity="0.18" stroke="none"/>

    <rect x="-4"  y="${H * 0.5 - 210}" width="230" height="420" rx="2"/>
    <rect x="-4"  y="${H * 0.5 - 100}" width="105" height="200" rx="2"/>

    <rect x="${W - 226}" y="${H * 0.5 - 210}" width="230" height="420" rx="2"/>
    <rect x="${W - 101}" y="${H * 0.5 - 100}" width="105" height="200" rx="2"/>
  </g>

  <rect width="${W}" height="${H}" fill="url(#floodlight)"/>

  <!-- accent rule: the one place the brand orange goes full strength -->
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${ORANGE}" opacity="0.9"/>
</svg>`;

await sharp(Buffer.from(svg))
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile("./assets/club-banner.jpg");

console.log("wrote assets/club-banner.jpg");
