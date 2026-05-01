# 🏗️ Rules — Harness Engineering para BatallaProject

> **¿Qué es esto?** Este directorio es el **arnés (harness)** del proyecto: un sistema de protocolos, memoria externa y automatización diseñado para que cualquier agente de IA opere de forma inteligente, segura y consistente sobre este codebase.

## ¿Quién debe leer esto?

**Todo agente de IA** (Windsurf, Cursor, Copilot, Gemini, Claude, ChatGPT, etc.) que vaya a modificar código en BatallaProject **DEBE** leer estos archivos antes de actuar.

**Orden de lectura obligatorio para agentes:**

1. `RULES.md` — Reglas de Oro (qué NUNCA cambiar)
2. `BUSINESS_MODEL.md` — Cómo funciona el sistema escolar
3. `tasks/active_task.json` — Qué tarea está activa ahora
4. `progress/current_sprint.md` — Contexto del sprint actual
5. `checklists/pre-delivery.md` — Qué verificar antes de reportar completado

## Estructura

```
rules/
├── README.md                    ← Estás aquí
├── RULES.md                     ← Reglas de Oro (inviolables)
├── BUSINESS_MODEL.md            ← Modelo de negocio escolar completo
├── STATUS.md                    ← Estado funcional del proyecto
├── verify.ps1                   ← Script de verificación (Gates 0-3)
│
├── progress/                    ← Memoria externa (estado de tareas)
│   ├── current_sprint.md        ← Sprint/objetivo activo
│   ├── completed.md             ← Log de tareas completadas
│   └── archive/                 ← Logs históricos migrados
│
├── tasks/                       ← Backlog estructurado
│   ├── backlog.json             ← Tareas pendientes (JSON parseable)
│   └── active_task.json         ← Tarea actual con contexto
│
├── checklists/                  ← Checklists reutilizables
│   ├── new-endpoint.md          ← Crear un endpoint nuevo
│   ├── new-page.md              ← Crear una página nueva
│   ├── new-model.md             ← Crear un modelo Sequelize nuevo
│   └── pre-delivery.md          ← Antes de reportar tarea completada
│
└── orchestration/               ← Orquestación multi-agente
    ├── LEADER_PROTOCOL.md       ← Protocolo del agente líder
    └── DELEGATION_TEMPLATE.md   ← Template para delegar subtareas
```

## Principios del arnés

1. **Restricciones primero**: Las Reglas de Oro previenen que el agente rompa lo que funciona.
2. **Feedback loops**: El script `verify.ps1` permite autocorrección sin intervención humana.
3. **Quality gates**: Verificación obligatoria antes de dar cualquier tarea por hecha.
4. **Memoria persistente**: `progress/` y `tasks/` sobreviven entre sesiones de chat.
5. **Safety commits**: Antes de cambios bruscos, el agente hace commit de seguridad.

## Para humanos

Si eres un desarrollador humano, esta carpeta te sirve como:
- **Onboarding**: Lee `BUSINESS_MODEL.md` para entender el sistema rápido.
- **Checklists**: Usa los checklists para no olvidar pasos al crear features.
- **Estado**: Consulta `progress/` para saber qué se ha hecho y qué falta.
