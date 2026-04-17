# BatallaProject Smoke Tests

Sistema de pruebas de integración que ataca el backend en vivo (`http://localhost:3000`) usando la cuenta real `Javier/123456` contra la base de datos de desarrollo (`bp`).

## Requisitos

- Backend corriendo en dev: `cd ../backend && npm run dev`
- Usuario `Javier` con contraseña `123456` y todos los roles (Master, Administrador, Control de Estudios, Profesor, Representante, Alumno) existente en la DB

## Instalación

```bash
cd tests
npm install
cp .env.example .env
```

Edita `.env` si tu backend corre en otra URL o con otras credenciales.

## Uso

### Windows/PowerShell (recomendado)

```powershell
# Ejecutar todo (wrapper con credenciales preconfiguradas)
.\test.ps1

# O manualmente con variables de entorno
$env:USERNAME="Javier"; $env:PASSWORD="123456"; npm test
```

### macOS/Linux/WSL

```bash
# Ejecutar todo
USERNAME=Javier PASSWORD=123456 npm test

# Solo pruebas por módulo
USERNAME=Javier PASSWORD=123456 npm run test:modules

# Solo flujos end-to-end
USERNAME=Javier PASSWORD=123456 npm run test:flows

# Filtrar por nombre de suite
USERNAME=Javier PASSWORD=123456 npm test -- auth
USERNAME=Javier PASSWORD=123456 npm test -- evaluation

# Exportar reporte JSON
USERNAME=Javier PASSWORD=123456 npm run test:json
```

## Estructura

- `lib/` — runner, cliente HTTP con sesión, assertions, factorías.
- `modules/` — una suite por dominio (auth, users, academic, inscriptions, etc.).
- `flows/` — flujos end-to-end que atraviesan varios módulos.
- `runner.ts` — orquestador principal.

## Notas

- Todos los datos creados llevan prefijo `TEST_<timestamp>_` para identificarlos.
- Al final de cada suite se intenta cleanup best-effort (si falla, no aborta).
- Los tests funcionan como **contrato vivo**: si un test falla, suele ser un bug real del backend.
- Exit code `0` si todo pasa, `1` si hubo algún fallo.
