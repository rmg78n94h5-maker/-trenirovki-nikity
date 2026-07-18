(() => {
  'use strict';

  const version = '1.8.1';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-progress-filter-fix`,
  });
})();
