(() => {
  'use strict';

  const version = '1.4.0';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-pain-control`,
  });
})();
