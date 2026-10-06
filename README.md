# Sistema de Gestion de TI - Backend API

API RESTful y servicio en tiempo real para el Sistema de Gestion de TI, desarrollado con Node.js, Express, TypeScript, Prisma ORM y MySQL. Este backend se encarga de gestionar la logica de negocio para la operativa de tickets, inventario, licenciamiento cifrado, proyectos, notificaciones y la integracion con el asistente de IA Local (Llama 3.1).

---

## Tecnologias Utilizadas

* Entorno y Lenguaje: Node.js, TypeScript, JavaScript
* Framework Web: Express.js
* Base de Datos y ORM: MySQL 8.0, Prisma ORM
* Contenerizacion: Docker y Docker Compose
* Autenticacion y Seguridad: JWT (JSON Web Tokens), Node Crypto (Cifrado AES-256)
* Tiempo Real: Socket.io (WebSockets)
* Generacion de Archivos: ExcelJS (Excel), Puppeteer (PDF)
* Almacenamiento y Correos: AWS SDK S3 (@aws-sdk/client-s3), Nodemailer (SMTP)
* Tareas Programadas: node-cron
* IA Local: Llama 3.1 (a traves de Ollama / vLLM API)

---

## Requisitos Previos

Asegurate de tener instalado lo siguiente en tu entorno local:

* Node.js (v18 o superior)
* npm o pnpm
* Docker y Docker Compose
* MySQL (si prefieres ejecutarlo de forma nativa sin Docker)
* Ollama (para la ejecucion del modelo Llama 3.1 local)

---

## Configuracion del Proyecto

### 1. Clonar el repositorio
```bash
git clone https://github.com/waryduchess/backend_gestion_TI.git
cd backend_gestion_TI
```

### 2. Crear el archivo de entorno
```bash
cp .env.example .env
```
Variables minimas a cambiar en `.env`:
* `JWT_SECRET` - secreto para firmar los tokens
* `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` - credenciales del usuario admin que crea el seed

El resto de variables (`SMTP_*`, `S3_*`, `OLLAMA_*`, `AES_SECRET_KEY`) solo se necesitan al usar esas features.

---

## Primer arranque

Solo requiere git + Docker (Node no es necesario, todo corre en contenedores):

```bash
docker compose up -d
# levanta MySQL (healthcheck), phpMyAdmin y el API.
# El API aplica solo: prisma generate && prisma migrate deploy && npm run dev

docker compose exec api npm run seed
# crea/actualiza el rol Administrador con todos los permisos disponibles
# y el usuario ADMIN asignado a ese rol
# salida esperada: "Admin actualizado: ADMIN <email>"
```

Verificacion:
* Swagger: http://localhost:3000/api/docs/
* Login: `POST /api/auth/login` con `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `.env`
* phpMyAdmin: http://localhost:8081 (usuario `gestion_ti`)
* Las rutas de datos requieren JWT. Incidencias, activos, asignaciones y
  administracion de roles tambien validan permisos del rol. Los usuarios sin
  rol activo no tienen acceso a esos modulos.
* Crear incidencias requiere `incidencias:crear`; listarlas o consultarlas
  requiere `incidencias:leer`. Vuelve a ejecutar `npm run seed` al agregar
  permisos nuevos para que el rol Administrador los reciba.
* Todas las rutas `/api/usuarios` requieren JWT. Ademas, requieren el permiso
  `usuarios:administrar`, excepto `PATCH /:id/rol`, que requiere
  `roles:administrar`.
* Los CRUD de `/api/departamentos`, `/api/ubicaciones`, `/api/puestos` y
  `/api/tipos-usuario` requieren JWT y `catalogos:administrar`. La baja es
  logica; al crear un nombre inactivo se reactiva el registro existente.
  `GET /api/catalogos` requiere JWT, pero no ese permiso administrativo.
* `/api/licencias` requiere JWT y `licencias:administrar`. Las claves se
  cifran con AES-256-GCM y nunca se devuelven en las respuestas. El job envia
  alertas diarias desde 30 dias antes del vencimiento, a la persona asignada o
  al respaldo `LICENCIAS_ALERTA_EMAIL`; usa SMTP y por defecto corre a las 09:00
  de `America/Cancun` (`LICENCIAS_ALERTA_CRON`).
* `/api/notificaciones` requiere JWT y `incidencias:leer`; cada nueva incidencia
  crea un aviso persistente para cada usuario activo con ese permiso. La API
  permite listar los avisos propios (`GET /api/notificaciones?leida=false`),
  marcarlos individualmente (`PATCH /:id/leer`) o en conjunto
  (`PATCH /leer-todas`). Socket.IO emite `incidencias:nueva` a cada usuario
  autorizado después de guardar el aviso; si estaba desconectado, puede
  recuperar el historial con la API. `SOCKET_CORS_ORIGIN` acepta una lista de
  origenes separados por coma; por defecto permite cualquier origen.
* Genera una clave antes de un entorno real con `openssl rand -hex 32` y
  configúrala como `AES_SECRET_KEY`; no uses el valor de ejemplo.
* `POST /api/auth/login` es la unica ruta operativa publica; `/health` y la
  documentacion permanecen publicos para comprobacion y consulta.

Notas:
* La base queda vacia salvo el admin; los datos de ejemplo no se incluyen.
* Opcional (IA local): `docker compose --profile ai up -d` levanta el servicio Ollama.
* Si editas `src/app.ts`, reinicia el contenedor: `docker compose up -d --force-recreate api`

---

## Desarrollo local (sin Docker para el API)

```bash
npm install
npm run prisma:generate
npm run prisma:deploy    # aplica migraciones (requiere MySQL corriendo y DATABASE_URL en .env)
npm run dev              # ts-node-dev en http://localhost:3000
npm run seed             # usuario admin
```

Comandos de verificacion:
```bash
npx tsc --noEmit                                   # typecheck
npx @apidevtools/swagger-cli validate src/docs/openapi.yaml   # spec Swagger
cd bruno && npx @usebruno/cli run . -r --env Local           # suite Bruno
```

---

## Coleccion Bruno (pruebas)

`bruno/environments/Local.bru` no se commitea (contiene credenciales); la plantilla si:

```bash
cd bruno
cp environments/Local.example.bru environments/Local.bru
# editar Local.bru: adminEmail y adminPassword = los de tu .env
npx @usebruno/cli run . -r --env Local            # correr toda la suite
npx @usebruno/cli run Roles -r --env Local        # RBAC (requiere seed del admin)
```

Los requests protegidos realizan login con `adminEmail` y `adminPassword` antes
de cada prueba, por lo que también pueden ejecutarse por carpeta. Asegurate de
haber aplicado migraciones y ejecutado el seed actualizado.

Las demas variables (`ultimoActivoId`, `asignacionId`, ...) las generan los scripts de cada request durante la corrida; no hay que crearlas a mano.

### Socket.IO

Conecta el cliente del frontend al mismo host de la API, enviando el JWT
obtenido en el login durante el handshake:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: jwt },
});

socket.on('incidencias:nueva', (incidencia) => {
  // Actualizar la vista con la incidencia recibida.
});

socket.on('incidencias:estado-cambiado', (cambio) => {
  // Refrescar el estado de la incidencia.
});
```

`incidencias:nueva` entrega `notificacionId`, `id`, `titulo`, `estado`,
`prioridad` y `fechaNotificacion` (ISO 8601). El campo `id` es el identificador
de la incidencia. `incidencias:estado-cambiado` tiene un contrato preparado,
pero aún no se emite desde una operación de actualización.

La consulta REST incluye `meta.noLeidas` para el badge y solo devuelve avisos
del usuario autenticado. Los registros se conservan sin expiración automática;
Socket.IO no recupera eventos emitidos mientras el cliente estaba desconectado,
por lo que la API es la fuente de verdad para ese historial.

Endpoints disponibles:

* `GET /api/notificaciones?page=1&limit=20&leida=false`
* `PATCH /api/notificaciones/:id/leer`
* `PATCH /api/notificaciones/leer-todas`

Todos requieren JWT y `incidencias:leer`. La respuesta del listado incluye
`meta.noLeidas`, el total pendiente del usuario aunque se aplique el filtro
`leida`.
