(() => {
  'use strict';

  const version = '1.9.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-offline-guide`,
  });
})();
