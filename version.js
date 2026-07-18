(() => {
  'use strict';

  const version = '1.7.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-deload-week`,
  });
})();
