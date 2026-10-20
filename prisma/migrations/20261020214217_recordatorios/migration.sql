-- CreateTable
CREATE TABLE `Recordatorio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(200) NOT NULL,
    `descripcion` TEXT NULL,
    `fecha` DATETIME(3) NULL,
    `prioridad` ENUM('BAJA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'MEDIA',
    `completado` BOOLEAN NOT NULL DEFAULT false,
    `completadoEn` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `usuarioId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Recordatorio_usuarioId_activo_completado_fecha_idx`(`usuarioId`, `activo`, `completado`, `fecha`),
    INDEX `Recordatorio_fecha_idx`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Recordatorio` ADD CONSTRAINT `Recordatorio_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
