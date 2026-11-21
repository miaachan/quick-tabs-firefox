'use strict';

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { basename, dirname, resolve } = require('node:path');

const releases = 'https://github.com/miaachan/quick-tabs-firefox/releases';
const updateUrl = `${releases}/latest/download/updates.json`;
const signatureEntries = ['META-INF/manifest.mf', 'META-INF/mozilla.sf', 'META-INF/mozilla.rsa'];

function unzip(artifactPath, option, ...entries) {
  return execFileSync('unzip', [option, basename(artifactPath), ...entries], {
    cwd: dirname(artifactPath),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function makeUpdateManifest(artifact) {
  const source = JSON.parse(readFileSync(resolve(__dirname, '../firefox_build/manifest.json'), 'utf8'));
  const version = source.version;
  const id = source.browser_specific_settings?.gecko?.id;
  if (typeof version !== 'string' || !/^\d+(?:\.\d+)*$/.test(version) || typeof id !== 'string' || !id) {
    throw new Error('Expected a numeric version and Gecko ID in firefox_build/manifest.json');
  }

  const artifactPath = resolve(artifact);
  const filename = `quick-tabs-firefox-${version}.xpi`;
  if (basename(artifactPath) !== filename) {
    throw new Error(`Expected XPI filename ${filename}`);
  }

  const entries = unzip(artifactPath, '-Z1').trimEnd().split('\n');
  if (entries.filter(entry => entry === 'manifest.json').length !== 1) {
    throw new Error('XPI must contain exactly one manifest.json at its root');
  }
  const manifest = JSON.parse(unzip(artifactPath, '-p', 'manifest.json'));
  if (manifest?.version !== version) {
    throw new Error(`XPI manifest version must match the checkout version ${version}`);
  }
  const gecko = manifest.browser_specific_settings?.gecko;
  if (gecko?.id !== id) {
    throw new Error(`XPI Gecko ID must match the checkout ID ${id}`);
  }
  if (gecko.update_url !== updateUrl) {
    throw new Error(`XPI Gecko update_url must be ${updateUrl}`);
  }
  // These entries establish that signature metadata is present. Firefox verifies the signature itself.
  if (!signatureEntries.every(entry => entries.includes(entry))) {
    throw new Error('XPI is missing Mozilla signature metadata');
  }

  const hash = createHash('sha256').update(readFileSync(artifactPath)).digest('hex');
  return {
    addons: {
      [id]: {
        updates: [{
          version,
          update_link: `${releases}/download/v${version}/${filename}`,
          update_hash: `sha256:${hash}`,
        }],
      },
    },
  };
}

try {
  if (process.argv.length !== 3) {
    throw new Error('Usage: node tools/make-update-manifest.cjs /path/to/quick-tabs-firefox-VERSION.xpi');
  }
  const manifest = makeUpdateManifest(process.argv[2]);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`Could not generate Firefox update manifest: ${error.message}\n`);
  process.exitCode = 1;
}
