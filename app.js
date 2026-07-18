(() => {
  'use strict';

  const DB = window.NikitaDB;
  const APP_VERSION = window.NIKITA_APP?.version || 'неизвестна';
  const APP_VERSION_STORAGE_KEY = 'nikita-workouts-app-version';
  const APP_UPDATE_MESSAGE_KEY = 'nikita-workouts-update-message';
  const BOOT_STARTED_AT = Date.now();
  const state = {
    route: 'home',
    profiles: [],
    activeProfileId: null,
    profile: null,
    nutrition: null,
    settings: {},
    allExercises: [],
    allPrograms: [],
    exercises: [],
    programs: [],
    workouts: [],
    measurements: [],
    photos: [],
    painEntries: [],
    currentWorkout: null,
    historyFilter: 'month',
    progressTab: 'body',
    timer: { seconds: 0, interval: null, nextLabel: '' },
    photoUrls: new Map(),
    swRegistration: null,
    update: {
      availableVersion: null,
      checking: false,
      reloadOnControllerChange: false,
      autoCheckTimer: null,
      lastCheckAt: null,
      statusText: 'Пока не проверяли',
      cacheStatus: 'неизвестно',
      bannerMode: null,
      dismissedVersion: null,
    },
  };

  const el = {
    splash: document.getElementById('app-splash'),
    main: document.getElementById('main'),
    topbarTitle: document.getElementById('topbar-title'),
    topbarEyebrow: document.getElementById('topbar-eyebrow'),
    nav: [...document.querySelectorAll('.nav-item')],
    modalRoot: document.getElementById('modal-root'),
    toast: document.getElementById('toast'),
    offline: document.getElementById('offline-indicator'),
    quickAdd: document.getElementById('quick-add-button'),
    timerOverlay: document.getElementById('rest-timer'),
    timerValue: document.getElementById('timer-value'),
    timerNext: document.getElementById('timer-next'),
    timerMinus: document.getElementById('timer-minus'),
    timerPlus: document.getElementById('timer-plus'),
    timerSkip: document.getElementById('timer-skip'),
    profileSwitch: document.getElementById('profile-switch-button'),
    profileInitial: document.getElementById('profile-initial'),
  };

  const difficultyOptions = [
    ['easy', 'Легко'],
    ['normal', 'Нормально'],
    ['hard', 'Тяжело'],
    ['failure', 'До отказа'],
  ];


  const painAreas = [
    { id: 'neck', label: 'Шея' },
    { id: 'shoulder', label: 'Плечо' },
    { id: 'elbow', label: 'Локоть' },
    { id: 'wrist', label: 'Кисть / запястье' },
    { id: 'chest', label: 'Грудь' },
    { id: 'upper-back', label: 'Спина верх' },
    { id: 'lower-back', label: 'Поясница' },
    { id: 'abs', label: 'Пресс / живот' },
    { id: 'groin', label: 'Паховая область / низ живота' },
    { id: 'hip', label: 'Таз / ягодица' },
    { id: 'thigh', label: 'Бедро' },
    { id: 'knee', label: 'Колено' },
    { id: 'shin-foot', label: 'Голень / стопа' },
    { id: 'other', label: 'Другое' },
  ];

  const painRiskRules = {
    groin: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'romanian-deadlift', 'good-morning-bodyweight', 'bulgarian-split-squat', 'reverse-lunge', 'hip-thrust', 'single-leg-bridge', 'wall-sit', 'dead-bug', 'reverse-crunch', 'lying-leg-raise', 'side-plank', 'front-plank', 'russian-twist', 'ab-roller', 'barbell-row', 'farmer-hold', 'suitcase-hold', 'db-shoulder-press'],
      keywords: ['присед', 'выпад', 'тяга', 'наклон', 'мост', 'планка', 'скруч', 'ролик', 'подъём', 'кор', 'пресс', 'ягод', 'ног'],
      reason: 'может повышать давление на паховую область и низ живота',
    },
    abs: {
      exerciseIds: ['dead-bug', 'reverse-crunch', 'lying-leg-raise', 'side-plank', 'front-plank', 'russian-twist', 'ab-roller', 'goblet-squat', 'barbell-squat', 'romanian-deadlift', 'farmer-hold', 'suitcase-hold'],
      keywords: ['пресс', 'кор', 'скруч', 'планка', 'ролик', 'подъём ног', 'тяга', 'присед'],
      reason: 'сильно включает пресс и внутрибрюшное давление',
    },
    'lower-back': {
      exerciseIds: ['barbell-row', 'romanian-deadlift', 'good-morning-bodyweight', 'goblet-squat', 'barbell-squat', 'ab-roller', 'lying-leg-raise', 'front-plank', 'bird-dog', 'suitcase-hold'],
      keywords: ['поясница', 'тяга', 'наклон', 'присед', 'ролик', 'планка', 'кор'],
      reason: 'может грузить поясницу и корпус',
    },
    knee: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'bulgarian-split-squat', 'reverse-lunge', 'wall-sit', 'stepper-easy', 'stepper-intervals', 'stepper-short', 'calf-raise'],
      keywords: ['присед', 'выпад', 'степпер', 'стульчик', 'ноги', 'икры'],
      reason: 'даёт нагрузку на колено и ноги',
    },
    shoulder: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'db-floor-press', 'machine-chest-press', 'pec-deck', 'db-fly-floor', 'db-shoulder-press', 'pike-pushups', 'lateral-raise', 'rear-delt-fly', 'face-pull-machine', 'db-pullover', 'overhead-triceps', 'close-pushups', 'ab-roller'],
      keywords: ['жим', 'отжим', 'плеч', 'развод', 'дельт', 'пуловер', 'трицепс', 'ролик'],
      reason: 'может раздражать плечо и жимовую зону',
    },
    elbow: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'db-floor-press', 'db-shoulder-press', 'barbell-curl', 'db-curl', 'hammer-curl', 'reverse-curl', 'overhead-triceps', 'close-pushups', 'triceps-pushdown', 'farmer-hold', 'suitcase-hold'],
      keywords: ['сгибание', 'трицепс', 'бицепс', 'жим', 'отжим', 'удержание'],
      reason: 'нагружает локоть и сухожилия рук',
    },
    wrist: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'pike-pushups', 'close-pushups', 'barbell-curl', 'db-curl', 'hammer-curl', 'reverse-curl', 'farmer-hold', 'suitcase-hold', 'ab-roller'],
      keywords: ['отжим', 'сгибание', 'удержание', 'хват', 'предплеч', 'ролик'],
      reason: 'может давить на кисть, запястье или хват',
    },
    chest: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'db-floor-press', 'machine-chest-press', 'pec-deck', 'db-fly-floor', 'db-pullover', 'close-pushups'],
      keywords: ['груд', 'жим', 'отжим', 'развод', 'бабочка', 'пуловер'],
      reason: 'нагружает грудь и жимовые мышцы',
    },
    'upper-back': {
      exerciseIds: ['rear-delt-fly', 'face-pull-machine', 'one-arm-row', 'barbell-row', 'lat-pulldown', 'seated-row-machine', 'shrugs', 'farmer-hold'],
      keywords: ['спина', 'тяга', 'дельта', 'трапеции', 'шраги'],
      reason: 'нагружает верх спины и лопатки',
    },
    neck: {
      exerciseIds: ['shrugs', 'farmer-hold', 'suitcase-hold', 'db-shoulder-press', 'pike-pushups', 'rear-delt-fly', 'face-pull-machine'],
      keywords: ['шраги', 'трапеции', 'плеч', 'удержание', 'дельт'],
      reason: 'может усиливать напряжение шеи и трапеций',
    },
    hip: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'romanian-deadlift', 'good-morning-bodyweight', 'bulgarian-split-squat', 'reverse-lunge', 'hip-thrust', 'single-leg-bridge', 'side-plank'],
      keywords: ['таз', 'ягод', 'присед', 'выпад', 'тяга', 'мост', 'бедро'],
      reason: 'нагружает таз, ягодицы и тазобедренную зону',
    },
    thigh: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'bulgarian-split-squat', 'reverse-lunge', 'wall-sit', 'romanian-deadlift', 'stepper-easy', 'stepper-intervals', 'stepper-short'],
      keywords: ['ноги', 'бедро', 'присед', 'выпад', 'степпер', 'тяга'],
      reason: 'нагружает бедро и ноги',
    },
    'shin-foot': {
      exerciseIds: ['stepper-easy', 'stepper-intervals', 'stepper-short', 'calf-raise', 'reverse-lunge', 'bulgarian-split-squat'],
      keywords: ['степпер', 'икры', 'носки', 'выпад', 'голень', 'стопа'],
      reason: 'нагружает голень, стопу и устойчивость',
    },
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      await DB.openDB();
      await DB.seedIfNeeded();
      bindGlobalEvents();
      registerServiceWorker();
      updateOnlineStatus();
      await loadState();
      if (!state.profiles.length) {
        showProfileOnboarding();
        hideSplash();
        afterAppReady();
        return;
      }
      await ensurePersonalActiveProgram();
      await restoreDraftWorkout();
      const initialRoute = routeFromHash() || 'home';
      if (initialRoute === 'workout') {
        history.replaceState(null, '', '#/home');
        navigate('home', false);
      } else {
        navigate(initialRoute, false);
      }
      hideSplash();
      afterAppReady();
    } catch (error) {
      console.error(error);
      hideSplash(true);
      el.main.innerHTML = `<div class="notice danger"><strong>Не удалось запустить приложение.</strong><br>${escapeHTML(error.message)}</div>`;
    }
  }


  function hideSplash(force = false) {
    const splash = el.splash;
    if (!splash || splash.dataset.state === 'hiding') return;
    splash.dataset.state = 'hiding';
    const minimumVisibleMs = 650;
    const delay = force ? 0 : Math.max(0, minimumVisibleMs - (Date.now() - BOOT_STARTED_AT));
    window.setTimeout(() => {
      splash.classList.add('app-splash-exit');
      const removeSplash = () => splash.remove();
      splash.addEventListener('transitionend', removeSplash, { once: true });
      window.setTimeout(removeSplash, 520);
    }, delay);
  }

  async function loadState() {
    const [profiles, activeProfileId, exercises, programs] = await Promise.all([
      DB.getProfiles(),
      DB.getActiveProfileId(),
      DB.getAll('exercises'),
      DB.getAll('programs'),
    ]);
    state.profiles = profiles;
    state.allExercises = exercises;
    state.allPrograms = programs;
    state.exercises = exercises;
    state.programs = programs;

    if (!profiles.length) {
      state.activeProfileId = null;
      state.profile = null;
      state.nutrition = null;
      state.settings = {};
      state.workouts = [];
      state.measurements = [];
      state.photos = [];
      state.painEntries = [];
      updateProfileButton();
      return;
    }

    state.activeProfileId = profiles.some((profile) => profile.id === activeProfileId) ? activeProfileId : profiles[0].id;
    if (state.activeProfileId !== activeProfileId) await DB.setActiveProfileId(state.activeProfileId);
    await loadActiveProfileData();
  }

  async function loadActiveProfileData() {
    const profileId = state.activeProfileId;
    const [profile, nutrition, settings, workouts, measurements, photos, painEntries] = await Promise.all([
      DB.get('profile', profileId),
      DB.get('nutrition', profileId),
      DB.getSettingsObject(profileId),
      DB.getAllForProfile('workouts', profileId),
      DB.getAllForProfile('measurements', profileId),
      DB.getAllForProfile('photos', profileId),
      DB.getAllForProfile('painEntries', profileId).catch(() => []),
    ]);
    state.profile = profile;
    state.nutrition = nutrition || { id: profileId, ...clone(window.NIKITA_SEED.nutrition) };
    state.settings = { ...clone(window.NIKITA_SEED.settings), ...settings };
    state.exercises = state.allExercises.filter((exercise) => !exercise.ownerProfileId || exercise.ownerProfileId === profileId);
    state.programs = state.allPrograms.filter((program) => !program.ownerProfileId || program.ownerProfileId === profileId);
    state.workouts = workouts.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    state.measurements = measurements.sort((a, b) => b.date.localeCompare(a.date));
    state.photos = photos.sort((a, b) => b.date.localeCompare(a.date));
    state.painEntries = painEntries.sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
    updateProfileButton();
  }

  function bindGlobalEvents() {
    el.nav.forEach((button) => button.addEventListener('click', () => navigate(button.dataset.route)));
    el.quickAdd.addEventListener('click', showQuickAdd);
    el.profileSwitch.addEventListener('click', showProfileSwitcher);
    window.addEventListener('hashchange', () => navigate(routeFromHash(), false));
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    el.timerMinus.addEventListener('click', () => adjustTimer(-15));
    el.timerPlus.addEventListener('click', () => adjustTimer(15));
    el.timerSkip.addEventListener('click', stopRestTimer);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushDraftSave().catch((error) => console.warn('Draft save on hide failed', error));
      if (!document.hidden && state.timer.endsAt) syncTimerFromEnd();
    });
    window.addEventListener('pagehide', () => {
      flushDraftSave().catch((error) => console.warn('Draft save on pagehide failed', error));
    });
  }

  function routeFromHash() {
    return location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  }

  function navigate(route, updateHash = true) {
    const allowed = ['home', 'plan', 'history', 'progress', 'more', 'workout'];
    state.route = allowed.includes(route) ? route : 'home';
    if (updateHash && location.hash !== `#/${state.route}`) history.pushState(null, '', `#/${state.route}`);
    el.nav.forEach((button) => button.classList.toggle('active', button.dataset.route === state.route));
    document.querySelector('.bottom-nav').classList.toggle('hidden', state.route === 'workout');
    el.quickAdd.classList.toggle('hidden', state.route === 'workout');
    el.profileSwitch.classList.toggle('hidden', state.route === 'workout');
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function render() {
    revokePhotoUrls();
    switch (state.route) {
      case 'home': renderHome(); break;
      case 'plan': renderPlan(); break;
      case 'history': renderHistory(); break;
      case 'progress': renderProgress(); break;
      case 'more': renderMore(); break;
      case 'workout': renderWorkout(); break;
      default: renderHome();
    }
  }

  function setTopbar(title, eyebrow = '') {
    el.topbarTitle.textContent = title;
    el.topbarEyebrow.textContent = eyebrow || (state.profile ? `Профиль: ${state.profile.name}` : 'Тренировки');
  }

  function updateProfileButton() {
    if (!el.profileInitial) return;
    const name = state.profile?.name || '?';
    el.profileInitial.textContent = name.trim().charAt(0).toUpperCase() || '?';
    el.profileSwitch.title = state.profile ? `Профиль: ${state.profile.name}` : 'Создать профиль';
  }

  function getExercise(id) {
    return state.exercises.find((exercise) => exercise.id === id);
  }

  function getExerciseGuide(exerciseId) {
    return window.EXERCISE_GUIDES?.[exerciseId] || null;
  }

  function renderGuideBody(exerciseId, compact = false) {
    const guide = getExerciseGuide(exerciseId);
    if (!guide) return '<div class="help">Описание для этого упражнения пока не добавлено.</div>';
    return `
      <div class="guide-body ${compact ? 'compact' : ''}">
        <div class="guide-section first">
          <h4>Как выполнять</h4>
          <ol>${guide.steps.map((step) => `<li>${escapeHTML(step)}</li>`).join('')}</ol>
        </div>
        <div class="guide-facts">
          <div><strong>Дыхание</strong><span>${escapeHTML(guide.breathing)}</span></div>
          <div><strong>Частые ошибки</strong><span>${escapeHTML(guide.mistakes)}</span></div>
          <div><strong>Подсказка</strong><span>${escapeHTML(guide.tip)}</span></div>
        </div>
      </div>
    `;
  }

  function renderHomeExercise(entry, index) {
    const exercise = getExercise(entry.exerciseId);
    return `
      <details class="home-exercise-details">
        <summary class="exercise-line">
          <span class="exercise-index">${index + 1}</span>
          <div><div class="exercise-name">${escapeHTML(exercise?.name || entry.exerciseId)}</div><div class="exercise-sub">${workPrescription(exercise, entry)}</div></div>
          <span class="exercise-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="home-guide-wrap">${renderGuideBody(entry.exerciseId, true)}</div>
      </details>
    `;
  }


  function getActiveProgram() {
    return state.programs.find((program) => program.id === state.settings.activeProgramId) || state.programs[0];
  }

  function isProgramTemplate(program) {
    return Boolean(program && !program.ownerProfileId);
  }

  function normalizedProgramName(program) {
    return String(program?.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getTemplateForProgram(program) {
    const templateId = program?.templateId;
    if (!templateId) return null;
    return state.allPrograms.find((item) => !item.ownerProfileId && item.id === templateId) || null;
  }

  function isUntouchedTemplateCopy(program) {
    if (!program?.ownerProfileId || !program.templateId) return false;
    const template = getTemplateForProgram(program);
    return Boolean(template && normalizedProgramName(program) === normalizedProgramName(template));
  }

  function programChoiceKey(program) {
    if (!program) return '';
    if (isProgramTemplate(program)) return `template:${program.id}`;
    if (isUntouchedTemplateCopy(program)) return `template:${program.templateId}`;
    return `program:${program.id}`;
  }

  function programSortTime(program) {
    return new Date(program?.updatedAt || program?.createdAt || 0).getTime() || 0;
  }

  function getProgramChoices() {
    const active = getActiveProgram();
    const groups = new Map();
    for (const program of state.programs) {
      const key = programChoiceKey(program);
      if (!key) continue;
      const current = groups.get(key);
      const currentScore = current ? (current.id === active?.id ? 4 : current.ownerProfileId ? 2 : 1) : 0;
      const nextScore = (program.id === active?.id ? 4 : program.ownerProfileId ? 2 : 1);
      const shouldReplace = !current || nextScore > currentScore || (nextScore === currentScore && programSortTime(program) > programSortTime(current));
      if (shouldReplace) groups.set(key, program);
    }
    const choices = [...groups.values()];
    choices.sort((a, b) => {
      if (a.id === active?.id) return -1;
      if (b.id === active?.id) return 1;
      const aTemplate = isProgramTemplate(a) || isUntouchedTemplateCopy(a);
      const bTemplate = isProgramTemplate(b) || isUntouchedTemplateCopy(b);
      if (aTemplate !== bTemplate) return aTemplate ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    return choices;
  }

  function findPersonalProgramForTemplate(templateId) {
    const template = state.allPrograms.find((item) => !item.ownerProfileId && item.id === templateId);
    return state.programs
      .filter((program) => program.ownerProfileId === state.activeProfileId && program.templateId === templateId && (!template || normalizedProgramName(program) === normalizedProgramName(template)))
      .sort((a, b) => programSortTime(b) - programSortTime(a))[0] || null;
  }

  async function createPersonalProgramFromTemplate(template, profileId = state.activeProfileId) {
    const personal = clone(template);
    personal.id = uid(`program-${profileId}`);
    personal.ownerProfileId = profileId;
    personal.templateId = template.templateId || template.id;
    personal.createdAt = new Date().toISOString();
    personal.updatedAt = personal.createdAt;
    personal.days = personal.days.map((day) => ({ ...day, id: uid('day') }));
    await DB.put('programs', personal);
    state.allPrograms.push(personal);
    if (profileId === state.activeProfileId) state.programs.push(personal);
    return personal;
  }

  async function ensurePersonalActiveProgram() {
    const active = getActiveProgram();
    if (!active || !isProgramTemplate(active)) return active;
    const existing = findPersonalProgramForTemplate(active.id);
    const personal = existing || await createPersonalProgramFromTemplate(active);
    state.settings.activeProgramId = personal.id;
    state.settings.currentDayIndex = Math.min(Number(state.settings.currentDayIndex || 0), Math.max(personal.days.length - 1, 0));
    await DB.setSettingsObject({
      activeProgramId: personal.id,
      currentDayIndex: state.settings.currentDayIndex,
    }, state.activeProfileId);
    return personal;
  }

  function getCurrentDay() {
    const program = getActiveProgram();
    const index = Math.min(Number(state.settings.currentDayIndex || 0), Math.max(program.days.length - 1, 0));
    return { program, day: program.days[index], index };
  }

  function renderHome() {
    const { program, day, index } = getCurrentDay();
    const today = new Date();
    const weekWorkouts = workoutsSince(startOfWeek(today));
    const completedThisWeek = weekWorkouts.filter((w) => w.status === 'completed').length;
    const totalMinutes = Math.round(weekWorkouts.reduce((sum, w) => sum + (w.durationSec || 0), 0) / 60);
    const lastWorkout = state.workouts.find((w) => w.status === 'completed');
    const latestMeasurement = state.measurements[0];
    const streak = calculateStreak();
    const draft = state.currentWorkout?.status === 'in_progress' ? state.currentWorkout : null;
    const nutrition = day.recovery ? {
      calories: state.nutrition.recoveryCalories,
      protein: state.nutrition.proteinG,
      fat: state.nutrition.recoveryFatG,
      carbs: state.nutrition.recoveryCarbsG,
    } : {
      calories: state.nutrition.trainingCalories,
      protein: state.nutrition.proteinG,
      fat: state.nutrition.trainingFatG,
      carbs: state.nutrition.trainingCarbsG,
    };

    setTopbar(formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }), `День ${index + 1} из ${program.days.length}`);

    el.main.innerHTML = `
      ${draft ? `
        <section class="section">
          <div class="card hero-card smart-start-card draft-card">
            <span class="chip accent">НЕЗАВЕРШЁННАЯ</span>
            <h2>${escapeHTML(draft.dayName)}</h2>
            <p>Черновик сохранён на телефоне. Сначала продолжи его или удали — новая тренировка не перезапишет данные.</p>
            <div class="hero-meta">
              <span class="chip">Выполнено ${workoutCompletion(draft)}%</span>
              <span class="chip">Идёт ${formatDuration(elapsedSeconds(draft.startedAt))}</span>
            </div>
            <div class="button-row smart-actions">
              <button class="button primary" id="resume-draft" type="button">Продолжить черновик</button>
              <button class="button danger" id="delete-draft-home" type="button">Удалить</button>
            </div>
          </div>
        </section>
      ` : ''}
      <section class="section">
        <div class="card hero-card smart-start-card">
          <div class="smart-start-topline">
            <span class="chip accent">${day.recovery ? 'ВОССТАНОВЛЕНИЕ' : 'УМНЫЙ СТАРТ'}</span>
            <span class="chip">Цикл не привязан к дням недели</span>
          </div>
          <h2>${escapeHTML(day.name)}</h2>
          <p>${escapeHTML(day.focus || program.description)}</p>
          <div class="hero-meta">
            <span class="chip">◷ ≈ ${day.durationMin} мин</span>
            <span class="chip">${day.exercises.length} упражнений</span>
            <span class="chip">Серия: ${streak} дн.</span>
          </div>
          <div class="exercise-list">
            ${day.exercises.slice(0, 6).map((entry, i) => renderHomeExercise(entry, i)).join('')}
            ${day.exercises.length > 6 ? `
              <div id="home-extra-exercises" hidden>${day.exercises.slice(6).map((entry, i) => renderHomeExercise(entry, i + 6)).join('')}</div>
              <button class="show-more-exercises" id="toggle-extra-exercises" type="button">Показать ещё ${day.exercises.length - 6}</button>
            ` : ''}
          </div>
          ${draft ? `
            <div class="notice"><strong>Сначала разберись с черновиком выше.</strong><br>После этого можно продолжить цикл, повторить прошлую или выбрать другой день.</div>
          ` : `
            <div class="button-row smart-actions primary-line">
              <button class="button primary" id="start-cycle" type="button">Продолжить цикл</button>
              <button class="button secondary" id="choose-workout" type="button">Выбрать другую</button>
              <button class="button secondary" id="repeat-last" type="button" ${lastWorkout ? '' : 'disabled'}>Повторить прошлую</button>
              <button class="button ghost" id="start-short" type="button">Нет сил · 15–20 мин</button>
            </div>
            <div class="help smart-start-help">«Повторить прошлую» и «Выбрать другую» не сдвигают основной цикл. Цикл двигается только после кнопки «Продолжить цикл».</div>
          `}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Эта неделя</h2><button class="link-button" data-go="history">История</button></div>
        <div class="stats-grid">
          <div class="stat"><div class="stat-value">${completedThisWeek}</div><div class="stat-label">тренировки</div></div>
          <div class="stat"><div class="stat-value">${totalMinutes}</div><div class="stat-label">минут</div></div>
          <div class="stat"><div class="stat-value">${Math.round(avgCompletion(weekWorkouts))}%</div><div class="stat-label">выполнение</div></div>
          <div class="stat"><div class="stat-value">${formatCompactLoad(weekWorkouts.reduce((s, w) => s + (w.totalLoadKg || 0), 0))}</div><div class="stat-label">нагрузка, кг</div></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Текущие данные</h2><button class="link-button" id="add-measurement-home">Добавить</button></div>
        <div class="card">
          <div class="stats-grid">
            <div><div class="stat-value">${latestMeasurement?.weightKg ?? state.profile.currentWeightKg}</div><div class="stat-label">вес, кг</div></div>
            <div><div class="stat-value">${latestMeasurement?.waistCm ?? '—'}</div><div class="stat-label">талия, см</div></div>
            <div><div class="stat-value">${latestMeasurement?.abdomenCm ?? '—'}</div><div class="stat-label">живот, см</div></div>
            <div><div class="stat-value">${latestMeasurement ? formatShortDate(latestMeasurement.date) : '—'}</div><div class="stat-label">последний замер</div></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Питание сегодня</h2><button class="link-button" data-go="more">Настроить</button></div>
        <div class="card">
          <div class="stats-grid">
            <div><div class="stat-value">${nutrition.calories}</div><div class="stat-label">ккал</div></div>
            <div><div class="stat-value">${nutrition.protein}</div><div class="stat-label">белок, г</div></div>
            <div><div class="stat-value">${nutrition.fat}</div><div class="stat-label">жиры, г</div></div>
            <div><div class="stat-value">${nutrition.carbs}</div><div class="stat-label">углеводы, г</div></div>
          </div>
          <div class="divider"></div>
          <div class="help">${escapeHTML(state.nutrition.note)}</div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Последняя тренировка</h2></div>
        ${lastWorkout ? workoutSummaryCard(lastWorkout) : `<div class="card empty"><strong>История пока пустая</strong>После первой тренировки приложение запомнит веса и начнёт предлагать прогрессию.</div>`}
      </section>

      <div class="notice warning"><strong>Судно и безопасность.</strong> При сильной качке замени упражнения стоя с тяжёлым весом на варианты сидя, лёжа или с опорой. При боли в паху, животе, пояснице или суставах — остановись, а не геройствуй.</div>
    `;

    document.getElementById('start-cycle')?.addEventListener('click', () => startWorkout({ shortMode: false, startMode: 'cycle', shouldAdvanceCycle: true }));
    document.getElementById('start-short')?.addEventListener('click', () => startWorkout({ shortMode: true, startMode: 'cycle', shouldAdvanceCycle: true }));
    document.getElementById('repeat-last')?.addEventListener('click', repeatLastWorkout);
    document.getElementById('choose-workout')?.addEventListener('click', showChooseWorkoutModal);
    document.getElementById('resume-draft')?.addEventListener('click', () => navigate('workout'));
    document.getElementById('delete-draft-home')?.addEventListener('click', discardDraftFromHome);
    document.getElementById('add-measurement-home').addEventListener('click', showMeasurementModal);
    document.getElementById('toggle-extra-exercises')?.addEventListener('click', (event) => {
      const extra = document.getElementById('home-extra-exercises');
      const opening = extra.hidden;
      extra.hidden = !opening;
      event.currentTarget.textContent = opening ? 'Скрыть дополнительные упражнения' : `Показать ещё ${day.exercises.length - 6}`;
    });
    bindGoButtons();
    el.main.querySelectorAll('.view-workout').forEach((button) => button.addEventListener('click', () => showWorkoutDetails(button.dataset.id)));
  }

  function currentDayIndexSafe() {
    const program = getActiveProgram();
    const raw = Number(state.settings.currentDayIndex || 0);
    return Math.min(Math.max(raw, 0), Math.max((program?.days?.length || 1) - 1, 0));
  }

  function findRepeatDayIndex(workout) {
    const program = getActiveProgram();
    if (!workout || !program?.days?.length) return -1;
    const sameDay = program.days.findIndex((day) => day.id === workout.dayId);
    if (sameDay >= 0) return sameDay;
    const rawIndex = Number(workout.dayIndex);
    if (Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < program.days.length) return rawIndex;
    return -1;
  }

  async function repeatLastWorkout() {
    const lastWorkout = state.workouts.find((w) => w.status === 'completed');
    if (!lastWorkout) return toast('Пока нечего повторять: история тренировок пустая');
    const dayIndex = findRepeatDayIndex(lastWorkout);
    if (dayIndex < 0) return toast('Не нашёл этот день в активной программе');
    await startWorkout({ dayIndex, startMode: 'repeat', shouldAdvanceCycle: false });
  }

  function showChooseWorkoutModal() {
    const { program } = getCurrentDay();
    showModal(`
      <div class="modal-head"><h2>Выбрать тренировку</h2><button class="modal-close" data-close>×</button></div>
      <p class="muted">Запуск другого дня не меняет текущий день цикла. Это удобно, если хочется переставить тренировки местами без наказаний.</p>
      <div class="card list-card smart-day-list" style="margin-top:12px">
        ${program.days.map((day, index) => `
          <button class="list-row choose-workout-day" type="button" data-index="${index}">
            <div class="day-badge small-badge">${index + 1}</div>
            <div class="list-row-main">
              <div class="list-row-title">${escapeHTML(day.name)}</div>
              <div class="list-row-sub">≈ ${day.durationMin} мин · ${day.exercises.length} упражнений</div>
            </div>
            <span class="muted">›</span>
          </button>
        `).join('')}
      </div>
      <div class="notice" style="margin-top:12px"><strong>Цикл останется на месте.</strong><br>После сохранения этой тренировки приложение не перепрыгнет на следующий день.</div>
    `);
    el.modalRoot.querySelectorAll('.choose-workout-day').forEach((button) => {
      button.addEventListener('click', async () => {
        const dayIndex = Number(button.dataset.index);
        closeModal();
        await startWorkout({ dayIndex, startMode: 'selected', shouldAdvanceCycle: false });
      });
    });
  }

  function workPrescription(exercise, entry = {}) {
    if (!exercise) return '';
    const d = { ...exercise.defaults, ...entry };
    if (d.unit === 'minutes') return `${d.durationMin || exercise.defaults.durationMin} мин`;
    if (d.unit === 'seconds') return `${d.sets} × ${d.durationSec || exercise.defaults.durationSec} сек`;
    return `${d.sets} × ${d.repsMin}${d.repsMax && d.repsMax !== d.repsMin ? `–${d.repsMax}` : ''}`;
  }


  function getPainArea(id) {
    return painAreas.find((area) => area.id === id) || painAreas[painAreas.length - 1];
  }

  function painLevelMeta(score) {
    const value = Math.max(1, Math.min(10, Number(score) || 1));
    if (value >= 7) return { score: value, level: 'high', label: 'сильная боль', title: 'Не рекомендуется' };
    if (value >= 4) return { score: value, level: 'moderate', label: 'осторожный режим', title: 'Осторожно' };
    return { score: value, level: 'low', label: 'лёгкий дискомфорт', title: 'Аккуратно' };
  }

  function normalizePainInput(input = {}) {
    if (!input || !input.hasPain) return { hasPain: false };
    const area = getPainArea(input.areaId);
    const meta = painLevelMeta(input.score);
    return {
      hasPain: true,
      areaId: area.id,
      areaLabel: area.label,
      score: meta.score,
      level: meta.level,
      levelLabel: meta.label,
      comment: String(input.comment || '').trim(),
      createdAt: input.createdAt || new Date().toISOString(),
    };
  }

  function exerciseMatchesPainRule(exercise, rule) {
    if (!exercise || !rule) return false;
    if (rule.exerciseIds?.includes(exercise.id)) return true;
    const haystack = `${exercise.id} ${exercise.name} ${exercise.group} ${exercise.equipment}`.toLowerCase();
    return (rule.keywords || []).some((word) => haystack.includes(String(word).toLowerCase()));
  }

  function analyzeExercisePainRisk(pain, exercise) {
    const normalized = normalizePainInput(pain);
    if (!normalized.hasPain) return null;
    const rule = painRiskRules[normalized.areaId];
    if (!exerciseMatchesPainRule(exercise, rule)) return null;
    const meta = painLevelMeta(normalized.score);
    if (meta.score <= 3) {
      return {
        areaId: normalized.areaId,
        areaLabel: normalized.areaLabel,
        score: meta.score,
        level: meta.level,
        title: meta.title,
        reason: rule.reason,
        message: `Лёгкий дискомфорт в зоне «${normalized.areaLabel}»: работай без отказа и без резкого увеличения веса.`,
        action: null,
      };
    }
    return {
      areaId: normalized.areaId,
      areaLabel: normalized.areaLabel,
      score: meta.score,
      level: meta.level,
      title: meta.title,
      reason: rule.reason,
      message: meta.level === 'high'
        ? `Сильная боль в зоне «${normalized.areaLabel}»: это упражнение лучше не делать сегодня, потому что оно ${rule.reason}.`
        : `Боль в зоне «${normalized.areaLabel}»: упражнение ${rule.reason}. Лучше снизить нагрузку, заменить или пропустить.`,
      action: null,
    };
  }

  function painRiskClass(risk) {
    if (!risk) return '';
    return risk.level === 'high' ? 'pain-high' : risk.level === 'moderate' ? 'pain-moderate' : 'pain-low';
  }

  function renderPainRiskNotice(risk, exerciseIndex) {
    if (!risk) return '';
    const high = risk.level === 'high';
    return `
      <div class="pain-warning ${painRiskClass(risk)}">
        <div class="pain-warning-icon" aria-hidden="true">⚠️</div>
        <div class="pain-warning-body">
          <strong>${escapeHTML(risk.title)} · ${escapeHTML(risk.areaLabel)} ${risk.score}/10</strong>
          <div>${escapeHTML(risk.message)}</div>
          ${risk.action ? `<div class="help">Действие: ${escapeHTML(painActionLabel(risk.action))}</div>` : ''}
          <div class="pain-actions">
            <button class="button secondary small pain-action" data-index="${exerciseIndex}" data-action="reduce" type="button">Снизить вес</button>
            <button class="button secondary small pain-action" data-index="${exerciseIndex}" data-action="replace" type="button">Заменить</button>
            <button class="button ${high ? 'danger' : 'ghost'} small pain-action" data-index="${exerciseIndex}" data-action="skip" type="button">Пропустить</button>
            <button class="button ghost small pain-action" data-index="${exerciseIndex}" data-action="keep" type="button">Оставить</button>
          </div>
        </div>
      </div>`;
  }

  function painActionLabel(action) {
    return ({ reduce: 'вес снижен', replace: 'выбрана замена', skip: 'упражнение пропущено', keep: 'оставлено как есть' })[action] || action || 'отмечено';
  }

  function renderWorkoutPainBanner(workout) {
    const pain = normalizePainInput(workout?.preWorkoutPain);
    if (!pain.hasPain) return '';
    const meta = painLevelMeta(pain.score);
    return `
      <section class="card pain-session-banner ${meta.level}">
        <div class="pain-session-icon">⚠️</div>
        <div>
          <div class="eyebrow">Контроль боли включён</div>
          <strong>${escapeHTML(pain.areaLabel)} · ${pain.score}/10 · ${escapeHTML(meta.label)}</strong>
          <div class="help">Рискованные упражнения помечены предупреждением. Приложение подскажет снизить вес, заменить или пропустить.</div>
          ${pain.comment ? `<div class="help">Комментарий: ${escapeHTML(pain.comment)}</div>` : ''}
        </div>
      </section>`;
  }

  function renderPainEntry(entry) {
    const meta = painLevelMeta(entry.score);
    const source = entry.source === 'exercise' ? `во время: ${entry.exerciseName || 'упражнение'}` : entry.source === 'risk_action' ? 'действие по предупреждению' : 'перед тренировкой';
    return `<div class="list-row pain-history-row">
      <div class="pain-dot ${meta.level}">!</div>
      <div class="list-row-main">
        <div class="list-row-title">${escapeHTML(entry.areaLabel || getPainArea(entry.areaId).label)} · ${entry.score}/10</div>
        <div class="list-row-sub">${formatShortDate(entry.date || todayISO())} · ${escapeHTML(source)}${entry.comment ? `<br>${escapeHTML(entry.comment)}` : ''}</div>
      </div>
    </div>`;
  }

  async function savePainEntry(entry) {
    if (!state.activeProfileId) return null;
    const row = {
      id: entry.id || uid('pain'),
      profileId: state.activeProfileId,
      date: entry.date || todayISO(),
      createdAt: entry.createdAt || new Date().toISOString(),
      workoutId: entry.workoutId || state.currentWorkout?.id || null,
      source: entry.source || 'pre_workout',
      areaId: entry.areaId,
      areaLabel: entry.areaLabel || getPainArea(entry.areaId).label,
      score: Number(entry.score) || 1,
      level: painLevelMeta(entry.score).level,
      exerciseId: entry.exerciseId || null,
      exerciseName: entry.exerciseName || null,
      action: entry.action || null,
      comment: String(entry.comment || '').trim(),
    };
    await DB.put('painEntries', row);
    state.painEntries.unshift(row);
    return row;
  }


  function showPreWorkoutPainModal(startConfig = {}) {
    showModal(`
      <div class="modal-head"><h2>Самочувствие перед тренировкой</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice"><strong>Есть боль или дискомфорт сегодня?</strong><br>Если да — выбери область и степень. Приложение пометит упражнения, которые лучше облегчить, заменить или пропустить.</div>
      <div class="button-row" style="margin-top:12px">
        <button class="button primary" id="start-without-pain" type="button">Нет, всё нормально</button>
        <button class="button secondary" id="show-pain-form" type="button">Да, отметить</button>
      </div>
      <div id="pre-pain-form" class="pain-form" hidden>
        <div class="field" style="margin-top:14px">
          <label>Область боли</label>
          <div class="pain-area-grid">
            ${painAreas.map((area) => `<button class="pain-area-option" type="button" data-area="${area.id}">${escapeHTML(area.label)}</button>`).join('')}
          </div>
          <input id="pre-pain-area" type="hidden" value="">
        </div>
        <div class="field">
          <label>Степень боли</label>
          <div class="pain-level-picker">
            ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button class="pain-level-option ${n === 4 ? 'active' : ''}" type="button" data-score="${n}">${n}</button>`).join('')}
          </div>
          <input id="pre-pain-score" type="hidden" value="4">
          <div class="help">1–3 — лёгкий дискомфорт, 4–6 — осторожный режим, 7–10 — лучше не делать рискованные упражнения.</div>
        </div>
        <div class="field"><label>Комментарий</label><textarea id="pre-pain-comment" placeholder="Например: паховая область ноет после смены"></textarea></div>
        <button class="button primary full" id="start-with-pain" type="button">Включить контроль боли и начать</button>
      </div>
    `);
    document.getElementById('start-without-pain').addEventListener('click', async () => {
      closeModal();
      await startWorkout({ ...startConfig, painCheckDone: true, preWorkoutPain: { hasPain: false } });
    });
    document.getElementById('show-pain-form').addEventListener('click', () => {
      document.getElementById('pre-pain-form').hidden = false;
      document.getElementById('show-pain-form').classList.add('active');
    });
    el.modalRoot.querySelectorAll('.pain-area-option').forEach((button) => {
      button.addEventListener('click', () => {
        el.modalRoot.querySelectorAll('.pain-area-option').forEach((item) => item.classList.toggle('active', item === button));
        document.getElementById('pre-pain-area').value = button.dataset.area;
      });
    });
    el.modalRoot.querySelectorAll('.pain-level-option').forEach((button) => {
      button.addEventListener('click', () => {
        el.modalRoot.querySelectorAll('.pain-level-option').forEach((item) => item.classList.toggle('active', item === button));
        document.getElementById('pre-pain-score').value = button.dataset.score;
      });
    });
    document.getElementById('start-with-pain').addEventListener('click', async () => {
      const areaId = document.getElementById('pre-pain-area').value;
      if (!areaId) {
        toast('Выбери область боли');
        return;
      }
      const preWorkoutPain = normalizePainInput({
        hasPain: true,
        areaId,
        score: Number(document.getElementById('pre-pain-score').value || 4),
        comment: document.getElementById('pre-pain-comment').value,
      });
      closeModal();
      await startWorkout({ ...startConfig, painCheckDone: true, preWorkoutPain });
    });
  }

  async function startWorkout(options = {}) {
    const config = typeof options === 'boolean' ? { shortMode: options } : { ...options };
    const shortMode = Boolean(config.shortMode);
    if (state.currentWorkout) {
      toast('Сначала продолжи или удали сохранённый черновик');
      navigate('workout');
      return;
    }
    const program = getActiveProgram();
    const fallbackIndex = Number(state.settings.currentDayIndex || 0);
    const requestedIndex = Number.isFinite(Number(config.dayIndex)) ? Number(config.dayIndex) : fallbackIndex;
    const index = Math.min(Math.max(requestedIndex, 0), Math.max(program.days.length - 1, 0));
    const day = program.days[index];
    const startMode = config.startMode || (index === fallbackIndex ? 'cycle' : 'selected');
    const shouldAdvanceCycle = config.shouldAdvanceCycle ?? (startMode === 'cycle');
    const selected = shortMode
      ? (day.short || day.exercises.slice(0, 5).map((x) => x.exerciseId)).map((id) => day.exercises.find((x) => x.exerciseId === id) || { exerciseId: id })
      : day.exercises;

    if (!selected.length) {
      toast('В этом дне пока нет упражнений. Открой План и добавь их через ✎');
      navigate('plan');
      return;
    }

    if (!config.painCheckDone) {
      showPreWorkoutPainModal({ ...config, shortMode, dayIndex: index, startMode, shouldAdvanceCycle });
      return;
    }

    const preWorkoutPain = normalizePainInput(config.preWorkoutPain);
    const exerciseResults = [];
    for (const entry of selected) {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) continue;
      const defaults = { ...exercise.defaults, ...entry };
      if (shortMode && defaults.unit === 'minutes') {
        defaults.durationMin = exercise.equipment === 'Степпер' ? Math.min(defaults.durationMin || 10, 10) : Math.min(defaults.durationMin || 4, 4);
      }
      const last = findLastExerciseResult(exercise.id);
      const suggestion = progressionSuggestion(exercise, last);
      const setsCount = shortMode ? Math.min(defaults.sets || 1, defaults.unit === 'reps' ? 2 : 1) : (defaults.sets || 1);
      const setRows = Array.from({ length: setsCount }, (_, i) => ({
        number: i + 1,
        weightKg: defaults.unit === 'reps'
          ? previousSetValue(last, i, 'weightKg', defaults.weightKg ?? suggestion.weightKg ?? '')
          : '',
        reps: defaults.unit === 'reps'
          ? previousSetValue(last, i, 'reps', defaults.repsMin ?? '')
          : '',
        durationSec: defaults.unit === 'seconds'
          ? previousSetValue(last, i, 'durationSec', defaults.durationSec || 30)
          : null,
        durationMin: defaults.unit === 'minutes'
          ? previousSetValue(last, i, 'durationMin', defaults.durationMin || 10)
          : null,
        difficulty: 'normal',
        completed: false,
      }));
      const painRisk = analyzeExercisePainRisk(preWorkoutPain, exercise);
      exerciseResults.push({
        exerciseId: exercise.id,
        name: exercise.name,
        skipped: false,
        replacementOf: null,
        comment: '',
        previous: last ? summarizePrevious(last) : null,
        prefilledFromLast: completedSets(last).length > 0,
        suggestion,
        painRisk,
        painEvents: [],
        defaults,
        sets: setRows,
      });
    }

    if (!exerciseResults.length) {
      toast('Не удалось собрать тренировку: упражнения не найдены');
      return;
    }

    const suffix = shortMode ? 'короткая' : startMode === 'repeat' ? 'повтор' : startMode === 'selected' ? 'выбрана вручную' : '';
    state.currentWorkout = {
      id: uid('workout'),
      profileId: state.activeProfileId,
      date: todayISO(),
      startedAt: new Date().toISOString(),
      programId: program.id,
      programName: program.name,
      dayId: day.id,
      dayIndex: index,
      cycleDayIndex: fallbackIndex,
      dayName: suffix ? `${day.name} · ${suffix}` : day.name,
      shortMode,
      startMode,
      shouldAdvanceCycle,
      status: 'in_progress',
      preWorkoutPain,
      painCheckedAt: new Date().toISOString(),
      exercises: exerciseResults,
      comment: '',
    };
    if (preWorkoutPain.hasPain) {
      await savePainEntry({ ...preWorkoutPain, source: 'pre_workout', workoutId: state.currentWorkout.id });
    }
    await saveDraftWorkout();
    navigate('workout');
  }

  function renderWorkout() {
    const workout = state.currentWorkout;
    if (!workout) {
      navigate('home');
      return;
    }
    setTopbar(workout.dayName, workout.shortMode ? 'Короткая тренировка' : 'Тренировка идёт');
    el.main.innerHTML = `
      <div class="workout-header">
        <div class="card" style="padding:12px 14px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div><div class="workout-clock" id="workout-clock">00:00</div><div class="muted">время тренировки</div></div>
            <div style="min-width:120px"><div class="right"><strong id="workout-progress-text">0%</strong></div><div class="progress-bar"><span id="workout-progress-bar" style="width:0%"></span></div></div>
          </div>
        </div>
      </div>

      ${renderWorkoutPainBanner(workout)}
      ${workout.exercises.map((result, exerciseIndex) => renderWorkoutExercise(result, exerciseIndex)).join('')}

      <section class="card">
        <div class="field"><label>Комментарий ко всей тренировке</label><textarea id="workout-comment" placeholder="Самочувствие, качка, что изменить…">${escapeHTML(workout.comment || '')}</textarea></div>
      </section>

      <div class="workout-footer">
        <button class="button ghost" id="cancel-workout">Закрыть</button>
        <button class="button primary" id="finish-workout">Завершить</button>
      </div>
    `;
    bindWorkoutEvents();
    updateWorkoutClock();
    state.workoutClockInterval && clearInterval(state.workoutClockInterval);
    state.workoutClockInterval = setInterval(updateWorkoutClock, 1000);
    updateWorkoutProgress();
  }

  function renderWorkoutExercise(result, exerciseIndex) {
    const exercise = getExercise(result.exerciseId);
    const previous = result.previous ? `<span class="chip">Прошлый: ${escapeHTML(result.previous)}</span>` : `<span class="chip">Первое выполнение</span>`;
    const prefilled = result.prefilledFromLast ? `<span class="chip success">Значения подставлены из прошлого раза</span>` : '';
    const suggestion = result.suggestion?.text ? `<span class="chip ${result.suggestion.kind === 'increase' ? 'success' : result.suggestion.kind === 'reduce' ? 'warning' : ''}">${escapeHTML(result.suggestion.text)}</span>` : '';
    return `
      <article class="workout-exercise ${result.skipped ? 'muted' : ''} ${painRiskClass(result.painRisk)}" data-exercise-index="${exerciseIndex}">
        <div class="workout-exercise-head">
          <div class="eyebrow">${exerciseIndex + 1} · ${escapeHTML(exercise?.group || '')}</div>
          <h3>${escapeHTML(result.name)}</h3>
          <div class="exercise-meta">${escapeHTML(exercise?.equipment || '')} · отдых ${result.defaults.restSec || 0} сек</div>
          <div class="hero-meta">${previous}${prefilled}${suggestion}</div>
          ${renderPainRiskNotice(result.painRisk, exerciseIndex)}
          ${exercise?.safety ? `<div class="notice warning" style="margin-top:10px">${escapeHTML(exercise.safety)}</div>` : ''}
          <details class="exercise-guide">
            <summary><span>ⓘ Техника и подсказки</span><span class="exercise-chevron" aria-hidden="true">⌄</span></summary>
            ${renderGuideBody(result.exerciseId)}
          </details>
          <div class="exercise-tools">
            <button class="button secondary small replace-exercise" data-index="${exerciseIndex}" type="button">Заменить</button>
            <button class="button ghost small skip-exercise" data-index="${exerciseIndex}" type="button">${result.skipped ? 'Вернуть' : 'Пропустить'}</button>
            <button class="button ghost small comment-exercise" data-index="${exerciseIndex}" type="button">Комментарий</button>
            <button class="button ghost small pain-exercise" data-index="${exerciseIndex}" type="button">⚠️ Боль</button>
          </div>
          ${result.painEvents?.length ? `<div class="help" style="margin-top:9px">⚠️ Боль отмечена: ${result.painEvents.map((event) => `${escapeHTML(event.areaLabel)} ${event.score}/10`).join(' · ')}</div>` : ''}
          ${result.comment ? `<div class="help" style="margin-top:9px">“${escapeHTML(result.comment)}”</div>` : ''}
        </div>
        <div class="set-list" aria-label="Подходы упражнения ${escapeHTML(result.name)}">
          ${result.sets.map((set, setIndex) => renderWorkoutSet(result, set, setIndex)).join('')}
        </div>
        <div class="button-row" style="padding:0 14px 14px">
          <button class="button secondary small add-set" data-index="${exerciseIndex}" type="button" ${result.skipped ? 'disabled' : ''}>＋ Добавить подход</button>
          ${result.sets.length > 1 ? `<button class="button ghost small remove-set" data-index="${exerciseIndex}" type="button" ${result.skipped ? 'disabled' : ''}>− Убрать последний</button>` : ''}
        </div>
      </article>
    `;
  }

  function renderWorkoutSet(result, set, setIndex) {
    const unit = result.defaults.unit;
    const disabled = result.skipped ? 'disabled' : '';
    const setLabel = `Подход ${set.number}`;
    const controls = unit === 'reps'
      ? `
        <div class="set-control-grid">
          ${renderSetStepper({
            label: 'Вес, кг',
            inputClass: 'set-weight',
            field: 'weightKg',
            value: set.weightKg,
            step: 0.5,
            min: 0,
            inputMode: 'decimal',
            setLabel,
            disabled,
          })}
          ${renderSetStepper({
            label: 'Повторы',
            inputClass: 'set-reps',
            field: 'reps',
            value: set.reps,
            step: 1,
            min: 0,
            inputMode: 'numeric',
            setLabel,
            disabled,
          })}
        </div>
      `
      : `
        <div class="set-control-grid single">
          ${renderSetStepper({
            label: unit === 'minutes' ? 'Минуты' : 'Секунды',
            inputClass: 'set-duration',
            field: unit === 'minutes' ? 'durationMin' : 'durationSec',
            value: unit === 'minutes' ? set.durationMin : set.durationSec,
            step: 1,
            min: 1,
            inputMode: 'numeric',
            setLabel,
            disabled,
          })}
        </div>
      `;

    return `
      <div class="set-row ${set.completed ? 'done' : ''}" data-set-index="${setIndex}">
        <div class="set-row-head">
          <div class="set-badge"><span>Подход</span><strong>${set.number}</strong></div>
          <div class="set-row-actions">
            <label class="set-difficulty-wrap">
              <span>Тяжесть</span>
              <select class="set-select set-difficulty" aria-label="Тяжесть, ${setLabel}" ${disabled}>${difficultyOptions.map(([value, label]) => `<option value="${value}" ${set.difficulty === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
            </label>
            <button class="check-button ${set.completed ? 'done' : ''} complete-set" type="button" aria-label="${set.completed ? 'Снять отметку' : 'Завершить'}, ${setLabel}" ${disabled}>${set.completed ? '✓' : '○'}</button>
          </div>
        </div>
        ${controls}
      </div>
    `;
  }

  function renderSetStepper({ label, inputClass, field, value, step, min, inputMode, setLabel, disabled }) {
    const safeValue = value === null || value === undefined ? '' : value;
    const minusLabel = `Уменьшить: ${label.toLowerCase()}, ${setLabel}`;
    const plusLabel = `Увеличить: ${label.toLowerCase()}, ${setLabel}`;
    return `
      <label class="set-control">
        <span class="set-control-label">${escapeHTML(label)}</span>
        <span class="set-stepper">
          <button class="stepper-button adjust-set" type="button" data-field="${field}" data-delta="-${step}" aria-label="${escapeHTML(minusLabel)}" ${disabled}>−</button>
          <input class="set-input ${inputClass}" type="number" inputmode="${inputMode}" min="${min}" step="${step}" value="${escapeHTML(String(safeValue))}" aria-label="${escapeHTML(`${label}, ${setLabel}`)}" ${disabled}>
          <button class="stepper-button adjust-set" type="button" data-field="${field}" data-delta="${step}" aria-label="${escapeHTML(plusLabel)}" ${disabled}>＋</button>
        </span>
      </label>
    `;
  }

  function bindWorkoutEvents() {
    el.main.querySelectorAll('.workout-exercise').forEach((card) => {
      const exerciseIndex = Number(card.dataset.exerciseIndex);
      card.querySelectorAll('.set-row').forEach((row) => {
        const setIndex = Number(row.dataset.setIndex);
        row.querySelector('.set-weight')?.addEventListener('input', (event) => updateSet(exerciseIndex, setIndex, 'weightKg', numberOrBlank(event.target.value)));
        row.querySelector('.set-reps')?.addEventListener('input', (event) => updateSet(exerciseIndex, setIndex, 'reps', numberOrBlank(event.target.value)));
        row.querySelector('.set-duration')?.addEventListener('input', (event) => {
          const unit = state.currentWorkout.exercises[exerciseIndex].defaults.unit;
          updateSet(exerciseIndex, setIndex, unit === 'minutes' ? 'durationMin' : 'durationSec', numberOrBlank(event.target.value));
        });
        row.querySelectorAll('.set-input').forEach((input) => input.addEventListener('focus', () => input.select()));
        row.querySelectorAll('.adjust-set').forEach((button) => bindSetStepper(button, exerciseIndex, setIndex, row));
        row.querySelector('.set-difficulty')?.addEventListener('change', (event) => updateSet(exerciseIndex, setIndex, 'difficulty', event.target.value));
        row.querySelector('.complete-set')?.addEventListener('click', () => toggleSetComplete(exerciseIndex, setIndex));
      });
    });
    el.main.querySelectorAll('.replace-exercise').forEach((button) => button.addEventListener('click', () => showReplacementModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.skip-exercise').forEach((button) => button.addEventListener('click', () => toggleSkipExercise(Number(button.dataset.index))));
    el.main.querySelectorAll('.comment-exercise').forEach((button) => button.addEventListener('click', () => showExerciseCommentModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.pain-exercise').forEach((button) => button.addEventListener('click', () => showExercisePainModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.pain-action').forEach((button) => button.addEventListener('click', () => applyPainAction(Number(button.dataset.index), button.dataset.action)));
    el.main.querySelectorAll('.add-set').forEach((button) => button.addEventListener('click', () => addWorkoutSet(Number(button.dataset.index))));
    el.main.querySelectorAll('.remove-set').forEach((button) => button.addEventListener('click', () => removeLastWorkoutSet(Number(button.dataset.index))));
    document.getElementById('workout-comment').addEventListener('input', (event) => {
      state.currentWorkout.comment = event.target.value;
      debounceDraftSave();
    });
    document.getElementById('cancel-workout').addEventListener('click', showWorkoutCloseModal);
    document.getElementById('finish-workout').addEventListener('click', showFinishWorkoutModal);
  }

  function updateSet(exerciseIndex, setIndex, field, value) {
    state.currentWorkout.exercises[exerciseIndex].sets[setIndex][field] = value;
    debounceDraftSave();
  }

  function bindSetStepper(button, exerciseIndex, setIndex, row) {
    let holdTimer = null;
    let repeatTimer = null;
    let suppressClick = false;

    const applyStep = () => {
      const field = button.dataset.field;
      const delta = Number(button.dataset.delta);
      const input = row.querySelector(`.set-input.${field === 'weightKg' ? 'set-weight' : field === 'reps' ? 'set-reps' : 'set-duration'}`);
      adjustSetValue(exerciseIndex, setIndex, field, delta, input);
    };

    const stopHold = () => {
      clearTimeout(holdTimer);
      clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
      if (suppressClick) setTimeout(() => { suppressClick = false; }, 250);
    };

    button.addEventListener('pointerdown', (event) => {
      if (button.disabled || event.button !== 0) return;
      holdTimer = setTimeout(() => {
        suppressClick = true;
        applyStep();
        repeatTimer = setInterval(applyStep, 120);
      }, 420);
    });
    button.addEventListener('pointerup', stopHold);
    button.addEventListener('pointercancel', stopHold);
    button.addEventListener('pointerleave', stopHold);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      applyStep();
    });
  }

  function adjustSetValue(exerciseIndex, setIndex, field, delta, input) {
    const set = state.currentWorkout?.exercises?.[exerciseIndex]?.sets?.[setIndex];
    if (!set || !Number.isFinite(delta)) return;

    const minimum = field === 'durationMin' || field === 'durationSec' ? 1 : 0;
    const current = Number(set[field]);
    const base = Number.isFinite(current) ? current : minimum;
    const decimals = field === 'weightKg' ? 2 : 0;
    const next = Math.max(minimum, Number((base + delta).toFixed(decimals)));

    set[field] = next;
    if (input) {
      input.value = String(next);
      input.classList.remove('stepper-pulse');
      void input.offsetWidth;
      input.classList.add('stepper-pulse');
    }
    if (state.settings.vibrationEnabled && navigator.vibrate) navigator.vibrate(8);
    debounceDraftSave();
  }

  async function addWorkoutSet(exerciseIndex) {
    const result = state.currentWorkout?.exercises?.[exerciseIndex];
    if (!result || result.skipped) return;

    const previousSet = result.sets[result.sets.length - 1] || {};
    const unit = result.defaults.unit;
    const newSet = {
      number: result.sets.length + 1,
      weightKg: unit === 'reps' ? (previousSet.weightKg ?? result.defaults.weightKg ?? '') : '',
      reps: unit === 'reps' ? (previousSet.reps ?? result.defaults.repsMin ?? '') : '',
      durationSec: unit === 'seconds' ? (previousSet.durationSec ?? result.defaults.durationSec ?? 30) : null,
      durationMin: unit === 'minutes' ? (previousSet.durationMin ?? result.defaults.durationMin ?? 10) : null,
      difficulty: 'normal',
      completed: false,
      addedManually: true,
    };

    result.sets.push(newSet);
    await saveDraftWorkout();
    renderWorkout();
    toast(`Добавлен подход ${newSet.number}`);
  }

  async function removeLastWorkoutSet(exerciseIndex) {
    const result = state.currentWorkout?.exercises?.[exerciseIndex];
    if (!result || result.skipped || result.sets.length <= 1) return;

    const lastSet = result.sets[result.sets.length - 1];
    if (lastSet.completed) {
      toast('Сначала сними отметку с последнего подхода');
      return;
    }

    result.sets.pop();
    result.sets.forEach((set, index) => { set.number = index + 1; });
    await saveDraftWorkout();
    renderWorkout();
    toast('Последний подход удалён');
  }

  async function toggleSetComplete(exerciseIndex, setIndex) {
    const result = state.currentWorkout.exercises[exerciseIndex];
    const set = result.sets[setIndex];
    set.completed = !set.completed;
    await saveDraftWorkout();
    renderWorkout();
    if (set.completed && result.defaults.restSec > 0) {
      const next = result.sets[setIndex + 1] ? `${result.name} · подход ${setIndex + 2}` : 'Переход к следующему упражнению';
      startRestTimer(result.defaults.restSec, next);
    }
  }

  async function toggleSkipExercise(index) {
    const result = state.currentWorkout.exercises[index];
    result.skipped = !result.skipped;
    if (result.skipped) result.sets.forEach((set) => { set.completed = false; });
    await saveDraftWorkout();
    renderWorkout();
  }

  function showReplacementModal(index) {
    const current = state.currentWorkout.exercises[index];
    const exercise = getExercise(current.exerciseId);
    const replacementIds = exercise?.replacements || [];
    const candidates = replacementIds.map(getExercise).filter(Boolean);
    showModal(`
      <div class="modal-head"><h2>Замена упражнения</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice">Все варианты используют доступное на судне оборудование. При качке выбирай сидя, лёжа или с опорой.</div>
      <div class="card list-card" style="margin-top:12px">
        ${candidates.length ? candidates.map((candidate) => `<button class="list-row choose-replacement" data-id="${candidate.id}" style="width:100%;text-align:left;background:transparent;border-left:0;border-right:0;border-top:0;color:inherit">
          <div class="list-row-main"><div class="list-row-title">${escapeHTML(candidate.name)}</div><div class="list-row-sub">${escapeHTML(candidate.equipment)} · ${escapeHTML(candidate.group)}</div></div><span>›</span>
        </button>`).join('') : `<div class="empty"><strong>Готовых замен нет</strong>Можно добавить упражнение через редактор программы.</div>`}
      </div>
      <button class="button secondary full" id="choose-any-exercise" style="margin-top:12px">Выбрать из всей библиотеки</button>
    `);
    el.modalRoot.querySelectorAll('.choose-replacement').forEach((button) => button.addEventListener('click', () => replaceWorkoutExercise(index, button.dataset.id)));
    document.getElementById('choose-any-exercise').addEventListener('click', () => showExercisePicker((id) => replaceWorkoutExercise(index, id)));
  }

  async function replaceWorkoutExercise(index, newId) {
    const old = state.currentWorkout.exercises[index];
    const exercise = getExercise(newId);
    if (!exercise) return;
    const last = findLastExerciseResult(exercise.id);
    const suggestion = progressionSuggestion(exercise, last);
    const sets = Array.from({ length: Math.min(exercise.defaults.sets, state.currentWorkout.shortMode ? 2 : exercise.defaults.sets) }, (_, i) => ({
      number: i + 1,
      weightKg: exercise.defaults.unit === 'reps'
        ? previousSetValue(last, i, 'weightKg', exercise.defaults.weightKg ?? suggestion.weightKg ?? '')
        : '',
      reps: exercise.defaults.unit === 'reps'
        ? previousSetValue(last, i, 'reps', exercise.defaults.repsMin ?? '')
        : '',
      durationSec: exercise.defaults.unit === 'seconds'
        ? previousSetValue(last, i, 'durationSec', exercise.defaults.durationSec || 30)
        : null,
      durationMin: exercise.defaults.unit === 'minutes'
        ? previousSetValue(last, i, 'durationMin', exercise.defaults.durationMin || 10)
        : null,
      difficulty: 'normal',
      completed: false,
    }));
    const painRisk = analyzeExercisePainRisk(state.currentWorkout.preWorkoutPain, exercise);
    state.currentWorkout.exercises[index] = {
      exerciseId: exercise.id,
      name: exercise.name,
      replacementOf: old.replacementOf || old.exerciseId,
      skipped: false,
      comment: `Замена: ${old.name}`,
      previous: last ? summarizePrevious(last) : null,
      prefilledFromLast: completedSets(last).length > 0,
      suggestion,
      painRisk,
      painEvents: old.painEvents || [],
      defaults: { ...exercise.defaults },
      sets,
    };
    await saveDraftWorkout();
    closeModal();
    renderWorkout();
  }


  function showExercisePainModal(index) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result) return;
    showModal(`
      <div class="modal-head"><h2>Боль в упражнении</h2><button class="modal-close" data-close>×</button></div>
      <p class="muted">${escapeHTML(result.name)}</p>
      <div class="field">
        <label>Где болит</label>
        <div class="pain-area-grid">
          ${painAreas.map((area) => `<button class="pain-area-option" type="button" data-area="${area.id}">${escapeHTML(area.label)}</button>`).join('')}
        </div>
        <input id="exercise-pain-area" type="hidden" value="">
      </div>
      <div class="field">
        <label>Степень боли</label>
        <div class="pain-level-picker">
          ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button class="pain-level-option ${n === 4 ? 'active' : ''}" type="button" data-score="${n}">${n}</button>`).join('')}
        </div>
        <input id="exercise-pain-score" type="hidden" value="4">
      </div>
      <div class="field"><label>Комментарий</label><textarea id="exercise-pain-comment" placeholder="Например: потянуло на втором подходе"></textarea></div>
      <button class="button primary full" id="save-exercise-pain" type="button">Сохранить отметку</button>
      <div class="button-row" style="margin-top:10px">
        <button class="button secondary" id="pain-reduce-now" type="button">Снизить вес</button>
        <button class="button danger" id="pain-skip-now" type="button">Пропустить</button>
      </div>
    `);
    el.modalRoot.querySelectorAll('.pain-area-option').forEach((button) => {
      button.addEventListener('click', () => {
        el.modalRoot.querySelectorAll('.pain-area-option').forEach((item) => item.classList.toggle('active', item === button));
        document.getElementById('exercise-pain-area').value = button.dataset.area;
      });
    });
    el.modalRoot.querySelectorAll('.pain-level-option').forEach((button) => {
      button.addEventListener('click', () => {
        el.modalRoot.querySelectorAll('.pain-level-option').forEach((item) => item.classList.toggle('active', item === button));
        document.getElementById('exercise-pain-score').value = button.dataset.score;
      });
    });
    const savePain = async (action = null) => {
      const areaId = document.getElementById('exercise-pain-area').value;
      if (!areaId) {
        toast('Выбери область боли');
        return null;
      }
      const event = normalizePainInput({
        hasPain: true,
        areaId,
        score: Number(document.getElementById('exercise-pain-score').value || 4),
        comment: document.getElementById('exercise-pain-comment').value,
      });
      const exercise = getExercise(result.exerciseId);
      const risk = analyzeExercisePainRisk(event, exercise) || {
        areaId: event.areaId,
        areaLabel: event.areaLabel,
        score: event.score,
        level: event.level,
        title: painLevelMeta(event.score).title,
        reason: 'боль отмечена во время выполнения',
        message: `Боль отмечена во время упражнения: ${event.areaLabel} ${event.score}/10.`,
        action: null,
      };
      if (action) risk.action = action;
      const painEvent = { ...event, source: 'exercise', exerciseId: result.exerciseId, exerciseName: result.name, action };
      result.painEvents = [...(result.painEvents || []), painEvent];
      result.painRisk = risk;
      await savePainEntry({ ...painEvent, workoutId: state.currentWorkout.id });
      await saveDraftWorkout();
      return painEvent;
    };
    document.getElementById('save-exercise-pain').addEventListener('click', async () => {
      const saved = await savePain();
      if (!saved) return;
      closeModal();
      renderWorkout();
      toast('Боль отмечена');
    });
    document.getElementById('pain-reduce-now').addEventListener('click', async () => {
      const saved = await savePain('reduce');
      if (!saved) return;
      await reduceExerciseWeight(index, 0.8, false);
      closeModal();
      renderWorkout();
      toast('Боль отмечена, вес снижен');
    });
    document.getElementById('pain-skip-now').addEventListener('click', async () => {
      const saved = await savePain('skip');
      if (!saved) return;
      result.skipped = true;
      result.sets.forEach((set) => { set.completed = false; });
      closeModal();
      await saveDraftWorkout();
      renderWorkout();
      toast('Боль отмечена, упражнение пропущено');
    });
  }

  async function applyPainAction(index, action) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result || !result.painRisk) return;
    result.painRisk.action = action;
    if (action === 'reduce') {
      await reduceExerciseWeight(index, result.painRisk.level === 'high' ? 0.75 : 0.85);
      return;
    }
    if (action === 'replace') {
      await saveDraftWorkout();
      showReplacementModal(index);
      return;
    }
    if (action === 'skip') {
      result.skipped = true;
      result.sets.forEach((set) => { set.completed = false; });
      await saveDraftWorkout();
      renderWorkout();
      toast('Упражнение пропущено из-за боли');
      return;
    }
    await saveDraftWorkout();
    renderWorkout();
    toast('Оставлено как есть, отметка сохранена');
  }

  async function reduceExerciseWeight(index, multiplier = 0.8, rerender = true) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result || result.defaults.unit !== 'reps') {
      toast('Здесь нет рабочего веса для снижения');
      return;
    }
    result.sets.forEach((set) => {
      const weight = Number(set.weightKg);
      if (Number.isFinite(weight) && weight > 0) set.weightKg = roundHalf(weight * multiplier);
    });
    result.comment = result.comment ? `${result.comment}
Вес снижен из-за боли.` : 'Вес снижен из-за боли.';
    if (result.painRisk) result.painRisk.action = 'reduce';
    await saveDraftWorkout();
    if (rerender) {
      renderWorkout();
      toast('Вес снижен');
    }
  }

  function showExerciseCommentModal(index) {
    const result = state.currentWorkout.exercises[index];
    showModal(`
      <div class="modal-head"><h2>Комментарий</h2><button class="modal-close" data-close>×</button></div>
      <div class="field"><label>${escapeHTML(result.name)}</label><textarea id="exercise-comment-input" placeholder="Например: неудобно при качке, тянет плечо, вес лёгкий…">${escapeHTML(result.comment || '')}</textarea></div>
      <button class="button primary full" id="save-exercise-comment" style="margin-top:14px">Сохранить</button>
    `);
    document.getElementById('save-exercise-comment').addEventListener('click', async () => {
      result.comment = document.getElementById('exercise-comment-input').value.trim();
      await saveDraftWorkout();
      closeModal();
      renderWorkout();
    });
  }

  function showWorkoutCloseModal() {
    showModal(`
      <div class="modal-head"><h2>Закрыть тренировку?</h2><button class="modal-close" data-close>×</button></div>
      <p class="muted">Черновик сохранён на телефоне. Можно вернуться позже без потери подходов.</p>
      <div class="button-row">
        <button class="button secondary" id="keep-draft">Оставить черновик</button>
        <button class="button danger" id="discard-workout">Удалить</button>
      </div>
    `);
    document.getElementById('keep-draft').addEventListener('click', async () => {
      try {
        await flushDraftSave();
        stopRestTimer(false);
        clearInterval(state.workoutClockInterval);
        closeModal();
        toast('Черновик сохранён');
        navigate('home');
      } catch (error) {
        console.error(error);
        toast(`Не удалось сохранить черновик: ${error.message}`);
      }
    });
    document.getElementById('discard-workout').addEventListener('click', async () => {
      clearDraftSaveTimer();
      stopRestTimer(false);
      clearInterval(state.workoutClockInterval);
      state.currentWorkout = null;
      await DB.remove('meta', draftWorkoutKey());
      closeModal();
      toast('Черновик удалён');
      navigate('home');
    });
  }

  function showFinishWorkoutModal() {
    const pct = workoutCompletion(state.currentWorkout);
    showModal(`
      <div class="modal-head"><h2>Завершить тренировку</h2><button class="modal-close" data-close>×</button></div>
      <div class="stats-grid">
        <div class="stat"><div class="stat-value">${pct}%</div><div class="stat-label">выполнено</div></div>
        <div class="stat"><div class="stat-value">${formatDuration(elapsedSeconds(state.currentWorkout.startedAt))}</div><div class="stat-label">длительность</div></div>
      </div>
      ${pct < 50 ? `<div class="notice warning" style="margin-top:12px">Выполнено меньше половины. Это не провал: тренировка сохранится как есть и план не сломается.</div>` : ''}
      <button class="button primary full" id="confirm-finish" style="margin-top:14px">Сохранить результат</button>
    `);
    document.getElementById('confirm-finish').addEventListener('click', finishWorkout);
  }

  async function finishWorkout() {
    clearDraftSaveTimer();
    const workout = state.currentWorkout;
    workout.status = 'completed';
    workout.finishedAt = new Date().toISOString();
    workout.durationSec = elapsedSeconds(workout.startedAt);
    workout.completionPct = workoutCompletion(workout);
    workout.totalLoadKg = calculateLoad(workout);
    workout.records = calculateWorkoutRecords(workout, state.workouts);
    workout.progression = workout.exercises.map((result) => ({ exerciseId: result.exerciseId, ...postWorkoutSuggestion(result) }));
    await DB.put('workouts', workout);
    const shouldAdvanceCycle = workout.shouldAdvanceCycle !== false;
    if (shouldAdvanceCycle) {
      const program = state.programs.find((item) => item.id === workout.programId) || getActiveProgram();
      const nextIndex = (Number(workout.dayIndex) + 1) % Math.max(program.days.length, 1);
      state.settings.currentDayIndex = nextIndex;
      await DB.setSettingsObject({ currentDayIndex: state.settings.currentDayIndex }, state.activeProfileId);
    }
    await DB.remove('meta', draftWorkoutKey());
    state.workouts.unshift(workout);
    state.currentWorkout = null;
    clearInterval(state.workoutClockInterval);
    closeModal();
    toast(shouldAdvanceCycle ? 'Тренировка сохранена, цикл сдвинут дальше' : 'Тренировка сохранена, цикл не сдвинут');
    navigate('home');
    if (workout.records?.length) window.setTimeout(() => showWorkoutRecordsModal(workout), 120);
  }

  function updateWorkoutClock() {
    const clock = document.getElementById('workout-clock');
    if (clock && state.currentWorkout) clock.textContent = formatDuration(elapsedSeconds(state.currentWorkout.startedAt));
  }

  function updateWorkoutProgress() {
    if (!state.currentWorkout) return;
    const pct = workoutCompletion(state.currentWorkout);
    const text = document.getElementById('workout-progress-text');
    const bar = document.getElementById('workout-progress-bar');
    if (text) text.textContent = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;
  }

  function startRestTimer(seconds, nextLabel) {
    stopRestTimer(false);
    state.timer.seconds = Number(seconds) || 60;
    state.timer.endsAt = Date.now() + state.timer.seconds * 1000;
    state.timer.nextLabel = nextLabel || '';
    el.timerOverlay.hidden = false;
    el.timerNext.textContent = state.timer.nextLabel;
    renderTimer();
    state.timer.interval = setInterval(() => {
      syncTimerFromEnd();
      if (state.timer.seconds <= 0) timerDone();
    }, 250);
  }

  function syncTimerFromEnd() {
    if (!state.timer.endsAt) return;
    state.timer.seconds = Math.max(0, Math.ceil((state.timer.endsAt - Date.now()) / 1000));
    renderTimer();
  }

  function adjustTimer(delta) {
    state.timer.seconds = Math.max(0, state.timer.seconds + delta);
    state.timer.endsAt = Date.now() + state.timer.seconds * 1000;
    renderTimer();
  }

  function renderTimer() {
    el.timerValue.textContent = formatDuration(state.timer.seconds);
  }

  function timerDone() {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.seconds = 0;
    state.timer.endsAt = null;
    renderTimer();
    if (state.settings.vibrationEnabled && navigator.vibrate) navigator.vibrate([180, 80, 180]);
    if (state.settings.soundEnabled) beep();
    setTimeout(() => stopRestTimer(), 800);
  }

  function stopRestTimer(hide = true) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.endsAt = null;
    if (hide) el.timerOverlay.hidden = true;
  }

  function beep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }

  function renderPlan() {
    const active = getActiveProgram();
    const programChoices = getProgramChoices();
    setTopbar('Недельный план', active.name);
    el.main.innerHTML = `
      <section class="section">
        <div class="tabs program-tabs">
          ${programChoices.map((program) => `<button class="tab ${program.id === active.id ? 'active' : ''} switch-program" data-id="${program.id}" title="${escapeAttr(program.name)}">${escapeHTML(program.name)}</button>`).join('')}
          <button class="tab tab-create" id="open-program-builder" type="button">＋ Создать</button>
        </div>
        <div class="help program-tabs-help">Вверху показываются уникальные программы: стандартные копии больше не размножаются в ленте.</div>
      </section>
      <section class="section">
        <div class="card hero-card">
          <div class="eyebrow">Активная программа</div>
          <h2>${escapeHTML(active.name)}</h2>
          <p>${escapeHTML(active.description || 'Пустая программа-конструктор: добавь дни и упражнения под себя.')}</p>
          <div class="hero-meta"><span class="chip">${active.days.length} дней в цикле</span><span class="chip">Текущий: ${Number(state.settings.currentDayIndex) + 1}</span></div>
          <div class="button-row plan-actions">
            <button class="button secondary" id="duplicate-program">Дублировать</button>
            <button class="button secondary" id="add-program-day">Добавить день</button>
            <button class="button primary" id="new-program">Создать программу</button>
          </div>
        </div>
      </section>
      <section class="section">
        ${active.days.map((day, index) => `
          <div class="card program-day">
            <div class="program-day-head">
              <div style="display:flex;align-items:center;gap:12px;min-width:0"><div class="day-badge">${index + 1}</div><div class="truncate"><h3 class="truncate">${escapeHTML(day.name)}</h3><div class="list-row-sub">≈ ${day.durationMin} мин · ${day.exercises.length} упражнений</div></div></div>
              <button class="mini-button edit-day" data-index="${index}">✎</button>
            </div>
            <div class="exercise-list">
              ${day.exercises.length ? day.exercises.map((entry, i) => { const exercise = getExercise(entry.exerciseId); return `<div class="exercise-line"><span class="exercise-index">${i + 1}</span><div><div class="exercise-name">${escapeHTML(exercise?.name || entry.exerciseId)}</div><div class="exercise-sub">${workPrescription(exercise, entry)}</div></div><span class="muted">${escapeHTML(exercise?.equipment || '')}</span></div>`; }).join('') : '<div class="empty compact-empty"><strong>День пустой</strong>Нажми карандаш и добавь упражнения.</div>'}
            </div>
            <div class="button-row">
              <button class="button secondary small start-specific" data-index="${index}">Начать этот день</button>
              <button class="button ghost small set-current-day" data-index="${index}">Сделать текущим</button>
            </div>
          </div>`).join('')}
      </section>
    `;
    el.main.querySelectorAll('.switch-program').forEach((button) => button.addEventListener('click', () => switchProgram(button.dataset.id)));
    el.main.querySelectorAll('.set-current-day').forEach((button) => button.addEventListener('click', () => setCurrentDay(Number(button.dataset.index))));
    el.main.querySelectorAll('.start-specific').forEach((button) => button.addEventListener('click', async () => { await setCurrentDay(Number(button.dataset.index), false); startWorkout(false); }));
    el.main.querySelectorAll('.edit-day').forEach((button) => button.addEventListener('click', () => showEditDayModal(Number(button.dataset.index))));
    document.getElementById('duplicate-program').addEventListener('click', duplicateActiveProgram);
    document.getElementById('add-program-day').addEventListener('click', addProgramDay);
    document.getElementById('new-program').addEventListener('click', showNewProgramModal);
    document.getElementById('open-program-builder').addEventListener('click', showNewProgramModal);
  }

  async function switchProgram(id) {
    let program = state.programs.find((item) => item.id === id);
    if (!program) return;
    if (isProgramTemplate(program)) {
      program = findPersonalProgramForTemplate(program.id) || await createPersonalProgramFromTemplate(program);
    }
    state.settings.activeProgramId = program.id;
    state.settings.currentDayIndex = 0;
    await DB.setSettingsObject({ activeProgramId: program.id, currentDayIndex: 0 }, state.activeProfileId);
    renderPlan();
  }

  async function setCurrentDay(index, rerender = true) {
    state.settings.currentDayIndex = index;
    await DB.setSettingsObject({ currentDayIndex: index }, state.activeProfileId);
    if (rerender) renderPlan();
    toast(`Текущий день: ${index + 1}`);
  }


  async function addProgramDay() {
    const program = getActiveProgram();
    program.days.push({ id: uid('day'), name: `День ${program.days.length + 1}`, durationMin: 45, focus: '', exercises: [], short: [] });
    await DB.put('programs', program);
    renderPlan();
    toast('Новый тренировочный день добавлен');
  }

  async function duplicateActiveProgram() {
    const active = getActiveProgram();
    const copy = clone(active);
    copy.id = uid('program');
    copy.name = `${active.name} — копия`;
    copy.createdAt = new Date().toISOString();
    copy.ownerProfileId = state.activeProfileId;
    copy.sourceTemplateId = active.templateId || active.sourceTemplateId || (isProgramTemplate(active) ? active.id : null);
    delete copy.templateId;
    copy.updatedAt = copy.createdAt;
    copy.days = copy.days.map((day) => ({ ...day, id: uid('day') }));
    await DB.put('programs', copy);
    state.programs.push(copy);
    state.allPrograms.push(copy);
    await switchProgram(copy.id);
    toast('Копия программы создана');
  }

  function showNewProgramModal() {
    showModal(`
      <div class="modal-head"><h2>Конструктор программы</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Название</label><input id="new-program-name" value="Моя программа"></div>
        <div class="field"><label>Описание</label><textarea id="new-program-description" placeholder="Например: 4 дня, упор на форму, пресс и спину"></textarea></div>
        <div class="field">
          <label>Сколько тренировочных дней в цикле</label>
          <div class="day-count-picker" id="day-count-picker">
            ${[1,2,3,4,5,6,7].map((n) => `<button class="day-count-option ${n === 4 ? 'active' : ''}" type="button" data-value="${n}">${n}</button>`).join('')}
          </div>
          <input id="new-program-days" type="hidden" value="4">
          <div class="help">После создания откроется пустой план. На каждом дне нажимаешь ✎ и собираешь упражнения, подходы, повторы, вес и отдых.</div>
        </div>
      </div>
      <button class="button primary full" id="create-program" style="margin-top:14px">Создать и открыть план</button>
    `);
    el.modalRoot.querySelectorAll('.day-count-option').forEach((button) => {
      button.addEventListener('click', () => {
        el.modalRoot.querySelectorAll('.day-count-option').forEach((item) => item.classList.toggle('active', item === button));
        document.getElementById('new-program-days').value = button.dataset.value;
      });
    });
    document.getElementById('create-program').addEventListener('click', async () => {
      const count = Math.max(1, Math.min(7, Number(document.getElementById('new-program-days').value || 4)));
      const now = new Date().toISOString();
      const program = {
        id: uid('program'),
        name: document.getElementById('new-program-name').value.trim() || 'Моя программа',
        description: document.getElementById('new-program-description').value.trim() || `${count} тренировочных дн. · собери упражнения под себя`,
        ownerProfileId: state.activeProfileId,
        createdAt: now,
        updatedAt: now,
        days: Array.from({ length: count }, (_, i) => ({ id: uid('day'), name: `День ${i + 1}`, durationMin: 45, focus: '', exercises: [], short: [] })),
      };
      await DB.put('programs', program);
      state.programs.push(program);
      state.allPrograms.push(program);
      closeModal();
      await switchProgram(program.id);
      toast('Программа создана. Нажимай ✎ и собирай дни.');
    });
  }

  function showEditDayModal(index) {
    const program = getActiveProgram();
    const day = program.days[index];
    showModal(`
      <div class="modal-head"><h2>Редактор дня ${index + 1}</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Название</label><input id="edit-day-name" value="${escapeAttr(day.name)}"></div>
        <div class="inline-fields"><div class="field"><label>Длительность, мин</label><input id="edit-day-duration" type="number" min="10" max="180" value="${day.durationMin}"></div><div class="field"><label>Акцент</label><input id="edit-day-focus" value="${escapeAttr(day.focus || '')}"></div></div>
      </div>
      <div class="section-head" style="margin-top:18px"><h2>Упражнения</h2><button class="link-button" id="add-day-exercise">Добавить</button></div>
      <div class="card list-card" id="edit-day-list">
        ${day.exercises.length ? day.exercises.map((entry, i) => editDayExerciseRow(entry, i)).join('') : '<div class="empty"><strong>День пустой</strong>Добавь упражнения из библиотеки.</div>'}
      </div>
      <button class="button primary full" id="save-day" style="margin-top:14px">Сохранить день</button>
      <button class="button danger full" id="delete-day" style="margin-top:10px">Удалить этот день</button>
    `);
    bindEditDayList(day, index);
    document.getElementById('add-day-exercise').addEventListener('click', () => showExercisePicker((id) => {
      day.exercises.push({ exerciseId: id });
      closeModal();
      showEditDayModal(index);
    }));
    document.getElementById('delete-day').addEventListener('click', async () => {
      if (program.days.length <= 1) return toast('В программе должен остаться хотя бы один день');
      program.days.splice(index, 1);
      state.settings.currentDayIndex = Math.min(Number(state.settings.currentDayIndex || 0), program.days.length - 1);
      await Promise.all([DB.put('programs', program), DB.setSettingsObject({ currentDayIndex: state.settings.currentDayIndex }, state.activeProfileId)]);
      closeModal();
      renderPlan();
      toast('День удалён');
    });
    document.getElementById('save-day').addEventListener('click', async () => {
      day.name = document.getElementById('edit-day-name').value.trim() || `День ${index + 1}`;
      day.durationMin = Number(document.getElementById('edit-day-duration').value || 45);
      day.focus = document.getElementById('edit-day-focus').value.trim();
      await DB.put('programs', program);
      closeModal();
      renderPlan();
      toast('День сохранён');
    });
  }

  function editDayExerciseRow(entry, index) {
    const exercise = getExercise(entry.exerciseId);
    return `<div class="list-row" data-entry-index="${index}">
      <div class="list-row-main"><div class="list-row-title">${escapeHTML(exercise?.name || entry.exerciseId)}</div><div class="list-row-sub">${workPrescription(exercise, entry)} · отдых ${entry.restSec ?? exercise?.defaults.restSec ?? 0} сек</div></div>
      <div class="row-actions"><button class="mini-button move-up">↑</button><button class="mini-button move-down">↓</button><button class="mini-button edit-entry">✎</button><button class="mini-button remove-entry">×</button></div>
    </div>`;
  }

  function bindEditDayList(day, dayIndex) {
    el.modalRoot.querySelectorAll('#edit-day-list .list-row').forEach((row) => {
      const index = Number(row.dataset.entryIndex);
      row.querySelector('.move-up').addEventListener('click', () => moveDayEntry(day, dayIndex, index, -1));
      row.querySelector('.move-down').addEventListener('click', () => moveDayEntry(day, dayIndex, index, 1));
      row.querySelector('.remove-entry').addEventListener('click', () => { day.exercises.splice(index, 1); closeModal(); showEditDayModal(dayIndex); });
      row.querySelector('.edit-entry').addEventListener('click', () => showEditEntryModal(day, dayIndex, index));
    });
  }

  function moveDayEntry(day, dayIndex, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= day.exercises.length) return;
    [day.exercises[index], day.exercises[target]] = [day.exercises[target], day.exercises[index]];
    closeModal();
    showEditDayModal(dayIndex);
  }

  function showEditEntryModal(day, dayIndex, entryIndex) {
    const entry = day.exercises[entryIndex];
    const exercise = getExercise(entry.exerciseId);
    const d = { ...exercise.defaults, ...entry };
    showModal(`
      <div class="modal-head"><h2>${escapeHTML(exercise.name)}</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="inline-fields three"><div class="field"><label>Подходы</label><input id="entry-sets" type="number" min="1" max="10" value="${d.sets}"></div><div class="field"><label>Повторы от</label><input id="entry-reps-min" type="number" min="0" value="${d.repsMin || 0}"></div><div class="field"><label>До</label><input id="entry-reps-max" type="number" min="0" value="${d.repsMax || d.repsMin || 0}"></div></div>
        <div class="inline-fields"><div class="field"><label>Рабочий вес, кг</label><input id="entry-weight" type="number" step="0.5" min="0" value="${d.weightKg ?? ''}"></div><div class="field"><label>Отдых, сек</label><input id="entry-rest" type="number" min="0" value="${d.restSec || 0}"></div></div>
      </div>
      <button class="button primary full" id="save-entry" style="margin-top:14px">Применить</button>
    `);
    document.getElementById('save-entry').addEventListener('click', () => {
      Object.assign(entry, {
        sets: Number(document.getElementById('entry-sets').value || 1),
        repsMin: Number(document.getElementById('entry-reps-min').value || 0),
        repsMax: Number(document.getElementById('entry-reps-max').value || 0),
        weightKg: numberOrBlank(document.getElementById('entry-weight').value),
        restSec: Number(document.getElementById('entry-rest').value || 0),
      });
      closeModal();
      showEditDayModal(dayIndex);
    });
  }

  function showExercisePicker(onChoose) {
    showModal(`
      <div class="modal-head"><h2>Выбрать упражнение</h2><button class="modal-close" data-close>×</button></div>
      <div class="field"><input id="exercise-search" placeholder="Поиск по названию или группе"></div>
      <div class="card list-card" id="exercise-picker-list" style="margin-top:12px;max-height:55vh;overflow:auto"></div>
      <button class="button secondary full" id="create-custom-exercise" style="margin-top:12px">Создать своё упражнение</button>
    `);
    const renderList = () => {
      const q = document.getElementById('exercise-search').value.trim().toLowerCase();
      const filtered = state.exercises.filter((x) => `${x.name} ${x.group} ${x.equipment}`.toLowerCase().includes(q));
      document.getElementById('exercise-picker-list').innerHTML = filtered.map((x) => `<button class="list-row pick-exercise" data-id="${x.id}" style="width:100%;text-align:left;background:transparent;border-left:0;border-right:0;border-top:0;color:inherit"><div class="list-row-main"><div class="list-row-title">${escapeHTML(x.name)}</div><div class="list-row-sub">${escapeHTML(x.group)} · ${escapeHTML(x.equipment)}</div></div><span>＋</span></button>`).join('');
      el.modalRoot.querySelectorAll('.pick-exercise').forEach((button) => button.addEventListener('click', () => { closeModal(); onChoose(button.dataset.id); }));
    };
    document.getElementById('exercise-search').addEventListener('input', renderList);
    document.getElementById('create-custom-exercise').addEventListener('click', () => showCustomExerciseModal(onChoose));
    renderList();
  }

  function showCustomExerciseModal(onChoose) {
    showModal(`
      <div class="modal-head"><h2>Своё упражнение</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Название</label><input id="custom-name"></div>
        <div class="inline-fields"><div class="field"><label>Группа</label><input id="custom-group" placeholder="Например: спина"></div><div class="field"><label>Оборудование</label><input id="custom-equipment" placeholder="Гантели"></div></div>
        <div class="inline-fields three"><div class="field"><label>Подходы</label><input id="custom-sets" type="number" value="3"></div><div class="field"><label>Повторы от</label><input id="custom-min" type="number" value="8"></div><div class="field"><label>До</label><input id="custom-max" type="number" value="12"></div></div>
        <div class="field"><label>Отдых, сек</label><input id="custom-rest" type="number" value="75"></div>
      </div>
      <button class="button primary full" id="save-custom" style="margin-top:14px">Создать и добавить</button>
    `);
    document.getElementById('save-custom').addEventListener('click', async () => {
      const name = document.getElementById('custom-name').value.trim();
      if (!name) return toast('Введи название');
      const exercise = {
        id: uid('custom-ex'), name,
        group: document.getElementById('custom-group').value.trim() || 'Другое',
        equipment: document.getElementById('custom-equipment').value.trim() || 'Собственный вес',
        defaults: { sets: Number(document.getElementById('custom-sets').value || 3), repsMin: Number(document.getElementById('custom-min').value || 8), repsMax: Number(document.getElementById('custom-max').value || 12), restSec: Number(document.getElementById('custom-rest').value || 75), weightKg: null, unit: 'reps' },
        notes: '', safety: '', replacements: [], custom: true, ownerProfileId: state.activeProfileId,
      };
      await DB.put('exercises', exercise);
      state.exercises.push(exercise);
      state.allExercises.push(exercise);
      closeModal();
      onChoose(exercise.id);
    });
  }

  function renderHistory() {
    setTopbar('История', 'Тренировки и нагрузка');
    const filtered = filteredHistory();
    el.main.innerHTML = `
      <section class="section"><div class="tabs">${[['day','День'],['week','Неделя'],['month','Месяц'],['all','Всё']].map(([value,label]) => `<button class="tab ${state.historyFilter === value ? 'active' : ''} history-filter" data-filter="${value}">${label}</button>`).join('')}</div></section>
      <section class="section">
        <div class="stats-grid">
          <div class="stat"><div class="stat-value">${filtered.length}</div><div class="stat-label">тренировки</div></div>
          <div class="stat"><div class="stat-value">${Math.round(filtered.reduce((s,w)=>s+(w.durationSec||0),0)/60)}</div><div class="stat-label">минут</div></div>
          <div class="stat"><div class="stat-value">${Math.round(avgCompletion(filtered))}%</div><div class="stat-label">выполнение</div></div>
          <div class="stat"><div class="stat-value">${formatCompactLoad(filtered.reduce((s,w)=>s+(w.totalLoadKg||0),0))}</div><div class="stat-label">нагрузка, кг</div></div>
        </div>
      </section>
      <section class="section">
        ${filtered.length ? filtered.map(workoutSummaryCard).join('') : `<div class="card empty"><strong>Ничего не найдено</strong>В выбранном периоде тренировок нет.</div>`}
      </section>
    `;
    el.main.querySelectorAll('.history-filter').forEach((button) => button.addEventListener('click', () => { state.historyFilter = button.dataset.filter; renderHistory(); }));
    el.main.querySelectorAll('.view-workout').forEach((button) => button.addEventListener('click', () => showWorkoutDetails(button.dataset.id)));
  }

  function filteredHistory() {
    const now = new Date();
    if (state.historyFilter === 'all') return state.workouts;
    const start = state.historyFilter === 'day' ? startOfDay(now) : state.historyFilter === 'week' ? startOfWeek(now) : new Date(now.getFullYear(), now.getMonth(), 1);
    return state.workouts.filter((w) => new Date(w.startedAt) >= start);
  }

  function workoutSummaryCard(workout) {
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="eyebrow">${formatDate(new Date(workout.startedAt), { day:'numeric', month:'long', year:'numeric' })}</div><h3 style="margin:5px 0 4px">${escapeHTML(workout.dayName)}</h3><div class="muted">${formatDuration(workout.durationSec || 0)} · ${workout.completionPct ?? workoutCompletion(workout)}% · ${formatCompactLoad(workout.totalLoadKg || 0)} кг${workout.records?.length ? ` · 🔥 ${workout.records.length} рек.` : ''}</div></div><button class="mini-button view-workout" data-id="${workout.id}">›</button></div>
      <div class="progress-bar" style="margin-top:12px"><span style="width:${workout.completionPct ?? workoutCompletion(workout)}%"></span></div>
    </div>`;
  }

  function showWorkoutDetails(id) {
    const workout = state.workouts.find((w) => w.id === id);
    if (!workout) return;
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">${formatDate(new Date(workout.startedAt), { day:'numeric', month:'long', year:'numeric' })}</div><h2>${escapeHTML(workout.dayName)}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="stats-grid">
        <div class="stat"><div class="stat-value">${formatDuration(workout.durationSec || 0)}</div><div class="stat-label">время</div></div>
        <div class="stat"><div class="stat-value">${workout.completionPct}%</div><div class="stat-label">выполнено</div></div>
        <div class="stat"><div class="stat-value">${formatCompactLoad(workout.totalLoadKg || 0)}</div><div class="stat-label">нагрузка, кг</div></div>
        <div class="stat"><div class="stat-value">${workout.exercises.filter((x)=>x.skipped).length}</div><div class="stat-label">пропущено</div></div>
      </div>
      ${workout.preWorkoutPain?.hasPain ? `<div class="notice warning" style="margin-top:12px"><strong>Перед стартом:</strong> ${escapeHTML(workout.preWorkoutPain.areaLabel)} · ${workout.preWorkoutPain.score}/10${workout.preWorkoutPain.comment ? `<br>${escapeHTML(workout.preWorkoutPain.comment)}` : ''}</div>` : ''}
      ${renderWorkoutRecordsBlock(workout)}
      <div class="card list-card" style="margin-top:12px">
        ${workout.exercises.map((result) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${result.painRisk ? '⚠️ ' : ''}${result.skipped ? '○ ' : '✓ '}${escapeHTML(result.name)}</div><div class="list-row-sub">${result.skipped ? 'Пропущено' : result.sets.filter((s)=>s.completed).map((s)=> result.defaults.unit === 'reps' ? `${s.weightKg || 0}×${s.reps}` : `${s.durationMin || s.durationSec}`).join(' · ') || 'Нет выполненных подходов'}${result.painRisk ? `<br>Боль/риск: ${escapeHTML(result.painRisk.areaLabel)} ${result.painRisk.score}/10 · ${escapeHTML(result.painRisk.title)}${result.painRisk.action ? ` · ${escapeHTML(painActionLabel(result.painRisk.action))}` : ''}` : ''}${result.painEvents?.length ? `<br>Отмечено в упражнении: ${result.painEvents.map((event) => `${escapeHTML(event.areaLabel)} ${event.score}/10`).join(' · ')}` : ''}${result.comment ? `<br>Комментарий: ${escapeHTML(result.comment)}` : ''}</div></div></div>`).join('')}
      </div>
      ${workout.comment ? `<div class="notice" style="margin-top:12px">${escapeHTML(workout.comment)}</div>` : ''}
      <button class="button danger full" id="delete-workout" style="margin-top:14px">Удалить тренировку</button>
    `);
    document.getElementById('delete-workout').addEventListener('click', async () => {
      await DB.remove('workouts', id);
      const relatedPain = state.painEntries.filter((entry) => entry.workoutId === id);
      await Promise.all(relatedPain.map((entry) => DB.remove('painEntries', entry.id)));
      state.painEntries = state.painEntries.filter((entry) => entry.workoutId !== id);
      state.workouts = state.workouts.filter((w) => w.id !== id);
      closeModal();
      renderHistory();
      toast('Тренировка удалена');
    });
  }

  function renderProgress() {
    setTopbar('Прогресс', 'Без самообмана — только данные');
    el.main.innerHTML = `
      <section class="section"><div class="tabs">
        ${[['body','Тело'],['training','Тренировки'],['records','Рекорды'],['strength','Рабочие веса'],['stepper','Степпер'],['photos','Фото']].map(([value,label]) => `<button class="tab ${state.progressTab === value ? 'active' : ''} progress-tab" data-tab="${value}">${label}</button>`).join('')}
      </div></section>
      <div id="progress-content">${renderProgressContent()}</div>
    `;
    el.main.querySelectorAll('.progress-tab').forEach((button) => button.addEventListener('click', () => { state.progressTab = button.dataset.tab; renderProgress(); }));
    bindProgressEvents();
  }

  function renderProgressContent() {
    if (state.progressTab === 'body') return renderBodyProgress();
    if (state.progressTab === 'training') return renderTrainingProgress();
    if (state.progressTab === 'records') return renderRecordsProgress();
    if (state.progressTab === 'strength') return renderStrengthProgress();
    if (state.progressTab === 'stepper') return renderStepperProgress();
    return renderPhotoProgress();
  }

  function renderBodyProgress() {
    const latest = state.measurements[0];
    return `
      <section class="section"><div class="button-row"><button class="button primary" id="add-measurement">Добавить замер</button><button class="button secondary" id="measurement-history">Все замеры</button></div></section>
      <section class="section"><div class="card"><div class="section-head"><h2>Вес</h2><span class="muted">${latest?.weightKg ?? '—'} кг</span></div>${lineChart(state.measurements.filter(x=>x.weightKg).slice().reverse(), 'weightKg', 'кг')}</div></section>
      <section class="section"><div class="card"><div class="section-head"><h2>Талия</h2><span class="muted">${latest?.waistCm ?? '—'} см</span></div>${lineChart(state.measurements.filter(x=>x.waistCm).slice().reverse(), 'waistCm', 'см')}</div></section>
      <section class="section"><div class="card list-card">${state.measurements.slice(0,8).map((m) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${formatShortDate(m.date)}</div><div class="list-row-sub">Вес ${m.weightKg ?? '—'} · талия ${m.waistCm ?? '—'} · живот ${m.abdomenCm ?? '—'} см</div></div><button class="mini-button delete-measurement" data-id="${m.id}">×</button></div>`).join('')}</div></section>`;
  }

  function renderTrainingProgress() {
    const weeks = aggregateWeeks(8);
    return `
      <section class="section"><div class="stats-grid">
        <div class="stat"><div class="stat-value">${state.workouts.length}</div><div class="stat-label">всего тренировок</div></div>
        <div class="stat"><div class="stat-value">${calculateStreak()}</div><div class="stat-label">серия дней</div></div>
        <div class="stat"><div class="stat-value">${Math.round(state.workouts.reduce((s,w)=>s+(w.durationSec||0),0)/3600)}</div><div class="stat-label">часов</div></div>
        <div class="stat"><div class="stat-value">${Math.round(avgCompletion(state.workouts))}%</div><div class="stat-label">среднее выполнение</div></div>
      </div></section>
      <section class="section"><div class="card"><div class="section-head"><h2>Тренировки по неделям</h2></div>${barChart(weeks.map(x=>({label:x.label,value:x.count})), 'трен.')}</div></section>`;
  }

  function renderRecordsProgress() {
    const timeline = recordsTimeline();
    const latest = timeline[0];
    const exerciseCount = new Set(timeline.map((record) => record.exerciseId).filter(Boolean)).size;
    const cautionCount = timeline.filter((record) => record.caution).length;
    const leaders = bestCurrentRecords().slice(0, 10);
    return `
      <section class="section"><div class="stats-grid">
        <div class="stat"><div class="stat-value">${timeline.length}</div><div class="stat-label">рекордов</div></div>
        <div class="stat"><div class="stat-value">${exerciseCount}</div><div class="stat-label">упражнений</div></div>
        <div class="stat"><div class="stat-value">${latest ? formatShortDate(latest.date) : '—'}</div><div class="stat-label">последний</div></div>
        <div class="stat"><div class="stat-value">${cautionCount}</div><div class="stat-label">с болью</div></div>
      </div></section>
      <section class="section"><div class="section-head"><h2>Последние рекорды</h2></div><div class="card list-card records-list">${timeline.length ? timeline.slice(0, 30).map(renderRecordRow).join('') : '<div class="empty compact-empty"><strong>Пока рекордов нет</strong>Они появятся после повторных тренировок, когда будет с чем сравнить.</div>'}</div></section>
      <section class="section"><div class="section-head"><h2>Лучшие текущие показатели</h2></div><div class="card list-card records-list">${leaders.length ? leaders.map(renderBestRecordRow).join('') : '<div class="empty compact-empty"><strong>Нет данных</strong>Выполни хотя бы несколько подходов с весом или временем.</div>'}</div></section>
      <div class="notice">Рекорды считаются из истории текущего профиля. Если была сильная боль, рекорд сохраняется, но приложение не будет подталкивать к новой прогрессии.</div>`;
  }

  function renderStrengthProgress() {
    const exercisesWithData = state.exercises.filter((exercise) => state.workouts.some((w) => w.exercises.some((r) => r.exerciseId === exercise.id && r.sets.some((s) => s.completed && Number(s.weightKg) > 0))));
    const selectedId = state.settings.strengthExerciseId && exercisesWithData.some(x=>x.id===state.settings.strengthExerciseId) ? state.settings.strengthExerciseId : exercisesWithData[0]?.id;
    const data = selectedId ? strengthSeries(selectedId) : [];
    return `
      <section class="section"><div class="card">
        <div class="field"><label>Упражнение</label><select id="strength-exercise-select">${exercisesWithData.map((x)=>`<option value="${x.id}" ${x.id===selectedId?'selected':''}>${escapeHTML(x.name)}</option>`).join('')}</select></div>
        <div style="margin-top:14px">${selectedId ? lineChart(data, 'value', 'кг', 'date') : '<div class="empty"><strong>Нет данных</strong>Внеси вес в подходах — график появится автоматически.</div>'}</div>
      </div></section>
      <div class="notice">График показывает максимальный выполненный рабочий вес за тренировку, а не расчётный одноповторный максимум.</div>`;
  }

  function renderStepperProgress() {
    const data = stepperSeries();
    return `<section class="section"><div class="card"><div class="section-head"><h2>Минуты на степпере</h2><span class="muted">${data.reduce((s,x)=>s+x.value,0)} мин</span></div>${lineChart(data, 'value', 'мин', 'date')}</div></section>`;
  }

  function renderPhotoProgress() {
    const photoOptions = state.photos.map((p) => `<option value="${p.id}">${formatShortDate(p.date)} · ${photoCategoryLabel(p.category)}</option>`).join('');
    return `
      <section class="section"><button class="button primary full" id="add-photo">Добавить фото прогресса</button></section>
      <div class="notice warning">Фото хранятся только в IndexedDB этого приложения. iPhone может удалить данные сайта при очистке Safari или нехватке места. Для важных снимков сохраняй оригиналы в «Фото»/«Файлы» и периодически делай полный экспорт.</div>
      <section class="section" style="margin-top:14px"><div class="card"><div class="section-head"><h2>Сравнить две даты</h2></div><div class="inline-fields"><div class="field"><label>Слева</label><select id="compare-left"><option value="">Выбрать</option>${photoOptions}</select></div><div class="field"><label>Справа</label><select id="compare-right"><option value="">Выбрать</option>${photoOptions}</select></div></div><div id="photo-compare" style="margin-top:12px"></div></div></section>
      <section class="section"><div class="photo-grid">${state.photos.length ? state.photos.map(photoCard).join('') : '<div class="card empty" style="grid-column:1/-1"><strong>Фото пока нет</strong>Фотографии не встроены в публичный проект — добавь их локально после установки.</div>'}</div></section>`;
  }

  function photoCard(photo) {
    const url = URL.createObjectURL(photo.blob);
    state.photoUrls.set(photo.id, url);
    return `<div class="photo-card"><img src="${url}" alt="Фото прогресса ${escapeAttr(photo.category)}"><div class="photo-label">${formatShortDate(photo.date)} · ${photoCategoryLabel(photo.category)}<br><button class="link-button delete-photo" data-id="${photo.id}" style="margin-top:5px">Удалить</button></div></div>`;
  }

  function bindProgressEvents() {
    document.getElementById('add-measurement')?.addEventListener('click', showMeasurementModal);
    document.getElementById('measurement-history')?.addEventListener('click', showMeasurementsModal);
    el.main.querySelectorAll('.delete-measurement').forEach((button) => button.addEventListener('click', () => deleteMeasurement(button.dataset.id)));
    document.getElementById('strength-exercise-select')?.addEventListener('change', async (event) => {
      state.settings.strengthExerciseId = event.target.value;
      await DB.setSettingsObject({ strengthExerciseId: event.target.value }, state.activeProfileId);
      renderProgress();
    });
    document.getElementById('add-photo')?.addEventListener('click', showPhotoModal);
    el.main.querySelectorAll('.delete-photo').forEach((button) => button.addEventListener('click', () => deletePhoto(button.dataset.id)));
    const left = document.getElementById('compare-left');
    const right = document.getElementById('compare-right');
    const updateCompare = () => renderPhotoCompare(left?.value, right?.value);
    left?.addEventListener('change', updateCompare);
    right?.addEventListener('change', updateCompare);
  }

  function showMeasurementModal() {
    const latest = state.measurements[0] || {};
    showModal(`
      <div class="modal-head"><h2>Новый замер</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Дата</label><input id="measure-date" type="date" value="${todayISO()}"></div>
        <div class="inline-fields"><div class="field"><label>Вес, кг</label><input id="measure-weight" type="number" inputmode="decimal" step="0.1" value="${latest.weightKg ?? state.profile.currentWeightKg}"></div><div class="field"><label>Талия, см</label><input id="measure-waist" type="number" inputmode="decimal" step="0.1" value=""></div></div>
        <div class="inline-fields"><div class="field"><label>Живот, см</label><input id="measure-abdomen" type="number" inputmode="decimal" step="0.1"></div><div class="field"><label>Грудь, см</label><input id="measure-chest" type="number" inputmode="decimal" step="0.1"></div></div>
        <div class="inline-fields"><div class="field"><label>Бёдра, см</label><input id="measure-hips" type="number" inputmode="decimal" step="0.1"></div><div class="field"><label>Рука, см</label><input id="measure-arm" type="number" inputmode="decimal" step="0.1"></div></div>
        <div class="field"><label>Комментарий</label><textarea id="measure-note" placeholder="Утро/вечер, после смены, отёки…"></textarea></div>
      </div>
      <button class="button primary full" id="save-measurement" style="margin-top:14px">Сохранить</button>
    `);
    document.getElementById('save-measurement').addEventListener('click', async () => {
      const measurement = {
        id: uid('measurement'),
        profileId: state.activeProfileId,
        date: document.getElementById('measure-date').value || todayISO(),
        weightKg: numberOrNull(document.getElementById('measure-weight').value),
        waistCm: numberOrNull(document.getElementById('measure-waist').value),
        abdomenCm: numberOrNull(document.getElementById('measure-abdomen').value),
        chestCm: numberOrNull(document.getElementById('measure-chest').value),
        hipsCm: numberOrNull(document.getElementById('measure-hips').value),
        armCm: numberOrNull(document.getElementById('measure-arm').value),
        note: document.getElementById('measure-note').value.trim(),
      };
      await DB.put('measurements', measurement);
      state.measurements.push(measurement);
      state.measurements.sort((a,b)=>b.date.localeCompare(a.date));
      closeModal();
      toast('Замер сохранён');
      render();
    });
  }

  function showMeasurementsModal() {
    showModal(`<div class="modal-head"><h2>Все замеры</h2><button class="modal-close" data-close>×</button></div><div class="card list-card">${state.measurements.map((m)=>`<div class="list-row"><div class="list-row-main"><div class="list-row-title">${formatShortDate(m.date)}</div><div class="list-row-sub">Вес ${m.weightKg ?? '—'} · талия ${m.waistCm ?? '—'} · живот ${m.abdomenCm ?? '—'} · грудь ${m.chestCm ?? '—'} · бёдра ${m.hipsCm ?? '—'} · рука ${m.armCm ?? '—'}</div></div></div>`).join('')}</div>`);
  }

  async function deleteMeasurement(id) {
    await DB.remove('measurements', id);
    state.measurements = state.measurements.filter((m)=>m.id!==id);
    renderProgress();
    toast('Замер удалён');
  }

  function showPhotoModal() {
    showModal(`
      <div class="modal-head"><h2>Фото прогресса</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Дата</label><input id="photo-date" type="date" value="${todayISO()}"></div>
        <div class="field"><label>Категория</label><select id="photo-category"><option value="front">Спереди</option><option value="side">Сбоку</option><option value="back">Сзади</option></select></div>
        <div class="field"><label>Фотография</label><input id="photo-file" type="file" accept="image/*"></div>
        <div class="field"><label>Комментарий</label><textarea id="photo-note"></textarea></div>
      </div>
      <div class="notice warning" style="margin-top:12px">Не размещай эти фотографии внутри папки проекта: при публикации на GitHub Pages они станут публичными. Добавляй их только через установленное приложение.</div>
      <button class="button primary full" id="save-photo" style="margin-top:14px">Сохранить локально</button>
    `);
    document.getElementById('save-photo').addEventListener('click', async () => {
      const file = document.getElementById('photo-file').files[0];
      if (!file) return toast('Выбери фотографию');
      const photo = {
        id: uid('photo'),
        profileId: state.activeProfileId,
        date: document.getElementById('photo-date').value || todayISO(),
        category: document.getElementById('photo-category').value,
        note: document.getElementById('photo-note').value.trim(),
        blob: file,
        mimeType: file.type,
        filename: file.name,
        createdAt: new Date().toISOString(),
      };
      await DB.put('photos', photo);
      state.photos.unshift(photo);
      closeModal();
      renderProgress();
      toast('Фото сохранено на устройстве');
    });
  }

  async function deletePhoto(id) {
    await DB.remove('photos', id);
    state.photos = state.photos.filter((p)=>p.id!==id);
    renderProgress();
    toast('Фото удалено');
  }

  function renderPhotoCompare(leftId, rightId) {
    const target = document.getElementById('photo-compare');
    if (!target) return;
    const left = state.photos.find((p)=>p.id===leftId);
    const right = state.photos.find((p)=>p.id===rightId);
    if (!left || !right) { target.innerHTML = '<div class="empty">Выбери две фотографии.</div>'; return; }
    const leftUrl = URL.createObjectURL(left.blob); const rightUrl = URL.createObjectURL(right.blob);
    state.photoUrls.set(`compare-${left.id}`, leftUrl); state.photoUrls.set(`compare-${right.id}`, rightUrl);
    target.innerHTML = `<div class="compare-grid"><div><img src="${leftUrl}" alt="Слева"><div class="center muted">${formatShortDate(left.date)}</div></div><div><img src="${rightUrl}" alt="Справа"><div class="center muted">${formatShortDate(right.date)}</div></div></div>`;
  }

  function profileCreateFields() {
    const templates = state.allPrograms.filter((program) => !program.ownerProfileId);
    const available = templates.length ? templates : state.allPrograms;
    return `
      <div class="form-grid profile-create-form">
        <div class="field"><label>Имя</label><input id="new-profile-name" autocomplete="name" placeholder="Например: Лёха"></div>
        <div class="inline-fields three">
          <div class="field"><label>Возраст</label><input id="new-profile-age" type="number" min="14" max="100" value="30"></div>
          <div class="field"><label>Рост, см</label><input id="new-profile-height" type="number" min="120" max="230" value="175"></div>
          <div class="field"><label>Вес, кг</label><input id="new-profile-weight" type="number" min="35" max="250" step="0.1" value="75"></div>
        </div>
        <div class="field"><label>Главная цель</label><input id="new-profile-goal" placeholder="Подтянуть тело, набрать силу, убрать живот…"></div>
        <div class="field"><label>Доступный инвентарь</label><textarea id="new-profile-equipment" placeholder="Гантели, штанга, коврик, степпер…"></textarea></div>
        <div class="field"><label>Стартовая программа</label><select id="new-profile-program">${available.map((program) => `<option value="${escapeAttr(program.id)}">${escapeHTML(program.name)}</option>`).join('')}<option value="individual">Индивидуальная</option></select><div class="help">Индивидуальная программа создаётся пустой: дни и упражнения добавишь под себя в разделе «План».</div></div>
      </div>`;
  }

  function showProfileOnboarding() {
    document.querySelector('.bottom-nav').classList.add('hidden');
    el.quickAdd.classList.add('hidden');
    el.profileSwitch.classList.add('hidden');
    setTopbar('Создай профиль', 'Первый запуск');
    el.main.innerHTML = `
      <section class="section onboarding-section">
        <div class="card hero-card">
          <span class="chip accent">ЛИЧНЫЕ ДАННЫЕ</span>
          <h2>Кто будет тренироваться?</h2>
          <p>У каждого профиля будут отдельные тренировки, рабочие веса, замеры, фотографии и настройки.</p>
        </div>
      </section>
      <section class="section"><div class="card">${profileCreateFields()}<button class="button primary full" id="create-first-profile" style="margin-top:14px">Создать профиль</button></div></section>
      <section class="section"><div class="notice"><strong>Без регистрации.</strong> Данные остаются только на этом устройстве. На другом телефоне человек создаст собственный профиль после открытия ссылки.</div></section>`;
    document.getElementById('create-first-profile').addEventListener('click', () => createProfileFromForm(document));
  }

  function showCreateProfileModal() {
    showModal(`
      <div class="modal-head"><h2>Новый профиль</h2><button class="modal-close" data-close>×</button></div>
      ${profileCreateFields()}
      <button class="button primary full" id="create-profile" style="margin-top:14px">Создать</button>
      <div class="help" style="margin-top:10px">История, замеры, фотографии и рабочие веса нового профиля будут полностью отдельными.</div>
    `);
    document.getElementById('create-profile').addEventListener('click', () => createProfileFromForm(el.modalRoot));
  }

  async function createProfileFromForm(root) {
    const name = root.querySelector('#new-profile-name')?.value.trim();
    if (!name) return toast('Введи имя профиля');
    const templateId = root.querySelector('#new-profile-program')?.value;
    const isIndividualProgram = templateId === 'individual';
    const template = isIndividualProgram
      ? null
      : (state.allPrograms.find((program) => program.id === templateId) || state.allPrograms[0]);
    if (!isIndividualProgram && !template) return toast('Не найдена стартовая программа');

    const profileId = uid('profile');
    const goal = root.querySelector('#new-profile-goal')?.value.trim();
    const equipmentText = root.querySelector('#new-profile-equipment')?.value.trim() || '';
    const profile = {
      id: profileId,
      name,
      age: Number(root.querySelector('#new-profile-age')?.value || 30),
      heightCm: Number(root.querySelector('#new-profile-height')?.value || 175),
      currentWeightKg: Number(root.querySelector('#new-profile-weight')?.value || 75),
      goals: goal ? [goal] : ['Стать сильнее и улучшить форму'],
      equipment: equipmentText ? equipmentText.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean) : [],
      constraints: [],
      progressNote: '',
    };

    let personalProgram;
    if (isIndividualProgram) {
      const createdAt = new Date().toISOString();
      personalProgram = {
        id: uid(`program-${profileId}`),
        name: 'Индивидуальная программа',
        description: 'Собери дни, упражнения, подходы и нагрузку полностью под себя.',
        ownerProfileId: profileId,
        templateId: 'individual',
        createdAt,
        updatedAt: createdAt,
        days: [{
          id: uid('day'),
          name: 'День 1',
          durationMin: 45,
          focus: '',
          exercises: [],
          short: [],
        }],
      };
      await DB.put('programs', personalProgram);
      state.allPrograms.push(personalProgram);
    } else {
      personalProgram = await createPersonalProgramFromTemplate(template, profileId);
    }
    const settings = {
      ...clone(window.NIKITA_SEED.settings),
      activeProgramId: personalProgram.id,
      currentDayIndex: 0,
      lastBackupAt: null,
    };
    await DB.createProfile(profile, clone(window.NIKITA_SEED.nutrition), settings);
    await DB.put('measurements', {
      id: uid('measurement'),
      profileId,
      date: todayISO(),
      weightKg: profile.currentWeightKg,
      waistCm: null,
      abdomenCm: null,
      chestCm: null,
      hipsCm: null,
      armCm: null,
      note: 'Стартовый вес при создании профиля.',
    });

    clearInterval(state.workoutClockInterval);
    state.currentWorkout = null;
    closeModal();
    await loadState();
    await ensurePersonalActiveProgram();
    document.querySelector('.bottom-nav').classList.remove('hidden');
    el.quickAdd.classList.remove('hidden');
    el.profileSwitch.classList.remove('hidden');
    toast(isIndividualProgram
      ? `Профиль «${name}» создан — составь программу под себя`
      : `Профиль «${name}» создан`);
    navigate(isIndividualProgram ? 'plan' : 'home');
  }

  function showProfileSwitcher() {
    if (!state.profiles.length) return showProfileOnboarding();
    showModal(`
      <div class="modal-head"><h2>Профили</h2><button class="modal-close" data-close>×</button></div>
      <div class="card list-card">
        ${state.profiles.map((profile) => `
          <div class="list-row profile-row ${profile.id === state.activeProfileId ? 'current-profile' : ''}">
            <button class="profile-row-main switch-profile" data-id="${escapeAttr(profile.id)}" type="button">
              <span class="profile-avatar">${escapeHTML(profile.name.charAt(0).toUpperCase())}</span>
              <span class="list-row-main"><span class="list-row-title">${escapeHTML(profile.name)}</span><span class="list-row-sub">${profile.age || '—'} лет · ${profile.heightCm || '—'} см · ${profile.currentWeightKg || '—'} кг${profile.id === state.activeProfileId ? ' · выбран' : ''}</span></span>
            </button>
            ${profile.id !== state.activeProfileId ? `<button class="mini-button delete-profile" data-id="${escapeAttr(profile.id)}" type="button" aria-label="Удалить профиль">×</button>` : '<span class="profile-check">✓</span>'}
          </div>`).join('')}
      </div>
      <button class="button primary full" id="add-profile" style="margin-top:12px">＋ Новый профиль</button>
      <div class="help" style="margin-top:10px">Переключение не смешивает историю, замеры, фотографии и рабочие веса.</div>
    `);
    el.modalRoot.querySelectorAll('.switch-profile').forEach((button) => button.addEventListener('click', () => switchActiveProfile(button.dataset.id)));
    el.modalRoot.querySelectorAll('.delete-profile').forEach((button) => button.addEventListener('click', () => deleteProfileById(button.dataset.id)));
    document.getElementById('add-profile').addEventListener('click', showCreateProfileModal);
  }

  async function switchActiveProfile(profileId) {
    if (profileId === state.activeProfileId) return closeModal();
    if (state.currentWorkout) await saveDraftWorkout();
    state.currentWorkout = null;
    stopRestTimer(false);
    clearInterval(state.workoutClockInterval);
    await DB.setActiveProfileId(profileId);
    state.activeProfileId = profileId;
    await loadActiveProfileData();
    await ensurePersonalActiveProgram();
    await restoreDraftWorkout();
    closeModal();
    toast(`Выбран профиль «${state.profile.name}»`);
    navigate('home');
  }

  async function deleteProfileById(profileId) {
    const profile = state.profiles.find((item) => item.id === profileId);
    if (!profile || profileId === state.activeProfileId) return;
    if (!window.confirm(`Удалить профиль «${profile.name}» вместе со всей его историей и фотографиями?`)) return;
    await DB.deleteProfile(profileId);
    state.allPrograms = state.allPrograms.filter((program) => program.ownerProfileId !== profileId);
    state.allExercises = state.allExercises.filter((exercise) => exercise.ownerProfileId !== profileId);
    await loadState();
    toast(`Профиль «${profile.name}» удалён`);
    showProfileSwitcher();
  }

  function renderMore() {
    setTopbar('Настройки', `Профиль: ${state.profile.name}`);
    const goals = state.profile.goals?.length ? state.profile.goals : ['Цель пока не указана'];
    el.main.innerHTML = `
      <section class="section"><div class="card hero-card"><div class="eyebrow">Текущий профиль · ${state.profiles.length} всего</div><h2>${escapeHTML(state.profile.name)}</h2><p>${state.profile.age || '—'} лет · ${state.profile.heightCm || '—'} см · ${state.profile.currentWeightKg || '—'} кг</p><div class="hero-meta"><span class="chip">Отдельная история</span><span class="chip">Офлайн</span><span class="chip">Личные данные</span></div><div class="button-row"><button class="button secondary" id="switch-profile">Сменить</button><button class="button primary" id="new-profile">＋ Профиль</button></div><button class="button ghost full" id="edit-profile" style="margin-top:10px">Изменить текущий профиль</button></div></section>

      <section class="section"><div class="section-head"><h2>Цель</h2></div><div class="card list-card">${goals.map((g)=>`<div class="list-row"><div class="list-row-main"><div class="list-row-title">✓ ${escapeHTML(g)}</div></div></div>`).join('')}</div></section>

      <section class="section"><div class="section-head"><h2>Калории и БЖУ</h2><button class="link-button" id="edit-nutrition">Изменить</button></div><div class="card"><div class="stats-grid"><div><div class="stat-value">${state.nutrition.trainingCalories}</div><div class="stat-label">тренировка, ккал</div></div><div><div class="stat-value">${state.nutrition.recoveryCalories}</div><div class="stat-label">восстановление</div></div><div><div class="stat-value">${state.nutrition.proteinG}</div><div class="stat-label">белок, г</div></div><div><div class="stat-value">${state.nutrition.trainingFatG}</div><div class="stat-label">жиры, г</div></div></div><div class="divider"></div><div class="help">${escapeHTML(state.nutrition.note)}</div></div></section>

      <section class="section"><div class="section-head"><h2>Сигналы таймера</h2></div><div class="card list-card"><label class="list-row"><div><div class="list-row-title">Звук</div><div class="list-row-sub">Сигнал после отдыха</div></div><input id="sound-toggle" type="checkbox" ${state.settings.soundEnabled ? 'checked' : ''}></label><label class="list-row"><div><div class="list-row-title">Вибрация</div><div class="list-row-sub">На iPhone Safari может не поддерживаться</div></div><input id="vibration-toggle" type="checkbox" ${state.settings.vibrationEnabled ? 'checked' : ''}></label></div></section>

      <section class="section"><div class="section-head"><h2>История боли</h2><button class="link-button" id="open-pain-history">Показать всё</button></div><div class="card list-card">${state.painEntries.length ? state.painEntries.slice(0, 4).map(renderPainEntry).join('') : '<div class="empty compact-empty"><strong>Пока пусто</strong>Отметки появятся после тренировок с контролем боли.</div>'}</div></section>

      <section class="section"><div class="section-head"><h2>Резервная копия всех профилей</h2></div><div class="card"><div class="button-row"><button class="button primary" id="export-data">Данные JSON</button><button class="button secondary" id="export-full">С фото</button></div><button class="button ghost full" id="import-data" style="margin-top:10px">Импортировать копию</button><input id="import-file" type="file" accept="application/json" hidden><div class="help" style="margin-top:10px">Копия включает все профили. «Данные JSON» не содержит фото; перед импортом такой копии приложение отдельно предупредит о возможном удалении локальных фотографий.</div></div></section>

      <section class="section"><div class="section-head"><h2>Обновление приложения</h2></div><div class="card update-card"><div class="list-row no-border"><div class="list-row-main"><div class="list-row-title">Текущая версия: ${escapeHTML(APP_VERSION)}</div><div class="list-row-sub">Проверка не трогает профили, историю, фото и IndexedDB.</div></div><span class="update-status-dot" aria-hidden="true">↻</span></div><div class="update-status-grid"><div><span>Статус</span><strong id="app-update-status-text">${escapeHTML(state.update.statusText || 'Пока не проверяли')}</strong></div><div><span>Кэш</span><strong id="app-cache-status-text">${escapeHTML(state.update.cacheStatus || 'неизвестно')}</strong></div><div><span>Последняя проверка</span><strong id="app-update-last-check">${escapeHTML(formatUpdateTimestamp(state.update.lastCheckAt))}</strong></div></div><div class="button-row"><button class="button primary" id="check-app-update">Проверить обновление</button><button class="button secondary" id="force-app-refresh">Обновить кэш</button></div><div class="help" style="margin-top:10px">«Обновить кэш» очищает только файлы приложения. Профили, история, фото, боль, рекорды и черновики остаются в IndexedDB.</div></div></section>

      <section class="section"><div class="section-head"><h2>Установка PWA</h2></div><div class="card"><ol class="muted" style="padding-left:20px;line-height:1.6"><li>Открой опубликованный адрес в Safari.</li><li>Нажми «Поделиться».</li><li>Выбери «На экран Домой».</li><li>Открой иконку один раз при интернете — после этого оболочка работает офлайн.</li></ol><button class="button secondary full" id="storage-info">Проверить хранилище</button><div class="help" style="margin-top:10px">Версия приложения ${escapeHTML(APP_VERSION)} · база IndexedDB v3</div></div></section>

      <section class="section"><div class="notice warning"><strong>Ограничение iPhone.</strong> Данные PWA могут исчезнуть после удаления иконки, очистки данных Safari или при критической нехватке памяти. Экспорт — обязательная страховка.</div></section>
    `;
    document.getElementById('switch-profile').addEventListener('click', showProfileSwitcher);
    document.getElementById('new-profile').addEventListener('click', showCreateProfileModal);
    document.getElementById('edit-profile').addEventListener('click', showProfileModal);
    document.getElementById('edit-nutrition').addEventListener('click', showNutritionModal);
    document.getElementById('sound-toggle').addEventListener('change', (e)=>saveToggle('soundEnabled',e.target.checked));
    document.getElementById('vibration-toggle').addEventListener('change', (e)=>saveToggle('vibrationEnabled',e.target.checked));
    document.getElementById('open-pain-history').addEventListener('click', showPainHistoryModal);
    document.getElementById('export-data').addEventListener('click', ()=>exportBackup(false));
    document.getElementById('export-full').addEventListener('click', ()=>exportBackup(true));
    document.getElementById('import-data').addEventListener('click', ()=>document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importBackupFile);
    document.getElementById('check-app-update').addEventListener('click', () => checkForAppUpdate(true));
    document.getElementById('force-app-refresh').addEventListener('click', forceRefreshAppShell);
    document.getElementById('storage-info').addEventListener('click', showStorageInfo);
  }

  function showProfileModal() {
    showModal(`
      <div class="modal-head"><h2>Профиль ${escapeHTML(state.profile.name)}</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Имя</label><input id="profile-name" value="${escapeAttr(state.profile.name)}"></div>
        <div class="inline-fields three"><div class="field"><label>Возраст</label><input id="profile-age" type="number" value="${state.profile.age || ''}"></div><div class="field"><label>Рост, см</label><input id="profile-height" type="number" value="${state.profile.heightCm || ''}"></div><div class="field"><label>Вес, кг</label><input id="profile-weight" type="number" step="0.1" value="${state.profile.currentWeightKg || ''}"></div></div>
        <div class="field"><label>Цели — по одной на строке</label><textarea id="profile-goals">${escapeHTML((state.profile.goals || []).join('\n'))}</textarea></div>
        <div class="field"><label>Инвентарь — по одному на строке</label><textarea id="profile-equipment">${escapeHTML((state.profile.equipment || []).join('\n'))}</textarea></div>
        <div class="field"><label>Заметка о прогрессе</label><textarea id="profile-progress">${escapeHTML(state.profile.progressNote || '')}</textarea></div>
      </div>
      <button class="button primary full" id="save-profile" style="margin-top:14px">Сохранить</button>
    `);
    document.getElementById('save-profile').addEventListener('click', async ()=>{
      state.profile.name=document.getElementById('profile-name').value.trim()||'Профиль';
      state.profile.age=Number(document.getElementById('profile-age').value||0);
      state.profile.heightCm=Number(document.getElementById('profile-height').value||0);
      state.profile.currentWeightKg=Number(document.getElementById('profile-weight').value||0);
      state.profile.goals=document.getElementById('profile-goals').value.split('\n').map((item)=>item.trim()).filter(Boolean);
      state.profile.equipment=document.getElementById('profile-equipment').value.split('\n').map((item)=>item.trim()).filter(Boolean);
      state.profile.progressNote=document.getElementById('profile-progress').value.trim();
      state.profile.updatedAt=new Date().toISOString();
      await DB.put('profile',state.profile);
      state.profiles = state.profiles.map((profile) => profile.id === state.profile.id ? state.profile : profile);
      updateProfileButton();
      closeModal();
      renderMore();
      toast('Профиль сохранён');
    });
  }

  function showNutritionModal() {
    showModal(`
      <div class="modal-head"><h2>Калории и БЖУ</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid"><div class="inline-fields"><div class="field"><label>Тренировка, ккал</label><input id="n-train-cal" type="number" value="${state.nutrition.trainingCalories}"></div><div class="field"><label>Восстановление, ккал</label><input id="n-rest-cal" type="number" value="${state.nutrition.recoveryCalories}"></div></div><div class="inline-fields three"><div class="field"><label>Белок, г</label><input id="n-protein" type="number" value="${state.nutrition.proteinG}"></div><div class="field"><label>Жиры трен., г</label><input id="n-fat-train" type="number" value="${state.nutrition.trainingFatG}"></div><div class="field"><label>Жиры отдых, г</label><input id="n-fat-rest" type="number" value="${state.nutrition.recoveryFatG}"></div></div><div class="inline-fields"><div class="field"><label>Углеводы трен., г</label><input id="n-carb-train" type="number" value="${state.nutrition.trainingCarbsG}"></div><div class="field"><label>Углеводы отдых, г</label><input id="n-carb-rest" type="number" value="${state.nutrition.recoveryCarbsG}"></div></div><div class="field"><label>Примечание</label><textarea id="n-note">${escapeHTML(state.nutrition.note)}</textarea></div></div>
      <button class="button primary full" id="save-nutrition" style="margin-top:14px">Сохранить</button>
    `);
    document.getElementById('save-nutrition').addEventListener('click', async ()=>{
      Object.assign(state.nutrition,{trainingCalories:Number(document.getElementById('n-train-cal').value),recoveryCalories:Number(document.getElementById('n-rest-cal').value),proteinG:Number(document.getElementById('n-protein').value),trainingFatG:Number(document.getElementById('n-fat-train').value),recoveryFatG:Number(document.getElementById('n-fat-rest').value),trainingCarbsG:Number(document.getElementById('n-carb-train').value),recoveryCarbsG:Number(document.getElementById('n-carb-rest').value),note:document.getElementById('n-note').value.trim()});
      await DB.put('nutrition',state.nutrition); closeModal(); renderMore(); toast('Питание обновлено');
    });
  }

  async function saveToggle(key, value) { state.settings[key]=value; await DB.setSettingsObject({[key]:value}, state.activeProfileId); }

  async function exportBackup(includePhotos) {
    try {
      toast(includePhotos ? 'Готовлю копию с фото…' : 'Готовлю резервную копию…');
      const backup = await DB.exportData(includePhotos);
      downloadBlob(new Blob([JSON.stringify(backup)], {type:'application/json'}), `workouts-all-profiles-${includePhotos?'full':'data'}-${todayISO()}.json`);
      state.settings.lastBackupAt = new Date().toISOString();
      await DB.setSettingsObject({lastBackupAt:state.settings.lastBackupAt}, state.activeProfileId);
    } catch (error) { toast(`Ошибка экспорта: ${error.message}`); }
  }

  async function importBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!backup || backup.format !== 'nikita-workouts-backup' || !backup.data) {
        throw new Error('Это не резервная копия приложения «Тренировки»');
      }

      const existingPhotos = await DB.getAll('photos');
      const backupIncludesPhotos = Array.isArray(backup.data.photos);
      const confirmation = backupIncludesPhotos
        ? 'Импорт полностью заменит текущие профили, историю, замеры, настройки и фотографии данными из файла. Продолжить?'
        : existingPhotos.length
          ? `ВНИМАНИЕ: эта копия создана без фотографий. При полной замене будут удалены локальные фото: ${existingPhotos.length}. Сначала сделай копию «С фото», если они нужны. Продолжить импорт?`
          : 'Эта копия создана без фотографий. Импорт полностью заменит текущие профили, историю, замеры и настройки. Продолжить?';
      if (!window.confirm(confirmation)) return;

      clearDraftSaveTimer();
      stopRestTimer(false);
      clearInterval(state.workoutClockInterval);
      state.currentWorkout = null;
      await DB.importData(backup, 'replace');
      await loadState();
      if (!state.profiles.length) {
        showProfileOnboarding();
        toast('Копия импортирована — создай профиль');
        return;
      }
      await ensurePersonalActiveProgram();
      await restoreDraftWorkout();
      toast('Копия восстановлена');
      navigate('home');
    } catch (error) {
      console.error(error);
      toast(`Не удалось импортировать: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }


  function showPainHistoryModal() {
    showModal(`
      <div class="modal-head"><h2>История боли</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice"><strong>Это дневник ощущений, не диагноз.</strong><br>Если боль сильная, новая, нарастает или появляется выпуклость/отёк — лучше остановиться и обратиться к врачу.</div>
      <div class="card list-card" style="margin-top:12px">
        ${state.painEntries.length ? state.painEntries.slice(0, 60).map(renderPainEntry).join('') : '<div class="empty compact-empty"><strong>Пока нет записей</strong>Отметь боль перед тренировкой или возле упражнения.</div>'}
      </div>
    `);
  }

  async function showStorageInfo() {
    let text='Браузер не сообщил объём хранилища.';
    if(navigator.storage?.estimate){const e=await navigator.storage.estimate(); text=`Использовано примерно ${formatBytes(e.usage||0)} из ${formatBytes(e.quota||0)}.`;}
    let persistent='';
    if(navigator.storage?.persisted){persistent=(await navigator.storage.persisted())?' Хранилище помечено постоянным.':' Постоянное хранение не гарантировано.';}
    showModal(`<div class="modal-head"><h2>Хранилище</h2><button class="modal-close" data-close>×</button></div><div class="notice">${escapeHTML(text+persistent)}</div><p class="muted">Даже при большом лимите делай резервную копию: пользовательская очистка Safari удаляет локальную базу.</p>`);
  }

  function showQuickAdd() {
    showModal(`
      <div class="modal-head"><h2>Быстро добавить</h2><button class="modal-close" data-close>×</button></div>
      <div class="card list-card"><button class="list-row quick-measure" style="width:100%;background:transparent;border-left:0;border-right:0;border-top:0;color:inherit"><div class="list-row-main"><div class="list-row-title">Замер тела</div><div class="list-row-sub">Вес, талия, живот и объёмы</div></div><span>＋</span></button><button class="list-row quick-photo" style="width:100%;background:transparent;border:0;color:inherit"><div class="list-row-main"><div class="list-row-title">Фото прогресса</div><div class="list-row-sub">Хранится локально</div></div><span>＋</span></button></div>
    `);
    el.modalRoot.querySelector('.quick-measure').addEventListener('click',()=>{closeModal();showMeasurementModal();});
    el.modalRoot.querySelector('.quick-photo').addEventListener('click',()=>{closeModal();showPhotoModal();});
  }

  function showModal(content) {
    el.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-handle"></div>${content}</div></div>`;
    el.modalRoot.querySelectorAll('[data-close]').forEach((x)=>x.addEventListener('click',closeModal));
    el.modalRoot.querySelector('.modal-backdrop').addEventListener('click',(e)=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
  }

  function closeModal() { el.modalRoot.innerHTML=''; }

  function showMeasurementsQuick() { showMeasurementModal(); }

  function bindGoButtons() { el.main.querySelectorAll('[data-go]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.go))); }

  function showStorageWarningIfNeeded() {}

  function draftWorkoutKey(profileId = state.activeProfileId) { return `draftWorkout:${profileId}`; }

  async function saveDraftWorkout(workout = state.currentWorkout, profileId = state.activeProfileId) {
    if (!workout || !profileId || workout.status !== 'in_progress') return;
    const snapshot = clone({ ...workout, profileId });
    await DB.put('meta', { key: draftWorkoutKey(profileId), value: snapshot });
  }

  let draftSaveTimer = null;

  function clearDraftSaveTimer() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }

  async function flushDraftSave() {
    clearDraftSaveTimer();
    await saveDraftWorkout();
  }

  function debounceDraftSave() {
    clearDraftSaveTimer();
    const workoutId = state.currentWorkout?.id;
    const profileId = state.activeProfileId;
    draftSaveTimer = setTimeout(async () => {
      draftSaveTimer = null;
      if (!workoutId || state.currentWorkout?.id !== workoutId || state.activeProfileId !== profileId) return;
      try {
        await saveDraftWorkout(state.currentWorkout, profileId);
      } catch (error) {
        console.error('Draft autosave failed', error);
        toast('Не удалось автоматически сохранить черновик');
      }
    }, 350);
    updateWorkoutProgress();
  }

  async function restoreDraftWorkout() {
    clearDraftSaveTimer();
    state.currentWorkout = null;
    if (!state.activeProfileId) return;
    const row = await DB.get('meta', draftWorkoutKey());
    if (row?.value?.status === 'in_progress' && row.value.profileId === state.activeProfileId) {
      state.currentWorkout = row.value;
    }
  }

  async function discardDraftFromHome() {
    if (!state.currentWorkout) return;
    if (!window.confirm(`Удалить черновик «${state.currentWorkout.dayName}»? Выполненные подходы восстановить не получится.`)) return;
    clearDraftSaveTimer();
    stopRestTimer(false);
    clearInterval(state.workoutClockInterval);
    state.currentWorkout = null;
    await DB.remove('meta', draftWorkoutKey());
    toast('Черновик удалён');
    renderHome();
  }

  function completedSets(result) {
    return result?.sets?.filter((set) => set.completed) || [];
  }

  function previousSetValue(lastResult, setIndex, field, fallback) {
    const sets = completedSets(lastResult);
    const exactSet = lastResult?.sets?.[setIndex];
    const previousSet = exactSet?.completed ? exactSet : sets[sets.length - 1];
    const value = previousSet?.[field];
    return value === '' || value === null || value === undefined ? fallback : value;
  }

  function findLastExerciseResult(exerciseId) {
    for (const workout of state.workouts) {
      const result = workout.exercises?.find((r)=>r.exerciseId===exerciseId && !r.skipped && r.sets?.some((s)=>s.completed));
      if (result) return { ...result, workoutDate: workout.startedAt };
    }
    return null;
  }

  function summarizePrevious(result) {
    const completed=result.sets.filter((s)=>s.completed);
    if(!completed.length)return '';
    if(result.defaults?.unit==='minutes')return `${completed[0].durationMin} мин`;
    if(result.defaults?.unit==='seconds')return `${completed.map((s)=>s.durationSec).join('/') } сек`;
    const weights=completed.map((s)=>Number(s.weightKg)||0);const reps=completed.map((s)=>Number(s.reps)||0);
    return `${Math.max(...weights)} кг · ${reps.join('/')}`;
  }

  function progressionSuggestion(exercise,last) {
    if(!last)return {kind:'start',weightKg:exercise.defaults.weightKg??null,text:'Введи первый рабочий вес'};
    if(exercise.defaults.unit!=='reps')return {kind:'same',weightKg:null,text:'Повтори прошлую длительность'};
    const completed=last.sets.filter((s)=>s.completed);if(!completed.length)return {kind:'reduce',weightKg:null,text:'Начни спокойно'};
    const base=Math.max(...completed.map((s)=>Number(s.weightKg)||0));
    const days=Math.floor((Date.now()-new Date(last.workoutDate).getTime())/86400000);
    if(days>30)return {kind:'reduce',weightKg:roundHalf(base*0.8),text:'Перерыв >30 дней: −20%'};
    if(days>14)return {kind:'reduce',weightKg:roundHalf(base*0.9),text:'После перерыва: −10%'};
    const diff=completed.map((s)=>s.difficulty);
    if(completed.length===last.sets.length && diff.every((x)=>x==='easy')){const next=roundHalf(base>0?base*1.025+0.25:base);return {kind:'increase',weightKg:next,text:base>0?`Попробуй ${next} кг или +1–2 повтора`:'Добавь 1–2 повтора'};}
    if(diff.some((x)=>x==='failure') || completed.length<last.sets.length){const next=base>0?roundHalf(base*0.95):base;return {kind:'reduce',weightKg:next,text:base>0?`Спокойнее: около ${next} кг`:'Снизь повторы'};}
    if(diff.some((x)=>x==='hard'))return {kind:'same',weightKg:base,text:`Оставь ${base || 'тот же'} кг`};
    return {kind:'same',weightKg:base,text:`Повтори ${base || 'тот же вес'} кг`};
  }

  function postWorkoutSuggestion(result){
    const done=result.sets.filter((s)=>s.completed); if(result.skipped||!done.length)return {kind:'reduce',text:'В следующий раз начать легче'};
    if(done.length===result.sets.length && done.every((s)=>s.difficulty==='easy'))return {kind:'increase',text:'Добавить вес или 1–2 повтора'};
    if(done.some((s)=>s.difficulty==='failure')||done.length<result.sets.length)return {kind:'reduce',text:'Снизить вес/повторы на 5–10%'};
    if(done.some((s)=>s.difficulty==='hard'))return {kind:'same',text:'Сохранить нагрузку'};
    return {kind:'same',text:'Повторить нагрузку'};
  }

  function workoutCompletion(workout){const sets=workout.exercises.filter((x)=>!x.skipped).flatMap((x)=>x.sets);if(!sets.length)return 0;return Math.round(sets.filter((s)=>s.completed).length/sets.length*100);}
  function calculateLoad(workout){return Math.round(workout.exercises.reduce((sum,r)=>sum+r.sets.reduce((s,set)=>s+(set.completed?(Number(set.weightKg)||0)*(Number(set.reps)||0):0),0),0));}
  function recordWeightKey(weight) {
    const value = Number(weight) || 0;
    return value > 0 ? String(roundHalf(value)) : '0';
  }

  function setDurationSeconds(result, set) {
    const unit = result?.defaults?.unit;
    if (unit === 'minutes') return Math.max(0, Number(set.durationMin) || 0) * 60;
    if (unit === 'seconds') return Math.max(0, Number(set.durationSec) || 0);
    return 0;
  }

  function isTimeResult(result) {
    return ['minutes', 'seconds'].includes(result?.defaults?.unit);
  }

  function isStepperResult(result) {
    const exercise = getExercise(result?.exerciseId);
    const haystack = `${exercise?.equipment || ''} ${exercise?.name || ''} ${result?.name || ''}`.toLowerCase();
    return haystack.includes('степпер');
  }

  function completedWorkoutList(workouts = state.workouts) {
    return (workouts || []).filter((workout) => workout?.status === 'completed' && Array.isArray(workout.exercises));
  }

  function resultHasHighPain(result, workout) {
    const pre = normalizePainInput(workout?.preWorkoutPain);
    if (pre.hasPain && pre.score >= 7 && result?.painRisk) return true;
    if (result?.painRisk?.level === 'high') return true;
    return Boolean(result?.painEvents?.some((event) => Number(event.score) >= 7));
  }

  function exerciseRecordStats(result) {
    const done = completedSets(result);
    const stats = {
      completedSets: done.length,
      maxWeight: 0,
      bestSetScore: 0,
      bestSet: null,
      bestNoFailureScore: 0,
      bestNoFailureSet: null,
      totalVolume: 0,
      bestRepsByWeight: new Map(),
      timeTotalSec: 0,
      timeBestSetSec: 0,
    };
    if (!done.length) return stats;

    if (result.defaults?.unit === 'reps') {
      for (const set of done) {
        const weight = Math.max(0, Number(set.weightKg) || 0);
        const reps = Math.max(0, Number(set.reps) || 0);
        const score = weight * reps;
        stats.maxWeight = Math.max(stats.maxWeight, weight);
        stats.totalVolume += score;
        if (score > stats.bestSetScore) {
          stats.bestSetScore = score;
          stats.bestSet = { weightKg: weight, reps };
        }
        if (set.difficulty !== 'failure' && score > stats.bestNoFailureScore) {
          stats.bestNoFailureScore = score;
          stats.bestNoFailureSet = { weightKg: weight, reps };
        }
        if (weight > 0 && reps > 0) {
          const key = recordWeightKey(weight);
          stats.bestRepsByWeight.set(key, Math.max(stats.bestRepsByWeight.get(key) || 0, reps));
        }
      }
      stats.totalVolume = Math.round(stats.totalVolume);
    } else if (isTimeResult(result)) {
      for (const set of done) {
        const seconds = setDurationSeconds(result, set);
        stats.timeTotalSec += seconds;
        stats.timeBestSetSec = Math.max(stats.timeBestSetSec, seconds);
      }
    }
    return stats;
  }

  function buildRecordBaseline(workouts) {
    const baseline = new Map();
    let stepperBestSec = 0;
    for (const workout of completedWorkoutList(workouts)) {
      let stepperTotalSec = 0;
      for (const result of workout.exercises || []) {
        const stats = exerciseRecordStats(result);
        if (!stats.completedSets) continue;
        const current = baseline.get(result.exerciseId) || {
          maxWeight: 0,
          bestSetScore: 0,
          bestVolume: 0,
          bestNoFailureScore: 0,
          bestRepsByWeight: new Map(),
          timeTotalSec: 0,
          timeBestSetSec: 0,
        };
        current.maxWeight = Math.max(current.maxWeight, stats.maxWeight);
        current.bestSetScore = Math.max(current.bestSetScore, stats.bestSetScore);
        current.bestVolume = Math.max(current.bestVolume, stats.totalVolume);
        current.bestNoFailureScore = Math.max(current.bestNoFailureScore, stats.bestNoFailureScore);
        current.timeTotalSec = Math.max(current.timeTotalSec, stats.timeTotalSec);
        current.timeBestSetSec = Math.max(current.timeBestSetSec, stats.timeBestSetSec);
        for (const [weight, reps] of stats.bestRepsByWeight.entries()) {
          current.bestRepsByWeight.set(weight, Math.max(current.bestRepsByWeight.get(weight) || 0, reps));
        }
        baseline.set(result.exerciseId, current);
        if (isStepperResult(result)) stepperTotalSec += stats.timeTotalSec;
      }
      stepperBestSec = Math.max(stepperBestSec, stepperTotalSec);
    }
    return { byExercise: baseline, stepperBestSec };
  }

  function previousWorkoutsForRecord(workout, workouts = state.workouts) {
    const startedAt = new Date(workout?.startedAt || workout?.date || 0).getTime() || Date.now();
    return completedWorkoutList(workouts).filter((item) => item.id !== workout.id && (new Date(item.startedAt || item.date || 0).getTime() || 0) < startedAt);
  }

  function createRecord({ workout, result, type, title, value, previousValue, unit, description, caution }) {
    return {
      id: uid('record'),
      type,
      workoutId: workout.id,
      date: localDateISO(new Date(workout.startedAt || workout.date || Date.now())),
      createdAt: workout.finishedAt || new Date().toISOString(),
      exerciseId: result?.exerciseId || null,
      exerciseName: result?.name || 'Тренировка',
      title,
      value,
      previousValue,
      unit,
      description,
      caution: Boolean(caution),
    };
  }

  function calculateWorkoutRecords(workout, workouts = state.workouts) {
    if (!workout || workout.status !== 'completed') return [];
    const previous = previousWorkoutsForRecord(workout, workouts);
    const baseline = buildRecordBaseline(previous);
    const records = [];
    let stepperTotalSec = 0;

    for (const result of workout.exercises || []) {
      const stats = exerciseRecordStats(result);
      if (!stats.completedSets || result.skipped) continue;
      const before = baseline.byExercise.get(result.exerciseId) || { bestRepsByWeight: new Map() };
      const caution = resultHasHighPain(result, workout);

      if (result.defaults?.unit === 'reps') {
        if (before.maxWeight > 0 && stats.maxWeight > before.maxWeight) {
          records.push(createRecord({ workout, result, type: 'max_weight', title: 'Максимальный вес', value: stats.maxWeight, previousValue: before.maxWeight, unit: 'кг', description: `${stats.maxWeight} кг вместо ${before.maxWeight} кг`, caution }));
        }
        if (before.bestSetScore > 0 && stats.bestSetScore > before.bestSetScore && stats.bestSet) {
          records.push(createRecord({ workout, result, type: 'best_weight_reps', title: 'Лучший вес × повторы', value: stats.bestSetScore, previousValue: before.bestSetScore, unit: 'кг×повт.', description: `${stats.bestSet.weightKg} кг × ${stats.bestSet.reps} повт.`, caution }));
        }
        let sameWeightRecord = null;
        for (const set of completedSets(result)) {
          const weight = Math.max(0, Number(set.weightKg) || 0);
          const reps = Math.max(0, Number(set.reps) || 0);
          const key = recordWeightKey(weight);
          const previousReps = before.bestRepsByWeight?.get(key) || 0;
          if (weight > 0 && previousReps > 0 && reps > previousReps) {
            const gain = reps - previousReps;
            if (!sameWeightRecord || gain > sameWeightRecord.gain) sameWeightRecord = { weight, reps, previousReps, gain };
          }
        }
        if (sameWeightRecord) {
          records.push(createRecord({ workout, result, type: 'more_reps_same_weight', title: 'Больше повторов с тем же весом', value: sameWeightRecord.reps, previousValue: sameWeightRecord.previousReps, unit: 'повт.', description: `${sameWeightRecord.weight} кг: ${sameWeightRecord.reps} вместо ${sameWeightRecord.previousReps}`, caution }));
        }
        if (before.bestVolume > 0 && stats.totalVolume > before.bestVolume) {
          records.push(createRecord({ workout, result, type: 'best_volume', title: 'Лучший объём', value: stats.totalVolume, previousValue: before.bestVolume, unit: 'кг', description: `${formatCompactLoad(stats.totalVolume)} кг за упражнение`, caution }));
        }
        if (before.bestNoFailureScore > 0 && stats.bestNoFailureScore > before.bestNoFailureScore && stats.bestNoFailureSet) {
          records.push(createRecord({ workout, result, type: 'no_failure', title: 'Рекорд без отказа', value: stats.bestNoFailureScore, previousValue: before.bestNoFailureScore, unit: 'кг×повт.', description: `${stats.bestNoFailureSet.weightKg} кг × ${stats.bestNoFailureSet.reps} без отказа`, caution }));
        }
      } else if (isTimeResult(result)) {
        if (before.timeTotalSec > 0 && stats.timeTotalSec > before.timeTotalSec) {
          records.push(createRecord({ workout, result, type: isStepperResult(result) ? 'stepper_exercise_time' : 'time_total', title: isStepperResult(result) ? 'Рекорд степпера' : 'Лучшее время', value: Math.round(stats.timeTotalSec / 60), previousValue: Math.round(before.timeTotalSec / 60), unit: 'мин', description: `${formatDuration(stats.timeTotalSec)} вместо ${formatDuration(before.timeTotalSec)}`, caution }));
        }
      }

      if (isStepperResult(result)) stepperTotalSec += stats.timeTotalSec;
    }

    if (baseline.stepperBestSec > 0 && stepperTotalSec > baseline.stepperBestSec) {
      records.push(createRecord({ workout, result: { exerciseId: 'stepper-total', name: 'Степпер' }, type: 'stepper_total', title: 'Лучший степпер за тренировку', value: Math.round(stepperTotalSec / 60), previousValue: Math.round(baseline.stepperBestSec / 60), unit: 'мин', description: `${formatDuration(stepperTotalSec)} за тренировку`, caution: false }));
    }

    return records
      .filter((record, index, list) => list.findIndex((item) => item.type === record.type && item.exerciseId === record.exerciseId) === index)
      .slice(0, 12);
  }

  function recordsTimeline() {
    const completed = completedWorkoutList(state.workouts).slice().sort((a, b) => new Date(a.startedAt || a.date) - new Date(b.startedAt || b.date));
    const rows = [];
    for (const workout of completed) {
      const records = Array.isArray(workout.records) && workout.records.length ? workout.records : calculateWorkoutRecords(workout, completed);
      records.forEach((record) => rows.push({ ...record, workoutId: workout.id, date: record.date || localDateISO(new Date(workout.startedAt || workout.date)) }));
    }
    return rows.sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
  }

  function bestCurrentRecords() {
    const baseline = buildRecordBaseline(completedWorkoutList(state.workouts));
    const rows = [];
    baseline.byExercise.forEach((stats, exerciseId) => {
      const exercise = getExercise(exerciseId);
      if (!exercise) return;
      if (stats.maxWeight > 0) rows.push({ exerciseName: exercise.name, label: 'макс. вес', value: `${stats.maxWeight} кг`, score: stats.maxWeight });
      if (stats.bestVolume > 0) rows.push({ exerciseName: exercise.name, label: 'объём', value: `${formatCompactLoad(stats.bestVolume)} кг`, score: stats.bestVolume / 10 });
      if (stats.timeTotalSec > 0) rows.push({ exerciseName: exercise.name, label: 'время', value: formatDuration(stats.timeTotalSec), score: stats.timeTotalSec / 60 });
    });
    return rows.sort((a, b) => b.score - a.score);
  }

  function recordTypeIcon(type) {
    if (type === 'max_weight') return '🏋️';
    if (type === 'best_volume') return '💪';
    if (type === 'more_reps_same_weight') return '🔁';
    if (type === 'no_failure') return '✅';
    if (String(type).includes('stepper')) return '⏱';
    if (String(type).includes('time')) return '⏱';
    return '🔥';
  }

  function renderRecordRow(record) {
    return `<div class="list-row record-row">
      <div class="record-icon ${record.caution ? 'caution' : ''}">${record.caution ? '⚠️' : recordTypeIcon(record.type)}</div>
      <div class="list-row-main">
        <div class="list-row-title">${escapeHTML(record.title)} · ${escapeHTML(record.exerciseName)}</div>
        <div class="list-row-sub">${formatShortDate(record.date)} · ${escapeHTML(record.description || '')}${record.previousValue ? `<br>Было: ${escapeHTML(String(record.previousValue))} ${escapeHTML(record.unit || '')}` : ''}${record.caution ? '<br>Сильная боль была отмечена — прогрессию лучше закрепить без повышения нагрузки.' : ''}</div>
      </div>
    </div>`;
  }

  function renderBestRecordRow(record) {
    return `<div class="list-row record-row"><div class="record-icon">★</div><div class="list-row-main"><div class="list-row-title">${escapeHTML(record.exerciseName)}</div><div class="list-row-sub">${escapeHTML(record.label)} · ${escapeHTML(record.value)}</div></div></div>`;
  }

  function renderWorkoutRecordsBlock(workout) {
    const records = Array.isArray(workout?.records) && workout.records.length ? workout.records : calculateWorkoutRecords(workout, state.workouts);
    if (!records.length) return '';
    return `<div class="card records-result-card" style="margin-top:12px"><div class="section-head"><h2>Рекорды</h2><span class="chip accent">${records.length}</span></div><div class="records-stack">${records.map(renderRecordRow).join('')}</div></div>`;
  }

  function showWorkoutRecordsModal(workout) {
    const records = Array.isArray(workout?.records) ? workout.records : [];
    if (!records.length) return;
    const caution = records.some((record) => record.caution);
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Тренировка сохранена</div><h2>Новые рекорды 🔥</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="card list-card records-list">${records.map(renderRecordRow).join('')}</div>
      ${caution ? '<div class="notice warning" style="margin-top:12px"><strong>Важно.</strong><br>Есть рекорд на фоне сильной боли. Лучше закрепить результат без увеличения нагрузки, а не геройствовать через боль.</div>' : ''}
    `);
  }

  function workoutsSince(date){return state.workouts.filter((w)=>new Date(w.startedAt)>=date);}
  function avgCompletion(workouts){if(!workouts.length)return 0;return workouts.reduce((s,w)=>s+(w.completionPct??workoutCompletion(w)),0)/workouts.length;}
  function calculateStreak(){const dates=[...new Set(state.workouts.filter((w)=>w.status==='completed').map((w)=>localDateISO(new Date(w.startedAt))))].sort().reverse();if(!dates.length)return 0;let streak=0;let cursor=startOfDay(new Date());const latest=new Date(`${dates[0]}T00:00:00`);if((cursor-latest)/86400000>1)return 0;cursor=latest;for(const date of dates){const d=new Date(`${date}T00:00:00`);if(Math.round((cursor-d)/86400000)===0){streak++;cursor=new Date(cursor.getTime()-86400000);}else if(Math.round((cursor-d)/86400000)>0)break;}return streak;}

  function strengthSeries(exerciseId){return state.workouts.slice().reverse().flatMap((w)=>{const r=w.exercises.find((x)=>x.exerciseId===exerciseId);if(!r)return[];const max=Math.max(0,...r.sets.filter((s)=>s.completed).map((s)=>Number(s.weightKg)||0));return max?[{date:localDateISO(new Date(w.startedAt)),value:max}]:[];});}
  function stepperSeries(){return state.workouts.slice().reverse().map((w)=>{let value=0;for(const r of w.exercises){const ex=getExercise(r.exerciseId);if(ex?.equipment==='Степпер')value+=r.sets.filter((s)=>s.completed).reduce((sum,s)=>sum+(Number(s.durationMin)||0),0);}return{date:localDateISO(new Date(w.startedAt)),value};}).filter((x)=>x.value>0);}
  function aggregateWeeks(count){const rows=[];const now=startOfWeek(new Date());for(let i=count-1;i>=0;i--){const start=new Date(now.getTime()-i*7*86400000);const end=new Date(start.getTime()+7*86400000);rows.push({label:`${start.getDate()}.${start.getMonth()+1}`,count:state.workouts.filter((w)=>new Date(w.startedAt)>=start&&new Date(w.startedAt)<end).length});}return rows;}

  function lineChart(data,key,unit,dateKey='date'){
    if(!data.length)return '<div class="empty"><strong>Пока нет данных</strong>Добавь хотя бы два значения.</div>';
    const width=600,height=200,pad=34;const values=data.map((x)=>Number(x[key])).filter(Number.isFinite);const min=Math.min(...values),max=Math.max(...values);const span=max-min||1;const x=(i)=>pad+(i/(Math.max(data.length-1,1)))*(width-pad*2);const y=(v)=>height-pad-((v-min)/span)*(height-pad*2);
    const path=data.map((d,i)=>`${i?'L':'M'} ${x(i)} ${y(Number(d[key]))}`).join(' ');
    return `<div class="chart"><svg viewBox="0 0 ${width} ${height}" role="img"><line class="chart-grid" x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}"/><line class="chart-grid" x1="${pad}" x2="${width-pad}" y1="${pad}" y2="${pad}"/><path class="chart-line" d="${path}"/>${data.map((d,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(Number(d[key]))}" r="5"/><text class="chart-label" x="${x(i)}" y="${height-10}" text-anchor="middle">${formatTinyDate(d[dateKey])}</text>`).join('')}<text class="chart-label" x="6" y="${pad+4}">${max.toFixed(1)} ${unit}</text><text class="chart-label" x="6" y="${height-pad+4}">${min.toFixed(1)}</text></svg></div>`;
  }

  function barChart(data,unit){if(!data.length)return '<div class="empty">Нет данных</div>';const width=600,height=200,pad=32,max=Math.max(1,...data.map((x)=>x.value));const slot=(width-pad*2)/data.length;return `<div class="chart"><svg viewBox="0 0 ${width} ${height}">${data.map((d,i)=>{const h=(d.value/max)*(height-pad*2);const x=pad+i*slot+slot*.2;const y=height-pad-h;return `<rect x="${x}" y="${y}" width="${slot*.6}" height="${h}" rx="6" fill="#c7ff2f"/><text class="chart-label" x="${x+slot*.3}" y="${Math.max(y-6,12)}" text-anchor="middle">${d.value}</text><text class="chart-label" x="${x+slot*.3}" y="${height-10}" text-anchor="middle">${d.label}</text>`;}).join('')}<text class="chart-label" x="6" y="14">${unit}</text></svg></div>`;}

  function showQuickAddOld() {}

  function updateOnlineStatus(){el.offline.hidden=navigator.onLine;}

  function afterAppReady() {
    initUpdateStateFromStorage();
    window.setTimeout(() => showStoredUpdateMessage(), 900);
  }

  function initUpdateStateFromStorage() {
    try {
      const previousVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);
      if (previousVersion && previousVersion !== APP_VERSION) {
        state.update.statusText = `Обновлено с ${previousVersion} до ${APP_VERSION}`;
        state.update.cacheStatus = 'актуальный';
        sessionStorage.setItem(APP_UPDATE_MESSAGE_KEY, JSON.stringify({
          title: 'Приложение обновлено',
          message: `Установлена версия ${APP_VERSION}. Локальные данные не тронуты.`,
          tone: 'success',
          createdAt: Date.now(),
        }));
      } else if (previousVersion === APP_VERSION) {
        state.update.statusText = `Актуальная версия ${APP_VERSION}`;
        state.update.cacheStatus = 'актуальный';
      }
      localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    } catch (error) {
      console.warn('Update state storage failed', error);
    }
  }

  function showStoredUpdateMessage() {
    try {
      const raw = sessionStorage.getItem(APP_UPDATE_MESSAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(APP_UPDATE_MESSAGE_KEY);
      const payload = JSON.parse(raw);
      if (!payload?.title || Date.now() - Number(payload.createdAt || 0) > 60000) return;
      showAppUpdateStatusBanner(payload.title, payload.message || `Версия ${APP_VERSION}`, payload.tone || 'success', 8500);
    } catch (error) {
      console.warn('Stored update message failed', error);
    }
  }

  async function registerServiceWorker(){
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${encodeURIComponent(APP_VERSION)}`);
      state.swRegistration = registration;

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            const label = state.update.availableVersion || 'новая';
            showAppUpdateBanner(label);
            state.update.statusText = `Обновление скачано: ${label}`;
            refreshUpdatePanel();
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        const label = state.update.availableVersion || 'новая';
        showAppUpdateBanner(label);
        state.update.statusText = `Обновление готово: ${label}`;
        refreshUpdatePanel();
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!state.update.reloadOnControllerChange) return;
        state.update.reloadOnControllerChange = false;
        sessionStorage.setItem(APP_UPDATE_MESSAGE_KEY, JSON.stringify({
          title: 'Обновление применено',
          message: `Перезапускаю приложение. Новая версия должна открыться сразу.`,
          tone: 'success',
          createdAt: Date.now(),
        }));
        window.location.reload();
      });

      window.setTimeout(() => checkForAppUpdate(false), 1600);
      if (!state.update.autoCheckTimer) {
        state.update.autoCheckTimer = window.setInterval(() => checkForAppUpdate(false), 15 * 60 * 1000);
      }
    } catch(error) {
      console.warn('SW registration failed', error);
    }
  }

  async function checkForAppUpdate(manual = false) {
    if (state.update.checking) return null;
    if (!navigator.onLine) {
      state.update.statusText = 'Нет интернета для проверки';
      state.update.cacheStatus = 'офлайн';
      refreshUpdatePanel();
      if (manual) toast('Нет интернета — обновление проверить не получится');
      return null;
    }
    state.update.checking = true;
    state.update.statusText = 'Проверяю обновление…';
    refreshUpdatePanel();
    if (manual) toast('Проверяю обновление…');
    try {
      const registration = state.swRegistration || (navigator.serviceWorker?.getRegistration ? await navigator.serviceWorker.getRegistration() : null);
      if (registration?.update) await registration.update().catch((error) => console.warn('SW update check failed', error));

      const response = await fetch(`./version.js?check=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('сервер не отдал version.js');
      const remoteVersion = parseVersionScript(await response.text());
      state.update.lastCheckAt = new Date().toISOString();

      if (remoteVersion && isNewerVersion(remoteVersion, APP_VERSION)) {
        state.update.availableVersion = remoteVersion;
        state.update.statusText = `Доступна версия ${remoteVersion}`;
        state.update.cacheStatus = 'нужно обновить';
        showAppUpdateBanner(remoteVersion);
        refreshUpdatePanel();
        if (manual) toast(`Доступна версия ${remoteVersion}`);
        return remoteVersion;
      }

      if (registration?.waiting && navigator.serviceWorker.controller) {
        const label = remoteVersion || state.update.availableVersion || 'новая';
        state.update.statusText = `Обновление готово: ${label}`;
        state.update.cacheStatus = 'ждёт установки';
        showAppUpdateBanner(label);
        refreshUpdatePanel();
        if (manual) toast('Обновление уже скачано — нажми «Обновить»');
        return label;
      }

      if (state.update.bannerMode === 'update') {
        showAppUpdateStatusBanner('Версия уже актуальна', `Сейчас установлена v${APP_VERSION}. Баннер больше не будет моргать сам по себе.`, 'success', 8500);
      } else if (manual) {
        showAppUpdateStatusBanner('Обновлений нет', `Установлена актуальная версия ${APP_VERSION}.`, 'success', 6500);
      }
      state.update.availableVersion = null;
      state.update.statusText = `Актуальная версия ${APP_VERSION}`;
      state.update.cacheStatus = 'актуальный';
      refreshUpdatePanel();
      if (manual) toast(`Установлена актуальная версия ${APP_VERSION}`);
      return null;
    } catch (error) {
      console.warn('App update check failed', error);
      state.update.statusText = 'Не удалось проверить';
      state.update.cacheStatus = navigator.onLine ? 'неизвестно' : 'офлайн';
      refreshUpdatePanel();
      if (manual) toast('Не удалось проверить обновление. Попробуй с интернетом.');
      return null;
    } finally {
      state.update.checking = false;
    }
  }

  function parseVersionScript(text) {
    return text.match(/const\s+version\s*=\s*['"]([^'"]+)['"]/i)?.[1] || null;
  }

  function isNewerVersion(candidate, current) {
    const a = String(candidate).split('.').map((part) => Number(part) || 0);
    const b = String(current).split('.').map((part) => Number(part) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) > (b[i] || 0)) return true;
      if ((a[i] || 0) < (b[i] || 0)) return false;
    }
    return false;
  }

  function showAppUpdateBanner(versionLabel = 'новая') {
    let banner = document.getElementById('app-update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'app-update-banner';
      banner.className = 'app-update-banner';
      document.body.appendChild(banner);
    }
    state.update.bannerMode = 'update';
    state.update.dismissedVersion = null;
    const safeVersion = escapeHTML(versionLabel);
    banner.hidden = false;
    banner.className = 'app-update-banner';
    banner.innerHTML = `
      <div class="app-update-copy"><strong>Доступно обновление</strong><span>Версия ${safeVersion}. Баннер останется, пока ты сам не нажмёшь «Обновить» или «Позже».</span></div>
      <div class="app-update-actions"><button class="button primary" id="apply-app-update">Обновить</button><button class="button ghost" id="dismiss-app-update">Позже</button></div>
    `;
    banner.querySelector('#apply-app-update').addEventListener('click', forceRefreshAppShell);
    banner.querySelector('#dismiss-app-update').addEventListener('click', () => {
      state.update.dismissedVersion = versionLabel;
      state.update.bannerMode = null;
      banner.hidden = true;
    });
  }

  function showAppUpdateStatusBanner(title, message, tone = 'success', autoHideMs = 0) {
    let banner = document.getElementById('app-update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'app-update-banner';
      document.body.appendChild(banner);
    }
    state.update.bannerMode = 'status';
    banner.hidden = false;
    banner.className = `app-update-banner app-update-banner-${tone}`;
    banner.innerHTML = `
      <div class="app-update-copy"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></div>
      <div class="app-update-actions"><button class="button secondary" id="close-app-update-status">Понятно</button></div>
    `;
    banner.querySelector('#close-app-update-status').addEventListener('click', () => { state.update.bannerMode = null; banner.hidden = true; });
    if (autoHideMs) {
      window.setTimeout(() => {
        if (state.update.bannerMode === 'status') {
          state.update.bannerMode = null;
          banner.hidden = true;
        }
      }, autoHideMs);
    }
  }

  function hideAppUpdateBanner(force = false) {
    const banner = document.getElementById('app-update-banner');
    if (!banner) return;
    if (!force && state.update.bannerMode === 'update') return;
    state.update.bannerMode = null;
    banner.hidden = true;
  }

  function refreshUpdatePanel() {
    const status = document.getElementById('app-update-status-text');
    const cache = document.getElementById('app-cache-status-text');
    const last = document.getElementById('app-update-last-check');
    if (status) status.textContent = state.update.statusText || 'Пока не проверяли';
    if (cache) cache.textContent = state.update.cacheStatus || 'неизвестно';
    if (last) last.textContent = formatUpdateTimestamp(state.update.lastCheckAt);
  }

  function formatUpdateTimestamp(value) {
    if (!value) return 'пока нет';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'пока нет';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  async function forceRefreshAppShell() {
    if (!navigator.onLine) {
      toast('Нужен интернет, чтобы скачать свежую версию');
      return;
    }
    const confirmed = window.confirm('Обновить кэш приложения?\n\nПрофили, история, фото, боль, рекорды и черновики останутся. Будут очищены только файлы PWA и приложение перезапустится.');
    if (!confirmed) return;
    try {
      toast('Обновляю оболочку…');
      state.update.statusText = 'Обновляю кэш…';
      state.update.cacheStatus = 'очистка';
      refreshUpdatePanel();
      if (state.currentWorkout) await saveDraftWorkout();
      const registration = state.swRegistration || (navigator.serviceWorker?.getRegistration ? await navigator.serviceWorker.getRegistration() : null);
      state.update.reloadOnControllerChange = true;
      sessionStorage.setItem(APP_UPDATE_MESSAGE_KEY, JSON.stringify({
        title: 'Кэш обновлён',
        message: `Открылась свежая оболочка приложения. Текущая версия: ${APP_VERSION}.`,
        tone: 'success',
        createdAt: Date.now(),
      }));
      if (registration?.update) await registration.update().catch((error) => console.warn('SW forced update failed', error));
      if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      if (registration?.active) registration.active.postMessage({ type: 'CLEAR_APP_CACHES' });
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith('nikita-workouts-')).map((key) => caches.delete(key)));
      }
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.warn('Force app refresh failed', error);
      state.update.statusText = 'Ошибка обновления кэша';
      state.update.cacheStatus = 'ошибка';
      refreshUpdatePanel();
      toast(`Не удалось обновить: ${error.message}`);
    }
  }

  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function revokePhotoUrls(){for(const url of state.photoUrls.values())URL.revokeObjectURL(url);state.photoUrls.clear();}
  function toast(message){el.toast.textContent=message;el.toast.hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>{el.toast.hidden=true;},2600);}
  function formatBytes(bytes){if(!bytes)return'0 Б';const units=['Б','КБ','МБ','ГБ'];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),3);return`${(bytes/1024**i).toFixed(i?1:0)} ${units[i]}`;}
  function formatCompactLoad(value){if(value>=10000)return`${(value/1000).toFixed(1)}k`;return Math.round(value).toString();}
  function formatDuration(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
  function elapsedSeconds(start){return Math.max(0,Math.floor((Date.now()-new Date(start).getTime())/1000));}
  function todayISO(){return localDateISO(new Date());}
  function localDateISO(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`;}
  function formatDate(date,options){return new Intl.DateTimeFormat('ru-RU',options).format(date);}
  function formatShortDate(value){const date=value instanceof Date?value:new Date(`${value}T00:00:00`);return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(date);}
  function formatTinyDate(value){const date=value instanceof Date?value:new Date(`${value}T00:00:00`);return`${date.getDate()}.${date.getMonth()+1}`;}
  function photoCategoryLabel(value){return({front:'Спереди',side:'Сбоку',back:'Сзади'})[value]||value;}
  function startOfDay(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate());}
  function startOfWeek(date){const d=startOfDay(date);const day=(d.getDay()+6)%7;return new Date(d.getTime()-day*86400000);}
  function uid(prefix='id'){return`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function roundHalf(value){return Math.round(value*2)/2;}
  function numberOrBlank(value){return value===''?'':Number(value);}
  function numberOrNull(value){return value===''?null:Number(value);}
  function escapeHTML(value=''){return String(value).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
  function escapeAttr(value=''){return escapeHTML(value).replace(/`/g,'&#096;');}
})();
