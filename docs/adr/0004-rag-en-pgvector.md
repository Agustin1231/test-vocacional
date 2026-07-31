# ADR 0004 — RAG sobre pgvector, como herramienta que el modelo decide llamar

- **Estado:** aceptado
- **Fecha:** 2026-07-31

## Contexto

El asesor IA respondía solo con lo que el modelo sabía de memoria más el prompt
del panel. Para cualquier dato concreto de la institución (materias de un
programa, créditos, costos, requisitos) eso es un problema: el modelo no los
tiene, y cuando los tiene son de otra universidad o de otro año. El prompt lo
tapaba con un límite —"no inventes datos de costos, becas ni convenios"— que
convertía cada pregunta puntual en un "consultá la página web".

Hacía falta que el equipo pudiera cargar el plan de estudios en PDF y que el
agente respondiera con eso, citando de dónde salió.

## Decisión

### 1. Una base pgvector separada, no el MySQL de negocio

Los documentos y sus vectores viven en una base **PostgreSQL con pgvector**
aparte, no en el MySQL del backend.

El MySQL de negocio tiene un dueño: el backend, con EF Core y sus migraciones.
Meterle tablas de otro servicio rompe esa propiedad, y encima MySQL no tiene un
tipo vectorial con índices de similitud comparable a pgvector. El servicio de IA
ya escribía dos tablas propias en MySQL (memoria e instrucciones) y esa deuda no
se agranda: lo nuevo va a su propia base.

### 2. Los PDF se guardan en la base, no en un volumen

`rag_documentos.contenido` es un `bytea` con el PDF completo, además del texto
troceado y los vectores en `rag_fragmentos`.

Guardar el original permite **re-indexar** todo si cambia el modelo de embeddings,
sin depender de que alguien conserve los archivos. Un plan de estudios son unos
pocos MB: no justifica montar un volumen en la app de IA (que en Coolify es
configuración aparte) ni un bucket. El contenedor del servicio de IA sigue siendo
descartable.

### 3. Herramienta que el modelo decide llamar, no recuperación siempre

El grafo pasó de un nodo a un ciclo acotado:

```
START ──► agente ──┬──(no pidió nada)──────────────► END
                   ├──(pidió herramientas)──► herramientas ──┘
                   └──(agotó las vueltas)──► respuesta_final ──► END
```

La alternativa era recuperar siempre antes de responder. Se eligió la herramienta
porque este agente **también conversa**: contiene a un estudiante indeciso,
explica un resultado del test, responde un "hola". Inyectar fragmentos del plan de
estudios en esas respuestas no aporta y sesga. Verificado: el modelo llama la
herramienta en las preguntas de dato y no la llama en un saludo ni en un "me da
miedo no ser bueno para la universidad".

### 4. Embeddings de Google a 768 dimensiones

`models/gemini-embedding-001` con la misma `GOOGLE_API_KEY` del chat. Un
proveedor, una clave, imagen liviana.

**768 y no las 3072 que da el modelo por defecto**, porque los índices de pgvector
(`hnsw`, `ivfflat`) no soportan más de 2000 dimensiones: con 3072 la búsqueda
quedaría siempre secuencial. El modelo acepta `output_dimensionality`, así que se
piden 768 directamente.

`text-embedding-004` **ya no existe** (la API devuelve 404): quedó descartado al
probarlo.

### 5. El navegador sigue sin ver el servicio de IA

Igual que el chat y las instrucciones (ADR 0002): el panel pega contra
`/api/ia/documentos` del **backend**, que reenvía al servicio de IA agregando
`X-API-Key`. Las tres rutas piden rol `Administrador`.

Una diferencia con el chat: acá los errores del cliente **sí llevan su motivo** al
panel ("ya hay un documento con ese nombre", "el PDF es un escaneo sin texto"). No
son detalles de infraestructura, son cosas que quien administra necesita leer para
corregir el archivo que eligió. El `503` sigue siendo genérico.

### 6. La política de uso de la herramienta vive en el código

`agent/graph.py` agrega al system prompt un bloque `POLITICA_HERRAMIENTAS` cuando
hay herramientas disponibles, en lugar de dejarlo en el prompt editable del panel.

Esto salió de probar, no de la teoría: sin ese bloque, el prompt del panel —que
dice "no inventes datos de costos ni becas: si no los tienes, invitá a consultar
la página"— hacía que el modelo **no llegara a buscar** en preguntas de
homologaciones. Medido con el mismo modelo y las mismas preguntas:

| Escenario | Llama la herramienta |
|---|---|
| Sin system prompt | 5 de 5 preguntas de dato |
| Solo el prompt del panel | 4 de 5 (falla "¿puedo homologar materias?") |
| Prompt del panel + política | 5 de 5 |

Dejarlo en el código evita que el agente pierda una capacidad por cómo quedó
redactado un prompt, y no contradice sus límites: "no inventes" sigue valiendo, la
política define cuándo se considera que el dato *se tiene*.

## Consecuencias

- **El agente cita.** Cada respuesta con un dato del plan menciona documento y
  página, porque el número de página viaja con cada fragmento.
- **Si el dato no está, lo dice.** La búsqueda descarta lo que no llegue a
  `RAG_MIN_SIMILITUD` y devuelve vacío en lugar del fragmento menos malo, y la
  herramienta le dice explícitamente al modelo que no complete.
- **Degradación limpia.** Con `VECTOR_STORE_URL` vacía o la base caída, no se le
  ofrece la herramienta al modelo y el asesor funciona como antes. Una base de
  documentos caída no puede dejar sin chat al estudiante.
- **Actualizar un documento es borrarlo y subirlo.** El nombre y el hash del
  contenido son únicos, así que no pueden convivir dos versiones del mismo plan
  compitiendo por la respuesta.
- **Cambiar el modelo de embeddings invalida lo indexado.** Los vectores de dos
  modelos no son comparables. `rag/store.py` aborta ruidosamente si las
  dimensiones de la tabla no coinciden con la configuración, en vez de mezclarlos.
- **Costo por subida, no por pregunta.** Indexar cuesta una llamada de embeddings
  por lote de fragmentos; cada búsqueda cuesta una sola (la de la consulta).

## Lo que quedó afuera

- **Re-indexar desde la UI.** El PDF está guardado, así que es posible sin volver
  a subirlo, pero no hay endpoint todavía.
- **Descargar el PDF indexado.** Tampoco hay endpoint: para actualizar hay que
  tener el archivo a mano.
- **La base no la administra Coolify.** Ver `DESPLIEGUE.md`, sección 10: se creó
  a mano por SSH, con lo que eso implica.
