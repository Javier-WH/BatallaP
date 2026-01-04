# Tests del Backend - BatallaProject

## ⚠️ **IMPORTANTE: Configuración de Base de Datos**

Los tests usan la **misma base de datos** que el desarrollo (`bp`).

### **Setup Inicial:**

1. **Detener el servidor de desarrollo:**
```bash
# Presiona Ctrl+C en la terminal donde corre npm run dev
```

2. **Ejecutar tests:**
```bash
npm test
```

### **⚠️ Advertencias:**
- **SIEMPRE detener el servidor de desarrollo antes de ejecutar tests**
- Los tests limpian automáticamente todas las tablas antes de cada test
- **Tus datos de desarrollo serán eliminados** al ejecutar los tests
- Recomendación: Ejecutar `npm run seed` después de los tests para restaurar datos

## 📋 Descripción

## 📋 Descripción

Suite completa de pruebas para todos los endpoints del backend del sistema de gestión escolar.

## 🚀 Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage
```

## 📁 Estructura de Tests

```
src/__tests__/
├── setup.ts                    # Configuración global de tests
├── helpers/
│   └── testData.ts            # Funciones helper para crear datos de prueba
└── endpoints/
    ├── auth.test.ts           # Tests de autenticación
    ├── user.test.ts           # Tests de usuarios
    ├── academic.test.ts       # Tests de gestión académica
    ├── inscription.test.ts    # Tests de inscripciones
    ├── periodClosure.test.ts  # Tests de cierre de periodo
    └── periodOutcome.test.ts  # Tests de resultados de periodo
```

## 🧪 Cobertura de Tests

### **Auth Endpoints** (`/api/auth`)
- ✅ POST `/login` - Login exitoso y fallido
- ✅ POST `/logout` - Logout
- ✅ GET `/me` - Usuario actual

### **User Endpoints** (`/api/users`)
- ✅ GET `/` - Listar usuarios
- ✅ GET `/:id` - Obtener usuario por ID
- ✅ POST `/` - Crear usuario
- ✅ PUT `/:id` - Actualizar usuario
- ✅ DELETE `/:id` - Eliminar usuario
- ✅ POST `/:userId/roles` - Asignar rol
- ✅ DELETE `/:userId/roles/:roleId` - Remover rol
- ✅ GET `/search` - Buscar usuarios

### **Academic Endpoints** (`/api/academic`)
- ✅ GET `/periods` - Listar periodos
- ✅ GET `/active` - Periodo activo
- ✅ POST `/periods` - Crear periodo
- ✅ GET `/grades` - Listar grados
- ✅ GET `/sections` - Listar secciones
- ✅ GET `/subjects` - Listar materias
- ✅ GET `/periods/:periodId/structure` - Estructura del periodo
- ✅ POST `/periods/:periodId/grades` - Asignar grado a periodo
- ✅ POST `/period-grades/:periodGradeId/sections` - Asignar sección
- ✅ POST `/period-grades/:periodGradeId/subjects` - Asignar materia

### **Inscription Endpoints** (`/api/inscriptions`)
- ✅ GET `/` - Listar inscripciones
- ✅ GET `/:id` - Obtener inscripción por ID
- ✅ POST `/` - Crear inscripción
- ✅ PUT `/:id` - Actualizar inscripción
- ✅ DELETE `/:id` - Eliminar inscripción
- ✅ POST `/:id/subjects` - Inscribir materia
- ✅ DELETE `/:inscriptionId/subjects/:subjectId` - Desinscribir materia

### **Period Closure Endpoints** (`/api/period-closure`)
- ✅ GET `/:periodId/status` - Estado del cierre
- ✅ GET `/:periodId/validate` - Validar requisitos de cierre
- ✅ GET `/:periodId/preview` - Vista previa de resultados
- ✅ POST `/:periodId/execute` - Ejecutar cierre

### **Period Outcome Endpoints** (`/api/periods`)
- ✅ GET `/:periodId/outcomes` - Resultados de estudiantes
- ✅ GET `/:periodId/pending-subjects` - Materias pendientes
- ✅ POST `/pending-subjects/:pendingSubjectId/resolve` - Resolver materia pendiente

## 🛠️ Funciones Helper

### `createTestUser(overrides)`
Crea un usuario de prueba con persona asociada.

```typescript
const { user, person } = await createTestUser({
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User'
});
```

### `createTestPeriod(overrides)`
Crea un periodo escolar de prueba.

```typescript
const period = await createTestPeriod({
  period: '2025-2026',
  startYear: 2025,
  endYear: 2026,
  isActive: true
});
```

### `createAcademicStructure()`
Crea una estructura académica completa (periodo, grado, sección, materia).

```typescript
const structure = await createAcademicStructure();
// Retorna: { period, grade, section, subject, periodGrade, periodGradeSection, periodGradeSubject }
```

### `createTestInscription(personId, periodId, gradeId, sectionId)`
Crea una inscripción de prueba.

```typescript
const inscription = await createTestInscription(
  person.id,
  period.id,
  grade.id,
  section.id
);
```

## 🔧 Configuración

### Jest Config (`jest.config.js`)
- **Preset**: ts-jest
- **Environment**: node
- **Timeout**: 30 segundos
- **Path Aliases**: Configurados para `@/`, `@config/`, `@controllers/`, etc.

### Setup (`setup.ts`)
- Inicializa la base de datos antes de todos los tests
- Limpia todas las tablas después de cada test
- Cierra la conexión después de todos los tests

## 📊 Estadísticas

- **Total de archivos de test**: 6
- **Total de casos de prueba**: ~80+
- **Endpoints cubiertos**: 40+
- **Cobertura esperada**: >80%

## ⚠️ Notas Importantes

1. **Base de Datos**: Los tests usan la misma base de datos configurada en `.env`. Se recomienda usar una base de datos de prueba separada.

2. **Limpieza**: Después de cada test, todas las tablas se limpian automáticamente.

3. **Sesiones**: Los tests de endpoints protegidos usan `supertest.agent()` para mantener sesiones.

4. **Timeout**: Algunos tests pueden tardar más debido a operaciones de base de datos. El timeout está configurado en 30 segundos.

## 🐛 Debugging

Para ejecutar un test específico:

```bash
# Ejecutar un archivo específico
npm test -- auth.test.ts

# Ejecutar un describe específico
npm test -- --testNamePattern="Auth Endpoints"

# Ejecutar un test específico
npm test -- --testNamePattern="should login successfully"
```

## 📝 Agregar Nuevos Tests

1. Crear archivo en `src/__tests__/endpoints/`
2. Importar helpers necesarios
3. Usar `describe` para agrupar tests por endpoint
4. Usar `beforeEach` para setup común
5. Escribir tests con `it` o `test`

Ejemplo:

```typescript
import request from 'supertest';
import app from '@/app';
import { createTestUser } from '../helpers/testData';

describe('My Endpoint', () => {
  let agent: request.SuperAgentTest;

  beforeEach(async () => {
    agent = request.agent(app);
    await createTestUser({ username: 'admin' });
    await agent.post('/api/auth/login').send({ 
      username: 'admin', 
      password: 'password123' 
    });
  });

  it('should do something', async () => {
    const response = await agent
      .get('/api/my-endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
```

## ✅ Checklist de Tests

Antes de hacer commit, asegúrate de:

- [ ] Todos los tests pasan
- [ ] Cobertura de código >80%
- [ ] No hay tests skipped sin razón
- [ ] Tests son independientes (no dependen del orden)
- [ ] Cleanup apropiado en afterEach/afterAll
