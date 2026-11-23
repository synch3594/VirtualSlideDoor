import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const branch = process.env.GH_PAGES_BRANCH || 'gh-pages';

function run(cmd, args, options = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...options });
}

function runCapture(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...options }).trim();
}

const remoteUrl = runCapture('git', ['remote', 'get-url', 'origin'], { cwd: rootDir });

// Derive repository name from origin URL for Vite base path unless overridden
const repoMatch = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
const basePath = process.env.VITE_BASE_PATH || (repoMatch ? `/${repoMatch[1]}/` : '/');

console.log(`Building with VITE_BASE_PATH=${basePath} ...`);
run('npm', ['run', 'build'], {
  cwd: rootDir,
  env: { ...process.env, VITE_BASE_PATH: basePath },
});

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-deploy-'));

try {
  fs.cpSync(distDir, tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.nojekyll'), '');

  const userName = (() => {
    try {
      return runCapture('git', ['config', 'user.name'], { cwd: rootDir });
    } catch {
      return 'github-pages-deploy';
    }
  })();
  const userEmail = (() => {
    try {
      return runCapture('git', ['config', 'user.email'], { cwd: rootDir });
    } catch {
      return 'deploy@users.noreply.github.com';
    }
  })();

  run('git', ['init', '-b', branch], { cwd: tmpDir });
  run('git', ['config', 'user.name', userName], { cwd: tmpDir });
  run('git', ['config', 'user.email', userEmail], { cwd: tmpDir });
  run('git', ['add', '--all'], { cwd: tmpDir });
  run('git', ['commit', '-m', 'Deploy to GitHub Pages'], { cwd: tmpDir });

  console.log(`Pushing dist/ to origin/${branch} ...`);
  run('git', ['push', '--force', remoteUrl, `HEAD:refs/heads/${branch}`], { cwd: tmpDir });
  console.log(`Done! Deployed to branch "${branch}".`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
