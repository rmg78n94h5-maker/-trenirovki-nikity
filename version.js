(() => {
  'use strict';

  const version = '1.13.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-push-foundation`,
  });
})();
