# Instrucciones de Despliegue en Netcup (BatallaProject)

Esta carpeta `build/` contiene la aplicación completa compilada (Backend en JS + Frontend React embebido en `/public`).

## Pasos para hospedar en Netcup:

1. **Subir archivos a Netcup**:
   Copia el contenido completo de esta carpeta `build/` a tu servidor en Netcup (vía FTP/SFTP o git).

2. **Instalar dependencias de producción**:
   En el terminal de Netcup (SSH o consola cPanel/Node App):
   ```bash
   npm install --omit=dev
   ```

3. **Configurar variables de entorno**:
   Copia `.env.example` a `.env` y configura tus credenciales de MySQL y clave de sesión:
   ```bash
   cp .env.example .env
   ```

4. **Iniciar la aplicación**:
   ```bash
   npm start
   ```
   O mediante un administrador de procesos como PM2:
   ```bash
   pm2 start server.js --name "batalla-project"
   ```
