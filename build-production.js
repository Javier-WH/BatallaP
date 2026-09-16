const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const buildDir = path.join(rootDir, 'build');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

console.log('🚀 Iniciando compilación completa para producción (Netcup)...');

// Helper for copying directories recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Step 1: Build Frontend
  console.log('\n📦 1/5 Compilando Frontend (React + Vite)...');
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

  // Step 2: Build Backend
  console.log('\n📦 2/5 Compilando Backend (TypeScript -> JavaScript)...');
  execSync('npm run build', { cwd: backendDir, stdio: 'inherit' });

  // Step 3: Clean and recreate build/ folder
  console.log('\n📁 3/5 Preparando directorio /build...');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // Step 4: Copy built files and assets
  console.log('\n📋 4/5 Copiando artefactos al directorio /build...');

  // Backend JS
  const backendDist = path.join(backendDir, 'dist');
  copyDirSync(backendDist, path.join(buildDir, 'dist'));

  // Frontend SPA to build/public
  const frontendDist = path.join(frontendDir, 'dist');
  copyDirSync(frontendDist, path.join(buildDir, 'public'));

  // Backend assets (venezuela.json, planteles.json)
  const backendAssets = path.join(backendDir, 'src', 'assets');
  if (fs.existsSync(backendAssets)) {
    copyDirSync(backendAssets, path.join(buildDir, 'assets'));
    copyDirSync(backendAssets, path.join(buildDir, 'src', 'assets'));
    copyDirSync(backendAssets, path.join(buildDir, 'dist', 'assets'));
  }

  // Templates
  const backendTemplates = path.join(backendDir, 'templates');
  if (fs.existsSync(backendTemplates)) {
    copyDirSync(backendTemplates, path.join(buildDir, 'templates'));
  }

  // Uploads structure
  const backendPublic = path.join(backendDir, 'public');
  if (fs.existsSync(backendPublic)) {
    copyDirSync(backendPublic, path.join(buildDir, 'public'));
  } else {
    fs.mkdirSync(path.join(buildDir, 'public', 'uploads', 'images'), { recursive: true });
    fs.mkdirSync(path.join(buildDir, 'public', 'uploads', 'documents'), { recursive: true });
    fs.mkdirSync(path.join(buildDir, 'public', 'uploads', 'dashboard-images'), { recursive: true });
  }

  // Step 5: Generate production package.json and server entrypoint
  console.log('\n⚙️ 5/5 Generando package.json de producción y archivos de configuración...');

  const backendPkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf-8'));
  
  const prodPkg = {
    name: "batalla-project-production",
    version: backendPkg.version || "1.0.0",
    description: "BatallaProject Fullstack Standalone Build for Netcup",
    main: "server.js",
    scripts: {
      "start": "node server.js",
      "start:dist": "node dist/server.js"
    },
    dependencies: backendPkg.dependencies || {}
  };

  fs.writeFileSync(
    path.join(buildDir, 'package.json'),
    JSON.stringify(prodPkg, null, 2),
    'utf-8'
  );

  // Create root server.js entrypoint inside build/
  const serverEntryContent = `// Production entry point for Netcup / Node hosting
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./dist/server.js');
`;
  fs.writeFileSync(path.join(buildDir, 'server.js'), serverEntryContent, 'utf-8');

  // Create .env.example
  const envExampleContent = `# Variables de Entorno para Producción (Netcup)
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://tu-dominio.com

# Configuración MySQL Netcup
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=usuario_db
DB_PASSWORD=contrasena_db
DB_NAME=nombre_db
DB_DIALECT=mysql

# Claves de Sesión
SESSION_SECRET=cambiar_por_una_clave_secreta_segura
`;
  fs.writeFileSync(path.join(buildDir, '.env.example'), envExampleContent, 'utf-8');

  // Create README inside build folder
  const buildReadmeContent = `# Instrucciones de Despliegue en Netcup (BatallaProject)

Esta carpeta \`build/\` contiene la aplicación completa compilada (Backend en JS + Frontend React embebido en \`/public\`).

## Pasos para hospedar en Netcup:

1. **Subir archivos a Netcup**:
   Copia el contenido completo de esta carpeta \`build/\` a tu servidor en Netcup (vía FTP/SFTP o git).

2. **Instalar dependencias de producción**:
   En el terminal de Netcup (SSH o consola cPanel/Node App):
   \`\`\`bash
   npm install --omit=dev
   \`\`\`

3. **Configurar variables de entorno**:
   Copia \`.env.example\` a \`.env\` y configura tus credenciales de MySQL y clave de sesión:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. **Iniciar la aplicación**:
   \`\`\`bash
   npm start
   \`\`\`
   O mediante un administrador de procesos como PM2:
   \`\`\`bash
   pm2 start server.js --name "batalla-project"
   \`\`\`
`;
  fs.writeFileSync(path.join(buildDir, 'README.md'), buildReadmeContent, 'utf-8');

  console.log('\n✅ ¡BUILD COMPLETO FINALIZADO CON ÉXITO!');
  console.log('📌 Todo el proyecto compilado y funcional se encuentra en la carpeta: ./build/\n');

} catch (error) {
  console.error('\n❌ Error durante el proceso de build:', error.message);
  process.exit(1);
}
