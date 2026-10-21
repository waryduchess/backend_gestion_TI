-- AlterTable
ALTER TABLE `Proyecto` ADD COLUMN `presupuesto` DECIMAL(12, 2) NULL;

-- CreateTable
CREATE TABLE `ProyectoRegistroHoras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoId` INTEGER NOT NULL,
    `tareaId` INTEGER NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `horas` DECIMAL(6, 2) NOT NULL,
    `descripcion` TEXT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProyectoRegistroHoras_proyectoId_activo_fecha_idx`(`proyectoId`, `activo`, `fecha`),
    INDEX `ProyectoRegistroHoras_tareaId_idx`(`tareaId`),
    INDEX `ProyectoRegistroHoras_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProyectoRegistroHoras` ADD CONSTRAINT `ProyectoRegistroHoras_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoRegistroHoras` ADD CONSTRAINT `ProyectoRegistroHoras_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `ProyectoTarea`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoRegistroHoras` ADD CONSTRAINT `ProyectoRegistroHoras_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
