import { AvatarColor, Persona } from '../models/test.models';

/** Personas base seleccionables para el avatar. */
export const PERSONAS: Persona[] = [
  { id: 'mateo', name: 'Mateo', skin: '#e8b894', hair: '#3b2a1e', style: 'capShort' },
  { id: 'sofia', name: 'Sofía', skin: '#f3cda3', hair: '#d9a441', style: 'ponytail' },
  { id: 'samuel', name: 'Samuel', skin: '#8a5a3c', hair: '#1b1b1b', style: 'afro' },
  { id: 'valentina', name: 'Valentina', skin: '#c98a5b', hair: '#241f1c', style: 'longStraight' },
  { id: 'andres', name: 'Andrés', skin: '#f3cda3', hair: '#b34a2a', style: 'capShort', glasses: true },
  { id: 'camila', name: 'Camila', skin: '#6b4226', hair: '#1f1b1a', style: 'afroBig' },
  { id: 'julian', name: 'Julián', skin: '#c98a5b', hair: '#161616', style: 'capSide' },
  { id: 'luna', name: 'Luna', skin: '#8a5a3c', hair: '#1b1b1b', style: 'braids', beads: ['#EBE72A', '#009F93', '#F4A705'] },
];

/** Colores de fondo del avatar (paleta oficial UNIAGRARIA). */
export const AVATAR_COLORS: AvatarColor[] = [
  { hex: '#7AC143', name: 'verde' },
  { hex: '#EBE72A', name: 'amarillo' },
  { hex: '#008FC5', name: 'azul' },
  { hex: '#009F93', name: 'turquesa' },
  { hex: '#F4A705', name: 'naranja' },
  { hex: '#D7951E', name: 'dorado' },
  { hex: '#6A2C91', name: 'morado' },
  { hex: '#B30838', name: 'vinotinto' },
];
