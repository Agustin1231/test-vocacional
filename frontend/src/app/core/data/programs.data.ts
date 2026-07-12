import { Letter, Program, ResultPrograms } from '../models/test.models';

/** Programas de pregrado reales de UNIAGRARIA (verificados jun. 2026). */
export const UNI_PROGRAMS: Record<string, Program> = {
  'medicina-veterinaria': {
    slug: 'medicina-veterinaria', nombre: 'Medicina Veterinaria', emoji: '🐾',
    resumen: 'Formación clínica y científica para el diagnóstico, tratamiento y bienestar de animales domésticos, de producción y silvestres, con práctica real en la Clínica Veterinaria UNIAGRARIA.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/medicina-veterinaria/',
  },
  'zootecnia': {
    slug: 'zootecnia', nombre: 'Zootecnia', emoji: '🐄',
    resumen: 'Producción animal sostenible: nutrición, reproducción, genética y manejo de especies pecuarias para fortalecer el campo colombiano.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/zootecnia/',
  },
  'ingenieria-mecatronica': {
    slug: 'ingenieria-mecatronica', nombre: 'Ingeniería Mecatrónica', emoji: '🤖',
    resumen: 'Integra mecánica, electrónica, control automático y TIC para crear soluciones tecnológicas aplicadas al sector productivo y rural.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/ingenieria-mecatronica/',
  },
  'ingenieria-industrial': {
    slug: 'ingenieria-industrial', nombre: 'Ingeniería Industrial', emoji: '🏭',
    resumen: 'Optimiza procesos, recursos y cadenas de producción y logística en organizaciones industriales y agroindustriales.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/ingenieria-industrial/',
  },
  'ingenieria-de-alimentos': {
    slug: 'ingenieria-de-alimentos', nombre: 'Ingeniería de Alimentos', emoji: '🔬',
    resumen: 'Transformación, conservación y control de calidad de alimentos, con enfoque en innovación y seguridad alimentaria.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/ingenieria-de-alimentos/',
  },
  'ingenieria-agroindustrial': {
    slug: 'ingenieria-agroindustrial', nombre: 'Ingeniería Agroindustrial', emoji: '🌾',
    resumen: 'Aplica procesos industriales a la transformación de materias primas agropecuarias, uniendo campo e industria.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/ingenieria-agroindustrial/',
  },
  'ingenieria-civil': {
    slug: 'ingenieria-civil', nombre: 'Ingeniería Civil', emoji: '🏗️',
    resumen: 'Diseño, cálculo y construcción de infraestructura: vías, edificaciones y obras civiles con criterios de sostenibilidad.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/ingenieria-civil/',
  },
  'ingenieria-ambiental': {
    slug: 'ingenieria-ambiental', nombre: 'Ingeniería Ambiental', emoji: '🌿',
    resumen: 'Gestión y conservación de recursos naturales, evaluación de impacto ambiental y sostenibilidad de los territorios.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/ingenieria-ambiental/',
  },
  'administracion-financiera-y-de-sistemas': {
    slug: 'administracion-financiera-y-de-sistemas', nombre: 'Administración Financiera y de Sistemas', emoji: '💼',
    resumen: 'Gestión financiera, analítica de datos y sistemas de información para la toma de decisiones empresariales.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/administracion-financiera-y-de-sistemas/',
  },
  'contaduria-publica': {
    slug: 'contaduria-publica', nombre: 'Contaduría Pública', emoji: '📊',
    resumen: 'Control financiero, auditoría, tributación y gestión contable para organizaciones públicas y privadas.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/contaduria-publica/',
  },
  'derecho': {
    slug: 'derecho', nombre: 'Derecho', emoji: '⚖️',
    resumen: 'Formación jurídica integral con énfasis en Derecho Ambiental y Agrario, orientada a la justicia y el desarrollo del sector rural.',
    url: 'https://www.uniagraria.edu.co/programasacademicos/derecho/',
  },
};

/** Qué programas se recomiendan según la letra ganadora. */
export const RESULT_PROGRAMS: Record<Letter, ResultPrograms> = {
  A: { primary: ['medicina-veterinaria'], related: ['zootecnia', 'ingenieria-ambiental'] },
  B: { primary: ['zootecnia'], related: ['medicina-veterinaria', 'ingenieria-agroindustrial'] },
  C: { primary: ['ingenieria-mecatronica'], related: ['ingenieria-industrial', 'administracion-financiera-y-de-sistemas'] },
  D: { primary: ['ingenieria-industrial'], related: ['ingenieria-mecatronica', 'ingenieria-civil'] },
  E: { primary: ['ingenieria-de-alimentos'], related: ['ingenieria-agroindustrial', 'zootecnia'] },
  F: { primary: ['ingenieria-agroindustrial'], related: ['ingenieria-de-alimentos', 'zootecnia'] },
  G: { primary: ['ingenieria-civil'], related: ['ingenieria-industrial', 'ingenieria-ambiental'] },
  H: { primary: ['ingenieria-ambiental'], related: ['ingenieria-agroindustrial', 'derecho'] },
  I: { primary: ['administracion-financiera-y-de-sistemas'], related: ['contaduria-publica', 'ingenieria-industrial'] },
  J: { primary: ['contaduria-publica'], related: ['administracion-financiera-y-de-sistemas', 'derecho'] },
  K: { primary: ['derecho'], related: ['administracion-financiera-y-de-sistemas', 'ingenieria-ambiental'] },
};
