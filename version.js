(() => {
  'use strict';

  const version = '2.0.1';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-auto-push`,
  });
})();
