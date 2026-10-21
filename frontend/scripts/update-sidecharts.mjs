#!/usr/bin/env node
// Pulls the latest sidecharts library source into ./src/components/sidecharts.
// Run with: npm run update-sidecharts
//
// When the library moves to its own repo, edit CONFIG below.

import { execSync } from 'node:child_process';
import { rmSync, existsSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

// --- CONFIG -----------------------------------------------------------------
// Source repo (GitHub "owner/name")
const REPO    = 'OneTandem/ot-component-test';
// Branch, tag, or commit to pull
const BRANCH  = 'sidecharts';
// Subdirectory within the repo. Use '' to copy the whole repo.
const SUBPATH = 'sidecharts';
// Destination relative to project root
const DEST    = 'src/components/sidecharts';
//
// When sidecharts moves to its own repo, swap to something like:
//   REPO    = 'OneTandem/ot-sidecharts';
//   BRANCH  = 'main';
//   SUBPATH = '';
// ----------------------------------------------------------------------------

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destAbs     = resolve(projectRoot, DEST);
const sub         = SUBPATH && SUBPATH !== '.' ? `/${SUBPATH}` : '';
const source      = `${REPO}${sub}#${BRANCH}`;

console.log(`[update-sidecharts] source: ${source}`);
console.log(`[update-sidecharts] dest:   ${destAbs}`);

// Use git sparse-checkout for reliable SSH auth with private repos.
const tmpDir = mkdtempSync(resolve(tmpdir(), 'sidecharts-'));
console.log('[update-sidecharts] downloading…');
try {
  execSync(
    `git clone --filter=blob:none --sparse --branch "${BRANCH}" "git@github.com:${REPO}.git" "${tmpDir}"`,
    { stdio: 'inherit' }
  );
  if (SUBPATH) {
    execSync(`git -C "${tmpDir}" sparse-checkout set "${SUBPATH}"`, { stdio: 'inherit' });
  }
} catch (err) {
  rmSync(tmpDir, { recursive: true, force: true });
  throw err;
}

const srcDir = SUBPATH ? resolve(tmpDir, SUBPATH) : tmpDir;

if (existsSync(destAbs)) {
  console.log('[update-sidecharts] removing existing dest…');
  rmSync(destAbs, { recursive: true, force: true });
}
cpSync(srcDir, destAbs, { recursive: true });
rmSync(tmpDir, { recursive: true, force: true });

console.log('[update-sidecharts] done.');
console.log('[update-sidecharts] first-time setup: run `npm install` so the "sidecharts" file: dependency links up.');
