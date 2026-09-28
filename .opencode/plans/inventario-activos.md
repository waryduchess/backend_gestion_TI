# Plan: Módulo Inventario (`GET /api/activos`)

**Aprobado por Erik**: sí, ejecuta (2026-09-28). Decisiones: unificar ambas listas · responsable solo si matchea usuario · estado default EN_USO.

## 1. Endpoints
- `GET /api/activos` — `page`, `limit` (≤100), `tipo`, `estado` (enum), `sucursal`, `responsableId`, `q` (busca en claveActivo, cb23, numeroSerie, modelo, marca, nombreRed). Respuesta `{success, message, errors, data:[{...activo, responsable}], meta}`.
- `GET /api/activos/:id` — detalle con `responsable` + `asignaciones` (con usuario); id no numérico → 400, no existe → 404.
- (Opcional, no incluido salvo petición) `GET /api/activos/opciones` → tipos/sucursales distintos.

## 2. Archivos nuevos
- `src/models/comun.model.ts` — `MetadatosPaginacion`, `RespuestaPaginada<T>`, `UsuarioResumen`.
- `src/models/activo.model.ts` — `ActivoResumen`, `ActivoDetalle`, `AsignacionResumen`, `ParametrosListadoActivos`, `OpcionesInventario`.
- `src/utils/validacion.ts` — `comoTexto`, `comoEntero`, `validarOpcion` (con `HttpError`). **No** refactorizar `incidencia.controller.ts` (fuera de alcance).
- `src/services/activo.service.ts` — `listar()` (`findMany` + `count` en `Promise.all`, include responsable) y `obtenerPorId()`.
- `src/controllers/activo.controller.ts` — `asyncHandler`, valida query.
- `src/routes/activo.routes.ts` — `GET /`, `GET /:id`.
- `src/scripts/importarInventario.ts` — script npm `import:inventario` (`ts-node --transpile-only`).

**No tocar**: `incidencia.*`, `auth.*`, `comun` recién creado. Editar solo `src/app.ts` (montar `/api/activos`) y `package.json` (script).

## 3. Import (ExcelJS, ya es dependencia)
Ruta: `process.env.EXCEL_RUTA ?? '/home/erikg/Estadias/EXCEL DE IT/BD-TECNOLOGIA.xlsx'`.

1. **Usuarios (63)** `Tabla_Usuarios`: `id = ID_Usuario || EXT-###`, `nombre`, `email = Email Principal || null`, `activo = (Activo !== 'NO')`, `fechaInicio/fechaFin`. Upsert (pisa A006 y A003 de prueba).
   - Catálogos con upsert por `nombre`: `Departamento` ← col Departamento, `Ubicacion` ← Ubicación, `TipoUsuario` ← Tipo Usuario, **`Puesto` ← col Rol** (los valores son cargos: GERENTE DE TI, etc.). **`Rol` (RBAC) queda vacío**.
2. **Activos unificados**:
   - Bloque AF: filas con `CLAVE AF` empezando por `AF` (103). → `claveActivo = AF000xx`, `cb23 = CB23`.
   - Bloque CODIGO: fila de cabecera con `CODIGO`, filas siguientes con valor (117). → `claveActivo = null`, `cb23 = CODIGO`, `sucursal = Ciudad`.
   - Campos comunes: tipo, marca, modelo, numeroParte, numeroSerie, anydesk, nombreRed, procesador, memoria; `notas` ← Notas / Comentario+Descripción.
   - `estado = EN_USO`; texto original (`BIEN`/`NI`/`REGULAR`…) → `estadoGeneral`. Se descartan `Área` e `ID Microsoft` (no existen en el modelo).
   - **Dedupe**: por serie normalizada (serie basura `NI/NA/Ni` se trata como vacía) y por código `CODIGO` ↔ `CB23`; si colisiona, fusiona (AF manda clave/cb23; CODIGO aporta responsable/ciudad). Esperado ≈215.
3. **Responsable**: match por tokens del nombre normalizado (quitar acentos/mayúsculas, ignorar tokens de 1 letra) contra `Tabla_Usuarios`; 1 candidato → asigna; varios/ninguno → `null`. Etiquetas (`DISPONIBLE`, `DAÑADO`, `EXTRAVIADO`, `NI`, `NA`, `AREA`, emails, `FACTURACION...`) → `null`. Reporte final en consola.
4. **Asignaciones**: solo filas del bloque 1 con `Nombre`+`Serie` cuya serie exista en activos (≈1: ERNESTO M LOPEZ + CXBF1Z3 → AF00010).
5. **Idempotente**: `deleteMany` de `AsignacionComputo` y `Activo` antes de insertar (hoy vacíos); usuarios con upsert. Usuarios sin `ID_Usuario` → `EXT-###`.

## 4. Verificación
1. `npx tsc --noEmit`.
2. `npm run import:inventario` (2ª corrida → mismos conteos).
3. `npx prisma generate` si `tsc` no ve campos nuevos.
4. curl: listado general, `?tipo=Laptop`, `?sucursal=CANCUN`, `?q=CXBF1Z3`, `?estado=EN_USO`, `page=99` (data vacía), `/:id` existente, `/:id` inexistente → 404, `/:abc` → 400.
5. Regresión: `GET /api/incidencias`, `POST /api/auth/login`, `GET /api/auth/me`.
6. Conteos vs Excel: activos ≈215, usuarios 63, asignaciones 1.

## 5. Fuera de alcance
Bitlocker (cifrado AES), contraseñas de otras hojas, catálogo `Rol`/RBAC, endpoint `/opciones`.
