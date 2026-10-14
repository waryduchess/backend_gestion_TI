-- AlterTable
ALTER TABLE `Incidencia` ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0;

-- Backfill: ordenar cada estado por fechaNotificacion DESC, id DESC como en el listado vigente
UPDATE `Incidencia` AS `i`
JOIN (
  SELECT
    `id`,
    (ROW_NUMBER() OVER (PARTITION BY `estado` ORDER BY `fechaNotificacion` DESC, `id` DESC) - 1) AS `rn`
  FROM `Incidencia`
) AS `t` ON `t`.`id` = `i`.`id`
SET `i`.`orden` = `t`.`rn`;

-- CreateIndex
CREATE INDEX `Incidencia_estado_orden_idx` ON `Incidencia`(`estado`, `orden`);
