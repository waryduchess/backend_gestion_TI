-- AlterTable
ALTER TABLE `Adjunto` MODIFY `entidadTipo` ENUM('ACTIVO', 'MANTENIMIENTO', 'INCIDENCIA', 'PROYECTO') NOT NULL;

-- CreateTable
CREATE TABLE `Proyecto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(200) NOT NULL,
    `descripcion` TEXT NULL,
    `estado` ENUM('PLANIFICADO', 'EN_PROGRESO', 'PAUSADO', 'COMPLETADO', 'CANCELADO') NOT NULL DEFAULT 'PLANIFICADO',
    `prioridad` ENUM('BAJA', 'NORMAL', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'NORMAL',
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFinPlanificada` DATETIME(3) NOT NULL,
    `fechaFinReal` DATETIME(3) NULL,
    `responsableId` VARCHAR(191) NOT NULL,
    `departamentoId` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Proyecto_codigo_key`(`codigo`),
    INDEX `Proyecto_estado_fechaFinPlanificada_idx`(`estado`, `fechaFinPlanificada`),
    INDEX `Proyecto_responsableId_idx`(`responsableId`),
    INDEX `Proyecto_departamentoId_idx`(`departamentoId`),
    INDEX `Proyecto_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Proyecto` ADD CONSTRAINT `Proyecto_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Proyecto` ADD CONSTRAINT `Proyecto_departamentoId_fkey` FOREIGN KEY (`departamentoId`) REFERENCES `Departamento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
