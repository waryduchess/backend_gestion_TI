-- AlterTable
ALTER TABLE `ReporteGenerado` ADD COLUMN `reporteProgramadoId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ReporteProgramado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(100) NOT NULL,
    `formato` VARCHAR(10) NOT NULL,
    `parametros` JSON NULL,
    `cron` VARCHAR(100) NOT NULL,
    `destinatarios` JSON NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `usuarioId` VARCHAR(191) NOT NULL,
    `ultimaEjecucion` DATETIME(3) NULL,
    `ultimoEstado` VARCHAR(20) NULL,
    `ultimoError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReporteProgramado_usuarioId_createdAt_idx`(`usuarioId`, `createdAt`),
    INDEX `ReporteProgramado_activo_createdAt_idx`(`activo`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ReporteGenerado_reporteProgramadoId_idx` ON `ReporteGenerado`(`reporteProgramadoId`);

-- AddForeignKey
ALTER TABLE `ReporteGenerado` ADD CONSTRAINT `ReporteGenerado_reporteProgramadoId_fkey` FOREIGN KEY (`reporteProgramadoId`) REFERENCES `ReporteProgramado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteProgramado` ADD CONSTRAINT `ReporteProgramado_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
