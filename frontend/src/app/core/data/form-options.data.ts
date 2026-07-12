/** Opciones de los selects del formulario de registro. */

export const DOC_OPTIONS = [
  'Tarjeta de Identidad (TI)',
  'Cédula de Ciudadanía (CC)',
  'Cédula de Extranjería (CE)',
  'Pasaporte',
  'Otro',
];

export const GRADO_OPTIONS = [
  'Noveno',
  'Décimo',
  'Once',
  'Ya soy bachiller / egresado',
  'Otro',
];

export const CIUDAD_OPTIONS = [
  'Bogotá D.C.',
  'Facatativá',
  'Zipaquirá',
  'Chía',
  'Cajicá',
  'Tabio',
  'Madrid (Cundinamarca)',
  'Funza',
  'Mosquera',
  'Soacha',
  'Otra ciudad de Cundinamarca',
  'Otra ciudad de Colombia',
];

export const EDAD_OPTIONS: string[] = (() => {
  const arr: string[] = [];
  for (let i = 13; i <= 22; i++) arr.push(String(i));
  arr.push('23 o más');
  return arr;
})();
