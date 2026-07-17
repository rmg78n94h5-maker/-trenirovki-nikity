(() => {
  'use strict';

  const version = '1.2.5';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-program-builder`,
  });
})();
