# Informe de pruebas – Plataforma Licorería

> Plantilla. Complétala al terminar la [guía de pruebas](guia-de-pruebas.md) y borra esta nota.

| Dato | Valor |
|---|---|
| Fase | ICONIX 4 – Implementación (pruebas) |
| Fecha de ejecución | |
| Ejecutado por | |
| Commit probado | `git rev-parse --short HEAD` → |
| Entorno | Docker Desktop, Windows 11; Supabase, MongoDB Atlas, DynamoDB local; n8n; Ollama `qwen2.5:3b` |

## 1. Resumen

Conclusión en 2 o 3 oraciones: ¿el sistema cumple los requisitos?, ¿qué queda pendiente?

| Parte | Casos | OK | OBS | FALLA | BLOQUEADO |
|---|---|---|---|---|---|
| A. Unitarias | 11 | | | | |
| B. Humo | 4 | | | | |
| C. Funcionales | 79 | | | | |
| D. Seguridad | 9 | | | | |
| E. Resiliencia | 10 | | | | |
| G. Documentación | 8 | | | | |
| H. Instalación | 4 | | | | |
| **Total** | **125** | | | | |

## 2. Pruebas unitarias

| Proyecto | Tecnología | Pruebas | Pasaron | Fallaron | Cobertura de líneas |
|---|---|---|---|---|---|
| ms-ventas | JUnit | | | | |
| ms-inventario | PHPUnit | | | | no medida |
| ms-gestion | Vitest (+ e2e) | | | | |
| ms-ia | pytest | | | | no medida |
| web-shell | Vitest | | | | no medida |
| mfe-gestion | Vitest | | | | no medida |
| mfe-pos | Vitest | | | | no medida |
| app-movil | flutter test | | | | no medida |

## 3. Pruebas funcionales por caso de uso

| CU | Caso de uso | Casos | OK | Falla | Resultado |
|---|---|---|---|---|---|
| CU01 | Iniciar sesión | 9 | | | |
| CU02 | Registrar venta | 9 | | | |
| CU03 | Vender offline y sincronizar | 12 | | | |
| CU04 | Reconocer producto | 11 | | | |
| CU05 | Gestionar proveedores | 8 | | | |
| CU06 | Reabastecer stock | 16 | | | |
| CU07 | Generar y exportar reporte | 14 | | | |

## 4. Cumplimiento de requisitos

Copia aquí la matriz de la parte F con la columna *Cumple* llena (Sí, Parcial o No, con el motivo).

## 5. Defectos

| Severidad | Encontrados | Corregidos y verificados | Abiertos |
|---|---|---|---|
| Crítico | | | |
| Alto | | | |
| Medio | | | |
| Bajo | | | |

Detalle: [registro de defectos](registro-de-defectos.md). Lista aquí los abiertos y por qué se aceptan.

## 6. Limitaciones conocidas

- Qué no se probó y por qué.
- Clasificador de visión: qué versión se probó, cómo se entrenó y su resultado con fotos reales.
- No se probó el análisis de video, por decisión del equipo; tampoco se hicieron pruebas de carga.

## 7. Evidencia

Las capturas y salidas están en `docs/pruebas/evidencias/`, nombradas con el ID de cada caso. Incluye en el documento APA al menos: venta completada, rollback con la saga `COMPENSADA`, idempotencia, sincronización offline, reconocimiento sin red, correo con la orden de compra, reporte con PDF y control de acceso.

## 8. Conclusión

¿Se cumple el criterio de salida (ningún defecto crítico o alto abierto)? Recomendación para la defensa.
