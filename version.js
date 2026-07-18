(() => {
  'use strict';

  const version = '1.7.6';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-sport-premium-plan`,
  });
})();
