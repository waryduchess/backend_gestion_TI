-- AlterTable
ALTER TABLE `OrdenMantenimiento` ADD COLUMN `estadoActivoPrevio` ENUM('EN_USO', 'EN_ALMACEN', 'EN_MANTENIMIENTO', 'DE_BAJA') NULL;
