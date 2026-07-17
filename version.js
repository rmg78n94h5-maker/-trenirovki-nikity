(() => {
  'use strict';

  const version = '1.2.2';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-stabilization`,
  });
})();
