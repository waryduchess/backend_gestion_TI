# Análisis de fuentes Excel y modelo de base de datos

## Alcance

Este documento compara las fuentes ubicadas en `EXCEL DE IT` contra el esquema
de [`prisma/schema.prisma`](../prisma/schema.prisma). No contiene contraseñas,
claves, tokens ni valores de credenciales. Tampoco ejecuta una importación.

## Inventario de fuentes

Archivo: `BD-TECNOLOGIA.xlsx`

| Hoja | Registros aproximados | Destino actual o propuesto |
| --- | ---: | --- |
| `Tabla_Usuarios` | 63 | `Usuario` y catálogos |
| `Tabla_Activos` | 203 | `Activo` |
| `Tabla_AsignacionComputo` | 121 | `AsignacionComputo` y `Activo` |
| `Secrets` | 23 | `Secreto`, con cifrado |
| `+ IA` | 14 | `AccesoUsuario` propuesto |
| `Emails_Accesos` | 42 | `AccesoUsuario`/`Secreto` |
| `Lineas Celular` | 136 | `LineaTelefonica` propuesta |
| `Proveedores` | 8 | `Proveedor` propuesto |
| `WIFI CUN PDC` | 27 | `RedWifi` propuesta |
| `WIFI PDC` | 0 | Sin datos |

Archivo: `Seguimiento_a_Incidencias_5__reparado2(1).csv`

- Contiene aproximadamente 239 líneas.
- Proviene de SharePoint.
- La primera línea contiene metadatos XML de SharePoint, no un encabezado
  CSV normal.
- Sus campos relevantes incluyen fecha, título, descripción, solicitante,
  correo, prioridad, estado, asignado, finalización, departamento, tipo de
  requerimiento, adjuntos, actualizaciones y evidencia.

## Correspondencia con el esquema actual

### Usuarios

`Tabla_Usuarios` corresponde principalmente con `Usuario`, `Departamento`,
`Ubicacion`, `Puesto`, `TipoUsuario` y `Rol`.

Campos que sí tienen destino:

- Identificador interno.
- Nombre.
- Activo/inactivo.
- Departamento.
- Rol o puesto.
- Ubicación.
- Tipo de usuario.
- Correo principal.
- Fecha de inicio y fecha de fin.

La hoja también mezcla accesos de NetSuite, Office, correo, Monday, GravityZone,
teléfono y funcionalidades de IA. Esos valores no deben agregarse como
columnas de `Usuario`.

### Activos

`Tabla_Activos` corresponde con `Activo` en clave, tipo, marca, modelo, número
de parte, serie, sucursal, AnyDesk, nombre de red, procesador, memoria,
condición y notas.

Se recomienda mover `anioCompra` a `Activo`: actualmente aparece en
`AsignacionComputo`, aunque describe al equipo y no la asignación.

`ANTIGÜEDAD` y `GRAVITY ZONE` contienen valores heterogéneos: años, comentarios,
estados y observaciones. Deben pasar por normalización y no importarse
automáticamente como un único campo.

### Asignaciones

`Tabla_AsignacionComputo` contiene usuario, tipo, marca, modelo, serie, año,
número de activo, nombre de equipo, observación y BitLocker.

La hoja no contiene únicamente computadoras; también incluye monitores,
teclados, mouse, teléfonos, equipos de almacén y filas incompletas. Se debe
definir una regla para convertir periféricos en `Activo` o excluirlos con un
reporte de errores.

`BITLOCKER` debe cifrarse y excluirse de listados, respuestas generales y logs.

### Incidencias

`Incidencia` ya cubre título, descripción, fechas, estado, prioridad, tipo,
solicitante, asignado, departamento, evidencia e identificador original.
`ActualizacionIncidencia` cubre la bitácora.

Recomendaciones:

- Guardar el ID original de SharePoint en `originalId`.
- Resolver solicitante y asignado por ID o correo, no únicamente por nombre.
- Normalizar estados, prioridades y tipos antes de insertar.
- Crear `AdjuntoIncidencia` si una incidencia puede tener más de una evidencia.

## Fuentes sin representación específica

### Accesos y secretos

Crear `AccesoUsuario` para asociar un usuario con un sistema, cuenta, nivel de
acceso y secreto. Mantener la contraseña o clave cifrada en `Secreto`, con
lectura restringida por rol.

Las hojas `Secrets` y `Emails_Accesos` no deben importarse directamente sin
clasificación, deduplicación y cifrado.

### Proveedores

Crear `Proveedor` con nombre, área, contacto, teléfono, correo, URL y activo.
Relacionarlo posteriormente con `Licencia`, `Secreto` e incidencias cuando
corresponda.

### Líneas telefónicas

Crear `LineaTelefonica` con número, extensión, operador, `usuarioId`, activo y
observaciones. La hoja tiene columnas sin encabezados consistentes y requiere
normalización manual o reglas explícitas.

### Redes Wi-Fi

Crear `RedWifi` con nombre de red, ubicación, contraseña cifrada y estado
activo. No conviene modelarlas solo como secretos porque se necesitarán
consultas por ubicación y rotación.

### Acceso a IA

Representarlo como un acceso o permiso del sistema, no como una columna
booleana en `Usuario`. Puede reutilizar `AccesoUsuario` con sistema `IA` y un
nivel de acceso.

## Prioridades para la siguiente implementación

### Alta

1. Normalizar usuarios, activos, asignaciones e incidencias antes de insertar.
2. Mover `anioCompra` a `Activo`.
3. Resolver relaciones por identificadores, correos y catálogos.
4. Cifrar BitLocker, contraseñas y claves.
5. Usar `originalId` para evitar duplicados de SharePoint.
6. Separar adjuntos si existe más de una evidencia por incidencia.

### Media

1. Crear `AccesoUsuario`.
2. Crear `Proveedor`.
3. Crear `LineaTelefonica`.
4. Crear `RedWifi`.
5. Relacionar secretos con usuarios, proveedores y sistemas.

### Baja

1. Modelar permisos de IA.
2. Normalizar GravityZone.
3. Automatizar accesos de Office, NetSuite y otros servicios.
4. Añadir historial de rotación de credenciales.

## Reglas para una futura importación

- Ejecutar primero un modo de validación sin escrituras.
- Generar un reporte de filas válidas, inválidas, duplicadas y sin relación.
- No importar secretos sin cifrado.
- No copiar valores sensibles al log ni al reporte.
- Resolver catálogos antes de insertar usuarios.
- Importar usuarios antes que asignaciones e incidencias.
- Mantener transacciones por lote y permitir reejecución idempotente.
- Rechazar filas con claves ambiguas en vez de inventar relaciones.
