(() => {
  'use strict';

  const version = '1.8.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-iron-calculator`,
  });
})();
