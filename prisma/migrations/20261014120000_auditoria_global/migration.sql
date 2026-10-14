CREATE TABLE `Auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `modulo` VARCHAR(50) NOT NULL,
    `accion` VARCHAR(50) NOT NULL,
    `entidadId` VARCHAR(191) NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `detalle` JSON NULL,
    `realizadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Auditoria_modulo_realizadaEn_idx` (`modulo`, `realizadaEn`),
    INDEX `Auditoria_usuarioId_realizadaEn_idx` (`usuarioId`, `realizadaEn`),
    INDEX `Auditoria_entidadId_idx` (`entidadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Auditoria`
    ADD CONSTRAINT `Auditoria_usuarioId_fkey`
    FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Rol`
SET `permisos` = JSON_ARRAY_APPEND(`permisos`, '$', 'auditoria:leer')
WHERE JSON_CONTAINS(`permisos`, JSON_QUOTE('secretos:administrar'))
  AND NOT JSON_CONTAINS(`permisos`, JSON_QUOTE('auditoria:leer'));
