# Roadmap - Backend Sistema de Gestion TI

Estado de lo que **falta por desarrollar**. Este archivo es la memoria viva del proyecto:
conviene revisarlo antes de cada iteracion y actualizarlo al cerrar cada modulo.

---

## 1. Estado actual

| Modulo | Endpoints | Documentado en Swagger | Bruno |
|---|---|---|---|
| Auth (`/api/auth`) | `POST /login`, `GET /me` | Si | 3 requests |
| Incidencias (`/api/incidencias`) | `GET /` (listado paginado) | Si | 2 requests |
| Activos (`/api/activos`) | `GET /`, `GET /:id` | Si | 9 requests |
| Documentacion | `GET /api/docs`, `GET /api/docs/openapi.yaml` | - | - |
| Usuarios / catalogos | ninguno | No | No |
| RBAC / roles | ninguno | No | No |
| Licencias | ninguno | No | No |
| Secretos | ninguno | No | No |

Verificado: `tsc` limpio, suite Bruno 14/14 requests y 19/19 assertions, spec valida con `swagger-cli`.

---

## 2. Endpoints pendientes por modulo

### 2.1 Incidencias (tickets) - hoy solo lectura

- [ ] `GET /api/incidencias/:id` - detalle con descripcion y actualizaciones
- [ ] `POST /api/incidencias` - crear ticket (solicitante obligatorio)
- [ ] `PATCH /api/incidencias/:id` - actualizar estado, prioridad o asignadoA
- [ ] `POST /api/incidencias/:id/actualizaciones` - agregar comentario/actualizacion
- [ ] `DELETE /api/incidencias/:id` - baja (confirmar si es fisica o logica)
- [ ] `POST /api/incidencias/:id/evidencia` - subir archivo a S3 (`evidenciaUrl`)

### 2.2 Inventario de activos - hoy solo lectura

- [x] `POST /api/activos` - registrar activo (solo tipo obligatorio, estado default EN_USO, publico; 409 en clave duplicada, 400 si responsableId no existe)
- [ ] `PATCH /api/activos/:id` - editar datos del activo
- [ ] `PATCH /api/activos/:id/estado` - transiciones EN_USO / EN_ALMACEN / EN_MANTENIMIENTO / DE_BAJA
- [ ] `POST /api/activos/:id/asignaciones` - asignar equipo a usuario (transaccion con estado del activo)
- [ ] `POST /api/asignaciones/:id/devolucion` - cerrar asignacion (`activa=false`, `fechaDevolucion`)
- [ ] `DELETE /api/activos/:id` - baja del activo
- [ ] `GET /api/asignaciones` - listado de asignaciones activas/historicas

### 2.3 Usuarios y catalogos - sin endpoints

- [ ] `GET /api/usuarios` - listado paginado y filtrable (departamento, puesto, activo)
- [ ] `GET /api/usuarios/:id` - detalle
- [ ] `POST /api/usuarios` - alta
- [ ] `PATCH /api/usuarios/:id` - editar datos
- [ ] `PATCH /api/usuarios/:id/password` - alta/rotacion de password (bcrypt)
- [ ] `DELETE /api/usuarios/:id` - baja
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
