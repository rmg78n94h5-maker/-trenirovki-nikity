(() => {
  const DB_NAME = 'nikita-workouts-db';
  const DB_VERSION = 2;
  const STORES = ['meta', 'settings', 'profile', 'nutrition', 'exercises', 'programs', 'workouts', 'measurements', 'photos'];
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction;

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
          store.createIndex('profileId', 'profileId', { unique: false });
        } else {
          const store = tx.objectStore('workouts');
          if (!store.indexNames.contains('profileId')) store.createIndex('profileId', 'profileId', { unique: false });
        }

        if (!db.objectStoreNames.contains('measurements')) {
          const store = db.createObjectStore('measurements', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('profileId', 'profileId', { unique: false });
        } else {
          const store = tx.objectStore('measurements');
          if (!store.indexNames.contains('profileId')) store.createIndex('profileId', 'profileId', { unique: false });
        }

        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('profileId', 'profileId', { unique: false });
        } else {
          const store = tx.objectStore('photos');
          if (!store.indexNames.contains('profileId')) store.createIndex('profileId', 'profileId', { unique: false });
        }

        // Обновление старой однопользовательской базы: все прежние данные
        // становятся данными профиля «Никита» с id="main".
        if (event.oldVersion === 1) migrateVersionOne(tx);
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Закрой другие вкладки приложения и повтори обновление'));
    });
    return dbPromise;
  }

  function migrateVersionOne(tx) {
    const meta = tx.objectStore('meta');
    const profiles = tx.objectStore('profile');
    const nutrition = tx.objectStore('nutrition');
    const settings = tx.objectStore('settings');

    meta.put({ key: 'activeProfileId', value: 'main' });
    meta.put({ key: 'profilesVersion', value: 2, migratedAt: new Date().toISOString() });

    const profileRequest = profiles.get('main');
    profileRequest.onsuccess = () => {
      if (profileRequest.result) {
        profiles.put({
          ...profileRequest.result,
          id: 'main',
          createdAt: profileRequest.result.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    };

    const nutritionRequest = nutrition.get('main');
    nutritionRequest.onsuccess = () => {
      if (nutritionRequest.result) nutrition.put({ ...nutritionRequest.result, id: 'main' });
    };

    settings.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;
      const row = cursor.value;
      if (!String(row.key).includes(':')) {
        settings.put({ key: `main:${row.key}`, value: row.value });
        cursor.delete();
      }
      cursor.continue();
    };

    for (const storeName of ['workouts', 'measurements', 'photos']) {
      const store = tx.objectStore(storeName);
      store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        if (!cursor.value.profileId) cursor.update({ ...cursor.value, profileId: 'main' });
        cursor.continue();
      };
    }

    tx.objectStore('exercises').openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;
      if (cursor.value.custom && !cursor.value.ownerProfileId) cursor.update({ ...cursor.value, ownerProfileId: 'main' });
      cursor.continue();
    };

    tx.objectStore('programs').openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;
      const isBuiltIn = ['ship-cycle-7', 'journal-20'].includes(cursor.value.id);
      if (!isBuiltIn && !cursor.value.ownerProfileId) cursor.update({ ...cursor.value, ownerProfileId: 'main' });
      cursor.continue();
    };

    const draftRequest = meta.get('draftWorkout');
    draftRequest.onsuccess = () => {
      if (draftRequest.result?.value) {
        meta.put({
          key: 'draftWorkout:main',
          value: { ...draftRequest.result.value, profileId: 'main' },
        });
        meta.delete('draftWorkout');
      }
    };
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

  async function getAllForProfile(store, profileId) {
    return transaction([store], 'readonly', async (stores) => {
      const objectStore = stores[store];
      if (objectStore.indexNames.contains('profileId')) {
        return requestToPromise(objectStore.index('profileId').getAll(profileId));
      }
      const rows = await requestToPromise(objectStore.getAll());
      return rows.filter((row) => row.profileId === profileId);
    });
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

    // В новой установке сначала загружаются только шаблоны упражнений и программ.
    // Личный профиль создаётся на первом экране самим пользователем.
    await transaction(['meta', 'exercises', 'programs'], 'readwrite', async (stores) => {
      stores.meta.put({ key: 'seeded', value: true, version: seed.version, date: new Date().toISOString() });
      stores.meta.put({ key: 'profilesVersion', value: 2, date: new Date().toISOString() });
      for (const exercise of seed.exercises) stores.exercises.put(exercise);
      for (const program of seed.programs) stores.programs.put(program);
    });
    return true;
  }

  async function getProfiles() {
    const rows = await getAll('profile');
    return rows.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }

  async function getActiveProfileId() {
    const active = await get('meta', 'activeProfileId');
    if (active?.value) return active.value;
    const profiles = await getProfiles();
    return profiles[0]?.id || null;
  }

  async function setActiveProfileId(profileId) {
    await put('meta', { key: 'activeProfileId', value: profileId });
  }

  async function createProfile(profile, nutrition, settingsValues) {
    const now = new Date().toISOString();
    const cleanProfile = {
      ...profile,
      createdAt: profile.createdAt || now,
      updatedAt: now,
    };
    await transaction(['profile', 'nutrition', 'settings', 'meta'], 'readwrite', async (stores) => {
      stores.profile.put(cleanProfile);
      stores.nutrition.put({ ...nutrition, id: cleanProfile.id });
      for (const [key, value] of Object.entries(settingsValues)) {
        stores.settings.put({ key: `${cleanProfile.id}:${key}`, value });
      }
      stores.meta.put({ key: 'activeProfileId', value: cleanProfile.id });
    });
    return cleanProfile;
  }

  async function deleteProfile(profileId) {
    const storesToOpen = ['profile', 'nutrition', 'settings', 'programs', 'exercises', 'workouts', 'measurements', 'photos', 'meta'];
    await transaction(storesToOpen, 'readwrite', async (stores) => {
      stores.profile.delete(profileId);
      stores.nutrition.delete(profileId);
      stores.meta.delete(`draftWorkout:${profileId}`);

      stores.settings.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(`${profileId}:`)) cursor.delete();
        cursor.continue();
      };

      for (const storeName of ['workouts', 'measurements', 'photos']) {
        stores[storeName].openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (cursor.value.profileId === profileId) cursor.delete();
          cursor.continue();
        };
      }

      for (const storeName of ['programs', 'exercises']) {
        stores[storeName].openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (cursor.value.ownerProfileId === profileId) cursor.delete();
          cursor.continue();
        };
      }
    });
  }

  async function getSettingsObject(profileId) {
    if (!profileId) return {};
    const rows = await getAll('settings');
    const prefix = `${profileId}:`;
    const scoped = rows
      .filter((row) => String(row.key).startsWith(prefix))
      .map((row) => [String(row.key).slice(prefix.length), row.value]);
    if (scoped.length) return Object.fromEntries(scoped);

    // Страховка для очень старой копии без префиксов.
    return Object.fromEntries(rows.filter((row) => !String(row.key).includes(':')).map((row) => [row.key, row.value]));
  }

  async function setSettingsObject(values, profileId) {
    if (!profileId) throw new Error('Не выбран профиль');
    await putMany('settings', Object.entries(values).map(([key, value]) => ({ key: `${profileId}:${key}`, value })));
  }

  async function exportData(includePhotos = false) {
    const result = {
      format: 'nikita-workouts-backup',
      version: 2,
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
      throw new Error('Это не резервная копия приложения «Тренировки»');
    }
    const stores = ['meta', 'settings', 'profile', 'nutrition', 'exercises', 'programs', 'workouts', 'measurements', 'photos'];
    await transaction(stores, 'readwrite', async (s) => {
      if (mode === 'replace') {
        for (const store of stores) s[store].clear();
      }
      for (const store of stores) {
        const rows = backup.data[store] || [];
        for (const originalRow of rows) {
          let row = { ...originalRow };
          if (store === 'photos' && row.dataUrl) {
            const blob = dataURLToBlob(row.dataUrl);
            const { dataUrl, ...clean } = row;
            row = { ...clean, blob };
          }
          s[store].put(row);
        }
      }

      const profiles = backup.data.profile || [];
      const fallbackProfileId = profiles[0]?.id || 'main';
      if (!(backup.data.meta || []).some((row) => row.key === 'seeded')) {
        s.meta.put({ key: 'seeded', value: true, version: 2, date: new Date().toISOString() });
      }
      if (!(backup.data.meta || []).some((row) => row.key === 'activeProfileId')) {
        s.meta.put({ key: 'activeProfileId', value: fallbackProfileId });
      }

      // Совместимость с резервной копией версии 1.
      if ((backup.version || 1) < 2) {
        for (const row of backup.data.settings || []) {
          if (!String(row.key).includes(':')) s.settings.put({ key: `${fallbackProfileId}:${row.key}`, value: row.value });
        }
        for (const storeName of ['workouts', 'measurements', 'photos']) {
          for (const oldRow of backup.data[storeName] || []) {
            s[storeName].put({ ...oldRow, profileId: oldRow.profileId || fallbackProfileId });
          }
        }
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
    getAllForProfile,
    put,
    putMany,
    remove,
    clear,
    getProfiles,
    getActiveProfileId,
    setActiveProfileId,
    createProfile,
    deleteProfile,
    getSettingsObject,
    setSettingsObject,
    exportData,
    importData,
    blobToDataURL,
  };
})();
