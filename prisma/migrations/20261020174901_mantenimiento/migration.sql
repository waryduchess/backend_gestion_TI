-- CreateTable
CREATE TABLE `OrdenMantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folio` VARCHAR(191) NOT NULL,
    `activoId` INTEGER NOT NULL,
    `tipo` ENUM('PREVENTIVO', 'CORRECTIVO') NOT NULL,
    `estado` ENUM('PROGRAMADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
    `prioridad` ENUM('BAJA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'MEDIA',
    `tecnicoId` VARCHAR(191) NOT NULL,
    `fechaProgramada` DATETIME(3) NOT NULL,
    `fechaRealizada` DATETIME(3) NULL,
    `costo` DECIMAL(10, 2) NULL,
    `descripcion` TEXT NULL,
    `evidencias` JSON NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrdenMantenimiento_folio_key`(`folio`),
    INDEX `OrdenMantenimiento_activoId_fechaProgramada_idx`(`activoId`, `fechaProgramada`),
    INDEX `OrdenMantenimiento_estado_idx`(`estado`),
    INDEX `OrdenMantenimiento_tecnicoId_idx`(`tecnicoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrdenMantenimiento` ADD CONSTRAINT `OrdenMantenimiento_activoId_fkey` FOREIGN KEY (`activoId`) REFERENCES `Activo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrdenMantenimiento` ADD CONSTRAINT `OrdenMantenimiento_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
