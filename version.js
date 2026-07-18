(() => {
  'use strict';

  const version = '1.10.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-smart-workout-builder`,
  });
})();
