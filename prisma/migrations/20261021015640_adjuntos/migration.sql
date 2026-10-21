-- CreateTable
CREATE TABLE `Adjunto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entidadTipo` ENUM('ACTIVO', 'MANTENIMIENTO', 'INCIDENCIA') NOT NULL,
    `entidadId` VARCHAR(191) NOT NULL,
    `s3Bucket` VARCHAR(191) NOT NULL,
    `s3Key` VARCHAR(512) NOT NULL,
    `nombreOriginal` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(127) NOT NULL,
    `extension` VARCHAR(20) NOT NULL,
    `tamano` INTEGER NOT NULL,
    `subidoPorId` VARCHAR(191) NOT NULL,
    `subidoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Adjunto_s3Key_key`(`s3Key`),
    INDEX `Adjunto_entidadTipo_entidadId_subidoEn_idx`(`entidadTipo`, `entidadId`, `subidoEn`),
    INDEX `Adjunto_subidoPorId_idx`(`subidoPorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Adjunto` ADD CONSTRAINT `Adjunto_subidoPorId_fkey` FOREIGN KEY (`subidoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
