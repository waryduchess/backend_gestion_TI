ALTER TABLE `Notificacion`
    MODIFY `incidenciaId` INTEGER NULL,
    ADD COLUMN `tipo` ENUM('INCIDENCIA_NUEVA', 'LICENCIA_POR_VENCER') NOT NULL DEFAULT 'INCIDENCIA_NUEVA',
    ADD COLUMN `licenciaId` INTEGER NULL,
    ADD COLUMN `hitoDias` INTEGER NULL,
    ADD UNIQUE INDEX `Notificacion_usuarioId_licenciaId_hitoDias_key` (`usuarioId`, `licenciaId`, `hitoDias`),
    ADD INDEX `Notificacion_licenciaId_idx` (`licenciaId`);

ALTER TABLE `Notificacion`
    ADD CONSTRAINT `Notificacion_licenciaId_fkey`
    FOREIGN KEY (`licenciaId`) REFERENCES `Licencia`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE `Rol`
SET `permisos` = JSON_ARRAY_APPEND(`permisos`, '$', 'notificaciones:leer')
WHERE JSON_CONTAINS(`permisos`, JSON_QUOTE('incidencias:leer'))
  AND NOT JSON_CONTAINS(`permisos`, JSON_QUOTE('notificaciones:leer'));
