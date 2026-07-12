import { Injectable } from '@angular/core';
import { Letter, Persona } from '../models/test.models';
import { PERSONAS } from '../data/avatar.data';
import { EMOJI, ORDER } from '../data/profiles.data';

const GLASSES_SVG = `<g fill="none" stroke="#2a2118" stroke-width="3.4"><circle cx="82" cy="80" r="15"/><circle cx="118" cy="80" r="15"/><line x1="97" y1="80" x2="103" y2="80"/></g>`;
const HAIR_CAP = (c: string) =>
  `<path d="M56,72 Q52,26 100,24 Q148,26 144,72 Q146,46 100,40 Q54,46 56,72 Z" fill="${c}"/>`;

interface HairDef {
  behind: boolean;
  render: (c: string, beads?: string[]) => string;
}

const HAIR_STYLES: Record<string, HairDef> = {
  capShort: { behind: false, render: (c) => HAIR_CAP(c) },
  capSide: { behind: false, render: (c) => `<path d="M54,74 Q48,24 104,22 Q150,26 146,74 Q148,44 98,38 Q58,42 54,74 Z" fill="${c}"/>` },
  ponytail: { behind: false, render: (c) => `${HAIR_CAP(c)}<path d="M138,56 Q168,58 164,96 Q161,116 144,104 Q152,80 136,62 Z" fill="${c}"/>` },
  longStraight: { behind: false, render: (c) => `<path d="M50,150 Q44,86 60,56 L72,52 Q60,98 64,150 Z" fill="${c}"/><path d="M150,150 Q156,86 140,56 L128,52 Q140,98 136,150 Z" fill="${c}"/>${HAIR_CAP(c)}` },
  braids: {
    behind: false,
    render: (c, beads) => {
      const b = beads || ['#EBE72A', '#E71939', '#008FC5'];
      return `<path d="M52,150 Q46,90 62,58 L74,54 Q62,98 66,150 Z" fill="${c}"/>
        <path d="M148,150 Q154,90 138,58 L126,54 Q138,98 134,150 Z" fill="${c}"/>
        <circle cx="60" cy="118" r="5" fill="${b[0]}"/><circle cx="64" cy="140" r="5" fill="${b[1]}"/>
        <circle cx="140" cy="118" r="5" fill="${b[2]}"/><circle cx="136" cy="140" r="5" fill="${b[0]}"/>
        ${HAIR_CAP(c)}`;
    },
  },
  afro: { behind: true, render: (c) => `<circle cx="100" cy="76" r="50" fill="${c}"/>` },
  afroBig: { behind: true, render: (c) => `<circle cx="100" cy="74" r="58" fill="${c}"/>` },
};

const TORSO_BASE = 'M20,200 Q20,150 56,136 L144,136 Q180,150 180,200 Z';

interface OutfitDef {
  torso: () => string;
  accessory: () => string;
}

/** Un atuendo profesional por letra de resultado, encima de cualquier persona. */
const OUTFITS: Record<string, OutfitDef> = {
  default: {
    torso: () => `<path d="${TORSO_BASE}" fill="#d8d2c0"/><path d="M84,136 Q100,148 116,136 L116,146 Q100,156 84,146 Z" fill="#c5bfae"/>`,
    accessory: () => '',
  },
  A: {
    torso: () => `<path d="${TORSO_BASE}" fill="#f3efe6"/><path d="M88,136 L72,200 L80,200 L94,148 Z" fill="#e3ddcf"/><path d="M112,136 L128,200 L120,200 L106,148 Z" fill="#e3ddcf"/><rect x="90" y="162" width="18" height="22" rx="3" fill="#007D5F"/>`,
    accessory: () => `<g fill="none" stroke="#8a97a0" stroke-width="4.5" stroke-linecap="round"><path d="M84,138 Q68,150 70,174 Q71,192 90,194"/><path d="M118,138 Q132,150 130,174 Q129,192 110,194"/></g><circle cx="90" cy="194" r="6" fill="#8a97a0"/>`,
  },
  B: {
    torso: () => `<path d="${TORSO_BASE}" fill="#4a9e3c"/><path d="M88,136 L74,200 L84,200 L96,148 Z" fill="#3a7e2c"/><path d="M112,136 L126,200 L116,200 L104,148 Z" fill="#3a7e2c"/><rect x="90" y="156" width="18" height="26" rx="3" fill="#f3efe6"/>`,
    accessory: () => `<path d="M94,160 L104,174 M104,160 L94,174" stroke="#4a9e3c" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  C: {
    torso: () => `<path d="${TORSO_BASE}" fill="#008FC5"/><line x1="100" y1="138" x2="100" y2="198" stroke="#bfe6f7" stroke-width="2.5" stroke-dasharray="4,4"/><rect x="114" y="156" width="28" height="22" rx="3" fill="#0a6e96"/>`,
    accessory: () => `<path d="M120,160 L138,160 M129,152 L129,175" stroke="#f3efe6" stroke-width="3" stroke-linecap="round"/>`,
  },
  D: {
    torso: () => `<path d="${TORSO_BASE}" fill="#F4A705"/><path d="M30,160 L90,200 L70,200 L20,166 Z" fill="#33363a" opacity="0.88"/><path d="M170,160 L110,200 L130,200 L180,166 Z" fill="#33363a" opacity="0.88"/>`,
    accessory: () => '',
  },
  E: {
    torso: () => `<path d="${TORSO_BASE}" fill="#f3efe6"/><rect x="56" y="158" width="20" height="22" rx="3" fill="#009F93"/>`,
    accessory: () => `<path d="M80,140 Q70,150 76,162 M120,140 Q130,150 124,162" stroke="#cfd6d2" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="84" y="158" width="32" height="18" rx="8" fill="#dfe6e2" stroke="#b9c2bd" stroke-width="2"/>`,
  },
  F: {
    torso: () => `<path d="${TORSO_BASE}" fill="#5a8a2a"/><path d="M88,136 L74,200 L84,200 L96,148 Z" fill="#466820"/><path d="M112,136 L126,200 L116,200 L104,148 Z" fill="#466820"/>`,
    accessory: () => `<path d="M68,88 Q100,60 132,88 L134,100 Q100,74 66,100 Z" fill="#e8b030"/>`,
  },
  G: {
    torso: () => `<path d="${TORSO_BASE}" fill="#8B5E3C"/><path d="M30,158 L90,198 L70,198 L20,164 Z" fill="#F4A705" opacity="0.92"/><path d="M170,158 L110,198 L130,198 L180,164 Z" fill="#F4A705" opacity="0.92"/>`,
    accessory: () => `<path d="M62,84 Q100,56 138,84 L140,100 Q100,68 60,100 Z" fill="#F4A705"/>`,
  },
  H: {
    torso: () => `<path d="${TORSO_BASE}" fill="#2e9e6e"/><path d="M88,136 L74,200 L84,200 L96,148 Z" fill="#1e7e52"/><path d="M112,136 L126,200 L116,200 L104,148 Z" fill="#1e7e52"/><rect x="90" y="162" width="18" height="22" rx="3" fill="#f3efe6"/>`,
    accessory: () => `<text x="99" y="177" text-anchor="middle" font-family="sans-serif" font-size="14">🌿</text>`,
  },
  I: {
    torso: () => `<path d="${TORSO_BASE}" fill="#D7951E"/><path d="M86,136 L72,200 L82,200 L96,148 Z" fill="#c4860f"/><path d="M114,136 L128,200 L118,200 L104,148 Z" fill="#c4860f"/><path d="M92,138 L100,150 L108,138 L104,200 L96,200 Z" fill="#f3efe6"/>`,
    accessory: () => '',
  },
  J: {
    torso: () => `<path d="${TORSO_BASE}" fill="#c07018"/><path d="M86,136 L72,200 L82,200 L96,148 Z" fill="#a05c10"/><path d="M114,136 L128,200 L118,200 L104,148 Z" fill="#a05c10"/><path d="M92,138 L100,150 L108,138 L104,200 L96,200 Z" fill="#f3efe6"/>`,
    accessory: () => `<rect x="56" y="154" width="26" height="36" rx="3" fill="#e8d0a8" stroke="#a05c10" stroke-width="1.5"/>`,
  },
  K: {
    torso: () => `<path d="${TORSO_BASE}" fill="#6A2C91"/><path d="M86,136 L74,200 L84,200 L96,148 Z" fill="#5a2479"/><path d="M114,136 L126,200 L116,200 L104,148 Z" fill="#5a2479"/>`,
    accessory: () => `<rect x="90" y="140" width="8" height="30" fill="#f6f2e6"/><rect x="102" y="140" width="8" height="30" fill="#f6f2e6"/>`,
  },
};

@Injectable({ providedIn: 'root' })
export class AvatarService {
  getPersona(id: string): Persona {
    return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
  }

  /** Busto SVG del avatar. `outfitKey` es la letra ganadora o null (ropa neutra). */
  buildBustSVG(persona: Persona, outfitKey: Letter | null): string {
    const out = (outfitKey && OUTFITS[outfitKey]) || OUTFITS['default'];
    const hairDef = HAIR_STYLES[persona.style] || HAIR_STYLES['capShort'];
    const hair = hairDef.render(persona.hair, persona.beads);
    const head = `<rect x="84" y="108" width="32" height="30" rx="6" fill="${persona.skin}"/><ellipse cx="100" cy="80" rx="44" ry="48" fill="${persona.skin}"/>`;
    const face = `<ellipse cx="82" cy="80" rx="5" ry="6" fill="#2a2118"/><ellipse cx="118" cy="80" rx="5" ry="6" fill="#2a2118"/><path d="M82,103 Q100,114 118,103" stroke="#8a5a42" stroke-width="3.5" fill="none" stroke-linecap="round"/>${persona.glasses ? GLASSES_SVG : ''}`;
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      ${out.torso()}
      ${hairDef.behind ? hair : ''}
      ${head}
      ${!hairDef.behind ? hair : ''}
      ${face}
      ${out.accessory()}
    </svg>`;
  }

  /** Brújula de 11 sectores. Si `activeLetter` está definida, resalta ese sector. */
  buildCompassSVG(activeLetter: Letter | null, size = 320): string {
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.46;
    const r = size * 0.27;
    const seg = 360 / ORDER.length;
    const half = seg / 2;

    const pt = (rad: number, deg: number) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
    };
    const wedge = (s: number, e: number) => {
      const o1 = pt(R, s), o2 = pt(R, e), i2 = pt(r, e), i1 = pt(r, s);
      return `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} A ${R} ${R} 0 0 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} A ${r} ${r} 0 0 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} Z`;
    };

    let sectors = '';
    let labels = '';
    ORDER.forEach((L, i) => {
      const center = i * seg;
      const isActive = activeLetter === L;
      sectors += `<path d="${wedge(center - half, center + half)}" class="sector${isActive ? ' active' : ''}" style="--col:var(--${L.toLowerCase()})"></path>`;
      const lp = pt(R + 24, center);
      labels += `<text x="${lp.x.toFixed(2)}" y="${(lp.y - 13).toFixed(2)}" class="sector-emoji" text-anchor="middle">${EMOJI[L]}</text>`;
      labels += `<text x="${lp.x.toFixed(2)}" y="${(lp.y + 9).toFixed(2)}" class="sector-label${isActive ? ' active' : ''}" text-anchor="middle">${L}</text>`;
    });

    return `<svg viewBox="0 0 ${size} ${size}" class="compass-svg">
      <circle cx="${cx}" cy="${cy}" r="${R + 2}" class="ring-outer"></circle>
      ${sectors}
      <circle cx="${cx}" cy="${cy}" r="${r - 3}" class="hub"></circle>
      ${labels}
      <g class="needle" style="transform-origin:${cx}px ${cy}px;">
        <path d="M ${cx} ${cy - r + 8} L ${cx - 7} ${cy - 16} L ${cx} ${cy - 1} L ${cx + 7} ${cy - 16} Z" class="needle-face"></path>
        <path d="M ${cx} ${cy + 1} L ${cx - 4} ${cy + 14} L ${cx} ${cy + 9} L ${cx + 4} ${cy + 14} Z" class="needle-face" opacity="0.55"></path>
        <circle cx="${cx}" cy="${cy}" r="6" class="needle-pivot"></circle>
      </g>
    </svg>`;
  }

  /** Ángulo (grados) al que debe apuntar la aguja para una letra dada. */
  needleAngle(letter: Letter): number {
    return ORDER.indexOf(letter) * (360 / ORDER.length);
  }
}
