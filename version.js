(() => {
  'use strict';

  const version = '1.14.1';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-auto-push`,
  });
})();
