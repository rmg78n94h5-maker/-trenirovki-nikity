(() => {
  'use strict';

  const version = '1.6.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-muscle-load`,
  });
})();
