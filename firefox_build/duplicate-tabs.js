'use strict';

const DuplicateTabs = (() => {
  function groupKey(tab) {
    const url = tab?.url;
    if (typeof url !== 'string' || !/^https?:\/\/.+/i.test(url)) {
      return null;
    }
    return JSON.stringify([url, Boolean(tab.incognito), tab.cookieStoreId]);
  }

  function isProtected(tab) {
    return tab.pinned || tab.active || tab.audible;
  }

  function find(tabs) {
    const tabsByGroup = new Map();
    for (const tab of tabs) {
      const key = groupKey(tab);
      if (key === null) {
        continue;
      }
      if (!tabsByGroup.has(key)) {
        tabsByGroup.set(key, []);
      }
      tabsByGroup.get(key).push(tab);
    }

    const groups = [];
    for (const [key, members] of tabsByGroup) {
      if (members.length < 2) {
        continue;
      }

      const keep = members.filter(isProtected);
      if (keep.length === 0) {
        let mostRecent = members[0];
        for (const tab of members) {
          if ((tab.lastAccessed ?? -Infinity) > (mostRecent.lastAccessed ?? -Infinity)) {
            mostRecent = tab;
          }
        }
        keep.push(mostRecent);
      }

      const keepers = new Set(keep);
      groups.push({ key, keep, copies: members.filter(tab => !keepers.has(tab)) });
    }
    return groups;
  }

  function closeIds(reviewedGroups, freshTabs) {
    const tabsById = new Map(freshTabs.map(tab => [tab.id, tab]));
    const ids = [];

    for (const { key, keepIds, copyIds } of reviewedGroups) {
      if (!keepIds.some(id => groupKey(tabsById.get(id)) === key)) {
        continue;
      }
      for (const id of copyIds) {
        const tab = tabsById.get(id);
        if (tab && !isProtected(tab) && groupKey(tab) === key) {
          ids.push(id);
        }
      }
    }
    return ids;
  }

  return { find, closeIds };
})();
