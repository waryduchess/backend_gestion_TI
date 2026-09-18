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
git clone [https://github.com/waryduchess/backend_gestion_TI.git](https://github.com/waryduchess/backend_gestion_TI.git)
cd backend_gestion_TI
