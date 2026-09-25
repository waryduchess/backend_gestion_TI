-- Configuración inicial MySQL 8.0
CREATE DATABASE IF NOT EXISTS `ti_management_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ti_management_db`;

-- Tabla: Department
CREATE TABLE `Department` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `Department_name_key`(`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: Role
CREATE TABLE `Role` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `Role_name_key`(`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: User
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `departmentId` INT NULL,
    `roleId` INT NULL,
    `location` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_departmentId_fkey`(`departmentId`),
    INDEX `User_roleId_fkey`(`roleId`),
    CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: Asset (Equipos e Inventario)
CREATE TABLE `Asset` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `processor` VARCHAR(191) NULL,
    `memory` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `assignedUserId` VARCHAR(191) NULL,
    PRIMARY KEY (`id`),
    INDEX `Asset_assignedUserId_fkey`(`assignedUserId`),
    CONSTRAINT `Asset_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: Incident (Tickets generados desde PowerAutomate/Node)
CREATE TABLE `Incident` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `reportedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolutionDate` DATETIME(3) NULL,
    `status` ENUM('NUEVO', 'EN_ANALISIS', 'EN_CURSO', 'COMPLETADO', 'DUPLICADO') NOT NULL DEFAULT 'NUEVO',
    `requestType` VARCHAR(191) NULL,
    `priority` ENUM('BAJA', 'NORMAL', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'NORMAL',
    `evidenceUrl` VARCHAR(191) NULL,
    `applicantId` VARCHAR(191) NULL,
    `assignedToId` VARCHAR(191) NULL,
    `departmentId` INT NULL,
    PRIMARY KEY (`id`),
    INDEX `Incident_applicantId_fkey`(`applicantId`),
    INDEX `Incident_assignedToId_fkey`(`assignedToId`),
    INDEX `Incident_departmentId_fkey`(`departmentId`),
    CONSTRAINT `Incident_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Incident_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Incident_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: IncidentUpdate (Bitácora de actualizaciones)
CREATE TABLE `IncidentUpdate` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `incidentId` INT NOT NULL,
    `updateText` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `IncidentUpdate_incidentId_fkey`(`incidentId`),
    CONSTRAINT `IncidentUpdate_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `Incident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: Secret (Gestión de Credenciales)
CREATE TABLE `Secret` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NULL,
    `project` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `password` TEXT NOT NULL,
    `comments` TEXT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla: License (Control de software y alertas de vencimiento)
CREATE TABLE `License` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `softwareName` VARCHAR(191) NOT NULL,
    `licenseKey` TEXT NULL,
    `provider` VARCHAR(191) NULL,
    `purchaseDate` DATETIME(3) NULL,
    `expirationDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `assignedToId` VARCHAR(191) NULL,
    PRIMARY KEY (`id`),
    INDEX `License_assignedToId_fkey`(`assignedToId`),
    CONSTRAINT `License_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;