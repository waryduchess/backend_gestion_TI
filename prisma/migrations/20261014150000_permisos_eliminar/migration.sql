UPDATE `Rol`
SET `permisos` = JSON_ARRAY_APPEND(`permisos`, '$', 'licencias:eliminar')
WHERE JSON_CONTAINS(`permisos`, JSON_QUOTE('licencias:administrar'))
  AND NOT JSON_CONTAINS(`permisos`, JSON_QUOTE('licencias:eliminar'));

UPDATE `Rol`
SET `permisos` = JSON_ARRAY_APPEND(`permisos`, '$', 'secretos:eliminar')
WHERE JSON_CONTAINS(`permisos`, JSON_QUOTE('secretos:administrar'))
  AND NOT JSON_CONTAINS(`permisos`, JSON_QUOTE('secretos:eliminar'));
