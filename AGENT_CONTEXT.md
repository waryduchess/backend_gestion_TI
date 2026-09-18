# Contexto del Proyecto para Agentes de IA: Backend API (Sistema de Gestión de TI)

## 1. Misión del Sistema y Rol del Backend
Este proyecto es la API RESTful y motor en tiempo real para un **Sistema de Gestión de TI** desarrollado por un equipo de 2 desarrolladores (1,200 hrs totales).
Tu rol como Agente de IA es generar, refactorizar o auditar código del backend manteniendo estricta adherencia a la arquitectura definida, tipado estricto y separación de capas.

---

## 2. Stack Tecnológico Obligatorio

* **Lenguaje:** Node.js con TypeScript (ES2022, sintaxis `import/export`, strict mode activado).
* **Framework Web:** Express.js.
* **Base de Datos & ORM:** MySQL 8.0 gestionado exclusivamente mediante **Prisma ORM**.
* **Autenticación & Seguridad:**
  * JWT (`jsonwebtoken`) para sesiones sin estado (*stateless*).
  * `bcryptjs` para hashing de contraseñas.
  * `Node Crypto` (AES-256-GCM) para cifrado simétrico de credenciales y licencias.
* **Tiempo Real:** `Socket.io` para WebSockets.
* **Procesamiento de Archivos:** `ExcelJS` (archivos `.xlsx`) y `Puppeteer` (generación de `.pdf`).
* **Servicios e Integraciones:**
  * `node-cron` para tareas programadas (alertas de vencimiento de licencias).
  * `@aws-sdk/client-s3` para subida de archivos/evidencias.
  * `Nodemailer` para correos SMTP.
  * API de Ollama (`llama3.1:8b`) para asistencia de IA local y *Function Calling*.
* **Contenerización y Herramientas:** Docker, Docker Compose, Bruno (para colecciones de pruebas HTTP).

---

## 3. Reglas de Arquitectura y Patrones de Código

Al generar o modificar código en este repositorio, DEBES seguir estas reglas:

1. **Estructura de Capas (Controller-Service-Repository):**
   * `routes/`: Define endpoints y asigna middlewares. No contiene lógica de negocio.
   * `controllers/`: Maneja peticiones HTTP (`req`, `res`), valida parámetros y retorna respuestas estandarizadas.
   * `services/`: Contiene la lógica de negocio, reglas de cálculo, llamadas a Prisma, algoritmos de cifrado e integraciones.
   * `middlewares/`: Contiene la verificación de JWT, chequeo de roles (RBAC) y captura global de errores.

2. **Manejo de Errores:**
   * Usa siempre bloques `try/catch` en funciones asíncronas o middlewares de captura de errores (`asyncHandler`).
   * Retorna códigos HTTP estandarizados (`200` OK, `201` Created, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `500` Internal Server Error).
   * Respuestas de error deben seguir la estructura: `{ "success": false, "message": "Descripción clara del error", "errors": [] }`.

3. **Tipado Estricto con TypeScript:**
   * NUNCA utilices el tipo `any`. Define interfaces o tipos explícitos dentro de `src/models/` o aprovecha los tipos generados por Prisma (`@prisma/client`).
   * Tipa explícitamente los parámetros de entrada y retorno de todas las funciones de los servicios.

4. **Operaciones en Base de Datos (Prisma):**
   * Utiliza transacciones atómicas (`prisma.$transaction([])`) cuando realices operaciones múltiples interdependientes (ej. asignar un equipo y actualizar su estado en inventario).
   * NUNCA ejecutes consultas SQL crudas en texto plano salvo extrema necesidad demostrada.

---

## 4. Estructura de Directorios

```text
src/
 ├── config/         # Instancias de Prisma, S3, Socket.io, Transporter SMTP, Ollama
 ├── controllers/    # Manejadores de solicitudes HTTP
 ├── middlewares/    # Auth JWT, Roles RBAC, Validaciones de esquema
 ├── models/         # Interfaces y DTOs de TypeScript
 ├── routes/         # Definición de endpoints de Express
 ├── services/       # Lógica pura de negocio y consultas Prisma
 ├── utils/          # Helpers de cifrado crypto, formateadores, constantes
 └── app.ts          # Inicialización de Express, middlewares y servidor HTTP/Sockets

