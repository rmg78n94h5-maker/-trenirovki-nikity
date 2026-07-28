(() => {
  'use strict';

  const version = '2.2.1';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-auto-push`,
  });
})();
