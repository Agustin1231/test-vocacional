import { Injectable } from '@angular/core';
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { Letter, Persona } from '../models/test.models';
import { PERSONAS } from '../data/avatar.data';
import { EMOJI, ORDER } from '../data/profiles.data';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  getPersona(id: string): Persona {
    return (
      PERSONAS.find((p) => p.id === id) ||
      { id, name: 'Tu personaje', skin: '', hair: '', style: 'capShort' }
    );
  }

  /**
   * Avatar ilustrado real generado con DiceBear (estilo "adventurer").
   * Cada `seed` produce un personaje único y determinista, con fondo
   * transparente para montarse sobre el orbe de color de la interfaz.
   */
  buildAvatar(seed: string): string {
    return createAvatar(adventurer, {
      seed,
      scale: 90,
      radius: 6,
      translateY: 4,
    }).toString();
  }

  /**
   * Avatar del estudiante. Se mantiene la firma anterior por compatibilidad;
   * delega en DiceBear usando el id de la persona como semilla. `_outfitKey`
   * (carrera) ya no cambia la ropa: en el resultado el avatar se distingue con
   * un anillo del color del área ganadora (en la interfaz).
   */
  buildBustSVG(persona: Persona, _outfitKey: Letter | null): string {
    return this.buildAvatar(persona.id);
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
