(() => {
  'use strict';

  const version = '1.7.10';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-share-app`,
  });
})();
