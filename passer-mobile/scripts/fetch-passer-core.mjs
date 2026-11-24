#!/usr/bin/env node
/**
 * Fetches the prebuilt passer-core libraries (Rust, with their generated Swift and Kotlin
 * bindings) from the passer-core GitHub release named in modules/passer-core/passer-core.json,
 * and unpacks them into the module's vendor folders:
 *
 *   modules/passer-core/ios/vendor/      PasserFFI.xcframework, passer_ffi.swift
 *   modules/passer-core/android/vendor/  jniLibs/, kotlin/
 *
 * Runs after `npm install`. On a developer machine a failure only warns (the JavaScript side
 * and the web bench work without the libraries); on CI and EAS it fails the install, so a
 * native build never starts without them.
 *
 *   PASSER_CORE_SKIP=1        do nothing
 *   PASSER_CORE_PLATFORM=ios  fetch one platform only (EAS sets EAS_BUILD_PLATFORM itself)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = join(root, 'modules', 'passer-core');
const strict = Boolean(process.env.CI || process.env.EAS_BUILD);

const PLATFORMS = {
  ios: { asset: 'passer-core-ios.zip', folder: 'passer-core-ios', vendor: join(moduleDir, 'ios', 'vendor') },
  android: { asset: 'passer-core-android.zip', folder: 'passer-core-android', vendor: join(moduleDir, 'android', 'vendor') },
};

async function main() {
  if (process.env.PASSER_CORE_SKIP === '1') return;
  const pin = JSON.parse(readFileSync(join(moduleDir, 'passer-core.json'), 'utf8'));
  const only = process.env.PASSER_CORE_PLATFORM || process.env.EAS_BUILD_PLATFORM;
  const wanted = only ? [only] : Object.keys(PLATFORMS);

  for (const name of wanted) {
    const platform = PLATFORMS[name];
    if (!platform) throw new Error(`unknown platform "${name}"`);
    const stamp = join(platform.vendor, '.release');
    if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === pin.tag) continue;

    const url = `https://github.com/${pin.repo}/releases/download/${pin.tag}/${platform.asset}`;
    console.log(`passer-core: fetching ${platform.asset} (${pin.tag})`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());

    // The release is pinned by hash once published: a replaced asset is refused.
    const expected = pin.sha256?.[name];
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (expected && expected !== actual) {
      throw new Error(`${platform.asset}: SHA-256 ${actual}, expected ${expected}`);
    }
    if (!expected) console.warn(`passer-core: no SHA-256 pinned for ${name} (got ${actual})`);

    const work = mkdtempSync(join(tmpdir(), 'passer-core-'));
    try {
      const archive = join(work, platform.asset);
      writeFileSync(archive, bytes);
      unzip(archive, work);
      rmSync(platform.vendor, { recursive: true, force: true });
      mkdirSync(platform.vendor, { recursive: true });
      cpSync(join(work, platform.folder), platform.vendor, { recursive: true });
      writeFileSync(stamp, `${pin.tag}\n`);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}

/** `unzip` where it exists (macOS, Linux); bsdtar elsewhere (Windows 10+ ships it as tar). */
function unzip(archive, into) {
  try {
    execFileSync('unzip', ['-q', '-o', archive, '-d', into], { stdio: 'ignore' });
  } catch {
    execFileSync('tar', ['-xf', archive, '-C', into], { stdio: 'inherit' });
  }
}

main().catch((error) => {
  const message = `passer-core: ${error.message}`;
  if (strict) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message}\npasser-core: native builds need these libraries; the web bench does not.`);
});
