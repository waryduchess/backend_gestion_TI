# Roadmap - Backend Sistema de Gestion TI

Estado de lo que **falta por desarrollar**. Este archivo es la memoria viva del proyecto:
conviene revisarlo antes de cada iteracion y actualizarlo al cerrar cada modulo.

---

## 1. Estado actual

| Modulo                               | Endpoints                                                                                                               | Documentado en Swagger | Bruno              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------ |
| Auth (`/api/auth`)                 | `POST /login`, `GET /me`                                                                                            | Si                     | 3 requests         |
| Incidencias (`/api/incidencias`)   | `GET /`, `GET /:id`, `POST /`                                                                                     | Si                     | 12 requests        |
| Activos (`/api/activos`)           | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/estado`, `POST /:id/asignaciones`, `DELETE /:id` | Si                     | 41 requests        |
| Importaciones (`/api/activos/importaciones`) | `POST /validar`, `POST /confirmar`                                                                          | Si                     | 7 requests         |
| Asignaciones (`/api/asignaciones`) | `GET /`, `POST /:id/devolucion`                                                                                     | Si                     | 8 requests         |
| Usuarios (`/api/usuarios`)         | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/password`, `DELETE /:id`                           | Si                     | Pruebas protegidas |
| Documentacion                        | `GET /api/docs`, `GET /api/docs/openapi.yaml`                                                                       | -                      | -                  |
| Catalogos (`/api/catalogos`)       | `GET /` + CRUD `/api/departamentos`, `/api/ubicaciones`, `/api/puestos`, `/api/tipos-usuario`                 | Si                     | CRUD Bruno         |
| RBAC / roles                         | CRUD`/api/roles`, asignar rol a usuario                                                                               | Si                     | 18 requests        |
| Licencias (`/api/licencias`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`                                                    | Si                     | 12 requests        |
| Proyectos                           | Sin modelo ni endpoints                                                                                              | No                     | No                 |
| Secretos (`/api/secretos`)         | `GET /`, `POST /`, `GET /:id`, `GET /:id/password`, `GET /:id/auditoria`, `PATCH /:id`, `DELETE /:id`                  | Si                     | 13 requests        |
| Notificaciones (`/api/notificaciones`) | `GET /`, `PATCH /:id/leer`, `PATCH /leer-todas`; incidencias y recordatorios de licencias                         | Si                     | 10 requests        |
| Dashboard (`/api/dashboard`)       | `GET /summary`                                                                                                          | Si                     | 5 requests         |
| Recordatorios                      | sin modelo ni endpoints                                                                                                 | No                     | No                 |
| Sucursal (normalizacion)           | sin catalogo; `Activo.sucursal` es texto libre                                                                          | No                     | No                 |

Regresion mas reciente tras la Importacion masiva de activos: `npx tsc --noEmit` limpio, OpenAPI valido y suite Bruno **196 requests (194 OK, 2 fallos preexistentes), 423/427 assertions**. Los 2 fallos estan en `Activos/buscarPorSerie` y su cascada `Activos/cambiarEstadoAsignacionActiva`: dependen de que exista un activo `AF00010` con `numeroSerie CXBF1Z3`, dato que ya no esta en la BD actual (drift de datos, ajeno a la importacion). Los 8 requests nuevos (`Importaciones/` 7 + `Roles/denegarImportarActivos`) pasan en verde.

Regresion previa: `npx tsc --noEmit`, OpenAPI valido y suite Bruno (188/188 requests, 390/390 assertions). Para
la fase 2 de incidencias: build, OpenAPI, Bruno de Incidencias (12/12 requests,
23/23 assertions), Roles (19/19 requests, 27/27 assertions) y prueba de evento
Socket.IO completados. El envio SMTP real requiere credenciales validas y una
prueba controlada.

---

## 2. Endpoints pendientes por modulo

### 2.1 Incidencias (tickets) - implementacion parcial

- [X] **Fase 1 - Lectura:** conservar `GET /api/incidencias` y agregar `GET /api/incidencias/:id` con descripcion, evidencia, solicitante, asignado, departamento e historial ordenado cronologicamente.
- [X] **Fase 2 - Alta:** `POST /api/incidencias`; validar titulo, descripcion, tipo de requerimiento y departamento activo opcional; tomar `solicitanteId` del usuario autenticado; aplicar estado `NUEVO`, prioridad `NORMAL` y fecha del servidor por defecto; emitir `incidencias:nueva` solo despues de persistir.
- [ ] **Fase 3 - Gestion:** `PATCH /api/incidencias/:id` para cambios permitidos de estado, prioridad y asignado; validar transiciones/referencias; fijar o limpiar `fechaResolucion` al entrar/salir de `COMPLETADO`; emitir `incidencias:estado-cambiado` solo cuando cambie el estado y despues de persistir.
- [ ] **Fase 4 - Seguimiento:** `POST /api/incidencias/:id/actualizaciones` para agregar comentario; validar el texto y existencia de incidencia, guardar y devolver la actualizacion.
- [ ] **Fase 5 - Evidencia:** `POST /api/incidencias/:id/evidencia` e integracion S3, despues de establecer limites de tamano/tipo y configuracion de almacenamiento.
- [ ] **Baja logica pendiente de diseño:** el modelo `Incidencia` no tiene campo de baja. No implementar `DELETE` hasta definir y migrar un indicador/fecha de baja y acordar como excluir incidencias dadas de baja de consultas e historiales.
- [X] RBAC de creacion: nuevo permiso `incidencias:crear`, incluido en el seed del administrador; acceso comprobado con Bruno.
- [ ] **Autorizacion pendiente:** definir/agregar permiso RBAC para gestionar incidencias y cubrir permitir/denegar en Bruno.
- [ ] **Validacion de cada fase:** actualizar OpenAPI y Bruno junto con las rutas; probar campos invalidos, relaciones inexistentes/inactivas, 404, permisos, no exponer datos sensibles y emisiones Socket.IO posteriores a escrituras exitosas.

### 2.2 Inventario de activos - hoy solo lectura

- [X] `POST /api/activos` - registrar activo (solo tipo obligatorio, estado default EN_USO; requiere `activos:crear`; 409 en clave duplicada, 400 si responsableId no existe)
- [X] `PATCH /api/activos/:id` - editar datos del activo (edicion parcial, null borra; requiere `activos:editar`)
- [X] `PATCH /api/activos/:id/estado` - transiciones EN_USO / EN_ALMACEN / EN_MANTENIMIENTO / DE_BAJA; requiere `activos:estado`
- [X] `POST /api/activos/:id/asignaciones` - asignar equipo a usuario; requiere `activos:asignar`
- [X] `POST /api/asignaciones/:id/devolucion` - cerrar asignacion; requiere `activos:asignar`
- [X] `DELETE /api/activos/:id` - baja **logica** (estado `DE_BAJA`); requiere `activos:eliminar`
- [X] `GET /api/asignaciones` - listado paginado y filtrable (sin `bitlocker`); requiere `activos:leer`
- [X] **Importacion masiva de activos (solo CSV):** el frontend lee y parsea localmente la plantilla `plantilla_registro_activos.csv` y envia las filas como JSON; el archivo no se sube ni se almacena en el backend. El parser del frontend debe soportar BOM UTF-8, delimitador `;`, encabezados acentuados, campos entre comillas y conservar la fila de origen para reportar resultados.
- [X] **Flujo de validacion y confirmacion:** `POST /api/activos/importaciones/validar` valida y devuelve una vista previa sin escribir en la base; `POST /api/activos/importaciones/confirmar` vuelve a validar antes de crear. Ambas rutas requieren JWT y `activos:crear`, aceptan hasta 500 filas y permiten importacion parcial: crear filas validas, reportar errores y advertencias por fila y devolver resumen de creados/rechazados. No actualizar activos existentes.
- [X] **Mapeo de la plantilla:** `CB23` -> `cb23`; `Tipo` -> `tipo`; `Marca` -> `marca`; `Modelo` -> `modelo`; `Número de serie` -> `numeroSerie`; `Sucursal` -> `sucursal`; `Estado` -> `estado`; `Estado general` -> `estadoGeneral`; `Red` -> `nombreRed`. Resolver `Correo responsable` por coincidencia exacta con un usuario activo; el nombre no es llave. Si el correo falta o no identifica un unico usuario activo, importar sin responsable y devolver advertencia.
- [X] **Validaciones, duplicados y pruebas:** reutilizar las reglas de alta individual; aceptar `EN_USO`, `EN_ALMACEN`, `EN_MANTENIMIENTO` y `DE_BAJA` en `Estado`, usando `EN_USO` si está vacío. Rechazar duplicados de CB23 o número de serie dentro del lote y respecto a activos existentes. CB23 y número de serie siguen **sin restricciones de unicidad** en la BD: se decidio **no** agregar constraints ni migracion; la carrera concurrente queda documentada como limitacion conocida. Cubierto en Bruno: preview sin escrituras, revalidacion al confirmar, filas validas/invalidas, duplicados en lote y en BD, responsables, limite de 500 y permisos.

  - **Decisiones de la iteracion:** las filas llegan con los encabezados originales de la plantilla (el backend mapea) e ignoran columnas fuera del mapeo; `fila` es opcional y si falta usa el indice (1-based); la vista previa incluye los datos normalizados por fila; ante CB23/N.Serie repetidos en el lote gana la primera aparicion. `confirmar` responde 200 con importacion parcial. Se subio `express.json` a `1mb` para tolerar lotes de 500 filas.

### 2.3 Usuarios y catalogos

- [X] `GET /api/usuarios` - listado paginado y filtrable (`q`, `activo`, `departamentoId`, `ubicacionId`, `puestoId`, `tipoUsuarioId`; nunca `passwordHash`; requiere `usuarios:administrar`)
- [X] `GET /api/usuarios/:id` - detalle con catalogos + rol; requiere `usuarios:administrar`
- [X] `POST /api/usuarios` - alta (`id`+`nombre` obligatorios, 409 si id existe, `password` opcional con bcrypt -> sin password = sin acceso, 400 si catalogo no existe, 201; requiere `usuarios:administrar`)
- [X] `PATCH /api/usuarios/:id` - editar datos (parcial, null borra, `id` y `password` fuera de aqui -> 400 con hint; requiere `usuarios:administrar`)
- [X] `PATCH /api/usuarios/:id/password` - alta/rotacion de password (bcrypt; requiere `usuarios:administrar`)
- [X] `DELETE /api/usuarios/:id` - baja **logica** (`activo=false`, 200 idempotente, nunca borra filas; requiere `usuarios:administrar`)
- [X] `GET /api/catalogos` - devuelve departamentos, ubicaciones, puestos, tipos de usuario y roles ordenados por nombre
- [X] `/api/catalogos` requiere JWT; login se mantiene publico
- [X] CRUD `/api/departamentos`, `/api/ubicaciones`, `/api/puestos`, `/api/tipos-usuario` (JWT + `catalogos:administrar`; baja logica y reactivacion al crear un nombre inactivo; campo `activo` añadido por migracion aditiva)

### 2.4 RBAC - roles y permisos

- [X] CRUD `/api/roles` (nombre + permisos; permisos validados contra allowlist; baja logica; no permite desactivar roles asignados)
- [X] Middleware de permisos en `src/middlewares/auth.middleware.ts`; recarga usuario/rol desde BD para aplicar revocaciones de inmediato
- [X] Aplicar `verificarToken` + permisos a incidencias, activos y asignaciones
- [X] `PATCH /api/usuarios/:id/rol` para asignar o quitar un rol; solo roles con `roles:administrar`
- [X] Seed crea/reactiva el rol Administrador, le asigna todos los permisos y lo asigna al usuario `ADMIN`
- [X] `verificarToken` se aplica a todo `/api/usuarios`; cada endpoint valida ademas `usuarios:administrar`, excepto asignacion de rol, que requiere `roles:administrar`

Permisos iniciales: `incidencias:leer`, `notificaciones:leer`,
`activos:leer`, `activos:crear`,
`activos:editar`, `activos:estado`, `activos:asignar`, `activos:eliminar` y
`usuarios:administrar`, `roles:administrar`, `catalogos:administrar`,
`licencias:administrar`, `secretos:leer`, `secretos:revelar` y
`secretos:administrar`. Se protege
contra dejar el sistema sin ningun rol capaz de administrar roles. El catalogo
solo expone entradas activas y el listado de roles expone nombre e id de roles
activos.

Todas las operaciones de usuarios (incluyendo listado, detalle y password)
requieren `usuarios:administrar`. La asignacion de rol sigue requiriendo
`roles:administrar`. La lectura de `/api/catalogos` requiere JWT, sin permiso
adicional.

### 2.5 Licencias

- [X] `GET /api/licencias` y `GET /api/licencias/:id` - listado paginado con filtros por activa, proveedor, fecha de vencimiento y busqueda; la clave no se expone
- [X] `POST /api/licencias` - alta con clave cifrada AES-256-GCM
- [X] `PATCH /api/licencias/:id` - edicion/reasignacion y reactivacion de baja logica
- [X] `DELETE /api/licencias/:id` - baja logica idempotente
- [X] Alertas diarias desde 30 dias antes del vencimiento via `node-cron` + Nodemailer; usuario asignado o email de respaldo
- [X] Autorizacion JWT + permiso `licencias:administrar`

### 2.6 Secretos - modelo `Secreto`

- [X] CRUD `/api/secretos`: listado y detalle solo exponen metadatos; alta y cambios cifran `password` con AES-256-GCM; baja logica con reactivacion explicita.
- [X] Separacion RBAC: `secretos:leer` para metadatos, `secretos:revelar` para recuperar un password activo en una ruta dedicada y `secretos:administrar` para altas, cambios, bajas y consulta de auditoria.
- [X] Auditoria atomica de creacion, cambios, baja y revelacion; almacena usuario, accion y nombres de campos, nunca valores de passwords. Consulta paginada disponible en `GET /api/secretos/:id/auditoria`.
- [X] Revelacion explicita responde `Cache-Control: no-store`; requiere registrar el acceso y no se permite para secretos inactivos.
- [X] Preflight de la base local: no habia filas previas de secretos ni claves de licencias; revisar cualquier entorno con datos antes de rotar `AES_SECRET_KEY`.
- [ ] **Importacion masiva futura de secretos desde CSV/Excel:** permitir subir temporalmente un archivo con credenciales para extraer y validar sus filas y construir los datos equivalentes a las altas individuales de secretos; no conservar el archivo ni sus contenidos despues del procesamiento.
- [ ] Antes de habilitarla, definir permisos RBAC especificos, acceso de lectura/descifrado, auditoria de consulta y cambios, formato de plantilla, duplicados, errores por fila y atomicidad del lote. Reutilizar el cifrado AES-256-GCM de `src/utils/crypto.ts`; nunca incluir contrasenas en logs, mensajes de error, vista previa persistente o respuestas normales. Evitar devolver valores descifrados salvo en una operacion expresamente autorizada.
- [ ] **Flujo recomendado:** carga temporal -> validacion de formato y filas -> vista previa con errores que no revele contrasenas -> confirmacion explicita -> persistencia cifrada reutilizando las validaciones/servicios de alta -> eliminacion del temporal; limitar tamano y cantidad de filas, y garantizar limpieza tambien ante errores.

---

### 2.7 Notificaciones persistentes

- [X] Persistir notificaciones de nuevas incidencias por usuario activo con `incidencias:leer`, con lectura individual y masiva.
- [X] `GET /api/notificaciones` paginado, filtro `leida` y conteo propio `meta.noLeidas`; `PATCH /api/notificaciones/:id/leer` y `PATCH /api/notificaciones/leer-todas`.
- [X] Permiso `notificaciones:leer` independiente; migracion lo agrega a roles existentes con `incidencias:leer` para conservar su acceso.
- [X] Emision Socket.IO por sala privada de usuario despues de persistir; el evento incluye `notificacionId`.
- [X] Recuperacion REST de notificaciones no leidas al reconectar; Socket.IO no reproduce eventos perdidos.
- [X] Recordatorios persistentes de licencias en los hitos de 30, 7 y 1 dia, deduplicados por destinatario/licencia/hito; al asignado activo con `notificaciones:leer`, o usuarios activos con `licencias:administrar` y `notificaciones:leer` si no hay asignado elegible.
- [X] El evento `licencias:por-vencer` se emite despues de persistir y solo a la sala privada de cada destinatario; el payload incluye `notificacionId`, licencia, vencimiento e hito. La lista REST contiene la informacion para recuperar eventos perdidos.
- [ ] Politica de retencion/limpieza; por ahora los registros se conservan sin expiracion.

### 2.8 Proyectos - pendiente de modelado e implementacion

El backend no tiene actualmente un modelo Prisma ni endpoints dedicados a
proyectos. `Secreto.proyecto` es texto libre, no una relacion con un catalogo
de proyectos.

- [ ] Definir el alcance y los campos del proyecto (por ejemplo: nombre unico,
  descripcion, responsable, fechas y estado) antes de crear el modelo.
- [ ] Definir relaciones con secretos y otros modulos que deban clasificar por
  proyecto. Si `Secreto.proyecto` pasa a ser una relacion, decidir como
  normalizar/migrar sus valores de texto existentes y conservar los registros.
- [ ] Definir permisos RBAC para lectura y administracion; no reutilizar
  `secretos:administrar` como permiso de proyectos.
- [ ] Implementar listado y detalle (`GET /api/proyectos`, `GET
  /api/proyectos/:id`), alta (`POST /api/proyectos`), edicion (`PATCH
  /api/proyectos/:id`) y baja logica (`DELETE /api/proyectos/:id`) cuando el
  modelo y las reglas de ciclo de vida esten aprobados.
- [ ] Definir filtros/paginacion, unicidad y comportamiento de proyectos
  inactivos o referenciados antes de publicar los endpoints.
- [ ] Documentar rutas y esquemas en OpenAPI; cubrir validaciones, relaciones,
  permisos, baja logica y compatibilidad de datos con Bruno.

### 2.9 Dashboard / KPIs

Implementado. El frontend del dashboard hace **una sola peticion HTTP** al cargar
y recibe un JSON diminuto con todos los indicadores, calculados con
**agregaciones** en la base (`COUNT(*)`, `GROUP BY tipo`), sin transferir filas.

- [X] Endpoint unico **`GET /api/dashboard/summary?sucursal=CANCUN`** (respuesta en
  `data`). Solo lectura/agregacion: no escribe.
- [X] Definiciones de KPI (conteos directos):
  - `totalActivos` = activos con `estado != DE_BAJA`.
  - `equiposAsignados` = activos con `responsableId` distinto de null.
  - `ticketsPendientes` = incidencias con `estado != COMPLETADO`.
- [X] Forma de la respuesta: `data` = `{ kpis, activosPorTipo, licenciasPorVencer, recordatorios }`.
- [X] `activosPorTipo` con `GROUP BY tipo`, ordenado por total descendente.
- [X] `licenciasPorVencer`: top 5 por `fechaVencimiento` mas cercana entre las
  activas (incluye vencidas), con software, proveedor, fecha y asignado.
- [X] `recordatorios: []` reservado hasta implementar §2.10.
- [X] RBAC JWT + permiso `dashboard:leer` (migracion lo agrega a roles con
  `activos:leer`); documentado en OpenAPI y cubierto en Bruno (200/400/401/403).
- [ ] **Filtro de sucursal parcial (temporal):** hoy el filtro se aplica solo a los
  KPIs y al desglose de **activos**, leyendo `Activo.sucursal` (string) con el
  mapeo `CANCUN = {CANCUN, STOCK CUN}` y `PLAYA = {PLAYA, STOCK}`; `NULL` cuenta
  solo en "Ambos". `ticketsPendientes` y `licenciasPorVencer` son **globales**
  hasta completar §2.11 (normalizacion), momento en que el filtro cubrira todos
  los bloques.

### 2.10 Recordatorios (idea, por definir)

Recordatorios de cosas que no deben olvidarse (tareas propias de TI), junto con
las notificaciones existentes. Se muestran en el dashboard (§2.9) y tienen su
propio ciclo de vida; **no** sustituyen a `Notificacion`.

- [ ] Modelo propio `Recordatorio`: `titulo`, `fecha`, `descripcion`, dueño
  (`usuarioId`) y `completado` (baja logica/marcar como cumplido).
- [ ] CRUD `GET /api/recordatorios` (paginado y filtrable por rango de fecha y
  `completado`), `POST`, `PATCH /:id` y `DELETE /:id` (baja logica, §4.6).
- [ ] Definir si el recordatorio es personal (solo su dueño) o compartido, y su
  relacion con las notificaciones persistentes (¿emite aviso al llegar la fecha?).
- [ ] RBAC por definir; documentar en OpenAPI y cubrir validaciones, filtros,
  permisos y baja logica con Bruno.

### 2.11 Normalizacion de sucursal (prerrequisito del dashboard)

Hoy `Activo.sucursal` es texto libre. Para que el filtro del dashboard (§2.9)
sea exacto y consistente en todos los modulos, se normaliza a catalogo.

- [ ] Nuevo modelo **`Sucursal`** (`id`, `nombre` unico, `activo`), sumado a
  `GET /api/catalogos` y con su CRUD (JWT + `catalogos:administrar`, baja logica
  y reactivacion al recrear un nombre inactivo, como el resto de catalogos).
- [ ] Relacion `sucursalId` en **`Activo`, `Incidencia` y `Licencia`**.
- [ ] **Migracion aditiva + backfill**: convertir los valores actuales de
  `Activo.sucursal` en filas del catalogo y poblarlos; dejar el string viejo
  opcional/deprecado hasta confirmar que no se usa.
- [ ] Actualizar alta/edicion de activos para aceptar `sucursalId` y adaptar
  filtros existentes (`GET /api/activos?sucursal=`) sin romper compatibilidad.

## 3. Features tecnicas pendientes

- [X] `src/utils/crypto.ts` - AES-256-GCM con `AES_SECRET_KEY` para `Licencia.clave` y `Secreto.password`
- [X] Socket.IO autenticado con JWT y `notificaciones:leer`; separa sala/evento de incidencias y recordatorios privados de licencias
- [ ] Emitir los eventos Socket.IO desde las operaciones de alta y cambio de estado de incidencias cuando se implementen esos endpoints
- [X] `node-cron` - job diario de correo y recordatorios persistentes de vencimiento de licencias; pendiente SLA de tickets
- [X] Nodemailer (`src/config/mailer.ts`) - correos de alerta de licencias; pendiente otras notificaciones
- [ ] S3 (`src/config/s3.ts`, `@aws-sdk/client-s3`) - evidencias de incidencias y adjuntos
- [ ] Puppeteer - reportes PDF (inventario, tickets cerrados, licencias)
- [ ] Ollama (`llama3.1:8b`) - asistente IA + Function Calling (servicio `ollama` en docker, profile `ai`)
- [ ] CORS restrictivo - hoy `app.use(cors())` abierto; restringir a la URL del frontend
- [X] `.env.example` documenta SMTP y variables de alertas de licencias; quedan pendientes `S3_*`, `OLLAMA_*`, `CORS_ORIGIN` y la revision de nombres previos del roadmap
- [ ] agregar en licencias el tipo (suscripción, perpetua).
- [ ] Devolver en la consulta de licencias la clave
- [ ] creacion de endPoints del modulo de auditoria
- [ ] creacion de endPoints del modulo de mantenimiento de equipos
- [ ] simular subtareas  para documentar a la memoria
- [ ] **Recordatorios (Tareas Programadas):** Notificaciones automáticas de vencimientos

---

## 4. Reglas de mantenimiento

1. Todo endpoint nuevo debe agregarse el mismo dia a `src/docs/openapi.yaml` (Swagger es la fuente de verdad).
2. Todo endpoint nuevo debe llevar su request/asserst en la coleccion `bruno/`.
3. Seguir `routes -> controllers -> services`, `asyncHandler` + `HttpError`, sin `any`, sin librerias nuevas de validacion.
4. Al cerrar un modulo: correr `npx tsc --noEmit` y la suite Bruno (`cd bruno && npx @usebruno/cli run . -r --env Local`).
5. Marcar los checkboxes de este archivo al completar cada item.
6. **Borrados logicos siempre**: ningun `DELETE` borra filas de la base. En activos se implementa con el estado `DE_BAJA` (sin migracion, 200 idempotente); cada modulo define su mecanismo al implementarse, pero la regla es universal.
7. El **dashboard (§2.9) es de solo lectura/agregacion** (no escribe nada) y su filtro por sucursal depende de la normalizacion de §2.11.

## 5. Fuentes Excel y modelo de datos

La comparación documentada de las fuentes externas contra Prisma está en
[`docs/EXCEL_BD_ANALISIS.md`](EXCEL_BD_ANALISIS.md). Antes de crear un
importador deben aprobarse la normalización de accesos, proveedores, líneas
telefónicas y redes Wi-Fi, además del tratamiento de periféricos y filas
incompletas.
