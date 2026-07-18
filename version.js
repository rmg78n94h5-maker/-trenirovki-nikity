(() => {
  'use strict';

  const version = '1.7.4';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-smart-rest`,
  });
})();
