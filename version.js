(() => {
  'use strict';

  const version = '1.2.4';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-splash-screen`,
  });
})();
