# Pendientes de integración (estado al 2026-07-30)

Qué falta para que el panel de administración y el flujo del estudiante queden
completamente acoplados al backend. Cada punto lleva el archivo donde se toca, el
síntoma que se ve hoy y cómo se comprueba que quedó resuelto.

Lo que **ya está verificado funcionando** no se repite acá: el acople de datos
frontend a backend a base está comprobado sin FKs en `null`
(ver `api-contract.md`, sección "Estado verificado del acople") y el auto-deploy
por webhook quedó armado y probado (ver `DESPLIEGUE.md`, sección 8).

---

## 1. El panel no puede editar las instrucciones del agente IA

**Prioridad: alta.** Es la única pestaña del panel que no funciona.

**Síntoma.** En *Panel → Agente IA* aparece el aviso de que el backend no expone
el endpoint. `GET https://test-vocacional.agustinynatalia.site/api/ia/instrucciones`
devuelve `404`.

**Por qué.** El servicio de IA sí tiene los endpoints y responden bien
(`ia/app/main.py:126` y `ia/app/main.py:148`, ambos con `Depends(verificar_api_key)`).
El navegador no puede llamarlos directo porque tendría que llevar la clave
compartida (decisión en `adr/0002-backend-como-proxy-de-la-ia.md`). Falta el
proxy en el backend: `IaController` solo tiene `POST chat`.

**Qué hay que hacer.** En `backend/src/VocacionalTest.Api/Controllers/IaController.cs`,
agregar dos acciones que reenvíen al servicio de IA agregando `X-API-Key`, igual
que ya hace `IaService` para el chat:

- `GET /api/ia/instrucciones`
- `PUT /api/ia/instrucciones` con cuerpo `{ "contenido": "..." }`

Las dos **con `[Authorize(Roles = "Administrador")]`**, a diferencia de `chat`
que es anónimo a propósito. La lógica de llamada va en `IIaService` /`IaService`
para no meter `HttpClient` en el controlador.

Contrato que ya expone el servicio de IA y que conviene devolver tal cual, porque
es exactamente lo que el frontend espera en `AdminService.InstruccionesAgente`
(`frontend/src/app/core/services/admin.service.ts:40`):

```json
{ "clave": "system_prompt", "contenido": "...", "actualizado_en": "2026-07-29T20:05:47" }
```

**El frontend no se toca.** `AdminService.leerInstrucciones()` y
`guardarInstrucciones()` ya apuntan a `${environment.apiUrl}/ia/instrucciones`;
hoy caen en el `catchError` que traduce el `404` a "no disponible".

**Cómo se comprueba.** Con sesión de administrador, la pestaña *Agente IA* carga
el prompt actual, lo deja editar y al guardar el cambio se refleja en la
siguiente respuesta del chat. Sin token, o con token de estudiante, la petición
debe dar `401`/`403`.

---

## 2. Editar preguntas desde el panel solo afecta al navegador del admin

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

## 3. Las conversaciones del chat no quedan ligadas al estudiante

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

## 4. Detalles menores del panel

**Prioridad: baja.** Ninguno rompe el flujo, pero son fáciles de arreglar.

- **El JWT no valida expiración en el cliente.** Queda en `localStorage`; la
  sesión se ve activa hasta que una petición falla con `401`. Conviene leer el
  `exp` del token al arrancar y limpiar la sesión si ya venció.
- **`totalPreguntas` se calcula una sola vez.** En
  `frontend/src/app/core/services/test-state.service.ts:47` se fija al construir
  el servicio, mientras el quiz sí relee el banco. Si alguien edita preguntas y
  arranca un test en la misma pestaña sin recargar, el contador de progreso
  muestra un total distinto al real.

---

## 5. Decisiones que no son código y que quedan a la espera

- **MySQL sigue expuesto en `72.60.26.136:5436`.** Se abrió para conectar DBeaver.
  La única barrera es la contraseña. Apagarlo cuando no se esté usando.
- **El backend llama a la IA por su URL pública**, o sea que el tráfico sale al
  proxy y vuelve a entrar. Se puede acortar con `IA_BASE_URL=https://coolify-proxy`
  más el header `Host: ia-testvocacional.72.60.26.136.sslip.io`. Ese camino ya
  está comprobado; requiere que el `HttpClient` del backend mande el Host header.
- **El prompt del agente está escrito en voseo** ("Sos un asesor vocacional",
  "Acompañás", "Respondés"). Para estudiantes colombianos de UNIAGRARIA suena
  ajeno. Se corrige desde el panel en cuanto exista el punto 1, sin tocar código.
