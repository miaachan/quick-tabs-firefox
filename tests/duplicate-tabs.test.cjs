'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = readFileSync(path.join(__dirname, '../firefox_build/duplicate-tabs.js'), 'utf8');
const DuplicateTabs = vm.runInNewContext(`${script}\nDuplicateTabs;`);

const url = 'https://example.com/article';

function tab(id, fields = {}) {
  return Object.freeze({ id, url, cookieStoreId: 'firefox-default', ...fields });
}

function review(groups) {
  return Array.from(groups, ({ key, keep, copies }) => ({
    key,
    keepIds: Array.from(keep, tab => tab.id),
    copyIds: Array.from(copies, tab => tab.id),
  }));
}

test('groups only exact HTTP(S) URLs within each privacy mode and container', () => {
  const separate = [
    { url: `${url}#section` },
    { url: `${url}?tag=1&tag=2` },
    { url: `${url}?tag=2&tag=1` },
    { url: `${url}/` },
    { url: 'https://example.com/Article' },
    { url: 'https://example.com/%61rticle' },
    { url: 'http://example.com/article' },
    { incognito: true },
    { cookieStoreId: 'firefox-container-1' },
    { cookieStoreId: 'firefox-container-2' },
  ];
  const excluded = ['', undefined, 'about:newtab', 'file:///tmp/article', 'https://'];
  const tabs = [
    tab(1),
    ...separate.map((fields, index) => tab(index + 2, fields)),
    ...excluded.flatMap((url, index) => [tab(20 + index, { url }), tab(30 + index, { url })]),
    tab(11_000),
    tab(11_001, separate[7]),
    tab(11_002, separate[8]),
  ];

  const groups = review(DuplicateTabs.find(tabs));
  assert.equal(new Set(groups.map(group => group.key)).size, 3);
  assert.deepEqual(groups.map(group => [group.keepIds, group.copyIds]), [
    [[1], [11_000]],
    [[9], [11_001]],
    [[10], [11_002]],
  ]);
});

test('keeps most recent tabs when unprotected and preserves input order for ties and copies', () => {
  const secondUrl = `${url}/second`;
  const tabs = Object.freeze([
    tab(1, { lastAccessed: 3 }),
    tab(2, { url: secondUrl, lastAccessed: 0 }),
    tab(3, { lastAccessed: 4 }),
    tab(4, { url: secondUrl }),
    tab(5, { lastAccessed: 4 }),
    tab(6, { lastAccessed: 2 }),
  ]);

  const groups = DuplicateTabs.find(tabs);
  assert.equal(groups[0].keep[0], tabs[2]);
  assert.deepEqual(review(groups).map(group => [group.keepIds, group.copyIds]), [
    [[3], [1, 5, 6]],
    [[2], [4]],
  ]);
});

test('keeps every pinned, audible, or active tab across windows', () => {
  const allProtectedUrl = `${url}/protected`;
  const tabs = [
    tab(1, { lastAccessed: 999, windowId: 10 }),
    tab(2, { active: true, windowId: 20 }),
    tab(3, { pinned: true, windowId: 10 }),
    tab(4, { audible: true, windowId: 20 }),
    tab(5, { active: true, windowId: 10 }),
    tab(6, { active: true, windowId: 10, url: allProtectedUrl }),
    tab(7, { audible: true, windowId: 20, url: allProtectedUrl }),
  ];

  const groups = review(DuplicateTabs.find(tabs));
  assert.deepEqual(groups.map(group => [group.keepIds, group.copyIds]), [
    [[2, 3, 4, 5], [1]],
    [[6, 7], []],
  ]);
});

test('closes only reviewed copies whose identity and unprotected status still match', () => {
  const reviewed = review(DuplicateTabs.find([
    tab(1, { active: true, windowId: 10 }),
    ...Array.from({ length: 9 }, (_, index) => tab(index + 2)),
  ]));
  const freshTabs = [
    tab(1, { active: true, windowId: 10 }),
    tab(10),
    tab(2),
    tab(3, { url: `${url}#changed` }),
    tab(4, { cookieStoreId: 'firefox-container-1' }),
    tab(5, { incognito: true }),
    tab(6, { pinned: true }),
    tab(7, { active: true, windowId: 20 }),
    tab(8, { audible: true }),
    tab(11),
  ];

  assert.deepEqual(Array.from(DuplicateTabs.closeIds(reviewed, freshTabs)), [2, 10]);
});

test('requires at least one reviewed keeper to remain in the exact group', () => {
  const secondUrl = `${url}/second`;
  const reviewed = review(DuplicateTabs.find([
    tab(1, { active: true }),
    tab(2, { pinned: true }),
    tab(3),
    tab(4, { url: secondUrl, pinned: true }),
    tab(5, { url: secondUrl, audible: true }),
    tab(6, { url: secondUrl }),
  ]));
  const freshTabs = [
    tab(2, { pinned: true, cookieStoreId: 'firefox-container-1' }),
    tab(3, { lastAccessed: 10 }),
    tab(5, { url: secondUrl }),
    tab(6, { url: secondUrl, lastAccessed: 20 }),
    tab(7, { active: true }),
  ];

  assert.deepEqual(Array.from(DuplicateTabs.closeIds(reviewed, freshTabs)), [6]);
});
