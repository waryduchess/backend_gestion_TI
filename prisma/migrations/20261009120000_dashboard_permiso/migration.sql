UPDATE `Rol`
SET `permisos` = JSON_ARRAY_APPEND(`permisos`, '$', 'dashboard:leer')
WHERE JSON_CONTAINS(`permisos`, JSON_QUOTE('activos:leer'))
  AND NOT JSON_CONTAINS(`permisos`, JSON_QUOTE('dashboard:leer'));
