import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist', 'capacitor');

async function ensurePublicDir() {
  const publicStats = await stat(publicDir).catch(() => null);
  if (!publicStats?.isDirectory()) {
    throw new Error(`Expected static site assets in ${publicDir}`);
  }
}

async function buildNativeBundle() {
  await ensurePublicDir();
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });
}

buildNativeBundle().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
