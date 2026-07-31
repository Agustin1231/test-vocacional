# Pendientes de integración (estado al 2026-07-31)

Qué falta para que el panel de administración y el flujo del estudiante queden
completamente acoplados al backend. Cada punto lleva el archivo donde se toca, el
síntoma que se ve hoy y cómo se comprueba que quedó resuelto.

Lo que **ya está verificado funcionando** no se repite acá: el acople de datos
frontend a backend a base está comprobado sin FKs en `null`
(ver `api-contract.md`, sección "Estado verificado del acople") y el auto-deploy
por webhook quedó armado y probado (ver `DESPLIEGUE.md`, sección 8).

---

## 1. Editar preguntas desde el panel solo afecta al navegador del admin

**Prioridad: alta**, más por lo que aparenta que por lo que rompe.

**Síntoma.** *Panel → Preguntas* guarda en `localStorage`
(`admin.service.ts:56` y `:209`). Si Natalia edita una pregunta, cambia **solo en
su navegador**: los estudiantes siguen viendo el banco del código. La UI no
engaña, pero es fácil de malinterpretar.

**Por qué está así.** El cálculo del perfil vive en el frontend
(`adr/0003-calculo-riasec-en-el-frontend.md`) y depende de la **letra** de cada
opción. `GET /api/preguntas` devuelve `id`, `enunciado`, `categoria` y las
opciones con `id` y `texto`, **pero no la letra**, así que hoy la base no puede
ser la fuente del banco.

Hay que decidir entre dos caminos, y no son equivalentes:

**Opción A: la base pasa a ser la fuente del banco.** Es la correcta si se
quiere que el equipo edite preguntas sin recompilar.
- Backend: exponer la letra en `GET /api/preguntas` (la columna ya existe en
  `OpcionesRespuesta`, se siembra en `DbSeeder.cs`) y agregar el CRUD protegido
  (`POST`/`PUT`/`DELETE`) con `[Authorize(Roles = "Administrador")]`.
- Frontend: `bancoActivo()` (`core/data/banco.ts:18`) pasa a leer del backend, con
  el banco del código como respaldo si la API no responde, para que el test nunca
  quede en blanco.
- Ojo con el histórico: `Respuestas` apunta a `PreguntaId` y `OpcionRespuestaId`.
  Editar el texto de una opción viva reescribe el significado de los informes ya
  guardados. Conviene versionar o marcar como inactiva en lugar de borrar.

**Opción B: el código sigue siendo la fuente.** Es la de menos trabajo y menos
riesgo si el banco casi no va a cambiar. El panel se queda como editor y
exportador: genera el JSON, alguien lo pega en `questions.data.ts` y hace commit.
En ese caso hay que **decirlo en la propia pantalla** ("los cambios aplican al
publicar el repo"), no dejarlo solo en la documentación.

**Recomendación.** B ahora, A cuando el banco tenga que cambiar sin pasar por un
deploy. Lo que no conviene es dejarlo como está sin el aviso en pantalla.

---

## 2. Las conversaciones del chat no quedan ligadas al estudiante

**Prioridad: media.**

**Síntoma.** Todas las filas de `ChatbotConversaciones` tienen `UsuarioId` en
`null`, o sea que no se puede reconstruir qué preguntó cada estudiante.

**Por qué.** `POST /api/ia/chat` es anónimo a propósito (el estudiante nunca se
autentica), así que el backend no tiene a quién colgarle la conversación. Está
documentado en `api-contract.md`.

**Qué hay que hacer, si se quiere trazabilidad.** El flujo ya guarda el informe y
devuelve un `id` (`POST /api/resultados`). La vía más limpia es que el chat viaje
con ese identificador del test o del informe y que el backend resuelva el usuario
a partir de él. Requiere decidir antes si eso es aceptable en materia de datos
personales de menores de edad, porque liga preguntas libres con un estudiante
identificado. Si la respuesta es que no, dejarlo anónimo y cerrar el punto.

---

## 3. Bordes de la memoria del chat

**Prioridad: media.** Salieron de una revisión de las tres capas hecha el
2026-07-31. La memoria **funciona** (verificado en producción: con la misma sesión
el asesor recuerda, con una nueva no) y la caducidad por inactividad ya está
resuelta (ver sección 5). Lo que queda son bordes donde el hilo se desalinea de lo
que vio el estudiante.

- **Los dos turnos se guardan en transacciones separadas.**
  `ia/app/main.py` hace `guardar_turno(user)` y después `guardar_turno(assistant)`.
  Si el segundo falla —son best-effort— la memoria queda con una pregunta sin
  respuesta. `cargar_memoria` ya tolera el caso (descarta las respuestas huérfanas
  del inicio de la ventana), pero el hueco en el medio se mantiene.
- **Una respuesta vacía se guarda igual como turno del asistente.** El backend la
  traduce a un `503` y el estudiante ve "el asesor no está disponible", pero en la
  memoria quedó como si el asesor hubiera contestado algo. En el turno siguiente el
  modelo ve una respuesta vacía propia.
- **Un turno que no llega no deja rastro.** Si el backend rechaza por validación
  (`400`), corta por rate limit (`429`) o se le agota el timeout, el mensaje no
  entra en la memoria y el estudiante ve un error genérico. Es correcto que no se
  guarde, pero conviene saber que "el asesor se olvidó de lo que le dije" puede
  venir de acá y no de la memoria.
- **El transcript en pantalla y el hilo del modelo no son el mismo.** El componente
  del chat arranca vacío en cada montaje, mientras la IA sigue recordando: tras
  navegar y volver, la pantalla está en blanco pero el agente contesta como si
  vinieran conversando. Lo contrario también: si la sesión caducó por inactividad,
  el agente arranca de cero.
- **La memoria es direccionable por quien presente el `sesion_id`.**
  `POST /api/ia/chat` es anónimo a propósito y el id no está vinculado a ningún
  usuario, así que quien conozca (o adivine) un id ajeno puede continuar ese hilo.
  Con UUID v4 no es adivinable en la práctica; queda anotado porque acota lo que se
  puede guardar ahí.

---

## 4. Detalles menores del panel

**Prioridad: baja.** Ninguno rompe el flujo, pero son fáciles de arreglar.

- **`totalPreguntas` se calcula una sola vez.** En
  `frontend/src/app/core/services/test-state.service.ts:47` se fija al construir
  el servicio, mientras el quiz sí relee el banco. Si alguien edita preguntas y
  arranca un test en la misma pestaña sin recargar, el contador de progreso
  muestra un total distinto al real.

---

## 5. Decisiones que no son código

Pendiente:

- **El backend llama a la IA por su URL pública**, o sea que el tráfico sale al
  proxy y vuelve a entrar. Se puede acortar con `IA_BASE_URL=https://coolify-proxy`
  más el header `Host: ia-testvocacional.72.60.26.136.sslip.io`. Ese camino ya
  está comprobado; requiere que el `HttpClient` del backend mande el Host header.

Ya resuelto el 2026-07-30:

- **El MySQL dejó de estar expuesto.** El puerto público `5436` está cerrado
  (`is_public: false`). La app no se afectó porque el backend entra por la red
  interna. Para volver a conectar DBeaver hay que reactivarlo y apagarlo al
  terminar.
- **El prompt del agente ya no está en voseo.** Se reemplazó por la `PLANTILLA`
  que trae el propio panel (`pages/admin/agente.component.ts`), en español
  colombiano y con los límites explícitos. Se aplicó con `PUT /api/ia/instrucciones`
  directo al servicio de IA, porque en ese momento el proxy del backend no existía
  (ya existe: ver abajo).
- **La base quedó sin datos de prueba**: se borraron los 4 informes de prueba con
  sus tests, respuestas y conversaciones. Quedó solo el usuario administrador y
  los catálogos. El panel arranca en cero.

  **Ya no arranca en cero (verificado el 2026-07-31).** El 2026-07-31 a las 12:11
  entró un informe por el sitio publicado: un usuario nuevo (`Usuarios` id 6, sin
  rol ni contraseña) con su test, sus 22 respuestas y su resultado
  (`Ciencias Jurídicas` → `Derecho`, 18,18 %). Es un recorrido completo hecho por
  Agustín desde el sitio, no un `POST` de prueba, así que sirve como comprobación
  del flujo de punta a punta y no hay que apurarse a borrarlo. Igual conviene
  tenerlo presente: cualquier limpieza futura tiene que distinguir informes reales
  de pruebas, y las copias de la base a una máquina de trabajo
  (`DESPLIEGUE.md`, sección 9) arrastran esos datos.

- **El correo del administrador quedó en `admin@admin`** (antes era una dirección
  personal). Se cambió en los dos lados a propósito: la fila de `Usuarios` y la
  variable `ADMIN_SEED_CORREO` del backend. Si solo se cambiara la base,
  `SembrarAdminAsync` no encontraría el correo de la variable y el siguiente
  reinicio sembraría un **segundo** administrador.

Ya resuelto el 2026-07-31:

- **La conversación con el asesor ya no es un hilo perpetuo por navegador.** Era el
  hallazgo más serio de la revisión de las tres capas: el `sesionId` se creaba una
  vez y no se renovaba nunca, así que en una computadora compartida el siguiente
  estudiante entraba al asesor y el agente arrastraba el hilo del anterior. Ahora se
  renueva por tres caminos, todos en el navegador, porque el servidor no tiene
  noción de sesión vencida (agrupa por ese id y nada más):

  1. **30 minutos de inactividad** (`INACTIVIDAD_MAXIMA_MS` en
     `frontend/src/app/core/services/session-ttl.ts`). Es inactividad y no duración
     total: mientras el estudiante escriba, la conversación no se corta.
  2. **Al rehacer el test.** `TestStateService.reset()` rota la sesión. El TTL solo
     no alcanzaba para el caso que motivó todo esto: en la sala de cómputo el relevo
     es inmediato y cae dentro de la ventana de inactividad.
  3. **Dato corrupto o `visto` en el futuro**, para que editar `localStorage` a mano
     o un cambio de reloj del equipo no dejen una sesión inmortal.

  El probador del *Panel → Agente IA* pasó a usar un id propio prefijado `panel-`:
  antes sus pruebas caían en el mismo hilo de memoria que las conversaciones reales.

- **La ventana de memoria se cuenta en intercambios y es configurable.** Eran 20
  filas de tabla, o sea **10** intercambios, mientras el docstring prometía 20.
  Ahora `MEMORIA_INTERCAMBIOS` (default 10) lo dice en la unidad que un humano
  espera. Pasado ese punto el agente se olvida del principio de la conversación sin
  avisar: si un estudiante se presenta y sigue veinte turnos, en algún momento deja
  de saber su nombre.

- **La búsqueda del RAG siempre deja rastro en el log.** Antes solo se registraba
  cuando encontraba algo, así que el caso más frecuente de soporte —"el asesor dice
  que no sabe"— era indistinguible de "no buscó". Ahora cada búsqueda loguea
  candidatos, **mejor similitud obtenida** y cuántos pasaron el umbral; y si la base
  no tiene ningún documento indexado se emite un `WARNING` aparte, porque eso no es
  una pregunta sin respuesta sino que nadie subió los archivos.

- **El agente ya consulta los documentos de la institución (RAG).** El equipo sube
  el plan de estudios en PDF desde *Panel → Documentos* y el asesor lo cita con
  documento y página. Base **PostgreSQL + pgvector** aparte del MySQL de negocio,
  embeddings de Google a 768 dimensiones, y una herramienta que el modelo decide
  cuándo llamar (no recupera en cada mensaje). Diseño, mediciones y lo que quedó
  afuera: [`adr/0004-rag-en-pgvector.md`](adr/0004-rag-en-pgvector.md).

  Dos cosas que conviene tener presentes:

  - **La base pgvector no la administra Coolify**: se creó a mano por SSH, así que
    no tiene backup programado ni aparece en el panel (`DESPLIEGUE.md`, sección 10).
    Si se pierde el volumen hay que volver a subir los PDF.
  - El prompt del panel dice *"no inventes datos de costos, becas ni convenios: si
    no los tienes, invita a consultar la página"*. Se escribió antes del RAG y hacía
    que el modelo no llegara a buscar. Lo resuelve una política que agrega el código
    (`POLITICA_HERRAMIENTAS` en `agent/graph.py`), no hubo que tocar el prompt; pero
    si alguien lo reescribe, conviene no volver a redactar ese límite como si el
    agente no tuviera de dónde sacar el dato.

- **El panel ya puede editar las instrucciones del agente IA.** Era el pendiente
  que encabezaba este documento. El backend expone
  `GET`/`PUT /api/ia/instrucciones` como proxy hacia el servicio de IA, agregando
  la `X-API-Key` que el navegador no puede llevar (ADR 0002). Las dos rutas piden
  `[Authorize(Roles = "Administrador")]`, a diferencia de `POST chat`, que sigue
  siendo anónimo. La lógica está en `IaService` (`LeerInstruccionesAsync` /
  `GuardarInstruccionesAsync`) y no en el controller, así que el `HttpClient` y la
  clave no salen de esa capa. El frontend **no se tocó**: ya apuntaba ahí y se
  activó solo. Contrato en `api-contract.md`.

  Un detalle que importa: cuando el servicio de IA no tiene prompt cargado, el
  backend devuelve **`503` con un mensaje, nunca `404`**. El panel lee un `404`
  como "el backend todavía no expone el proxy" y mostraría lo contrario de lo que
  pasó.

  Comprobado end to end: `GET` con sesión de administrador `200` con
  `{clave, contenido, actualizado_en}`; `PUT` `200`, persistido y **aplicado en la
  respuesta siguiente del chat**; sin token `401`; con token válido sin rol de
  administrador (o con otro rol) `403`; `contenido` vacío `400`; y `POST
  /api/ia/chat` sigue respondiendo `200` sin token.

- **El listado de informes ya devuelve colegio, ciudad, grado y celular.** El
  panel tenía las columnas y mostraba un guion largo en las tres primeras: los
  datos estaban guardados en `Usuarios` con sus FKs resueltas, pero
  `ResultadoListItemDto` no los incluía, así que la proyección de
  `ObtenerResultadosAsync` nunca los pedía. Ahora `ciudad` y `grado` viajan con el
  **nombre** resuelto por la navegación al catálogo. Ver `api-contract.md`.

Y un dato que ahorra tiempo: **el usuario administrador ya existe y no hay que
crearlo** (`Usuarios` id 1, correo `admin@admin`, rol `Administrador`). Si se
pierde la clave, no se recupera del hash pero sí de las variables
`ADMIN_SEED_CORREO` / `ADMIN_SEED_PASSWORD` de la app del backend en Coolify, que
es de donde `DbSeeder.SembrarAdminAsync` lo siembra.
