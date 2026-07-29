using Microsoft.EntityFrameworkCore;
using VocacionalTest.Domain.Entities;

namespace VocacionalTest.Infrastructure.Persistence;

/// <summary>
/// Carga los datos iniciales del test (catálogos, perfiles, programas y
/// preguntas). Los valores son los mismos que usa el frontend, para que los
/// nombres que llegan en POST /api/resultados se puedan resolver contra la base.
///
/// Es idempotente: cada tabla se llena SOLO si está vacía. No borra ni actualiza
/// nada, así que se puede ejecutar en cada arranque sin duplicar filas.
/// </summary>
public static class DbSeeder
{
    /// <summary>Orden canónico de las 11 letras/áreas del test.</summary>
    private static readonly string[] LetrasOrden =
        { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K" };

    private static readonly string[] TiposDocumento =
    {
        "Tarjeta de Identidad (TI)",
        "Cédula de Ciudadanía (CC)",
        "Cédula de Extranjería (CE)",
        "Pasaporte",
        "Otro"
    };

    private static readonly string[] Grados =
    {
        "Noveno",
        "Décimo",
        "Once",
        "Ya soy bachiller / egresado",
        "Otro"
    };

    private static readonly string[] Ciudades =
    {
        "Bogotá D.C.",
        "Facatativá",
        "Zipaquirá",
        "Chía",
        "Cajicá",
        "Tabio",
        "Madrid (Cundinamarca)",
        "Funza",
        "Mosquera",
        "Soacha",
        "Otra ciudad de Cundinamarca",
        "Otra ciudad de Colombia"
    };

    private static readonly string[] Roles = { "Administrador", "Estudiante" };

    /// <summary>
    /// Perfiles vocacionales: (nombre del área, descripción del perfil). El nombre
    /// es el área porque es el dato corto y estable con el que se identifica el
    /// perfil desde el frontend.
    /// </summary>
    private static readonly (string Nombre, string Descripcion)[] Perfiles =
    {
        // A - Medicina Veterinaria
        ("Ciencias de la Salud Animal",
         "Clínico apasionado por la salud y el bienestar de los animales: diagnosticas, operas y tratas con destreza en la clínica, el campo y la producción."),
        // B - Zootecnia
        ("Producción Animal Sostenible",
         "Estratega del campo: optimizas la genética, la nutrición y la reproducción animal para hacer el sector agropecuario colombiano más productivo y sostenible."),
        // C - Ingeniería Mecatrónica
        ("Tecnología y Automatización",
         "Diseñador y programador de sistemas autónomos en la frontera de la mecánica, la electrónica y la computación aplicada."),
        // D - Ingeniería Industrial
        ("Optimización de Procesos y Logística",
         "Optimizador nato: reduces desperdicios, diseñas flujos eficientes y haces que las industrias y cadenas logísticas funcionen como relojes."),
        // E - Ingeniería de Alimentos
        ("Ciencia y Tecnología Alimentaria",
         "Científico de la industria alimentaria: transformas, conservas y aseguras la calidad de los alimentos que llegan a los hogares colombianos y al mundo."),
        // F - Ingeniería Agroindustrial
        ("Agroindustria y Cadenas Productivas",
         "Puente entre el campo y la industria: transformas materias primas agropecuarias en productos de valor agregado, impulsando el desarrollo rural colombiano."),
        // G - Ingeniería Civil
        ("Infraestructura y Obras",
         "Constructor del entorno físico del futuro: diseñas, calculas y construyes vías, puentes y edificaciones con criterios técnicos y de sostenibilidad."),
        // H - Ingeniería Ambiental
        ("Gestión Ambiental y Sostenibilidad",
         "Guardián del territorio: gestionas los recursos naturales, evalúas impactos ambientales y diseñas soluciones sostenibles para empresas, comunidades y ecosistemas."),
        // I - Administración Financiera y de Sistemas
        ("Ciencias Administrativas",
         "Estratega del capital y la tecnología empresarial: tomas decisiones financieras críticas, líderas organizaciones y conectas los sistemas de información con el negocio."),
        // J - Contaduría Pública
        ("Control Financiero y Tributario",
         "Guardián de las finanzas: auditas, controlas, tributas y registras con exactitud milimétrica para que las organizaciones funcionen de manera legal y transparente."),
        // K - Derecho
        ("Ciencias Jurídicas",
         "Defensor del orden legal y la justicia: resuelves conflictos, proteges derechos y navegas los códigos normativos con argumentación sólida y ética profesional."),
    };

    /// <summary>
    /// Programas académicos: (nombre, facultad/área, descripción). El área coincide
    /// con el nombre del perfil vocacional, así que sirve para asociarlos.
    /// </summary>
    private static readonly (string Nombre, string Area, string Descripcion)[] Programas =
    {
        ("Medicina Veterinaria",
         "Ciencias de la Salud Animal",
         "Formación clínica y científica para el diagnóstico, tratamiento y bienestar de animales domésticos, de producción y silvestres, con práctica real en la Clínica Veterinaria UNIAGRARIA."),
        ("Zootecnia",
         "Producción Animal Sostenible",
         "Producción animal sostenible: nutrición, reproducción, genética y manejo de especies pecuarias para fortalecer el campo colombiano."),
        ("Ingeniería Mecatrónica",
         "Tecnología y Automatización",
         "Integra mecánica, electrónica, control automático y TIC para crear soluciones tecnológicas aplicadas al sector productivo y rural."),
        ("Ingeniería Industrial",
         "Optimización de Procesos y Logística",
         "Optimiza procesos, recursos y cadenas de producción y logística en organizaciones industriales y agroindustriales."),
        ("Ingeniería de Alimentos",
         "Ciencia y Tecnología Alimentaria",
         "Transformación, conservación y control de calidad de alimentos, con enfoque en innovación y seguridad alimentaria."),
        ("Ingeniería Agroindustrial",
         "Agroindustria y Cadenas Productivas",
         "Aplica procesos industriales a la transformación de materias primas agropecuarias, uniendo campo e industria."),
        ("Ingeniería Civil",
         "Infraestructura y Obras",
         "Diseño, cálculo y construcción de infraestructura: vías, edificaciones y obras civiles con criterios de sostenibilidad."),
        ("Ingeniería Ambiental",
         "Gestión Ambiental y Sostenibilidad",
         "Gestión y conservación de recursos naturales, evaluación de impacto ambiental y sostenibilidad de los territorios."),
        ("Administración Financiera y de Sistemas",
         "Ciencias Administrativas",
         "Gestión financiera, analítica de datos y sistemas de información para la toma de decisiones empresariales."),
        ("Contaduría Pública",
         "Control Financiero y Tributario",
         "Control financiero, auditoría, tributación y gestión contable para organizaciones públicas y privadas."),
        ("Derecho",
         "Ciencias Jurídicas",
         "Formación jurídica integral con énfasis en Derecho Ambiental y Agrario, orientada a la justicia y el desarrollo del sector rural."),
    };

    /// <summary>
    /// Las 22 preguntas del test con sus 6 opciones: (letra, texto de la opción).
    /// </summary>
    private static readonly (string Enunciado, (string Letra, string Texto)[] Opciones)[] Preguntas =
    {
        // Pregunta 1
        ("¿Qué tipo de actividades disfrutas más en tu tiempo libre?", new[]
        {
            ("A", "Cuidar animales, observar su comportamiento o estudiar cómo funciona el cuerpo de los seres vivos."),
            ("B", "Visitar fincas, aprender sobre cultivos, animales de cría o cómo funciona el campo colombiano."),
            ("C", "Desarmar aparatos electrónicos, programar algo o experimentar con circuitos y software."),
            ("D", "Analizar cómo se organiza una fábrica, estudiar procesos industriales o mejorar la logística de algo."),
            ("E", "Experimentar con recetas, fermentaciones, conservas o investigar la química de los alimentos."),
            ("F", "Investigar cómo se transforma un producto del campo (leche, maíz, palma) hasta llegar al consumidor."),
        }),
        // Pregunta 2
        ("¿Cuál de estas habilidades describes como tu punto más fuerte?", new[]
        {
            ("G", "La visión espacial: ver un plano y entender qué se construye, calcular si una estructura aguanta."),
            ("H", "La conciencia ambiental: notar el impacto humano sobre la naturaleza e indignarte por la contaminación."),
            ("I", "El liderazgo, la capacidad de convencer, negociar y organizar recursos económicos de forma estratégica."),
            ("J", "La exactitud numérica: detectar errores en cuentas, organizar registros y controlar cada peso."),
            ("K", "La comunicación efectiva, el análisis de textos complejos y la facilidad para resolver conflictos."),
            ("A", "La empatía, el cuidado minucioso de la vida (animal o vegetal) y la observación clínica detallada."),
        }),
        // Pregunta 3
        ("¿Qué tipo de problemas te motiva más resolver?", new[]
        {
            ("B", "Mejorar la productividad de una finca: que los animales rindan más, crezcan mejor y sean más sanos."),
            ("C", "Un robot o sistema automatizado que falla y detiene la producción: encuentras el bug o el circuito dañado."),
            ("D", "Un proceso ineficiente en una planta o empresa que genera pérdidas de tiempo y dinero."),
            ("E", "Investigar por qué un alimento cambió su sabor, acidez o textura y reformular el proceso industrial."),
            ("F", "Aprovechar materias primas del campo que se desperdician para convertirlas en productos de valor."),
            ("G", "Fallas en infraestructuras —una fisura en un puente, un talud inestable— que amenazan la seguridad."),
        }),
        // Pregunta 4
        ("¿Cómo prefieres aprender cosas nuevas?", new[]
        {
            ("H", "Saliendo al campo a tomar muestras, medir ríos, identificar especies o evaluar el impacto de una empresa."),
            ("I", "Simulando negocios, analizando estados financieros de empresas reales y tomando decisiones de inversión."),
            ("J", "Practicando con software contable, resolviendo ejercicios tributarios y auditando casos reales."),
            ("K", "Leyendo sentencias, analizando jurisprudencia y debatiendo los argumentos de ambas partes de un caso."),
            ("A", "En laboratorios biológicos o directamente en el campo, interactuando con animales y entornos vivos."),
            ("B", "Visitando fincas, tocando animales, probando técnicas de manejo de ganado y cultivos en campo real."),
        }),
        // Pregunta 5
        ("¿Qué es lo más importante para ti en tu futuro trabajo?", new[]
        {
            ("C", "Crear tecnología de punta: robots, sensores y sistemas de control que transformen la industria."),
            ("D", "Optimizar procesos y cadenas de suministro para que las empresas funcionen con máxima eficiencia."),
            ("E", "Garantizar que los alimentos que consume la gente sean seguros, nutritivos y de alta calidad."),
            ("F", "Conectar el campo con la industria y darle valor agregado a los productos agropecuarios colombianos."),
            ("G", "Ver tus diseños convertidos en grandes obras reales: vías, puentes o edificaciones que duran décadas."),
            ("H", "Proteger los ecosistemas: gestionar recursos naturales y diseñar soluciones de desarrollo sostenible."),
        }),
        // Pregunta 6
        ("¿En qué tipo de ambiente te gustaría trabajar cada día?", new[]
        {
            ("I", "En corporativos empresariales, salas de juntas o entidades financieras gestionando estrategia."),
            ("J", "En una firma contable, revisando balances, declarando impuestos y auditando organizaciones."),
            ("K", "En juzgados, firmas legales, notarías, entidades del Estado o asesorando empresas jurídicamente."),
            ("A", "En el campo abierto, clínicas veterinarias o laboratorios biológicos trabajando con seres vivos."),
            ("B", "En granjas, establos o galpones, rodeado de animales y naturaleza con trabajo activo y variado."),
            ("C", "En talleres de tecnología, laboratorios de robótica o plantas de producción automatizadas."),
        }),
        // Pregunta 7
        ("¿Qué materia escolar te ha gustado más o te ha resultado más fácil?", new[]
        {
            ("D", "Matemáticas aplicadas, Física o Ingeniería de procesos: los cálculos de producción te atraen."),
            ("E", "Química aplicada o Ciencias de los alimentos: las reacciones, los procesos y la conservación."),
            ("F", "Ciencias agropecuarias o Tecnología de procesos: cómo se transforma la materia prima del campo."),
            ("G", "Dibujo Técnico, Física o Matemáticas estructurales: calcular resistencias y diseñar estructuras."),
            ("H", "Ciencias de la Tierra, Ecología o Geografía: los ecosistemas, el clima y el impacto ambiental."),
            ("I", "Economía, Emprendimiento o Administración: liderar negocios y tomar decisiones financieras."),
        }),
        // Pregunta 8
        ("¿Cómo te imaginas en tu trabajo dentro de 10 años?", new[]
        {
            ("J", "Como contador o auditor de una empresa grande, con la responsabilidad del control financiero total."),
            ("K", "Como abogado reconocido en Derecho Ambiental y Agrario, con casos de alto impacto nacional."),
            ("A", "Salvando vidas animales en una clínica especializada o liderando la salud del sector pecuario."),
            ("B", "Asesorando fincas ganaderas o avícolas para mejorar su productividad, genética y rentabilidad."),
            ("C", "Liderando el equipo de automatización de una empresa agroindustrial con robots de última generación."),
            ("D", "Como gerente de operaciones que redujo los costos de una empresa en 30% optimizando sus procesos."),
        }),
        // Pregunta 9
        ("¿Qué tipo de impacto quieres tener en la sociedad colombiana?", new[]
        {
            ("E", "Mejorar la seguridad alimentaria y la nutrición de las familias colombianas desde la industria."),
            ("F", "Impulsar el desarrollo del sector rural colombiano transformando sus materias primas con tecnología."),
            ("G", "Construir la infraestructura que conecte las regiones del país y mejore la calidad de vida."),
            ("H", "Reducir la huella ambiental de las industrias y preservar los recursos naturales para el futuro."),
            ("I", "Fortalecer las empresas colombianas con una gestión financiera estratégica y competitiva."),
            ("J", "Garantizar la transparencia y el cumplimiento tributario de las empresas para que el Estado tenga recursos."),
        }),
        // Pregunta 10
        ("¿Qué tipo de proyecto te gustaría liderar como jefe o responsable?", new[]
        {
            ("K", "La defensa legal de una comunidad rural frente a un proyecto minero que amenaza sus territorios."),
            ("A", "Un programa de salud animal preventiva para erradicar una enfermedad del ganado en una región."),
            ("B", "Un plan nacional de mejoramiento genético bovino para aumentar la producción de leche en el país."),
            ("C", "El diseño e implementación de un sistema robótico completo en una planta de producción alimentaria."),
            ("D", "La reestructuración logística y operativa de una empresa grande para mejorar su competitividad."),
            ("E", "El desarrollo de un nuevo alimento funcional que mejore la nutrición de poblaciones vulnerables."),
        }),
        // Pregunta 11
        ("Si participas en la creación de una empresa agroindustrial, ¿cuál sería tu rol ideal?", new[]
        {
            ("F", "Responsable de la cadena de valor: desde la compra de materia prima hasta la comercialización del producto."),
            ("G", "Director de obra: diseño estructural de las bodegas, la planta y la infraestructura de la empresa."),
            ("H", "Gestor ambiental: licencias, planes de manejo ambiental y sistemas de tratamiento de residuos."),
            ("I", "Gerente financiero: presupuesto, flujo de caja, créditos y proyección de rentabilidad a largo plazo."),
            ("J", "Contador general: registros contables, declaraciones tributarias y control de activos de la empresa."),
            ("K", "Asesor legal: contratos con proveedores, licencias de operación y cumplimiento de la normativa vigente."),
        }),
        // Pregunta 12
        ("¿Con cuál \"incendio\" del trabajo te sentirías más en tu elemento para apagarlo?", new[]
        {
            ("A", "Un brote infeccioso grave en animales de una finca que amenaza con perderse la producción entera."),
            ("B", "Una plaga o enfermedad que afecta el hato lechero de una región y reduce la producción en 40%."),
            ("C", "Un fallo en el sistema de control de una línea de producción robotizada que genera piezas defectuosas."),
            ("D", "Un cuello de botella severo en la logística de distribución que genera millones en pérdidas diarias."),
            ("E", "Un lote de alimentos procesados que no pasa el control microbiológico y puede generar una crisis sanitaria."),
            ("F", "Una cosecha de frutas que llega en mal estado y hay que procesar y conservar de forma urgente."),
        }),
        // Pregunta 13
        ("¿En qué actividad pierdes la noción del tiempo sin aburrirte?", new[]
        {
            ("G", "Resolviendo cálculos estructurales, dibujando planos o diseñando edificaciones con software de ingeniería."),
            ("H", "Identificando especies, analizando muestras ambientales o estudiando el impacto de un proyecto en un ecosistema."),
            ("I", "Analizando estados financieros, modelando proyecciones económicas o estructurando un plan de negocios."),
            ("J", "Cuadrando libros contables, encontrando un error en la declaración de renta o auditando una empresa."),
            ("K", "Leyendo códigos legales, redactando argumentos jurídicos o debatiendo la interpretación de una norma."),
            ("A", "Examinando animales, leyendo sobre enfermedades clínicas o aprendiendo técnicas de diagnóstico."),
        }),
        // Pregunta 14
        ("¿Qué tipo de herramienta o recurso disfrutas usar más?", new[]
        {
            ("B", "Equipos de manejo animal, software de registros zootécnicos o planos de nutrición y reproducción."),
            ("C", "Microcontroladores, IDEs de programación, osciloscopios y software de diseño de sistemas de control."),
            ("D", "Software de simulación de procesos industriales, cronómetros y diagramas de flujo de producción."),
            ("E", "Equipos de laboratorio de alimentos: autoclaves, cromatógrafos, reactores y sistemas de empaque."),
            ("F", "Maquinaria de procesamiento agroindustrial: secadores, pasteurizadores, molinos y equipos de empaque."),
            ("G", "Software CAD estructural, equipos topográficos, equipos de medición de materiales y cálculo de concreto."),
        }),
        // Pregunta 15
        ("¿Cuál de estas situaciones te parece más emocionante?", new[]
        {
            ("H", "Lograr que una empresa contaminante cambie sus prácticas y recupere el ecosistema que había dañado."),
            ("I", "Llevar a una empresa desde pérdidas hasta rentabilidad gracias a una estrategia financiera brillante."),
            ("J", "Presentar a los socios de una empresa un informe contable impecable que genera plena confianza."),
            ("K", "Ganar un juicio que parecía imposible y ver que la justicia protegió a quien más lo necesitaba."),
            ("A", "Realizar la primera cirugía exitosa en un animal de gran tamaño y verlo recuperarse completamente."),
            ("B", "Demostrar que una nueva técnica de alimentación aumentó el peso del ganado un 20% en menos tiempo."),
        }),
        // Pregunta 16
        ("¿Qué tipo de conocimiento te parece más valioso aprender?", new[]
        {
            ("C", "Robótica, sistemas embebidos, control automático e inteligencia artificial aplicada a la industria."),
            ("D", "Ingeniería de métodos, ergonomía industrial, gestión de calidad y optimización de cadenas productivas."),
            ("E", "Microbiología de alimentos, termodinámica de procesos, normas HACCP e inocuidad alimentaria global."),
            ("F", "Tecnologías de transformación agroindustrial, cadenas de frío, bioeconomía y mercados agropecuarios."),
            ("G", "Mecánica de suelos, resistencia de materiales, diseño estructural y gestión de proyectos de obra civil."),
            ("H", "Ecología aplicada, normativa ambiental colombiana (PGAR, POMCA), SIG y sistemas de gestión ambiental."),
        }),
        // Pregunta 17
        ("¿Qué perfil profesional admiras más?", new[]
        {
            ("I", "Un directivo financiero que salvó una empresa en quiebra con una reestructuración estratégica brillante."),
            ("J", "Un contador que descubrió un fraude millonario en una empresa y evitó que miles perdieran sus ahorros."),
            ("K", "Un abogado que defendió a comunidades rurales frente a empresas que querían desplazarlas de sus tierras."),
            ("A", "Un veterinario reconocido que salvó una especie en peligro o diseñó un protocolo sanitario nacional."),
            ("B", "Un zootecnista que desarrolló un modelo de producción bovina sostenible adoptado en todo el país."),
            ("C", "Un ingeniero que diseñó el sistema de automatización más eficiente de la industria latinoamericana."),
        }),
        // Pregunta 18
        ("¿Qué tipo de investigación o proyecto académico te resultaría más motivador?", new[]
        {
            ("D", "Analizar los tiempos muertos de una empresa y proponer cómo reducir sus costos operativos en 25%."),
            ("E", "Crear un conservante natural para un alimento regional y compararlo con los conservantes sintéticos."),
            ("F", "Diseñar una línea de productos derivados del cacao colombiano para exportarlos con mayor valor agregado."),
            ("G", "Diseñar un puente peatonal para una comunidad rural y calcular su resistencia con materiales locales."),
            ("H", "Evaluar el impacto ambiental de una empresa sobre un río cercano y proponer medidas de remediación."),
            ("I", "Elaborar un plan de negocio completo con análisis financiero, proyección y estrategia de mercado."),
        }),
        // Pregunta 19
        ("¿Cuál de estos retos del país colombiano te genera más urgencia de actuar?", new[]
        {
            ("J", "La evasión fiscal y la informalidad empresarial que le restan recursos vitales al Estado colombiano."),
            ("K", "La falta de acceso a la justicia de las comunidades rurales y campesinas más vulnerables del país."),
            ("A", "Las enfermedades que afectan el ganado y amenazan la seguridad alimentaria y las exportaciones."),
            ("B", "La baja productividad agropecuaria del campo colombiano frente a los estándares internacionales."),
            ("C", "La baja automatización de las industrias colombianas frente a la competencia global emergente."),
            ("D", "El desperdicio de recursos y la ineficiencia operativa de muchas empresas colombianas medianas."),
        }),
        // Pregunta 20
        ("¿Cuál sería tu mayor logro profesional soñado?", new[]
        {
            ("E", "Desarrollar un alimento funcional colombiano que mejore la nutrición de niños en zonas rurales."),
            ("F", "Crear una marca agroindustrial colombiana que exporte a 15 países con materia prima 100% local."),
            ("G", "Diseñar y liderar la construcción de una obra vial que conecte una región aislada de Colombia."),
            ("H", "Lograr que una empresa minera adopte prácticas de cero impacto ambiental como estándar global."),
            ("I", "Llevar una empresa colombiana a cotizar en bolsa como resultado de tu gestión financiera estratégica."),
            ("J", "Ser el primer contador que implementa un sistema de auditoría digital en las PYMES colombianas."),
        }),
        // Pregunta 21
        ("¿En qué tipo de equipo de trabajo te sientes más cómodo(a)?", new[]
        {
            ("K", "Con abogados, jueces, notarios y defensores de derechos en entornos legales e institucionales."),
            ("A", "Con veterinarios, biólogos y científicos trabajando juntos por el bienestar de los seres vivos."),
            ("B", "Con zootecnistas, agrónomos y productores rurales mejorando la productividad del campo."),
            ("C", "Con ingenieros electrónicos, mecánicos y programadores diseñando sistemas tecnológicos inteligentes."),
            ("D", "Con ingenieros industriales, operarios y logísticos optimizando los flujos de una empresa real."),
            ("E", "Con científicos de alimentos, microbiólogos y técnicos de calidad en una planta industrial."),
        }),
        // Pregunta 22
        ("¿Cuál de estas frases describe mejor tu filosofía de vida profesional?", new[]
        {
            ("F", "\"Lo que produce el campo colombiano tiene un valor inmenso que aún no sabemos transformar bien.\""),
            ("G", "\"Cada viga, cada puente y cada vía que construyo cambia la vida de miles de personas para siempre.\""),
            ("H", "\"No podemos crecer económicamente destruyendo los ecosistemas que nos dan el agua y el oxígeno.\""),
            ("I", "\"Un buen líder financiero no solo cuida los números: construye el futuro de la organización.\""),
            ("J", "\"La confianza de una empresa se construye con registros exactos, cuentas claras y cero mentiras.\""),
            ("K", "\"La ley existe para proteger a quien más la necesita, no solo a quien puede pagarla.\""),
        }),
    };

    public static async Task SembrarAsync(AppDbContext context)
    {
        // Si la base todavía no está lista, no se hace nada: el servicio arranca igual.
        if (!await context.Database.CanConnectAsync())
            return;

        await SembrarCatalogosAsync(context);
        await SembrarPerfilesAsync(context);
        await SembrarProgramasAsync(context);
        await SembrarPreguntasAsync(context);
        await SembrarAdminAsync(context);
    }

    private static async Task SembrarCatalogosAsync(AppDbContext context)
    {
        if (!await context.TiposDocumento.AnyAsync())
        {
            context.TiposDocumento.AddRange(
                TiposDocumento.Select(nombre => new TipoDocumento { Nombre = nombre }));
        }

        if (!await context.Grados.AnyAsync())
        {
            context.Grados.AddRange(
                Grados.Select(nombre => new Grado { Nombre = nombre }));
        }

        if (!await context.Ciudades.AnyAsync())
        {
            context.Ciudades.AddRange(
                Ciudades.Select(nombre => new Ciudad { Nombre = nombre }));
        }

        if (!await context.Roles.AnyAsync())
        {
            context.Roles.AddRange(
                Roles.Select(nombre => new Rol { Nombre = nombre, Descripcion = nombre }));
        }

        await context.SaveChangesAsync();
    }

    private static async Task SembrarPerfilesAsync(AppDbContext context)
    {
        if (await context.PerfilesVocacionales.AnyAsync())
            return;

        context.PerfilesVocacionales.AddRange(Perfiles.Select(p => new PerfilVocacional
        {
            Nombre = p.Nombre,
            Descripcion = p.Descripcion
        }));

        await context.SaveChangesAsync();
    }

    private static async Task SembrarProgramasAsync(AppDbContext context)
    {
        if (await context.ProgramasAcademicos.AnyAsync())
            return;

        // Se asocia cada programa con su perfil buscándolo por nombre (el área).
        var perfiles = await context.PerfilesVocacionales
            .Select(p => new { p.Id, p.Nombre })
            .ToListAsync();

        foreach (var programa in Programas)
        {
            var perfil = perfiles.FirstOrDefault(p => p.Nombre == programa.Area);

            context.ProgramasAcademicos.Add(new ProgramaAcademico
            {
                Nombre = programa.Nombre,
                Facultad = programa.Area,
                Descripcion = programa.Descripcion,
                // TODO: el frontend no publica el campo laboral ni una columna para la
                // URL del programa; queda vacío hasta que se defina de dónde sale.
                CampoLaboral = string.Empty,
                PerfilVocacionalId = perfil?.Id
            });
        }

        await context.SaveChangesAsync();
    }

    private static async Task SembrarPreguntasAsync(AppDbContext context)
    {
        if (await context.Preguntas.AnyAsync())
            return;

        foreach (var pregunta in Preguntas)
        {
            var fila = new Pregunta
            {
                Enunciado = pregunta.Enunciado,
                // El frontend no clasifica las preguntas: todas son del test vocacional.
                Categoria = "Vocacional",
                Estado = true
            };

            foreach (var opcion in pregunta.Opciones)
            {
                fila.Opciones.Add(new OpcionRespuesta
                {
                    Texto = opcion.Texto,
                    // TODO: falta una columna Letra en OpcionesRespuesta (requiere
                    // migración). Mientras tanto se guarda en Valor el índice de la
                    // letra dentro de LetrasOrden (A=0 ... K=10) para poder
                    // reconstruirla si el scoring pasa al backend.
                    Valor = Array.IndexOf(LetrasOrden, opcion.Letra)
                });
            }

            context.Preguntas.Add(fila);
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Usuario administrador inicial. Solo se crea si están definidas
    /// ADMIN_SEED_CORREO y ADMIN_SEED_PASSWORD y ese correo no existe todavía.
    /// Nunca hay credenciales hardcodeadas.
    /// </summary>
    private static async Task SembrarAdminAsync(AppDbContext context)
    {
        var correo = (Environment.GetEnvironmentVariable("ADMIN_SEED_CORREO") ?? string.Empty).Trim();
        var password = Environment.GetEnvironmentVariable("ADMIN_SEED_PASSWORD") ?? string.Empty;

        if (correo.Length == 0 || password.Length == 0)
            return;

        if (await context.Usuarios.AnyAsync(u => u.Correo == correo))
            return;

        var rolId = await context.Roles
            .Where(r => r.Nombre == "Administrador")
            .Select(r => (int?)r.Id)
            .FirstOrDefaultAsync();

        context.Usuarios.Add(new Usuario
        {
            Nombre = "Administrador",
            Apellido = string.Empty,
            Correo = correo,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Telefono = string.Empty,
            FechaRegistro = DateTime.UtcNow,
            Estado = true,
            Edad = 0,
            NumeroDocumento = string.Empty,
            InstitucionEducativa = string.Empty,
            RolId = rolId
        });

        await context.SaveChangesAsync();
    }
}
