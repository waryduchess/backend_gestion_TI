3

# Roadmap - Backend Sistema de Gestion TI

Estado de lo que **falta por desarrollar**. Este archivo es la memoria viva del proyecto:
conviene revisarlo antes de cada iteracion y actualizarlo al cerrar cada modulo.

---

## 1. Estado actual

| Modulo                             | Endpoints                                         | Documentado en Swagger | Bruno      |
| ---------------------------------- | ------------------------------------------------- | ---------------------- | ---------- |
| Auth (`/api/auth`)               | `POST /login`, `GET /me`                      | Si                     | 3 requests |
| Incidencias (`/api/incidencias`) | `GET /` (listado paginado)                      | Si                     | 2 requests |
| Activos (`/api/activos`)         | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/estado`, `POST /:id/asignaciones`, `DELETE /:id` | Si                     | 40 requests |
| Asignaciones (`/api/asignaciones`) | `GET /`, `POST /:id/devolucion`               | Si                     | 8 requests |
| Usuarios (`/api/usuarios`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/password`, `DELETE /:id` | Si                     | 21 requests |
| Documentacion                      | `GET /api/docs`, `GET /api/docs/openapi.yaml` | -                      | -          |
| Catalogos (departamentos, etc.)    | ninguno                                           | No                     | No         |
| RBAC / roles                       | ninguno                                           | No                     | No         |
| Licencias                          | ninguno                                           | No                     | No         |
| Secretos                           | ninguno                                           | No                     | No         |

Verificado: `tsc` limpio, spec valida con `swagger-cli` (13 paths), suite Bruno 74/74 requests y 180/180 assertions.

---

## 2. Endpoints pendientes por modulo

### 2.1 Incidencias (tickets) - hoy solo lectura

- [ ] `GET /api/incidencias/:id` - detalle con descripcion y actualizaciones
- [ ] `POST /api/incidencias` - crear ticket (solicitante obligatorio)
- [ ] `PATCH /api/incidencias/:id` - actualizar estado, prioridad o asignadoA
- [ ] `POST /api/incidencias/:id/actualizaciones` - agregar comentario/actualizacion
- [ ] `DELETE /api/incidencias/:id` - borrado **logico** (nunca borrar filas; mecanismo al descongelar el modulo)
- [ ] `POST /api/incidencias/:id/evidencia` - subir archivo a S3 (`evidenciaUrl`)

### 2.2 Inventario de activos - hoy solo lectura

- [X] `POST /api/activos` - registrar activo (solo tipo obligatorio, estado default EN_USO, publico; 409 en clave duplicada, 400 si responsableId no existe)
- [X] `PATCH /api/activos/:id` - editar datos del activo (edicion parcial, null borra, estado fuera de aqui, responsableId id o null, publico)
- [X] `PATCH /api/activos/:id/estado` - transiciones EN_USO / EN_ALMACEN / EN_MANTENIMIENTO / DE_BAJA (libres, 409 si asignacion activa al bajar/almacenar, mismo estado = 200 idempotente, publico)
- [X] `POST /api/activos/:id/asignaciones` - asignar equipo a usuario (transaccion: 409 si DE_BAJA o con asignacion activa, reactiva fila si el usuario ya lo tuvo, activo pasa a EN_USO con responsable = usuario, 201 con ActivoDetalle, publico)
- [X] `POST /api/asignaciones/:id/devolucion` - cerrar asignacion (`activa=false`, `fechaDevolucion`, activo -> EN_ALMACEN, limpia responsableId si coincide, 200 idempotente, publico)
- [X] `DELETE /api/activos/:id` - baja **logica** (estado `DE_BAJA`, nunca borra filas; 200 idempotente si ya estaba, 409 con asignacion activa, publico)
- [X] `GET /api/asignaciones` - listado paginado y filtrable (`page`, `limit`, `activa`, `usuarioId`, `activoId`, `q`; sin `bitlocker`; publico)

### 2.3 Usuarios y catalogos

- [X] `GET /api/usuarios` - listado paginado y filtrable (`q`, `activo`, `departamentoId`, `ubicacionId`, `puestoId`, `tipoUsuarioId`; nunca `passwordHash`; publico)
- [X] `GET /api/usuarios/:id` - detalle con catalogos + rol
- [X] `POST /api/usuarios` - alta (`id`+`nombre` obligatorios, 409 si id existe, `password` opcional con bcrypt -> sin password = sin acceso, 400 si catalogo no existe, 201)
- [X] `PATCH /api/usuarios/:id` - editar datos (parcial, null borra, `id` y `password` fuera de aqui -> 400 con hint)
- [X] `PATCH /api/usuarios/:id/password` - alta/rotacion de password (bcrypt)
- [X] `DELETE /api/usuarios/:id` - baja **logica** (`activo=false`, 200 idempotente, nunca borra filas)
- [ ] CRUD `/api/departamentos`, `/api/ubicaciones`, `/api/puestos`, `/api/tipos-usuario`

### 2.4 RBAC - modelo `Rol` existe con 0 registros

- [ ] CRUD `/api/roles` (nombre + permisos)
- [ ] Middleware `verificarRol(...)` en `src/middlewares/auth.middleware.ts`
- [ ] Aplicar `verificarToken` a incidencias y activos (hoy estan publicos; solo `/api/auth` lo usa)
- [ ] Asignar rol a usuario (`Usuario.rolId`)

### 2.5 Licencias - modelo `Licencia` existe sin endpoints

- [ ] `GET /api/licencias` - listado con filtros (activa, proveedor, vencimiento)
- [ ] `POST /api/licencias` - alta (clave cifrada AES-256-GCM antes de guardar)
- [ ] `PATCH /api/licencias/:id` - editar/reasignar
- [ ] `DELETE /api/licencias/:id` - baja
- [ ] Alerta de vencimiento via `node-cron` + Nodemailer

### 2.6 Secretos - modelo `Secreto` existe sin endpoints

- [ ] CRUD `/api/secretos` (`password` cifrado AES-256-GCM; lectura solo con rol autorizado)
- [ ] Candidato a cifrado: `AsignacionComputo.bitlocker`

---

## 3. Features tecnicas pendientes

- [ ] `src/utils/crypto.ts` - AES-256-GCM (clave en `.env`) para `Licencia.clave`, `Secreto.password`
- [ ] Socket.io (`src/config/socket.ts`) - notificaciones en tiempo real (nuevos tickets, cambios de estado)
- [ ] `node-cron` - jobs: vencimiento de licencias, SLA de tickets
- [ ] Nodemailer (`src/config/mailer.ts`) - correos de alerta y notificacion
- [ ] S3 (`src/config/s3.ts`, `@aws-sdk/client-s3`) - evidencias de incidencias y adjuntos
- [ ] Puppeteer - reportes PDF (inventario, tickets cerrados, licencias)
- [ ] Ollama (`llama3.1:8b`) - asistente IA + Function Calling (servicio `ollama` en docker, profile `ai`)
- [ ] CORS restrictivo - hoy `app.use(cors())` abierto; restringir a la URL del frontend
- [ ] Variables de entorno nuevas en `.env.example`: `SMTP_*`, `S3_*`, `OLLAMA_*`, `CORS_ORIGIN`, `CRIPTO_KEY`

---

## 4. Reglas de mantenimiento

1. Todo endpoint nuevo debe agregarse el mismo dia a `src/docs/openapi.yaml` (Swagger es la fuente de verdad).
2. Todo endpoint nuevo debe llevar su request/asserst en la coleccion `bruno/`.
3. Seguir `routes -> controllers -> services`, `asyncHandler` + `HttpError`, sin `any`, sin librerias nuevas de validacion.
4. Al cerrar un modulo: correr `npx tsc --noEmit` y la suite Bruno (`cd bruno && npx @usebruno/cli run . -r --env Local`).
5. Marcar los checkboxes de este archivo al completar cada item.
6. **Borrados logicos siempre**: ningun `DELETE` borra filas de la base. En activos se implementa con el estado `DE_BAJA` (sin migracion, 200 idempotente); cada modulo define su mecanismo al implementarse, pero la regla es universal.
