import { Letter, Profile } from '../models/test.models';

/** Orden canónico de las 11 áreas. */
export const ORDER: Letter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

/** Emoji representativo de cada área. */
export const EMOJI: Record<Letter, string> = {
  A: '🐾', B: '🐄', C: '🤖', D: '🏭', E: '🔬', F: '🌾',
  G: '🏗️', H: '🌿', I: '💼', J: '📊', K: '⚖️',
};

export const PROFILES: Record<Letter, Profile> = {
  A: {
    carrera: 'Medicina Veterinaria', area: 'Ciencias de la Salud Animal',
    perfil: 'Clínico apasionado por la salud y el bienestar de los animales: diagnosticas, operas y tratas con destreza en la clínica, el campo y la producción.',
    fortalezas: ['Diagnóstico clínico visual y táctil', 'Pensamiento biológico estructurado', 'Resistencia para el trabajo operativo de campo'],
    debilidades: ['Frustración ante pérdidas clínicas inevitables', 'Dificultad para desconectar emocionalmente de los pacientes animales'],
    cualidades: ['Empatía', 'Destreza manual', 'Rigor científico', 'Paciencia clínica'],
  },
  B: {
    carrera: 'Zootecnia', area: 'Producción Animal Sostenible',
    perfil: 'Estratega del campo: optimizas la genética, la nutrición y la reproducción animal para hacer el sector agropecuario colombiano más productivo y sostenible.',
    fortalezas: ['Visión productiva y zootécnica del campo', 'Manejo de indicadores de producción animal', 'Capacidad para aplicar ciencia en entornos rurales'],
    debilidades: ['Riesgo de descuidar el componente clínico individual por enfocarse en productividad masiva', 'Adaptación difícil a entornos urbanos'],
    cualidades: ['Visión agropecuaria', 'Liderazgo rural', 'Pensamiento sistémico', 'Amor por el campo'],
  },
  C: {
    carrera: 'Ingeniería Mecatrónica', area: 'Tecnología y Automatización',
    perfil: 'Diseñador y programador de sistemas autónomos en la frontera de la mecánica, la electrónica y la computación aplicada.',
    fortalezas: ['Razonamiento lógico-matemático avanzado', 'Conexión precisa entre hardware y software', 'Agilidad para resolver fallas técnicas complejas'],
    debilidades: ['Riesgo de aislarse en el código descuidando el factor humano', 'Perfeccionismo que retrasa entregas'],
    cualidades: ['Creatividad técnica', 'Inventiva', 'Precisión', 'Curiosidad insaciable por las máquinas'],
  },
  D: {
    carrera: 'Ingeniería Industrial', area: 'Optimización de Procesos y Logística',
    perfil: 'Optimizador nato: reduces desperdicios, diseñas flujos eficientes y haces que las industrias y cadenas logísticas funcionen como relojes.',
    fortalezas: ['Análisis de procesos y tiempos', 'Diseño de flujos logísticos eficientes', 'Liderazgo operativo en planta'],
    debilidades: ['Dificultad para manejar equipos cuando el factor humano rompe la lógica de los procesos', 'Resistencia a la ambigüedad'],
    cualidades: ['Pragmatismo', 'Orden sistemático', 'Visión macro', 'Disciplina operativa'],
  },
  E: {
    carrera: 'Ingeniería de Alimentos', area: 'Ciencia y Tecnología Alimentaria',
    perfil: 'Científico de la industria alimentaria: transformas, conservas y aseguras la calidad de los alimentos que llegan a los hogares colombianos y al mundo.',
    fortalezas: ['Dominio combinado de química, microbiología y física de alimentos', 'Control riguroso de calidad', 'Diseño de procesos de conservación a gran escala'],
    debilidades: ['Rigidez ante imprevistos por los estrictos protocolos sanitarios', 'Incomodidad ante cambios comerciales no planeados'],
    cualidades: ['Rigor en el laboratorio', 'Conciencia sobre salud pública', 'Mentalidad investigativa', 'Orden de procesos'],
  },
  F: {
    carrera: 'Ingeniería Agroindustrial', area: 'Agroindustria y Cadenas Productivas',
    perfil: 'Puente entre el campo y la industria: transformas materias primas agropecuarias en productos de valor agregado, impulsando el desarrollo rural colombiano.',
    fortalezas: ['Comprensión integral de la cadena campo-industria', 'Gestión de procesos agroindustriales', 'Conexión con comunidades rurales y cadenas de valor'],
    debilidades: ['Dificultad para especializarse en un solo frente: el campo o la industria', 'Riesgo de dispersión de esfuerzos'],
    cualidades: ['Versatilidad', 'Visión de cadena productiva', 'Adaptabilidad al entorno rural', 'Pensamiento integral'],
  },
  G: {
    carrera: 'Ingeniería Civil', area: 'Infraestructura y Obras',
    perfil: 'Constructor del entorno físico del futuro: diseñas, calculas y construyes vías, puentes y edificaciones con criterios técnicos y de sostenibilidad.',
    fortalezas: ['Abstracción matemática aplicada a estructuras', 'Visión espacial y de planos', 'Liderazgo en obras y proyectos de largo plazo'],
    debilidades: ['Exposición constante a condiciones de obra exigentes', 'Dificultad para adaptarse a cambios en presupuesto o alcance del proyecto'],
    cualidades: ['Pensamiento estructural', 'Liderazgo técnico', 'Disciplina proyectual', 'Visión de largo plazo'],
  },
  H: {
    carrera: 'Ingeniería Ambiental', area: 'Gestión Ambiental y Sostenibilidad',
    perfil: 'Guardián del territorio: gestionas los recursos naturales, evalúas impactos ambientales y diseñas soluciones sostenibles para empresas, comunidades y ecosistemas.',
    fortalezas: ['Comprensión de ecosistemas y normativa ambiental colombiana', 'Capacidad de análisis de impacto ambiental', 'Gestión de proyectos de sostenibilidad'],
    debilidades: ['Frustración ante la lentitud de los procesos institucionales ambientales', 'Tensión entre el ideal ambiental y las realidades económicas del sector'],
    cualidades: ['Conciencia ambiental', 'Pensamiento sistémico', 'Compromiso social', 'Visión territorial'],
  },
  I: {
    carrera: 'Administración Financiera y de Sistemas', area: 'Ciencias Administrativas',
    perfil: 'Estratega del capital y la tecnología empresarial: tomas decisiones financieras críticas, líderas organizaciones y conectas los sistemas de información con el negocio.',
    fortalezas: ['Habilidades de negociación y liderazgo de equipos', 'Análisis financiero y de sistemas de información', 'Resolución ágil de crisis empresariales'],
    debilidades: ['Riesgo de darle peso excesivo a los números dejando de lado el factor humano', 'Vulnerabilidad al estrés financiero en crisis'],
    cualidades: ['Persuasión', 'Visión de negocio', 'Asertividad', 'Orden financiero'],
  },
  J: {
    carrera: 'Contaduría Pública', area: 'Control Financiero y Tributario',
    perfil: 'Guardián de las finanzas: auditas, controlas, tributas y registras con exactitud milimétrica para que las organizaciones funcionen de manera legal y transparente.',
    fortalezas: ['Exactitud numérica y atención al detalle', 'Conocimiento tributario y de normativa contable', 'Ética profesional impecable en el manejo de cifras'],
    debilidades: ['Riesgo de enfocarse en el cumplimiento normativo sin ver el panorama estratégico', 'Alta exposición a responsabilidad legal'],
    cualidades: ['Rigurosidad', 'Ética financiera', 'Meticulosidad', 'Confiabilidad'],
  },
  K: {
    carrera: 'Derecho', area: 'Ciencias Jurídicas',
    perfil: 'Defensor del orden legal y la justicia: resuelves conflictos, proteges derechos y navegas los códigos normativos con argumentación sólida y ética profesional.',
    fortalezas: ['Comprensión lectora avanzada de textos complejos', 'Estructuración de argumentos lógicos', 'Excelente expresión oral y escrita en entornos formales'],
    debilidades: ['Riesgo de dogmatismo si se limita a la letra estricta de la ley', 'Desgaste emocional por litigios de alto impacto'],
    cualidades: ['Elocuencia', 'Ética profesional', 'Pensamiento argumentativo', 'Firmeza de carácter'],
  },
};
