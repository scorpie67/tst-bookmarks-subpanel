/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from '/common/constants.js';

import * as Connection from './connection.js';
import * as EventUtils from './event-utils.js';
import * as Bookmarks from './bookmarks.js';
import * as ContextMenu from './context-menu.js';
import * as DragAndDrop from './drag-and-drop.js';

let configs = {};
let mInitiaized = false;

async function init() {
  if (mInitiaized)
    return;
  try {
    await Promise.all([
      Bookmarks.init(),
      (async () => {
        configs = await browser.runtime.sendMessage({
          type: Constants.COMMAND_GET_CONFIGS,
          keys: [
            'openedFolders',
            'openInTabDefault',
            'openInTabAlways',
            'scrollPosition',
            'openAsActiveTab'
          ]
        });
      })()
    ]);

    window.scrollTo(0, configs.scrollPosition);

    DragAndDrop.init();
    ContextMenu.init();

    mInitiaized = true;
  }
  catch(_error) {
  }
}

init();


function clearActive() {
  for (const node of document.querySelectorAll('.active')) {
    node.classList.remove('active');
  }
}

let mLastMouseDownTarget = null;

window.addEventListener('mousedown', event => {
  const item = EventUtils.getItemFromEvent(event);
  if (!item)
    return;

  mLastMouseDownTarget = item.raw.id;

  clearActive();
  item.firstChild.classList.add('active');
  item.firstChild.focus();

  if (event.button == 1) {
    // We need to cancel mousedown to block the "auto scroll" behavior
    // of Firefox itself.
    event.stopPropagation();
    event.preventDefault();
  }

  if (event.button == 2 ||
      (event.button == 0 &&
       event.ctrlKey)) {
    // context menu
    return;
  }
}, { capture: true });

// We need to handle mouseup instead of click to bypass the "auto scroll"
// behavior of Firefox itself.
window.addEventListener('mouseup', event => {
  if (event.button == 2)
    return;

  const item = EventUtils.getItemFromEvent(event);
  if (!item)
    return;

  if (mLastMouseDownTarget != item.raw.id) {
    mLastMouseDownTarget = null;
    return;
  }

  mLastMouseDownTarget = null;

  const accel = event.ctrlKey || event.metaKey || event.button == 1;

  if (item.classList.contains('folder')) {
    if (accel) {
      const urls = item.raw.children.map(item => item.url).filter(url => url && Constants.LOADABLE_URL_MATCHER.test(url));
      Connection.sendMessage({
        type: Constants.COMMAND_OPEN_BOOKMARKS,
        urls
      });
    }
    else {
      item.classList.toggle('collapsed');
      Bookmarks.updateOpenState(item);
    }
    return;
  }

  if (item.classList.contains('bookmark') &&
      !item.classList.contains('unavailable')) {
    if (!configs.openInTabAlways &&
        configs.openInTabDefault == accel)
      Connection.sendMessage({
        type: Constants.COMMAND_LOAD_BOOKMARK,
        url:  item.raw.url
      });
    else
      Connection.sendMessage({
        type:       Constants.COMMAND_OPEN_BOOKMARKS,
        urls:       [item.raw.url],
        background: configs.openAsActiveTab ? event.shiftKey : !event.shiftKey
      });
    return;
  }
});

window.addEventListener('scroll', () => {
  Connection.sendMessage({
    type:   Constants.COMMAND_SET_CONFIGS,
    values: {
      scrollPosition: window.scrollY
    }
  });
});
