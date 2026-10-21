-- CreateTable
CREATE TABLE `ProyectoMiembro` (
    `proyectoId` INTEGER NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `rol` ENUM('LIDER', 'DESARROLLADOR', 'QA', 'STAKEHOLDER') NOT NULL DEFAULT 'DESARROLLADOR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProyectoMiembro_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`proyectoId`, `usuarioId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProyectoMiembro` ADD CONSTRAINT `ProyectoMiembro_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoMiembro` ADD CONSTRAINT `ProyectoMiembro_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
