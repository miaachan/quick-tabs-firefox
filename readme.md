# Quick Tabs (Firefox)

A Firefox port of [Quick Tabs](https://github.com/babyman/quick-tabs-chrome-extension) - the excellent keyboard-centric tab manager inspired by IntelliJ IDEA's "Recent Files" switcher.

For full features and documentation, see the [original project readme](https://github.com/babyman/quick-tabs-chrome-extension#readme). All credit for the core extension goes to [@babyman](https://github.com/babyman) and contributors.

## Install

Download the latest signed `.xpi` from [Releases](https://github.com/miaachan/quick-tabs-firefox/releases) and open it in Firefox.

To try the current source, open `about:debugging#/runtime/this-firefox` in Firefox, click **Load Temporary Add-on**, and select `firefox_build/manifest.json` from this checkout. A temporary install lasts until you restart Firefox. [Mozilla's temporary install guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

## Slash commands

Type these in the Quick Tabs search box. Add a space and a search term to narrow the results.

| Command | What it does |
| --- | --- |
| `/dupes` or `/dupes github.com` | Find duplicate tabs, optionally filtered by title or URL. |
| `/b recipe` | Search bookmarks. |
| `/h recipe` | Search browsing history. |
| `/w`, `/p` | Filter open tabs to the current window or pinned tabs. |
| `/fuzzy`, `/fuse`, `/regex`, `/subs` | Search using fuzzy, Fuse, regular expression, or substring matching. |
| `/close example.com` | Preview matching unpinned tabs and show a bulk close action. |
| `/merge`, `/split` | Move tabs into the current window or into a new window. |
| `/reload`, `/mute`, `/unmute` | Show actions for the matching tabs. |
| `/g`, `/group` | Filter to the current tab group or group matching tabs, where Firefox supports tab groups. |

### Duplicate tabs

Type `/dupes` in the popup. Add a title or URL fragment, such as `/dupes github.com`, to narrow the list. Review the rows marked **Keep**, then choose **Close N duplicate tabs** or close an extra copy individually.

Quick Tabs matches exact HTTP(S) URLs across open windows within the same Firefox container and browsing context. Pinned, active, and audible tabs are kept. If none of the copies have those protections, the most recently used copy is kept.

## Firefox Port Improvements

All features working and synced with upstream [`5b42477`](https://github.com/babyman/quick-tabs-chrome-extension/commit/5b424779ec19dffee70c56b8347d7be91ca4d500).

This fork includes the following enhancements over upstream:

- **Non-blocking history search** - `/h` searches run in a Web Worker, keeping UI responsive even with 100k+ history items
- **Fuse.js v7** - Removes the 32-character search limit for better long-string matching
- **Fuse instance caching** - Avoids expensive re-indexing on every keystroke
- **Gentler disk writes** - Tab order persistence uses localStorage instead of session storage
- **UI polish** - Fixed popup shifting on open

## Maintenance

This fork is maintained independently for personal use:

- **Upstream sync**: `./quick-tabs/` mirrors upstream master for easy diffing. Useful changes are cherry-picked into `./firefox_build/`
- **No upstream contributions**: Changes here are Firefox-specific and won't be pushed back
- **Version scheme**: `YYYY.M.D` based on release date

### Syncing with upstream

```bash
git fetch upstream
git diff HEAD upstream/master -- quick-tabs/
# Cherry-pick or manually port relevant changes to firefox_build/
```

