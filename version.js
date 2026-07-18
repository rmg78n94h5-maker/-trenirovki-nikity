(() => {
  'use strict';

  const version = '1.7.3';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-body-progress-charts`,
  });
})();
