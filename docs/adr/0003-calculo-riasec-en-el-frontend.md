# ADR 0003 — El cálculo del perfil sigue en el frontend; el backend solo persiste

- **Estado:** aceptado (temporal)
- **Fecha:** 2026-07-29

## Contexto

El documento de arquitectura del equipo (externo, **no versionado** en este repo)
pide que el cálculo del perfil vocacional sea **determinístico y auditable en el
backend**: el backend es el punto único de acceso a los datos y el responsable de
aplicar el test y calcular el resultado.

En la integración se hizo lo contrario, y conviene dejarlo escrito antes de que
alguien lea el contrato y asuma que el backend calcula.

Estado real del código:

- **Frontend:** el cálculo completo ya existe y funciona. `ScoringService` +
  `core/data/` implementan **22 preguntas** de 6 opciones, **11 perfiles A–K** y
  **55 preguntas de desempate** (una por cada pareja de letras posible), más el
  *fallback* alfabético para empates múltiples.
- **Backend:** `POST /api/resultados` recibe `resultado.letra`, `perfil`,
  `carrera`, `area` y `contadores` ya calculados. Lo único que deriva es
  `Puntaje` (respuestas de la letra ganadora) y `Porcentaje`
  (`puntaje / total * 100`). **No recalcula nada** ni valida que la letra
  ganadora se corresponda con los contadores.
- **`GET /api/preguntas`** devuelve `{ id, enunciado, categoria, opciones: [{ id, texto }] }`:
  **no publica la letra ni el peso** de cada opción, así que con ese endpoint es
  imposible calcular el perfil. Por eso el frontend sigue usando su banco local
  y no consume el endpoint.

Nota terminológica: lo implementado son 11 áreas identificadas por letra (A–K),
no los 6 códigos RIASEC de Holland. Donde se lea "RIASEC" en la documentación del
equipo, se refiere a este perfil de 11 áreas.

## Decisión

**Mantener el cálculo en el frontend por ahora.** El backend actúa como
repositorio de informes: persiste el registro, las respuestas y el resultado
recibido, y expone el listado protegido para el panel.

Es un **desvío consciente y temporal** del documento de arquitectura, no un
descuido ni una interpretación alternativa.

Por qué:

- La lógica ya está escrita, probada a mano y en producción del lado del
  frontend; portarla no aporta ninguna funcionalidad nueva al estudiante.
- Migrarla ahora **requiere una migración de EF Core** (ver abajo) y en este
  momento no hay SDK de .NET disponible para generarla ni aplicarla.
- El desempate es interactivo: cuando hay empate a dos, el frontend le hace al
  estudiante una pregunta más. Mover eso al backend implica rediseñar el flujo
  (una llamada extra a mitad del quiz o mandar el desempate resuelto), o sea
  cambio de contrato, no solo un port de código.

## Consecuencias

- **El resultado es determinístico pero no auditable del lado del servidor:** un
  cliente modificado puede mandar cualquier `letra`/`carrera` a
  `POST /api/resultados` y el backend la guarda. El endpoint es público, así que
  la única defensa hoy es el rate limit por IP.
- **El banco de preguntas está duplicado** (frontend + seeder del backend) y hay
  que mantenerlo en sincronía a mano: los textos tienen que coincidir, porque
  `POST /api/resultados` resuelve la `OpcionRespuesta` comparando **el texto** de
  la opción.
- **La letra elegida en cada respuesta no se persiste:** `Respuesta` no tiene
  columna para ella. En la base solo queda la `OpcionRespuestaId` (cuando el texto
  coincide), y `OpcionesRespuesta.Valor` guarda el índice de la letra (A=0 … K=10)
  como puente hasta que exista una columna propia.
- El frontend guarda además una copia local del informe en `localStorage`, así
  que el panel de demostración funciona sin backend.

## Qué haría falta para migrarlo al backend

1. **Migración de EF Core** para que la letra/peso de cada opción sea un dato de
   primera clase: agregar `OpcionRespuesta.Letra` (hoy se usa `Valor` como índice
   dentro del orden A–K, que es un apaño) y una columna `Letra` en `Respuesta`
   para guardar lo que el estudiante eligió. **Bloqueante hoy:** no hay SDK de
   .NET en el entorno para generar ni aplicar la migración.
2. **Exponer esa letra en `GET /api/preguntas`** (`opciones: [{ id, texto, letra }]`),
   más los 11 perfiles y los 55 desempates por API — o aceptar que el desempate
   se siga resolviendo en el cliente.
3. **Portar el scoring a C#:** conteo por letra, ganador, desempate por pareja,
   *fallback* alfabético y letra secundaria. Es el port 1:1 de
   `frontend/src/app/core/services/scoring.service.ts`.
4. **Cambiar el contrato de `POST /api/resultados`:** que reciba solo
   `{ registro, respuestas }` y devuelva el resultado calculado por el backend,
   en vez de recibirlo ya masticado.
5. **Dejar el frontend sin lógica de negocio:** consumir `GET /api/preguntas` y
   mostrar lo que devuelva el backend.

Hasta que eso pase, esta ADR es la explicación oficial de por qué el contrato dice
que el cálculo vive en el frontend.
