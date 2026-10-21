-- CreateTable
CREATE TABLE `ProyectoTareaDependencia` (
    `tareaId` INTEGER NOT NULL,
    `dependeDeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProyectoTareaDependencia_dependeDeId_idx`(`dependeDeId`),
    PRIMARY KEY (`tareaId`, `dependeDeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProyectoTareaDependencia` ADD CONSTRAINT `ProyectoTareaDependencia_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `ProyectoTarea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoTareaDependencia` ADD CONSTRAINT `ProyectoTareaDependencia_dependeDeId_fkey` FOREIGN KEY (`dependeDeId`) REFERENCES `ProyectoTarea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
