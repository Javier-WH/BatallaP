const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const buildDir = path.join(rootDir, 'build');
const worktreeDir = path.join(os.tmpdir(), 'batalla-deploy-worktree');
const BRANCH = 'deploy';
const shouldPush = !process.argv.includes('--no-push');

function git(args, cwd = rootDir) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf-8' });
}

function gitOk(args, cwd = rootDir) {
  try {
    execSync(`git ${args}`, { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function emptyDirExceptGit(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function cleanupWorktree() {
  gitOk(`worktree remove "${worktreeDir}" --force`);
  if (fs.existsSync(worktreeDir)) {
    fs.rmSync(worktreeDir, { recursive: true, force: true });
  }
}

try {
  if (!fs.existsSync(buildDir)) {
    console.error('❌ No existe la carpeta build/. Corre primero: npm run build:prod');
    process.exit(1);
  }

  console.log('🚀 Actualizando rama deploy con el contenido de build/...\n');

  // Prune stale worktree registrations and leftovers from previous runs
  gitOk('worktree prune');
  cleanupWorktree();

  // Create the worktree on the deploy branch (local, remote-tracking, or orphan)
  console.log('📁 1/4 Creando worktree temporal...');
  if (gitOk(`rev-parse --verify ${BRANCH}`)) {
    git(`worktree add "${worktreeDir}" ${BRANCH}`);
  } else if (gitOk(`rev-parse --verify origin/${BRANCH}`)) {
    git(`worktree add "${worktreeDir}" -b ${BRANCH} origin/${BRANCH}`);
  } else {
    git(`worktree add "${worktreeDir}" --detach`);
    git('switch --orphan deploy', worktreeDir);
  }

  // Sync build/ contents into the worktree root
  console.log('📋 2/4 Sincronizando contenido de build/...');
  emptyDirExceptGit(worktreeDir);
  copyDirSync(buildDir, worktreeDir);

  // Stage everything (-f bypasses ignore rules like dist/),
  // but never commit .env — secrets live only on the server and
  // a committed .env would conflict with local edits on every pull.
  git('add -f -A .', worktreeDir);
  gitOk('reset -q .env', worktreeDir);
  const status = git('status --porcelain', worktreeDir).trim();

  if (!status) {
    console.log('\n✅ La rama deploy ya está al día — no hay cambios que commitear.');
    cleanupWorktree();
    process.exit(0);
  }

  // Commit
  console.log('💾 3/4 Creando commit...');
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const msg = `Production build ${stamp}\n\nGenerated with [Devin](https://devin.ai)\n\nCo-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>`;
  execSync('git commit -F -', { cwd: worktreeDir, input: msg, stdio: ['pipe', 'inherit', 'inherit'] });

  // Push
  if (shouldPush) {
    console.log('☁️  4/4 Pushing a origin/deploy...');
    try {
      execSync(`git push origin ${BRANCH}`, { cwd: worktreeDir, stdio: 'inherit' });
    } catch {
      console.warn('⚠️  El push falló. El commit quedó en la rama local; reintenta con: git push origin deploy');
    }
  } else {
    console.log('⏭️  4/4 Push omitido (--no-push). El commit quedó en la rama local.');
  }

  cleanupWorktree();
  console.log('\n✅ Rama deploy actualizada con el último build.');
} catch (error) {
  console.error('\n❌ Error actualizando la rama deploy:', error.message);
  cleanupWorktree();
  process.exit(1);
}
