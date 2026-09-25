-- CreateTable
CREATE TABLE `Rol` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Rol_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Departamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Departamento_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ubicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Ubicacion_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Puesto_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TipoUsuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TipoUsuario_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `fechaInicio` DATETIME(3) NULL,
    `fechaFin` DATETIME(3) NULL,
    `departamentoId` INTEGER NULL,
    `ubicacionId` INTEGER NULL,
    `puestoId` INTEGER NULL,
    `tipoUsuarioId` INTEGER NULL,
    `rolId` INTEGER NULL,

    INDEX `Usuario_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Incidencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalId` INTEGER NULL,
    `titulo` VARCHAR(500) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `fechaNotificacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaResolucion` DATETIME(3) NULL,
    `estado` ENUM('NUEVO', 'EN_ANALISIS', 'EN_CURSO', 'COMPLETADO', 'DUPLICADO') NOT NULL DEFAULT 'NUEVO',
    `prioridad` ENUM('BAJA', 'NORMAL', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'NORMAL',
    `tipoRequerimiento` ENUM('NETSUITE', 'OTROS', 'OFFICE', 'EMAIL', 'IMPRESION', 'ERROR_EN_EQUIPO', 'SOLICITUD_DE_EQUIPO', 'INTRANET', 'CONEXION_DE_RED') NOT NULL,
    `evidenciaUrl` VARCHAR(500) NULL,
    `solicitanteId` VARCHAR(191) NOT NULL,
    `asignadoAId` VARCHAR(191) NULL,
    `departamentoId` INTEGER NULL,

    UNIQUE INDEX `Incidencia_originalId_key`(`originalId`),
    INDEX `Incidencia_estado_fechaNotificacion_idx`(`estado`, `fechaNotificacion`),
    INDEX `Incidencia_solicitanteId_idx`(`solicitanteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActualizacionIncidencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `incidenciaId` INTEGER NOT NULL,
    `texto` TEXT NOT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claveActivo` VARCHAR(191) NULL,
    `cb23` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `marca` VARCHAR(191) NULL,
    `modelo` VARCHAR(191) NULL,
    `numeroParte` VARCHAR(191) NULL,
    `numeroSerie` VARCHAR(191) NULL,
    `sucursal` VARCHAR(191) NULL,
    `anydesk` VARCHAR(191) NULL,
    `nombreRed` VARCHAR(191) NULL,
    `procesador` VARCHAR(191) NULL,
    `memoria` VARCHAR(191) NULL,
    `estado` ENUM('EN_USO', 'EN_ALMACEN', 'EN_MANTENIMIENTO', 'DE_BAJA') NOT NULL DEFAULT 'EN_USO',
    `estadoGeneral` VARCHAR(191) NULL,
    `notas` TEXT NULL,
    `responsableId` VARCHAR(191) NULL,

    UNIQUE INDEX `Activo_claveActivo_key`(`claveActivo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AsignacionComputo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` VARCHAR(191) NOT NULL,
    `activoId` INTEGER NOT NULL,
    `anioCompra` INTEGER NULL,
    `numeroActivo` VARCHAR(191) NULL,
    `nombreEquipo` VARCHAR(191) NULL,
    `bitlocker` VARCHAR(191) NULL,
    `observacion` TEXT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `fechaAsignacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaDevolucion` DATETIME(3) NULL,

    UNIQUE INDEX `AsignacionComputo_usuarioId_activoId_key`(`usuarioId`, `activoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Licencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `software` VARCHAR(191) NOT NULL,
    `clave` TEXT NULL,
    `proveedor` VARCHAR(191) NULL,
    `fechaCompra` DATETIME(3) NULL,
    `fechaVencimiento` DATETIME(3) NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `asignadaAId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Secreto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(191) NULL,
    `proyecto` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NULL,
    `usuario` VARCHAR(191) NULL,
    `password` TEXT NOT NULL,
    `comentario` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_departamentoId_fkey` FOREIGN KEY (`departamentoId`) REFERENCES `Departamento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_ubicacionId_fkey` FOREIGN KEY (`ubicacionId`) REFERENCES `Ubicacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_puestoId_fkey` FOREIGN KEY (`puestoId`) REFERENCES `Puesto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_tipoUsuarioId_fkey` FOREIGN KEY (`tipoUsuarioId`) REFERENCES `TipoUsuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_rolId_fkey` FOREIGN KEY (`rolId`) REFERENCES `Rol`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incidencia` ADD CONSTRAINT `Incidencia_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incidencia` ADD CONSTRAINT `Incidencia_asignadoAId_fkey` FOREIGN KEY (`asignadoAId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incidencia` ADD CONSTRAINT `Incidencia_departamentoId_fkey` FOREIGN KEY (`departamentoId`) REFERENCES `Departamento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActualizacionIncidencia` ADD CONSTRAINT `ActualizacionIncidencia_incidenciaId_fkey` FOREIGN KEY (`incidenciaId`) REFERENCES `Incidencia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activo` ADD CONSTRAINT `Activo_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AsignacionComputo` ADD CONSTRAINT `AsignacionComputo_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AsignacionComputo` ADD CONSTRAINT `AsignacionComputo_activoId_fkey` FOREIGN KEY (`activoId`) REFERENCES `Activo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Licencia` ADD CONSTRAINT `Licencia_asignadaAId_fkey` FOREIGN KEY (`asignadaAId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
