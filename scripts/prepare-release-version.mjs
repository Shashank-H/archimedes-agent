#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2] ?? process.env.ARCHIMEDES_RELEASE_VERSION;

if (!version) {
  console.error('Missing release version. Pass it as the first argument or ARCHIMEDES_RELEASE_VERSION.');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid release version: ${version}`);
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');
const write = (relativePath, content) => writeFileSync(path.join(repoRoot, relativePath), content);

const updateJsonVersion = (relativePath, updater) => {
  const current = JSON.parse(read(relativePath));
  updater(current);
  write(relativePath, `${JSON.stringify(current, null, 2)}\n`);
};

updateJsonVersion('package.json', (pkg) => {
  pkg.version = version;
});

updateJsonVersion('package-lock.json', (pkgLock) => {
  pkgLock.version = version;
  if (pkgLock.packages?.['']) {
    pkgLock.packages[''].version = version;
  }
});

updateJsonVersion('src-tauri/tauri.conf.json', (tauriConfig) => {
  tauriConfig.version = version;
});

const replaceVersion = (content, pattern, relativePath) => {
  const match = content.match(pattern);

  if (!match) {
    console.error(`Failed to update version in ${relativePath}`);
    process.exit(1);
  }

  if (match[2] === version) {
    return content;
  }

  return content.replace(pattern, `$1${version}$3`);
};

const cargoToml = read('src-tauri/Cargo.toml');
write(
  'src-tauri/Cargo.toml',
  replaceVersion(
    cargoToml,
    /(\[package\][\s\S]*?\r?\nversion = ")(.*?)(")/,
    'src-tauri/Cargo.toml',
  ),
);

const cargoLock = read('src-tauri/Cargo.lock');
write(
  'src-tauri/Cargo.lock',
  replaceVersion(
    cargoLock,
    /(\[\[package\]\]\r?\nname = "archimedes-agent"\r?\nversion = ")(.*?)(")/,
    'src-tauri/Cargo.lock',
  ),
);

console.log(`Prepared Archimedes Agent release version ${version}`);
