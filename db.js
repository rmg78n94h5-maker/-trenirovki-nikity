(() => {
  const DB_NAME = 'nikita-workouts-db';
  const DB_VERSION = 1;
  const STORES = ['meta', 'settings', 'profile', 'nutrition', 'exercises', 'programs', 'workouts', 'measurements', 'photos'];
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('nutrition')) db.createObjectStore('nutrition', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('programs')) db.createObjectStore('programs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('workouts')) {
          const store = db.createObjectStore('workouts', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('programId', 'programId', { unique: false });
        }
        if (!db.objectStoreNames.contains('measurements')) {
          const store = db.createObjectStore('measurements', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function transaction(storeNames, mode, callback) {
    const db = await openDB();
    const tx = db.transaction(storeNames, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Транзакция отменена'));
    });
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    const result = await callback(stores, tx);
    await done;
    return result;
  }

  const requestToPromise = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  async function get(store, key) {
    return transaction([store], 'readonly', async (stores) => requestToPromise(stores[store].get(key)));
  }

  async function getAll(store) {
    return transaction([store], 'readonly', async (stores) => requestToPromise(stores[store].getAll()));
  }

  async function put(store, value) {
    return transaction([store], 'readwrite', async (stores) => requestToPromise(stores[store].put(value)));
  }

  async function putMany(store, values) {
    return transaction([store], 'readwrite', async (stores) => {
      for (const value of values) stores[store].put(value);
    });
  }

  async function remove(store, key) {
    return transaction([store], 'readwrite', async (stores) => requestToPromise(stores[store].delete(key)));
  }

  async function clear(store) {
    return transaction([store], 'readwrite', async (stores) => requestToPromise(stores[store].clear()));
  }

  async function seedIfNeeded() {
    const seeded = await get('meta', 'seeded');
    if (seeded?.value) return false;
    const seed = window.NIKITA_SEED;
    if (!seed) throw new Error('Не найдены стартовые данные');

    await transaction(['meta', 'settings', 'profile', 'nutrition', 'exercises', 'programs', 'measurements'], 'readwrite', async (stores) => {
      stores.meta.put({ key: 'seeded', value: true, version: seed.version, date: new Date().toISOString() });
      for (const [key, value] of Object.entries(seed.settings)) stores.settings.put({ key, value });
      stores.profile.put({ id: 'main', ...seed.profile });
      stores.nutrition.put({ id: 'main', ...seed.nutrition });
      for (const exercise of seed.exercises) stores.exercises.put(exercise);
      for (const program of seed.programs) stores.programs.put(program);
      for (const measurement of seed.measurements) stores.measurements.put(measurement);
    });
    return true;
  }

  async function getSettingsObject() {
    const rows = await getAll('settings');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async function setSettingsObject(values) {
    await putMany('settings', Object.entries(values).map(([key, value]) => ({ key, value })));
  }

  async function exportData(includePhotos = false) {
    const result = {
      format: 'nikita-workouts-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {},
    };
    for (const store of ['meta', 'settings', 'profile', 'nutrition', 'exercises', 'programs', 'workouts', 'measurements']) {
      result.data[store] = await getAll(store);
    }
    if (includePhotos) {
      const photos = await getAll('photos');
      result.data.photos = [];
      for (const photo of photos) {
        let dataUrl = null;
        if (photo.blob instanceof Blob) dataUrl = await blobToDataURL(photo.blob);
        result.data.photos.push({ ...photo, blob: undefined, dataUrl });
      }
    }
    return result;
  }

  async function importData(backup, mode = 'replace') {
    if (!backup || backup.format !== 'nikita-workouts-backup' || !backup.data) {
      throw new Error('Это не резервная копия «Тренировки Никиты»');
    }
    const stores = ['meta', 'settings', 'profile', 'nutrition', 'exercises', 'programs', 'workouts', 'measurements', 'photos'];
    await transaction(stores, 'readwrite', async (s) => {
      if (mode === 'replace') {
        for (const store of stores) s[store].clear();
      }
      for (const store of stores) {
        const rows = backup.data[store] || [];
        for (const row of rows) {
          if (store === 'photos' && row.dataUrl) {
            const blob = dataURLToBlob(row.dataUrl);
            const { dataUrl, ...clean } = row;
            s.photos.put({ ...clean, blob });
          } else {
            s[store].put(row);
          }
        }
      }
      if (!(backup.data.meta || []).some((row) => row.key === 'seeded')) {
        s.meta.put({ key: 'seeded', value: true, version: 1, date: new Date().toISOString() });
      }
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    const [head, body] = dataURL.split(',');
    const mime = head.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(body);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  window.NikitaDB = {
    openDB,
    seedIfNeeded,
    get,
    getAll,
    put,
    putMany,
    remove,
    clear,
    getSettingsObject,
    setSettingsObject,
    exportData,
    importData,
    blobToDataURL,
  };
})();
