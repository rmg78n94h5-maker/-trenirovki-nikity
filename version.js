(() => {
  'use strict';

  const version = '1.7.2';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-pain-history-cleanup`,
  });
})();
