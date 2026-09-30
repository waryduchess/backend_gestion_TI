3

# Roadmap - Backend Sistema de Gestion TI

Estado de lo que **falta por desarrollar**. Este archivo es la memoria viva del proyecto:
conviene revisarlo antes de cada iteracion y actualizarlo al cerrar cada modulo.

---

## 1. Estado actual

| Modulo                             | Endpoints                                         | Documentado en Swagger | Bruno      |
| ---------------------------------- | ------------------------------------------------- | ---------------------- | ---------- |
| Auth (`/api/auth`)               | `POST /login`, `GET /me`                      | Si                     | 3 requests |
| Incidencias (`/api/incidencias`) | `GET /` (listado paginado)                      | Si                     | 3 requests |
| Activos (`/api/activos`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/estado`, `POST /:id/asignaciones`, `DELETE /:id` | Si                     | 41 requests |
| Asignaciones (`/api/asignaciones`) | `GET /`, `POST /:id/devolucion`               | Si                     | 8 requests |
| Usuarios (`/api/usuarios`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/password`, `DELETE /:id` | Si                     | 21 requests |
| Documentacion                      | `GET /api/docs`, `GET /api/docs/openapi.yaml` | -                      | -          |
| Catalogos (`/api/catalogos`)       | `GET /` (departamentos, ubicaciones, puestos, tipos de usuario y roles) | Si | 1 request |
| RBAC / roles                       | CRUD `/api/roles`, asignar rol a usuario          | Si                     | Pruebas RBAC |
| Licencias                          | ninguno                                           | No                     | No         |
| Secretos                           | ninguno                                           | No                     | No         |

Verificado tras agregar RBAC: `npx tsc --noEmit`, `prisma validate`, OpenAPI y suite Bruno (91/91 requests, 212/212 assertions).

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

- [X] `POST /api/activos` - registrar activo (solo tipo obligatorio, estado default EN_USO; requiere `activos:crear`; 409 en clave duplicada, 400 si responsableId no existe)
- [X] `PATCH /api/activos/:id` - editar datos del activo (edicion parcial, null borra; requiere `activos:editar`)
- [X] `PATCH /api/activos/:id/estado` - transiciones EN_USO / EN_ALMACEN / EN_MANTENIMIENTO / DE_BAJA; requiere `activos:estado`
- [X] `POST /api/activos/:id/asignaciones` - asignar equipo a usuario; requiere `activos:asignar`
- [X] `POST /api/asignaciones/:id/devolucion` - cerrar asignacion; requiere `activos:asignar`
- [X] `DELETE /api/activos/:id` - baja **logica** (estado `DE_BAJA`); requiere `activos:eliminar`
- [X] `GET /api/asignaciones` - listado paginado y filtrable (sin `bitlocker`); requiere `activos:leer`

### 2.3 Usuarios y catalogos

- [X] `GET /api/usuarios` - listado paginado y filtrable (`q`, `activo`, `departamentoId`, `ubicacionId`, `puestoId`, `tipoUsuarioId`; nunca `passwordHash`; publico)
- [X] `GET /api/usuarios/:id` - detalle con catalogos + rol
- [X] `POST /api/usuarios` - alta (`id`+`nombre` obligatorios, 409 si id existe, `password` opcional con bcrypt -> sin password = sin acceso, 400 si catalogo no existe, 201)
- [X] `PATCH /api/usuarios/:id` - editar datos (parcial, null borra, `id` y `password` fuera de aqui -> 400 con hint)
- [X] `PATCH /api/usuarios/:id/password` - alta/rotacion de password (bcrypt)
- [X] `DELETE /api/usuarios/:id` - baja **logica** (`activo=false`, 200 idempotente, nunca borra filas)
- [X] `GET /api/catalogos` - devuelve departamentos, ubicaciones, puestos, tipos de usuario y roles ordenados por nombre
- [ ] CRUD `/api/departamentos`, `/api/ubicaciones`, `/api/puestos`, `/api/tipos-usuario`

### 2.4 RBAC - roles y permisos

- [X] CRUD `/api/roles` (nombre + permisos; permisos validados contra allowlist; baja logica; no permite desactivar roles asignados)
- [X] Middleware de permisos en `src/middlewares/auth.middleware.ts`; recarga usuario/rol desde BD para aplicar revocaciones de inmediato
- [X] Aplicar `verificarToken` + permisos a incidencias, activos y asignaciones
- [X] `PATCH /api/usuarios/:id/rol` para asignar o quitar un rol; solo roles con `roles:administrar`
- [X] Seed crea/reactiva el rol Administrador, le asigna todos los permisos y lo asigna al usuario `ADMIN`

Permisos iniciales: `incidencias:leer`, `activos:leer`, `activos:crear`,
`activos:editar`, `activos:estado`, `activos:asignar`, `activos:eliminar` y
`roles:administrar`. Se protege contra dejar el sistema sin ningun rol capaz de
administrar roles. El catalogo solo expone nombre e id de roles activos.

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

## 5. Fuentes Excel y modelo de datos

La comparación documentada de las fuentes externas contra Prisma está en
[`docs/EXCEL_BD_ANALISIS.md`](EXCEL_BD_ANALISIS.md). Antes de crear un
importador deben aprobarse la normalización de accesos, proveedores, líneas
telefónicas y redes Wi-Fi, además del tratamiento de periféricos y filas
incompletas.
