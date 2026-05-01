# ✅ Checklist: Pre-Delivery (antes de reportar tarea completada)

> El agente **DEBE** ejecutar este checklist antes de informar al usuario que una tarea está terminada.

## Validación técnica
- [ ] Ejecutar `.\rules\verify.ps1` y reportar resultados
- [ ] Todos los gates ejecutados (ninguno ignorado sin justificación)
- [ ] TypeCheck del backend sin errores nuevos
- [ ] TypeCheck del frontend sin errores nuevos
- [ ] Tests existentes siguen pasando (si alguno falla, reportar cuál y por qué)

## Integridad del sistema
- [ ] No se modificaron archivos críticos sin Safety Commit previo
- [ ] Si se tocó `models/index.ts`: las asociaciones son correctas y no rompen otras
- [ ] Si se tocó `App.tsx`: las rutas tienen `RequireAuth` con roles correctos
- [ ] Si se tocó `app.ts`: el orden de middlewares se mantuvo

## Cumplimiento de reglas
- [ ] Código y comentarios en **inglés**
- [ ] Textos de UI en **español**
- [ ] Roles comparados con nombres canónicos en español
- [ ] Si hay listas de materias: ordenadas por `PeriodGradeSubject.order`
- [ ] Si hay display de notas: usa `formatGrade()` con máximo 1 decimal
- [ ] Operaciones multi-tabla usan `sequelize.transaction()`
- [ ] Sin imports de bibliotecas UI alternativas a Ant Design

## Documentación
- [ ] Archivos `docs/*.md` actualizados si hubo cambios en API, modelos o flujos
- [ ] `AGENTS.md` actualizado si hubo cambios estructurales

## Reporte
- [ ] Actualizar `rules/progress/current_sprint.md` con el avance
- [ ] Si la tarea se completó 100%, moverla a `rules/progress/completed.md`
- [ ] Actualizar `rules/tasks/active_task.json` (limpiar o apuntar a la siguiente)

## Comunicación
- [ ] Informar al usuario:
  - Qué se hizo (resumen)
  - Qué archivos se modificaron
  - Resultado de los gates de verificación
  - Si quedó algo pendiente o hay riesgos
