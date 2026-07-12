/**
 * Modelos de dominio del Test Vocacional.
 * Las 11 áreas se identifican con una letra A–K.
 */
export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K';

/** Perfil vocacional asociado a cada letra. */
export interface Profile {
  carrera: string;
  area: string;
  perfil: string;
  fortalezas: string[];
  debilidades: string[];
  cualidades: string[];
}

/** Programa de pregrado real de UNIAGRARIA. */
export interface Program {
  slug: string;
  nombre: string;
  emoji: string;
  resumen: string;
  url: string;
}

/** Mapa de resultado → programas recomendados. */
export interface ResultPrograms {
  primary: string[];
  related: string[];
  note?: string;
}

/** Una opción dentro de una pregunta: suma un punto a su letra. */
export interface Option {
  l: Letter;
  t: string;
}

export interface Question {
  id: number;
  text: string;
  options: Option[];
}

/** Pregunta de desempate entre dos letras. */
export interface Tiebreak {
  note: string;
  text: string;
  options: Option[];
}

/** Contadores de respuestas por letra. */
export type Counts = Record<Letter, number>;

/** Persona base del avatar (rasgos). */
export interface Persona {
  id: string;
  name: string;
  skin: string;
  hair: string;
  style: HairStyle;
  glasses?: boolean;
  beads?: string[];
}

export type HairStyle =
  | 'capShort' | 'capSide' | 'ponytail' | 'longStraight'
  | 'braids' | 'afro' | 'afroBig';

export interface AvatarColor {
  hex: string;
  name: string;
}

/** Configuración del avatar elegida por el estudiante. */
export interface AvatarConfig {
  personaId: string;
  color: string;
  apodo: string;
}

/** Datos de registro del estudiante. */
export interface Registro {
  nombre: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  celular: string;
  correo: string;
  colegio: string;
  grado: string;
  ciudad: string;
  edad: string;
}

/** Informe guardado (lo que consumiría el backend / panel admin). */
export interface Informe {
  id: string;
  fecha: string;
  registro: Registro;
  avatar: AvatarConfig;
  letra: Letter;
  carrera: string;
  area: string;
  contadores: Counts;
}

/** Mensaje del chat con el asesor IA. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
