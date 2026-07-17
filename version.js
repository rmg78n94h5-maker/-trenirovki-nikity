(() => {
  'use strict';

  const version = '1.2.3';

  globalThis.NIKITA_APP = Object.freeze({
    version,
    cacheName: `nikita-workouts-v${version}-convenient-input`,
  });
})();
