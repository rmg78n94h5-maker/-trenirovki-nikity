(() => {
  'use strict';

  const version = '1.9.1';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-workout-live-banner`,
  });
})();
