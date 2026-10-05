ALTER TABLE `Licencia`
    ADD COLUMN `ultimaAlertaVencimiento` DATETIME(3) NULL;

CREATE INDEX `Licencia_activa_fechaVencimiento_idx`
    ON `Licencia` (`activa`, `fechaVencimiento`);

CREATE INDEX `Licencia_ultimaAlertaVencimiento_idx`
    ON `Licencia` (`ultimaAlertaVencimiento`);
