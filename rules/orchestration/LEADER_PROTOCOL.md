# 🎯 Protocolo del Agente Líder

> Este protocolo define cómo un agente de IA actúa como "líder" al descomponer features grandes en subtareas ejecutables.

---

## Cuándo usar este protocolo

Cuando el usuario solicita una **feature compleja** que involucra:
- Cambios en más de 3 archivos
- Cambios en backend + frontend
- Lógica de negocio nueva que afecta flujos existentes
- Cualquier tarea que requiera más de 1 sesión de chat

## Flujo del líder

```
1. ANALIZAR   → Entender el requisito completo
2. DESCOMPONER → Dividir en subtareas atómicas
3. SECUENCIAR  → Ordenar por dependencias
4. DELEGAR     → Escribir cada subtarea en tasks/
5. EJECUTAR    → Completar subtareas una a una
6. VERIFICAR   → Correr verify.ps1 al terminar cada subtarea
7. REPORTAR    → Actualizar progress/ al completar
```

## Paso 1: Analizar

Antes de escribir código, el líder debe:
1. Leer `rules/RULES.md` (Reglas de Oro).
2. Leer `rules/BUSINESS_MODEL.md` si el feature toca lógica de negocio.
3. Identificar qué archivos existentes se ven afectados.
4. Verificar si algún archivo afectado es **crítico** (ver sección amarilla en RULES.md).

## Paso 2: Descomponer

Dividir la feature en subtareas que cumplan:
- **Atómicas**: Cada subtarea es completable en una acción.
- **Independientes**: En lo posible, cada subtarea puede ejecutarse sin las otras.
- **Verificables**: Cada subtarea tiene un criterio claro de éxito.
- **Ordenadas**: Las dependencias están claras.

## Paso 3: Escribir subtareas

Usar el template de `DELEGATION_TEMPLATE.md` para cada subtarea.
Guardar en `rules/tasks/backlog.json` como entrada, o crear archivos separados en `rules/tasks/`.

## Paso 4: Ejecutar

Para cada subtarea:
1. Actualizar `rules/tasks/active_task.json` con la subtarea actual.
2. Si toca archivos críticos → Safety Commit primero.
3. Implementar el cambio.
4. Correr `rules/verify.ps1`.
5. Marcar como completada en `rules/progress/current_sprint.md`.

## Paso 5: Reportar

Al completar todas las subtareas:
1. Mover las tareas a `rules/progress/completed.md`.
2. Actualizar `rules/tasks/active_task.json` (limpiar).
3. Ejecutar el checklist `rules/checklists/pre-delivery.md`.
4. Informar al usuario con resumen de cambios.

---

## Reglas del líder

1. **Nunca modificar más de un archivo crítico por subtarea**.
2. **Siempre hacer Safety Commit antes de tocar archivos críticos**.
3. **Si una subtarea falla los gates, corregir antes de continuar**.
4. **Si hay contradicción con Reglas de Oro, detener y preguntar al usuario**.
5. **Documentar decisiones de diseño en el log de progreso**.
