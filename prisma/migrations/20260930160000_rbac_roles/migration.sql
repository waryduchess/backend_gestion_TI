-- AlterTable
ALTER TABLE `Rol`
    ADD COLUMN `permisos` JSON NULL,
    ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- Existing roles start with no permissions and must be granted access explicitly.
UPDATE `Rol`
SET `permisos` = JSON_ARRAY()
WHERE `permisos` IS NULL;

-- AlterTable
ALTER TABLE `Rol`
    MODIFY `permisos` JSON NOT NULL;
