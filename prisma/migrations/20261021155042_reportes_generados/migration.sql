-- CreateTable
CREATE TABLE `ReporteGenerado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(100) NOT NULL,
    `formato` VARCHAR(10) NOT NULL,
    `parametros` JSON NULL,
    `estado` ENUM('PENDIENTE', 'GENERANDO', 'COMPLETADO', 'FALLIDO') NOT NULL DEFAULT 'PENDIENTE',
    `s3Bucket` VARCHAR(191) NULL,
    `s3Key` VARCHAR(512) NULL,
    `nombreArchivo` VARCHAR(255) NULL,
    `tamano` INTEGER NULL,
    `error` TEXT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `iniciadoEn` DATETIME(3) NULL,
    `terminadoEn` DATETIME(3) NULL,

    INDEX `ReporteGenerado_usuarioId_creadoEn_idx`(`usuarioId`, `creadoEn`),
    INDEX `ReporteGenerado_estado_creadoEn_idx`(`estado`, `creadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReporteGenerado` ADD CONSTRAINT `ReporteGenerado_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
