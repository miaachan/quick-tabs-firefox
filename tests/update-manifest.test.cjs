'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const test = require('node:test');

const script = resolve(__dirname, '../tools/make-update-manifest.cjs');
const checkout = JSON.parse(readFileSync(resolve(__dirname, '../firefox_build/manifest.json'), 'utf8'));
const version = checkout.version;
const id = checkout.browser_specific_settings.gecko.id;
const filename = `quick-tabs-firefox-${version}.xpi`;
const updateUrl = 'https://github.com/miaachan/quick-tabs-firefox/releases/latest/download/updates.json';

function fixture(t, { assetName = filename, manifestVersion = version, geckoId = id, manifestUpdateUrl = updateUrl, includeMetadata = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'quick tabs xpi '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const manifest = {
    version: manifestVersion,
    browser_specific_settings: { gecko: { id: geckoId, update_url: manifestUpdateUrl } },
  };
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest));
  const entries = ['manifest.json'];
  if (includeMetadata) {
    mkdirSync(join(directory, 'META-INF'));
    for (const name of ['manifest.mf', 'mozilla.sf', 'mozilla.rsa']) {
      const entry = `META-INF/${name}`;
      writeFileSync(join(directory, entry), `Synthetic ${name}`);
      entries.push(entry);
    }
  }
  const artifactPath = join(directory, assetName);
  execFileSync('zip', ['-q', assetName, ...entries], { cwd: directory });
  return artifactPath;
}

function generate(artifactPath) {
  return spawnSync(process.execPath, [script, artifactPath], { encoding: 'utf8' });
}

test('generates the versioned GitHub asset URL and SHA-256 of the complete XPI', t => {
  const artifactPath = fixture(t);
  const result = generate(artifactPath);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    addons: {
      [id]: {
        updates: [{
          version,
          update_link: `https://github.com/miaachan/quick-tabs-firefox/releases/download/v${version}/${filename}`,
          update_hash: `sha256:${createHash('sha256').update(readFileSync(artifactPath)).digest('hex')}`,
        }],
      },
    },
  });
});

for (const [name, overrides, error] of [
  ['unexpected XPI filename', { assetName: 'other-addon.xpi' }, /Expected XPI filename/],
  ['different manifest version', { manifestVersion: '0.0.1' }, /XPI manifest version must match/],
  ['different Gecko ID', { geckoId: 'other-addon@example.com' }, /XPI Gecko ID must match/],
  ['different update URL', { manifestUpdateUrl: 'https://example.com/updates.json' }, /XPI Gecko update_url must be/],
  ['missing signature metadata', { includeMetadata: false }, /XPI is missing Mozilla signature metadata/],
]) {
  test(`refuses ${name} without writing feed JSON`, t => {
    const result = generate(fixture(t, overrides));
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, error);
  });
}
