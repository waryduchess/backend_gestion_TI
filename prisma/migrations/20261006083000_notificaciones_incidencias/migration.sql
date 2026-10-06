CREATE TABLE `Notificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` VARCHAR(191) NOT NULL,
    `incidenciaId` INTEGER NOT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leidaEn` DATETIME(3) NULL,

    UNIQUE INDEX `Notificacion_usuarioId_incidenciaId_key` (`usuarioId`, `incidenciaId`),
    INDEX `Notificacion_usuarioId_leidaEn_creadaEn_idx` (`usuarioId`, `leidaEn`, `creadaEn`),
    INDEX `Notificacion_incidenciaId_idx` (`incidenciaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Notificacion`
    ADD CONSTRAINT `Notificacion_usuarioId_fkey`
    FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Notificacion`
    ADD CONSTRAINT `Notificacion_incidenciaId_fkey`
    FOREIGN KEY (`incidenciaId`) REFERENCES `Incidencia`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
