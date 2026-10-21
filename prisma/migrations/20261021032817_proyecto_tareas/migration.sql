-- CreateTable
CREATE TABLE `ProyectoTarea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `descripcion` TEXT NULL,
    `estado` ENUM('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `prioridad` ENUM('BAJA', 'NORMAL', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'NORMAL',
    `asignadoAId` VARCHAR(191) NULL,
    `fechaInicio` DATETIME(3) NULL,
    `fechaVencimiento` DATETIME(3) NULL,
    `fechaCompletada` DATETIME(3) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProyectoTarea_proyectoId_activo_orden_idx`(`proyectoId`, `activo`, `orden`),
    INDEX `ProyectoTarea_parentId_idx`(`parentId`),
    INDEX `ProyectoTarea_asignadoAId_idx`(`asignadoAId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProyectoTarea` ADD CONSTRAINT `ProyectoTarea_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoTarea` ADD CONSTRAINT `ProyectoTarea_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProyectoTarea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoTarea` ADD CONSTRAINT `ProyectoTarea_asignadoAId_fkey` FOREIGN KEY (`asignadoAId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
