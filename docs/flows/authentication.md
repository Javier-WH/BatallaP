# 🔐 Flujo: Autenticación y sesiones

## Stack

- **Backend**: `express-session` + `connect-session-sequelize` (store MySQL).
- **Frontend**: Axios con `withCredentials: true` + `AuthContext`.
- **Cookie**: `connect.sid`, `httpOnly: true`, `maxAge: 1 día`.

## Endpoints (`authRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | `{ username, password }` → crea sesión. |
| POST | `/api/auth/logout` | Destruye sesión. |
| GET | `/api/auth/me` | Devuelve usuario actual + roles. |
| POST | `/api/auth/register` | Registro público (protegerse o retirarse en producción). |

## Flujo de login

1. Usuario envía POST `/api/auth/login` desde `Login.tsx`.
2. `authController.login`:
   - Busca `User` por `username` (include `Person` → `roles`).
   - Valida password con bcrypt.
   - Serializa usuario + roles en `req.session.user`.
3. Cookie `connect.sid` viaja al cliente (SameSite/HttpOnly).
4. Frontend llama `GET /api/auth/me` al montar `AuthProvider` (o tras login) para hidratar `useAuth().user`.
5. `<RequireAuth>` decide la navegación:
   - Sin `user` → `/` (Login).
   - Con `user` pero rol no permitido → `/dashboard`.
   - OK → renderiza.

## Flujo de logout

1. POST `/api/auth/logout` → `req.session.destroy()`.
2. Frontend limpia su estado (`AuthContext`) y redirige a `/`.

## Configuración relevante

```
app.ts:
  app.use(session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,           // tabla `sessions`
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1 día, secure: false }
  }));
```

Para HTTPS en producción: `cookie.secure = true` y `cookie.sameSite = 'none'` si el frontend está en otro dominio.

## Helpers de acceso

- `req.session.user` → `{ id, username, roles: string[], personId }` (forma aproximada; verificar en `authController`).
- **No** existe middleware global de protección. Cada controller que requiera rol específico lo verifica manualmente.

## Renovación de sesión

- La sesión expira después de 24 h sin actividad.
- Cada request válida la renueva (behavior default de `express-session` con `rolling: false` pero `store.touch`).

## Errores comunes

| Síntoma | Causa probable |
|---------|----------------|
| `401` al llamar `/auth/me` | Cookie no se envía → falta `withCredentials: true` en axios. |
| CORS block | `CORS_ORIGIN` incorrecto o falta `credentials: true` en backend. |
| Sesión no persiste | Tabla `sessions` no creada → revisar `connectSessionSequelize` + `sessionStore.sync()`. |

## Seeds de usuarios de prueba

`backend/src/seed.ts` crea un usuario `Javier` con todos los roles para facilitar pruebas. Ver también `npm run seed`.
