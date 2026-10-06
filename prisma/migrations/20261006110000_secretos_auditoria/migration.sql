ALTER TABLE `Secreto`
    ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `AuditoriaSecreto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `secretoId` INTEGER NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `accion` ENUM('CREAR', 'ACTUALIZAR', 'DESACTIVAR', 'REVELAR') NOT NULL,
    `campos` JSON NULL,
    `realizadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditoriaSecreto_secretoId_realizadaEn_idx` (`secretoId`, `realizadaEn`),
    INDEX `AuditoriaSecreto_usuarioId_realizadaEn_idx` (`usuarioId`, `realizadaEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditoriaSecreto`
    ADD CONSTRAINT `AuditoriaSecreto_secretoId_fkey`
    FOREIGN KEY (`secretoId`) REFERENCES `Secreto`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AuditoriaSecreto`
    ADD CONSTRAINT `AuditoriaSecreto_usuarioId_fkey`
    FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
