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

const cargoToml = read('src-tauri/Cargo.toml');
const updatedCargoToml = cargoToml.replace(
  /(\[package\][\s\S]*?\nversion = ")(.*?)(")/,
  `$1${version}$3`,
);

if (updatedCargoToml === cargoToml) {
  console.error('Failed to update version in src-tauri/Cargo.toml');
  process.exit(1);
}

write('src-tauri/Cargo.toml', updatedCargoToml);

const cargoLock = read('src-tauri/Cargo.lock');
const updatedCargoLock = cargoLock.replace(
  /(\[\[package\]\]\nname = "archimedes-agent"\nversion = ")(.*?)(")/,
  `$1${version}$3`,
);

if (updatedCargoLock === cargoLock) {
  console.error('Failed to update version in src-tauri/Cargo.lock');
  process.exit(1);
}

write('src-tauri/Cargo.lock', updatedCargoLock);

console.log(`Prepared Archimedes Agent release version ${version}`);
