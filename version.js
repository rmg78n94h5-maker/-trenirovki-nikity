(() => {
  'use strict';

  const version = '1.12.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-profile-program-builder`,
  });
})();
