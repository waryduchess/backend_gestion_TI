3

# Roadmap - Backend Sistema de Gestion TI

Estado de lo que **falta por desarrollar**. Este archivo es la memoria viva del proyecto:
conviene revisarlo antes de cada iteracion y actualizarlo al cerrar cada modulo.

---

## 1. Estado actual

| Modulo                             | Endpoints                                         | Documentado en Swagger | Bruno      |
| ---------------------------------- | ------------------------------------------------- | ---------------------- | ---------- |
| Auth (`/api/auth`)               | `POST /login`, `GET /me`                      | Si                     | 3 requests |
| Incidencias (`/api/incidencias`) | `GET /`, `GET /:id`, `POST /`                  | Si                     | 12 requests |
| Activos (`/api/activos`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/estado`, `POST /:id/asignaciones`, `DELETE /:id` | Si                     | 41 requests |
| Asignaciones (`/api/asignaciones`) | `GET /`, `POST /:id/devolucion`               | Si                     | 8 requests |
| Usuarios (`/api/usuarios`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/password`, `DELETE /:id` | Si                     | Pruebas protegidas |
| Documentacion                      | `GET /api/docs`, `GET /api/docs/openapi.yaml` | -                      | -          |
| Catalogos (`/api/catalogos`)       | `GET /` + CRUD `/api/departamentos`, `/api/ubicaciones`, `/api/puestos`, `/api/tipos-usuario` | Si | CRUD Bruno |
| RBAC / roles                       | CRUD `/api/roles`, asignar rol a usuario          | Si                     | 18 requests |
| Licencias (`/api/licencias`)       | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` | Si | 12 requests |
| Secretos                           | ninguno                                           | No                     | No         |

Regresion completa mas reciente tras Licencias: `npx tsc --noEmit`, `prisma
validate`, OpenAPI y suite Bruno (145/145 requests, 304/304 assertions). Para
la fase 2 de incidencias: build, OpenAPI, Bruno de Incidencias (12/12 requests,
23/23 assertions), Roles (18/18 requests, 26/26 assertions) y prueba de evento
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

Permisos iniciales: `incidencias:leer`, `activos:leer`, `activos:crear`,
`activos:editar`, `activos:estado`, `activos:asignar`, `activos:eliminar` y
`usuarios:administrar`, `roles:administrar`, `catalogos:administrar`. Se protege
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

### 2.6 Secretos - modelo `Secreto` existe sin endpoints

- [ ] CRUD `/api/secretos` (`password` cifrado AES-256-GCM; lectura solo con rol autorizado)
- [ ] Candidato a cifrado: `AsignacionComputo.bitlocker`

---

## 3. Features tecnicas pendientes

- [X] `src/utils/crypto.ts` - AES-256-GCM con `AES_SECRET_KEY` para `Licencia.clave`; pendiente usarlo tambien para `Secreto.password`
- [X] Socket.IO autenticado con JWT y permiso `incidencias:leer`; eventos tipados para nuevas incidencias y cambios de estado
- [ ] Emitir los eventos Socket.IO desde las operaciones de alta y cambio de estado de incidencias cuando se implementen esos endpoints
- [X] `node-cron` - job diario de vencimiento de licencias; pendiente SLA de tickets
- [X] Nodemailer (`src/config/mailer.ts`) - correos de alerta de licencias; pendiente otras notificaciones
- [ ] S3 (`src/config/s3.ts`, `@aws-sdk/client-s3`) - evidencias de incidencias y adjuntos
- [ ] Puppeteer - reportes PDF (inventario, tickets cerrados, licencias)
- [ ] Ollama (`llama3.1:8b`) - asistente IA + Function Calling (servicio `ollama` en docker, profile `ai`)
- [ ] CORS restrictivo - hoy `app.use(cors())` abierto; restringir a la URL del frontend
- [X] `.env.example` documenta SMTP y variables de alertas de licencias; quedan pendientes `S3_*`, `OLLAMA_*`, `CORS_ORIGIN` y la revision de nombres previos del roadmap

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
