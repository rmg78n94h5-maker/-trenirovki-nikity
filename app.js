(() => {
  'use strict';

  const DB = window.NikitaDB;
  const APP_VERSION = window.NIKITA_APP?.version || 'неизвестна';
  const APP_VERSION_STORAGE_KEY = 'nikita-workouts-app-version';
  const APP_UPDATE_MESSAGE_KEY = 'nikita-workouts-update-message';
  const PUSH_API_URL = 'https://trenirovki-push.bvj79cfn6n.workers.dev';
  const PUSH_PUBLIC_KEY = 'BLfLt7xYAExNFkVyqYu2rZ-CdBCPE8zgw0YFjPe5yMq6Hes41M8ZMuwOkQwBwFyJUD9b2dtgJNfcAC2_s3W4afQ';
  const PUSH_DEVICE_ID_KEY = 'nikita-workouts-push-device-id';
  const PUSH_TIMEZONE = 'Asia/Vladivostok';
  const PUSH_AUTOMATION_DEFAULTS = Object.freeze({
    waterEnabled: true,
    waterIntervalMinutes: 75,
    activeStartMinutes: 9 * 60,
    activeEndMinutes: 22 * 60,
    workoutEnabled: true,
    workoutTimeMinutes: 19 * 60,
    measurementsEnabled: true,
    measurementsIntervalDays: 1,
    measurementsTimeMinutes: 8 * 60,
    weeklyMeasurementsEnabled: true,
    weeklyMeasurementsWeekday: 0,
    weeklyMeasurementsTimeMinutes: 8 * 60 + 5,
    updatesEnabled: true,
  });
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
    foodEntries: [],
    savedFoods: [],
    scheduledWorkouts: [],
    foodDatabase: [],
    foodDatabaseInfo: null,
    foodDatabaseStatus: 'loading',
    nutritionDate: null,
    currentWorkout: null,
    historyFilter: 'month',
    progressTab: 'overview',
    bodyProgressMetric: null,
    bodyProgressPeriodDays: null,
    musclePeriodDays: null,
    guideCategory: 'all',
    guideQuery: '',
    smartWorkoutProposal: null,
    profileBuilder: null,
    programBuilder: null,
    timer: { seconds: 0, interval: null, nextLabel: '', lastAnnouncedSecond: null },
    photoUrls: new Map(),
    swRegistration: null,
    push: {
      supported: false,
      standalone: false,
      permission: 'default',
      subscribed: false,
      busy: false,
      statusText: 'Проверяю поддержку…',
      detailText: 'Уведомления ещё не проверялись',
      lastCheckedAt: null,
      automationText: 'Автоматические напоминания ещё не синхронизированы',
      automationSyncedAt: null,
    },
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
    topbarBack: document.getElementById('topbar-back-button'),
    profileSwitch: document.getElementById('profile-switch-button'),
    profileInitial: document.getElementById('profile-initial'),
  };

  let timerAudioContext = null;
  let timerAudioPrimed = false;
  const workoutExerciseUi = {
    expandedCompleted: new Set(),
    expandedQueued: new Set(),
    justCompletedIndex: null,
    focusedIndex: null,
    showHiddenCompleted: false,
  };

  const difficultyOptions = [
    ['easy', 'Легко'],
    ['normal', 'Нормально'],
    ['hard', 'Тяжело'],
    ['failure', 'До отказа'],
  ];

  const exerciseFeedbackOptions = [
    ['easy', 'Легко'],
    ['normal', 'Нормально'],
    ['hard', 'Тяжело'],
    ['failure', 'До отказа'],
    ['discomfort', 'Дискомфорт'],
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
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'romanian-deadlift', 'good-morning-bodyweight', 'bulgarian-split-squat', 'reverse-lunge', 'hip-thrust', 'single-leg-bridge', 'wall-sit', 'dead-bug', 'reverse-crunch', 'lying-leg-raise', 'side-plank', 'front-plank', 'russian-twist', 'ab-roller', 'ab-roller-short', 'ab-roller-diagonal', 'barbell-row', 'farmer-hold', 'suitcase-hold', 'db-shoulder-press', 'barbell-bench-press', 'incline-barbell-bench-press', 'seated-barbell-press', 'close-grip-bench-press', 'barbell-hip-thrust-bench', 'bench-step-up', 'dips-knee-raise', 'dips-leg-raise', 'cable-crunch', 'cable-woodchop'],
      keywords: ['присед', 'выпад', 'тяга', 'наклон', 'мост', 'планка', 'скруч', 'ролик', 'подъём', 'кор', 'пресс', 'ягод', 'ног'],
      reason: 'может повышать давление на паховую область и низ живота',
    },
    abs: {
      exerciseIds: ['dead-bug', 'reverse-crunch', 'lying-leg-raise', 'side-plank', 'front-plank', 'russian-twist', 'ab-roller', 'ab-roller-short', 'ab-roller-diagonal', 'dips-knee-raise', 'dips-leg-raise', 'cable-crunch', 'cable-woodchop', 'plank-pushup-handles', 'mountain-climber-handles', 'goblet-squat', 'barbell-squat', 'romanian-deadlift', 'farmer-hold', 'suitcase-hold', 'barbell-bench-press', 'incline-barbell-bench-press', 'seated-barbell-press', 'close-grip-bench-press', 'barbell-hip-thrust-bench', 'bench-step-up'],
      keywords: ['пресс', 'кор', 'скруч', 'планка', 'ролик', 'подъём ног', 'тяга', 'присед'],
      reason: 'сильно включает пресс и внутрибрюшное давление',
    },
    'lower-back': {
      exerciseIds: ['barbell-row', 'romanian-deadlift', 'good-morning-bodyweight', 'goblet-squat', 'barbell-squat', 'ab-roller', 'ab-roller-short', 'ab-roller-diagonal', 'lying-leg-raise', 'dips-leg-raise', 'mountain-climber-handles', 'barbell-hip-thrust-bench', 'bench-step-up', 'front-plank', 'bird-dog', 'suitcase-hold'],
      keywords: ['поясница', 'тяга', 'наклон', 'присед', 'ролик', 'планка', 'кор'],
      reason: 'может грузить поясницу и корпус',
    },
    knee: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'bulgarian-split-squat', 'reverse-lunge', 'wall-sit', 'stepper-easy', 'stepper-intervals', 'stepper-short', 'calf-raise', 'leg-extension-machine', 'bench-step-up'],
      keywords: ['присед', 'выпад', 'степпер', 'стульчик', 'ноги', 'икры', 'разгибание ног', 'зашаг'],
      reason: 'даёт нагрузку на колено и ноги',
    },
    shoulder: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'db-floor-press', 'machine-chest-press', 'pec-deck', 'db-fly-floor', 'db-shoulder-press', 'pike-pushups', 'lateral-raise', 'rear-delt-fly', 'face-pull-machine', 'db-pullover', 'overhead-triceps', 'close-pushups', 'ab-roller', 'ab-roller-short', 'ab-roller-diagonal', 'barbell-bench-press', 'incline-barbell-bench-press', 'db-bench-press', 'incline-db-bench-press', 'db-bench-fly', 'pushups-handles', 'dips-chest', 'dips-triceps', 'seated-barbell-press', 'arnold-press', 'front-raise', 'seated-lateral-raise', 'incline-rear-delt-fly', 'cable-upright-row', 'close-grip-bench-press', 'lying-barbell-triceps-extension', 'rope-overhead-triceps', 'plank-pushup-handles', 'mountain-climber-handles'],
      keywords: ['жим', 'отжим', 'плеч', 'развод', 'дельт', 'пуловер', 'трицепс', 'ролик', 'брусья'],
      reason: 'может раздражать плечо и жимовую зону',
    },
    elbow: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'db-floor-press', 'db-shoulder-press', 'barbell-curl', 'db-curl', 'hammer-curl', 'reverse-curl', 'overhead-triceps', 'close-pushups', 'triceps-pushdown', 'farmer-hold', 'suitcase-hold', 'barbell-bench-press', 'incline-barbell-bench-press', 'db-bench-press', 'incline-db-bench-press', 'pushups-handles', 'dips-chest', 'dips-triceps', 'seated-barbell-press', 'arnold-press', 'rope-triceps-pushdown', 'rope-overhead-triceps', 'close-grip-bench-press', 'lying-barbell-triceps-extension', 'incline-db-curl', 'cable-curl', 'concentration-curl'],
      keywords: ['сгибание', 'разгибание', 'трицепс', 'бицепс', 'жим', 'отжим', 'удержание', 'брусья'],
      reason: 'нагружает локоть и сухожилия рук',
    },
    wrist: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'pike-pushups', 'close-pushups', 'barbell-curl', 'db-curl', 'hammer-curl', 'reverse-curl', 'farmer-hold', 'suitcase-hold', 'ab-roller', 'ab-roller-short', 'ab-roller-diagonal', 'pushups-handles', 'dips-chest', 'dips-triceps', 'plank-pushup-handles', 'mountain-climber-handles', 'barbell-bench-press', 'incline-barbell-bench-press', 'db-bench-press', 'incline-db-bench-press', 'seated-barbell-press', 'arnold-press', 'close-grip-bench-press', 'lying-barbell-triceps-extension', 'incline-db-curl', 'cable-curl', 'concentration-curl'],
      keywords: ['отжим', 'сгибание', 'удержание', 'хват', 'предплеч', 'ролик', 'жим', 'брусья'],
      reason: 'может давить на кисть, запястье или хват',
    },
    chest: {
      exerciseIds: ['pushups', 'chair-incline-pushups', 'db-floor-press', 'machine-chest-press', 'pec-deck', 'db-fly-floor', 'db-pullover', 'close-pushups', 'barbell-bench-press', 'incline-barbell-bench-press', 'db-bench-press', 'incline-db-bench-press', 'db-bench-fly', 'pushups-handles', 'dips-chest', 'dips-triceps', 'close-grip-bench-press'],
      keywords: ['груд', 'жим', 'отжим', 'развод', 'бабочка', 'пуловер', 'брусья'],
      reason: 'нагружает грудь и жимовые мышцы',
    },
    'upper-back': {
      exerciseIds: ['rear-delt-fly', 'face-pull-machine', 'one-arm-row', 'barbell-row', 'lat-pulldown', 'seated-row-machine', 'shrugs', 'farmer-hold', 'chest-supported-db-row', 'lat-pulldown-wide', 'lat-pulldown-reverse', 'straight-arm-rope-pulldown', 'barbell-shrugs', 'incline-rear-delt-fly', 'cable-upright-row'],
      keywords: ['спина', 'тяга', 'дельта', 'трапеции', 'шраги', 'верхний блок', 'нижний блок'],
      reason: 'нагружает верх спины и лопатки',
    },
    neck: {
      exerciseIds: ['shrugs', 'farmer-hold', 'suitcase-hold', 'db-shoulder-press', 'pike-pushups', 'rear-delt-fly', 'face-pull-machine', 'barbell-shrugs', 'seated-barbell-press', 'arnold-press', 'front-raise', 'seated-lateral-raise', 'incline-rear-delt-fly', 'cable-upright-row'],
      keywords: ['шраги', 'трапеции', 'плеч', 'удержание', 'дельт'],
      reason: 'может усиливать напряжение шеи и трапеций',
    },
    hip: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'romanian-deadlift', 'good-morning-bodyweight', 'bulgarian-split-squat', 'reverse-lunge', 'hip-thrust', 'single-leg-bridge', 'side-plank', 'leg-extension-machine', 'barbell-hip-thrust-bench', 'bench-step-up', 'dips-knee-raise', 'dips-leg-raise', 'cable-woodchop'],
      keywords: ['таз', 'ягод', 'присед', 'выпад', 'тяга', 'мост', 'бедро', 'зашаг'],
      reason: 'нагружает таз, ягодицы и тазобедренную зону',
    },
    thigh: {
      exerciseIds: ['goblet-squat', 'chair-squat', 'barbell-squat', 'bulgarian-split-squat', 'reverse-lunge', 'wall-sit', 'romanian-deadlift', 'stepper-easy', 'stepper-intervals', 'stepper-short', 'leg-extension-machine', 'barbell-hip-thrust-bench', 'bench-step-up'],
      keywords: ['ноги', 'бедро', 'присед', 'выпад', 'степпер', 'тяга', 'разгибание ног', 'зашаг'],
      reason: 'нагружает бедро и ноги',
    },
    'shin-foot': {
      exerciseIds: ['stepper-easy', 'stepper-intervals', 'stepper-short', 'calf-raise', 'reverse-lunge', 'bulgarian-split-squat', 'bench-step-up'],
      keywords: ['степпер', 'икры', 'носки', 'выпад', 'голень', 'стопа', 'зашаг'],
      reason: 'нагружает голень, стопу и устойчивость',
    },
  };

  const muscleGroups = [
    { id: 'chest', label: 'Грудь', hint: 'жимы, отжимания, разводки' },
    { id: 'back', label: 'Спина', hint: 'тяги, широчайшие, верх спины' },
    { id: 'shoulders', label: 'Плечи', hint: 'жимы вверх, дельты, стабилизация' },
    { id: 'biceps', label: 'Бицепс', hint: 'сгибания и тяги' },
    { id: 'triceps', label: 'Трицепс', hint: 'жимы и разгибания' },
    { id: 'legs', label: 'Ноги', hint: 'приседы, выпады, квадрицепс, икры' },
    { id: 'glutes', label: 'Ягодицы', hint: 'мосты, тяги, выпады' },
    { id: 'abs', label: 'Пресс', hint: 'кор, бока, стабилизация' },
  ];

  function muscleGroupLabel(groupId) {
    return muscleGroups.find((group) => group.id === groupId)?.label || String(groupId || '');
  }

  const muscleGroupMap = {
    pushups: ['chest', 'triceps'],
    'chair-incline-pushups': ['chest', 'triceps'],
    'db-floor-press': ['chest', 'triceps'],
    'machine-chest-press': ['chest', 'triceps'],
    'pec-deck': ['chest'],
    'db-fly-floor': ['chest'],
    'db-shoulder-press': ['shoulders', 'triceps'],
    'pike-pushups': ['shoulders', 'triceps'],
    'lateral-raise': ['shoulders'],
    'rear-delt-fly': ['shoulders', 'back'],
    'face-pull-machine': ['shoulders', 'back'],
    'one-arm-row': ['back', 'biceps'],
    'barbell-row': ['back', 'biceps'],
    'lat-pulldown': ['back', 'biceps'],
    'seated-row-machine': ['back', 'biceps'],
    'db-pullover': ['back', 'chest'],
    shrugs: ['back', 'shoulders'],
    'farmer-hold': ['abs', 'back'],
    'suitcase-hold': ['abs'],
    'barbell-curl': ['biceps'],
    'db-curl': ['biceps'],
    'hammer-curl': ['biceps'],
    'reverse-curl': ['biceps'],
    'overhead-triceps': ['triceps'],
    'close-pushups': ['triceps', 'chest'],
    'triceps-pushdown': ['triceps'],
    'goblet-squat': ['legs', 'glutes'],
    'chair-squat': ['legs', 'glutes'],
    'barbell-squat': ['legs', 'glutes'],
    'romanian-deadlift': ['glutes', 'legs', 'back'],
    'good-morning-bodyweight': ['glutes', 'legs', 'back'],
    'bulgarian-split-squat': ['legs', 'glutes'],
    'reverse-lunge': ['legs', 'glutes'],
    'hip-thrust': ['glutes'],
    'single-leg-bridge': ['glutes'],
    'calf-raise': ['legs'],
    'wall-sit': ['legs', 'glutes'],
    'dead-bug': ['abs'],
    'bird-dog': ['abs', 'back'],
    'reverse-crunch': ['abs'],
    'lying-leg-raise': ['abs'],
    'side-plank': ['abs'],
    'front-plank': ['abs'],
    'russian-twist': ['abs'],
    'ab-roller': ['abs'],
    'barbell-bench-press': ['chest', 'triceps'],
    'incline-barbell-bench-press': ['chest', 'shoulders', 'triceps'],
    'db-bench-press': ['chest', 'triceps'],
    'incline-db-bench-press': ['chest', 'shoulders', 'triceps'],
    'db-bench-fly': ['chest'],
    'pushups-handles': ['chest', 'triceps'],
    'dips-chest': ['chest', 'triceps'],
    'dips-triceps': ['triceps', 'chest'],
    'chest-supported-db-row': ['back', 'biceps'],
    'lat-pulldown-wide': ['back', 'biceps'],
    'lat-pulldown-reverse': ['back', 'biceps'],
    'straight-arm-rope-pulldown': ['back', 'abs'],
    'barbell-shrugs': ['back', 'shoulders'],
    'seated-barbell-press': ['shoulders', 'triceps'],
    'arnold-press': ['shoulders', 'triceps'],
    'front-raise': ['shoulders'],
    'seated-lateral-raise': ['shoulders'],
    'incline-rear-delt-fly': ['shoulders', 'back'],
    'cable-upright-row': ['shoulders', 'back'],
    'rope-triceps-pushdown': ['triceps'],
    'rope-overhead-triceps': ['triceps'],
    'close-grip-bench-press': ['triceps', 'chest'],
    'lying-barbell-triceps-extension': ['triceps'],
    'incline-db-curl': ['biceps'],
    'cable-curl': ['biceps'],
    'concentration-curl': ['biceps'],
    'leg-extension-machine': ['legs'],
    'barbell-hip-thrust-bench': ['glutes'],
    'bench-step-up': ['legs', 'glutes'],
    'dips-knee-raise': ['abs'],
    'dips-leg-raise': ['abs'],
    'plank-pushup-handles': ['abs', 'shoulders'],
    'mountain-climber-handles': ['abs', 'shoulders'],
    'ab-roller-short': ['abs'],
    'ab-roller-diagonal': ['abs'],
    'cable-crunch': ['abs'],
    'cable-woodchop': ['abs'],
  };

  const smartWorkoutTargets = [
    { id: 'auto', label: 'Подбери сам', icon: '✨', groups: [], note: 'По нагрузке, восстановлению и истории' },
    { id: 'legs', label: 'Ноги', icon: '🦵', groups: ['legs', 'glutes'], note: 'Квадрицепс, ягодицы, икры' },
    { id: 'chest', label: 'Грудь', icon: '◫', groups: ['chest', 'triceps'], note: 'Жимы и трицепс' },
    { id: 'back', label: 'Спина', icon: '↔', groups: ['back', 'biceps'], note: 'Тяги, широчайшие, бицепс' },
    { id: 'shoulders', label: 'Плечи', icon: '△', groups: ['shoulders', 'triceps'], note: 'Дельты и жимовой пояс' },
    { id: 'arms', label: 'Руки', icon: '⚡', groups: ['biceps', 'triceps'], note: 'Бицепс и трицепс' },
    { id: 'glutes', label: 'Ягодицы', icon: '◇', groups: ['glutes', 'legs'], note: 'Задняя цепь и устойчивость' },
    { id: 'abs', label: 'Пресс', icon: '▰', groups: ['abs'], note: 'Кор, низ живота и бока' },
    { id: 'full', label: 'Всё тело', icon: '◎', groups: ['legs', 'chest', 'back', 'abs'], note: 'Сбалансированная тренировка' },
  ];

  const smartWorkoutExercisePools = {
    chest: ['db-floor-press', 'db-bench-press', 'incline-db-bench-press', 'machine-chest-press', 'pushups', 'pushups-handles', 'pec-deck', 'db-fly-floor', 'db-bench-fly', 'chair-incline-pushups', 'dips-chest'],
    back: ['lat-pulldown', 'lat-pulldown-wide', 'lat-pulldown-reverse', 'seated-row-machine', 'one-arm-row', 'chest-supported-db-row', 'barbell-row', 'rear-delt-fly', 'incline-rear-delt-fly', 'face-pull-machine', 'straight-arm-rope-pulldown', 'db-pullover', 'shrugs', 'barbell-shrugs'],
    shoulders: ['db-shoulder-press', 'arnold-press', 'lateral-raise', 'seated-lateral-raise', 'front-raise', 'rear-delt-fly', 'incline-rear-delt-fly', 'face-pull-machine', 'cable-upright-row', 'pike-pushups'],
    biceps: ['barbell-curl', 'db-curl', 'hammer-curl', 'reverse-curl', 'incline-db-curl', 'cable-curl', 'concentration-curl'],
    triceps: ['overhead-triceps', 'triceps-pushdown', 'rope-triceps-pushdown', 'rope-overhead-triceps', 'close-pushups', 'dips-triceps', 'db-floor-press'],
    legs: ['goblet-squat', 'chair-squat', 'reverse-lunge', 'bulgarian-split-squat', 'leg-extension-machine', 'bench-step-up', 'calf-raise', 'wall-sit'],
    glutes: ['romanian-deadlift', 'hip-thrust', 'barbell-hip-thrust-bench', 'single-leg-bridge', 'reverse-lunge', 'bulgarian-split-squat', 'bench-step-up', 'good-morning-bodyweight'],
    abs: ['dead-bug', 'reverse-crunch', 'side-plank', 'front-plank', 'plank-pushup-handles', 'bird-dog', 'lying-leg-raise', 'dips-knee-raise', 'suitcase-hold', 'russian-twist', 'cable-crunch', 'cable-woodchop'],
  };

  const smartPainMuscleGroups = {
    shoulder: ['shoulders', 'chest', 'triceps'],
    elbow: ['biceps', 'triceps', 'chest'],
    wrist: ['biceps', 'triceps', 'chest', 'shoulders'],
    chest: ['chest'],
    'upper-back': ['back', 'shoulders'],
    'lower-back': ['back', 'glutes', 'legs', 'abs'],
    abs: ['abs'],
    groin: ['legs', 'glutes', 'abs'],
    hip: ['glutes', 'legs'],
    thigh: ['legs', 'glutes'],
    knee: ['legs', 'glutes'],
    'shin-foot': ['legs'],
    neck: ['shoulders', 'back'],
  };


  const profileBuilderGoals = [
    { id: 'shape', label: 'Подтянуть тело', note: 'Форма, тонус и умеренная нагрузка' },
    { id: 'strength', label: 'Стать сильнее', note: 'Больше базовых движений и отдыха' },
    { id: 'muscle', label: 'Набрать мышцы', note: 'Рабочий объём и прогрессия' },
    { id: 'weight', label: 'Снизить вес', note: 'Силовая база и больше движения' },
    { id: 'maintain', label: 'Поддерживать форму', note: 'Ровная нагрузка без перегиба' },
    { id: 'return', label: 'Вернуться после перерыва', note: 'Мягкий старт и запас сил' },
  ];

  const profileBuilderLevels = [
    { id: 'beginner', label: 'Начинаю', note: 'Мало опыта или большой перерыв' },
    { id: 'regular', label: 'Тренируюсь иногда', note: 'Техника знакома, режима пока нет' },
    { id: 'experienced', label: 'Опытный', note: 'Регулярно тренируюсь и знаю веса' },
  ];

  const profileBuilderEquipment = [
    { id: 'bodyweight', label: 'Собственный вес', value: 'Собственный вес', always: true },
    { id: 'mat', label: 'Коврик', value: 'Коврик' },
    { id: 'chair', label: 'Стул', value: 'Стул' },
    { id: 'dumbbells', label: 'Разборные гантели', value: 'Разборные гантели' },
    { id: 'barbell', label: 'Разборная штанга', value: 'Разборная штанга' },
    { id: 'rack', label: 'Стойки под штангу', value: 'Две регулируемые стойки под штангу' },
    { id: 'bench', label: 'Регулируемая скамья', value: 'Регулируемая скамья' },
    { id: 'multigym', label: 'Мультитренажёр', value: 'Мультитренажёр: жим от груди, бабочка, верхний и нижний блок, разгибание ног' },
    { id: 'dips', label: 'Брусья', value: 'Брусья' },
    { id: 'roller', label: 'Ролик', value: 'Ролик для пресса' },
    { id: 'stepper', label: 'Степпер', value: 'Степпер без поручня' },
    { id: 'pushup-handles', label: 'Упоры для отжиманий', value: 'Упоры для отжиманий высотой около 10 см' },
  ];

  const profileBuilderConstraintAreas = [
    { id: 'shoulder', label: 'Плечи' },
    { id: 'elbow', label: 'Локти' },
    { id: 'wrist', label: 'Кисти / запястья' },
    { id: 'lower-back', label: 'Поясница' },
    { id: 'knee', label: 'Колени' },
    { id: 'hip', label: 'Тазобедренные' },
    { id: 'groin', label: 'Пах / низ живота' },
  ];

  const profileBuilderAdvancedExerciseIds = new Set([
    'barbell-squat', 'barbell-bench-press', 'incline-barbell-bench-press', 'seated-barbell-press',
    'close-grip-bench-press', 'dips-chest', 'dips-triceps', 'pike-pushups', 'bench-step-up',
    'dips-leg-raise', 'ab-roller', 'ab-roller-short', 'ab-roller-diagonal', 'cable-upright-row',
  ]);

  const profileBuilderCompoundIds = new Set([
    'pushups', 'chair-incline-pushups', 'db-floor-press', 'machine-chest-press', 'db-bench-press',
    'incline-db-bench-press', 'barbell-bench-press', 'incline-barbell-bench-press', 'dips-chest',
    'one-arm-row', 'barbell-row', 'lat-pulldown', 'lat-pulldown-wide', 'lat-pulldown-reverse',
    'seated-row-machine', 'chest-supported-db-row', 'db-shoulder-press', 'arnold-press',
    'seated-barbell-press', 'goblet-squat', 'chair-squat', 'barbell-squat', 'romanian-deadlift',
    'bulgarian-split-squat', 'reverse-lunge', 'hip-thrust', 'barbell-hip-thrust-bench',
  ]);


  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      await DB.openDB();
      await DB.seedIfNeeded();
      bindGlobalEvents();
      registerServiceWorker();
      updateOnlineStatus();
      await Promise.all([
        loadState(),
        loadFoodDatabase(),
      ]);
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
    const minimumVisibleMs = 850;
    const delay = force ? 0 : Math.max(0, minimumVisibleMs - (Date.now() - BOOT_STARTED_AT));
    window.setTimeout(() => {
      splash.classList.add('app-splash-exit');
      const removeSplash = () => splash.remove();
      splash.addEventListener('transitionend', removeSplash, { once: true });
      window.setTimeout(removeSplash, 520);
    }, delay);
  }

  async function loadFoodDatabase() {
    state.foodDatabaseStatus = 'loading';
    try {
      const response = await fetch('./foods-ru-v1.json', { cache: 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const database = await response.json();
      if (!Array.isArray(database?.foods) || !database.foods.length) throw new Error('Файл базы пуст');
      state.foodDatabase = database.foods;
      state.foodDatabaseInfo = {
        databaseId: database.databaseId || 'foods-ru',
        version: database.databaseVersion || database.schemaVersion || 1,
        stats: database.stats || { total: database.foods.length },
        license: database.license || null,
        usageNotes: Array.isArray(database.usageNotes) ? database.usageNotes : [],
      };
      state.foodDatabaseStatus = 'ready';
    } catch (error) {
      console.warn('Food database load failed', error);
      state.foodDatabase = [];
      state.foodDatabaseInfo = null;
      state.foodDatabaseStatus = 'error';
    }
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
      state.foodEntries = [];
      state.savedFoods = [];
      state.scheduledWorkouts = [];
      updateProfileButton();
      return;
    }

    state.activeProfileId = profiles.some((profile) => profile.id === activeProfileId) ? activeProfileId : profiles[0].id;
    if (state.activeProfileId !== activeProfileId) await DB.setActiveProfileId(state.activeProfileId);
    await loadActiveProfileData();
  }

  async function loadActiveProfileData() {
    const profileId = state.activeProfileId;
    const [profile, nutrition, settings, workouts, measurements, photos, painEntries, foodEntries, savedFoods, scheduledWorkoutsRow] = await Promise.all([
      DB.get('profile', profileId),
      DB.get('nutrition', profileId),
      DB.getSettingsObject(profileId),
      DB.getAllForProfile('workouts', profileId),
      DB.getAllForProfile('measurements', profileId),
      DB.getAllForProfile('photos', profileId),
      DB.getAllForProfile('painEntries', profileId).catch(() => []),
      DB.getAllForProfile('foodEntries', profileId).catch(() => []),
      DB.getAllForProfile('savedFoods', profileId).catch(() => []),
      DB.get('meta', scheduledWorkoutsKey(profileId)).catch(() => null),
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
    state.foodEntries = foodEntries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    state.savedFoods = savedFoods.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    state.scheduledWorkouts = normalizeScheduledWorkouts(scheduledWorkoutsRow?.value, profileId);
    state.nutritionDate = state.nutritionDate || todayISO();
    state.programBuilder = null;
    updateProfileButton();
  }

  function bindGlobalEvents() {
    el.nav.forEach((button) => button.addEventListener('click', () => navigate(button.dataset.route)));
    el.quickAdd.addEventListener('click', showQuickAdd);
    el.topbarBack?.addEventListener('click', () => navigate(state.route === 'guide' ? 'more' : 'home'));
    el.profileSwitch.addEventListener('click', () => {
      if (!state.profile) return showProfileOnboarding();
      navigate('more');
    });
    window.addEventListener('hashchange', () => navigate(routeFromHash(), false));
    window.addEventListener('online', () => {
      updateOnlineStatus();
      syncPushAutomationSettings({ silent: true }).catch((error) => console.warn('Push schedule sync after reconnect failed', error));
    });
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('scroll', scheduleWorkoutStickyOffsetSync, { passive: true });
    window.addEventListener('resize', () => {
      scheduleWorkoutStickyOffsetSync();
      scheduleBottomNavigationSync();
    });
    window.addEventListener('orientationchange', () => {
      scheduleWorkoutStickyOffsetSync();
      scheduleBottomNavigationSync();
    });
    window.visualViewport?.addEventListener('resize', scheduleBottomNavigationSync);
    window.visualViewport?.addEventListener('scroll', scheduleBottomNavigationSync);
    el.timerMinus.addEventListener('click', () => adjustTimer(-15));
    el.timerPlus.addEventListener('click', () => adjustTimer(15));
    el.timerSkip.addEventListener('click', stopRestTimer);
    document.addEventListener('pointerdown', () => {
      if (state.settings.soundEnabled) prepareTimerAudio().catch(() => {});
    }, { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flushDraftSave().catch((error) => console.warn('Workout draft save on hide failed', error));
        flushProgramBuilderDraftSave().catch((error) => console.warn('Program draft save on hide failed', error));
      }
      if (!document.hidden && state.timer.endsAt) syncTimerFromEnd();
    });
    window.addEventListener('pagehide', () => {
      flushDraftSave().catch((error) => console.warn('Workout draft save on pagehide failed', error));
      flushProgramBuilderDraftSave().catch((error) => console.warn('Program draft save on pagehide failed', error));
    });
    scheduleBottomNavigationSync();
  }

  let bottomNavigationSyncFrame = 0;

  function scheduleBottomNavigationSync() {
    if (bottomNavigationSyncFrame) cancelAnimationFrame(bottomNavigationSyncFrame);
    bottomNavigationSyncFrame = requestAnimationFrame(() => {
      bottomNavigationSyncFrame = 0;
      const root = document.documentElement;
      const nav = document.querySelector('.bottom-nav');
      if (!root || !nav) return;

      let gap = 0;
      const viewport = window.visualViewport;
      const screenHeight = Number(window.screen?.height || 0);
      const viewportHeight = Number(viewport?.height || window.innerHeight || 0);
      const viewportTop = Number(viewport?.offsetTop || 0);
      const measuredGap = screenHeight - (viewportTop + viewportHeight);
      const standalone = navigator.standalone === true
        || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
      const active = document.activeElement;
      const editing = Boolean(active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
      const keyboardLikely = editing
        || (screenHeight > 0 && viewportHeight > 0 && viewportHeight < screenHeight * 0.72);
      const maxSystemGap = Math.min(140, screenHeight * 0.18);

      // В standalone-режиме iOS иногда оставляет под visual viewport системную
      // область, которая больше env(safe-area-inset-bottom). Продлеваем в неё
      // только фон панели, а сами кнопки оставляем в верхних 66 px. При
      // клавиатуре и в обычном Safari ничего не сдвигаем.
      if (isIOSDevice()
        && standalone
        && !keyboardLikely
        && Number.isFinite(measuredGap)
        && measuredGap > 4
        && measuredGap <= maxSystemGap) {
        gap = Math.round(measuredGap * 10) / 10;
      }

      root.style.setProperty('--bottom-nav-viewport-gap', `${gap}px`);
      root.dataset.bottomNavGap = String(gap);
      nav.style.setProperty('bottom', 'calc(0px - var(--bottom-nav-viewport-gap))', 'important');
      nav.style.setProperty('height', 'calc(var(--bottom-nav-content-height) + var(--bottom-nav-viewport-gap))', 'important');
      nav.style.setProperty('min-height', 'calc(var(--bottom-nav-content-height) + var(--bottom-nav-viewport-gap))', 'important');
      nav.style.setProperty('padding', '4px 7px calc(3px + var(--bottom-nav-viewport-gap))', 'important');
      nav.style.setProperty('align-items', 'start', 'important');
    });
  }

  function routeFromHash() {
    return location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  }

  function navigate(route, updateHash = true) {
    const allowed = ['home', 'movement', 'plan', 'history', 'nutrition', 'progress', 'more', 'guide', 'workout'];
    state.route = allowed.includes(route) ? route : 'home';
    if (updateHash && location.hash !== `#/${state.route}`) history.pushState(null, '', `#/${state.route}`);
    const activeNavRoute = ['movement', 'plan', 'history'].includes(state.route) ? 'movement' : state.route;
    const secondLevel = state.route === 'more' || state.route === 'guide';
    document.body.dataset.route = state.route;
    el.nav.forEach((button) => button.classList.toggle('active', button.dataset.route === activeNavRoute));
    document.querySelector('.bottom-nav').classList.toggle('hidden', state.route === 'workout' || secondLevel);
    el.quickAdd.classList.toggle('hidden', state.route === 'workout' || secondLevel);
    el.profileSwitch.classList.toggle('hidden', state.route === 'workout');
    if (el.topbarBack) el.topbarBack.hidden = !secondLevel;
    render();
    document.querySelector('.app-shell')?.scrollTo({ top: 0, behavior: 'auto' });
    scheduleWorkoutStickyOffsetSync();
  }

  function render() {
    revokePhotoUrls();
    switch (state.route) {
      case 'home': renderHome(); break;
      case 'movement': renderMovement(); break;
      case 'plan': renderPlan(); break;
      case 'history': renderHistory(); break;
      case 'nutrition': renderNutrition(); break;
      case 'progress': renderProgress(); break;
      case 'more': renderMore(); break;
      case 'guide': renderOfflineGuide(); break;
      case 'workout': renderWorkout(); break;
      default: renderHome();
    }
  }

  function setTopbar(title, eyebrow = '') {
    el.topbarTitle.textContent = title;
    el.topbarEyebrow.textContent = eyebrow || 'Твой режим';
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


  function activeTrainingSchedule(program = getActiveProgram()) {
    const preferences = state.profile?.trainingPreferences || {};
    const mode = program?.scheduleMode || preferences.scheduleMode || state.settings.scheduleMode || 'cycle';
    const daysPerWeek = Number(program?.daysPerWeek || preferences.daysPerWeek || state.settings.daysPerWeek || 0);
    return { mode, daysPerWeek };
  }

  function localDateStart(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [year, month, day] = value.slice(0, 10).split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatScheduleDate(date) {
    return formatDate(date, { day: 'numeric', month: 'long' });
  }

  function trainingScheduleStatus(program = getActiveProgram()) {
    const schedule = activeTrainingSchedule(program);
    if (schedule.mode !== 'every_other_day') {
      return {
        mode: schedule.mode,
        due: true,
        label: schedule.daysPerWeek ? `${schedule.daysPerWeek} раз/нед.` : 'свободный цикл',
        detail: schedule.daysPerWeek ? `План: ${schedule.daysPerWeek} тренировок в неделю` : 'Тренируйся по готовности и продолжай цикл',
      };
    }
    const lastWorkout = completedWorkoutList(state.workouts)[0] || null;
    if (!lastWorkout) {
      return { mode: schedule.mode, due: true, label: 'через день', detail: 'Первая тренировка доступна сегодня' };
    }
    const lastDate = localDateStart(lastWorkout.startedAt || lastWorkout.date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 2);
    const today = localDateStart(new Date());
    const due = today.getTime() >= nextDate.getTime();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextLabel = nextDate.getTime() === today.getTime()
      ? 'сегодня'
      : nextDate.getTime() === tomorrow.getTime()
        ? 'завтра'
        : formatScheduleDate(nextDate);
    return {
      mode: schedule.mode,
      due,
      label: due ? 'сегодня тренировка' : 'сегодня отдых',
      detail: due ? 'График «через день»: можно продолжать цикл' : `Следующая по графику — ${nextLabel}`,
      nextDate,
    };
  }

  function scheduledWorkoutsKey(profileId = state.activeProfileId) {
    return `scheduledWorkouts:${profileId}`;
  }

  function scheduledWorkoutDateTime(item) {
    const dateMatch = String(item?.scheduledDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(item?.scheduledTime || '').match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return null;
    const date = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0,
    );
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function normalizeScheduledWorkouts(value, profileId = state.activeProfileId) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && item.id && item.profileId === profileId && item.customDay?.exercises?.length)
      .map((item) => ({
        ...clone(item),
        status: 'scheduled',
        scheduledDate: String(item.scheduledDate || '').slice(0, 10),
        scheduledTime: String(item.scheduledTime || '').slice(0, 5),
      }))
      .filter((item) => scheduledWorkoutDateTime(item))
      .sort((a, b) => scheduledWorkoutDateTime(a) - scheduledWorkoutDateTime(b));
  }

  async function persistScheduledWorkouts(profileId = state.activeProfileId) {
    if (!profileId) throw new Error('Не выбран профиль');
    const rows = normalizeScheduledWorkouts(state.scheduledWorkouts, profileId);
    state.scheduledWorkouts = rows;
    await DB.put('meta', {
      key: scheduledWorkoutsKey(profileId),
      value: clone(rows),
      updatedAt: new Date().toISOString(),
    });
    return rows;
  }

  function defaultScheduledWorkoutSlot() {
    const target = new Date();
    target.setHours(19, 0, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    return {
      date: localDateISO(target),
      time: `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`,
    };
  }

  function scheduledWorkoutTimeMinutes(item) {
    const [hours, minutes] = String(item?.scheduledTime || '').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return PUSH_AUTOMATION_DEFAULTS.workoutTimeMinutes;
    return Math.min(1439, Math.max(0, hours * 60 + minutes));
  }

  function nextScheduledWorkoutForReminder() {
    const graceMs = 2 * 60 * 1000;
    return state.scheduledWorkouts
      .filter((item) => {
        const date = scheduledWorkoutDateTime(item);
        return date && date.getTime() >= Date.now() - graceMs;
      })
      .sort((a, b) => scheduledWorkoutDateTime(a) - scheduledWorkoutDateTime(b))[0] || null;
  }

  async function addScheduledWorkout(customDay, scheduledDate, scheduledTime) {
    const date = String(scheduledDate || '').slice(0, 10);
    const time = String(scheduledTime || '').slice(0, 5);
    const probe = scheduledWorkoutDateTime({ scheduledDate: date, scheduledTime: time });
    if (!probe) throw new Error('Выбери дату и время');
    if (probe.getTime() <= Date.now()) throw new Error('Это время уже прошло');

    const now = new Date().toISOString();
    const item = {
      id: uid('scheduled-workout'),
      profileId: state.activeProfileId,
      status: 'scheduled',
      scheduledDate: date,
      scheduledTime: time,
      timezone: PUSH_TIMEZONE,
      customDay: clone(customDay),
      createdAt: now,
      updatedAt: now,
    };
    state.scheduledWorkouts.push(item);
    try {
      await persistScheduledWorkouts();
    } catch (error) {
      state.scheduledWorkouts = state.scheduledWorkouts.filter((row) => row.id !== item.id);
      throw error;
    }
    return item;
  }

  async function removeScheduledWorkout(id, { rerender = true, syncPush = true } = {}) {
    const previous = state.scheduledWorkouts;
    const before = previous.length;
    state.scheduledWorkouts = state.scheduledWorkouts.filter((item) => item.id !== id);
    if (state.scheduledWorkouts.length === before) return false;
    try {
      await persistScheduledWorkouts();
    } catch (error) {
      state.scheduledWorkouts = previous;
      throw error;
    }
    if (rerender && state.route === 'home') renderHome();
    if (syncPush) syncPushAutomationSettings({ silent: true }).catch((error) => console.warn('Push schedule sync after planned workout removal failed', error));
    return true;
  }

  async function startScheduledWorkout(id) {
    const item = state.scheduledWorkouts.find((row) => row.id === id);
    if (!item) {
      toast('Запланированная тренировка уже удалена');
      renderHome();
      return;
    }
    await startWorkout({
      customDay: clone(item.customDay),
      startMode: 'scheduled',
      shouldAdvanceCycle: false,
      scheduledWorkoutId: item.id,
    });
  }

  function scheduledWorkoutDateLabel(item) {
    const date = scheduledWorkoutDateTime(item);
    if (!date) return '';
    const today = localDateStart(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStart = localDateStart(date);
    if (dateStart.getTime() === today.getTime()) return 'Сегодня';
    if (dateStart.getTime() === tomorrow.getTime()) return 'Завтра';
    return formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function renderScheduledWorkouts() {
    if (!state.scheduledWorkouts.length) return '';
    const now = Date.now();
    return `
      <section class="section compact-home-section scheduled-workouts-section">
        <div class="scheduled-workouts-head">
          <div><span class="eyebrow">На очереди</span><h2>Запланированные</h2></div>
          <span class="scheduled-workouts-count">${state.scheduledWorkouts.length}</span>
        </div>
        <div class="scheduled-workouts-list">
          ${state.scheduledWorkouts.map((item) => {
            const customDay = item.customDay;
            const scheduledAt = scheduledWorkoutDateTime(item);
            const overdue = scheduledAt && scheduledAt.getTime() < now;
            return `
              <article class="scheduled-workout-card ${overdue ? 'overdue' : ''}">
                <div class="scheduled-workout-card-top">
                  <span class="scheduled-workout-time">${escapeHTML(scheduledWorkoutDateLabel(item))} · ${escapeHTML(item.scheduledTime)}</span>
                  <span class="chip ${overdue ? 'warning' : 'accent'}">${overdue ? 'ВРЕМЯ ПРОШЛО' : 'ЗАПЛАНИРОВАНО'}</span>
                </div>
                <div class="scheduled-workout-copy">
                  <strong>${escapeHTML(customDay.name || 'Своя тренировка')}</strong>
                  <small>≈ ${Number(customDay.durationMin || estimateCustomWorkoutMinutes(customDay.exercises))} мин · ${customDay.exercises.length} упражнений</small>
                </div>
                <div class="scheduled-workout-actions">
                  <button class="button primary" data-start-scheduled-workout="${escapeAttr(item.id)}" type="button">Начать запланированную</button>
                  <button class="scheduled-workout-delete" data-delete-scheduled-workout="${escapeAttr(item.id)}" type="button" aria-label="Удалить запланированную тренировку">×</button>
                </div>
              </article>`;
          }).join('')}
        </div>
      </section>`;
  }

  function bindScheduledWorkoutActions() {
    el.main.querySelectorAll('[data-start-scheduled-workout]').forEach((button) => {
      button.addEventListener('click', () => {
        startScheduledWorkout(button.dataset.startScheduledWorkout).catch((error) => {
          console.error('Scheduled workout start failed', error);
          toast(`Не удалось начать: ${error.message}`);
        });
      });
    });
    el.main.querySelectorAll('[data-delete-scheduled-workout]').forEach((button) => {
      button.addEventListener('click', async () => {
        const item = state.scheduledWorkouts.find((row) => row.id === button.dataset.deleteScheduledWorkout);
        if (!item) return;
        if (!window.confirm(`Удалить запланированную тренировку «${item.customDay?.name || 'Своя тренировка'}»?`)) return;
        try {
          await removeScheduledWorkout(item.id);
          toast('Запланированная тренировка удалена');
        } catch (error) {
          console.error('Scheduled workout removal failed', error);
          toast(`Не удалось удалить: ${error.message}`);
        }
      });
    });
  }

  const HOME_PANEL_STORAGE_KEY = 'nikita-workouts-home-panels-v1';

  function homePanelStorageId(panelId) {
    return `${state.activeProfileId || 'default'}:${panelId}`;
  }

  function readHomePanelState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HOME_PANEL_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function homePanelOpen(panelId, fallback = false) {
    const saved = readHomePanelState()[homePanelStorageId(panelId)];
    return typeof saved === 'boolean' ? saved : fallback;
  }

  function saveHomePanelOpen(panelId, open) {
    try {
      const saved = readHomePanelState();
      saved[homePanelStorageId(panelId)] = Boolean(open);
      localStorage.setItem(HOME_PANEL_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Интерфейс продолжит работать даже при недоступном localStorage.
    }
  }

  function bindHomePanelState() {
    el.main.querySelectorAll('details[data-home-panel]').forEach((details) => {
      details.addEventListener('toggle', () => saveHomePanelOpen(details.dataset.homePanel, details.open));
    });
  }

  function todayTrainerCardData() {
    const readiness = smartWorkoutReadinessSummary();
    const focusGroups = smartAutoFocusGroups(readiness);
    const rows = focusGroups.map((id) => readiness.rows.find((row) => row.id === id)).filter(Boolean);
    const title = readiness.completedWorkouts ? rows.slice(0, 2).map((row) => row.label).join(' + ') : 'Всё тело';
    const detail = readiness.completedWorkouts
      ? rows.slice(0, 2).map((row) => `${row.label}: ${row.statusLabel}, ${smartDaysSinceLabel(row.daysSince)}`).join(' · ')
      : 'Истории пока мало — начнём со спокойного сбалансированного варианта';
    const warning = rows.some((row) => ['high', 'overload'].includes(row.status) || (row.daysSince !== null && row.daysSince <= 1));
    return { readiness, focusGroups, rows, title, detail, warning };
  }

  function homeInsightData() {
    const cutoff = startOfDay(new Date(Date.now() - 29 * 86400000));
    const waist = bodyMeasurementSeries('waistCm').filter((row) => row.dateObj >= cutoff);
    if (waist.length >= 2) {
      const diff = waist[waist.length - 1].value - waist[0].value;
      if (Math.abs(diff) >= 0.1) {
        return {
          eyebrow: 'Твой фокус',
          title: diff < 0 ? 'Талия снижается' : 'Талия растёт',
          value: `${formatSignedBodyValue(diff)} см`,
          detail: diff < 0 ? 'Темп хороший — ничего резко не меняем' : 'Проверь питание и общий объём движения',
          tone: diff < 0 ? 'positive' : 'warning',
        };
      }
    }
    const rest = smartRestAnalysis({ includeTodayTraining: true });
    return {
      eyebrow: 'Твой фокус',
      title: rest.title || 'Держим спокойный темп',
      value: rest.status === 'ok' ? 'Режим в норме' : rest.statusLabel,
      detail: rest.homeText || rest.detailText || 'Больше данных появится после нескольких тренировок и замеров',
      tone: rest.status === 'ok' ? 'positive' : 'warning',
    };
  }

  function showWellbeingModal() {
    const rest = smartRestAnalysis({ includeTodayTraining: true });
    const recentPain = (state.painEntries || [])
      .filter((entry) => Date.now() - painEntryTime(entry) <= 7 * 86400000)
      .sort((a, b) => painEntryTime(b) - painEntryTime(a));
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Самочувствие</div><h2>${escapeHTML(rest.title || 'Как ты сегодня?')}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="notice ${rest.status === 'ok' ? 'success' : 'warning'}"><strong>${escapeHTML(rest.statusLabel || 'нормально')}</strong><br>${escapeHTML(rest.detailText || rest.homeText || 'Приложение учтёт отдых и недавнюю нагрузку.')}</div>
      <div class="card list-card rezhim-wellbeing-list" style="margin-top:12px">
        <button class="list-row" id="wellbeing-open-recovery" type="button"><div class="list-row-main"><div class="list-row-title">Восстановление</div><div class="list-row-sub">Нагрузка, отдых и предложение разгрузки</div></div><span>›</span></button>
        <button class="list-row" id="wellbeing-pain-history" type="button"><div class="list-row-main"><div class="list-row-title">История боли</div><div class="list-row-sub">${recentPain.length ? `${recentPain.length} отметок за 7 дней` : 'За 7 дней отметок нет'}</div></div><span>›</span></button>
        <button class="list-row" id="wellbeing-log-rest" type="button"><div class="list-row-main"><div class="list-row-title">Отметить день отдыха</div><div class="list-row-sub">Добавить восстановление в календарь</div></div><span>＋</span></button>
      </div>
    `);
    document.getElementById('wellbeing-open-recovery')?.addEventListener('click', () => {
      closeModal();
      state.progressTab = 'recovery';
      navigate('progress');
    });
    document.getElementById('wellbeing-pain-history')?.addEventListener('click', () => {
      closeModal();
      showPainHistoryModal();
    });
    document.getElementById('wellbeing-log-rest')?.addEventListener('click', () => {
      closeModal();
      recordRecoveryDay({ source: 'home' });
    });
  }

  function renderHome() {
    const { program, day, index } = getCurrentDay();
    const today = new Date();
    const draft = state.currentWorkout?.status === 'in_progress' ? state.currentWorkout : null;
    const programDraft = storedProgramBuilderDraft();
    const isProgramRestDay = Boolean(day?.restDay);
    const scheduleStatus = trainingScheduleStatus(program);
    const target = nutritionTargetForDate(todayISO());
    const nutritionTotalsToday = nutritionTotals(nutritionEntriesForDate(todayISO()));
    const caloriePercent = Math.min(100, nutritionProgress(nutritionTotalsToday.kcal, target.calories));
    const remainingCalories = Math.round(target.calories - nutritionTotalsToday.kcal);
    const insight = homeInsightData();
    const rest = smartRestAnalysis({ includeTodayTraining: true });
    const readiness = rest.status === 'critical' ? 2 : rest.status === 'recommended' ? 4 : rest.status === 'watch' ? 6 : 8;
    const legacyRestWeek = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      const iso = localDateISO(date);
      const loggedRest = state.workouts.some((workout) => (
        localDateISO(new Date(workout.startedAt || workout.date || 0)) === iso
        && (isRecoveryWorkout(workout) || (isManualDayEntry(workout) && workout.manualDay?.kind === 'rest'))
      ));
      return `<span class="rest-day ${loggedRest ? 'logged-rest' : ''}"><span>${loggedRest ? 'О' : '·'}</span></span>`;
    }).join('');

    setTopbar('Сегодня', formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }));
    el.main.innerHTML = `
      <div class="rezhim-home">
        ${draft ? `
          <section class="section">
            <article class="card rezhim-draft-card">
              <div><span class="eyebrow">Незавершённая тренировка</span><h2>${escapeHTML(draft.dayName)}</h2><p>${workoutCompletion(draft)}% выполнено · ${formatDuration(elapsedSeconds(draft.startedAt))}</p></div>
              <div class="button-row"><button class="button primary" id="resume-draft" type="button">Продолжить</button><button class="button danger" id="delete-draft-home" type="button">Удалить</button></div>
            </article>
          </section>
        ` : ''}

        ${renderScheduledWorkouts()}

        <section class="section">
          <article class="card rezhim-today-hero today-action-card program ${isProgramRestDay ? 'rest' : ''}">
            <div class="rezhim-hero-top">
              <span class="eyebrow">${isProgramRestDay ? 'План восстановления' : 'План на сегодня'}</span>
              <span class="rezhim-time-chip">День ${index + 1} из ${program.days.length}</span>
            </div>
            <h2>${escapeHTML(day?.name || 'Тренировка')}</h2>
            <span class="today-action-copy rezhim-legacy-copy" aria-hidden="true"><strong>${escapeHTML(day?.name || 'Тренировка')}</strong></span>
            <p>${isProgramRestDay
              ? `День ${index + 1} из ${program.days.length} · полный отдых по программе`
              : `${day.exercises.length} упражнений · около ${day.durationMin} минут`}</p>
            <div class="rezhim-hero-meta compact">
              <span class="${readiness >= 7 ? 'ready' : 'watch'}">Готовность ${readiness}/10</span>
            </div>
            ${draft
              ? '<button class="button primary full" id="resume-draft-program" type="button">Продолжить тренировку</button>'
              : isProgramRestDay
                ? '<button class="button primary full" id="complete-program-rest" type="button">Отметить отдых и продолжить цикл</button>'
                : '<button class="button primary full" id="start-cycle" type="button">Начать тренировку</button>'}
            <div class="rezhim-hero-links compact">
              <button id="home-workout-options" type="button">Другой вариант</button>
              <button data-go="movement" type="button">Открыть план</button>
            </div>
          </article>
        </section>

        <section class="section">
          <div class="section-head rezhim-section-head"><h2>Баланс дня</h2><button class="link-button" data-go="nutrition" type="button">Открыть питание</button></div>
          <article class="card rezhim-balance-card" data-go="nutrition">
            <div class="rezhim-calorie-ring" style="--ring-progress:${caloriePercent * 3.6}deg">
              <strong>${formatNutritionValue(nutritionTotalsToday.kcal)}</strong><span>из ${formatNutritionValue(target.calories)}</span>
            </div>
            <div class="rezhim-balance-copy">
              <span>Калории</span>
              <strong>${remainingCalories >= 0 ? `${formatNutritionValue(remainingCalories)} ккал осталось` : `Перебор ${formatNutritionValue(Math.abs(remainingCalories))} ккал`}</strong>
              <div class="rezhim-macro-row">
                <span class="protein">Б ${formatNutritionValue(nutritionTotalsToday.protein)}</span>
                <span class="fat">Ж ${formatNutritionValue(nutritionTotalsToday.fat)}</span>
                <span class="carbs">У ${formatNutritionValue(nutritionTotalsToday.carbs)}</span>
              </div>
            </div>
          </article>
        </section>

        <section class="section">
          <div class="section-head rezhim-section-head"><h2>Твой фокус</h2></div>
          <button class="card rezhim-focus-card ${insight.tone}" id="open-home-focus" type="button">
            <span class="rezhim-focus-icon">↗</span>
            <span class="rezhim-focus-copy"><strong>${escapeHTML(insight.title)}</strong><b>${escapeHTML(insight.value)}</b><small>${escapeHTML(insight.detail)}</small></span>
            <span class="rezhim-focus-arrow">›</span>
          </button>
        </section>

        <section class="section">
          <div class="section-head rezhim-section-head"><h2>Быстро добавить</h2></div>
          <div class="rezhim-quick-grid">
            <button id="home-add-food" type="button"><span class="food">＋</span><strong>Приём пищи</strong></button>
            <button id="add-measurement-home" type="button"><span class="measure">↗</span><strong>Замеры</strong></button>
            <button id="home-wellbeing" type="button"><span class="wellbeing">○</span><strong>Самочувствие</strong></button>
          </div>
        </section>

        <div class="rezhim-compat-hooks" aria-hidden="true">
          <button id="today-trainer-workout" type="button" tabindex="-1"></button>
          <button id="today-muscle-workout" type="button" tabindex="-1"></button>
          <button id="today-custom-workout" type="button" tabindex="-1"></button>
          <button id="today-program-builder" type="button" tabindex="-1"><span class="today-action-copy"><strong>${programDraft ? 'Продолжить свою программу' : 'Создать свою программу'}</strong></span></button>
          <button id="edit-past-activity-home" type="button" tabindex="-1"></button>
          <button class="nav-item" data-compat-route="plan" data-route="plan" type="button" tabindex="-1"></button>
          <button class="nav-item" data-compat-route="history" data-route="history" type="button" tabindex="-1"></button>
          <div class="legacy-rest-week">${legacyRestWeek}</div>
        </div>
      </div>
    `;

    document.getElementById('start-cycle')?.addEventListener('click', () => startWorkout({ shortMode: false, startMode: 'cycle', shouldAdvanceCycle: true }));
    document.getElementById('complete-program-rest')?.addEventListener('click', () => completeProgramRestDay(index));
    document.getElementById('home-workout-options')?.addEventListener('click', showHomeWorkoutOptionsModal);
    document.getElementById('resume-draft')?.addEventListener('click', () => navigate('workout'));
    document.getElementById('resume-draft-program')?.addEventListener('click', () => navigate('workout'));
    document.getElementById('delete-draft-home')?.addEventListener('click', discardDraftFromHome);
    document.getElementById('add-measurement-home')?.addEventListener('click', showMeasurementModal);
    document.getElementById('home-wellbeing')?.addEventListener('click', showWellbeingModal);
    document.getElementById('home-add-food')?.addEventListener('click', () => {
      state.nutritionDate = todayISO();
      navigate('nutrition');
      window.setTimeout(() => showFoodPicker(defaultNutritionMeal()), 0);
    });
    document.getElementById('open-home-focus')?.addEventListener('click', () => {
      state.progressTab = 'body';
      navigate('progress');
    });
    document.getElementById('today-trainer-workout')?.addEventListener('click', () => {
      state.smartWorkoutProposal = buildSmartWorkoutProposal({ target: 'auto', selectedGroups: [], duration: 45, intensity: 'normal', energy: 'normal' }, 0);
      showSmartWorkoutPreview();
    });
    document.getElementById('today-muscle-workout')?.addEventListener('click', () => showSmartWorkoutBuilderModal({ target: 'custom' }));
    document.getElementById('today-custom-workout')?.addEventListener('click', () => showCustomWorkoutBuilderModal());
    document.getElementById('today-program-builder')?.addEventListener('click', showNewProgramModal);
    document.getElementById('edit-past-activity-home')?.addEventListener('click', showPastActivityCalendarModal);
    el.main.querySelectorAll('[data-compat-route]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.compatRoute)));
    bindScheduledWorkoutActions();
    bindGoButtons();
  }

  function renderHomeLegacy() {
    const { program, day, index } = getCurrentDay();
    const today = new Date();
    const weekWorkouts = workoutsSince(startOfWeek(today));
    const completedThisWeek = weekWorkouts.filter((w) => w.status === 'completed').length;
    const totalMinutes = Math.round(weekWorkouts.reduce((sum, w) => sum + (w.durationSec || 0), 0) / 60);
    const lastWorkout = completedWorkoutList(state.workouts)[0];
    const latestMeasurement = state.measurements[0];
    const streak = calculateStreak();
    const draft = state.currentWorkout?.status === 'in_progress' ? state.currentWorkout : null;
    const programDraft = storedProgramBuilderDraft();
    const isProgramRestDay = Boolean(day?.restDay);
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
    const weeklyLoad = weekWorkouts.reduce((sum, workout) => sum + (workout.totalLoadKg || 0), 0);
    const weightSeries = bodyMeasurementSeries('weightKg');
    const weightLast = weightSeries[weightSeries.length - 1] || null;
    const weightPrev = weightSeries[weightSeries.length - 2] || null;
    const weightDiff = weightLast && weightPrev ? weightLast.value - weightPrev.value : null;
    const weightDiffClass = weightDiff === null || Math.abs(weightDiff) < 0.05 ? 'neutral' : weightDiff > 0 ? 'up' : 'down';
    const weightDiffText = weightDiff === null ? 'нет динамики' : `${formatSignedBodyValue(weightDiff)} кг`;
    const displayedWeight = weightLast?.value ?? latestMeasurement?.weightKg ?? state.profile.currentWeightKg;
    const restNow = smartRestAnalysis({ includeTodayTraining: true });
    const restShort = restNow.status === 'critical' ? 'стоп' : restNow.status === 'recommended' ? 'отдых' : restNow.status === 'watch' ? 'следи' : 'норма';
    const scheduleStatus = trainingScheduleStatus(program);
    const startPanelOpen = Boolean(draft) || homePanelOpen('start', false);
    const weekPanelOpen = homePanelOpen('week', false);
    const dataPanelOpen = homePanelOpen('data', false);
    const trainerCard = todayTrainerCardData();

    setTopbar(formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }), `День ${index + 1} из ${program.days.length} · ${scheduleStatus.label}`);

    el.main.innerHTML = `
      ${draft ? `
        <section class="section compact-home-section">
          <div class="card hero-card smart-start-card draft-card compact-draft-card">
            <div class="smart-start-topline"><span class="chip accent">НЕЗАВЕРШЁННАЯ</span><span class="chip">${workoutCompletion(draft)}%</span></div>
            <h2>${escapeHTML(draft.dayName)}</h2>
            <p>Черновик сохранён на телефоне · идёт ${formatDuration(elapsedSeconds(draft.startedAt))}</p>
            <div class="button-row smart-actions compact-draft-actions">
              <button class="button primary" id="resume-draft" type="button">Продолжить</button>
              <button class="button danger" id="delete-draft-home" type="button">Удалить</button>
            </div>
          </div>
        </section>
      ` : ''}

      ${renderScheduledWorkouts()}

      <section class="section today-hub-section">
        <div class="today-hub-head">
          <div><span class="eyebrow">Сегодня</span><h2>Выбери тренировку</h2></div>
          <span class="today-hub-date">${escapeHTML(formatDate(today, { day: 'numeric', month: 'short' }))}</span>
        </div>
        <div class="today-action-grid">
          <article class="today-action-card program ${isProgramRestDay ? 'rest-day' : ''}">
            <div class="today-action-top"><span class="today-action-icon">${isProgramRestDay ? '○' : '▦'}</span><span class="chip accent">${isProgramRestDay ? 'ОТДЫХ ПО ПРОГРАММЕ' : 'ПО ПРОГРАММЕ'}</span></div>
            <div class="today-action-copy"><strong>${escapeHTML(day.name)}</strong><small>${isProgramRestDay ? `Полный отдых · без тренировки · ${escapeHTML(scheduleStatus.label)}` : `≈ ${day.durationMin} мин · ${day.exercises.length} упражнений · ${escapeHTML(scheduleStatus.label)}`}</small></div>
            ${draft
              ? '<button class="button primary full" id="resume-draft-program" type="button">Продолжить черновик</button>'
              : isProgramRestDay
                ? '<button class="button primary full" id="complete-program-rest" type="button">Отметить отдых и продолжить цикл</button>'
                : `<button class="button primary full" id="start-cycle" type="button">${scheduleStatus.mode === 'every_other_day' && !scheduleStatus.due ? 'Начать досрочно' : 'Начать по программе'}</button>`}
          </article>

          <button class="today-action-card trainer" id="today-trainer-workout" type="button">
            <span class="today-action-top"><span class="today-action-icon">✨</span><span class="chip ${trainerCard.warning ? 'warning' : 'success'}">СОВЕТ ТРЕНЕРА</span></span>
            <span class="today-action-copy"><strong>${escapeHTML(trainerCard.title)}</strong><small>${escapeHTML(trainerCard.detail)}</small></span>
            <span class="today-action-footer">Посмотреть вариант <b>›</b></span>
          </button>

          <button class="today-action-card muscles" id="today-muscle-workout" type="button">
            <span class="today-action-top"><span class="today-action-icon">◎</span><span class="chip">ПО МЫШЦАМ</span></span>
            <span class="today-action-copy"><strong>Выбрать несколько групп</strong><small>20–90 минут · приложение учтёт нагрузку, отдых и боль</small></span>
            <span class="today-action-footer">Настроить подбор <b>›</b></span>
          </button>

          <button class="today-action-card custom" id="today-custom-workout" type="button">
            <span class="today-action-top"><span class="today-action-icon">＋</span><span class="chip">НА ОДИН ДЕНЬ</span></span>
            <span class="today-action-copy"><strong>Собрать тренировку на сегодня</strong><small>Начать сразу или запланировать на нужное время с напоминанием</small></span>
            <span class="today-action-footer">Открыть конструктор <b>›</b></span>
          </button>

          <button class="today-action-card program-builder ${programDraft ? 'has-draft' : ''}" id="today-program-builder" type="button">
            <span class="today-action-top"><span class="today-action-icon">▦</span><span class="chip accent">${programDraft ? 'ЧЕРНОВИК СОХРАНЁН' : 'СВОЯ ПРОГРАММА'}</span></span>
            <span class="today-action-copy"><strong>${programDraft ? 'Продолжить свою программу' : 'Создать свою программу'}</strong><small>${programDraft ? `${escapeHTML(String(programDraft.name || 'Моя программа').trim() || 'Без названия')} · шаг ${programDraft.step + 1} из ${programDraft.dayCount + 2}` : '1–7 дней · тренировки и отдых · мышцы, время, интенсивность и самочувствие'}</small></span>
            <span class="today-action-footer">${programDraft ? 'Вернуться к сохранённому месту' : 'Открыть мастер программы'} <b>›</b></span>
          </button>
        </div>

        <details class="card today-program-details" data-home-panel="start" ${startPanelOpen ? 'open' : ''}>
          <summary>
            <span class="home-disclosure-icon">▦</span>
            <span class="home-disclosure-copy"><strong>План по программе</strong><small>${escapeHTML(day.focus || program.description)} · ${day.exercises.length} упражнений</small></span>
            <span class="home-disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="home-disclosure-body">
            <div class="premium-hero-stats" aria-label="Короткая сводка">
              <div><span>Вес</span><strong>${formatBodyValue(displayedWeight)} кг</strong><small class="${weightDiffClass}">${escapeHTML(weightDiffText)}</small></div>
              <div><span>Неделя</span><strong>${completedThisWeek} трен.</strong><small>${totalMinutes} мин · ${formatCompactLoad(weeklyLoad)} кг</small></div>
              <div><span>Отдых</span><strong>${escapeHTML(restShort)}</strong><small>${escapeHTML(restNow.title || restNow.statusLabel || 'восстановление')}</small></div>
            </div>
            ${isProgramRestDay ? `
              <div class="program-rest-home-note">
                <span>○</span>
                <div><strong>Сегодня по циклу полный отдых</strong><small>Никаких упражнений добавлять не нужно. После отметки приложение перейдёт к следующему дню программы.</small></div>
              </div>
            ` : `
              <div class="exercise-list premium-exercise-preview compact-exercise-preview">
                ${day.exercises.slice(0, 6).map((entry, exerciseIndex) => renderHomeExercise(entry, exerciseIndex)).join('')}
                ${day.exercises.length > 6 ? `
                  <div id="home-extra-exercises" hidden>${day.exercises.slice(6).map((entry, exerciseIndex) => renderHomeExercise(entry, exerciseIndex + 6)).join('')}</div>
                  <button class="show-more-exercises" id="toggle-extra-exercises" type="button">Показать ещё ${day.exercises.length - 6}</button>
                ` : ''}
              </div>
            `}
            ${scheduleStatus.mode === 'every_other_day' ? `<div class="notice ${scheduleStatus.due ? 'success' : ''} schedule-status-notice"><strong>${scheduleStatus.due ? 'По графику сегодня тренировка.' : 'По графику сегодня отдых.'}</strong><br>${escapeHTML(scheduleStatus.detail)}${scheduleStatus.due ? '' : ' Начать раньше можно — приложение не блокирует тренировку.'}</div>` : ''}
            <button class="button secondary full home-workout-options" id="home-workout-options" type="button">Ещё варианты <span aria-hidden="true">›</span></button>
          </div>
        </details>
      </section>

      <section class="section compact-home-section">
        <details class="card home-disclosure" data-home-panel="week" ${weekPanelOpen ? 'open' : ''}>
          <summary>
            <span class="home-disclosure-icon">▦</span>
            <span class="home-disclosure-copy"><strong>Эта неделя</strong><small>${completedThisWeek} трен. · ${totalMinutes} мин · ${Math.round(avgCompletion(weekWorkouts))}%</small></span>
            <span class="home-disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="home-disclosure-body">
            <div class="stats-grid">
              <div class="stat"><div class="stat-value">${completedThisWeek}</div><div class="stat-label">тренировки</div></div>
              <div class="stat"><div class="stat-value">${totalMinutes}</div><div class="stat-label">минут</div></div>
              <div class="stat"><div class="stat-value">${Math.round(avgCompletion(weekWorkouts))}%</div><div class="stat-label">выполнение</div></div>
              <div class="stat"><div class="stat-value">${formatCompactLoad(weeklyLoad)}</div><div class="stat-label">нагрузка, кг</div></div>
            </div>
            <button class="button ghost small full home-panel-link" data-go="history" type="button">Открыть историю</button>
          </div>
        </details>
      </section>

      ${renderHomeMuscleLoadCard()}
      ${renderHomeDeloadCard()}
      ${renderHomeRestCard()}

      <section class="section compact-home-section">
        <details class="card home-disclosure" data-home-panel="data" ${dataPanelOpen ? 'open' : ''}>
          <summary>
            <span class="home-disclosure-icon">↗</span>
            <span class="home-disclosure-copy"><strong>Данные и история</strong><small>${formatBodyValue(displayedWeight)} кг · ${latestMeasurement ? `замер ${formatShortDate(latestMeasurement.date)}` : 'замеров пока нет'}</small></span>
            <span class="home-disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="home-disclosure-body home-data-stack">
            <div class="home-data-block">
              <div class="section-head"><h2>Текущие данные</h2><button class="link-button" id="add-measurement-home" type="button">Добавить</button></div>
              <div class="stats-grid">
                <div class="stat"><div class="stat-value">${formatBodyValue(displayedWeight)}</div><div class="stat-label">вес, кг</div></div>
                <div class="stat"><div class="stat-value">${latestMeasurement?.waistCm ?? '—'}</div><div class="stat-label">талия, см</div></div>
                <div class="stat"><div class="stat-value">${latestMeasurement?.abdomenCm ?? '—'}</div><div class="stat-label">живот, см</div></div>
                <div class="stat"><div class="stat-value">${latestMeasurement ? formatShortDate(latestMeasurement.date) : '—'}</div><div class="stat-label">последний замер</div></div>
              </div>
            </div>
            <div class="home-data-block">
              <div class="section-head"><h2>Последняя тренировка</h2></div>
              ${lastWorkout ? workoutSummaryCard(lastWorkout) : `<div class="empty compact-empty"><strong>История пока пустая</strong>После первой тренировки приложение запомнит веса и начнёт предлагать прогрессию.</div>`}
            </div>
            <div class="notice warning home-safety-note"><strong>Безопасность.</strong> Если поверхность неустойчивая, мало места или техника теряется — выбери вариант сидя, лёжа, в тренажёре или с опорой. При боли остановись.</div>
          </div>
        </details>
      </section>
    `;

    document.getElementById('start-cycle')?.addEventListener('click', () => startWorkout({ shortMode: false, startMode: 'cycle', shouldAdvanceCycle: true }));
    document.getElementById('complete-program-rest')?.addEventListener('click', () => completeProgramRestDay(index));
    document.getElementById('home-workout-options')?.addEventListener('click', showHomeWorkoutOptionsModal);
    document.getElementById('today-trainer-workout')?.addEventListener('click', () => {
      state.smartWorkoutProposal = buildSmartWorkoutProposal({ target: 'auto', selectedGroups: [], duration: 45, intensity: 'normal', energy: 'normal' }, 0);
      showSmartWorkoutPreview();
    });
    document.getElementById('today-muscle-workout')?.addEventListener('click', () => showSmartWorkoutBuilderModal({ target: 'custom' }));
    document.getElementById('today-custom-workout')?.addEventListener('click', () => showCustomWorkoutBuilderModal());
    document.getElementById('today-program-builder')?.addEventListener('click', showNewProgramModal);
    document.getElementById('resume-draft')?.addEventListener('click', () => navigate('workout'));
    document.getElementById('resume-draft-program')?.addEventListener('click', () => navigate('workout'));
    document.getElementById('delete-draft-home')?.addEventListener('click', discardDraftFromHome);
    document.getElementById('add-measurement-home')?.addEventListener('click', showMeasurementModal);
    document.getElementById('open-muscle-progress-home')?.addEventListener('click', () => { state.progressTab = 'muscles'; navigate('progress'); });
    document.getElementById('smart-workout-from-muscles')?.addEventListener('click', () => showSmartWorkoutBuilderModal({ target: 'auto' }));
    document.getElementById('open-deload-progress-home')?.addEventListener('click', () => { state.progressTab = 'recovery'; navigate('progress'); });
    document.getElementById('open-rest-progress-home')?.addEventListener('click', () => { state.progressTab = 'recovery'; navigate('progress'); });
    document.getElementById('log-rest-home')?.addEventListener('click', () => recordRecoveryDay({ source: 'home' }));
    document.getElementById('edit-past-activity-home')?.addEventListener('click', showPastActivityCalendarModal);
    document.getElementById('start-light-home')?.addEventListener('click', () => startWorkout({ shortMode: true, startMode: 'cycle', shouldAdvanceCycle: false, recoveryCheckDone: true }));

    document.getElementById('toggle-extra-exercises')?.addEventListener('click', (event) => {
      const extra = document.getElementById('home-extra-exercises');
      const opening = extra.hidden;
      extra.hidden = !opening;
      event.currentTarget.textContent = opening ? 'Скрыть дополнительные упражнения' : `Показать ещё ${day.exercises.length - 6}`;
    });

    bindHomePanelState();
    bindScheduledWorkoutActions();
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

  function showHomeWorkoutOptionsModal() {
    const lastWorkout = completedWorkoutList(state.workouts)[0];
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Другой вариант</div><h2>Как тренируемся?</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="home-options-list">
        <button class="home-option-card" id="home-option-smart" type="button"><span>✨</span><div><strong>Подобрать автоматически</strong><small>Несколько групп, 20–90 минут, история и восстановление</small></div><b>›</b></button>
        <button class="home-option-card" id="home-option-custom" type="button"><span>＋</span><div><strong>Собрать свою тренировку</strong><small>Поиск и фильтры по мышечным группам</small></div><b>›</b></button>
        <button class="home-option-card" id="home-option-repeat" type="button" ${lastWorkout ? '' : 'disabled'}><span>↻</span><div><strong>Повторить прошлую</strong><small>${lastWorkout ? escapeHTML(lastWorkout.dayName || 'Последняя тренировка') : 'История пока пустая'}</small></div><b>›</b></button>
        <button class="home-option-card" id="home-option-choose" type="button"><span>▦</span><div><strong>Выбрать из плана</strong><small>Основной цикл останется на месте</small></div><b>›</b></button>
        <button class="home-option-card" id="home-option-short" type="button"><span>⚡</span><div><strong>Нет сил · 15–20 минут</strong><small>Короткая тренировка на загруженный день</small></div><b>›</b></button>
      </div>
      <div class="notice" style="margin-top:12px"><strong>Без наказаний за перестановку.</strong><br>Повтор и выбор другого дня не сдвигают основной цикл.</div>
    `);
    document.getElementById('home-option-smart')?.addEventListener('click', () => { closeModal(); showSmartWorkoutBuilderModal(); });
    document.getElementById('home-option-custom')?.addEventListener('click', () => { closeModal(); showCustomWorkoutBuilderModal(); });
    document.getElementById('home-option-repeat')?.addEventListener('click', () => { closeModal(); repeatLastWorkout(); });
    document.getElementById('home-option-choose')?.addEventListener('click', () => { closeModal(); showChooseWorkoutModal(); });
    document.getElementById('home-option-short')?.addEventListener('click', () => { closeModal(); startWorkout({ shortMode: true, startMode: 'cycle', shouldAdvanceCycle: true }); });
  }

  async function repeatLastWorkout() {
    const lastWorkout = completedWorkoutList(state.workouts)[0];
    if (!lastWorkout) return toast('Пока нечего повторять: история тренировок пустая');
    if (lastWorkout.smartRecommendation || lastWorkout.startMode === 'smart') {
      const customDay = {
        id: uid('smart-repeat'),
        name: String(lastWorkout.dayName || 'Умная тренировка').replace(/ · повтор$/, ''),
        focus: 'Повтор умной тренировки из истории',
        durationMin: Math.max(20, Math.round(Number(lastWorkout.durationSec || 2700) / 60)),
        exercises: (lastWorkout.exercises || []).map((result) => ({ exerciseId: result.exerciseId, sets: Math.max(1, result.sets?.length || result.defaults?.sets || 1) })),
      };
      await startWorkout({ customDay, startMode: 'repeat', shouldAdvanceCycle: false, smartRecommendation: { ...(lastWorkout.smartRecommendation || {}), repeatedFromWorkoutId: lastWorkout.id } });
      return;
    }
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


  function renderSmartWorkoutSuggestionCard() {
    if (state.currentWorkout || state.settings.smartSuggestionDismissedDate === todayISO()) return '';
    const readiness = smartWorkoutReadinessSummary();
    const focusGroups = smartAutoFocusGroups(readiness);
    const rows = focusGroups.map((id) => readiness.rows.find((row) => row.id === id)).filter(Boolean);
    const title = readiness.completedWorkouts ? rows.slice(0, 2).map((row) => row.label).join(' + ') : 'Всё тело';
    const detail = readiness.completedWorkouts
      ? rows.slice(0, 2).map((row) => `${row.label}: ${row.statusLabel}, ${smartDaysSinceLabel(row.daysSince)}`).join(' · ')
      : 'Истории пока мало — начнём со спокойного сбалансированного варианта';
    const warning = rows.some((row) => ['high', 'overload'].includes(row.status) || (row.daysSince !== null && row.daysSince <= 1));
    return `<section class="section smart-home-suggestion-section compact-home-section">
      <div class="card smart-home-suggestion-card compact ${warning ? 'watch' : ''}">
        <button class="smart-home-suggestion-main" id="view-smart-home-suggestion" type="button">
          <span class="smart-home-suggestion-icon">✨</span>
          <span class="smart-home-suggestion-copy"><span class="eyebrow">Совет тренера</span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(detail)}</small></span>
          <span class="smart-home-suggestion-side"><span class="chip ${warning ? 'warning' : 'success'}">≈ 45 мин</span><b aria-hidden="true">›</b></span>
        </button>
        <button class="smart-home-suggestion-dismiss" id="dismiss-smart-home-suggestion" type="button" aria-label="Скрыть предложение до завтра">×</button>
      </div>
    </section>`;
  }

  async function dismissSmartHomeSuggestion() {
    state.settings.smartSuggestionDismissedDate = todayISO();
    await DB.setSettingsObject({ smartSuggestionDismissedDate: state.settings.smartSuggestionDismissedDate }, state.activeProfileId);
    toast('Предложение скрыто до завтра');
    renderHome();
  }


  function smartWorkoutTargetById(id) {
    return smartWorkoutTargets.find((item) => item.id === id) || smartWorkoutTargets[0];
  }

  function showSmartWorkoutBuilderModal(initial = {}) {
    if (state.currentWorkout) {
      toast('Сначала продолжи или удали сохранённый черновик');
      navigate('workout');
      return;
    }
    const initialTarget = smartWorkoutTargetById(initial.target || 'auto');
    const initialGroups = Array.isArray(initial.selectedGroups)
      ? initial.selectedGroups.filter((id) => muscleGroups.some((group) => group.id === id))
      : initial.target && initial.target !== 'auto' && initial.target !== 'custom'
        ? initialTarget.groups.filter((id) => muscleGroups.some((group) => group.id === id))
        : [];
    const config = {
      target: initialGroups.length || initial.target === 'custom' ? 'custom' : 'auto',
      selectedGroups: [...new Set(initialGroups)],
      duration: [20, 30, 45, 60, 75, 90].includes(Number(initial.duration)) ? Number(initial.duration) : 45,
      intensity: ['light', 'normal', 'dense'].includes(initial.intensity) ? initial.intensity : 'normal',
      energy: ['fresh', 'normal', 'tired'].includes(initial.energy) ? initial.energy : 'normal',
    };
    const summary = smartWorkoutReadinessSummary();
    const autoRows = summary.rows.slice().sort((a, b) => b.score - a.score).slice(0, 3);
    const autoHint = summary.completedWorkouts
      ? autoRows.map((row) => `${row.label}: ${row.statusLabel}, ${smartDaysSinceLabel(row.daysSince)}`).join(' · ')
      : 'Истории пока мало — соберём спокойную тренировку всего тела';
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Автоматический конструктор</div><h2>Что тренируем сегодня?</h2></div><button class="modal-close" data-close>×</button></div>
      <p class="muted smart-builder-intro">Можно выбрать сразу несколько мышечных групп. Приложение сверит нагрузку, восстановление, недавнюю боль и доступное оборудование.</p>
      <button class="smart-target-auto ${config.target === 'auto' ? 'active' : ''}" id="smart-target-auto" type="button"><span>✨</span><div><strong>Подбери сам</strong><small>По нагрузке, восстановлению и истории</small></div><b>✓</b></button>
      <div class="smart-builder-label smart-muscle-label"><strong>Или выбери мышцы</strong><span>можно несколько</span></div>
      <div class="smart-muscle-multi-grid" role="group" aria-label="Выбор мышечных групп">
        ${muscleGroups.map((group) => `<button class="smart-muscle-option ${config.selectedGroups.includes(group.id) ? 'active' : ''}" data-group="${group.id}" type="button"><strong>${escapeHTML(group.label)}</strong><small>${escapeHTML(group.hint)}</small><span>✓</span></button>`).join('')}
      </div>
      <div class="smart-selection-summary" id="smart-selection-summary"></div>
      <div class="smart-auto-hint"><strong>Что вижу сейчас</strong><span>${escapeHTML(autoHint)}</span></div>
      <div class="smart-builder-section">
        <div class="smart-builder-label"><strong>Сколько времени</strong><span>примерно</span></div>
        <div class="smart-option-row duration-long" data-smart-options="duration">
          ${[20, 30, 45, 60, 75, 90].map((value) => `<button class="smart-option ${value === config.duration ? 'active' : ''}" data-value="${value}" type="button">${value} мин</button>`).join('')}
        </div>
      </div>
      <div class="smart-builder-section">
        <div class="smart-builder-label"><strong>Нагрузка</strong><span>без максимальных весов</span></div>
        <div class="smart-option-row" data-smart-options="intensity">
          <button class="smart-option ${config.intensity === 'light' ? 'active' : ''}" data-value="light" type="button">Лёгкая</button>
          <button class="smart-option ${config.intensity === 'normal' ? 'active' : ''}" data-value="normal" type="button">Обычная</button>
          <button class="smart-option ${config.intensity === 'dense' ? 'active' : ''}" data-value="dense" type="button">Плотная</button>
        </div>
      </div>
      <div class="smart-builder-section">
        <div class="smart-builder-label"><strong>Самочувствие</strong><span>на сегодня</span></div>
        <div class="smart-option-row" data-smart-options="energy">
          <button class="smart-option ${config.energy === 'fresh' ? 'active' : ''}" data-value="fresh" type="button">Бодр</button>
          <button class="smart-option ${config.energy === 'normal' ? 'active' : ''}" data-value="normal" type="button">Нормально</button>
          <button class="smart-option ${config.energy === 'tired' ? 'active' : ''}" data-value="tired" type="button">Устал</button>
        </div>
      </div>
      <div class="notice smart-builder-note"><strong>Боль проверим ещё раз перед стартом.</strong><br>Свежие записи из истории уже учитываются, но приложение не ставит диагноз и не заменяет врача.</div>
      <button class="button primary full" id="build-smart-workout" type="button" style="margin-top:12px">Собрать тренировку</button>
    `);

    const refreshSelection = () => {
      const autoButton = document.getElementById('smart-target-auto');
      autoButton?.classList.toggle('active', config.target === 'auto');
      el.modalRoot.querySelectorAll('.smart-muscle-option').forEach((button) => button.classList.toggle('active', config.selectedGroups.includes(button.dataset.group)));
      const summaryNode = document.getElementById('smart-selection-summary');
      const buildButton = document.getElementById('build-smart-workout');
      if (buildButton) buildButton.disabled = config.target === 'custom' && !config.selectedGroups.length;
      if (!summaryNode) return;
      if (config.target === 'auto') {
        summaryNode.innerHTML = '<strong>Автовыбор</strong><span>Приложение само определит 1–2 подходящие группы.</span>';
      } else {
        const labels = config.selectedGroups.map((id) => muscleGroups.find((group) => group.id === id)?.label).filter(Boolean);
        summaryNode.innerHTML = `<strong>Выбрано: ${labels.length}</strong><span>${escapeHTML(labels.join(' + ') || 'Нажми на нужные мышцы')}</span>`;
      }
    };

    document.getElementById('smart-target-auto')?.addEventListener('click', () => {
      config.target = 'auto';
      config.selectedGroups = [];
      refreshSelection();
    });
    el.modalRoot.querySelectorAll('.smart-muscle-option').forEach((button) => button.addEventListener('click', () => {
      const groupId = button.dataset.group;
      config.target = 'custom';
      config.selectedGroups = config.selectedGroups.includes(groupId)
        ? config.selectedGroups.filter((id) => id !== groupId)
        : [...config.selectedGroups, groupId];
      if (!config.selectedGroups.length) config.target = 'auto';
      refreshSelection();
    }));
    el.modalRoot.querySelectorAll('[data-smart-options]').forEach((row) => {
      row.querySelectorAll('.smart-option').forEach((button) => button.addEventListener('click', () => {
        const key = row.dataset.smartOptions;
        config[key] = key === 'duration' ? Number(button.dataset.value) : button.dataset.value;
        row.querySelectorAll('.smart-option').forEach((item) => item.classList.toggle('active', item === button));
      }));
    });
    document.getElementById('build-smart-workout')?.addEventListener('click', () => {
      state.smartWorkoutProposal = buildSmartWorkoutProposal(config, 0);
      showSmartWorkoutPreview();
    });
    refreshSelection();
  }

  function latestMuscleSession(groupId) {
    for (const workout of completedWorkoutList(state.workouts)) {
      let sets = 0;
      let hard = 0;
      let total = 0;
      const sources = [];
      for (const result of workout.exercises || []) {
        if (result.skipped) continue;
        const done = completedSets(result);
        if (!done.length) continue;
        const exercise = getExercise(result.exerciseId) || { id: result.exerciseId, name: result.name, group: '' };
        if (!getMuscleGroupsForExercise(exercise, result).includes(groupId)) continue;
        sets += done.length;
        total += done.length;
        hard += done.filter((set) => ['hard', 'failure'].includes(set.difficulty)).length;
        sources.push(result.name || exercise.name || result.exerciseId);
      }
      if (!sets) continue;
      const time = new Date(workout.finishedAt || workout.startedAt || workout.date || 0).getTime();
      return {
        workoutId: workout.id,
        time: time || null,
        sets,
        hardRatio: total ? hard / total : 0,
        completionPct: Number(workout.completionPct ?? workoutCompletion(workout)),
        sources,
      };
    }
    return null;
  }

  function muscleRecoveryWindowHours(row, session, painRows = []) {
    if (!session) return 0;
    const maxPain = painRows.length ? Math.max(...painRows.map((entry) => Number(entry.score) || 0)) : 0;
    const loadHours = Math.min(30, Math.max(0, Number(session.sets || 0) - 3) * 3);
    const intensityHours = Math.round(Math.max(0, Number(session.hardRatio || 0)) * 18);
    const painHours = maxPain >= 7 ? 24 : maxPain >= 4 ? 10 : 0;
    const overloadHours = row.status === 'overload' ? 18 : row.status === 'high' ? 8 : 0;
    return Math.max(30, Math.min(96, 30 + loadHours + intensityHours + painHours + overloadHours));
  }

  function recoveryStatusForRow(row) {
    if (!row.lastSession) return { status: 'ready', label: 'готова', note: 'давно не было нагрузки' };
    if (row.painRows?.some((entry) => Number(entry.score) >= 7)) return { status: 'caution', label: 'осторожно', note: 'есть свежая сильная боль' };
    if (row.status === 'overload') return { status: 'caution', label: 'перегруз', note: 'объём за неделю уже высокий' };
    if (row.remainingHours <= 0) return { status: 'ready', label: 'готова', note: 'окно восстановления прошло' };
    if (row.remainingHours <= 12) return { status: 'soon', label: 'скоро', note: `ещё около ${Math.max(1, Math.ceil(row.remainingHours))} ч` };
    return { status: 'recovering', label: 'восстанавливается', note: `ещё около ${Math.max(1, Math.ceil(row.remainingHours))} ч` };
  }

  function smartWorkoutReadinessSummary() {
    const summary = muscleLoadSummary(7);
    const now = Date.now();
    const recentPain = (state.painEntries || []).filter((entry) => {
      const time = painEntryTime(entry);
      return time && now - time <= 7 * 86400000 && Number(entry.score) >= 4;
    });
    const rows = summary.rows.map((row) => {
      const lastSession = latestMuscleSession(row.id);
      const lastAt = lastSession?.time || null;
      const daysSince = lastAt ? Math.max(0, Math.floor((now - lastAt) / 86400000)) : null;
      const painRows = recentPain.filter((entry) => (smartPainMuscleGroups[entry.areaId] || []).includes(row.id));
      const requiredHours = muscleRecoveryWindowHours(row, lastSession, painRows);
      const elapsedHours = lastAt ? Math.max(0, (now - lastAt) / 3600000) : requiredHours;
      const remainingHours = Math.max(0, requiredHours - elapsedHours);
      const readinessPct = lastSession ? Math.max(0, Math.min(100, Math.round((elapsedHours / Math.max(requiredHours, 1)) * 100))) : 100;
      let score = row.status === 'low' ? 38 : row.status === 'normal' ? 12 : row.status === 'high' ? -18 : -42;
      score += Math.round((readinessPct - 50) * 0.75);
      if (painRows.length) score -= Math.min(46, Math.max(...painRows.map((entry) => Number(entry.score) || 0)) * 6);
      const recovery = recoveryStatusForRow({ ...row, lastSession, painRows, remainingHours });
      return {
        ...row,
        daysSince,
        lastAt,
        lastSession,
        score,
        painRows,
        requiredHours,
        elapsedHours,
        remainingHours,
        readinessPct,
        recoveryStatus: recovery.status,
        recoveryLabel: recovery.label,
        recoveryNote: recovery.note,
      };
    });
    return {
      ...summary,
      rows,
      recentPain,
      readyCount: rows.filter((row) => row.recoveryStatus === 'ready').length,
      recoveringCount: rows.filter((row) => ['recovering', 'soon'].includes(row.recoveryStatus)).length,
      cautionCount: rows.filter((row) => row.recoveryStatus === 'caution').length,
    };
  }

  function smartLastMuscleTrainingAt(groupId) {
    return latestMuscleSession(groupId)?.time || null;
  }

  function smartDaysSinceLabel(days) {
    if (days === null || days === undefined) return 'давно не было';
    if (days === 0) return 'нагружалась сегодня';
    if (days === 1) return 'нагружалась вчера';
    return `${days} дн. назад`;
  }

  function smartAutoFocusGroups(readiness) {
    if (!readiness.completedWorkouts) return ['legs', 'chest', 'back', 'abs'];
    const ordered = readiness.rows.slice().sort((a, b) => b.score - a.score);
    const primary = ordered.find((row) => row.status !== 'overload' && row.daysSince !== 0) || ordered[0];
    const compatibility = {
      chest: ['triceps', 'shoulders', 'abs'], back: ['biceps', 'shoulders', 'abs'], shoulders: ['triceps', 'back', 'abs'],
      biceps: ['back', 'triceps', 'abs'], triceps: ['chest', 'biceps', 'abs'], legs: ['glutes', 'abs'], glutes: ['legs', 'abs'], abs: ['back', 'chest', 'legs', 'glutes'],
    };
    const secondary = ordered.find((row) => row.id !== primary.id && (compatibility[primary.id] || []).includes(row.id) && row.score > -30);
    return [primary.id, secondary?.id].filter(Boolean);
  }

  function buildSmartWorkoutProposal(rawConfig, variant = 0) {
    const config = { ...rawConfig };
    config.selectedGroups = Array.isArray(rawConfig.selectedGroups)
      ? [...new Set(rawConfig.selectedGroups.filter((id) => muscleGroups.some((group) => group.id === id)))]
      : [];
    if (config.selectedGroups.length) config.target = 'custom';
    if (config.energy === 'tired') config.intensity = 'light';
    const readiness = smartWorkoutReadinessSummary();
    const selectedLabels = config.selectedGroups.map((id) => muscleGroups.find((group) => group.id === id)?.label).filter(Boolean);
    const target = config.target === 'custom'
      ? { id: 'custom', label: selectedLabels.join(' + ') || 'Выбранные мышцы', groups: config.selectedGroups }
      : smartWorkoutTargetById(config.target);
    let focusGroups = target.id === 'auto' ? smartAutoFocusGroups(readiness) : [...target.groups];
    if (!focusGroups.length) focusGroups = smartAutoFocusGroups(readiness);
    if (target.id === 'legs' || target.id === 'glutes') {
      focusGroups = focusGroups.slice().sort((a, b) => (readiness.rows.find((row) => row.id === b)?.score || 0) - (readiness.rows.find((row) => row.id === a)?.score || 0));
    }
    const workCount = config.duration <= 20 ? 3 : config.duration <= 30 ? 4 : config.duration <= 45 ? 5 : config.duration <= 60 ? 6 : config.duration <= 75 ? 7 : 8;
    const selectedIds = selectSmartExercises(focusGroups, workCount, config, readiness, variant);
    const exercises = [{ exerciseId: 'warmup-joints', durationMin: config.duration <= 20 ? 4 : config.duration >= 75 ? 8 : config.duration >= 60 ? 7 : 5 }];
    for (const exerciseId of selectedIds) {
      const exercise = getExercise(exerciseId);
      if (!exercise) continue;
      exercises.push(smartExerciseEntry(exercise, config, readiness, focusGroups));
    }
    const onlyAbs = focusGroups.length === 1 && focusGroups[0] === 'abs';
    if (config.duration >= 45 && !onlyAbs && !exercises.some((entry) => getMuscleGroupsForExercise(getExercise(entry.exerciseId), entry).includes('abs'))) {
      const coreId = smartSafeCandidates(['abs'], config, readiness, variant + 17, exercises.map((entry) => entry.exerciseId))[0]?.id;
      if (coreId) exercises.push(smartExerciseEntry(getExercise(coreId), { ...config, intensity: config.intensity === 'dense' ? 'normal' : 'light' }, readiness, ['abs']));
    }
    if (config.duration >= 60 && smartExerciseAvailable(getExercise('stepper-short')) && !exercises.some((entry) => entry.exerciseId.startsWith('stepper-'))) {
      exercises.push({ exerciseId: 'stepper-short', durationMin: config.duration >= 90 ? 12 : config.duration >= 75 ? 10 : config.intensity === 'light' ? 6 : 8 });
    }

    const focusRows = focusGroups.map((id) => readiness.rows.find((row) => row.id === id)).filter(Boolean);
    const labels = focusRows.map((row) => row.label);
    const title = target.id === 'auto'
      ? (!readiness.completedWorkouts ? 'Умная: всё тело' : `Умная: ${labels.slice(0, 2).join(' + ')}`)
      : target.id === 'custom'
        ? `Своя: ${labels.slice(0, 3).join(' + ')}`
        : `Умная: ${target.label}${labels.length > 1 && !['full', 'arms', 'abs'].includes(target.id) ? ` + ${labels[1].toLowerCase()}` : ''}`;
    const reasons = [];
    if (target.id === 'auto') {
      reasons.push(!readiness.completedWorkouts ? 'Истории пока мало, поэтому выбран спокойный сбалансированный вариант.' : 'Направление выбрано по недобору нагрузки и времени после последней тренировки.');
    } else if (target.id === 'custom') {
      reasons.push(`Учтены выбранные группы: ${labels.join(', ').toLowerCase()}.`);
    } else {
      reasons.push(`Учтён твой запрос: ${target.label.toLowerCase()}.`);
    }
    for (const row of focusRows.slice(0, 4)) reasons.push(`${row.label}: ${row.sets} раб. подходов за 7 дней · ${row.statusLabel} · ${smartDaysSinceLabel(row.daysSince)}.`);
    const warnings = [];
    for (const row of focusRows) {
      if (row.status === 'overload') warnings.push(`${row.label}: за 7 дней уже перегруз — объём автоматически снижен.`);
      else if (row.status === 'high') warnings.push(`${row.label}: нагрузки уже много — без добавления лишних подходов.`);
      if (row.daysSince !== null && row.daysSince <= 1) warnings.push(`${row.label} тренировалась недавно — держим запас и не идём до отказа.`);
      if (row.painRows.length) warnings.push(`${row.label}: есть свежая отметка боли, рискованные упражнения убраны из первого варианта.`);
    }
    if (config.energy === 'tired') warnings.push('Ты отметил усталость — тренировка автоматически переведена в лёгкий режим.');
    const canStart = exercises.length >= 4;
    if (!canStart) warnings.unshift('Безопасных и доступных упражнений для этого запроса недостаточно. Выбери другие группы или проверь список оборудования.');
    const cleanWarnings = [...new Set(warnings)];
    const smartRecommendation = {
      version: 2,
      targetId: target.id,
      targetLabel: target.label,
      focusGroups,
      selectedGroups: config.selectedGroups,
      durationMin: config.duration,
      intensity: config.intensity,
      energy: config.energy,
      reasons,
      warnings: cleanWarnings,
      variant,
      generatedAt: new Date().toISOString(),
    };
    return {
      config,
      variant,
      canStart,
      readiness,
      reasons,
      warnings: cleanWarnings,
      day: {
        id: uid('smart-day'),
        name: title,
        focus: reasons[0],
        durationMin: config.duration,
        exercises,
        smartRecommendation,
      },
    };
  }

  function selectSmartExercises(focusGroups, count, config, readiness, variant) {
    const chosen = [];
    if (config.target === 'full') {
      const order = ['legs', 'chest', 'back', 'abs', 'glutes', 'shoulders'];
      for (const groupId of order) {
        if (chosen.length >= count) break;
        const next = smartSafeCandidates([groupId], config, readiness, variant + chosen.length * 3, chosen)[0];
        if (next) chosen.push(next.id);
      }
    } else {
      let turn = 0;
      while (chosen.length < count && turn < count * 5) {
        const groupId = focusGroups[turn % Math.max(focusGroups.length, 1)] || 'abs';
        const next = smartSafeCandidates([groupId], config, readiness, variant + turn, chosen)[0];
        if (next) chosen.push(next.id);
        turn += 1;
      }
    }
    const allFocus = smartSafeCandidates(focusGroups, config, readiness, variant + 29, chosen);
    for (const candidate of allFocus) {
      if (chosen.length >= count) break;
      if (!chosen.includes(candidate.id)) chosen.push(candidate.id);
    }
    return chosen.slice(0, count);
  }

  function smartSafeCandidates(groupIds, config, readiness, variant = 0, excludedIds = []) {
    const ids = [...new Set(groupIds.flatMap((id) => smartWorkoutExercisePools[id] || []))];
    const excluded = new Set(excludedIds);
    return ids.map((id) => getExercise(id)).filter(Boolean).filter((exercise) => !excluded.has(exercise.id) && smartExerciseAvailable(exercise)).map((exercise) => {
      const muscleIds = getMuscleGroupsForExercise(exercise);
      const focusScore = groupIds.reduce((score, id, index) => score + (muscleIds.includes(id) ? (index === 0 ? 34 : 20) : 0), 0);
      const lastDays = smartLastExerciseUseDays(exercise.id);
      const freshness = lastDays === null ? 14 : lastDays >= 7 ? 11 : lastDays >= 3 ? 6 : lastDays <= 1 ? -12 : 0;
      const risk = smartExerciseRecentPainRisk(exercise);
      const deterministic = smartStringScore(`${exercise.id}:${variant}`) % 11;
      const loadBoost = muscleIds.reduce((sum, id) => sum + ((readiness.rows.find((row) => row.id === id)?.score || 0) / 8), 0);
      return { ...exercise, score: focusScore + freshness + deterministic + loadBoost - risk.penalty, recentPainRisk: risk };
    }).filter((exercise) => !exercise.recentPainRisk.blocked).sort((a, b) => b.score - a.score);
  }

  function smartExerciseAvailable(exercise) {
    if (!exercise || ['ab-roller', 'ab-roller-short', 'ab-roller-diagonal'].includes(exercise.id)) return false;
    const equipment = String(exercise.equipment || '').toLowerCase();
    const available = String(state.profile?.equipment || '').toLowerCase();
    if (equipment.includes('мультитренаж') && !/мультитренаж|тренаж/.test(available)) return false;
    if (equipment.includes('степпер') && !available.includes('степпер')) return false;
    const needsBarbell = equipment.includes('штанг');
    const needsDumbbell = equipment.includes('гантел');
    if (needsBarbell && needsDumbbell && equipment.includes('или')) return available.includes('штанг') || available.includes('гантел');
    if (needsBarbell && !available.includes('штанг')) return false;
    if (needsDumbbell && !available.includes('гантел')) return false;
    return true;
  }

  function smartLastExerciseUseDays(exerciseId) {
    const now = Date.now();
    for (const workout of completedWorkoutList(state.workouts)) {
      const used = (workout.exercises || []).some((result) => result.exerciseId === exerciseId && !result.skipped && completedSets(result).length);
      if (used) {
        const time = new Date(workout.startedAt || workout.date || 0).getTime();
        return time ? Math.max(0, Math.floor((now - time) / 86400000)) : null;
      }
    }
    return null;
  }

  function smartExerciseRecentPainRisk(exercise) {
    const now = Date.now();
    let penalty = 0;
    let blocked = false;
    const labels = [];
    for (const entry of state.painEntries || []) {
      const time = painEntryTime(entry);
      if (!time || now - time > 7 * 86400000 || Number(entry.score) < 4) continue;
      const risk = analyzeExercisePainRisk({ hasPain: true, areaId: entry.areaId, score: entry.score, comment: entry.comment }, exercise);
      if (!risk) continue;
      labels.push(`${entry.areaLabel || getPainArea(entry.areaId).label} ${entry.score}/10`);
      penalty += risk.level === 'high' ? 55 : risk.level === 'moderate' ? 26 : 8;
      if (risk.level === 'high' && Number(entry.score) >= 7) blocked = true;
    }
    return { penalty, blocked, labels };
  }

  function smartExerciseEntry(exercise, config, readiness, focusGroups) {
    const groups = getMuscleGroupsForExercise(exercise);
    const loaded = groups.map((id) => readiness.rows.find((row) => row.id === id)).filter(Boolean);
    const hasHighLoad = loaded.some((row) => ['high', 'overload'].includes(row.status) || (row.daysSince !== null && row.daysSince <= 1));
    let sets = Number(exercise.defaults?.sets || 1);
    const cap = config.energy === 'tired' || config.intensity === 'light' ? 2 : config.intensity === 'dense' ? 4 : 3;
    sets = Math.max(1, Math.min(sets, cap));
    if (hasHighLoad) sets = Math.min(sets, 2);
    const entry = { exerciseId: exercise.id, sets };
    if (exercise.defaults?.unit === 'minutes') entry.durationMin = Math.min(Number(exercise.defaults.durationMin || 10), config.duration <= 30 ? 8 : 12);
    if (exercise.defaults?.unit === 'seconds' && config.intensity === 'light') entry.durationSec = Math.max(20, Math.round(Number(exercise.defaults.durationSec || 30) * 0.8));
    if (config.intensity === 'light' && exercise.defaults?.unit === 'reps') {
      entry.repsMin = Math.max(5, Number(exercise.defaults.repsMin || 8) - 2);
      entry.repsMax = Math.max(entry.repsMin, Number(exercise.defaults.repsMax || entry.repsMin + 2) - 2);
    }
    return entry;
  }

  function smartStringScore(value) {
    let score = 0;
    for (let i = 0; i < value.length; i += 1) score = ((score << 5) - score + value.charCodeAt(i)) | 0;
    return Math.abs(score);
  }

  function smartIntensityLabel(value) {
    return ({ light: 'лёгкая', normal: 'обычная', dense: 'плотная' })[value] || 'обычная';
  }

  function showSmartWorkoutPreview() {
    const proposal = state.smartWorkoutProposal;
    if (!proposal?.day) return showSmartWorkoutBuilderModal();
    const recommendation = proposal.day.smartRecommendation;
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Предложение приложения</div><h2>${escapeHTML(proposal.day.name)}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="smart-preview-hero">
        <div class="hero-meta">
          <span class="chip accent">≈ ${proposal.config.duration} мин</span>
          <span class="chip">${proposal.day.exercises.length} упражнений</span>
          <span class="chip">${escapeHTML(smartIntensityLabel(proposal.config.intensity))}</span>
        </div>
        <p>${escapeHTML(proposal.reasons[0])}</p>
      </div>
      <div class="smart-reason-list">
        ${proposal.reasons.slice(1).map((reason) => `<div><span>✓</span><p>${escapeHTML(reason)}</p></div>`).join('')}
      </div>
      ${proposal.warnings.length ? `<div class="notice warning smart-preview-warning"><strong>Что учтено</strong><br>${proposal.warnings.map(escapeHTML).join('<br>')}</div>` : '<div class="notice success"><strong>Явных ограничений не найдено.</strong><br>Всё равно оцени самочувствие перед первым рабочим подходом.</div>'}
      <div class="section-head smart-preview-head"><h2>План тренировки</h2><span class="muted">можно менять</span></div>
      <div class="smart-preview-list">
        ${proposal.day.exercises.map((entry, index) => renderSmartPreviewExercise(entry, index)).join('')}
      </div>
      <div class="smart-preview-actions">
        <button class="button primary full" id="start-smart-workout" type="button" ${proposal.canStart ? '' : 'disabled'}>${proposal.canStart ? 'Начать эту тренировку' : 'Недостаточно безопасных упражнений'}</button>
        <div class="button-row">
          <button class="button secondary" id="another-smart-workout" type="button">Другой вариант</button>
          <button class="button ghost" id="edit-smart-settings" type="button">Настроить заново</button>
        </div>
      </div>
      <div class="help center" style="margin-top:10px">Умный подбор не двигает основной цикл и ничего не меняет без твоего согласия.</div>
    `);
    el.modalRoot.querySelectorAll('.smart-replace-exercise').forEach((button) => button.addEventListener('click', () => showSmartReplacementModal(Number(button.dataset.index))));
    el.modalRoot.querySelectorAll('.smart-remove-exercise').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      if (proposal.day.exercises.length <= 4) return toast('Оставим хотя бы разминку и три упражнения');
      proposal.day.exercises.splice(index, 1);
      showSmartWorkoutPreview();
    }));
    document.getElementById('another-smart-workout')?.addEventListener('click', () => {
      state.smartWorkoutProposal = buildSmartWorkoutProposal(proposal.config, proposal.variant + 1);
      showSmartWorkoutPreview();
    });
    document.getElementById('edit-smart-settings')?.addEventListener('click', () => showSmartWorkoutBuilderModal(proposal.config));
    document.getElementById('start-smart-workout')?.addEventListener('click', async () => {
      const day = clone(proposal.day);
      closeModal();
      await startWorkout({ customDay: day, startMode: 'smart', shouldAdvanceCycle: false, smartRecommendation: recommendation });
    });
  }

  function renderSmartPreviewExercise(entry, index) {
    const exercise = getExercise(entry.exerciseId);
    const isWarmup = entry.exerciseId === 'warmup-joints';
    return `<div class="smart-preview-exercise">
      <span class="exercise-index">${index + 1}</span>
      <div class="smart-preview-copy"><strong>${escapeHTML(exercise?.name || entry.exerciseId)}</strong><small>${escapeHTML(workPrescription(exercise, entry))}${exercise?.equipment ? ` · ${escapeHTML(exercise.equipment)}` : ''}</small></div>
      ${isWarmup ? '<span class="chip">разминка</span>' : `<div class="smart-preview-row-actions"><button class="mini-button smart-replace-exercise" data-index="${index}" type="button" aria-label="Заменить упражнение">↻</button><button class="mini-button smart-remove-exercise" data-index="${index}" type="button" aria-label="Убрать упражнение">×</button></div>`}
    </div>`;
  }

  function showSmartReplacementModal(index) {
    const proposal = state.smartWorkoutProposal;
    const current = proposal?.day?.exercises?.[index];
    const currentExercise = getExercise(current?.exerciseId);
    if (!current || !currentExercise) return showSmartWorkoutPreview();
    const groups = getMuscleGroupsForExercise(currentExercise, current);
    const excluded = proposal.day.exercises.map((entry) => entry.exerciseId);
    const options = smartSafeCandidates(groups.length ? groups : proposal.day.smartRecommendation.focusGroups, proposal.config, proposal.readiness, proposal.variant + index + 41, excluded).slice(0, 8);
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Замена упражнения</div><h2>${escapeHTML(currentExercise.name)}</h2></div><button class="modal-close" id="close-smart-replacement" type="button">×</button></div>
      <p class="muted">Показываю доступные варианты на те же мышцы. Свежие отметки боли и оборудование уже учтены.</p>
      <div class="card list-card smart-replacement-list" style="margin-top:12px">
        ${options.length ? options.map((exercise) => `<button class="list-row choose-smart-replacement" data-id="${escapeAttr(exercise.id)}" type="button"><div class="list-row-main"><div class="list-row-title">${escapeHTML(exercise.name)}</div><div class="list-row-sub">${escapeHTML(exercise.group)} · ${escapeHTML(exercise.equipment)}</div></div><span class="muted">›</span></button>`).join('') : '<div class="empty compact-empty"><strong>Безопасной замены не нашлось</strong>Вернись назад и оставь упражнение или убери его из плана.</div>'}
      </div>
      <button class="button ghost full" id="back-smart-preview" type="button" style="margin-top:12px">Назад к плану</button>
    `);
    document.getElementById('close-smart-replacement')?.addEventListener('click', showSmartWorkoutPreview);
    document.getElementById('back-smart-preview')?.addEventListener('click', showSmartWorkoutPreview);
    el.modalRoot.querySelectorAll('.choose-smart-replacement').forEach((button) => button.addEventListener('click', () => {
      const replacement = getExercise(button.dataset.id);
      proposal.day.exercises[index] = smartExerciseEntry(replacement, proposal.config, proposal.readiness, groups);
      showSmartWorkoutPreview();
    }));
  }


  function shouldShowSmartRestGate({ shortMode = false, day = null } = {}) {
    if (shortMode || day?.recovery) return false;
    const analysis = smartRestAnalysis({ includeTodayTraining: true });
    return analysis.gateWorkout;
  }

  function showSmartRestModal(startConfig = {}) {
    const analysis = smartRestAnalysis({ includeTodayTraining: true });
    const primaryRest = analysis.status === 'critical' || analysis.shouldRest;
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Умный отдых</div><h2>${escapeHTML(analysis.modalTitle)}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="card smart-rest-card ${analysis.status}">
        <p>${escapeHTML(analysis.modalText)}</p>
        <div class="rest-week-strip">${analysis.days.slice(0, 7).reverse().map((day) => `<div class="rest-day ${day.kind} ${day.loggedRest ? 'logged-rest' : ''}"><span>${escapeHTML(day.shortLabel)}</span><strong>${escapeHTML(day.shortDate)}</strong></div>`).join('')}</div>
        ${analysis.signals.length ? `<div class="card list-card smart-rest-signal-list" style="margin-top:12px">${analysis.signals.slice(0, 4).map((signal) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHTML(signal.title)}</div><div class="list-row-sub">${escapeHTML(signal.label)}</div></div></div>`).join('')}</div>` : ''}
      </div>
      <div class="button-row smart-rest-modal-actions" style="margin-top:14px">
        <button class="button ${primaryRest ? 'primary' : 'secondary'}" id="confirm-rest-day" type="button">День восстановления</button>
        <button class="button secondary" id="confirm-light-workout" type="button">Лёгкая 15–20 мин</button>
        <button class="button ghost" id="ignore-rest-advice" type="button">Продолжить всё равно</button>
      </div>
      <div class="help" style="margin-top:10px">Это не блокировка. Просто приложение видит календарь, нагрузку и отдых, чтобы не советовать ерунду.</div>
    `);
    document.getElementById('confirm-rest-day').addEventListener('click', async () => {
      closeModal();
      await recordRecoveryDay({ source: 'smart_rest_modal', analysis });
    });
    document.getElementById('confirm-light-workout').addEventListener('click', async () => {
      closeModal();
      await startWorkout({ ...startConfig, shortMode: true, shouldAdvanceCycle: false, recoveryCheckDone: true });
    });
    document.getElementById('ignore-rest-advice').addEventListener('click', async () => {
      closeModal();
      await startWorkout({ ...startConfig, recoveryCheckDone: true });
    });
  }

  async function recordRecoveryDay({ source = 'manual', analysis = null } = {}) {
    const date = todayISO();
    if (hasRecoveryDayForDate(date)) {
      toast('День восстановления уже записан');
      return;
    }
    const todayKind = activityKindForDate(date);
    if (todayKind === 'training' || todayKind === 'light') {
      toast('Сегодня уже есть тренировка или лёгкая активность');
      return;
    }
    const snapshot = smartRestSnapshot(analysis || smartRestAnalysis({ includeTodayTraining: false }));
    const now = new Date().toISOString();
    const workout = {
      id: uid('recovery'),
      profileId: state.activeProfileId,
      type: 'recovery_day',
      date,
      startedAt: now,
      finishedAt: now,
      programId: state.settings.activeProgramId || null,
      programName: getActiveProgram()?.name || '',
      dayId: 'recovery-day',
      dayIndex: null,
      dayName: 'День восстановления',
      shortMode: false,
      startMode: 'recovery',
      shouldAdvanceCycle: false,
      status: 'completed',
      durationSec: 0,
      completionPct: 100,
      totalLoadKg: 0,
      recoveryDay: {
        source,
        reason: snapshot.statusLabel,
        text: snapshot.homeText,
        signals: snapshot.signals,
        createdAt: now,
      },
      exercises: [],
      comment: 'День отдыха / восстановления. Силовая нагрузка не выполнялась.',
    };
    await DB.put('workouts', workout);
    state.workouts.unshift(workout);
    toast('День восстановления записан');
    if (state.route === 'home') renderHome();
    else if (state.route === 'progress') renderProgress();
    else if (state.route === 'history') renderHistory();
  }

  let programRestSavePending = false;

  async function completeProgramRestDay(index) {
    if (programRestSavePending) return;
    const program = getActiveProgram();
    const day = program?.days?.[index];
    if (!day?.restDay) return;
    const date = todayISO();
    const existingManual = manualDayEntryForDate(date);
    const realTraining = state.workouts.some((workout) => (
      workout?.status === 'completed'
      && !isManualDayEntry(workout)
      && localDateISO(new Date(workout.startedAt || workout.date)) === date
      && isTrainingWorkout(workout)
    ));
    if (realTraining || (existingManual && existingManual.manualDay?.kind !== 'rest')) {
      toast('Сегодня уже отмечена тренировка или активность — полный отдых записать нельзя');
      return;
    }

    programRestSavePending = true;
    try {
      const now = new Date().toISOString();
      const entry = {
        id: existingManual?.id || uid('manual-day'),
        profileId: state.activeProfileId,
        type: 'manual_day',
        date,
        startedAt: existingManual?.startedAt || now,
        finishedAt: now,
        status: 'completed',
        durationSec: 0,
        completionPct: 100,
        totalLoadKg: 0,
        programId: program.id,
        programName: program.name,
        dayId: day.id,
        dayIndex: index,
        dayName: day.name,
        shortMode: false,
        startMode: 'program_rest',
        shouldAdvanceCycle: true,
        manualDay: {
          kind: 'rest',
          source: 'program_rest',
          updatedAt: now,
        },
        exercises: [],
        comment: `Полный отдых по программе «${program.name}».`,
      };
      await DB.put('workouts', entry);
      state.workouts = state.workouts.filter((workout) => workout.id !== entry.id);
      state.workouts.push(entry);
      state.workouts.sort((a, b) => new Date(b.startedAt || b.date) - new Date(a.startedAt || a.date));

      const nextIndex = (index + 1) % Math.max(program.days.length, 1);
      state.settings.currentDayIndex = nextIndex;
      await DB.setSettingsObject({ currentDayIndex: nextIndex }, state.activeProfileId);
      if (state.route === 'plan') renderPlan();
      else if (state.route === 'movement') renderMovement();
      else renderHome();
      toast(`Отдых отмечен · дальше день ${nextIndex + 1}`);
    } catch (error) {
      console.error('Program rest save failed', error);
      toast('Не удалось сохранить день отдыха');
    } finally {
      programRestSavePending = false;
    }
  }


  function isManualDayEntry(workout) {
    return workout?.type === 'manual_day' && Boolean(workout?.manualDay?.kind);
  }

  function manualDayEntryForDate(date) {
    return state.workouts.find((workout) => workout?.status === 'completed' && isManualDayEntry(workout) && localDateISO(new Date(workout.startedAt || workout.date)) === date) || null;
  }

  function manualDayKindMeta(kind) {
    return {
      training: { label: 'Тренировка', short: 'Т', icon: '🏋️', className: 'training' },
      light: { label: 'Лёгкая активность', short: 'Л', icon: '🚶', className: 'light' },
      recovery: { label: 'Восстановление', short: 'В', icon: '◷', className: 'recovery' },
      rest: { label: 'Полный отдых', short: 'О', icon: '○', className: 'rest' },
    }[kind] || { label: 'Полный отдых', short: 'О', icon: '○', className: 'rest' };
  }

  function showPastActivityCalendarModal() {
    const today = startOfDay(new Date());
    const todayValue = localDateISO(today);
    const days = Array.from({ length: 42 }, (_, index) => {
      const dateObj = new Date(today.getTime() - index * 86400000);
      const date = localDateISO(dateObj);
      const kind = activityKindForDate(date);
      const loggedRest = manualDayEntryForDate(date)?.manualDay?.kind === 'rest';
      const baseMeta = manualDayKindMeta(kind);
      const meta = kind === 'rest' && !loggedRest
        ? { ...baseMeta, short: '·', label: 'Не отмечено' }
        : baseMeta;
      return { date, dateObj, kind, meta, loggedRest };
    });
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Журнал активности</div><h2>Изменить прошлые дни</h2></div><button class="modal-close" data-close>×</button></div>
      <p class="muted">Выбери дату и укажи, что было на самом деле. Рекомендации и умный отдых пересчитаются сразу.</p>
      <div class="past-activity-jump">
        <div class="field"><label>Нужная дата</label><input id="past-activity-date-input" type="date" value="${todayValue}" max="${todayValue}"></div>
        <button class="button secondary" id="open-past-activity-date" type="button">Открыть дату</button>
      </div>
      <div class="help" style="margin-top:8px">Можно выбрать любую прошедшую дату. Ниже — последние 42 дня для быстрого доступа.</div>
      <div class="past-activity-calendar">
        ${days.map((day) => `<button class="past-activity-date ${day.meta.className} ${day.loggedRest ? 'logged-rest' : ''}" data-date="${day.date}" type="button"><span>${escapeHTML(day.meta.short)}</span><strong>${escapeHTML(formatTinyDate(day.date))}</strong><small>${escapeHTML(day.meta.label)}</small></button>`).join('')}
      </div>
    `);
    el.modalRoot.querySelectorAll('.past-activity-date').forEach((button) => button.addEventListener('click', () => showEditActivityDayModal(button.dataset.date)));
    document.getElementById('open-past-activity-date')?.addEventListener('click', () => {
      const selectedDate = document.getElementById('past-activity-date-input')?.value;
      if (!selectedDate) return toast('Выбери дату');
      if (selectedDate > todayValue) return toast('Будущий день пока нельзя заполнять');
      showEditActivityDayModal(selectedDate);
    });
  }

  function showEditActivityDayModal(date) {
    const existingManual = manualDayEntryForDate(date);
    const currentKind = existingManual?.manualDay?.kind || activityKindForDate(date);
    const realRows = state.workouts.filter((workout) => workout?.status === 'completed' && !isManualDayEntry(workout) && localDateISO(new Date(workout.startedAt || workout.date)) === date);
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">${escapeHTML(formatDate(new Date(`${date}T12:00:00`), { day:'numeric', month:'long', year:'numeric' }))}</div><h2>Что было в этот день?</h2></div><button class="modal-close" data-close>×</button></div>
      ${realRows.length ? '<div class="notice warning">На эту дату уже есть сохранённая запись тренировки. Ручная отметка изменит календарный статус, но не удалит саму тренировку.</div>' : ''}
      <div class="activity-kind-grid" style="margin-top:12px">
        ${['training','light','recovery','rest'].map((kind) => { const meta = manualDayKindMeta(kind); return `<button class="activity-kind-option ${kind === currentKind ? 'active' : ''}" data-kind="${kind}" type="button"><b>${meta.icon}</b><strong>${escapeHTML(meta.label)}</strong><span>${kind === 'training' ? 'Силовая или полноценная тренировка' : kind === 'light' ? 'Прогулка, степпер, короткая активность' : kind === 'recovery' ? 'Осознанный день восстановления' : 'Никакой тренировочной активности'}</span></button>`; }).join('')}
      </div>
      <div class="field" style="margin-top:14px"><label>Комментарий, необязательно</label><textarea id="manual-day-comment" placeholder="Например: много ходил, но силовой тренировки не было">${escapeHTML(existingManual?.comment || '')}</textarea></div>
      <button class="button primary full" id="save-manual-day" style="margin-top:14px">Сохранить день</button>
      ${existingManual ? '<button class="button danger full" id="delete-manual-day" style="margin-top:10px">Убрать ручную отметку</button>' : ''}
    `);
    let selectedKind = currentKind;
    el.modalRoot.querySelectorAll('.activity-kind-option').forEach((button) => button.addEventListener('click', () => {
      selectedKind = button.dataset.kind;
      el.modalRoot.querySelectorAll('.activity-kind-option').forEach((item) => item.classList.toggle('active', item === button));
    }));
    document.getElementById('save-manual-day').addEventListener('click', async () => {
      const now = new Date().toISOString();
      const startedAt = `${date}T12:00:00`;
      const meta = manualDayKindMeta(selectedKind);
      const entry = {
        id: existingManual?.id || uid('manual-day'), profileId: state.activeProfileId, type: 'manual_day', date,
        startedAt, finishedAt: startedAt, status: 'completed', durationSec: 0, completionPct: 100, totalLoadKg: 0,
        programId: state.settings.activeProgramId || null, dayId: 'manual-day', dayIndex: null,
        dayName: meta.label, shortMode: selectedKind === 'light', startMode: 'manual_history', shouldAdvanceCycle: false,
        manualDay: { kind: selectedKind, updatedAt: now }, exercises: [], comment: document.getElementById('manual-day-comment').value.trim(),
      };
      await DB.put('workouts', entry);
      state.workouts = state.workouts.filter((row) => row.id !== entry.id);
      state.workouts.push(entry);
      state.workouts.sort((a,b) => new Date(b.startedAt || b.date) - new Date(a.startedAt || a.date));
      closeModal();
      if (state.route === 'home') renderHome(); else if (state.route === 'progress') renderProgress(); else if (state.route === 'history') renderHistory();
      toast(`${meta.label} сохранён${selectedKind === 'rest' ? '' : 'а'} за ${formatTinyDate(date)}`);
    });
    document.getElementById('delete-manual-day')?.addEventListener('click', async () => {
      await DB.remove('workouts', existingManual.id);
      state.workouts = state.workouts.filter((row) => row.id !== existingManual.id);
      closeModal();
      if (state.route === 'home') renderHome(); else if (state.route === 'progress') renderProgress(); else if (state.route === 'history') renderHistory();
      toast('Ручная отметка удалена');
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

  function renderPainEntry(entry, options = {}) {
    const meta = painLevelMeta(entry.score);
    const source = entry.source === 'exercise' ? `во время: ${entry.exerciseName || 'упражнение'}` : entry.source === 'risk_action' ? 'действие по предупреждению' : 'перед тренировкой';
    const deleteButton = options.withDelete ? `<button class="mini-button delete-pain-entry" data-id="${escapeAttr(entry.id)}" type="button" aria-label="Удалить запись боли">×</button>` : '';
    return `<div class="list-row pain-history-row">
      <div class="pain-dot ${meta.level}">!</div>
      <div class="list-row-main">
        <div class="list-row-title">${escapeHTML(entry.areaLabel || getPainArea(entry.areaId).label)} · ${entry.score}/10</div>
        <div class="list-row-sub">${formatShortDate(entry.date || todayISO())} · ${escapeHTML(source)}${entry.comment ? `<br>${escapeHTML(entry.comment)}` : ''}</div>
      </div>
      ${deleteButton}
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
        <div class="field"><label>Комментарий</label><textarea id="pre-pain-comment" placeholder="Например: плечо ноет после прошлой тренировки"></textarea></div>
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
    const customDay = config.customDay ? clone(config.customDay) : null;
    const day = customDay || program.days[index];
    const startMode = config.startMode || (customDay ? 'smart' : index === fallbackIndex ? 'cycle' : 'selected');
    const shouldAdvanceCycle = config.shouldAdvanceCycle ?? (startMode === 'cycle');
    if (!customDay && day?.restDay) {
      await completeProgramRestDay(index);
      return;
    }
    const selected = shortMode
      ? (day.short || day.exercises.slice(0, 5).map((x) => x.exerciseId)).map((id) => day.exercises.find((x) => x.exerciseId === id) || { exerciseId: id })
      : day.exercises;

    if (!selected.length) {
      toast('В этом дне пока нет упражнений. Открой План и добавь их через ✎');
      navigate('plan');
      return;
    }

    if (!config.recoveryCheckDone && shouldShowSmartRestGate({ shortMode, day })) {
      showSmartRestModal({ ...config, shortMode, dayIndex: index, startMode, shouldAdvanceCycle, recoveryCheckDone: true });
      return;
    }

    if (!config.painCheckDone) {
      showPreWorkoutPainModal({ ...config, shortMode, dayIndex: index, startMode, shouldAdvanceCycle, recoveryCheckDone: true });
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
        previousSets: completedSets(last).map((set) => ({
          weightKg: set.weightKg ?? '',
          reps: set.reps ?? '',
          durationSec: set.durationSec ?? null,
          durationMin: set.durationMin ?? null,
          difficulty: set.difficulty || 'normal',
        })),
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

    const suffix = shortMode
      ? 'короткая'
      : startMode === 'repeat'
        ? 'повтор'
        : startMode === 'selected'
          ? 'выбрана вручную'
          : startMode === 'scheduled'
            ? 'запланирована'
            : '';
    workoutExerciseUi.focusedIndex = 0;
    workoutExerciseUi.expandedQueued.clear();
    workoutExerciseUi.expandedCompleted.clear();
    workoutExerciseUi.showHiddenCompleted = false;
    state.currentWorkout = {
      id: uid('workout'),
      profileId: state.activeProfileId,
      date: todayISO(),
      startedAt: new Date().toISOString(),
      programId: customDay ? (startMode === 'scheduled' ? 'scheduled-custom' : 'smart-builder') : program.id,
      programName: customDay ? (startMode === 'scheduled' ? 'Запланированная тренировка' : 'Умный конструктор') : program.name,
      dayId: day.id,
      dayIndex: index,
      cycleDayIndex: fallbackIndex,
      dayName: suffix ? `${day.name} · ${suffix}` : day.name,
      shortMode,
      startMode,
      shouldAdvanceCycle,
      scheduledWorkoutId: config.scheduledWorkoutId || null,
      smartRecommendation: config.smartRecommendation || day.smartRecommendation || null,
      status: 'in_progress',
      preWorkoutPain,
      painCheckedAt: new Date().toISOString(),
      exercises: exerciseResults,
      comment: '',
    };
    const deload = deloadAnalysis({ days: 14 });
    if (deload.shouldSuggest) state.currentWorkout.deload = deloadSnapshot(deload);
    const smartRest = smartRestAnalysis({ includeTodayTraining: true });
    if (smartRest.status !== 'ok') state.currentWorkout.smartRest = smartRestSnapshot(smartRest);
    if (preWorkoutPain.hasPain) {
      await savePainEntry({ ...preWorkoutPain, source: 'pre_workout', workoutId: state.currentWorkout.id });
    }
    await saveDraftWorkout();
    if (config.scheduledWorkoutId) {
      try {
        await removeScheduledWorkout(config.scheduledWorkoutId, { rerender: false, syncPush: false });
      } catch (error) {
        console.warn('Could not remove started workout from schedule', error);
      }
    }
    navigate('workout');
    syncPushAutomationSettings({ silent: true }).catch((error) => console.warn('Push schedule sync after planned workout start failed', error));
  }

  function workoutFocusEnabled() {
    return state.settings.workoutFocusMode !== false;
  }

  function workoutCompletedBehavior() {
    return ['collapse', 'hide', 'keep'].includes(state.settings.workoutCompletedBehavior)
      ? state.settings.workoutCompletedBehavior
      : 'collapse';
  }

  function workoutFocusedExerciseIndex(workout = state.currentWorkout) {
    if (!workout?.exercises?.length) return -1;
    const incomplete = workout.exercises
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => !result.skipped && !workoutExerciseCompleted(result))
      .map(({ index }) => index);
    if (!incomplete.length) return -1;
    if (Number.isInteger(workoutExerciseUi.focusedIndex) && incomplete.includes(workoutExerciseUi.focusedIndex)) {
      return workoutExerciseUi.focusedIndex;
    }
    workoutExerciseUi.focusedIndex = incomplete[0];
    return incomplete[0];
  }

  function workoutEstimatedRemainingMinutes(workout = state.currentWorkout) {
    if (!workout) return 0;
    let seconds = 0;
    workout.exercises.forEach((result) => {
      if (result.skipped || workoutExerciseCompleted(result)) return;
      const remainingSets = result.sets.filter((set) => !set.completed).length;
      seconds += remainingSets * 42;
      seconds += Math.max(0, remainingSets - 1) * Number(result.defaults.restSec || 0);
    });
    return Math.max(1, Math.round(seconds / 60));
  }

  function workoutCompletedExerciseCount(workout = state.currentWorkout) {
    return (workout?.exercises || []).filter((result) => workoutExerciseCompleted(result)).length;
  }

  function renderWorkoutFocusSummary(workout, focusIndex) {
    const total = workout.exercises.length;
    const completed = workoutCompletedExerciseCount(workout);
    const pct = workoutCompletion(workout);
    const remaining = workoutEstimatedRemainingMinutes(workout);
    const currentOrdinal = focusIndex >= 0 ? focusIndex + 1 : total;
    const focusResult = focusIndex >= 0 ? workout.exercises[focusIndex] : null;
    const focusExercise = focusResult ? getExercise(focusResult.exerciseId) : null;
    const activeSetIndex = focusResult ? workoutActiveSetIndex(focusResult) : -1;
    const totalSets = focusResult?.sets?.length || 0;
    const currentSetLabel = focusResult
      ? activeSetIndex >= 0
        ? `Подход ${activeSetIndex + 1} из ${totalSets}`
        : totalSets
          ? 'Все подходы готовы'
          : 'Подходов нет'
      : 'Тренировка завершена';
    const meta = [focusExercise?.group || '', focusExercise?.equipment || ''].filter(Boolean).join(' · ');
    const title = focusResult ? focusResult.name : 'Тренировка завершена';
    return `
      <div class="workout-focus-summary ${pct >= 100 ? 'complete' : ''}" id="workout-live-banner" role="group" aria-label="Время тренировки 00:00, выполнено ${pct} процентов">
        <div class="workout-focus-hero">
          <div class="workout-focus-copy">
            <span class="workout-focus-kicker">${focusResult ? `Сейчас · упражнение ${currentOrdinal} из ${total}` : 'Финиш'}</span>
            <h2 id="workout-focus-title">${escapeHTML(title)}</h2>
            <div class="workout-focus-sub">
              <span>${escapeHTML(currentSetLabel)}</span>
              ${meta ? `<span>${escapeHTML(meta)}</span>` : ''}
            </div>
          </div>
          <div class="workout-progress-ring" id="workout-progress-ring" style="--workout-progress:${pct * 3.6}deg"><strong id="workout-progress-ring-text">${pct}%</strong><span>${completed}/${total}</span></div>
        </div>
        <div class="workout-focus-stats compact">
          <div class="workout-focus-stat"><span>Время</span><strong class="workout-clock" id="workout-clock">00:00</strong></div>
          <div class="workout-focus-stat accent"><span>Готово</span><strong id="workout-progress-text">${pct}%</strong></div>
          <div class="workout-focus-stat"><span>Осталось</span><strong id="workout-remaining-time">≈ ${remaining} мин</strong></div>
          <strong id="workout-progress-count" class="workout-progress-count-hidden">Упражнение ${currentOrdinal} из ${total}</strong>
        </div>
        <div class="progress-bar sport-workout-progress" aria-hidden="true"><span id="workout-progress-bar" style="width:${pct}%"></span></div>
      </div>
    `;
  }

  function renderHiddenCompletedBar(workout) {
    if (workoutCompletedBehavior() !== 'hide') return '';
    const completed = workoutCompletedExerciseCount(workout);
    if (!completed) return '';
    return `<button class="completed-stack-bar" id="toggle-hidden-completed" type="button"><span>✓ Выполнено ${completed}</span><strong>${workoutExerciseUi.showHiddenCompleted ? 'Скрыть' : 'Показать'}</strong></button>`;
  }

  function renderWorkoutDock(workout, focusIndex) {
    const focusResult = focusIndex >= 0 ? workout.exercises[focusIndex] : null;
    const setIndex = focusResult ? workoutActiveSetIndex(focusResult) : -1;
    const activeSet = focusResult && setIndex >= 0 ? focusResult.sets[setIndex] : null;
    const canComplete = Boolean(focusResult && activeSet);
    const primary = canComplete ? `Подход ${setIndex + 1} готов` : 'Все подходы готовы';
    let setControls = '';
    if (activeSet && focusResult.defaults.unit === 'reps') {
      setControls = `
        <div class="workout-dock-set-controls" aria-label="Вес и повторы текущего подхода">
          <label class="workout-dock-set-card">
            <span class="workout-dock-set-label">Вес, кг</span>
            <span class="workout-dock-stepper">
              <button class="workout-dock-adjust" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="weightKg" data-delta="-0.5" aria-label="Уменьшить вес">−</button>
              <input class="workout-dock-input" type="number" inputmode="decimal" min="0" step="0.5" value="${escapeHTML(String(activeSet.weightKg ?? ''))}" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="weightKg" aria-label="Вес текущего подхода">
              <button class="workout-dock-adjust" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="weightKg" data-delta="0.5" aria-label="Увеличить вес">＋</button>
            </span>
          </label>
          <label class="workout-dock-set-card">
            <span class="workout-dock-set-label">Повторы</span>
            <span class="workout-dock-stepper">
              <button class="workout-dock-adjust" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="reps" data-delta="-1" aria-label="Уменьшить повторы">−</button>
              <input class="workout-dock-input" type="number" inputmode="numeric" min="0" step="1" value="${escapeHTML(String(activeSet.reps ?? ''))}" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="reps" aria-label="Повторы текущего подхода">
              <button class="workout-dock-adjust" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="reps" data-delta="1" aria-label="Увеличить повторы">＋</button>
            </span>
          </label>
        </div>`;
    } else if (activeSet) {
      const durationField = focusResult.defaults.unit === 'minutes' ? 'durationMin' : 'durationSec';
      const durationLabel = focusResult.defaults.unit === 'minutes' ? 'Минуты' : 'Секунды';
      const durationValue = activeSet[durationField] ?? '';
      setControls = `
        <div class="workout-dock-set-controls single" aria-label="Длительность текущего подхода">
          <label class="workout-dock-set-card">
            <span class="workout-dock-set-label">${durationLabel}</span>
            <span class="workout-dock-stepper">
              <button class="workout-dock-adjust" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="${durationField}" data-delta="-1" aria-label="Уменьшить длительность">−</button>
              <input class="workout-dock-input" type="number" inputmode="numeric" min="1" step="1" value="${escapeHTML(String(durationValue))}" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="${durationField}" aria-label="Длительность текущего подхода">
              <button class="workout-dock-adjust" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" data-field="${durationField}" data-delta="1" aria-label="Увеличить длительность">＋</button>
            </span>
          </label>
        </div>`;
    }
    return `
      <div class="workout-control-dock" role="group" aria-label="Управление тренировкой${focusResult ? `: ${escapeAttr(focusResult.name)}` : ''}">
        ${setControls}
        <div class="workout-control-main">
          <button class="workout-nav-button" id="workout-dock-prev" type="button" aria-label="Предыдущее упражнение">←</button>
          <button class="button primary workout-dock-complete" id="workout-dock-complete" type="button" data-exercise="${focusIndex}" data-set="${setIndex}" ${canComplete ? '' : 'disabled'}>${escapeHTML(primary)} ✓</button>
          <button class="workout-nav-button" id="workout-dock-next" type="button" aria-label="Следующее упражнение">→</button>
        </div>
        <div class="workout-control-secondary four">
          <button class="button ghost small" id="cancel-workout" type="button">Закрыть</button>
          <button class="button secondary small" id="workout-dock-add-set" type="button" data-index="${focusIndex}" ${focusResult ? '' : 'disabled'}>＋ Подход</button>
          <button class="button secondary small" id="quick-add-workout-exercise" type="button">＋ Упр.</button>
          <button class="button ghost small" id="finish-workout" type="button">Финиш</button>
        </div>
      </div>
    `;
  }

  function renderWorkout() {
    const workout = state.currentWorkout;
    if (!workout) {
      navigate('home');
      return;
    }
    const focusIndex = workoutFocusedExerciseIndex(workout);
    const behavior = workoutCompletedBehavior();
    setTopbar(workout.dayName, workout.shortMode ? 'Короткая тренировка' : workoutFocusEnabled() ? 'Режим фокуса' : 'Тренировка идёт');
    const exerciseHtml = workout.exercises.map((result, exerciseIndex) => {
      const completed = workoutExerciseCompleted(result);
      const hideCompleted = behavior === 'hide' && completed && !workoutExerciseUi.showHiddenCompleted && workoutExerciseUi.justCompletedIndex !== exerciseIndex;
      return hideCompleted ? '' : renderWorkoutExercise(result, exerciseIndex, focusIndex);
    }).join('');
    el.main.innerHTML = `
      <div class="workout-screen sport-workout-screen ${workoutFocusEnabled() ? 'focus-mode' : ''}">
      <div class="workout-header sport-workout-header">
        ${renderWorkoutFocusSummary(workout, focusIndex)}
      </div>

      ${renderHiddenCompletedBar(workout)}
      ${renderWorkoutPainBanner(workout)}
      ${renderWorkoutDeloadBanner(workout)}
      ${exerciseHtml}

      <button class="button secondary full workout-quick-add-large" id="quick-add-workout-exercise-large" type="button">＋ Быстро добавить упражнение</button>
      <button class="button ghost full sport-iron-workout-button" id="open-iron-calculator-workout" type="button">⚖️ Калькулятор железа</button>

      <section class="card workout-comment-card">
        <div class="field"><label>Комментарий ко всей тренировке</label><textarea id="workout-comment" placeholder="Самочувствие, техника, что изменить…">${escapeHTML(workout.comment || '')}</textarea></div>
      </section>

      ${renderWorkoutDock(workout, focusIndex)}
      </div>
    `;
    bindWorkoutEvents();
    updateWorkoutClock();
    state.workoutClockInterval && clearInterval(state.workoutClockInterval);
    state.workoutClockInterval = setInterval(updateWorkoutClock, 1000);
    updateWorkoutProgress();
    scheduleWorkoutStickyOffsetSync();
  }

  function renderQueuedWorkoutExercise(result, exerciseIndex) {
    const remaining = result.sets.filter((set) => !set.completed).length;
    const previous = state.settings.workoutShowPrevious !== false && result.previous ? ` · прошлый: ${result.previous}` : '';
    return `
      <article class="queued-workout-exercise ${painRiskClass(result.painRisk)}" data-exercise-index="${exerciseIndex}">
        <button class="queued-exercise-summary focus-workout-exercise" type="button" data-index="${exerciseIndex}">
          <span class="queued-exercise-number">${exerciseIndex + 1}</span>
          <span class="queued-exercise-copy"><strong>${escapeHTML(result.name)}</strong><small>${remaining} подхода впереди${escapeHTML(previous)}</small></span>
          <span class="queued-exercise-arrow">›</span>
        </button>
      </article>
    `;
  }

  function renderWorkoutExercise(result, exerciseIndex, focusIndex = workoutFocusedExerciseIndex()) {
    const exercise = getExercise(result.exerciseId);
    const activeSetIndex = workoutActiveSetIndex(result);
    const completedCount = result.sets.filter((set) => set.completed).length;
    const totalSets = result.sets.length;
    const activeLabel = activeSetIndex >= 0 ? `Подход ${activeSetIndex + 1} из ${totalSets}` : totalSets ? 'Все подходы выполнены' : 'Подходов нет';
    const showPrevious = state.settings.workoutShowPrevious !== false;
    const previous = showPrevious && result.previous ? `<span class="chip">Прошлый: ${escapeHTML(result.previous)}</span>` : showPrevious ? `<span class="chip">Первое выполнение</span>` : '';
    const prefilled = showPrevious && result.prefilledFromLast ? `<span class="chip success">Подставлено из прошлого раза</span>` : '';
    const suggestion = result.suggestion?.text ? `<span class="chip ${result.suggestion.kind === 'increase' ? 'success' : result.suggestion.kind === 'reduce' ? 'warning' : ''}">${escapeHTML(result.suggestion.text)}</span>` : '';
    const completed = workoutExerciseCompleted(result);
    const uiKey = workoutExerciseUiKey(exerciseIndex);
    const justCompleted = completed && workoutExerciseUi.justCompletedIndex === exerciseIndex;
    const behavior = workoutCompletedBehavior();
    const expanded = completed && (behavior === 'keep' || workoutExerciseUi.expandedCompleted.has(uiKey));
    const collapsed = completed && behavior !== 'keep' && !expanded && !justCompleted;
    const queued = workoutFocusEnabled() && !completed && exerciseIndex !== focusIndex && !workoutExerciseUi.expandedQueued.has(uiKey);
    if (queued) return renderQueuedWorkoutExercise(result, exerciseIndex);
    const completedClass = completed ? ` exercise-complete${collapsed ? ' is-collapsed' : ''}${justCompleted ? ' just-completed' : ''}` : '';
    const focusClass = exerciseIndex === focusIndex ? ' is-focused' : ' is-preview-open';
    const feedback = renderExerciseQuickFeedback(result, exerciseIndex);
    const smartTip = workoutSmartTip(result, exerciseIndex);
    return `
      <article class="workout-exercise sport-workout-exercise ${result.skipped ? 'muted' : ''} ${painRiskClass(result.painRisk)}${completedClass}${focusClass}" data-exercise-index="${exerciseIndex}">
        ${completed ? `
          <button class="completed-exercise-summary toggle-completed-exercise" type="button" data-index="${exerciseIndex}" aria-expanded="${collapsed ? 'false' : 'true'}" aria-label="${collapsed ? 'Развернуть' : 'Свернуть'} завершённое упражнение ${escapeAttr(result.name)}">
            <span class="completed-exercise-check" aria-hidden="true">✓</span>
            <span class="completed-exercise-copy">
              <strong>${escapeHTML(result.name)}</strong>
              <small>${escapeHTML(workoutExerciseCompactSummary(result))}${result.feedback ? ` · ${escapeHTML(exerciseFeedbackLabel(result.feedback))}` : ''}</small>
            </span>
            <span class="completed-exercise-chevron" aria-hidden="true">⌄</span>
          </button>
        ` : ''}
        <div class="completed-exercise-body">
          <div class="workout-exercise-head sport-workout-exercise-head">
            <div class="sport-exercise-kicker"><span>${exerciseIndex + 1} · ${escapeHTML(exercise?.group || '')}</span><strong>${escapeHTML(activeLabel)}</strong></div>
            <h3>${escapeHTML(result.name)}</h3>
            <div class="exercise-meta">${escapeHTML(exercise?.equipment || '')} · отдых ${result.defaults.restSec || 0} сек</div>
            <div class="sport-set-trail" aria-label="Прогресс подходов">
              ${renderWorkoutSetTrail(result, activeSetIndex)}
            </div>
            <div class="sport-exercise-progress"><span>Подходы</span><strong>${completedCount}/${totalSets}</strong></div>
            <div class="hero-meta">${previous}${prefilled}${suggestion}</div>
            ${smartTip ? `<div class="workout-smart-tip">✨ ${escapeHTML(smartTip)}</div>` : ''}
            ${renderPainRiskNotice(result.painRisk, exerciseIndex)}
            ${exercise?.safety ? `<div class="notice warning" style="margin-top:10px">${escapeHTML(exercise.safety)}</div>` : ''}
            <details class="exercise-guide sport-exercise-guide">
              <summary><span>ⓘ Техника и подсказки</span><span class="exercise-chevron" aria-hidden="true">⌄</span></summary>
              ${renderGuideBody(result.exerciseId)}
            </details>
            <div class="exercise-tools sport-exercise-tools">
              <button class="button secondary small replace-exercise" data-index="${exerciseIndex}" type="button">Заменить</button>
              <button class="button ghost small skip-exercise" data-index="${exerciseIndex}" type="button">${result.skipped ? 'Вернуть' : 'Пропустить'}</button>
              <button class="button ghost small comment-exercise" data-index="${exerciseIndex}" type="button">Комментарий</button>
              <button class="button ghost small pain-exercise" data-index="${exerciseIndex}" type="button">⚠️ Боль</button>
            </div>
            ${result.painEvents?.length ? `<div class="help" style="margin-top:9px">⚠️ Боль отмечена: ${result.painEvents.map((event) => `${escapeHTML(event.areaLabel)} ${event.score}/10`).join(' · ')}</div>` : ''}
            ${result.comment ? `<div class="help" style="margin-top:9px">“${escapeHTML(result.comment)}”</div>` : ''}
          </div>
          <div class="set-list sport-set-list" aria-label="Подходы упражнения ${escapeHTML(result.name)}">
            ${result.sets.map((set, setIndex) => renderWorkoutSet(result, set, setIndex, activeSetIndex)).join('')}
          </div>
          ${feedback}
          <div class="button-row exercise-bottom-actions">
            <button class="button secondary small add-set" data-index="${exerciseIndex}" type="button" ${result.skipped ? 'disabled' : ''}>＋ Добавить подход</button>
            ${result.sets.length > 1 ? `<button class="button ghost small remove-set" data-index="${exerciseIndex}" type="button" ${result.skipped ? 'disabled' : ''}>− Убрать последний</button>` : ''}
          </div>
          ${exerciseIndex === focusIndex && state.settings.workoutSwipeGestures !== false ? '<div class="exercise-swipe-hint">Свайп вправо — завершить · влево — действия</div>' : ''}
        </div>
      </article>
    `;
  }

  function workoutExerciseUiKey(exerciseIndex) {
    return `${state.currentWorkout?.id || 'workout'}:${exerciseIndex}`;
  }

  function workoutExerciseCompleted(result) {
    return Boolean(result && !result.skipped && result.sets?.length && result.sets.every((set) => set.completed));
  }

  function workoutExerciseCompactSummary(result) {
    const completed = result.sets.filter((set) => set.completed);
    const count = completed.length;
    const setWord = count % 10 === 1 && count % 100 !== 11 ? 'подход' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'подхода' : 'подходов';
    const pieces = [`${count} ${setWord}`];
    if (result.defaults.unit === 'reps') {
      const maxWeight = Math.max(0, ...completed.map((set) => Number(set.weightKg) || 0));
      const totalReps = completed.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
      if (maxWeight > 0) pieces.push(`до ${formatWorkoutSetNumber(maxWeight)} кг`);
      if (totalReps > 0) pieces.push(`${totalReps} повт.`);
    } else if (result.defaults.unit === 'minutes') {
      const minutes = completed.reduce((sum, set) => sum + (Number(set.durationMin) || 0), 0);
      if (minutes > 0) pieces.push(`${formatWorkoutSetNumber(minutes)} мин`);
    } else {
      const seconds = completed.reduce((sum, set) => sum + (Number(set.durationSec) || 0), 0);
      if (seconds >= 60) pieces.push(`${Math.floor(seconds / 60)} мин ${seconds % 60 ? `${seconds % 60} сек` : ''}`.trim());
      else if (seconds > 0) pieces.push(`${seconds} сек`);
    }
    return pieces.join(' · ');
  }

  function workoutActiveSetIndex(result) {
    if (!result || result.skipped) return -1;
    return result.sets.findIndex((set) => !set.completed);
  }

  function renderWorkoutSetTrail(result, activeSetIndex) {
    if (!result.sets.length) return '<span class="sport-set-chip muted">нет подходов</span>';
    return result.sets.map((set, index) => {
      const stateName = set.completed ? `done effort-${set.difficulty || 'normal'}` : index === activeSetIndex ? 'current' : 'next';
      const label = set.completed ? '✓' : index === activeSetIndex ? 'сейчас' : String(set.number);
      const summary = workoutSetSummary(result, set);
      return `<span class="sport-set-chip ${stateName}" title="${escapeAttr(summary)}"><b>${escapeHTML(label)}</b><small>${escapeHTML(summary)}</small></span>`;
    }).join('');
  }

  function workoutSetSummary(result, set) {
    const unit = result.defaults.unit;
    if (unit === 'reps') {
      const weight = set.weightKg === '' || set.weightKg === null || set.weightKg === undefined ? '—' : `${formatWorkoutSetNumber(set.weightKg)} кг`;
      const reps = set.reps === '' || set.reps === null || set.reps === undefined ? '—' : `${formatWorkoutSetNumber(set.reps)} повт.`;
      return `${weight} · ${reps}`;
    }
    if (unit === 'minutes') return `${formatWorkoutSetNumber(set.durationMin || 0)} мин`;
    return `${formatWorkoutSetNumber(set.durationSec || 0)} сек`;
  }

  function formatWorkoutSetNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return Number.isInteger(number) ? String(number) : String(roundHalf(number)).replace('.', ',');
  }

  function previousWorkoutSets(result) {
    if (Array.isArray(result?.previousSets) && result.previousSets.length) return result.previousSets;
    const last = result?.exerciseId ? findLastExerciseResult(result.exerciseId) : null;
    return completedSets(last).map((set) => ({ ...set }));
  }

  function previousWorkoutSet(result, setIndex) {
    const sets = previousWorkoutSets(result);
    return sets[setIndex] || sets[sets.length - 1] || null;
  }

  function workoutSetImprovementHint(result, set, previousSet) {
    if (!previousSet || result.defaults.unit !== 'reps') return '';
    const weight = Number(set.weightKg);
    const reps = Number(set.reps);
    const previousWeight = Number(previousSet.weightKg);
    const previousReps = Number(previousSet.reps);
    if (!Number.isFinite(previousWeight) || !Number.isFinite(previousReps)) return '';
    if (weight > previousWeight || (weight === previousWeight && reps > previousReps)) return 'Уже выше прошлого результата';
    if (weight === previousWeight && reps === previousReps) return 'Ещё 1 повтор — новый лучший результат';
    return `Ориентир: ${formatWorkoutSetNumber(previousWeight)} кг × ${formatWorkoutSetNumber(previousReps)}`;
  }

  function renderPreviousSetHint(result, set, setIndex, isActive) {
    if (!isActive || state.settings.workoutShowPrevious === false) return '';
    const previousSet = previousWorkoutSet(result, setIndex);
    if (!previousSet) return '<div class="previous-set-ghost"><span>Первое выполнение</span><strong>Создаём отправную точку</strong></div>';
    const summary = workoutSetSummary(result, previousSet);
    const hint = workoutSetImprovementHint(result, set, previousSet);
    return `<div class="previous-set-ghost"><span>В прошлый раз: ${escapeHTML(summary)}</span><strong>${escapeHTML(hint || 'Можно повторить одним нажатием')}</strong><button class="mini-button copy-previous-set" type="button" data-set-index="${setIndex}">Как прошлый раз</button></div>`;
  }

  function renderQuickSetAdjust(result, setIndex, isActive, disabled) {
    if (!isActive || result.defaults.unit !== 'reps' || state.settings.workoutLargeControls === false) return '';
    return `
      <div class="quick-set-adjust" aria-label="Быстрая корректировка подхода">
        <span>Вес</span>
        ${[-2, -1, 1, 2].map((delta) => `<button class="quick-adjust-set" type="button" data-field="weightKg" data-delta="${delta}" data-set-index="${setIndex}" ${disabled}>${delta > 0 ? '+' : ''}${delta}</button>`).join('')}
        <span>Повторы</span>
        ${[-1, 1].map((delta) => `<button class="quick-adjust-set" type="button" data-field="reps" data-delta="${delta}" data-set-index="${setIndex}" ${disabled}>${delta > 0 ? '+' : ''}${delta}</button>`).join('')}
      </div>
    `;
  }

  function renderWorkoutSet(result, set, setIndex, activeSetIndex = -1) {
    const unit = result.defaults.unit;
    const disabled = result.skipped ? 'disabled' : '';
    const setLabel = `Подход ${set.number}`;
    const isActive = !result.skipped && setIndex === activeSetIndex;
    const setState = set.completed ? `done effort-${set.difficulty || 'normal'}` : isActive ? 'current' : 'queued';
    const completeButtonText = set.completed ? '✓' : isActive ? 'Завершить подход ✓' : '○';
    const completeButtonClass = isActive && !set.completed ? ' active-finish' : '';
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
      <div class="set-row sport-set-row ${setState}" data-set-index="${setIndex}">
        <div class="set-row-head">
          <div class="set-badge"><span>${isActive ? 'Сейчас' : 'Подход'}</span><strong>${set.number}</strong></div>
          <div class="set-row-actions">
            <label class="set-difficulty-wrap">
              <span>Тяжесть</span>
              <select class="set-select set-difficulty" aria-label="Тяжесть, ${setLabel}" ${disabled}>${difficultyOptions.map(([value, label]) => `<option value="${value}" ${set.difficulty === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
            </label>
            <button class="check-button ${set.completed ? 'done' : ''}${completeButtonClass} complete-set" type="button" aria-label="${set.completed ? 'Снять отметку' : 'Завершить'}, ${setLabel}" ${disabled}>${completeButtonText}</button>
          </div>
        </div>
        ${renderPreviousSetHint(result, set, setIndex, isActive)}
        ${controls}
        ${renderQuickSetAdjust(result, setIndex, isActive, disabled)}
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

  function exerciseFeedbackLabel(value) {
    return exerciseFeedbackOptions.find(([id]) => id === value)?.[1] || '';
  }

  function renderExerciseQuickFeedback(result, exerciseIndex) {
    if (state.settings.workoutQuickFeedback === false) return '';
    return `
      <div class="exercise-quick-feedback">
        <div><strong>Как прошло?</strong><span>Один тап вместо комментария</span></div>
        <div class="exercise-feedback-options">
          ${exerciseFeedbackOptions.map(([value, label]) => `<button class="exercise-feedback ${result.feedback === value ? 'active' : ''}" type="button" data-index="${exerciseIndex}" data-feedback="${value}">${escapeHTML(label)}</button>`).join('')}
          <button class="exercise-feedback pain-exercise" type="button" data-index="${exerciseIndex}">Боль</button>
        </div>
      </div>
    `;
  }

  function workoutSmartTip(result, exerciseIndex) {
    if (result.skipped) return 'Упражнение пропущено — цикл не сломается.';
    if (workoutExerciseCompleted(result)) {
      if (result.feedback === 'failure') return 'Было до отказа — в следующий раз вес не повышаем.';
      if (result.feedback === 'easy') return 'Все готово. В следующий раз можно добавить повтор или немного веса.';
      return 'Упражнение завершено и сохранено.';
    }
    const activeSetIndex = workoutActiveSetIndex(result);
    const set = result.sets[activeSetIndex];
    const previousSet = previousWorkoutSet(result, activeSetIndex);
    if (set && previousSet && result.defaults.unit === 'reps') {
      const previousDifficulty = previousSet.difficulty || 'normal';
      if (previousDifficulty === 'easy') return 'Прошлый подход был лёгким — попробуй +1 повтор, не обязательно сразу повышать вес.';
      if (previousDifficulty === 'failure') return 'В прошлый раз был отказ — оставь вес и сохрани 1–2 повтора в запасе.';
      return workoutSetImprovementHint(result, set, previousSet);
    }
    const remaining = workoutEstimatedRemainingMinutes();
    return exerciseIndex === workoutFocusedExerciseIndex() ? `Спокойно ведём текущий подход. До конца примерно ${remaining} мин.` : '';
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
        row.querySelectorAll('.quick-adjust-set').forEach((button) => button.addEventListener('click', () => {
          const field = button.dataset.field;
          const delta = Number(button.dataset.delta);
          const input = row.querySelector(`.set-input.${field === 'weightKg' ? 'set-weight' : 'set-reps'}`);
          adjustSetValue(exerciseIndex, setIndex, field, delta, input);
        }));
        row.querySelector('.copy-previous-set')?.addEventListener('click', () => copyPreviousSetValues(exerciseIndex, setIndex, row));
        row.querySelector('.set-difficulty')?.addEventListener('change', (event) => updateSet(exerciseIndex, setIndex, 'difficulty', event.target.value));
        row.querySelector('.complete-set')?.addEventListener('click', () => toggleSetComplete(exerciseIndex, setIndex));
      });
      if (state.settings.workoutSwipeGestures !== false) bindWorkoutSwipe(card, exerciseIndex);
    });
    el.main.querySelectorAll('.queued-workout-exercise').forEach((card) => {
      const exerciseIndex = Number(card.dataset.exerciseIndex);
      if (state.settings.workoutSwipeGestures !== false) bindWorkoutSwipe(card, exerciseIndex);
    });
    el.main.querySelectorAll('.replace-exercise').forEach((button) => button.addEventListener('click', () => showReplacementModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.skip-exercise').forEach((button) => button.addEventListener('click', () => toggleSkipExercise(Number(button.dataset.index))));
    el.main.querySelectorAll('.comment-exercise').forEach((button) => button.addEventListener('click', () => showExerciseCommentModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.pain-exercise').forEach((button) => button.addEventListener('click', () => showExercisePainModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.exercise-feedback').forEach((button) => {
      if (button.classList.contains('pain-exercise')) return;
      button.addEventListener('click', () => setExerciseFeedback(Number(button.dataset.index), button.dataset.feedback));
    });
    el.main.querySelectorAll('.pain-action').forEach((button) => button.addEventListener('click', () => applyPainAction(Number(button.dataset.index), button.dataset.action)));
    el.main.querySelectorAll('.focus-workout-exercise').forEach((button) => button.addEventListener('click', () => focusWorkoutExercise(Number(button.dataset.index))));
    document.getElementById('toggle-hidden-completed')?.addEventListener('click', () => {
      workoutExerciseUi.showHiddenCompleted = !workoutExerciseUi.showHiddenCompleted;
      renderWorkout();
    });
    document.getElementById('apply-deload-workout')?.addEventListener('click', applyDeloadToCurrentWorkout);
    document.getElementById('open-iron-calculator-workout')?.addEventListener('click', () => showIronCalculatorModal(currentWorkoutTargetWeight()));
    el.main.querySelectorAll('.add-set').forEach((button) => button.addEventListener('click', () => addWorkoutSet(Number(button.dataset.index))));
    el.main.querySelectorAll('.remove-set').forEach((button) => button.addEventListener('click', () => removeLastWorkoutSet(Number(button.dataset.index))));
    el.main.querySelectorAll('.toggle-completed-exercise').forEach((button) => button.addEventListener('click', () => {
      const exerciseIndex = Number(button.dataset.index);
      const card = button.closest('.workout-exercise');
      if (!card) return;
      const key = workoutExerciseUiKey(exerciseIndex);
      const shouldExpand = card.classList.contains('is-collapsed');
      if (shouldExpand) workoutExerciseUi.expandedCompleted.add(key);
      else workoutExerciseUi.expandedCompleted.delete(key);
      setCompletedExerciseCollapsed(card, !shouldExpand);
    }));
    setupCompletedExerciseCards();
    document.getElementById('workout-comment')?.addEventListener('input', (event) => {
      state.currentWorkout.comment = event.target.value;
      debounceDraftSave();
    });
    document.getElementById('cancel-workout')?.addEventListener('click', showWorkoutCloseModal);
    document.getElementById('finish-workout')?.addEventListener('click', showFinishWorkoutModal);
    document.getElementById('quick-add-workout-exercise')?.addEventListener('click', showQuickAddWorkoutExercise);
    document.getElementById('quick-add-workout-exercise-large')?.addEventListener('click', showQuickAddWorkoutExercise);
    document.getElementById('workout-dock-prev')?.addEventListener('click', () => focusWorkoutRelative(-1));
    document.getElementById('workout-dock-next')?.addEventListener('click', () => focusWorkoutRelative(1));
    document.getElementById('workout-dock-add-set')?.addEventListener('click', (event) => addWorkoutSet(Number(event.currentTarget.dataset.index)));
    document.querySelectorAll('.workout-dock-input').forEach((input) => {
      input.addEventListener('focus', () => input.select());
      input.addEventListener('input', (event) => {
        const exerciseIndex = Number(event.currentTarget.dataset.exercise);
        const setIndex = Number(event.currentTarget.dataset.set);
        const field = event.currentTarget.dataset.field;
        const value = numberOrBlank(event.currentTarget.value);
        updateSet(exerciseIndex, setIndex, field, value);
        const rowInputClass = field === 'weightKg' ? 'set-weight' : field === 'reps' ? 'set-reps' : 'set-duration';
        const rowInput = el.main.querySelector(`.workout-exercise[data-exercise-index="${exerciseIndex}"] .set-row[data-set-index="${setIndex}"] .set-input.${rowInputClass}`);
        if (rowInput && document.activeElement !== rowInput) rowInput.value = event.currentTarget.value;
      });
    });
    document.querySelectorAll('.workout-dock-adjust').forEach((button) => {
      bindSetStepper(button, Number(button.dataset.exercise), Number(button.dataset.set), {
        querySelector(selector) {
          const field = button.dataset.field;
          if (selector.includes('set-weight') && field !== 'weightKg') return null;
          if (selector.includes('set-reps') && field !== 'reps') return null;
          if (selector.includes('set-duration') && !['durationMin', 'durationSec'].includes(field)) return null;
          return document.querySelector(`.workout-dock-input[data-exercise="${button.dataset.exercise}"][data-set="${button.dataset.set}"][data-field="${field}"]`);
        },
      });
    });
    document.getElementById('workout-dock-complete')?.addEventListener('click', (event) => {
      const exerciseIndex = Number(event.currentTarget.dataset.exercise);
      const setIndex = Number(event.currentTarget.dataset.set);
      if (exerciseIndex >= 0 && setIndex >= 0) toggleSetComplete(exerciseIndex, setIndex);
    });
  }

  function copyPreviousSetValues(exerciseIndex, setIndex, row) {
    const result = state.currentWorkout?.exercises?.[exerciseIndex];
    const set = result?.sets?.[setIndex];
    const previous = previousWorkoutSet(result, setIndex);
    if (!set || !previous) return;
    ['weightKg', 'reps', 'durationSec', 'durationMin'].forEach((field) => {
      if (previous[field] !== undefined && previous[field] !== null) set[field] = previous[field];
    });
    const weightInput = row.querySelector('.set-weight');
    const repsInput = row.querySelector('.set-reps');
    const durationInput = row.querySelector('.set-duration');
    if (weightInput) weightInput.value = set.weightKg ?? '';
    if (repsInput) repsInput.value = set.reps ?? '';
    if (durationInput) durationInput.value = result.defaults.unit === 'minutes' ? set.durationMin ?? '' : set.durationSec ?? '';
    debounceDraftSave();
    toast('Подставлено как в прошлый раз');
  }

  async function setExerciseFeedback(index, feedback) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result) return;
    result.feedback = result.feedback === feedback ? null : feedback;
    await saveDraftWorkout();
    renderWorkout();
  }

  function focusWorkoutExercise(index, { scroll = true } = {}) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result) return;
    workoutExerciseUi.focusedIndex = index;
    workoutExerciseUi.expandedQueued.delete(workoutExerciseUiKey(index));
    renderWorkout();
    if (!scroll || state.settings.workoutAutoScroll === false) return;
    requestAnimationFrame(() => {
      const target = el.main.querySelector(`[data-exercise-index="${index}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function focusWorkoutRelative(direction) {
    const exercises = state.currentWorkout?.exercises || [];
    const available = exercises.map((result, index) => ({ result, index })).filter(({ result }) => !result.skipped && !workoutExerciseCompleted(result)).map(({ index }) => index);
    if (!available.length) return toast('Все упражнения уже выполнены');
    const current = workoutFocusedExerciseIndex();
    const position = Math.max(0, available.indexOf(current));
    const nextPosition = Math.min(available.length - 1, Math.max(0, position + direction));
    if (nextPosition === position) return toast(direction < 0 ? 'Это первое незавершённое упражнение' : 'Дальше незавершённых упражнений нет');
    focusWorkoutExercise(available[nextPosition]);
  }

  function bindWorkoutSwipe(card, exerciseIndex) {
    let startX = null;
    let startY = null;
    let active = false;
    card.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1 || event.target.closest('button,input,select,textarea,a,summary')) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      active = true;
    }, { passive: true });
    card.addEventListener('touchmove', (event) => {
      if (!active || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        card.style.setProperty('--swipe-shift', `${Math.max(-42, Math.min(42, dx * .28))}px`);
      }
    }, { passive: true });
    card.addEventListener('touchend', (event) => {
      if (!active || startX === null || startY === null) return;
      active = false;
      card.style.removeProperty('--swipe-shift');
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      startX = startY = null;
      if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx > 0) showCompleteExerciseConfirm(exerciseIndex);
      else showExerciseActionsModal(exerciseIndex);
    }, { passive: true });
    card.addEventListener('touchcancel', () => {
      active = false;
      startX = startY = null;
      card.style.removeProperty('--swipe-shift');
    }, { passive: true });
  }

  function showCompleteExerciseConfirm(index) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result) return;
    if (workoutExerciseCompleted(result)) return toast('Упражнение уже выполнено');
    showModal(`
      <div class="modal-head"><h2>Завершить упражнение?</h2><button class="modal-close" data-close>×</button></div>
      <p class="muted">${escapeHTML(result.name)}</p>
      <div class="notice warning">Все незавершённые подходы будут отмечены выполненными с текущими значениями.</div>
      <div class="button-row" style="margin-top:14px"><button class="button secondary" data-close type="button">Отмена</button><button class="button primary" id="confirm-complete-exercise" type="button">Да, завершить</button></div>
    `);
    document.getElementById('confirm-complete-exercise').addEventListener('click', async () => {
      closeModal();
      await completeWorkoutExercise(index);
    });
  }

  function showExerciseActionsModal(index) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result) return;
    showModal(`
      <div class="modal-head"><h2>Действия</h2><button class="modal-close" data-close>×</button></div>
      <p class="muted">${escapeHTML(result.name)}</p>
      <div class="workout-action-sheet">
        <button class="list-row" id="swipe-replace" type="button"><div><div class="list-row-title">↻ Заменить</div><div class="list-row-sub">Показать лучшие аналоги</div></div><span>›</span></button>
        <button class="list-row" id="swipe-skip" type="button"><div><div class="list-row-title">${result.skipped ? 'Вернуть в тренировку' : 'Пропустить'}</div><div class="list-row-sub">Цикл и история не сломаются</div></div><span>›</span></button>
        <button class="list-row" id="swipe-move-down" type="button"><div><div class="list-row-title">↓ Перенести ниже</div><div class="list-row-sub">Поменять местами со следующим</div></div><span>›</span></button>
        <button class="list-row" id="swipe-add-set" type="button"><div><div class="list-row-title">＋ Добавить подход</div><div class="list-row-sub">С текущими рабочими значениями</div></div><span>›</span></button>
      </div>
    `);
    document.getElementById('swipe-replace').addEventListener('click', () => { closeModal(); showReplacementModal(index); });
    document.getElementById('swipe-skip').addEventListener('click', async () => { closeModal(); await toggleSkipExercise(index); });
    document.getElementById('swipe-move-down').addEventListener('click', async () => { closeModal(); await moveWorkoutExerciseDown(index); });
    document.getElementById('swipe-add-set').addEventListener('click', async () => { closeModal(); await addWorkoutSet(index); });
  }

  async function moveWorkoutExerciseDown(index) {
    const exercises = state.currentWorkout?.exercises || [];
    if (index < 0 || index >= exercises.length - 1) return toast('Упражнение уже последнее');
    [exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]];
    workoutExerciseUi.focusedIndex = index + 1;
    await saveDraftWorkout();
    renderWorkout();
    toast('Упражнение перенесено ниже');
  }

  function setupCompletedExerciseCards() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior = workoutCompletedBehavior();
    el.main.querySelectorAll('.workout-exercise.exercise-complete').forEach((card) => {
      const body = card.querySelector('.completed-exercise-body');
      if (!body) return;
      if (behavior === 'keep') {
        card.classList.remove('is-collapsed');
        body.style.maxHeight = 'none';
      } else {
        body.style.maxHeight = card.classList.contains('is-collapsed') ? '0px' : 'none';
      }
    });

    const justCompletedIndex = workoutExerciseUi.justCompletedIndex;
    if (!Number.isInteger(justCompletedIndex)) return;
    workoutExerciseUi.justCompletedIndex = null;
    const card = el.main.querySelector(`.workout-exercise[data-exercise-index="${justCompletedIndex}"]`);
    if (!card) return;
    const body = card.querySelector('.completed-exercise-body');
    if (body) body.style.maxHeight = `${body.scrollHeight}px`;
    if (state.settings.vibrationEnabled && navigator.vibrate) navigator.vibrate([18, 28, 18]);

    const shouldCollapse = behavior !== 'keep';
    const shouldAutoScroll = state.settings.workoutAutoScroll !== false;
    if (reduceMotion) {
      card.classList.remove('just-completed');
      if (shouldCollapse) setCompletedExerciseCollapsed(card, true, { animate: false });
      if (shouldAutoScroll) scrollToNextWorkoutExercise(justCompletedIndex, false);
      if (behavior === 'hide') window.setTimeout(renderWorkout, 80);
      return;
    }

    card.classList.add('exercise-celebrate');
    window.setTimeout(() => {
      card.classList.remove('just-completed');
      if (shouldCollapse) setCompletedExerciseCollapsed(card, true);
    }, 520);
    window.setTimeout(() => {
      card.classList.remove('exercise-celebrate');
      if (shouldAutoScroll) scrollToNextWorkoutExercise(justCompletedIndex, true);
      if (behavior === 'hide') renderWorkout();
    }, 1050);
  }

  function setCompletedExerciseCollapsed(card, collapsed, { animate = true } = {}) {
    const body = card.querySelector('.completed-exercise-body');
    const toggle = card.querySelector('.toggle-completed-exercise');
    if (!body) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (toggle) {
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      const name = state.currentWorkout?.exercises?.[Number(card.dataset.exerciseIndex)]?.name || 'упражнение';
      toggle.setAttribute('aria-label', `${collapsed ? 'Развернуть' : 'Свернуть'} завершённое упражнение ${name}`);
    }

    if (!animate || reduceMotion) {
      card.classList.toggle('is-collapsed', collapsed);
      body.style.maxHeight = collapsed ? '0px' : 'none';
      return;
    }

    if (collapsed) {
      body.style.maxHeight = `${body.scrollHeight}px`;
      void body.offsetHeight;
      card.classList.add('is-collapsed');
      body.style.maxHeight = '0px';
      return;
    }

    card.classList.remove('is-collapsed');
    body.style.maxHeight = '0px';
    void body.offsetHeight;
    body.style.maxHeight = `${body.scrollHeight}px`;
    const finishExpand = (event) => {
      if (event.target !== body || event.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', finishExpand);
      if (!card.classList.contains('is-collapsed')) body.style.maxHeight = 'none';
    };
    body.addEventListener('transitionend', finishExpand);
  }

  function nextIncompleteWorkoutExerciseIndex(fromIndex) {
    const exercises = state.currentWorkout?.exercises || [];
    const after = exercises.findIndex((result, index) => index > fromIndex && !result.skipped && !workoutExerciseCompleted(result));
    if (after >= 0) return after;
    return exercises.findIndex((result, index) => index !== fromIndex && !result.skipped && !workoutExerciseCompleted(result));
  }

  function scrollToNextWorkoutExercise(fromIndex, smooth = true) {
    const nextIndex = nextIncompleteWorkoutExerciseIndex(fromIndex);
    if (nextIndex < 0) return;
    const target = el.main.querySelector(`.workout-exercise[data-exercise-index="${nextIndex}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const safeTop = 118;
    const safeBottom = window.innerHeight - 112;
    if (rect.top >= safeTop && rect.bottom <= safeBottom) return;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }

  function updateSet(exerciseIndex, setIndex, field, value) {
    state.currentWorkout.exercises[exerciseIndex].sets[setIndex][field] = value;
    const dockInput = document.querySelector(`.workout-dock-input[data-exercise="${exerciseIndex}"][data-set="${setIndex}"][data-field="${field}"]`);
    if (dockInput && document.activeElement !== dockInput) dockInput.value = value ?? '';
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
    const inputClass = field === 'weightKg' ? 'set-weight' : field === 'reps' ? 'set-reps' : 'set-duration';
    const linkedInputs = [
      input,
      el.main?.querySelector(`.workout-exercise[data-exercise-index="${exerciseIndex}"] .set-row[data-set-index="${setIndex}"] .set-input.${inputClass}`),
      document.querySelector(`.workout-dock-input[data-exercise="${exerciseIndex}"][data-set="${setIndex}"][data-field="${field}"]`),
    ].filter(Boolean);
    [...new Set(linkedInputs)].forEach((linkedInput) => {
      linkedInput.value = String(next);
      linkedInput.classList.remove('stepper-pulse');
      void linkedInput.offsetWidth;
      linkedInput.classList.add('stepper-pulse');
    });
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
    const wasCompleted = set.completed;
    set.completed = !set.completed;
    const exerciseJustCompleted = !wasCompleted && workoutExerciseCompleted(result);
    const uiKey = workoutExerciseUiKey(exerciseIndex);

    if (exerciseJustCompleted) {
      workoutExerciseUi.expandedCompleted.delete(uiKey);
      workoutExerciseUi.justCompletedIndex = exerciseIndex;
      const nextIndex = nextIncompleteWorkoutExerciseIndex(exerciseIndex);
      workoutExerciseUi.focusedIndex = nextIndex >= 0 ? nextIndex : null;
    } else if (!set.completed) {
      workoutExerciseUi.expandedCompleted.delete(uiKey);
      workoutExerciseUi.justCompletedIndex = null;
      workoutExerciseUi.focusedIndex = exerciseIndex;
    }

    await saveDraftWorkout();
    renderWorkout();

    if (!set.completed) return;
    if (exerciseJustCompleted) {
      const nextExerciseIndex = nextIncompleteWorkoutExerciseIndex(exerciseIndex);
      if (nextExerciseIndex < 0) {
        toast('Все упражнения выполнены — можно завершать тренировку');
        return;
      }
      if (result.defaults.restSec > 0) {
        const nextResult = state.currentWorkout.exercises[nextExerciseIndex];
        window.setTimeout(() => startRestTimer(result.defaults.restSec, `${nextResult.name} · следующий блок`), 1120);
      }
      return;
    }

    if (result.defaults.restSec > 0) {
      const next = result.sets[setIndex + 1] ? `${result.name} · подход ${setIndex + 2}` : 'Переход к следующему упражнению';
      startRestTimer(result.defaults.restSec, next);
    }
  }

  async function completeWorkoutExercise(index) {
    const result = state.currentWorkout?.exercises?.[index];
    if (!result || result.skipped) return;
    result.sets.forEach((set) => { set.completed = true; });
    workoutExerciseUi.expandedCompleted.delete(workoutExerciseUiKey(index));
    workoutExerciseUi.justCompletedIndex = index;
    const nextIndex = nextIncompleteWorkoutExerciseIndex(index);
    workoutExerciseUi.focusedIndex = nextIndex >= 0 ? nextIndex : null;
    await saveDraftWorkout();
    renderWorkout();
    if (nextIndex < 0) return toast('Все упражнения выполнены — можно завершать');
    if (result.defaults.restSec > 0) {
      const nextResult = state.currentWorkout.exercises[nextIndex];
      window.setTimeout(() => startRestTimer(result.defaults.restSec, `${nextResult.name} · следующий блок`), 1120);
    }
  }

  async function toggleSkipExercise(index) {
    const result = state.currentWorkout.exercises[index];
    result.skipped = !result.skipped;
    if (result.skipped) result.sets.forEach((set) => { set.completed = false; });
    await saveDraftWorkout();
    renderWorkout();
  }

  function profileExerciseAvailable(exercise) {
    if (!exercise) return false;
    const equipment = String(exercise.equipment || '').toLowerCase();
    const available = String(state.profile?.equipment || '').toLowerCase();
    if (!equipment || /собственн|коврик|стул|скамь|упор/.test(equipment)) return true;
    if (/мультитренаж|тренажёр|блок/.test(equipment) && !/мультитренаж|тренаж|блок/.test(available)) return false;
    if (equipment.includes('степпер') && !available.includes('степпер')) return false;
    if (equipment.includes('штанг') && equipment.includes('гантел') && /или/.test(equipment)) return available.includes('штанг') || available.includes('гантел');
    if (equipment.includes('штанг') && !available.includes('штанг')) return false;
    if (equipment.includes('гантел') && !available.includes('гантел')) return false;
    if (equipment.includes('брусь') && !available.includes('брусь')) return false;
    if (equipment.includes('ролик') && !available.includes('ролик')) return false;
    return true;
  }

  function replacementReason(currentExercise, candidate, currentResult, details = null) {
    const currentGroups = new Set(getMuscleGroupsForExercise(currentExercise, currentResult));
    const candidateGroups = getMuscleGroupsForExercise(candidate);
    const sameGroups = candidateGroups.filter((group) => currentGroups.has(group)).length;
    const painRisk = details?.painRisk || analyzeExercisePainRisk(state.currentWorkout?.preWorkoutPain, candidate);
    if (painRisk?.level === 'high') return 'Та же зона, но ограничение по боли остаётся';
    if (sameGroups >= 2) return 'Сохраняет основные мышцы и характер нагрузки';
    if (/сидя|лёжа|тренажёр|блок|опор/i.test(`${candidate.name} ${candidate.equipment}`)) return 'Стабильнее и проще контролировать технику';
    if (sameGroups === 1) return 'Сохраняет главный мышечный акцент';
    return 'Доступно с выбранным оборудованием';
  }

  function rankedReplacementCandidates(currentExercise, currentResult, index, limit = 8) {
    const currentGroups = new Set(getMuscleGroupsForExercise(currentExercise, currentResult));
    const explicit = new Set(currentExercise?.replacements || []);
    const used = new Set((state.currentWorkout?.exercises || []).map((result, resultIndex) => resultIndex === index ? null : result.exerciseId).filter(Boolean));
    const currentPain = (currentResult?.painEvents || []).slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
    const painInput = currentPain
      ? normalizePainInput({ hasPain: true, areaId: currentPain.areaId, score: currentPain.score, comment: currentPain.comment })
      : state.currentWorkout?.preWorkoutPain;
    return (state.exercises || [])
      .filter((candidate) => candidate?.id && candidate.id !== currentExercise?.id && !used.has(candidate.id) && profileExerciseAvailable(candidate))
      .map((candidate) => {
        const groups = getMuscleGroupsForExercise(candidate);
        const overlap = groups.filter((group) => currentGroups.has(group));
        const painRisk = analyzeExercisePainRisk(painInput, candidate);
        const recentPain = smartExerciseRecentPainRisk(candidate);
        const blocked = (painRisk?.level === 'high' && Number(painInput?.score || 0) >= 7) || recentPain.blocked;
        let score = overlap.length * 42;
        if (explicit.has(candidate.id)) score += 85;
        if (groups.length && overlap.length === groups.length) score += 12;
        if (/сидя|лёжа|тренажёр|блок|опор/i.test(`${candidate.name} ${candidate.equipment}`)) score += 8;
        const daysSince = smartLastExerciseUseDays(candidate.id);
        if (daysSince === null || daysSince >= 7) score += 8;
        else if (daysSince <= 1) score -= 6;
        if (painRisk?.level === 'moderate') score -= 24;
        if (painRisk?.level === 'high') score -= 70;
        score -= Math.min(50, recentPain.penalty || 0);
        const reasons = [];
        if (explicit.has(candidate.id)) reasons.push('готовая замена');
        if (overlap.length) reasons.push(`те же мышцы: ${overlap.map(muscleGroupLabel).join(', ').toLowerCase()}`);
        reasons.push('оборудование подходит');
        if (painRisk?.level === 'moderate') reasons.push('осторожно из-за боли');
        else if (!painRisk && !(recentPain.labels || []).length) reasons.push('без свежих ограничений');
        return { candidate, score, overlap, painRisk, blocked, reasons };
      })
      .filter((row) => !row.blocked && (row.overlap.length || explicit.has(row.candidate.id)))
      .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name, 'ru'))
      .slice(0, limit);
  }

  function showReplacementModal(index) {
    const current = state.currentWorkout.exercises[index];
    const exercise = getExercise(current.exerciseId);
    const candidates = rankedReplacementCandidates(exercise, current, index, 8);
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Умная замена</div><h2>${escapeHTML(current.name)}</h2></div><button class="modal-close" data-close>×</button></div>
      <p class="muted">Варианты отсортированы по мышцам, доступному оборудованию, свежей боли и упражнениям, которые уже есть в тренировке.</p>
      <div class="replacement-best-list smart-replacement-ranked">
        ${candidates.length ? candidates.map((row, candidateIndex) => `<button class="replacement-best-card choose-replacement" data-id="${escapeAttr(row.candidate.id)}" type="button"><span>${candidateIndex + 1}</span><div><strong>${escapeHTML(row.candidate.name)}</strong><small>${escapeHTML(replacementReason(exercise, row.candidate, current, row))} · ${escapeHTML(row.candidate.equipment)}</small><em>${escapeHTML(row.reasons.slice(0, 3).join(' · '))}</em></div><b>›</b></button>`).join('') : `<div class="empty"><strong>Подходящей замены не нашлось</strong>Можно выбрать любое доступное упражнение из библиотеки.</div>`}
      </div>
      <button class="button secondary full" id="choose-any-exercise" style="margin-top:12px">Открыть всю библиотеку</button>
    `);
    el.modalRoot.querySelectorAll('.choose-replacement').forEach((button) => button.addEventListener('click', () => replaceWorkoutExercise(index, button.dataset.id)));
    document.getElementById('choose-any-exercise').addEventListener('click', () => showExercisePicker((id) => replaceWorkoutExercise(index, id)));
  }

  function buildWorkoutExerciseResult(exercise, { comment = '', replacementOf = null, painEvents = [] } = {}) {
    const last = findLastExerciseResult(exercise.id);
    const suggestion = progressionSuggestion(exercise, last);
    const targetSets = Math.min(exercise.defaults.sets, state.currentWorkout?.shortMode ? 2 : exercise.defaults.sets);
    const sets = Array.from({ length: targetSets }, (_, i) => ({
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
    return {
      exerciseId: exercise.id,
      name: exercise.name,
      replacementOf,
      skipped: false,
      comment,
      previous: last ? summarizePrevious(last) : null,
      previousSets: completedSets(last).map((set) => ({
        weightKg: set.weightKg ?? '', reps: set.reps ?? '', durationSec: set.durationSec ?? null,
        durationMin: set.durationMin ?? null, difficulty: set.difficulty || 'normal',
      })),
      prefilledFromLast: completedSets(last).length > 0,
      suggestion,
      painRisk: analyzeExercisePainRisk(state.currentWorkout?.preWorkoutPain, exercise),
      painEvents,
      defaults: { ...exercise.defaults },
      sets,
      feedback: null,
    };
  }

  async function replaceWorkoutExercise(index, newId) {
    const old = state.currentWorkout.exercises[index];
    const exercise = getExercise(newId);
    if (!exercise) return;
    state.currentWorkout.exercises[index] = buildWorkoutExerciseResult(exercise, {
      comment: `Замена: ${old.name}`,
      replacementOf: old.replacementOf || old.exerciseId,
      painEvents: old.painEvents || [],
    });
    workoutExerciseUi.focusedIndex = index;
    await saveDraftWorkout();
    closeModal();
    renderWorkout();
  }

  function recentWorkoutExerciseIds(limit = 6) {
    const ids = [];
    for (const workout of state.workouts) {
      for (const result of workout.exercises || []) {
        if (!ids.includes(result.exerciseId) && !state.currentWorkout.exercises.some((item) => item.exerciseId === result.exerciseId)) ids.push(result.exerciseId);
        if (ids.length >= limit) return ids;
      }
    }
    return ids;
  }

  function showQuickAddWorkoutExercise() {
    const focusIndex = workoutFocusedExerciseIndex();
    const focusResult = focusIndex >= 0 ? state.currentWorkout.exercises[focusIndex] : null;
    const focusExercise = focusResult ? getExercise(focusResult.exerciseId) : null;
    const focusGroups = new Set(getMuscleGroupsForExercise(focusExercise, focusResult));
    const excluded = new Set(state.currentWorkout.exercises.map((result) => result.exerciseId));
    const recent = recentWorkoutExerciseIds(5).map(getExercise).filter(Boolean);
    const matching = state.exercises.filter((exercise) => !excluded.has(exercise.id) && getMuscleGroupsForExercise(exercise).some((group) => focusGroups.has(group))).slice(0, 5);
    const options = [...recent, ...matching].filter((exercise, index, array) => array.findIndex((item) => item.id === exercise.id) === index).slice(0, 7);
    showModal(`
      <div class="modal-head"><h2>Добавить упражнение</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice">Сначала — недавние и подходящие текущей мышечной группе.</div>
      <div class="card list-card" style="margin-top:12px">${options.length ? options.map((exercise) => `<button class="list-row quick-add-workout-choice" data-id="${escapeAttr(exercise.id)}" type="button"><div class="list-row-main"><div class="list-row-title">${escapeHTML(exercise.name)}</div><div class="list-row-sub">${escapeHTML(exercise.group)} · ${escapeHTML(exercise.equipment)}</div></div><span>＋</span></button>`).join('') : '<div class="empty compact-empty"><strong>Подходящих недавних нет</strong>Открой всю библиотеку.</div>'}</div>
      <button class="button secondary full" id="quick-add-workout-all" style="margin-top:12px">Вся библиотека</button>
    `);
    el.modalRoot.querySelectorAll('.quick-add-workout-choice').forEach((button) => button.addEventListener('click', () => addExerciseToCurrentWorkout(button.dataset.id)));
    document.getElementById('quick-add-workout-all').addEventListener('click', () => showExercisePicker(addExerciseToCurrentWorkout));
  }

  async function addExerciseToCurrentWorkout(exerciseId) {
    const exercise = getExercise(exerciseId);
    if (!exercise) return;
    if (state.currentWorkout.exercises.some((result) => result.exerciseId === exercise.id)) return toast('Это упражнение уже есть в тренировке');
    const result = buildWorkoutExerciseResult(exercise, { comment: 'Добавлено во время тренировки' });
    const focusIndex = workoutFocusedExerciseIndex();
    const insertAt = focusIndex >= 0 ? focusIndex + 1 : state.currentWorkout.exercises.length;
    state.currentWorkout.exercises.splice(insertAt, 0, result);
    workoutExerciseUi.focusedIndex = insertAt;
    await saveDraftWorkout();
    closeModal();
    renderWorkout();
    toast('Упражнение добавлено');
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
      <div class="field"><label>${escapeHTML(result.name)}</label><textarea id="exercise-comment-input" placeholder="Например: тянет плечо, неудобная техника, вес лёгкий…">${escapeHTML(result.comment || '')}</textarea></div>
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
        stopRestTimer();
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
      stopRestTimer();
      clearInterval(state.workoutClockInterval);
      state.currentWorkout = null;
      workoutExerciseUi.focusedIndex = null;
      workoutExerciseUi.expandedQueued.clear();
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

  function workoutSummaryAdvice(workout) {
    const sets = workout.exercises.flatMap((result) => result.sets || []).filter((set) => set.completed);
    const hard = sets.filter((set) => ['hard', 'failure'].includes(set.difficulty)).length;
    const failure = sets.filter((set) => set.difficulty === 'failure').length;
    if (workout.completionPct < 50) return 'Сохранили честный результат. Следующую тренировку не усложняем — сначала восстановление.';
    if (failure >= 3) return 'Много подходов до отказа. В следующий раз оставь 1–2 повтора в запасе.';
    if (hard > sets.length * .55) return 'Нагрузка высокая. Вес пока не повышаем, следим за восстановлением.';
    if (workout.records?.length) return 'Есть прогресс. Повышать всё сразу не нужно — закрепи результат на следующей тренировке.';
    return 'Хорошая рабочая тренировка. Сохраняем темп и двигаемся без резких скачков нагрузки.';
  }

  function showWorkoutSummaryModal(workout) {
    const completedSetsCount = workout.exercises.flatMap((result) => result.sets || []).filter((set) => set.completed).length;
    const feedbackCount = workout.exercises.filter((result) => result.feedback).length;
    showModal(`
      <div class="workout-finish-hero">
        <div class="workout-finish-check">✓</div>
        <div class="eyebrow">Тренировка сохранена</div>
        <h2>${escapeHTML(workout.dayName)}</h2>
        <p>${escapeHTML(workoutSummaryAdvice(workout))}</p>
      </div>
      <div class="workout-finish-stats">
        <div><strong>${formatDuration(workout.durationSec)}</strong><span>время</span></div>
        <div><strong>${completedSetsCount}</strong><span>подходов</span></div>
        <div><strong>${formatWorkoutSetNumber(workout.totalLoadKg || 0)}</strong><span>кг объёма</span></div>
        <div><strong>${workout.records?.length || 0}</strong><span>рекордов</span></div>
      </div>
      <div class="workout-finish-progress"><span style="width:${workout.completionPct}%"></span></div>
      <div class="help center">Выполнено ${workout.completionPct}% · оценено упражнений: ${feedbackCount}</div>
      ${workout.records?.length ? `<div class="workout-finish-records"><strong>Новые результаты</strong>${workout.records.slice(0, 4).map((record) => `<span>🏆 ${escapeHTML(record.title || record.text || record.label || 'Личный рекорд')}</span>`).join('')}</div>` : ''}
      ${workout.progression?.some((row) => row?.text) ? `<div class="workout-next-plan"><div class="section-head"><h3>На следующий раз</h3><span class="chip">предложения</span></div>${workout.progression.filter((row) => row?.text).slice(0, 6).map((row) => `<div class="workout-next-row ${escapeAttr(row.kind || 'same')}"><span>${row.kind === 'increase' ? '↗' : row.kind === 'reduce' ? '↘' : '→'}</span><div><strong>${escapeHTML(row.exerciseName || getExercise(row.exerciseId)?.name || 'Упражнение')}</strong><small>${escapeHTML(row.text)}</small>${row.reason ? `<em>${escapeHTML(row.reason)}</em>` : ''}</div></div>`).join('')}</div>` : ''}
      <button class="button primary full" data-close type="button" style="margin-top:16px">Готово</button>
    `);
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
    workout.progression = workout.exercises.map((result) => postWorkoutSuggestion(result, workout));
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
    workoutExerciseUi.focusedIndex = null;
    workoutExerciseUi.expandedQueued.clear();
    clearInterval(state.workoutClockInterval);
    stopRestTimer();
    closeModal();
    navigate('home');
    syncPushAutomationSettings({ silent: true }).catch((error) => console.warn('Push schedule sync after workout failed', error));
    window.setTimeout(() => showWorkoutSummaryModal(workout), 140);
  }


  let workoutStickySyncFrame = 0;

  function scheduleWorkoutStickyOffsetSync() {
    if (state.route !== 'workout') return;
    if (workoutStickySyncFrame) cancelAnimationFrame(workoutStickySyncFrame);
    workoutStickySyncFrame = requestAnimationFrame(() => {
      workoutStickySyncFrame = 0;
      const topbar = document.querySelector('.topbar');
      const header = document.querySelector('.sport-workout-header');
      if (!topbar || !header) return;
      const stickyTop = Math.max(0, Math.ceil(topbar.getBoundingClientRect().bottom));
      header.style.setProperty('--workout-sticky-top', `${stickyTop}px`);
    });
  }

  function updateWorkoutClock() {
    const clock = document.getElementById('workout-clock');
    if (!clock || !state.currentWorkout) return;
    const elapsed = formatDuration(elapsedSeconds(state.currentWorkout.startedAt));
    clock.textContent = elapsed;
    updateWorkoutLiveBannerLabel(elapsed);
  }

  function updateWorkoutProgress() {
    if (!state.currentWorkout) return;
    const pct = workoutCompletion(state.currentWorkout);
    const text = document.getElementById('workout-progress-text');
    const bar = document.getElementById('workout-progress-bar');
    const banner = document.getElementById('workout-live-banner');
    const ring = document.getElementById('workout-progress-ring');
    const ringText = document.getElementById('workout-progress-ring-text');
    const count = document.getElementById('workout-progress-count');
    const remaining = document.getElementById('workout-remaining-time');
    if (text) text.textContent = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;
    if (ring) ring.style.setProperty('--workout-progress', `${pct * 3.6}deg`);
    if (ringText) ringText.textContent = `${pct}%`;
    if (count) {
      const focusIndex = workoutFocusedExerciseIndex();
      count.textContent = `Упражнение ${focusIndex >= 0 ? focusIndex + 1 : state.currentWorkout.exercises.length} из ${state.currentWorkout.exercises.length}`;
    }
    if (remaining) remaining.textContent = `≈ ${workoutEstimatedRemainingMinutes()} мин`;
    if (banner) banner.classList.toggle('complete', pct >= 100);
    updateWorkoutLiveBannerLabel();
  }

  function updateWorkoutLiveBannerLabel(elapsedText = null) {
    const banner = document.getElementById('workout-live-banner');
    if (!banner || !state.currentWorkout) return;
    const clockText = elapsedText || document.getElementById('workout-clock')?.textContent || '00:00';
    const pct = workoutCompletion(state.currentWorkout);
    banner.setAttribute('aria-label', `Время тренировки ${clockText}, выполнено ${pct} процентов`);
  }

  function startRestTimer(seconds, nextLabel) {
    stopRestTimer(false);
    if (state.settings.soundEnabled) prepareTimerAudio().catch(() => {});
    state.timer.seconds = Number(seconds) || 60;
    state.timer.endsAt = Date.now() + state.timer.seconds * 1000;
    state.timer.nextLabel = nextLabel || '';
    state.timer.lastAnnouncedSecond = null;
    el.timerOverlay.hidden = false;
    el.timerNext.textContent = state.timer.nextLabel;
    renderTimer();
    announceTimerCountdown(state.timer.seconds);
    state.timer.interval = setInterval(() => {
      syncTimerFromEnd();
      if (state.timer.seconds <= 0) timerDone();
    }, 250);
  }

  function syncTimerFromEnd() {
    if (!state.timer.endsAt) return;
    state.timer.seconds = Math.max(0, Math.ceil((state.timer.endsAt - Date.now()) / 1000));
    renderTimer();
    announceTimerCountdown(state.timer.seconds);
  }

  function adjustTimer(delta) {
    state.timer.seconds = Math.max(0, state.timer.seconds + delta);
    state.timer.endsAt = Date.now() + state.timer.seconds * 1000;
    if (state.timer.seconds > 3) state.timer.lastAnnouncedSecond = null;
    renderTimer();
    announceTimerCountdown(state.timer.seconds);
    if (state.timer.seconds <= 0) timerDone();
  }

  function renderTimer() {
    el.timerValue.textContent = formatDuration(state.timer.seconds);
  }

  function announceTimerCountdown(seconds) {
    const currentSecond = Number(seconds);
    if (!state.settings.soundEnabled || !state.settings.countdownSoundEnabled) return;
    if (currentSecond < 1 || currentSecond > 3 || state.timer.lastAnnouncedSecond === currentSecond) return;
    state.timer.lastAnnouncedSecond = currentSecond;
    playTimerSound('countdown');
  }

  function timerDone() {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.seconds = 0;
    state.timer.endsAt = null;
    state.timer.lastAnnouncedSecond = null;
    renderTimer();
    if (state.settings.vibrationEnabled && navigator.vibrate) navigator.vibrate([180, 80, 180]);
    if (state.settings.soundEnabled) playTimerSound('complete');
    setTimeout(() => stopRestTimer(), 900);
  }

  function stopRestTimer(hide = true) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.endsAt = null;
    state.timer.lastAnnouncedSecond = null;
    if (hide) el.timerOverlay.hidden = true;
  }

  function timerVolumePercent() {
    const value = Number(state.settings.timerVolume);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 70;
  }

  function getTimerAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!timerAudioContext || timerAudioContext.state === 'closed') {
      timerAudioContext = new AudioContextClass();
      timerAudioPrimed = false;
    }
    return timerAudioContext;
  }

  async function prepareTimerAudio({ force = false } = {}) {
    if (!force && !state.settings.soundEnabled) return null;
    const ctx = getTimerAudioContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') await ctx.resume();
    if (!timerAudioPrimed && ctx.state === 'running') {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, Math.max(8000, Math.round(ctx.sampleRate || 44100)));
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      source.connect(gain).connect(ctx.destination);
      source.start();
      timerAudioPrimed = true;
    }
    return ctx.state === 'running' ? ctx : null;
  }

  function scheduleTimerTone(ctx, {
    frequency,
    delay = 0,
    duration = 0.16,
    level = 1,
    type = 'square',
    overtone = true,
  }) {
    const volume = timerVolumePercent() / 100;
    if (!ctx || volume <= 0) return;

    const startAt = ctx.currentTime + Math.max(0.01, Number(delay) || 0);
    const finishAt = startAt + Math.max(0.08, Number(duration) || 0.16);
    // На iPhone прежние синусоиды на 660–1040 Гц звучали слишком тихо.
    // Нелинейная шкала, более высокая частота и дополнительная гармоника
    // делают сигнал заметным через встроенный динамик, не затрагивая системную громкость.
    const perceptualVolume = Math.pow(volume, 0.62);
    const peak = Math.min(0.92, Math.max(0.015, 0.82 * perceptualVolume * level));
    const attackEnd = Math.min(finishAt - 0.025, startAt + 0.012);

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, attackEnd);
    gain.gain.setValueAtTime(peak, Math.max(attackEnd, finishAt - 0.045));
    gain.gain.exponentialRampToValueAtTime(0.0001, finishAt);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(finishAt + 0.025);

    if (overtone) {
      const harmonic = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(frequency * 1.5, startAt);
      harmonicGain.gain.setValueAtTime(0.0001, startAt);
      harmonicGain.gain.exponentialRampToValueAtTime(Math.max(0.008, peak * 0.34), attackEnd);
      harmonicGain.gain.setValueAtTime(Math.max(0.008, peak * 0.34), Math.max(attackEnd, finishAt - 0.045));
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);
      harmonic.connect(harmonicGain).connect(ctx.destination);
      harmonic.start(startAt);
      harmonic.stop(finishAt + 0.025);
    }
  }

  async function playTimerSound(kind, { force = false } = {}) {
    if (!force && !state.settings.soundEnabled) return false;
    try {
      const ctx = await prepareTimerAudio({ force });
      if (!ctx) return false;
      if (kind === 'countdown') {
        scheduleTimerTone(ctx, { frequency: 1500, duration: 0.17, level: 0.82, type: 'square' });
      } else if (kind === 'complete') {
        scheduleTimerTone(ctx, { frequency: 1250, duration: 0.23, level: 1, type: 'square' });
        scheduleTimerTone(ctx, { frequency: 1850, delay: 0.28, duration: 0.34, level: 1, type: 'square' });
      } else if (kind === 'test') {
        scheduleTimerTone(ctx, { frequency: 1500, duration: 0.17, level: 0.82, type: 'square' });
        scheduleTimerTone(ctx, { frequency: 1500, delay: 0.44, duration: 0.17, level: 0.82, type: 'square' });
        scheduleTimerTone(ctx, { frequency: 1500, delay: 0.88, duration: 0.17, level: 0.82, type: 'square' });
        scheduleTimerTone(ctx, { frequency: 1250, delay: 1.36, duration: 0.23, level: 1, type: 'square' });
        scheduleTimerTone(ctx, { frequency: 1850, delay: 1.64, duration: 0.34, level: 1, type: 'square' });
      }
      return true;
    } catch (error) {
      console.warn('Timer audio unavailable', error);
      return false;
    }
  }

  function syncTimerSoundControls() {
    const enabled = Boolean(state.settings.soundEnabled);
    const countdown = document.getElementById('countdown-sound-toggle');
    const volume = document.getElementById('timer-volume');
    const test = document.getElementById('test-timer-sound');
    if (countdown) countdown.disabled = !enabled;
    if (volume) volume.disabled = !enabled;
    if (test) test.disabled = !enabled;
  }

  async function testTimerSound() {
    const button = document.getElementById('test-timer-sound');
    const status = document.getElementById('timer-sound-status');
    if (!state.settings.soundEnabled) {
      toast('Сначала включи звук таймера');
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Проверяем…';
    }
    if (status) status.textContent = 'Сейчас прозвучат три коротких сигнала и двойной финальный.';
    const played = await playTimerSound('test', { force: true });
    if (!played) {
      if (status) status.textContent = 'iPhone не дал запустить звук. Нажми кнопку ещё раз и проверь громкость устройства.';
      toast('Не удалось запустить звук');
    }
    window.setTimeout(() => {
      if (button) {
        button.textContent = 'Проверить звук';
        button.disabled = !state.settings.soundEnabled;
      }
      if (status && played) status.textContent = 'Если услышал последовательность — таймер готов.';
    }, 2100);
  }

  function renderPlanDayCard(day, index, currentIndex) {
    const exercises = day.exercises || [];
    const isCurrent = index === currentIndex;
    const isRest = Boolean(day.restDay);
    const previewCount = 4;
    const preview = exercises.slice(0, previewCount);
    const hiddenCount = Math.max(0, exercises.length - previewCount);
    const exerciseMini = (entry, i) => {
      const exercise = getExercise(entry.exerciseId);
      return `
        <div class="premium-exercise-mini">
          <span>${i + 1}</span>
          <div>
            <strong>${escapeHTML(exercise?.name || entry.exerciseId)}</strong>
            <small>${workPrescription(exercise, entry)}</small>
          </div>
          <em>${escapeHTML(exercise?.equipment || '')}</em>
        </div>`;
    };
    return `
      <article class="card premium-plan-day ${isCurrent ? 'current' : ''} ${day.recovery ? 'recovery' : ''} ${isRest ? 'rest-day' : ''}">
        <div class="premium-plan-day-head">
          <div class="premium-plan-day-main">
            <div class="premium-day-badge">${index + 1}</div>
            <div class="premium-plan-day-title">
              <div class="eyebrow">${isCurrent ? (isRest ? 'Текущий день · отдых' : 'Текущий день') : isRest ? 'Полный отдых' : day.recovery ? 'Восстановление' : 'День цикла'}</div>
              <h3>${escapeHTML(day.name)}</h3>
              <div class="premium-day-stats">
                ${isRest ? '<span>○ без тренировки</span><span>восстановление</span>' : `<span>◷ ≈ ${day.durationMin || 0} мин</span><span>${exercises.length} упр.</span>`}
                ${day.focus ? `<span>${escapeHTML(day.focus)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="premium-day-order-actions">
            <button class="mini-button move-program-day" data-index="${index}" data-delta="-1" type="button" aria-label="Поднять день ${index + 1}" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="mini-button move-program-day" data-index="${index}" data-delta="1" type="button" aria-label="Опустить день ${index + 1}" ${index === (getActiveProgram()?.days?.length || 1) - 1 ? 'disabled' : ''}>↓</button>
            <button class="mini-button edit-day" data-index="${index}" type="button" aria-label="Редактировать день ${index + 1}">✎</button>
          </div>
        </div>

        ${isRest ? `
          <div class="program-rest-plan-note">
            <span>○</span>
            <div><strong>Запланирован полный отдых</strong><small>Этот день разрывает нагрузку между соседними тренировками и двигает цикл после отметки.</small></div>
          </div>
        ` : exercises.length ? `
          <div class="premium-day-preview">
            ${preview.map((entry, i) => exerciseMini(entry, i)).join('')}
          </div>
          ${hiddenCount ? `
            <details class="premium-plan-all">
              <summary>Показать все упражнения · ещё ${hiddenCount}</summary>
              <div class="premium-day-preview all">
                ${exercises.map((entry, i) => exerciseMini(entry, i)).join('')}
              </div>
            </details>` : ''}
        ` : '<div class="empty compact-empty"><strong>День пустой</strong>Нажми карандаш и добавь упражнения.</div>'}

        <div class="premium-plan-day-footer">
          <button class="button primary small start-specific" data-index="${index}" type="button">${isRest ? 'Отметить отдых' : 'Начать'}</button>
          <button class="button ghost small set-current-day" data-index="${index}" type="button">${isCurrent ? 'Уже текущий' : 'Сделать текущим'}</button>
        </div>
      </article>`;
  }

  function renderMovementTabs(active = 'overview') {
    return `
      <section class="section movement-tabs-section">
        <div class="movement-tabs" role="tablist" aria-label="Разделы движения">
          ${[
            ['overview', 'movement', 'Обзор'],
            ['plan', 'plan', 'План'],
            ['history', 'history', 'История'],
          ].map(([id, route, label]) => `<button class="${active === id ? 'active' : ''}" data-movement-route="${route}" type="button">${label}</button>`).join('')}
        </div>
      </section>`;
  }

  function bindMovementTabs() {
    el.main.querySelectorAll('[data-movement-route]').forEach((button) => {
      button.addEventListener('click', () => navigate(button.dataset.movementRoute));
    });
  }

  function renderMovementWeek() {
    const start = startOfWeek(new Date());
    const labels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    return labels.map((label, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const iso = localDateISO(date);
      const rows = state.workouts.filter((workout) => localDateISO(new Date(workout.startedAt || workout.date || 0)) === iso);
      const trained = rows.some((workout) => isTrainingWorkout(workout));
      const recovered = rows.some((workout) => isRecoveryWorkout(workout) || isManualDayEntry(workout));
      const isToday = iso === todayISO();
      return `<div class="movement-week-day ${trained ? 'done' : ''} ${recovered ? 'recovery' : ''} ${isToday ? 'today' : ''}"><span>${label}</span><strong>${trained ? '✓' : date.getDate()}</strong></div>`;
    }).join('');
  }

  function renderMovement() {
    const { program, day, index } = getCurrentDay();
    const choices = getProgramChoices();
    const draft = state.currentWorkout?.status === 'in_progress' ? state.currentWorkout : null;
    const programDraft = storedProgramBuilderDraft();
    const scheduleStatus = trainingScheduleStatus(program);
    const isProgramRestDay = Boolean(day?.restDay);

    setTopbar('Движение', 'Тренировки, план и история');
    el.main.innerHTML = `
      <div class="rezhim-movement">
        ${renderMovementTabs('overview')}

        ${draft ? `
          <section class="section">
            <article class="card movement-draft-card">
              <span class="eyebrow">Тренировка уже идёт</span>
              <h2>${escapeHTML(draft.dayName)}</h2>
              <p>${workoutCompletion(draft)}% выполнено · ${formatDuration(elapsedSeconds(draft.startedAt))}</p>
              <button class="button primary full" id="movement-resume-workout" type="button">Продолжить</button>
            </article>
          </section>
        ` : `
          <section class="section">
            <article class="card movement-next-card ${isProgramRestDay ? 'rest' : ''}">
              <div class="movement-next-top"><span class="eyebrow">${isProgramRestDay ? 'Следующий шаг' : 'Следующая тренировка'}</span><span class="rezhim-time-chip">Цикл ${index + 1}/${program.days.length}</span></div>
              <h2>${escapeHTML(day?.name || 'Тренировка')}</h2>
              <p>${isProgramRestDay ? 'Полный отдых по программе' : escapeHTML(day?.focus || program.description || scheduleStatus.detail)}</p>
              <div class="movement-next-meta"><span>≈ ${Number(day?.durationMin || 0)} мин</span><span>${day?.exercises?.length || 0} упражнений</span></div>
              ${isProgramRestDay
                ? '<button class="button movement-primary full" id="movement-complete-rest" type="button">Отметить отдых</button>'
                : '<button class="button movement-primary full" id="movement-start-workout" type="button">Начать</button>'}
            </article>
          </section>
        `}

        <section class="section">
          <div class="section-head rezhim-section-head"><h2>Эта неделя</h2></div>
          <div class="card movement-week-card">${renderMovementWeek()}</div>
        </section>

        <section class="section">
          <div class="section-head rezhim-section-head"><h2>Быстрый старт</h2></div>
          <div class="movement-quick-grid">
            <button id="movement-custom-workout" type="button"><span class="green">＋</span><strong>Своя тренировка</strong><small>Собрать на сегодня</small></button>
            <button id="movement-smart-workout" type="button"><span class="purple">✦</span><strong>Подобрать тренировку</strong><small>По мышцам и времени</small></button>
            <button id="movement-short-workout" type="button"><span class="orange">⚡</span><strong>Короткая тренировка</strong><small>15–20 минут</small></button>
          </div>
        </section>

        <section class="section">
          <div class="section-head rezhim-section-head"><h2>Мои программы</h2><button class="link-button" data-movement-route="plan" type="button">Все</button></div>
          <div class="movement-program-list">
            ${choices.slice(0, 4).map((choice) => {
              const active = choice.id === program.id;
              const days = choice.days || [];
              return `<button class="card movement-program-card ${active ? 'active' : ''}" data-movement-program="${escapeAttr(choice.id)}" type="button">
                <span class="movement-program-badge">${active ? `${index + 1}/${Math.max(days.length, 1)}` : days.length}</span>
                <span><strong>${escapeHTML(choice.name)}</strong><small>${active ? 'Текущая программа' : `${days.length} дней в цикле`}</small></span>
                <b>›</b>
              </button>`;
            }).join('')}
            <button class="movement-create-program ${programDraft ? 'has-draft' : ''}" id="movement-new-program" type="button">
              <span>＋</span><strong>${programDraft ? 'Продолжить черновик программы' : 'Создать программу'}</strong>
            </button>
          </div>
        </section>
      </div>
    `;

    bindMovementTabs();
    document.getElementById('movement-resume-workout')?.addEventListener('click', () => navigate('workout'));
    document.getElementById('movement-start-workout')?.addEventListener('click', () => startWorkout({ shortMode: false, startMode: 'cycle', shouldAdvanceCycle: true }));
    document.getElementById('movement-complete-rest')?.addEventListener('click', () => completeProgramRestDay(index));
    document.getElementById('movement-custom-workout')?.addEventListener('click', () => showCustomWorkoutBuilderModal());
    document.getElementById('movement-smart-workout')?.addEventListener('click', () => showSmartWorkoutBuilderModal({ target: 'custom' }));
    document.getElementById('movement-short-workout')?.addEventListener('click', () => startWorkout({ shortMode: true, startMode: 'cycle', shouldAdvanceCycle: true }));
    document.getElementById('movement-new-program')?.addEventListener('click', showNewProgramModal);
    el.main.querySelectorAll('[data-movement-program]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.dataset.movementProgram === getActiveProgram()?.id) {
          navigate('plan');
          return;
        }
        await switchProgram(button.dataset.movementProgram);
      });
    });
  }

  function renderPlan() {
    const active = getActiveProgram();
    const programChoices = getProgramChoices();
    const programDraft = storedProgramBuilderDraft();
    const days = active.days || [];
    const currentIndex = days.length ? Math.min(Number(state.settings.currentDayIndex || 0), Math.max(days.length - 1, 0)) : 0;
    const currentDay = days[currentIndex] || null;
    const totalExercises = days.reduce((sum, day) => sum + ((day.exercises || []).length), 0);
    const totalMinutes = days.reduce((sum, day) => sum + Number(day.durationMin || 0), 0);
    const recoveryDays = days.filter((day) => day.recovery).length;
    const programWarnings = programRecoveryWarnings(days);
    const cycleProgress = days.length ? Math.round(((currentIndex + 1) / days.length) * 100) : 0;
    setTopbar('Движение', 'Тренировки, план и история');
    el.main.innerHTML = `
      ${renderMovementTabs('plan')}
      <section class="section premium-program-strip">
        <div class="tabs program-tabs premium-program-tabs">
          ${programChoices.map((program) => `<button class="tab ${program.id === active.id ? 'active' : ''} switch-program" data-id="${program.id}" title="${escapeAttr(program.name)}">${escapeHTML(program.name)}</button>`).join('')}
          <button class="tab tab-create ${programDraft ? 'has-draft' : ''}" id="open-program-builder" type="button">${programDraft ? '✎ Черновик' : '＋ Создать'}</button>
        </div>
      </section>

      <section class="section">
        <div class="card premium-plan-hero">
          <div class="premium-plan-hero-top">
            <div>
              <div class="eyebrow">Активная программа</div>
              <h2>${escapeHTML(active.name)}</h2>
            </div>
            <div class="premium-plan-ring" aria-label="Прогресс цикла"><strong>${cycleProgress}%</strong><span>цикл</span></div>
          </div>
          <p>${escapeHTML(active.description || 'Пустая программа-конструктор: добавь дни и упражнения под себя.')}</p>

          <div class="premium-plan-stat-grid">
            <div><span>Дней</span><strong>${days.length}</strong><small>в цикле</small></div>
            <div><span>Сейчас</span><strong>${currentDay ? currentIndex + 1 : '—'}</strong><small>${currentDay ? escapeHTML(currentDay.name) : 'добавь день'}</small></div>
            <div><span>Объём</span><strong>${totalExercises}</strong><small>упр. · ${totalMinutes} мин</small></div>
          </div>

          ${days.length ? `
            <div class="premium-plan-day-pills" aria-label="Дни цикла">
              ${days.map((day, index) => `<button class="premium-plan-day-pill ${index === currentIndex ? 'current' : ''} ${day.recovery ? 'recovery' : ''} set-current-day" data-index="${index}" type="button"><span>${index + 1}</span><strong>${escapeHTML(day.name)}</strong></button>`).join('')}
            </div>
          ` : `<div class="notice">В программе пока нет дней. Добавь первый день и собери тренировку под себя.</div>`}

          ${programWarnings.length ? `
            <button class="program-recovery-banner" id="open-program-warnings" type="button">
              <span>⚠️</span>
              <div><strong>Проверь восстановление мышц</strong><small>${programWarnings.length} совпаден${programWarnings.length === 1 ? 'ие' : programWarnings.length < 5 ? 'ия' : 'ий'} нагрузки в соседних днях · это не блокировка</small></div>
              <b>›</b>
            </button>
          ` : ''}

          <div class="premium-plan-actions">
            <button class="button secondary" id="edit-program" type="button">Редактировать программу</button>
            <button class="button secondary" id="add-program-day" type="button">Добавить день</button>
            <button class="button primary" id="new-program" type="button">${programDraft ? 'Продолжить черновик программы' : 'Создать программу с нуля'}</button>
          </div>
          <div class="help premium-plan-help">${programDraft ? `Черновик «${escapeHTML(String(programDraft.name || 'Моя программа').trim() || 'Без названия')}» сохранён и откроется с шага ${programDraft.step + 1}. ` : ''}В «Редактировать программу» можно открыть любой день, добавить или убрать упражнения и сохранить весь план отдельным вариантом.</div>
        </div>
      </section>

      <section class="section">
        <div class="section-head premium-section-head">
          <div><h2>Дни цикла</h2><div class="help">Компактный вид: главное видно сразу, полный список раскрывается внутри дня.</div></div>
          ${recoveryDays ? `<span class="chip">${recoveryDays} восстановл.</span>` : ''}
        </div>
        <div class="premium-plan-days">
          ${days.length ? days.map((day, index) => renderPlanDayCard(day, index, currentIndex)).join('') : '<div class="card empty"><strong>План пока пустой</strong>Нажми «Добавить день» или создай новую программу.</div>'}
        </div>
      </section>
    `;
    bindMovementTabs();
    el.main.querySelectorAll('.switch-program').forEach((button) => button.addEventListener('click', () => switchProgram(button.dataset.id)));
    el.main.querySelectorAll('.set-current-day').forEach((button) => button.addEventListener('click', () => setCurrentDay(Number(button.dataset.index))));
    el.main.querySelectorAll('.start-specific').forEach((button) => button.addEventListener('click', async () => {
      const index = Number(button.dataset.index);
      const selectedDay = active.days[index];
      await setCurrentDay(index, false);
      if (selectedDay?.restDay) await completeProgramRestDay(index);
      else startWorkout(false);
    }));
    el.main.querySelectorAll('.edit-day').forEach((button) => button.addEventListener('click', () => showEditDayModal(Number(button.dataset.index))));
    el.main.querySelectorAll('.move-program-day').forEach((button) => button.addEventListener('click', () => requestMoveProgramDay(Number(button.dataset.index), Number(button.dataset.delta))));
    document.getElementById('edit-program').addEventListener('click', showEditProgramModal);
    document.getElementById('add-program-day').addEventListener('click', addProgramDay);
    document.getElementById('new-program').addEventListener('click', showNewProgramModal);
    document.getElementById('open-program-builder').addEventListener('click', showNewProgramModal);
    document.getElementById('open-program-warnings')?.addEventListener('click', () => showProgramRecoveryWarningModal({
      warnings: programWarnings,
      title: 'Проверка соседних дней',
      detail: 'Программа нашла повторную нагрузку на одни и те же мышцы без отдельного дня отдыха.',
      confirmLabel: 'Понятно',
      cancelLabel: '',
    }));
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
    if (state.route === 'movement') renderMovement();
    else renderPlan();
  }

  async function setCurrentDay(index, rerender = true) {
    state.settings.currentDayIndex = index;
    await DB.setSettingsObject({ currentDayIndex: index }, state.activeProfileId);
    if (rerender) {
      if (state.route === 'movement') renderMovement();
      else renderPlan();
    }
    toast(`Текущий день: ${index + 1}`);
  }



  function programDayMuscleSets(day) {
    const totals = new Map();
    if (!day || day.recovery) return totals;
    for (const entry of day?.exercises || []) {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) continue;
      const sets = Math.max(1, Number(entry.sets ?? exercise.defaults?.sets ?? 1));
      for (const groupId of getMuscleGroupsForExercise(exercise, entry)) {
        totals.set(groupId, (totals.get(groupId) || 0) + sets);
      }
    }
    return totals;
  }

  function programRecoveryWarnings(days = []) {
    const warnings = [];
    const pairs = [];
    for (let index = 0; index < days.length - 1; index += 1) pairs.push([index, index + 1, false]);
    if (days.length > 2) pairs.push([days.length - 1, 0, true]);

    for (const [leftIndex, rightIndex, cycleBoundary] of pairs) {
      const leftDay = days[leftIndex];
      const rightDay = days[rightIndex];
      const left = programDayMuscleSets(leftDay);
      const right = programDayMuscleSets(rightDay);
      for (const [groupId, leftSets] of left.entries()) {
        const rightSets = right.get(groupId) || 0;
        if (leftSets < 3 || rightSets < 3) continue;
        warnings.push({
          key: `${leftIndex}:${rightIndex}:${groupId}`,
          groupId,
          label: muscleGroupLabel(groupId),
          leftIndex,
          rightIndex,
          leftDay: leftDay?.name || `День ${leftIndex + 1}`,
          rightDay: rightDay?.name || `День ${rightIndex + 1}`,
          leftSets,
          rightSets,
          cycleBoundary,
          severity: leftSets >= 6 && rightSets >= 6 ? 'high' : 'watch',
        });
      }
    }
    return warnings;
  }

  function programMoveWarnings(days, movedIndexes = []) {
    const affected = new Set(movedIndexes);
    return programRecoveryWarnings(days).filter((warning) => affected.has(warning.leftIndex) || affected.has(warning.rightIndex));
  }

  function renderProgramWarningRows(warnings) {
    return warnings.map((warning) => `
      <div class="list-row program-warning-row">
        <div class="list-row-main">
          <div class="list-row-title">⚠️ ${escapeHTML(warning.label)} два дня подряд</div>
          <div class="list-row-sub">${escapeHTML(warning.leftDay)} — ${warning.leftSets} подх. · ${escapeHTML(warning.rightDay)} — ${warning.rightSets} подх.${warning.cycleBoundary ? '<br>Эти дни соседствуют при повторении цикла.' : ''}</div>
        </div>
        <span class="chip ${warning.severity === 'high' ? 'warning' : ''}">${warning.severity === 'high' ? 'высокая' : 'проверить'}</span>
      </div>
    `).join('');
  }

  function showProgramRecoveryWarningModal({
    warnings,
    title = 'Есть риск недовосстановления',
    detail = 'Одна и та же мышечная группа получает заметную нагрузку два тренировочных дня подряд.',
    confirmLabel = 'Сохранить всё равно',
    cancelLabel = 'Вернуться',
    onConfirm = null,
    onCancel = null,
  }) {
    if (!warnings?.length) return;
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Проверка программы</div><h2>${escapeHTML(title)}</h2></div><button class="modal-close" id="close-program-warning" type="button">×</button></div>
      <div class="notice warning"><strong>Это предупреждение, а не запрет.</strong><br>${escapeHTML(detail)}</div>
      <div class="card list-card program-warning-list" style="margin-top:12px">${renderProgramWarningRows(warnings)}</div>
      <div class="${cancelLabel ? 'button-row' : ''}" style="margin-top:14px">
        ${cancelLabel ? `<button class="button ghost" id="cancel-program-warning" type="button">${escapeHTML(cancelLabel)}</button>` : ''}
        <button class="button primary ${cancelLabel ? '' : 'full'}" id="confirm-program-warning" type="button">${escapeHTML(confirmLabel)}</button>
      </div>
      <div class="help" style="margin-top:10px">Если оставляешь дни рядом, снизь объём или интенсивность во второй день и следи за самочувствием.</div>
    `);
    document.getElementById('close-program-warning')?.addEventListener('click', () => {
      closeModal();
      if (onCancel) onCancel();
    });
    document.getElementById('cancel-program-warning')?.addEventListener('click', () => {
      closeModal();
      if (onCancel) onCancel();
    });
    document.getElementById('confirm-program-warning')?.addEventListener('click', async () => {
      if (onConfirm) await onConfirm();
      else closeModal();
    });
  }

  async function requestMoveProgramDay(index, delta) {
    const program = await ensurePersonalActiveProgram();
    const target = index + delta;
    if (target < 0 || target >= program.days.length) return;
    const nextDays = [...program.days];
    [nextDays[index], nextDays[target]] = [nextDays[target], nextDays[index]];
    const warnings = programMoveWarnings(nextDays, [index, target]);
    const applyMove = async () => {
      program.days = nextDays;
      const current = Number(state.settings.currentDayIndex || 0);
      if (current === index) state.settings.currentDayIndex = target;
      else if (current === target) state.settings.currentDayIndex = index;
      program.updatedAt = new Date().toISOString();
      await Promise.all([DB.put('programs', program), DB.setSettingsObject({ currentDayIndex: state.settings.currentDayIndex }, state.activeProfileId)]);
      closeModal();
      renderPlan();
      toast(`День перемещён на позицию ${target + 1}`);
    };
    if (!warnings.length) return applyMove();
    showProgramRecoveryWarningModal({
      warnings,
      title: 'После перестановки мышцы идут подряд',
      detail: 'Новый порядок ставит заметную нагрузку на одну и ту же группу в соседние тренировочные дни.',
      confirmLabel: 'Всё равно переместить',
      cancelLabel: 'Оставить как было',
      onConfirm: applyMove,
    });
  }

  async function addProgramDay() {
    const program = await ensurePersonalActiveProgram();
    program.days.push({ id: uid('day'), name: `День ${program.days.length + 1}`, durationMin: 45, focus: '', exercises: [], short: [] });
    program.updatedAt = new Date().toISOString();
    await DB.put('programs', program);
    renderPlan();
    toast('Новый тренировочный день добавлен');
  }

  async function duplicateActiveProgram({ name = '', description = '' } = {}) {
    const active = getActiveProgram();
    const copy = clone(active);
    copy.id = uid('program');
    copy.name = name.trim() || `${active.name} — вариант`;
    copy.description = description.trim() || active.description || '';
    copy.createdAt = new Date().toISOString();
    copy.ownerProfileId = state.activeProfileId;
    copy.sourceTemplateId = active.templateId || active.sourceTemplateId || (isProgramTemplate(active) ? active.id : null);
    delete copy.templateId;
    copy.updatedAt = copy.createdAt;
    copy.days = copy.days.map((day) => ({ ...day, id: uid('day') }));
    await DB.put('programs', copy);
    state.programs.push(copy);
    state.allPrograms.push(copy);
    closeModal();
    await switchProgram(copy.id);
    toast(`Новая программа «${copy.name}» сохранена`);
  }

  function showEditProgramModal() {
    const active = getActiveProgram();
    const suggestedCopyName = `${active.name} — вариант`;
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Редактор программы</div><h2>${escapeHTML(active.name)}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="notice"><strong>Здесь редактируется вся программа.</strong><br>Открой нужный день ниже: там можно добавлять, убирать и переставлять упражнения, а также менять подходы, повторы, вес и отдых.</div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Название текущей программы</label><input id="edit-program-name" value="${escapeAttr(active.name)}" maxlength="80"></div>
        <div class="field"><label>Описание</label><textarea id="edit-program-description" maxlength="300">${escapeHTML(active.description || '')}</textarea></div>
        <div class="field"><label>Название нового варианта</label><input id="copy-program-name" value="${escapeAttr(suggestedCopyName)}" maxlength="80"></div>
      </div>
      <div class="section-head program-editor-days-head"><div><h2>Дни и упражнения</h2><div class="help">Нажми день, чтобы изменить его состав.</div></div></div>
      <div class="program-editor-days">
        ${(active.days || []).map((day, index) => `
          <button class="program-editor-day open-program-editor-day" data-index="${index}" type="button">
            <span>${index + 1}</span>
            <div><strong>${escapeHTML(day.name || `День ${index + 1}`)}</strong><small>${day.restDay ? 'Полный отдых' : `${day.exercises?.length || 0} упр. · ≈ ${day.durationMin || 0} мин`}</small></div>
            <b>${day.restDay ? '○' : 'Изменить ›'}</b>
          </button>
        `).join('')}
      </div>
      <div class="button-row" style="margin-top:14px">
        <button class="button secondary" id="save-program-info" type="button">Сохранить изменения</button>
        <button class="button primary" id="save-program-copy" type="button">Сохранить как новую</button>
      </div>
      <div class="help" style="margin-top:10px">«Сохранить как новую» не удаляет и не перезаписывает текущую программу: появится отдельный вариант, и приложение сразу откроет его.</div>
    `);
    el.modalRoot.querySelectorAll('.open-program-editor-day').forEach((button) => button.addEventListener('click', () => {
      closeModal();
      showEditDayModal(Number(button.dataset.index));
    }));
    document.getElementById('save-program-info').addEventListener('click', async () => {
      const name = document.getElementById('edit-program-name').value.trim();
      if (!name) return toast('Введи название программы');
      active.name = name;
      active.description = document.getElementById('edit-program-description').value.trim();
      active.updatedAt = new Date().toISOString();
      await DB.put('programs', active);
      closeModal();
      renderPlan();
      toast('Изменения программы сохранены');
    });
    document.getElementById('save-program-copy').addEventListener('click', async () => {
      const name = document.getElementById('copy-program-name').value.trim();
      if (!name) return toast('Введи название нового варианта');
      await duplicateActiveProgram({
        name,
        description: document.getElementById('edit-program-description').value.trim(),
      });
    });
  }

  function programBuilderGroupPatterns(count) {
    const patterns = {
      1: [['legs', 'chest', 'back', 'abs']],
      2: [['chest', 'back', 'shoulders', 'triceps'], ['legs', 'glutes', 'abs']],
      3: [['chest', 'back', 'shoulders', 'triceps'], ['legs', 'glutes', 'abs'], ['back', 'chest', 'biceps', 'abs']],
      4: [['chest', 'shoulders', 'triceps'], ['legs', 'glutes', 'abs'], ['back', 'biceps', 'shoulders'], ['legs', 'chest', 'triceps', 'abs']],
      5: [['chest', 'shoulders', 'triceps'], ['back', 'biceps'], ['legs', 'glutes', 'abs'], ['chest', 'back', 'shoulders'], ['glutes', 'legs', 'biceps', 'triceps']],
      6: [['chest', 'shoulders', 'triceps'], ['back', 'biceps'], ['legs', 'glutes', 'abs'], ['chest', 'shoulders', 'triceps'], ['back', 'biceps', 'abs'], ['legs', 'glutes']],
      7: [['chest', 'shoulders', 'triceps'], ['back', 'biceps'], ['legs', 'glutes', 'abs'], ['chest', 'back'], ['shoulders', 'biceps', 'triceps'], ['legs', 'glutes'], ['abs', 'back', 'chest']],
    };
    return patterns[count] || patterns[4];
  }

  function programBuilderDefaultDuration() {
    const allowed = [20, 30, 45, 60, 75, 90];
    const preferred = Number(state.profile?.trainingPreferences?.durationMin || state.settings.workoutDurationMin || 45);
    return allowed.reduce((best, value) => Math.abs(value - preferred) < Math.abs(best - preferred) ? value : best, 45);
  }

  function createProgramBuilderDay(index, count, duration = programBuilderDefaultDuration()) {
    const pattern = programBuilderGroupPatterns(count);
    return {
      type: 'training',
      name: '',
      groups: [...(pattern[index] || ['legs', 'chest', 'back', 'abs'])],
      customizedGroups: false,
      duration,
      intensity: 'normal',
      energy: 'normal',
      exercises: [],
      exercisesCustomized: false,
    };
  }

  function syncProgramBuilderDays(draft, count) {
    const nextCount = Math.max(1, Math.min(7, Number(count) || 4));
    const previous = Array.isArray(draft.days) ? draft.days : [];
    draft.dayCount = nextCount;
    draft.days = Array.from({ length: nextCount }, (_, index) => {
      const current = previous[index];
      const defaults = createProgramBuilderDay(index, nextCount, draft.defaultDuration);
      if (!current) return defaults;
      return {
        ...defaults,
        ...current,
        type: current.type === 'rest' ? 'rest' : 'training',
        groups: current.customizedGroups ? [...(current.groups || [])] : defaults.groups,
      };
    });
    draft.step = Math.min(Number(draft.step || 0), nextCount + 1);
  }

  function defaultProgramBuilderDraft() {
    const dayCount = 4;
    const defaultDuration = programBuilderDefaultDuration();
    const now = new Date().toISOString();
    return {
      version: 4,
      step: 0,
      name: 'Моя программа',
      description: '',
      dayCount,
      defaultDuration,
      days: Array.from({ length: dayCount }, (_, index) => createProgramBuilderDay(index, dayCount, defaultDuration)),
      createdAt: now,
      updatedAt: now,
    };
  }

  function normalizeProgramBuilderDraft(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const base = defaultProgramBuilderDraft();
    const dayCount = Math.max(1, Math.min(7, Number(raw.dayCount) || base.dayCount));
    const allowedGroups = new Set(muscleGroups.map((group) => group.id));
    const defaultDuration = Number(raw.defaultDuration) || base.defaultDuration;
    const draft = {
      ...base,
      ...clone(raw),
      version: 4,
      dayCount,
      defaultDuration,
      name: String(raw.name ?? base.name),
      description: String(raw.description || ''),
      createdAt: raw.createdAt || base.createdAt,
      updatedAt: raw.updatedAt || base.updatedAt,
    };
    draft.days = Array.from({ length: dayCount }, (_, index) => {
      const defaults = createProgramBuilderDay(index, dayCount, defaultDuration);
      const saved = Array.isArray(raw.days) ? raw.days[index] : null;
      if (!saved || typeof saved !== 'object') return defaults;
      const groups = Array.isArray(saved.groups) ? saved.groups.filter((groupId) => allowedGroups.has(groupId)) : defaults.groups;
      const exercises = Array.isArray(saved.exercises)
        ? saved.exercises.map((entry) => {
          if (typeof entry === 'string') return { exerciseId: entry };
          if (!entry || typeof entry !== 'object' || !String(entry.exerciseId || '').trim()) return null;
          return { ...clone(entry), exerciseId: String(entry.exerciseId).trim() };
        }).filter(Boolean)
        : [];
      return {
        ...defaults,
        ...saved,
        type: saved.type === 'rest' || saved.restDay ? 'rest' : 'training',
        name: String(saved.name || ''),
        groups: [...groups],
        customizedGroups: Boolean(saved.customizedGroups),
        duration: Number(saved.duration) || defaultDuration,
        intensity: ['light', 'normal', 'dense'].includes(saved.intensity) ? saved.intensity : 'normal',
        energy: ['fresh', 'normal', 'tired'].includes(saved.energy) ? saved.energy : 'normal',
        exercises,
        exercisesCustomized: Boolean(saved.exercisesCustomized),
      };
    });
    draft.step = Math.max(0, Math.min(dayCount + 1, Number(raw.step) || 0));
    return draft;
  }

  function storedProgramBuilderDraft() {
    return normalizeProgramBuilderDraft(state.settings?.programBuilderDraft);
  }

  let programBuilderDraftSaveTimer = null;

  function clearProgramBuilderDraftSaveTimer() {
    if (programBuilderDraftSaveTimer) clearTimeout(programBuilderDraftSaveTimer);
    programBuilderDraftSaveTimer = null;
  }

  async function persistProgramBuilderDraft(draft = state.programBuilder) {
    if (!draft || !state.activeProfileId) return null;
    const snapshot = normalizeProgramBuilderDraft(draft);
    if (!snapshot) return null;
    snapshot.updatedAt = new Date().toISOString();
    draft.updatedAt = snapshot.updatedAt;
    state.settings.programBuilderDraft = clone(snapshot);
    await DB.setSettingsObject({ programBuilderDraft: snapshot }, state.activeProfileId);
    return snapshot;
  }

  function debounceProgramBuilderDraftSave() {
    clearProgramBuilderDraftSaveTimer();
    const profileId = state.activeProfileId;
    const draft = state.programBuilder;
    if (!profileId || !draft) return;
    programBuilderDraftSaveTimer = setTimeout(async () => {
      programBuilderDraftSaveTimer = null;
      if (state.activeProfileId !== profileId || state.programBuilder !== draft) return;
      try {
        await persistProgramBuilderDraft(draft);
      } catch (error) {
        console.error('Program builder autosave failed', error);
        toast('Не удалось автоматически сохранить программу');
      }
    }, 300);
  }

  async function flushProgramBuilderDraftSave() {
    clearProgramBuilderDraftSaveTimer();
    if (!state.programBuilder) return;
    if (el.modalRoot.querySelector('.program-builder-modal')) readProgramBuilderInputs();
    await persistProgramBuilderDraft(state.programBuilder);
  }

  async function clearProgramBuilderDraft() {
    clearProgramBuilderDraftSaveTimer();
    state.settings.programBuilderDraft = null;
    await DB.setSettingsObject({ programBuilderDraft: null }, state.activeProfileId);
  }

  function programBuilderEnergyLabel(value) {
    return ({ fresh: 'бодр', normal: 'нормально', tired: 'устал' })[value] || 'нормально';
  }

  function programBuilderSuggestedDayName(day, index) {
    if (day.type === 'rest') return `День ${index + 1}: отдых`;
    const labels = (day.groups || []).map(muscleGroupLabel).filter(Boolean);
    return labels.length ? `День ${index + 1}: ${labels.slice(0, 3).join(' + ')}` : `День ${index + 1}`;
  }

  function programBuilderAutoProposal(dayConfig, index, draft) {
    return buildSmartWorkoutProposal({
      target: 'custom',
      selectedGroups: [...(dayConfig.groups || [])],
      duration: Number(dayConfig.duration || draft.defaultDuration || 45),
      intensity: dayConfig.intensity || 'normal',
      energy: dayConfig.energy || 'normal',
    }, index + 11);
  }

  function programBuilderResolvedExercises(dayConfig, index, draft) {
    if (dayConfig.exercisesCustomized) return clone(dayConfig.exercises || []);
    const proposal = programBuilderAutoProposal(dayConfig, index, draft);
    return clone(proposal.day?.exercises || []);
  }

  function buildProgramFromBuilderDraft(draft, preview = false) {
    const now = new Date().toISOString();
    const proposals = draft.days.map((dayConfig, index) => {
      if (dayConfig.type === 'rest') {
        const day = {
          id: preview ? `program-preview-rest-${index + 1}` : uid('day'),
          name: String(dayConfig.name || '').trim() || programBuilderSuggestedDayName(dayConfig, index),
          durationMin: 0,
          focus: 'Полный отдых и восстановление',
          recovery: true,
          restDay: true,
          exercises: [],
          short: [],
          builderSettings: {
            type: 'rest',
            groups: [],
            durationMin: 0,
            intensity: null,
            energy: null,
          },
        };
        return { day, proposal: null, type: 'rest' };
      }
      const proposal = programBuilderAutoProposal(dayConfig, index, draft);
      const day = clone(proposal.day);
      const customized = Boolean(dayConfig.exercisesCustomized);
      if (customized) day.exercises = clone(dayConfig.exercises || []);
      day.id = preview ? `program-preview-day-${index + 1}` : uid('day');
      day.name = String(dayConfig.name || '').trim() || programBuilderSuggestedDayName(dayConfig, index);
      day.focus = (dayConfig.groups || []).map(muscleGroupLabel).join(', ');
      day.durationMin = Number(dayConfig.duration || 45);
      day.short = (day.exercises || []).slice(0, Math.min(5, day.exercises.length)).map((entry) => entry.exerciseId);
      day.builderSettings = {
        type: 'training',
        groups: [...(dayConfig.groups || [])],
        durationMin: day.durationMin,
        intensity: dayConfig.intensity || 'normal',
        energy: dayConfig.energy || 'normal',
        exercisesCustomized: customized,
      };
      return { day, proposal, type: 'training', customized };
    });
    const days = proposals.map((item) => item.day);
    const trainingItems = proposals.filter((item) => item.type === 'training');
    const restCount = proposals.length - trainingItems.length;
    const trainingDayIssues = trainingItems.map((item) => {
      const index = proposals.indexOf(item);
      const exercises = Array.isArray(item.day.exercises) ? item.day.exercises : [];
      const workExercises = exercises.filter((entry) => entry.exerciseId !== 'warmup-joints');
      return {
        index,
        dayNumber: index + 1,
        name: item.day.name || `День ${index + 1}`,
        exerciseCount: exercises.length,
        workExerciseCount: workExercises.length,
        customized: Boolean(item.customized),
        canStart: Boolean(item.customized || item.proposal?.canStart),
      };
    });
    const blockingDays = trainingDayIssues.filter((issue) => issue.workExerciseCount < 1);
    const shortDays = trainingDayIssues.filter((issue) => (
      issue.workExerciseCount >= 1
      && !issue.customized
      && (!issue.canStart || issue.exerciseCount < 4)
    ));
    const averageDuration = trainingItems.length
      ? Math.round(trainingItems.reduce((sum, item) => sum + Number(item.day.durationMin || 0), 0) / trainingItems.length)
      : 0;
    const program = {
      id: preview ? 'program-builder-preview' : uid('program'),
      name: String(draft.name || '').trim() || 'Моя программа',
      description: String(draft.description || '').trim()
        || `${draft.dayCount} дн. в свободном цикле · ${trainingItems.length} тренировочн. · ${restCount} отдых · в среднем ${averageDuration} мин`,
      ownerProfileId: state.activeProfileId,
      generatedBy: 'program-builder-v4',
      scheduleMode: 'cycle',
      daysPerWeek: null,
      createdAt: now,
      updatedAt: now,
      builderSettings: {
        version: 4,
        dayCount: draft.dayCount,
        days: draft.days.map((day) => ({
          type: day.type === 'rest' ? 'rest' : 'training',
          name: String(day.name || '').trim(),
          groups: day.type === 'rest' ? [] : [...(day.groups || [])],
          duration: day.type === 'rest' ? 0 : Number(day.duration || 45),
          intensity: day.type === 'rest' ? null : day.intensity || 'normal',
          energy: day.type === 'rest' ? null : day.energy || 'normal',
          exercisesCustomized: day.type === 'rest' ? false : Boolean(day.exercisesCustomized),
          exercises: day.type === 'rest' || !day.exercisesCustomized ? [] : clone(day.exercises || []),
        })),
      },
      days,
    };
    return {
      program,
      proposals,
      warnings: programRecoveryWarnings(days),
      trainingCount: trainingItems.length,
      restCount,
      blockingDays,
      shortDays,
      canSave: trainingItems.length > 0 && !blockingDays.length,
    };
  }

  function readProgramBuilderInputs(root = el.modalRoot) {
    const draft = state.programBuilder;
    if (!draft) return;
    if (draft.step === 0) {
      const nameInput = root.querySelector('#program-builder-name');
      const descriptionInput = root.querySelector('#program-builder-description');
      if (nameInput) draft.name = nameInput.value;
      if (descriptionInput) draft.description = descriptionInput.value;
      return;
    }
    if (draft.step >= 1 && draft.step <= draft.dayCount) {
      const day = draft.days[draft.step - 1];
      const nameInput = root.querySelector('#program-builder-day-name');
      if (nameInput) day.name = nameInput.value;
    }
  }

  function renderProgramBuilderBasics(draft) {
    return `
      <div class="program-builder-stack">
        <div class="notice success"><strong>Это именно программа, а не разовая тренировка.</strong><br>Черновик сохраняется автоматически. Можно выйти и продолжить позже с того же шага.</div>
        <div class="field"><label>Название программы</label><input id="program-builder-name" value="${escapeAttr(draft.name)}" maxlength="80"></div>
        <div class="field"><label>Описание, необязательно</label><textarea id="program-builder-description" maxlength="300" placeholder="Например: свободный цикл с упором на форму и пресс">${escapeHTML(draft.description || '')}</textarea></div>
        <div class="profile-builder-question"><strong>Сколько всего дней в цикле</strong><span>включая отдых · от 1 до 7</span></div>
        <div class="day-count-picker program-day-count-picker" id="program-day-count-picker">
          ${[1,2,3,4,5,6,7].map((count) => `<button class="day-count-option ${count === draft.dayCount ? 'active' : ''}" data-program-day-count="${count}" type="button">${count}</button>`).join('')}
        </div>
        <div class="help">Дальше каждый день можно сделать тренировкой или полным отдыхом. Цикл идёт по порядку: день 1 → день 2 → дальше.</div>
      </div>`;
  }

  function renderProgramBuilderDay(draft, index) {
    const day = draft.days[index];
    const isRest = day.type === 'rest';
    const fullBody = ['legs', 'chest', 'back', 'abs'];
    const fullSelected = fullBody.every((groupId) => day.groups.includes(groupId)) && day.groups.length === fullBody.length;
    const resolvedExercises = isRest ? [] : programBuilderResolvedExercises(day, index, draft);
    const exercisePreview = resolvedExercises.slice(0, 5);
    return `
      <div class="program-builder-stack">
        <div class="program-builder-day-heading">
          <span class="day-badge">${index + 1}</span>
          <div><strong>Настрой день ${index + 1} из ${draft.dayCount}</strong><small>${isRest ? 'Он разрывает нагрузку между соседними тренировками.' : 'Состав упражнений можно изменить прямо сейчас или позже в «Плане».'}</small></div>
        </div>
        <div class="program-builder-day-type" role="group" aria-label="Тип дня ${index + 1}">
          <button class="program-day-type-option ${isRest ? '' : 'active'}" data-program-day-type="training" type="button"><b>🏋️</b><span><strong>Тренировка</strong><small>Мышцы, время и нагрузка</small></span></button>
          <button class="program-day-type-option ${isRest ? 'active' : ''}" data-program-day-type="rest" type="button"><b>○</b><span><strong>Отдых</strong><small>Без тренировки и нагрузки</small></span></button>
        </div>
        <div class="field"><label>Название дня, необязательно</label><input id="program-builder-day-name" value="${escapeAttr(day.name || '')}" placeholder="${escapeAttr(programBuilderSuggestedDayName(day, index))}" maxlength="80"></div>
        ${isRest ? `
          <div class="program-builder-rest-card">
            <span>○</span>
            <div><strong>Полный день отдыха</strong><p>Упражнения не добавляются. В плане этот день будет отдельным, а повторная нагрузка через него уже не считается двумя тренировками подряд.</p></div>
          </div>
        ` : `
          <div class="smart-builder-label"><strong>Какие мышцы тренируем</strong><span>можно несколько</span></div>
          <button class="smart-target-auto program-builder-full-body ${fullSelected ? 'active' : ''}" id="program-builder-full-body" type="button"><span>◎</span><div><strong>Всё тело</strong><small>Ноги, грудь, спина и пресс</small></div><b>✓</b></button>
          <div class="smart-muscle-multi-grid program-builder-muscles" role="group" aria-label="Мышцы дня ${index + 1}">
            ${muscleGroups.map((group) => `<button class="smart-muscle-option ${day.groups.includes(group.id) ? 'active' : ''}" data-program-muscle="${group.id}" type="button"><strong>${escapeHTML(group.label)}</strong><small>${escapeHTML(group.hint)}</small><span>✓</span></button>`).join('')}
          </div>
          <div class="smart-selection-summary"><strong>Выбрано: ${day.groups.length}</strong><span>${escapeHTML(day.groups.map(muscleGroupLabel).join(' + ') || 'Выбери хотя бы одну группу')}</span></div>
          <div class="smart-builder-section">
            <div class="smart-builder-label"><strong>Сколько времени</strong><span>для этого дня</span></div>
            <div class="smart-option-row duration-long" data-program-options="duration">
              ${[20,30,45,60,75,90].map((value) => `<button class="smart-option ${value === Number(day.duration) ? 'active' : ''}" data-value="${value}" type="button">${value} мин</button>`).join('')}
            </div>
          </div>
          <div class="smart-builder-section">
            <div class="smart-builder-label"><strong>Интенсивность</strong><span>объём и плотность</span></div>
            <div class="smart-option-row" data-program-options="intensity">
              <button class="smart-option ${day.intensity === 'light' ? 'active' : ''}" data-value="light" type="button">Лёгкая</button>
              <button class="smart-option ${day.intensity === 'normal' ? 'active' : ''}" data-value="normal" type="button">Обычная</button>
              <button class="smart-option ${day.intensity === 'dense' ? 'active' : ''}" data-value="dense" type="button">Плотная</button>
            </div>
          </div>
          <div class="smart-builder-section">
            <div class="smart-builder-label"><strong>На какое состояние рассчитан день</strong><span>как в умной тренировке</span></div>
            <div class="smart-option-row" data-program-options="energy">
              <button class="smart-option ${day.energy === 'fresh' ? 'active' : ''}" data-value="fresh" type="button">Бодр</button>
              <button class="smart-option ${day.energy === 'normal' ? 'active' : ''}" data-value="normal" type="button">Нормально</button>
              <button class="smart-option ${day.energy === 'tired' ? 'active' : ''}" data-value="tired" type="button">Устал</button>
            </div>
          </div>
          <section class="program-builder-exercise-summary">
            <div class="program-builder-exercise-summary-head">
              <div><strong>Упражнения этого дня</strong><small>${day.exercisesCustomized ? 'Ручной состав — автоподбор больше его не меняет' : 'Автоподбор по мышцам, времени и оборудованию'}</small></div>
              <span>${resolvedExercises.length} упр.</span>
            </div>
            <div class="program-builder-exercise-mini-list">
              ${exercisePreview.length ? exercisePreview.map((entry, exerciseIndex) => {
                const exercise = getExercise(entry.exerciseId);
                return `<div><span>${exerciseIndex + 1}</span><strong>${escapeHTML(exercise?.name || entry.exerciseId)}</strong><small>${escapeHTML(workPrescription(exercise, entry))}</small></div>`;
              }).join('') : '<div class="program-builder-exercise-empty"><strong>Список пока пуст</strong><small>Добавь хотя бы одно упражнение.</small></div>'}
              ${resolvedExercises.length > exercisePreview.length ? `<p>Ещё ${resolvedExercises.length - exercisePreview.length} упр.</p>` : ''}
            </div>
            <div class="program-builder-exercise-summary-actions">
              <button class="button secondary full edit-program-builder-exercises" data-index="${index}" type="button">Добавить / убрать упражнения</button>
              ${day.exercisesCustomized ? `<button class="button ghost full reset-program-builder-exercises" data-index="${index}" type="button">Вернуть автоподбор</button>` : ''}
            </div>
          </section>
          <div class="notice"><strong>Оборудование берём из профиля.</strong><br>Боль и фактическое самочувствие приложение ещё раз проверит перед запуском тренировки.</div>
        `}
      </div>`;
  }

  function renderProgramBuilderPreview(draft) {
    const built = buildProgramFromBuilderDraft(draft, true);
    const blockingText = built.blockingDays.map((issue) => `день ${issue.dayNumber}`).join(', ');
    const shortText = built.shortDays.map((issue) => (
      `день ${issue.dayNumber} — ${issue.exerciseCount} упр.`
    )).join(' · ');
    return `
      <div class="program-builder-preview">
        <div class="profile-builder-summary">
          <div><span>Программа</span><strong>${escapeHTML(built.program.name)}</strong></div>
          <div><span>Дней</span><strong>${built.program.days.length} в цикле</strong></div>
          <div><span>Состав</span><strong>${built.trainingCount} трен. · ${built.restCount} отдых</strong></div>
          <div><span>Проверка</span><strong>${built.warnings.length ? `${built.warnings.length} предупрежд.` : 'Всё спокойно'}</strong></div>
        </div>
        ${built.warnings.length
          ? `<div class="notice warning program-builder-preview-warning"><strong>Есть повторная нагрузка в соседние дни.</strong><br>При сохранении приложение покажет мышцы и позволит либо вернуться, либо сохранить всё равно.</div>`
          : '<div class="notice success program-builder-preview-warning"><strong>Явной перетренированности по соседним дням не найдено.</strong><br>После создания программа останется полностью редактируемой.</div>'}
        ${!built.trainingCount ? '<div class="notice danger"><strong>В программе пока только отдых.</strong><br>Вернись хотя бы к одному дню и выбери «Тренировка».</div>' : ''}
        ${built.blockingDays.length ? `<div class="notice danger"><strong>Без рабочих упражнений: ${escapeHTML(blockingText)}.</strong><br>Такой тренировочный день сохранить нельзя. Открой его и добавь упражнение либо сделай днём отдыха.</div>` : ''}
        ${built.shortDays.length ? `<div class="notice warning"><strong>Некоторые дни получились короче заданного.</strong><br>${escapeHTML(shortText)}. Их можно сохранить как есть — приложение попросит подтверждение.</div>` : ''}
        <div class="profile-builder-days program-builder-preview-days">
          ${built.program.days.map((day, index) => {
            const config = draft.days[index];
            if (config.type === 'rest') {
              return `<article class="program-builder-preview-day rest">
                <div class="program-builder-rest-preview">
                  <span class="day-badge small-badge">${index + 1}</span>
                  <div><strong>${escapeHTML(day.name)}</strong><small>Полный отдых · без упражнений и силовой нагрузки</small></div>
                  <b>○</b>
                </div>
                <button class="button ghost small full edit-program-builder-day" data-index="${index}" type="button">Изменить день ${index + 1}</button>
              </article>`;
            }
            return `<article class="program-builder-preview-day">
              <details class="profile-builder-day" ${index === 0 ? 'open' : ''}>
                <summary><span class="day-badge small-badge">${index + 1}</span><span><strong>${escapeHTML(day.name)}</strong><small>≈ ${day.durationMin} мин · ${day.exercises.length} упр. · ${config.exercisesCustomized ? 'ручной состав' : 'автоподбор'} · ${escapeHTML(smartIntensityLabel(config.intensity))}</small></span><b>⌄</b></summary>
                <div>${day.exercises.map((entry, exerciseIndex) => { const exercise = getExercise(entry.exerciseId); return `<p><span>${exerciseIndex + 1}</span><strong>${escapeHTML(exercise?.name || entry.exerciseId)}</strong><small>${escapeHTML(workPrescription(exercise, entry))}</small></p>`; }).join('')}</div>
              </details>
              <div class="program-builder-preview-actions">
                <button class="button ghost small edit-program-builder-day" data-index="${index}" type="button">Настройки дня</button>
                <button class="button secondary small edit-program-builder-exercises" data-index="${index}" type="button">Упражнения</button>
              </div>
            </article>`;
          }).join('')}
        </div>
        <div class="notice success program-builder-save-destination"><strong>После сохранения откроется «План».</strong><br>Программа появится там отдельным вариантом и сразу станет активной.</div>
      </div>`;
  }

  function programBuilderExerciseEntries(draft, dayIndex) {
    const day = draft.days[dayIndex];
    if (!day || day.type === 'rest') return [];
    return day.exercisesCustomized
      ? clone(day.exercises || [])
      : programBuilderResolvedExercises(day, dayIndex, draft);
  }

  function applyProgramBuilderExerciseEntries(dayIndex, entries, { customized = true, rerender = true } = {}) {
    const draft = state.programBuilder;
    const day = draft?.days?.[dayIndex];
    if (!draft || !day || day.type === 'rest') return;
    day.exercises = customized ? clone(entries || []) : [];
    day.exercisesCustomized = Boolean(customized);
    debounceProgramBuilderDraftSave();
    if (rerender) renderProgramBuilderExerciseEditor(dayIndex);
  }

  function renderProgramBuilderExerciseEditor(dayIndex) {
    const draft = state.programBuilder;
    const day = draft?.days?.[dayIndex];
    if (!draft || !day) return;
    if (day.type === 'rest') {
      draft.step = dayIndex + 1;
      renderProgramBuilderModal();
      return;
    }
    const entries = programBuilderExerciseEntries(draft, dayIndex);
    showModal(`
      <div class="modal-head">
        <div><div class="eyebrow">Своя программа · день ${dayIndex + 1}</div><h2>Упражнения дня</h2></div>
        <button class="modal-close" data-close aria-label="Сохранить черновик и выйти">×</button>
      </div>
      <div class="notice"><strong>${day.exercisesCustomized ? 'Ручной состав' : 'Сейчас показан автоподбор'}.</strong><br>Добавляй, убирай и переставляй упражнения. Карандаш меняет подходы, повторы, вес и отдых.</div>
      <div class="program-builder-exercise-editor-meta">
        <span>${entries.length} упр.</span>
        <strong>${escapeHTML(String(day.name || '').trim() || programBuilderSuggestedDayName(day, dayIndex))}</strong>
      </div>
      <div class="card list-card program-builder-exercise-editor-list" id="program-builder-exercise-editor-list">
        ${entries.length ? entries.map((entry, entryIndex) => {
          const exercise = getExercise(entry.exerciseId);
          return `<div class="list-row program-builder-exercise-editor-row" data-entry-index="${entryIndex}" data-exercise-id="${escapeAttr(entry.exerciseId)}">
            <span class="program-builder-exercise-index">${entryIndex + 1}</span>
            <div class="list-row-main">
              <div class="list-row-title">${escapeHTML(exercise?.name || entry.exerciseId)}</div>
              <div class="list-row-sub">${escapeHTML(workPrescription(exercise, entry))} · отдых ${entry.restSec ?? exercise?.defaults?.restSec ?? 0} сек</div>
            </div>
            <div class="row-actions">
              <button class="mini-button program-builder-exercise-up" type="button" aria-label="Поднять упражнение" ${entryIndex === 0 ? 'disabled' : ''}>↑</button>
              <button class="mini-button program-builder-exercise-down" type="button" aria-label="Опустить упражнение" ${entryIndex === entries.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="mini-button program-builder-exercise-edit" type="button" aria-label="Настроить упражнение">✎</button>
              <button class="mini-button program-builder-exercise-remove" type="button" aria-label="Убрать упражнение">×</button>
            </div>
          </div>`;
        }).join('') : '<div class="empty"><strong>В этом дне пока нет упражнений</strong>Нажми кнопку ниже и добавь хотя бы одно.</div>'}
      </div>
      <button class="button secondary full" id="add-program-builder-exercise" type="button" style="margin-top:12px">＋ Добавить упражнение</button>
      ${day.exercisesCustomized ? '<button class="button ghost full" id="restore-program-builder-auto-exercises" type="button" style="margin-top:8px">Вернуть автоматический подбор</button>' : ''}
      <div class="program-builder-exercise-editor-actions">
        <button class="button ghost" id="back-to-program-builder-day" type="button">Назад к дню</button>
        <button class="button primary" id="save-program-builder-exercises" type="button">Готово</button>
      </div>
      <div class="help center">Изменения входят в автосохраняемый черновик программы.</div>
    `);
    el.modalRoot.querySelector('.modal')?.classList.add('program-builder-modal', 'program-builder-exercises-modal');

    const commitEntries = (nextEntries) => applyProgramBuilderExerciseEntries(dayIndex, nextEntries);
    el.modalRoot.querySelectorAll('.program-builder-exercise-editor-row').forEach((row) => {
      const entryIndex = Number(row.dataset.entryIndex);
      row.querySelector('.program-builder-exercise-up')?.addEventListener('click', () => {
        if (entryIndex <= 0) return;
        const next = clone(entries);
        [next[entryIndex - 1], next[entryIndex]] = [next[entryIndex], next[entryIndex - 1]];
        commitEntries(next);
      });
      row.querySelector('.program-builder-exercise-down')?.addEventListener('click', () => {
        if (entryIndex >= entries.length - 1) return;
        const next = clone(entries);
        [next[entryIndex + 1], next[entryIndex]] = [next[entryIndex], next[entryIndex + 1]];
        commitEntries(next);
      });
      row.querySelector('.program-builder-exercise-remove')?.addEventListener('click', () => {
        const next = clone(entries);
        next.splice(entryIndex, 1);
        commitEntries(next);
      });
      row.querySelector('.program-builder-exercise-edit')?.addEventListener('click', async () => {
        if (!day.exercisesCustomized) {
          day.exercises = clone(entries);
          day.exercisesCustomized = true;
          await persistProgramBuilderDraft(draft);
        }
        showProgramBuilderExerciseSettings(dayIndex, entryIndex);
      });
    });
    document.getElementById('add-program-builder-exercise')?.addEventListener('click', async () => {
      await persistProgramBuilderDraft(draft);
      showExercisePicker((exerciseId) => {
        const current = programBuilderExerciseEntries(draft, dayIndex);
        if (current.some((entry) => entry.exerciseId === exerciseId)) {
          toast('Это упражнение уже есть в дне');
          renderProgramBuilderExerciseEditor(dayIndex);
          return;
        }
        const exercise = getExercise(exerciseId);
        current.push({ exerciseId, sets: Math.max(1, Number(exercise?.defaults?.sets || 3)) });
        applyProgramBuilderExerciseEntries(dayIndex, current);
      }, () => renderProgramBuilderExerciseEditor(dayIndex));
    });
    document.getElementById('restore-program-builder-auto-exercises')?.addEventListener('click', () => {
      applyProgramBuilderExerciseEntries(dayIndex, [], { customized: false });
      toast('Автоматический подбор восстановлен');
    });
    document.getElementById('back-to-program-builder-day')?.addEventListener('click', async () => {
      await persistProgramBuilderDraft(draft);
      draft.step = dayIndex + 1;
      renderProgramBuilderModal();
    });
    document.getElementById('save-program-builder-exercises')?.addEventListener('click', async () => {
      if (!entries.length) return toast('Добавь хотя бы одно упражнение');
      await persistProgramBuilderDraft(draft);
      draft.step = dayIndex + 1;
      renderProgramBuilderModal();
      toast('Состав дня сохранён в черновик');
    });
  }

  function showProgramBuilderExerciseSettings(dayIndex, entryIndex) {
    const draft = state.programBuilder;
    const day = draft?.days?.[dayIndex];
    const entry = day?.exercises?.[entryIndex];
    if (!draft || !day || !entry) return renderProgramBuilderExerciseEditor(dayIndex);
    const exercise = getExercise(entry.exerciseId);
    const defaults = { ...(exercise?.defaults || {}), ...entry };
    showModal(`
      <div class="modal-head"><h2>${escapeHTML(exercise?.name || entry.exerciseId)}</h2><button class="modal-close" id="back-from-program-builder-entry" type="button">×</button></div>
      <div class="notice"><strong>Настройки только для этого дня.</strong><br>Оригинал упражнения в библиотеке не изменится.</div>
      <div class="form-grid" style="margin-top:14px">
        <div class="inline-fields three">
          <div class="field"><label>Подходы</label><input id="program-entry-sets" type="number" min="1" max="10" value="${defaults.sets || 1}"></div>
          <div class="field"><label>Повторы от</label><input id="program-entry-reps-min" type="number" min="0" value="${defaults.repsMin || 0}"></div>
          <div class="field"><label>До</label><input id="program-entry-reps-max" type="number" min="0" value="${defaults.repsMax || defaults.repsMin || 0}"></div>
        </div>
        <div class="inline-fields">
          <div class="field"><label>Рабочий вес, кг</label><input id="program-entry-weight" type="number" step="0.5" min="0" value="${defaults.weightKg ?? ''}"></div>
          <div class="field"><label>Отдых, сек</label><input id="program-entry-rest" type="number" min="0" value="${defaults.restSec || 0}"></div>
        </div>
      </div>
      <div class="button-row" style="margin-top:14px">
        <button class="button ghost" id="cancel-program-builder-entry" type="button">Назад</button>
        <button class="button primary" id="save-program-builder-entry" type="button">Применить</button>
      </div>
    `);
    el.modalRoot.querySelector('.modal')?.classList.add('program-builder-modal');
    const back = () => renderProgramBuilderExerciseEditor(dayIndex);
    document.getElementById('back-from-program-builder-entry')?.addEventListener('click', back);
    document.getElementById('cancel-program-builder-entry')?.addEventListener('click', back);
    document.getElementById('save-program-builder-entry')?.addEventListener('click', async () => {
      Object.assign(entry, {
        sets: Math.max(1, Number(document.getElementById('program-entry-sets').value || 1)),
        repsMin: Math.max(0, Number(document.getElementById('program-entry-reps-min').value || 0)),
        repsMax: Math.max(0, Number(document.getElementById('program-entry-reps-max').value || 0)),
        weightKg: numberOrBlank(document.getElementById('program-entry-weight').value),
        restSec: Math.max(0, Number(document.getElementById('program-entry-rest').value || 0)),
      });
      await persistProgramBuilderDraft(draft);
      renderProgramBuilderExerciseEditor(dayIndex);
    });
  }

  function renderProgramBuilderModal() {
    const draft = state.programBuilder || defaultProgramBuilderDraft();
    state.programBuilder = draft;
    const totalSteps = draft.dayCount + 2;
    const isPreview = draft.step === draft.dayCount + 1;
    const title = draft.step === 0 ? 'Основа программы' : isPreview ? 'Проверь готовую программу' : `День ${draft.step}`;
    const subtitle = draft.step === 0
      ? 'Название и весь цикл вместе с отдыхом'
      : isPreview
        ? 'Упражнения уже подобраны, но всё можно изменить'
        : 'Сначала тип дня, затем его настройки';
    const content = draft.step === 0
      ? renderProgramBuilderBasics(draft)
      : isPreview
        ? renderProgramBuilderPreview(draft)
        : renderProgramBuilderDay(draft, draft.step - 1);
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Своя программа · шаг ${draft.step + 1} из ${totalSteps}</div><h2>${escapeHTML(title)}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="profile-builder-progress" aria-label="Шаг ${draft.step + 1} из ${totalSteps}"><span style="width:${Math.round(((draft.step + 1) / totalSteps) * 100)}%"></span></div>
      <p class="muted program-builder-subtitle">${escapeHTML(subtitle)}</p>
      ${content}
      <div class="profile-builder-actions program-builder-actions">
        ${draft.step > 0 ? '<button class="button ghost" id="program-builder-back" type="button">Назад</button>' : ''}
        <button class="button primary" id="${isPreview ? 'save-program-builder' : 'program-builder-next'}" type="button">${isPreview ? 'Сохранить программу' : 'Далее'}</button>
      </div>
      <div class="program-builder-draft-actions">
        <button class="button secondary" id="save-program-builder-draft" type="button">Сохранить черновик и выйти</button>
        <button class="button ghost" id="reset-program-builder-draft" type="button">Начать заново</button>
      </div>
      <div class="help center program-builder-autosave-note">Автосохранение включено · последнее изменение ${escapeHTML(formatUpdateTimestamp(draft.updatedAt))}</div>
    `);
    el.modalRoot.querySelector('.modal')?.classList.add('program-builder-modal');
    bindProgramBuilderEvents();
  }

  function bindProgramBuilderEvents() {
    const draft = state.programBuilder;
    if (!draft) return;
    el.modalRoot.querySelectorAll('[data-program-day-count]').forEach((button) => button.addEventListener('click', () => {
      readProgramBuilderInputs();
      syncProgramBuilderDays(draft, Number(button.dataset.programDayCount));
      debounceProgramBuilderDraftSave();
      renderProgramBuilderModal();
    }));
    if (draft.step >= 1 && draft.step <= draft.dayCount) {
      const day = draft.days[draft.step - 1];
      el.modalRoot.querySelectorAll('[data-program-day-type]').forEach((button) => button.addEventListener('click', () => {
        readProgramBuilderInputs();
        day.type = button.dataset.programDayType === 'rest' ? 'rest' : 'training';
        debounceProgramBuilderDraftSave();
        renderProgramBuilderModal();
      }));
      document.getElementById('program-builder-full-body')?.addEventListener('click', () => {
        readProgramBuilderInputs();
        day.groups = ['legs', 'chest', 'back', 'abs'];
        day.customizedGroups = true;
        debounceProgramBuilderDraftSave();
        renderProgramBuilderModal();
      });
      el.modalRoot.querySelectorAll('[data-program-muscle]').forEach((button) => button.addEventListener('click', () => {
        readProgramBuilderInputs();
        const groupId = button.dataset.programMuscle;
        const selected = new Set(day.groups || []);
        selected.has(groupId) ? selected.delete(groupId) : selected.add(groupId);
        day.groups = [...selected];
        day.customizedGroups = true;
        debounceProgramBuilderDraftSave();
        renderProgramBuilderModal();
      }));
      el.modalRoot.querySelectorAll('[data-program-options]').forEach((row) => {
        row.querySelectorAll('.smart-option').forEach((button) => button.addEventListener('click', () => {
          readProgramBuilderInputs();
          const key = row.dataset.programOptions;
          day[key] = key === 'duration' ? Number(button.dataset.value) : button.dataset.value;
          debounceProgramBuilderDraftSave();
          renderProgramBuilderModal();
        }));
      });
    }
    el.modalRoot.querySelectorAll('#program-builder-name, #program-builder-description, #program-builder-day-name').forEach((input) => {
      input.addEventListener('input', () => {
        readProgramBuilderInputs();
        debounceProgramBuilderDraftSave();
      });
    });
    document.getElementById('program-builder-back')?.addEventListener('click', () => {
      readProgramBuilderInputs();
      draft.step = Math.max(0, draft.step - 1);
      debounceProgramBuilderDraftSave();
      renderProgramBuilderModal();
    });
    document.getElementById('program-builder-next')?.addEventListener('click', () => {
      readProgramBuilderInputs();
      if (draft.step === 0 && !String(draft.name || '').trim()) return toast('Введи название программы');
      if (
        draft.step >= 1
        && draft.step <= draft.dayCount
        && draft.days[draft.step - 1].type !== 'rest'
        && !draft.days[draft.step - 1].groups.length
      ) return toast('Выбери хотя бы одну мышечную группу');
      if (
        draft.step >= 1
        && draft.step <= draft.dayCount
        && draft.days[draft.step - 1].type !== 'rest'
        && draft.days[draft.step - 1].exercisesCustomized
        && !draft.days[draft.step - 1].exercises.length
      ) return toast('Добавь хотя бы одно упражнение или верни автоподбор');
      draft.step = Math.min(draft.dayCount + 1, draft.step + 1);
      debounceProgramBuilderDraftSave();
      renderProgramBuilderModal();
    });
    el.modalRoot.querySelectorAll('.edit-program-builder-exercises').forEach((button) => button.addEventListener('click', async () => {
      readProgramBuilderInputs();
      await persistProgramBuilderDraft(draft);
      renderProgramBuilderExerciseEditor(Number(button.dataset.index));
    }));
    el.modalRoot.querySelectorAll('.reset-program-builder-exercises').forEach((button) => button.addEventListener('click', () => {
      const dayIndex = Number(button.dataset.index);
      applyProgramBuilderExerciseEntries(dayIndex, [], { customized: false, rerender: false });
      renderProgramBuilderModal();
      toast('Автоматический подбор восстановлен');
    }));
    el.modalRoot.querySelectorAll('.edit-program-builder-day').forEach((button) => button.addEventListener('click', () => {
      draft.step = Number(button.dataset.index) + 1;
      debounceProgramBuilderDraftSave();
      renderProgramBuilderModal();
    }));
    document.getElementById('save-program-builder')?.addEventListener('click', saveProgramBuilder);
    document.getElementById('save-program-builder-draft')?.addEventListener('click', saveProgramBuilderDraftAndExit);
    document.getElementById('reset-program-builder-draft')?.addEventListener('click', resetProgramBuilderDraft);
  }

  async function saveProgramBuilderDraftAndExit() {
    if (!state.programBuilder) return;
    readProgramBuilderInputs();
    const snapshot = await persistProgramBuilderDraft(state.programBuilder);
    state.programBuilder = null;
    closeModal();
    toast(`Черновик «${String(snapshot?.name || 'Моя программа').trim() || 'Без названия'}» сохранён`);
    if (state.route === 'home') renderHome();
    else if (state.route === 'plan') renderPlan();
    else if (state.route === 'movement') renderMovement();
  }

  async function resetProgramBuilderDraft() {
    if (!window.confirm('Удалить текущий черновик и начать программу заново? Уже заполненные дни восстановить не получится.')) return;
    await clearProgramBuilderDraft();
    state.programBuilder = defaultProgramBuilderDraft();
    await persistProgramBuilderDraft(state.programBuilder);
    renderProgramBuilderModal();
    toast('Открыт новый черновик программы');
  }

  function showProgramBuilderBlockingModal(built, draft) {
    const firstIssue = built.blockingDays?.[0] || null;
    const hasTraining = built.trainingCount > 0;
    const issueRows = (built.blockingDays || []).map((issue) => `
      <div class="list-row">
        <span class="day-badge small-badge">${issue.dayNumber}</span>
        <div class="list-row-main">
          <div class="list-row-title">${escapeHTML(issue.name)}</div>
          <div class="list-row-sub">Нет ни одного рабочего упражнения</div>
        </div>
      </div>
    `).join('');
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Сохранение программы</div><h2>${hasTraining ? 'Нужно исправить тренировочный день' : 'В программе только отдых'}</h2></div><button class="modal-close" id="close-program-builder-block" type="button">×</button></div>
      <div class="notice danger"><strong>Программа пока не готова к сохранению.</strong><br>${hasTraining ? 'Хотя бы одно рабочее упражнение нужно в каждом тренировочном дне.' : 'Сделай хотя бы один день тренировочным и добавь упражнения.'}</div>
      ${issueRows ? `<div class="card list-card" style="margin-top:12px">${issueRows}</div>` : ''}
      <div class="button-row" style="margin-top:14px">
        <button class="button ghost" id="back-to-program-builder-preview" type="button">Вернуться</button>
        <button class="button primary" id="edit-blocked-program-builder-day" type="button">${firstIssue ? `Исправить день ${firstIssue.dayNumber}` : 'Открыть день 1'}</button>
      </div>
    `);
    const back = () => {
      state.programBuilder = draft;
      renderProgramBuilderModal();
    };
    document.getElementById('close-program-builder-block')?.addEventListener('click', back);
    document.getElementById('back-to-program-builder-preview')?.addEventListener('click', back);
    document.getElementById('edit-blocked-program-builder-day')?.addEventListener('click', () => {
      state.programBuilder = draft;
      draft.step = firstIssue ? firstIssue.index + 1 : 1;
      debounceProgramBuilderDraftSave();
      renderProgramBuilderModal();
    });
  }

  function showProgramBuilderSaveConfirmation(built, draft, onConfirm) {
    const shortRows = (built.shortDays || []).map((issue) => `
      <div class="list-row">
        <span class="day-badge small-badge">${issue.dayNumber}</span>
        <div class="list-row-main">
          <div class="list-row-title">${escapeHTML(issue.name)}</div>
          <div class="list-row-sub">${issue.exerciseCount} упр. всего · ${issue.workExerciseCount} рабочих</div>
        </div>
        <span class="chip warning">короткий</span>
      </div>
    `).join('');
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">Проверка программы</div><h2>Сохранить программу как есть?</h2></div><button class="modal-close" id="close-program-builder-confirm" type="button">×</button></div>
      ${shortRows ? `
        <div class="notice warning"><strong>Некоторые дни короче выбранной длительности.</strong><br>В них есть рабочие упражнения, поэтому программа сохранится и останется редактируемой.</div>
        <div class="card list-card program-builder-short-day-list" style="margin-top:12px">${shortRows}</div>
      ` : ''}
      ${built.warnings.length ? `
        <div class="notice warning" style="margin-top:12px"><strong>Есть повторная нагрузка в соседние дни.</strong><br>Это предупреждение, а не запрет.</div>
        <div class="card list-card program-warning-list" style="margin-top:12px">${renderProgramWarningRows(built.warnings)}</div>
      ` : ''}
      <div class="button-row" style="margin-top:14px">
        <button class="button ghost" id="cancel-program-builder-confirm" type="button">Вернуться</button>
        <button class="button primary" id="confirm-program-builder-save" type="button">Сохранить всё равно</button>
      </div>
      <div class="help" style="margin-top:10px">Позже любой день и его упражнения можно изменить в разделе «План».</div>
    `);
    const back = () => {
      state.programBuilder = draft;
      renderProgramBuilderModal();
    };
    document.getElementById('close-program-builder-confirm')?.addEventListener('click', back);
    document.getElementById('cancel-program-builder-confirm')?.addEventListener('click', back);
    document.getElementById('confirm-program-builder-save')?.addEventListener('click', onConfirm);
  }

  async function saveProgramBuilder() {
    const draft = state.programBuilder;
    if (!draft) return;
    readProgramBuilderInputs();
    let built;
    try {
      await persistProgramBuilderDraft(draft);
      built = buildProgramFromBuilderDraft(draft, false);
    } catch (error) {
      console.error('Program builder preparation failed', error);
      toast('Не удалось подготовить программу к сохранению');
      return;
    }
    if (!built.canSave) {
      showProgramBuilderBlockingModal(built, draft);
      return;
    }
    const commit = async () => {
      const button = document.getElementById('confirm-program-builder-save')
        || document.getElementById('save-program-builder');
      if (button?.disabled) return;
      const originalLabel = button?.textContent || '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Сохраняю…';
      }
      const program = built.program;
      try {
        await DB.put('programs', program);
        state.programs = state.programs.filter((item) => item.id !== program.id);
        state.programs.push(program);
        state.allPrograms = state.allPrograms.filter((item) => item.id !== program.id);
        state.allPrograms.push(program);
        state.settings.activeProgramId = program.id;
        state.settings.currentDayIndex = 0;
        await DB.setSettingsObject({ activeProgramId: program.id, currentDayIndex: 0 }, state.activeProfileId);
        await clearProgramBuilderDraft();
        state.programBuilder = null;
        closeModal();
        navigate('plan');
        toast(`Программа «${program.name}» сохранена в «План»`);
      } catch (error) {
        console.error('Program builder save failed', error);
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
        toast('Не удалось сохранить программу. Черновик остался на месте');
      }
    };
    if (!built.warnings.length && !built.shortDays.length) {
      await commit();
      return;
    }
    showProgramBuilderSaveConfirmation(built, draft, commit);
  }

  function showNewProgramModal() {
    state.programBuilder = storedProgramBuilderDraft() || defaultProgramBuilderDraft();
    renderProgramBuilderModal();
  }

  function showEditDayModal(index, draftDay = null) {
    const program = getActiveProgram();
    const day = draftDay || clone(program.days[index]);
    day.exercises = Array.isArray(day.exercises) ? day.exercises : [];
    const isRest = Boolean(day.restDay);
    showModal(`
      <div class="modal-head"><h2>Редактор дня ${index + 1}</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Название</label><input id="edit-day-name" value="${escapeAttr(day.name)}"></div>
        <div class="program-builder-day-type edit-day-type" role="group" aria-label="Тип дня">
          <button class="program-day-type-option ${isRest ? '' : 'active'}" data-edit-day-type="training" type="button"><b>🏋️</b><span><strong>Тренировка</strong><small>Упражнения и нагрузка</small></span></button>
          <button class="program-day-type-option ${isRest ? 'active' : ''}" data-edit-day-type="rest" type="button"><b>○</b><span><strong>Отдых</strong><small>Без тренировки</small></span></button>
        </div>
        ${isRest ? `
          <div class="program-builder-rest-card">
            <span>○</span>
            <div><strong>Полный день отдыха</strong><p>Он будет отображаться отдельным днём цикла и не содержит упражнений.</p></div>
          </div>
        ` : `
          <div class="inline-fields"><div class="field"><label>Длительность, мин</label><input id="edit-day-duration" type="number" min="10" max="180" value="${day.durationMin}"></div><div class="field"><label>Акцент</label><input id="edit-day-focus" value="${escapeAttr(day.focus || '')}"></div></div>
        `}
      </div>
      ${isRest ? '' : `
        <div class="section-head edit-day-exercises-head" style="margin-top:18px"><div><h2>Упражнения</h2><div class="help">${day.exercises.length} в этом дне</div></div></div>
        <div class="help edit-day-exercises-help">↑↓ — порядок · ✎ — подходы, повторы, вес и отдых · × — убрать упражнение.</div>
        <div class="card list-card" id="edit-day-list">
          ${day.exercises.length ? day.exercises.map((entry, i) => editDayExerciseRow(entry, i)).join('') : '<div class="empty"><strong>День пустой</strong>Добавь упражнения из библиотеки.</div>'}
        </div>
        <button class="button secondary full" id="add-day-exercise" type="button" style="margin-top:10px">＋ Добавить упражнение</button>
      `}
      <button class="button primary full" id="save-day" style="margin-top:14px">Сохранить день</button>
      <button class="button danger full" id="delete-day" style="margin-top:10px">Удалить этот день</button>
    `);
    if (!isRest) bindEditDayList(day, index);
    document.getElementById('add-day-exercise')?.addEventListener('click', () => showExercisePicker((id) => {
      day.exercises.push({ exerciseId: id });
      closeModal();
      showEditDayModal(index, day);
    }));
    el.modalRoot.querySelectorAll('[data-edit-day-type]').forEach((button) => button.addEventListener('click', () => {
      const nextType = button.dataset.editDayType;
      if (nextType === 'rest' && !day.restDay) {
        if (day.exercises.length && !window.confirm('Сделать этот день отдыхом? Упражнения из него будут убраны.')) return;
        day.restDay = true;
        day.recovery = true;
        day.durationMin = 0;
        day.focus = 'Полный отдых и восстановление';
        day.exercises = [];
        day.short = [];
      } else if (nextType === 'training' && day.restDay) {
        day.restDay = false;
        day.recovery = false;
        day.durationMin = 45;
        day.focus = '';
        day.exercises = [];
        day.short = [];
      } else {
        return;
      }
      day.name = document.getElementById('edit-day-name')?.value.trim() || day.name;
      closeModal();
      showEditDayModal(index, day);
    }));
    document.getElementById('delete-day').addEventListener('click', async () => {
      if (program.days.length <= 1) return toast('В программе должен остаться хотя бы один день');
      program.days.splice(index, 1);
      state.settings.currentDayIndex = Math.min(Number(state.settings.currentDayIndex || 0), program.days.length - 1);
      program.updatedAt = new Date().toISOString();
      await Promise.all([DB.put('programs', program), DB.setSettingsObject({ currentDayIndex: state.settings.currentDayIndex }, state.activeProfileId)]);
      closeModal();
      renderPlan();
      toast('День удалён');
    });
    document.getElementById('save-day').addEventListener('click', async () => {
      day.name = document.getElementById('edit-day-name').value.trim() || (day.restDay ? `День ${index + 1}: отдых` : `День ${index + 1}`);
      if (day.restDay) {
        day.durationMin = 0;
        day.focus = 'Полный отдых и восстановление';
        day.recovery = true;
        day.exercises = [];
        day.short = [];
      } else {
        day.durationMin = Number(document.getElementById('edit-day-duration').value || 45);
        day.focus = document.getElementById('edit-day-focus').value.trim();
      }
      const nextDays = program.days.map((item, dayIndex) => dayIndex === index ? day : item);
      const saveDay = async () => {
        program.days = nextDays;
        program.updatedAt = new Date().toISOString();
        await DB.put('programs', program);
        closeModal();
        renderPlan();
        toast('День сохранён');
      };
      const warnings = programRecoveryWarnings(nextDays).filter((warning) => warning.leftIndex === index || warning.rightIndex === index);
      if (!warnings.length) return saveDay();
      showProgramRecoveryWarningModal({
        warnings,
        title: 'Мышцы повторяются в соседних днях',
        detail: 'После сохранения этого дня одна и та же группа будет получать рабочие подходы два тренировочных дня подряд.',
        confirmLabel: 'Сохранить всё равно',
        cancelLabel: 'Вернуться к дню',
        onConfirm: saveDay,
        onCancel: () => showEditDayModal(index, day),
      });
    });
  }

  function editDayExerciseRow(entry, index) {
    const exercise = getExercise(entry.exerciseId);
    return `<div class="list-row" data-entry-index="${index}" data-exercise-id="${escapeAttr(entry.exerciseId)}">
      <div class="list-row-main"><div class="list-row-title">${escapeHTML(exercise?.name || entry.exerciseId)}</div><div class="list-row-sub">${workPrescription(exercise, entry)} · отдых ${entry.restSec ?? exercise?.defaults.restSec ?? 0} сек</div></div>
      <div class="row-actions"><button class="mini-button move-up">↑</button><button class="mini-button move-down">↓</button><button class="mini-button edit-entry">✎</button><button class="mini-button remove-entry">×</button></div>
    </div>`;
  }

  function bindEditDayList(day, dayIndex) {
    el.modalRoot.querySelectorAll('#edit-day-list .list-row').forEach((row) => {
      const index = Number(row.dataset.entryIndex);
      row.querySelector('.move-up').addEventListener('click', () => moveDayEntry(day, dayIndex, index, -1));
      row.querySelector('.move-down').addEventListener('click', () => moveDayEntry(day, dayIndex, index, 1));
      row.querySelector('.remove-entry').addEventListener('click', () => { day.exercises.splice(index, 1); closeModal(); showEditDayModal(dayIndex, day); });
      row.querySelector('.edit-entry').addEventListener('click', () => showEditEntryModal(day, dayIndex, index));
    });
  }

  function moveDayEntry(day, dayIndex, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= day.exercises.length) return;
    [day.exercises[index], day.exercises[target]] = [day.exercises[target], day.exercises[index]];
    closeModal();
    showEditDayModal(dayIndex, day);
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
      showEditDayModal(dayIndex, day);
    });
  }

  function estimateCustomWorkoutMinutes(entries) {
    let seconds = 5 * 60;
    for (const entry of entries) {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) continue;
      const defaults = { ...exercise.defaults, ...entry };
      const sets = Math.max(1, Number(defaults.sets || 1));
      if (defaults.unit === 'minutes') seconds += Math.max(1, Number(defaults.durationMin || 5)) * 60;
      else if (defaults.unit === 'seconds') seconds += sets * Math.max(20, Number(defaults.durationSec || 30));
      else seconds += sets * 42;
      seconds += Math.max(0, sets - 1) * Math.max(0, Number(defaults.restSec || 60));
    }
    return Math.max(10, Math.round(seconds / 60));
  }

  function showCustomWorkoutBuilderModal(initialDay = null) {
    if (state.currentWorkout) {
      toast('Сначала продолжи или удали сохранённый черновик');
      navigate('workout');
      return;
    }

    const draft = {
      name: String(initialDay?.name || 'Своя тренировка'),
      entries: clone(Array.isArray(initialDay?.exercises) ? initialDay.exercises : []),
      groups: new Set(),
      query: '',
    };
    showModal(`
      <div class="modal-head custom-builder-head">
        <div><div class="eyebrow">Ручной конструктор</div><h2>Собрать свою тренировку</h2></div>
        <button class="modal-close" data-close aria-label="Закрыть">×</button>
      </div>

      <div class="custom-builder-explainer">
        <strong>Как собрать</strong>
        <span>1. Отметь нужные мышцы — можно несколько. 2. Нажимай «Добавить» возле упражнений. 3. Настрой подходы и запускай.</span>
      </div>

      <div class="field custom-builder-name">
        <label>Название тренировки</label>
        <input id="custom-workout-name" value="${escapeAttr(draft.name)}" maxlength="60">
      </div>

      <div class="custom-workout-summary" id="custom-workout-summary"></div>

      <section class="custom-builder-step selected-step" id="custom-selected-section">
        <div class="custom-builder-step-head">
          <span class="custom-builder-selected-icon">✓</span>
          <div><strong>Выбрано в тренировку</strong><small>Здесь можно менять подходы и порядок.</small></div>
        </div>
        <div class="custom-selected-list" id="custom-selected-list"></div>
      </section>

      <section class="custom-builder-step">
        <div class="custom-builder-step-head">
          <span class="custom-builder-step-number">1</span>
          <div><strong>Выбери мышечные группы</strong><small>Необязательно. Без выбора покажем все упражнения.</small></div>
          <button class="custom-filter-clear" id="custom-filter-clear" type="button" hidden>Сбросить</button>
        </div>
        <div class="custom-muscle-filter-grid" id="custom-workout-filters">
          ${muscleGroups.map((group) => `<button class="custom-muscle-filter" data-group="${group.id}" type="button" aria-pressed="false"><span class="custom-filter-check">✓</span><strong>${escapeHTML(group.label)}</strong><small>${escapeHTML(group.hint || '')}</small></button>`).join('')}
        </div>
        <div class="custom-filter-status" id="custom-filter-status">Показаны все мышечные группы</div>
      </section>

      <section class="custom-builder-step custom-library-step" id="custom-library-section">
        <div class="custom-builder-step-head">
          <span class="custom-builder-step-number">2</span>
          <div><strong>Найди и добавь упражнения</strong><small>Список уже открыт. Нажми на карточку — упражнение сразу попадёт в тренировку.</small></div>
        </div>
        <div class="custom-search-panel">
          <label for="custom-workout-search">Поиск упражнений</label>
          <div class="custom-search-row">
            <input id="custom-workout-search" type="search" placeholder="Например: жим, гантели, спина" enterkeyhint="search" autocomplete="off" autocapitalize="none">
            <button id="custom-workout-search-clear" type="button" aria-label="Очистить поиск" hidden>×</button>
          </div>
          <small>Ищем по названию, оборудованию и мышечным группам.</small>
        </div>
        <div class="custom-library-result-head"><strong id="custom-library-count">Все упражнения</strong><span>нажми карточку, чтобы добавить</span></div>
        <div class="custom-workout-library" id="custom-workout-library"></div>
      </section>

      <div class="custom-builder-footer">
        <div class="custom-builder-footer-meta">
          <button id="custom-scroll-selected" type="button">Выбрано: 0</button>
          <span id="custom-footer-duration">≈ 10 мин</span>
        </div>
        <div class="custom-builder-primary-actions">
          <button class="button secondary" id="schedule-custom-workout" type="button" disabled>Запланировать</button>
          <button class="button primary" id="start-custom-workout" type="button" disabled>Начать сейчас</button>
        </div>
        <div class="help center">Оба варианта не двигают основной цикл. Вес и повторы можно менять во время выполнения.</div>
      </div>
    `);

    const modal = el.modalRoot.querySelector('.modal');
    modal?.classList.add('custom-workout-modal');

    const selectedIds = () => new Set(draft.entries.map((entry) => entry.exerciseId));

    const updateFilterUi = () => {
      const selectedGroups = [...draft.groups];
      el.modalRoot.querySelectorAll('#custom-workout-filters .custom-muscle-filter').forEach((button) => {
        const active = draft.groups.has(button.dataset.group);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      const clearButton = document.getElementById('custom-filter-clear');
      if (clearButton) clearButton.hidden = !selectedGroups.length;
      const status = document.getElementById('custom-filter-status');
      if (status) {
        status.textContent = selectedGroups.length
          ? `Выбрано: ${selectedGroups.map(muscleGroupLabel).join(', ')}`
          : 'Показаны все мышечные группы';
      }
    };

    const renderSelected = () => {
      const selectedList = document.getElementById('custom-selected-list');
      const summary = document.getElementById('custom-workout-summary');
      const startButton = document.getElementById('start-custom-workout');
      const scheduleButton = document.getElementById('schedule-custom-workout');
      const scrollSelectedButton = document.getElementById('custom-scroll-selected');
      const footerDuration = document.getElementById('custom-footer-duration');
      const minutes = estimateCustomWorkoutMinutes(draft.entries);
      if (summary) summary.innerHTML = `
        <div><span>Упражнений</span><strong>${draft.entries.length}</strong></div>
        <div><span>Примерно</span><strong>${minutes} мин</strong></div>
      `;
      if (scrollSelectedButton) {
        scrollSelectedButton.textContent = `Выбрано: ${draft.entries.length}`;
        scrollSelectedButton.disabled = !draft.entries.length;
      }
      if (footerDuration) footerDuration.textContent = `≈ ${minutes} мин`;
      if (startButton) {
        startButton.disabled = !draft.entries.length;
        startButton.textContent = draft.entries.length
          ? `Начать сейчас · ${draft.entries.length} упр.`
          : 'Сначала добавь упражнения';
      }
      if (scheduleButton) {
        scheduleButton.disabled = !draft.entries.length;
        scheduleButton.textContent = draft.entries.length ? 'Запланировать' : 'Сначала добавь упражнения';
      }
      if (!selectedList) return;

      selectedList.innerHTML = draft.entries.length ? draft.entries.map((entry, index) => {
        const exercise = getExercise(entry.exerciseId);
        const groups = exercise ? getMuscleGroupsForExercise(exercise).map(muscleGroupLabel).join(' · ') : '';
        return `
          <div class="custom-selected-card" data-index="${index}">
            <span class="custom-selected-index">${index + 1}</span>
            <div class="custom-selected-copy">
              <strong>${escapeHTML(exercise?.name || entry.exerciseId)}</strong>
              <small>${escapeHTML(groups || exercise?.group || '')}</small>
              <div class="custom-selected-sets" aria-label="Количество подходов">
                <button class="custom-set-minus" type="button" aria-label="Уменьшить количество подходов">−</button>
                <span>${entry.sets} подх.</span>
                <button class="custom-set-plus" type="button" aria-label="Увеличить количество подходов">＋</button>
              </div>
            </div>
            <div class="custom-selected-actions">
              <button class="mini-button custom-move-up" type="button" aria-label="Поднять выше" ${index === 0 ? 'disabled' : ''}>↑</button>
              <button class="mini-button custom-move-down" type="button" aria-label="Опустить ниже" ${index === draft.entries.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="mini-button custom-remove" type="button" aria-label="Удалить упражнение">×</button>
            </div>
          </div>`;
      }).join('') : '<div class="custom-empty-selection"><strong>Пока ничего не добавлено</strong><span>Выбери мышцы выше или сразу найди упражнение через поиск, затем нажми «Добавить».</span></div>';

      selectedList.querySelectorAll('.custom-selected-card').forEach((card) => {
        const index = Number(card.dataset.index);
        card.querySelector('.custom-remove')?.addEventListener('click', () => {
          draft.entries.splice(index, 1);
          renderSelected();
          renderLibrary();
        });
        card.querySelector('.custom-set-minus')?.addEventListener('click', () => {
          draft.entries[index].sets = Math.max(1, Number(draft.entries[index].sets || 1) - 1);
          renderSelected();
        });
        card.querySelector('.custom-set-plus')?.addEventListener('click', () => {
          draft.entries[index].sets = Math.min(10, Number(draft.entries[index].sets || 1) + 1);
          renderSelected();
        });
        card.querySelector('.custom-move-up')?.addEventListener('click', () => {
          if (index <= 0) return;
          [draft.entries[index - 1], draft.entries[index]] = [draft.entries[index], draft.entries[index - 1]];
          renderSelected();
        });
        card.querySelector('.custom-move-down')?.addEventListener('click', () => {
          if (index >= draft.entries.length - 1) return;
          [draft.entries[index + 1], draft.entries[index]] = [draft.entries[index], draft.entries[index + 1]];
          renderSelected();
        });
      });
    };

    const renderLibrary = () => {
      const list = document.getElementById('custom-workout-library');
      const count = document.getElementById('custom-library-count');
      if (!list) return;
      const selected = selectedIds();
      const query = draft.query.trim().toLowerCase();
      const groups = [...draft.groups];
      const filtered = state.exercises.filter((exercise) => {
        const muscleIds = getMuscleGroupsForExercise(exercise);
        if (groups.length && !muscleIds.some((id) => draft.groups.has(id))) return false;
        if (query && !`${exercise.name} ${exercise.group} ${exercise.equipment} ${muscleIds.map(muscleGroupLabel).join(' ')}`.toLowerCase().includes(query)) return false;
        return true;
      }).sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || a.name.localeCompare(b.name, 'ru'));

      if (count) {
        const word = filtered.length === 1 ? 'упражнение' : filtered.length >= 2 && filtered.length <= 4 ? 'упражнения' : 'упражнений';
        const context = [groups.length ? `${groups.length} групп` : '', query ? `по запросу «${draft.query.trim()}»` : ''].filter(Boolean).join(' · ');
        count.textContent = `${filtered.length} ${word}${context ? ` · ${context}` : ''}`;
      }
      const cardsHtml = filtered.map((exercise) => {
        const exerciseId = String(exercise?.id || '');
        const exerciseName = String(exercise?.name || exerciseId || 'Без названия');
        const equipment = String(exercise?.equipment || 'Без оборудования');
        const inWorkout = selected.has(exerciseId);
        const groupsText = getMuscleGroupsForExercise(exercise).map(muscleGroupLabel).filter(Boolean).join(' · ') || String(exercise?.group || 'Другая группа');
        return `
          <button class="custom-library-card ${inWorkout ? 'selected' : ''}" data-id="${escapeAttr(exerciseId)}" type="button" aria-pressed="${inWorkout}" aria-label="${inWorkout ? 'Убрать' : 'Добавить'} ${escapeAttr(exerciseName)}">
            <span class="custom-library-add-mark" aria-hidden="true">${inWorkout ? '✓' : '＋'}</span>
            <span class="custom-library-copy">
              <strong>${escapeHTML(exerciseName)}</strong>
              <small>${escapeHTML(groupsText)}</small>
              <span>${escapeHTML(equipment)}</span>
            </span>
            <span class="custom-library-toggle" aria-hidden="true">${inWorkout ? 'В тренировке' : 'Добавить'}</span>
          </button>`;
      }).join('');
      list.innerHTML = cardsHtml || '<div class="empty compact-empty"><strong>Ничего не найдено</strong>Сними часть фильтров или измени запрос.</div>';

      list.querySelectorAll('.custom-library-card').forEach((card) => {
        card.addEventListener('click', () => {
          const exerciseId = card.dataset.id;
          const existingIndex = draft.entries.findIndex((entry) => entry.exerciseId === exerciseId);
          if (existingIndex >= 0) draft.entries.splice(existingIndex, 1);
          else {
            const exercise = getExercise(exerciseId);
            draft.entries.push({ exerciseId, sets: Math.max(1, Number(exercise?.defaults?.sets || 3)) });
          }
          renderSelected();
          renderLibrary();
        });
      });
    };

    const customSearchInput = document.getElementById('custom-workout-search');
    const customSearchClear = document.getElementById('custom-workout-search-clear');
    const syncCustomSearch = () => {
      draft.query = customSearchInput?.value || '';
      if (customSearchClear) customSearchClear.hidden = !draft.query.trim();
      renderLibrary();
    };
    ['input', 'change', 'search', 'keyup'].forEach((eventName) => customSearchInput?.addEventListener(eventName, syncCustomSearch));
    customSearchClear?.addEventListener('click', () => {
      if (customSearchInput) customSearchInput.value = '';
      syncCustomSearch();
      customSearchInput?.focus();
    });

    el.modalRoot.querySelectorAll('#custom-workout-filters .custom-muscle-filter').forEach((button) => button.addEventListener('click', () => {
      const groupId = button.dataset.group;
      if (draft.groups.has(groupId)) draft.groups.delete(groupId);
      else draft.groups.add(groupId);
      updateFilterUi();
      renderLibrary();
    }));

    document.getElementById('custom-filter-clear')?.addEventListener('click', () => {
      draft.groups.clear();
      updateFilterUi();
      renderLibrary();
    });

    document.getElementById('custom-scroll-selected')?.addEventListener('click', () => {
      document.getElementById('custom-selected-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const buildCustomDay = () => {
      if (!draft.entries.length) return toast('Добавь хотя бы одно упражнение');
      const name = document.getElementById('custom-workout-name')?.value.trim() || 'Своя тренировка';
      return {
        id: uid('custom-day'),
        name,
        focus: 'Тренировка собрана вручную',
        durationMin: estimateCustomWorkoutMinutes(draft.entries),
        exercises: draft.entries.map((entry) => ({ ...entry })),
      };
    };

    document.getElementById('schedule-custom-workout')?.addEventListener('click', () => {
      const customDay = buildCustomDay();
      if (!customDay) return;
      showScheduleCustomWorkoutModal(customDay);
    });

    document.getElementById('start-custom-workout')?.addEventListener('click', async () => {
      const customDay = buildCustomDay();
      if (!customDay) return;
      closeModal();
      await startWorkout({ customDay, startMode: 'custom', shouldAdvanceCycle: false });
    });

    updateFilterUi();
    renderSelected();
    renderLibrary();
  }

  function showScheduleCustomWorkoutModal(customDay) {
    const slot = defaultScheduledWorkoutSlot();
    const notificationsReady = state.push.subscribed && state.push.permission === 'granted';
    const networkNote = navigator.onLine
      ? 'После сохранения расписание сразу синхронизируется.'
      : 'Сейчас офлайн: расписание синхронизируется автоматически, когда появится интернет.';
    showModal(`
      <div class="modal-head">
        <div><div class="eyebrow">Разовая тренировка</div><h2>Когда напомнить?</h2></div>
        <button class="modal-close" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="schedule-workout-preview">
        <span class="schedule-workout-preview-icon">◷</span>
        <div>
          <strong>${escapeHTML(customDay.name || 'Своя тренировка')}</strong>
          <small>≈ ${Number(customDay.durationMin || 10)} мин · ${customDay.exercises.length} упражнений</small>
        </div>
      </div>
      <div class="inline-fields schedule-workout-fields">
        <div class="field">
          <label for="schedule-workout-date">Дата</label>
          <input id="schedule-workout-date" type="date" min="${todayISO()}" value="${slot.date}">
        </div>
        <div class="field">
          <label for="schedule-workout-time">Время</label>
          <input id="schedule-workout-time" type="time" step="300" value="${slot.time}">
        </div>
      </div>
      <div class="notice ${notificationsReady ? 'success' : 'warning'} schedule-workout-notice">
        <strong>${notificationsReady ? 'Системное уведомление включено.' : 'Для напоминания нужны уведомления.'}</strong><br>
        ${notificationsReady
          ? `Пуш придёт даже когда приложение закрыто. ${networkNote}`
          : `После сохранения iPhone предложит включить уведомления. Без разрешения тренировка всё равно останется в списке. ${networkNote}`}
      </div>
      <div class="button-row schedule-workout-modal-actions">
        <button class="button secondary" id="schedule-workout-back" type="button">Назад</button>
        <button class="button primary" id="confirm-schedule-workout" type="button">Запланировать</button>
      </div>
      <div class="help center">Время берётся из настроек уведомлений приложения.</div>
    `);
    el.modalRoot.querySelector('.modal')?.classList.add('schedule-workout-modal');

    document.getElementById('schedule-workout-back')?.addEventListener('click', () => showCustomWorkoutBuilderModal(customDay));
    document.getElementById('confirm-schedule-workout')?.addEventListener('click', async (event) => {
      const date = document.getElementById('schedule-workout-date')?.value;
      const time = document.getElementById('schedule-workout-time')?.value;
      const probe = scheduledWorkoutDateTime({ scheduledDate: date, scheduledTime: time });
      if (!probe) return toast('Выбери дату и время');
      if (probe.getTime() <= Date.now()) return toast('Это время уже прошло');

      const canPromptForNotifications = !state.push.subscribed
        && 'Notification' in window
        && 'PushManager' in window
        && isStandalonePWA()
        && Notification.permission !== 'denied';
      const pushEnablePromise = canPromptForNotifications ? enablePushNotifications() : Promise.resolve(null);
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Сохраняю…';
      try {
        const item = await addScheduledWorkout(customDay, date, time);
        await pushEnablePromise;
        await syncPushAutomationSettings({ silent: true });
        closeModal();
        renderHome();
        const pushReady = state.push.subscribed && state.push.permission === 'granted';
        toast(`${scheduledWorkoutDateLabel(item)} в ${item.scheduledTime}${pushReady ? ' · напоминание включено' : ' · сохранено в приложении'}`);
      } catch (error) {
        console.error('Scheduled workout save failed', error);
        button.disabled = false;
        button.textContent = 'Запланировать';
        toast(`Не удалось запланировать: ${error.message}`);
      }
    });
  }

  function showExercisePicker(onChoose, onCancel = null) {
    const selectedGroups = new Set();
    showModal(`
      <div class="modal-head"><h2>Выбрать упражнение</h2><button class="modal-close" ${onCancel ? 'id="cancel-exercise-picker"' : 'data-close'}>×</button></div>
      <div class="exercise-filter-chips" id="exercise-picker-filters">
        ${muscleGroups.map((group) => `<button class="exercise-filter-chip" data-group="${group.id}" type="button">${escapeHTML(group.label)}</button>`).join('')}
      </div>
      <div class="field"><input id="exercise-search" placeholder="Поиск по названию, мышцам или оборудованию"></div>
      <div class="exercise-picker-caption" id="exercise-picker-caption">Все упражнения</div>
      <div class="card list-card exercise-picker-scroll" id="exercise-picker-list"></div>
      <button class="button secondary full" id="create-custom-exercise" style="margin-top:12px">Создать своё упражнение</button>
    `);
    const renderList = () => {
      const q = document.getElementById('exercise-search').value.trim().toLowerCase();
      const filtered = state.exercises.filter((exercise) => {
        const exerciseGroups = getMuscleGroupsForExercise(exercise);
        if (selectedGroups.size && !exerciseGroups.some((id) => selectedGroups.has(id))) return false;
        const haystack = `${exercise.name} ${exercise.group} ${exercise.equipment} ${exerciseGroups.map(muscleGroupLabel).join(' ')}`.toLowerCase();
        return !q || haystack.includes(q);
      });
      const caption = document.getElementById('exercise-picker-caption');
      if (caption) caption.textContent = `${filtered.length} упражнений${selectedGroups.size ? ` · фильтров: ${selectedGroups.size}` : ''}`;
      document.getElementById('exercise-picker-list').innerHTML = filtered.length
        ? filtered.map((exercise) => {
          const groupsText = getMuscleGroupsForExercise(exercise).map(muscleGroupLabel).join(' · ') || exercise.group;
          return `<button class="list-row pick-exercise" data-id="${escapeAttr(exercise.id)}" type="button"><div class="list-row-main"><div class="list-row-title">${escapeHTML(exercise.name)}</div><div class="list-row-sub">${escapeHTML(groupsText)} · ${escapeHTML(exercise.equipment)}</div></div><span>＋</span></button>`;
        }).join('')
        : '<div class="empty compact-empty"><strong>Ничего не найдено</strong>Сними часть фильтров или измени запрос.</div>';
      el.modalRoot.querySelectorAll('.pick-exercise').forEach((button) => button.addEventListener('click', () => { closeModal(); onChoose(button.dataset.id); }));
    };
    document.getElementById('exercise-search').addEventListener('input', renderList);
    document.getElementById('cancel-exercise-picker')?.addEventListener('click', () => {
      closeModal();
      onCancel?.();
    });
    el.modalRoot.querySelectorAll('#exercise-picker-filters .exercise-filter-chip').forEach((button) => button.addEventListener('click', () => {
      const groupId = button.dataset.group;
      if (selectedGroups.has(groupId)) selectedGroups.delete(groupId); else selectedGroups.add(groupId);
      button.classList.toggle('active', selectedGroups.has(groupId));
      renderList();
    }));
    document.getElementById('create-custom-exercise').addEventListener('click', () => showCustomExerciseModal(onChoose, onCancel));
    renderList();
  }

  function showCustomExerciseModal(onChoose, onCancel = null) {
    showModal(`
      <div class="modal-head"><h2>Своё упражнение</h2><button class="modal-close" ${onCancel ? 'id="cancel-custom-exercise"' : 'data-close'}>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Название</label><input id="custom-name"></div>
        <div class="inline-fields"><div class="field"><label>Группа</label><input id="custom-group" placeholder="Например: спина"></div><div class="field"><label>Оборудование</label><input id="custom-equipment" placeholder="Гантели"></div></div>
        <div class="inline-fields three"><div class="field"><label>Подходы</label><input id="custom-sets" type="number" value="3"></div><div class="field"><label>Повторы от</label><input id="custom-min" type="number" value="8"></div><div class="field"><label>До</label><input id="custom-max" type="number" value="12"></div></div>
        <div class="field"><label>Отдых, сек</label><input id="custom-rest" type="number" value="75"></div>
      </div>
      <button class="button primary full" id="save-custom" style="margin-top:14px">Создать и добавить</button>
    `);
    document.getElementById('cancel-custom-exercise')?.addEventListener('click', () => {
      closeModal();
      onCancel?.();
    });
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
    setTopbar('Движение', 'Тренировки, план и история');
    const filtered = filteredHistory();
    el.main.innerHTML = `
      ${renderMovementTabs('history')}
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
    bindMovementTabs();
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
    if (isManualDayEntry(workout)) {
      const meta = manualDayKindMeta(workout.manualDay.kind);
      return `<div class="card manual-day-summary ${meta.className}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="eyebrow">${formatDate(new Date(workout.startedAt), { day:'numeric', month:'long', year:'numeric' })}</div><h3 style="margin:5px 0 4px">${meta.icon} ${escapeHTML(meta.label)}</h3><div class="muted">ручная отметка календаря${workout.comment ? ` · ${escapeHTML(workout.comment)}` : ''}</div></div><button class="mini-button view-workout" data-id="${workout.id}">›</button></div></div>`;
    }
    if (isRecoveryWorkout(workout)) {
      const reason = workout.recoveryDay?.reason || 'восстановление';
      return `<div class="card recovery-summary-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="eyebrow">${formatDate(new Date(workout.startedAt), { day:'numeric', month:'long', year:'numeric' })}</div><h3 style="margin:5px 0 4px">${escapeHTML(workout.dayName || 'День восстановления')}</h3><div class="muted">отдых · ${escapeHTML(reason)} · цикл не сдвинут</div></div><button class="mini-button view-workout" data-id="${workout.id}">›</button></div>
      </div>`;
    }
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="eyebrow">${formatDate(new Date(workout.startedAt), { day:'numeric', month:'long', year:'numeric' })}</div><h3 style="margin:5px 0 4px">${escapeHTML(workout.dayName)}</h3><div class="muted">${formatDuration(workout.durationSec || 0)} · ${workout.completionPct ?? workoutCompletion(workout)}% · ${formatCompactLoad(workout.totalLoadKg || 0)} кг${workout.records?.length ? ` · 🔥 ${workout.records.length} рек.` : ''}${workout.deload?.applied ? ' · разгрузка' : ''}${workout.smartRest?.status && workout.smartRest.status !== 'ok' ? ' · отдых советовали' : ''}</div></div><button class="mini-button view-workout" data-id="${workout.id}">›</button></div>
      <div class="progress-bar" style="margin-top:12px"><span style="width:${workout.completionPct ?? workoutCompletion(workout)}%"></span></div>
    </div>`;
  }

  function showWorkoutDetails(id) {
    const workout = state.workouts.find((w) => w.id === id);
    if (!workout) return;
    if (isManualDayEntry(workout)) return showEditActivityDayModal(localDateISO(new Date(workout.startedAt || workout.date)));
    if (isRecoveryWorkout(workout)) return showRecoveryDayDetails(workout);
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
      ${renderWorkoutDeloadDetailsBlock(workout)}
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


  function showRecoveryDayDetails(workout) {
    const signals = workout.recoveryDay?.signals || [];
    showModal(`
      <div class="modal-head"><div><div class="eyebrow">${formatDate(new Date(workout.startedAt), { day:'numeric', month:'long', year:'numeric' })}</div><h2>${escapeHTML(workout.dayName || 'День восстановления')}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="card smart-rest-card ok">
        <p>${escapeHTML(workout.recoveryDay?.text || 'День без силовой нагрузки. Цикл тренировок не сдвигался.')}</p>
        <div class="stats-grid" style="margin-top:12px">
          <div class="stat"><div class="stat-value">0</div><div class="stat-label">подходов</div></div>
          <div class="stat"><div class="stat-value">0</div><div class="stat-label">кг нагрузки</div></div>
          <div class="stat"><div class="stat-value">✓</div><div class="stat-label">отдых</div></div>
          <div class="stat"><div class="stat-value">—</div><div class="stat-label">цикл</div></div>
        </div>
      </div>
      ${signals.length ? `<div class="card list-card" style="margin-top:12px">${signals.map((signal) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHTML(signal.title)}</div><div class="list-row-sub">${escapeHTML(signal.label)}</div></div></div>`).join('')}</div>` : ''}
      ${workout.comment ? `<div class="notice" style="margin-top:12px">${escapeHTML(workout.comment)}</div>` : ''}
      <button class="button danger full" id="delete-recovery-day" style="margin-top:14px">Удалить запись отдыха</button>
    `);
    document.getElementById('delete-recovery-day').addEventListener('click', async () => {
      await DB.remove('workouts', workout.id);
      state.workouts = state.workouts.filter((w) => w.id !== workout.id);
      closeModal();
      renderHistory();
      toast('Запись отдыха удалена');
    });
  }

  function renderProgress() {
    const primaryTabs = [
      ['overview', 'Обзор'],
      ['body', 'Тело'],
      ['strength', 'Сила'],
      ['photos', 'Фото'],
      ['more', 'Данные'],
    ];
    const secondaryTabs = [
      ['training', 'Тренировки'],
      ['muscles', 'Мышцы'],
      ['recovery', 'Восстановление'],
      ['records', 'Рекорды'],
      ['stepper', 'Степпер'],
      ['week', 'Неделя'],
    ];
    const secondaryActive = secondaryTabs.some(([value]) => value === state.progressTab);
    setTopbar('Прогресс', 'Последние 30 дней');
    el.main.innerHTML = `
      <section class="section progress-primary-tabs"><div class="movement-tabs">
        ${primaryTabs.map(([value,label]) => `<button class="${state.progressTab === value || (value === 'more' && secondaryActive) ? 'active' : ''} progress-tab" data-tab="${value}" type="button">${label}</button>`).join('')}
      </div></section>
      ${secondaryActive ? `<section class="section progress-secondary-tabs"><div class="tabs">${secondaryTabs.map(([value,label]) => `<button class="tab ${state.progressTab === value ? 'active' : ''} progress-tab" data-tab="${value}" type="button">${label}</button>`).join('')}</div></section>` : ''}
      <div id="progress-content">${renderProgressContent()}</div>
    `;
    el.main.querySelectorAll('.progress-tab').forEach((button) => button.addEventListener('click', () => { state.progressTab = button.dataset.tab; renderProgress(); }));
    el.main.querySelectorAll('[data-progress-target]').forEach((button) => button.addEventListener('click', () => {
      state.progressTab = button.dataset.progressTarget;
      renderProgress();
    }));
    bindProgressEvents();
  }

  function renderProgressContent() {
    if (state.progressTab === 'overview') return renderProgressOverview();
    if (state.progressTab === 'more') return renderProgressMore();
    if (state.progressTab === 'body') return renderBodyProgress();
    if (state.progressTab === 'training') return renderTrainingProgress();
    if (state.progressTab === 'muscles') return renderMuscleProgress();
    if (state.progressTab === 'recovery') return renderRecoveryProgress();
    if (state.progressTab === 'records') return renderRecordsProgress();
    if (state.progressTab === 'strength') return renderStrengthProgress();
    if (state.progressTab === 'stepper') return renderStepperProgress();
    if (state.progressTab === 'week') return renderWeeklyTrainingReport();
    return renderPhotoProgress();
  }

  function renderProgressOverview() {
    const from = startOfDay(new Date(Date.now() - 29 * 86400000));
    const workouts = completedWorkoutList(state.workouts).filter((workout) => new Date(workout.startedAt || workout.date || 0) >= from);
    const totalLoad = workouts.reduce((sum, workout) => sum + Number(workout.totalLoadKg || 0), 0);
    const completion = Math.round(avgCompletion(workouts));
    const waist = bodyMeasurementSeries('waistCm').filter((row) => row.dateObj >= from);
    const weight = bodyMeasurementSeries('weightKg').filter((row) => row.dateObj >= from);
    const waistDiff = waist.length >= 2 ? waist[waist.length - 1].value - waist[0].value : null;
    const weightDiff = weight.length >= 2 ? weight[weight.length - 1].value - weight[0].value : null;
    const muscles = muscleLoadSummary(7);
    const balanced = muscles.rows.filter((row) => row.status === 'normal').slice(0, 3);
    const attention = muscles.rows.filter((row) => ['high', 'overload', 'low'].includes(row.status)).slice(0, 3);
    const headline = waistDiff !== null
      ? `${formatSignedBodyValue(waistDiff)} см`
      : workouts.length
        ? `${workouts.length} тренировок`
        : 'Начинаем отсчёт';
    const summary = waistDiff === null
      ? (workouts.length ? 'Тренировки сохраняются — добавь свежий замер талии, чтобы увидеть изменение формы.' : 'Сохрани первую тренировку и добавь замеры — здесь появится человеческий вывод.')
      : `${waistDiff < -0.1 ? 'Талия уменьшается' : waistDiff > 0.1 ? 'Талия выросла' : 'Талия почти без изменений'}${weightDiff !== null ? `, вес ${Math.abs(weightDiff) < 0.1 ? 'стоит' : weightDiff > 0 ? 'растёт' : 'снижается'}` : ''}.`;

    const hasStartingData = workouts.length || state.measurements.length || state.photos.length;

    return `
      <section class="section">
        ${hasStartingData ? `
          <button class="card progress-result-card" data-progress-target="body" type="button">
            <span class="eyebrow">Главный результат</span>
            <strong>${escapeHTML(headline)}</strong>
            <h2>${escapeHTML(summary)}</h2>
            <small>Открыть динамику тела <b>›</b></small>
          </button>
        ` : `
          <article class="card progress-result-card progress-empty-start">
            <span class="eyebrow">Первый шаг</span>
            <strong>Добавь исходные данные</strong>
            <h2>Вес, талия и первое фото займут около минуты — после этого здесь появятся выводы.</h2>
            <div class="progress-empty-actions">
              <button class="button primary" id="progress-add-measurement" type="button">Добавить замеры</button>
              <button class="button secondary" id="progress-add-photo" type="button">Добавить фото</button>
            </div>
          </article>
        `}
      </section>

      <section class="section">
        <div class="section-head rezhim-section-head"><h2>За месяц</h2></div>
        <div class="progress-month-grid">
          <button class="card" data-progress-target="training" type="button"><span>Тренировки</span><strong>${workouts.length}</strong><small>${completion}% выполнения</small></button>
          <button class="card" data-progress-target="strength" type="button"><span>Общий объём</span><strong>${formatCompactLoad(totalLoad)} кг</strong><small>за 30 дней</small></button>
        </div>
      </section>

      <section class="section">
        <div class="card progress-balance-card">
          <div class="section-head"><h2>Баланс нагрузки</h2><button class="link-button" data-progress-target="muscles" type="button">Подробнее</button></div>
          <div class="progress-balance-tags">
            ${balanced.map((row) => `<span class="good">${escapeHTML(row.label)} ✓</span>`).join('')}
            ${attention.map((row) => `<span class="${row.status === 'low' ? 'info' : 'watch'}">${escapeHTML(row.label)} ${escapeHTML(row.statusLabel)}</span>`).join('')}
            ${!balanced.length && !attention.length ? '<span class="info">Нужны сохранённые тренировки</span>' : ''}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head rezhim-section-head"><h2>Все данные</h2></div>
        <div class="progress-link-grid">
          <button data-progress-target="records" type="button"><span>★</span><strong>Рекорды</strong></button>
          <button data-progress-target="recovery" type="button"><span>○</span><strong>Восстановление</strong></button>
          <button data-progress-target="muscles" type="button"><span>●</span><strong>Мышцы</strong></button>
          <button data-progress-target="stepper" type="button"><span>↗</span><strong>Степпер</strong></button>
        </div>
      </section>`;
  }

  function renderProgressMore() {
    return `
      <section class="section">
        <div class="card progress-more-intro"><span class="eyebrow">Подробная аналитика</span><h2>Выбери нужный отчёт</h2><p>Все прежние разделы прогресса на месте — они просто убраны со стартовой линии.</p></div>
      </section>
      <section class="section">
        <div class="progress-more-grid">
          ${[
            ['training', '▦', 'Тренировки', 'Количество, минуты и объём'],
            ['muscles', '●', 'Мышцы', 'Нагрузка за 7 и 14 дней'],
            ['recovery', '○', 'Восстановление', 'Отдых и разгрузочная неделя'],
            ['records', '★', 'Рекорды', 'Полезные достижения'],
            ['stepper', '↗', 'Степпер', 'Время и лучшие результаты'],
            ['week', '▤', 'Неделя', 'Итоги, прогрессия и следующий фокус'],
          ].map(([target, icon, title, note]) => `<button class="card" data-progress-target="${target}" type="button"><span>${icon}</span><strong>${title}</strong><small>${note}</small><b>›</b></button>`).join('')}
        </div>
      </section>`;
  }

  function renderBodyProgress() {
    const metric = selectedBodyMetric();
    const periodDays = selectedBodyPeriodDays();
    const fullSeries = bodyMeasurementSeries(metric.key);
    const series = filterBodySeriesByPeriod(fullSeries, periodDays);
    const first = series[0] || null;
    const last = series[series.length - 1] || null;
    const diff = first && last && series.length > 1 ? last.value - first.value : null;
    const diffClass = diff === null || Math.abs(diff) < 0.05 ? 'neutral' : diff > 0 ? 'up' : 'down';
    const periodLabel = periodDays ? `${periodDays} дней` : 'всё время';
    const rangeLabel = first && last ? `${formatTinyDate(first.date)} — ${formatTinyDate(last.date)}` : periodLabel;
    const latestText = last ? `${formatBodyValue(last.value)} ${metric.unit}` : `— ${metric.unit}`;
    const diffText = diff === null ? '—' : `${formatSignedBodyValue(diff)} ${metric.unit}`;
    const diffPct = diff !== null && first?.value ? (diff / first.value) * 100 : null;
    const diffPctText = diffPct === null || Math.abs(diffPct) < 0.05 ? '' : `${diffPct > 0 ? '+' : '−'}${Math.abs(diffPct).toFixed(1).replace('.', ',')}%`;
    const deltaText = diff === null ? '—' : `${diffText}${diffPctText ? ` · ${diffPctText}` : ''}`;
    const trendText = diff === null ? 'Добавь минимум два замера, чтобы увидеть динамику.' : `${metric.label}: ${diffText} за ${periodLabel}. ${Math.abs(diff) < 0.05 ? 'Почти без изменений.' : diff > 0 ? 'Тренд вверх.' : 'Тренд вниз.'}`;
    const recent = state.measurements.slice(0, 5);

    return `
      <section class="section"><div class="button-row body-top-actions"><button class="button primary" id="add-measurement">Добавить замер</button><button class="button secondary" id="measurement-history">Все замеры</button></div></section>

      <section class="section body-progress-controls premium-filter-panel">
        <div class="body-control-scroll" aria-label="Показатель прогресса">
          ${bodyMetrics().map((item) => `<button class="tab body-metric ${metric.key === item.key ? 'active' : ''}" data-metric="${item.key}" type="button">${item.label}</button>`).join('')}
        </div>
        <div class="body-period-row" aria-label="Период прогресса">
          ${bodyPeriods().map((item) => `<button class="period-pill body-period ${periodDays === item.days ? 'active' : ''}" data-days="${item.days}" type="button">${item.label}</button>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="card body-progress-card sport-progress-card">
          <div class="body-progress-head">
            <div>
              <div class="eyebrow">${escapeHTML(metric.label)} · ${escapeHTML(periodLabel)}</div>
              <h2>${escapeHTML(latestText)}</h2>
              <p class="body-trend-note">${escapeHTML(trendText)}</p>
            </div>
            <div class="body-progress-delta ${diffClass}">${escapeHTML(deltaText)}</div>
          </div>
          ${bodyProgressChart(series, metric)}
          <div class="body-summary-grid">
            <div><span>Было</span><strong>${first ? `${formatBodyValue(first.value)} ${metric.unit}` : '—'}</strong></div>
            <div><span>Стало</span><strong>${last ? `${formatBodyValue(last.value)} ${metric.unit}` : '—'}</strong></div>
            <div><span>Разница</span><strong class="${diffClass}">${escapeHTML(diffText)}</strong></div>
            <div><span>Период</span><strong>${escapeHTML(rangeLabel)}</strong></div>
          </div>
          ${fullSeries.length > series.length && series.length < 2 ? `<div class="notice" style="margin-top:12px"><strong>В этом периоде мало данных.</strong><br>Попробуй 90 дней или «Всё», чтобы увидеть старые замеры.</div>` : ''}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Последние замеры</h2><button class="link-button" id="measurement-history-inline" type="button">Все</button></div>
        <div class="card list-card body-recent-list">${recent.length ? recent.map((m) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${formatShortDate(m.date)}</div><div class="list-row-sub">Вес ${m.weightKg ?? '—'} кг · талия ${m.waistCm ?? '—'} см · живот ${m.abdomenCm ?? '—'} см</div></div><button class="mini-button delete-measurement" data-id="${m.id}" type="button">×</button></div>`).join('') : '<div class="empty compact-empty"><strong>Замеров пока нет</strong>Добавь первый замер тела — график появится здесь.</div>'}</div>
      </section>`;
  }

  function bodyMetrics() {
    return [
      { key: 'weightKg', label: 'Вес', unit: 'кг' },
      { key: 'waistCm', label: 'Талия', unit: 'см' },
      { key: 'abdomenCm', label: 'Живот', unit: 'см' },
      { key: 'chestCm', label: 'Грудь', unit: 'см' },
      { key: 'hipsCm', label: 'Бёдра', unit: 'см' },
      { key: 'armCm', label: 'Рука', unit: 'см' },
    ];
  }

  function bodyPeriods() {
    return [
      { days: 7, label: '7 дней' },
      { days: 30, label: '30 дней' },
      { days: 90, label: '90 дней' },
      { days: 0, label: 'Всё' },
    ];
  }

  function selectedBodyMetric() {
    const metrics = bodyMetrics();
    const stored = state.bodyProgressMetric || state.settings.bodyProgressMetric;
    return metrics.find((item) => item.key === stored) || metrics[0];
  }

  function selectedBodyPeriodDays() {
    const allowed = bodyPeriods().map((item) => item.days);
    const stored = Number(state.bodyProgressPeriodDays ?? state.settings.bodyProgressPeriodDays ?? 30);
    return allowed.includes(stored) ? stored : 30;
  }

  function bodyMeasurementSeries(key) {
    return state.measurements
      .map((m) => ({ id: m.id, date: m.date, dateObj: new Date(`${m.date}T00:00:00`), value: Number(m[key]) }))
      .filter((row) => row.date && Number.isFinite(row.value) && row.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function latestProfileWeightKg() {
    const latestWeight = state.measurements.find((measurement) => {
      const value = Number(measurement?.weightKg);
      return Number.isFinite(value) && value > 0;
    });
    if (latestWeight) return Number(latestWeight.weightKg);
    const profileWeight = Number(state.profile?.currentWeightKg);
    return Number.isFinite(profileWeight) && profileWeight > 0 ? profileWeight : null;
  }

  function filterBodySeriesByPeriod(series, days) {
    if (!days) return series;
    const end = startOfDay(new Date());
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    return series.filter((row) => row.dateObj >= start && row.dateObj <= new Date(end.getTime() + 86400000));
  }

  function formatBodyValue(value) {
    if (!Number.isFinite(Number(value))) return '—';
    return Number(value).toFixed(1).replace('.', ',');
  }

  function formatSignedBodyValue(value) {
    if (!Number.isFinite(Number(value))) return '—';
    const abs = Math.abs(Number(value));
    if (abs < 0.05) return '0,0';
    return `${value > 0 ? '+' : '−'}${formatBodyValue(abs)}`;
  }

  function bodyProgressChart(data, metric) {
    if (!data.length) return `<div class="empty body-chart-empty"><strong>Нет данных по показателю «${escapeHTML(metric.label)}»</strong>Добавь хотя бы один замер с этим значением.</div>`;
    const width = 680, height = 310, padLeft = 58, padRight = 22, padTop = 42, padBottom = 58;
    const values = data.map((row) => row.value);
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const rawSpan = rawMax - rawMin;
    const minPad = metric.unit === 'кг' ? 0.4 : 1;
    const pad = rawSpan > 0 ? Math.max(rawSpan * 0.18, minPad) : (metric.unit === 'кг' ? 1 : 2);
    const min = Math.max(0, rawMin - pad);
    const max = rawMax + pad;
    const span = max - min || 1;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;
    const x = (i) => data.length === 1 ? padLeft + innerW / 2 : padLeft + (i / (data.length - 1)) * innerW;
    const y = (value) => padTop + (1 - ((value - min) / span)) * innerH;
    const path = data.map((row, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(row.value).toFixed(1)}`).join(' ');
    const areaPath = data.length > 1 ? `${path} L ${x(data.length - 1).toFixed(1)} ${(height - padBottom).toFixed(1)} L ${x(0).toFixed(1)} ${(height - padBottom).toFixed(1)} Z` : '';
    const ticks = [max, min + span / 2, min];
    const pointLabels = data.map((row, index) => {
      const showValue = data.length <= 4 || index === 0 || index === data.length - 1;
      const showDate = data.length <= 6 || index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2);
      const isLast = index === data.length - 1;
      return `
        ${isLast ? `<circle class="body-chart-halo" cx="${x(index).toFixed(1)}" cy="${y(row.value).toFixed(1)}" r="14"/>` : ''}
        <circle class="body-chart-dot ${isLast ? 'last' : ''}" cx="${x(index).toFixed(1)}" cy="${y(row.value).toFixed(1)}" r="${isLast ? 8 : 6}"/>
        ${showValue ? `<text class="body-chart-value ${isLast ? 'last' : ''}" x="${x(index).toFixed(1)}" y="${Math.max(18, y(row.value) - 15).toFixed(1)}" text-anchor="middle">${formatBodyValue(row.value)}</text>` : ''}
        ${showDate ? `<text class="body-chart-date" x="${x(index).toFixed(1)}" y="${height - 16}" text-anchor="middle">${formatTinyDate(row.date)}</text>` : ''}`;
    }).join('');
    return `<div class="body-chart-wrap premium-chart-wrap"><svg class="body-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="График ${escapeAttr(metric.label)}">
      <defs>
        <linearGradient id="bodyChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c7ff2f" stop-opacity="0.26"/><stop offset="100%" stop-color="#c7ff2f" stop-opacity="0.02"/></linearGradient>
      </defs>
      ${ticks.map((tick) => `<line class="body-chart-grid" x1="${padLeft}" x2="${width - padRight}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"/><text class="body-chart-axis" x="8" y="${(y(tick) + 4).toFixed(1)}">${formatBodyValue(tick)} ${metric.unit}</text>`).join('')}
      ${data.length > 1 ? `<path class="body-chart-area" d="${areaPath}"/><path class="body-chart-line" d="${path}"/>` : ''}
      ${pointLabels}
    </svg>${data.length < 2 ? '<div class="help center">Нужен ещё один замер, чтобы построить динамику.</div>' : ''}</div>`;
  }

  function renderTrainingProgress() {
    const weeks = aggregateWeeks(8);
    return `
      <section class="section"><div class="stats-grid">
        <div class="stat"><div class="stat-value">${completedWorkoutList(state.workouts).length}</div><div class="stat-label">всего тренировок</div></div>
        <div class="stat"><div class="stat-value">${calculateStreak()}</div><div class="stat-label">серия дней</div></div>
        <div class="stat"><div class="stat-value">${Math.round(completedWorkoutList(state.workouts).reduce((s,w)=>s+(w.durationSec||0),0)/3600)}</div><div class="stat-label">часов</div></div>
        <div class="stat"><div class="stat-value">${Math.round(avgCompletion(completedWorkoutList(state.workouts)))}%</div><div class="stat-label">среднее выполнение</div></div>
      </div></section>
      <section class="section"><div class="card"><div class="section-head"><h2>Тренировки по неделям</h2></div>${barChart(weeks.map(x=>({label:x.label,value:x.count})), 'трен.')}</div></section>`;
  }



  function renderHomeDeloadCard() {
    const analysis = deloadAnalysis({ days: 14 });
    const open = homePanelOpen('deload', false);
    if (!analysis.hasData) {
      return `<section class="section compact-home-section"><details class="card home-disclosure" data-home-panel="deload" ${open ? 'open' : ''}>
        <summary><span class="home-disclosure-icon">↘</span><span class="home-disclosure-copy"><strong>Разгрузка</strong><small>Пока недостаточно данных</small></span><span class="chip">нет данных</span><span class="home-disclosure-chevron" aria-hidden="true">⌄</span></summary>
        <div class="home-disclosure-body"><div class="empty compact-empty"><strong>Разгрузка пока не нужна</strong>Сохрани несколько тренировок — приложение начнёт отслеживать усталость, боль и падение результатов.</div></div>
      </details></section>`;
    }
    const signalText = analysis.signals.length ? analysis.signals.slice(0, 3).map((signal) => signal.label).join(' · ') : 'критичных признаков нет';
    return `<section class="section compact-home-section"><details class="card home-disclosure deload-card ${analysis.status}" data-home-panel="deload" ${open ? 'open' : ''}>
      <summary><span class="home-disclosure-icon">↘</span><span class="home-disclosure-copy"><strong>Разгрузка</strong><small>${escapeHTML(analysis.homeText)}</small></span><span class="chip ${analysis.shouldSuggest ? 'warning' : 'success'}">${escapeHTML(analysis.statusLabel)}</span><span class="home-disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div class="home-disclosure-body"><p>${escapeHTML(analysis.homeText)}</p><div class="help">${escapeHTML(signalText)}</div><button class="button secondary small full home-panel-link" id="open-deload-progress-home" type="button">Подробнее</button></div>
    </details></section>`;
  }


  function renderHomeRestCard() {
    const analysis = smartRestAnalysis({ includeTodayTraining: true });
    const statusClass = analysis.status;
    const open = homePanelOpen('rest', false);
    const calendar = analysis.days.slice(0, 7).reverse().map((day) => `
      <div class="rest-day ${day.kind} ${day.loggedRest ? 'logged-rest' : ''}" title="${escapeAttr(day.label)}"><span>${escapeHTML(day.shortLabel)}</span><strong>${escapeHTML(day.shortDate)}</strong></div>`).join('');
    const signals = analysis.signals.length ? analysis.signals.slice(0, 3).map((signal) => signal.title).join(' · ') : analysis.modeNote;
    const todayKind = activityKindForDate(todayISO());
    const todayRestLogged = todayKind === 'recovery';
    const todayHasTraining = todayKind === 'training' || todayKind === 'light';
    const restButtonText = todayRestLogged ? 'Отдых записан' : todayHasTraining ? 'Сегодня была активность' : 'Отдохнуть сегодня';
    return `<section class="section compact-home-section"><details class="card home-disclosure smart-rest-card ${statusClass}" data-home-panel="rest" ${open ? 'open' : ''}>
      <summary><span class="home-disclosure-icon">◷</span><span class="home-disclosure-copy"><strong>Умный отдых</strong><small>${escapeHTML(analysis.homeText)}</small></span><span class="chip ${analysis.status === 'ok' ? 'success' : 'warning'}">${escapeHTML(analysis.statusLabel)}</span><span class="home-disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div class="home-disclosure-body"><p>${escapeHTML(analysis.homeText)}</p><div class="rest-week-strip" aria-label="Календарь активности за 7 дней">${calendar}</div><div class="help">${escapeHTML(signals)}</div><div class="button-row smart-rest-actions home-panel-actions"><button class="button secondary small" id="open-rest-progress-home" type="button">Подробнее</button><button class="button ghost small" id="start-light-home" type="button">Лёгкая</button><button class="button ${analysis.shouldRest ? 'primary' : 'ghost'} small" id="log-rest-home" type="button" ${todayRestLogged || todayHasTraining ? 'disabled' : ''}>${escapeHTML(restButtonText)}</button></div><button class="button ghost small full" id="edit-past-activity-home" type="button" style="margin-top:8px">✎ Изменить прошлые дни</button></div>
    </details></section>`;
  }


  function renderHomeMuscleLoadCard() {
    const summary = smartWorkoutReadinessSummary();
    const open = homePanelOpen('muscles', false);
    const ready = summary.rows.filter((row) => row.recoveryStatus === 'ready').sort((a, b) => b.score - a.score);
    const caution = summary.rows.filter((row) => row.recoveryStatus === 'caution');
    const recovering = summary.rows.filter((row) => ['recovering', 'soon'].includes(row.recoveryStatus));
    const headline = summary.completedWorkouts
      ? `${ready.length} готовы · ${recovering.length} восстанавливаются${caution.length ? ` · ${caution.length} осторожно` : ''}`
      : 'Появится после сохранённых тренировок';
    const advice = caution.length
      ? `Сегодня лучше не добивать: ${caution.map((row) => row.label).join(', ')}.`
      : ready.length
        ? `Лучше всего готовы: ${ready.slice(0, 3).map((row) => row.label).join(', ')}.`
        : 'Дай мышцам ещё немного времени или выбери лёгкую тренировку.';
    return `<section class="section compact-home-section"><details class="card home-disclosure muscle-home-card" data-home-panel="muscles" ${open ? 'open' : ''}>
      <summary><span class="home-disclosure-icon">●</span><span class="home-disclosure-copy"><strong>Готовность мышц</strong><small>${escapeHTML(headline)}</small></span><span class="chip ${caution.length ? 'warning' : 'success'}">${caution.length ? 'есть ограничения' : ready.length ? 'можно тренироваться' : 'восстановление'}</span><span class="home-disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div class="home-disclosure-body">${summary.completedWorkouts ? `<div class="muscle-recovery-mini-grid">${summary.rows.map(renderMuscleRecoveryMiniCell).join('')}</div><div class="help home-panel-help">${escapeHTML(advice)}</div>` : '<div class="empty compact-empty"><strong>Пока нет данных</strong>Сохрани пару тренировок — приложение рассчитает восстановление каждой группы.</div>'}<div class="home-panel-actions"><button class="button secondary small" id="open-muscle-progress-home" type="button">Подробнее</button><button class="button secondary small" id="smart-workout-from-muscles" type="button">✨ Подобрать тренировку</button></div></div>
    </details></section>`;
  }

  function renderMuscleRecoveryMiniCell(row) {
    return `<div class="muscle-recovery-mini ${row.recoveryStatus}"><span>${escapeHTML(row.shortLabel)}</span><strong>${row.readinessPct}%</strong><small>${escapeHTML(row.recoveryLabel)}</small></div>`;
  }

  function renderMuscleMiniCell(row) {
    return `<div class="muscle-mini-cell ${row.status}"><span>${escapeHTML(row.shortLabel)}</span><strong>${row.sets}</strong></div>`;
  }

  function renderMuscleProgress() {
    const days = Number(state.musclePeriodDays || state.settings.musclePeriodDays || 7) === 14 ? 14 : 7;
    const summary = muscleLoadSummary(days);
    const recovery = smartWorkoutReadinessSummary();
    const overloaded = summary.rows.filter((row) => row.status === 'overload');
    const high = summary.rows.filter((row) => row.status === 'high');
    const low = summary.rows.filter((row) => row.status === 'low');
    return `
      <section class="section"><div class="button-row period-toggle">
        <button class="button ${days === 7 ? 'primary' : 'secondary'} small muscle-period" data-days="7" type="button">7 дней</button>
        <button class="button ${days === 14 ? 'primary' : 'secondary'} small muscle-period" data-days="14" type="button">14 дней</button>
      </div></section>
      <section class="section"><div class="stats-grid">
        <div class="stat"><div class="stat-value">${recovery.readyCount}</div><div class="stat-label">готовы</div></div>
        <div class="stat"><div class="stat-value">${recovery.recoveringCount}</div><div class="stat-label">восстанавливаются</div></div>
        <div class="stat"><div class="stat-value">${recovery.cautionCount}</div><div class="stat-label">осторожно</div></div>
        <div class="stat"><div class="stat-value">${summary.totalSets}</div><div class="stat-label">подходов за ${days} дн.</div></div>
      </div></section>
      <section class="section"><div class="section-head"><h2>Готовность к следующей нагрузке</h2><span class="muted">расчёт по последней тренировке</span></div><div class="muscle-recovery-grid">${recovery.rows.map(renderMuscleRecoveryCard).join('')}</div></section>
      <section class="section"><div class="section-head"><h2>Нагрузка по группам</h2><span class="muted">${days} дней</span></div><div class="muscle-load-grid">${summary.rows.map(renderMuscleLoadCard).join('')}</div></section>
      <section class="section"><div class="card muscle-advice-card"><div class="section-head"><h2>Вывод</h2></div>${renderMuscleAdvice(summary, { overloaded, high, low })}</div></section>
      <div class="notice">Готовность — ориентир, а не медицинская оценка. Она учитывает выполненные подходы, тяжесть, время после нагрузки, недельный объём и свежие отметки боли.</div>`;
  }

  function renderMuscleRecoveryCard(row) {
    const last = row.lastAt ? smartDaysSinceLabel(row.daysSince) : 'нет истории';
    const sources = row.lastSession?.sources?.slice(0, 2).join(' · ') || 'упражнений пока не было';
    return `<div class="card muscle-recovery-card ${row.recoveryStatus}">
      <div class="muscle-recovery-head"><div><span>${escapeHTML(row.hint)}</span><h3>${escapeHTML(row.label)}</h3></div><b>${row.readinessPct}%</b></div>
      <div class="muscle-recovery-track"><span style="width:${row.readinessPct}%"></span></div>
      <strong class="muscle-recovery-status">${escapeHTML(row.recoveryLabel)}</strong>
      <small>${escapeHTML(row.recoveryNote)} · ${escapeHTML(last)}</small>
      <em>${escapeHTML(sources)}</em>
    </div>`;
  }

  function renderMuscleLoadCard(row) {
    const percent = Math.min(100, Math.round((row.sets / Math.max(row.thresholds.overload, 1)) * 100));
    const topSources = row.sources.slice(0, 3).map((source) => `${source.name}: ${source.sets}`).join(' · ');
    return `<div class="card muscle-load-card ${row.status}">
      <div class="muscle-load-head"><div><div class="eyebrow">${escapeHTML(row.hint)}</div><h3>${escapeHTML(row.label)}</h3></div><span class="muscle-status ${row.status}">${escapeHTML(row.statusLabel)}</span></div>
      <div class="muscle-load-value"><strong>${row.sets}</strong><span>рабочих подходов</span></div>
      <div class="muscle-load-bar"><span style="width:${percent}%"></span></div>
      <div class="list-row-sub">Норма: ${row.thresholds.minNormal}–${row.thresholds.maxNormal} · много: до ${row.thresholds.overload}</div>
      ${topSources ? `<div class="help">Основное: ${escapeHTML(topSources)}</div>` : '<div class="help">За период почти не было упражнений на эту группу.</div>'}
    </div>`;
  }

  function renderMuscleAdvice(summary, buckets) {
    if (!summary.completedWorkouts) return '<div class="empty compact-empty"><strong>Пока рано делать выводы</strong>После нескольких сохранённых тренировок здесь появятся подсказки по перекосам.</div>';
    const notes = [];
    if (buckets.overloaded.length) notes.push(`<div class="notice danger"><strong>Перегруз:</strong><br>${escapeHTML(buckets.overloaded.map((row) => row.label).join(', '))}. На ближайшей тренировке лучше не добавлять вес и убрать 1–2 подхода на эти зоны.</div>`);
    if (buckets.high.length) notes.push(`<div class="notice warning"><strong>Много нагрузки:</strong><br>${escapeHTML(buckets.high.map((row) => row.label).join(', '))}. Нормально, если самочувствие хорошее, но следи за болью и восстановлением.</div>`);
    if (buckets.low.length) notes.push(`<div class="notice"><strong>Недобор:</strong><br>${escapeHTML(buckets.low.map((row) => row.label).join(', '))}. Можно добавить лёгкие подходы или не пропускать эти группы в следующем цикле.</div>`);
    if (!notes.length) notes.push('<div class="notice success"><strong>Баланс нормальный.</strong><br>По мышечным группам нет явного перекоса. Продолжай цикл без героизма и без резких скачков веса.</div>');
    return notes.join('');
  }


  function renderRecoveryProgress() {
    const rest = smartRestAnalysis({ includeTodayTraining: true });
    const analysis = deloadAnalysis({ days: 14 });
    const restRows = rest.signals.length ? rest.signals.map((signal) => `
      <div class="list-row">
        <div class="list-row-main"><div class="list-row-title">${escapeHTML(signal.title)}</div><div class="list-row-sub">${escapeHTML(signal.label)}</div></div>
        <span class="chip ${signal.weight >= 2 ? 'warning' : ''}">+${signal.weight}</span>
      </div>`).join('') : '<div class="empty compact-empty"><strong>Режим нормальный</strong>Календарь не похож на перетрен: отдых между тренировками учитывается.</div>';
    const deloadRows = analysis.signals.length ? analysis.signals.map((signal) => `
      <div class="list-row">
        <div class="list-row-main"><div class="list-row-title">${escapeHTML(signal.title)}</div><div class="list-row-sub">${escapeHTML(signal.label)}</div></div>
        <span class="chip ${signal.weight >= 2 ? 'warning' : ''}">+${signal.weight}</span>
      </div>`).join('') : '<div class="empty compact-empty"><strong>Сильных признаков усталости нет</strong>Пока можно продолжать цикл без разгрузочной недели.</div>';
    return `
      <section class="section">
        <div class="card smart-rest-card ${rest.status}">
          <div class="section-head"><h2>${escapeHTML(rest.title)}</h2><span class="chip ${rest.status === 'ok' ? 'success' : 'warning'}">${escapeHTML(rest.statusLabel)}</span></div>
          <p>${escapeHTML(rest.detailText)}</p>
          <div class="rest-week-strip" style="margin-top:12px">${rest.days.slice(0, 14).reverse().map((day) => `<div class="rest-day ${day.kind} ${day.loggedRest ? 'logged-rest' : ''}"><span>${escapeHTML(day.shortLabel)}</span><strong>${escapeHTML(day.shortDate)}</strong></div>`).join('')}</div>
          <div class="stats-grid" style="margin-top:12px">
            <div class="stat"><div class="stat-value">${rest.trainingDays7}</div><div class="stat-label">трен. за 7 дней</div></div>
            <div class="stat"><div class="stat-value">${rest.potentialConsecutiveTrainingDays}</div><div class="stat-label">подряд, если сегодня</div></div>
            <div class="stat"><div class="stat-value">${rest.fullRestDays7}</div><div class="stat-label">полный отдых</div></div>
            <div class="stat"><div class="stat-value">${rest.daysWithoutFullRest}</div><div class="stat-label">дней без отдыха</div></div>
          </div>
          <div class="button-row" style="margin-top:12px">
            <button class="button secondary" id="log-rest-progress" type="button" ${hasRecoveryDayForDate(todayISO()) ? 'disabled' : ''}>${hasRecoveryDayForDate(todayISO()) ? 'Сегодня отдых уже записан' : 'Записать отдых сегодня'}</button>
            <button class="button ghost" id="edit-past-activity-progress" type="button">Изменить прошлые дни</button>
          </div>
        </div>
      </section>
      <section class="section"><div class="section-head"><h2>Сигналы умного отдыха</h2><span class="muted">календарь + нагрузка</span></div><div class="card list-card">${restRows}</div></section>
      <section class="section">
        <div class="card deload-card ${analysis.status}">
          <div class="section-head"><h2>${escapeHTML(analysis.title)}</h2><span class="chip ${analysis.shouldSuggest ? 'warning' : 'success'}">${escapeHTML(analysis.statusLabel)}</span></div>
          <p>${escapeHTML(analysis.detailText)}</p>
          <div class="stats-grid" style="margin-top:12px">
            <div class="stat"><div class="stat-value">${analysis.completedCount}</div><div class="stat-label">тренировки</div></div>
            <div class="stat"><div class="stat-value">${analysis.score}</div><div class="stat-label">индекс усталости</div></div>
            <div class="stat"><div class="stat-value">${analysis.highPainCount}</div><div class="stat-label">сильная боль</div></div>
            <div class="stat"><div class="stat-value">${analysis.overloadGroups}</div><div class="stat-label">перегруз групп</div></div>
          </div>
        </div>
      </section>
      <section class="section"><div class="section-head"><h2>Признаки разгрузки</h2><span class="muted">14 дней</span></div><div class="card list-card">${deloadRows}</div></section>
      <section class="section"><div class="card deload-plan-card"><div class="section-head"><h2>Если включаешь разгрузку</h2></div>
        <div class="deload-plan-grid">
          <div><strong>Вес</strong><span>−15–20%</span></div>
          <div><strong>Подходы</strong><span>−30–40%</span></div>
          <div><strong>Отказ</strong><span>убрать полностью</span></div>
          <div><strong>Степпер</strong><span>лёгкий темп</span></div>
        </div>
        <div class="notice" style="margin-top:12px"><strong>Это предложение, не приказ.</strong><br>Приложение отличает тренировки подряд от схемы через день и не душнит, когда отдых по календарю был.</div>
      </div></section>`;
  }

  function weeklyTrainingReport() {
    const now = new Date();
    const from = startOfDay(new Date(now.getTime() - 6 * 86400000));
    const previousFrom = startOfDay(new Date(now.getTime() - 13 * 86400000));
    const current = completedWorkoutList(state.workouts).filter((workout) => new Date(workout.startedAt || workout.date || 0) >= from);
    const previous = completedWorkoutList(state.workouts).filter((workout) => {
      const date = new Date(workout.startedAt || workout.date || 0);
      return date >= previousFrom && date < from;
    });
    const minutes = Math.round(current.reduce((sum, workout) => sum + Number(workout.durationSec || 0), 0) / 60);
    const load = current.reduce((sum, workout) => sum + Number(workout.totalLoadKg || 0), 0);
    const sets = current.reduce((sum, workout) => sum + (workout.exercises || []).reduce((inner, result) => inner + completedSets(result).length, 0), 0);
    const records = current.reduce((sum, workout) => sum + (workout.records?.length || 0), 0);
    const completion = Math.round(avgCompletion(current));
    const previousLoad = previous.reduce((sum, workout) => sum + Number(workout.totalLoadKg || 0), 0);
    const loadDiff = previousLoad > 0 ? Math.round(((load - previousLoad) / previousLoad) * 100) : null;
    const progression = current.flatMap((workout) => workout.progression || []).filter((row) => row?.text);
    const increases = progression.filter((row) => row.kind === 'increase');
    const reductions = progression.filter((row) => row.kind === 'reduce');
    const recovery = smartWorkoutReadinessSummary();
    const ready = recovery.rows.filter((row) => row.recoveryStatus === 'ready').sort((a, b) => b.score - a.score);
    const caution = recovery.rows.filter((row) => row.recoveryStatus === 'caution');
    const muscles = muscleLoadSummary(7);
    const low = muscles.rows.filter((row) => row.status === 'low');
    const insight = !current.length
      ? 'На этой неделе пока нет завершённых тренировок.'
      : caution.length
        ? `Сначала восстанови: ${caution.map((row) => row.label).join(', ')}.`
        : ready.length
          ? `Следующий хороший фокус: ${ready.slice(0, 3).map((row) => row.label).join(', ')}.`
          : 'Продолжай цикл без резкого повышения нагрузки.';
    return { current, previous, minutes, load, sets, records, completion, loadDiff, progression, increases, reductions, recovery, ready, caution, low, insight };
  }

  function renderWeeklyTrainingReport() {
    const report = weeklyTrainingReport();
    const loadTrend = report.loadDiff === null ? 'нет прошлой недели' : `${report.loadDiff > 0 ? '+' : ''}${report.loadDiff}% к прошлой неделе`;
    return `
      <section class="section"><div class="card weekly-coach-hero"><span class="eyebrow">Умный отчёт за 7 дней</span><h2>${escapeHTML(report.insight)}</h2><p>${report.current.length ? `${report.current.length} тренировок · ${report.minutes} минут · ${report.sets} рабочих подходов` : 'После первой завершённой тренировки здесь появятся сравнения и следующий фокус.'}</p></div></section>
      <section class="section"><div class="stats-grid">
        <div class="stat"><div class="stat-value">${report.current.length}</div><div class="stat-label">тренировки</div></div>
        <div class="stat"><div class="stat-value">${report.completion || 0}%</div><div class="stat-label">выполнение</div></div>
        <div class="stat"><div class="stat-value">${formatCompactLoad(report.load)}</div><div class="stat-label">объём, кг</div></div>
        <div class="stat"><div class="stat-value">${report.records}</div><div class="stat-label">рекорды</div></div>
      </div><div class="help center" style="margin-top:8px">${escapeHTML(loadTrend)}</div></section>
      <section class="section"><div class="section-head"><h2>Прогрессия на следующий раз</h2><span class="muted">по завершённым упражнениям</span></div><div class="card weekly-progression-list">${report.progression.length ? report.progression.slice(0, 12).map((row) => `<div class="weekly-progression-row ${escapeAttr(row.kind || 'same')}"><span>${row.kind === 'increase' ? '↗' : row.kind === 'reduce' ? '↘' : '→'}</span><div><strong>${escapeHTML(row.exerciseName || getExercise(row.exerciseId)?.name || 'Упражнение')}</strong><small>${escapeHTML(row.text)}</small></div></div>`).join('') : '<div class="empty compact-empty"><strong>Пока нет рекомендаций</strong>Заверши тренировку — приложение разберёт каждое упражнение отдельно.</div>'}</div></section>
      <section class="section"><div class="section-head"><h2>Баланс недели</h2></div><div class="card list-card">
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Готовы к нагрузке</div><div class="list-row-sub">${escapeHTML(report.ready.length ? report.ready.map((row) => row.label).join(', ') : 'пока нет уверенно готовых групп')}</div></div><span class="chip success">${report.ready.length}</span></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Нужна осторожность</div><div class="list-row-sub">${escapeHTML(report.caution.length ? report.caution.map((row) => row.label).join(', ') : 'явных ограничений нет')}</div></div><span class="chip ${report.caution.length ? 'warning' : 'success'}">${report.caution.length}</span></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Недобор объёма</div><div class="list-row-sub">${escapeHTML(report.low.length ? report.low.map((row) => row.label).join(', ') : 'все основные группы получили нагрузку')}</div></div><span class="chip">${report.low.length}</span></div>
      </div></section>`;
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
    document.getElementById('progress-add-measurement')?.addEventListener('click', showMeasurementModal);
    document.getElementById('progress-add-photo')?.addEventListener('click', showPhotoModal);
    document.getElementById('add-measurement')?.addEventListener('click', showMeasurementModal);
    document.getElementById('measurement-history')?.addEventListener('click', showMeasurementsModal);
    document.getElementById('measurement-history-inline')?.addEventListener('click', showMeasurementsModal);
    document.getElementById('log-rest-progress')?.addEventListener('click', () => recordRecoveryDay({ source: 'progress' }));
    document.getElementById('edit-past-activity-progress')?.addEventListener('click', showPastActivityCalendarModal);
    el.main.querySelectorAll('.body-metric').forEach((button) => button.addEventListener('click', async () => {
      state.bodyProgressMetric = button.dataset.metric;
      state.settings.bodyProgressMetric = state.bodyProgressMetric;
      await DB.setSettingsObject({ bodyProgressMetric: state.bodyProgressMetric }, state.activeProfileId);
      renderProgress();
    }));
    el.main.querySelectorAll('.body-period').forEach((button) => button.addEventListener('click', async () => {
      state.bodyProgressPeriodDays = Number(button.dataset.days);
      state.settings.bodyProgressPeriodDays = state.bodyProgressPeriodDays;
      await DB.setSettingsObject({ bodyProgressPeriodDays: state.bodyProgressPeriodDays }, state.activeProfileId);
      renderProgress();
    }));
    el.main.querySelectorAll('.delete-measurement').forEach((button) => button.addEventListener('click', () => deleteMeasurement(button.dataset.id)));
    el.main.querySelectorAll('.muscle-period').forEach((button) => button.addEventListener('click', async () => {
      state.musclePeriodDays = Number(button.dataset.days) === 14 ? 14 : 7;
      state.settings.musclePeriodDays = state.musclePeriodDays;
      await DB.setSettingsObject({ musclePeriodDays: state.musclePeriodDays }, state.activeProfileId);
      renderProgress();
    }));
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
        <div class="field"><label>Комментарий</label><textarea id="measure-note" placeholder="Утро/вечер, после еды, отёки…"></textarea></div>
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

  function defaultProfileBuilderDraft(firstRun = false) {
    return {
      firstRun,
      step: 0,
      name: '',
      age: 30,
      heightCm: 175,
      weightKg: 75,
      scheduleMode: 'weekly',
      daysPerWeek: 4,
      durationMin: 45,
      priorityMuscles: [],
      goal: 'shape',
      level: 'regular',
      equipmentIds: ['bodyweight', 'mat', 'chair', 'dumbbells'],
      constraintAreas: [],
      customConstraint: '',
    };
  }

  function profileBuilderGoal(id) {
    return profileBuilderGoals.find((item) => item.id === id) || profileBuilderGoals[0];
  }

  function profileBuilderLevel(id) {
    return profileBuilderLevels.find((item) => item.id === id) || profileBuilderLevels[0];
  }

  function profileBuilderMuscleLabel(id) {
    return muscleGroups.find((item) => item.id === id)?.label || id;
  }

  function profileBuilderScheduleText(draft) {
    return draft.scheduleMode === 'every_other_day'
      ? 'Через день · тренировка и день отдыха по очереди'
      : `${draft.daysPerWeek} тренировок в неделю`;
  }

  function profileBuilderEquipmentValues(draft) {
    const selected = new Set(['bodyweight', ...(draft.equipmentIds || [])]);
    return profileBuilderEquipment.filter((item) => selected.has(item.id)).map((item) => item.value);
  }

  function profileBuilderConstraintValues(draft) {
    const values = (draft.constraintAreas || []).map((id) => {
      const area = profileBuilderConstraintAreas.find((item) => item.id === id);
      return area ? `Ограничение: ${area.label}` : '';
    }).filter(Boolean);
    if (draft.customConstraint?.trim()) values.push(draft.customConstraint.trim());
    return values;
  }

  function profileBuilderHeader(draft) {
    const titles = [
      ['Кто будет тренироваться?', 'Основные данные профиля'],
      ['Как строим расписание?', 'Частота и длительность'],
      ['Что хочется развивать?', 'Выбери приоритетные мышцы'],
      ['Опыт и главная цель', 'Это настроит объём и сложность'],
      ['Какое оборудование доступно?', 'Предлагаться будут только выполнимые упражнения'],
      ['Есть ограничения?', 'Опасные варианты исключим из программы'],
      ['Готовая программа', 'Проверь план перед созданием профиля'],
    ];
    const [title, subtitle] = titles[draft.step] || titles[0];
    return { title, subtitle };
  }

  function profileBuilderProgress(draft) {
    return `<div class="profile-builder-progress" aria-label="Шаг ${draft.step + 1} из 7"><span style="width:${Math.round(((draft.step + 1) / 7) * 100)}%"></span></div>`;
  }

  function profileBuilderOption({ value, active, label, note = '', icon = '' }, className = '') {
    return `<button class="profile-builder-option ${className} ${active ? 'active' : ''}" type="button" data-value="${escapeAttr(value)}">${icon ? `<span>${icon}</span>` : ''}<strong>${escapeHTML(label)}</strong>${note ? `<small>${escapeHTML(note)}</small>` : ''}</button>`;
  }

  function renderProfileBuilderStep(draft) {
    if (draft.step === 0) {
      return `<div class="form-grid profile-builder-personal">
        <div class="field"><label>Имя</label><input id="builder-name" autocomplete="name" placeholder="Например: Лёха" value="${escapeAttr(draft.name)}"></div>
        <div class="inline-fields three">
          <div class="field"><label>Возраст</label><input id="builder-age" type="number" min="14" max="100" value="${draft.age}"></div>
          <div class="field"><label>Рост, см</label><input id="builder-height" type="number" min="120" max="230" value="${draft.heightCm}"></div>
          <div class="field"><label>Вес, кг</label><input id="builder-weight" type="number" min="35" max="250" step="0.1" value="${draft.weightKg}"></div>
        </div>
        <div class="notice"><strong>Без регистрации.</strong><br>Профиль, программа, история и замеры останутся только на этом устройстве.</div>
      </div>`;
    }
    if (draft.step === 1) {
      return `<div class="profile-builder-stack">
        <div class="profile-builder-question"><strong>Режим тренировок</strong><span>Можно изменить план вручную после создания</span></div>
        <div class="profile-builder-grid two" data-builder-group="scheduleMode">
          ${profileBuilderOption({ value: 'weekly', active: draft.scheduleMode === 'weekly', label: 'По дням в неделю', note: 'Выбери от 2 до 6 тренировок', icon: '7' })}
          ${profileBuilderOption({ value: 'every_other_day', active: draft.scheduleMode === 'every_other_day', label: 'Через день', note: 'Тренировка → отдых → тренировка', icon: '↔' })}
        </div>
        ${draft.scheduleMode === 'weekly' ? `<div class="profile-builder-question"><strong>Сколько тренировок в неделю</strong><span>Регулярность важнее максимума</span></div>
          <div class="profile-builder-grid five compact" data-builder-group="daysPerWeek">
            ${[2,3,4,5,6].map((value) => profileBuilderOption({ value, active: draft.daysPerWeek === value, label: String(value) })).join('')}
          </div>` : `<div class="notice success"><strong>Плавающий график.</strong><br>В одной неделе получится 3 тренировки, в другой — 4. Пропуск не ломает цикл.</div>`}
        <div class="profile-builder-question"><strong>Сколько времени на одну тренировку</strong><span>Примерная длительность</span></div>
        <div class="profile-builder-grid four compact" data-builder-group="durationMin">
          ${[20,30,45,60].map((value) => profileBuilderOption({ value, active: draft.durationMin === value, label: `${value} мин` })).join('')}
        </div>
      </div>`;
    }
    if (draft.step === 2) {
      const balanced = !(draft.priorityMuscles || []).length;
      return `<div class="profile-builder-stack">
        <div class="profile-builder-grid two muscle-grid" data-builder-group="muscles">
          ${profileBuilderOption({ value: 'balanced', active: balanced, label: 'Всё тело равномерно', note: 'Без отдельного приоритета', icon: '◎' }, 'wide')}
          ${muscleGroups.map((group) => profileBuilderOption({ value: group.id, active: draft.priorityMuscles.includes(group.id), label: group.label, note: group.hint, icon: '•' })).join('')}
        </div>
        <div class="help">Можно выбрать несколько групп. Остальные мышцы всё равно останутся в программе для баланса.</div>
      </div>`;
    }
    if (draft.step === 3) {
      return `<div class="profile-builder-stack">
        <div class="profile-builder-question"><strong>Уровень подготовки</strong><span>Определи честно — веса потом подстроятся</span></div>
        <div class="profile-builder-grid three" data-builder-group="level">
          ${profileBuilderLevels.map((item) => profileBuilderOption({ value: item.id, active: draft.level === item.id, label: item.label, note: item.note })).join('')}
        </div>
        <div class="profile-builder-question"><strong>Главная цель</strong><span>Выбери одну основную</span></div>
        <div class="profile-builder-grid two" data-builder-group="goal">
          ${profileBuilderGoals.map((item) => profileBuilderOption({ value: item.id, active: draft.goal === item.id, label: item.label, note: item.note })).join('')}
        </div>
      </div>`;
    }
    if (draft.step === 4) {
      const selected = new Set(draft.equipmentIds || []);
      return `<div class="profile-builder-stack">
        <div class="profile-builder-presets">
          <button class="button secondary" id="builder-equipment-ship" type="button">Выбрать наш зал</button>
          <button class="button ghost" id="builder-equipment-minimal" type="button">Только без железа</button>
        </div>
        <div class="profile-builder-grid two equipment-grid" data-builder-group="equipment">
          ${profileBuilderEquipment.map((item) => profileBuilderOption({ value: item.id, active: item.always || selected.has(item.id), label: item.label, note: item.always ? 'Всегда доступно' : '' }, item.always ? 'locked' : '')).join('')}
        </div>
      </div>`;
    }
    if (draft.step === 5) {
      const none = !(draft.constraintAreas || []).length && !String(draft.customConstraint || '').trim();
      return `<div class="profile-builder-stack">
        <div class="profile-builder-grid two constraints-grid" data-builder-group="constraints">
          ${profileBuilderOption({ value: 'none', active: none, label: 'Нет ограничений', note: 'Можно продолжить без отметок', icon: '✓' }, 'wide')}
          ${profileBuilderConstraintAreas.map((item) => profileBuilderOption({ value: item.id, active: draft.constraintAreas.includes(item.id), label: item.label })).join('')}
        </div>
        <div class="field"><label>Другое — необязательно</label><textarea id="builder-custom-constraint" placeholder="Например: нельзя прыгать, осторожно после операции…">${escapeHTML(draft.customConstraint || '')}</textarea></div>
        <div class="notice warning"><strong>Это фильтр упражнений, а не медицинский диагноз.</strong><br>При сильной или новой боли тренировку лучше отложить и обратиться к врачу.</div>
      </div>`;
    }
    const preview = buildProfileProgram(draft, 'preview-profile', true);
    const priorities = draft.priorityMuscles.length ? draft.priorityMuscles.map(profileBuilderMuscleLabel).join(', ') : 'всё тело равномерно';
    return `<div class="profile-builder-preview">
      <div class="profile-builder-summary">
        <div><span>График</span><strong>${escapeHTML(profileBuilderScheduleText(draft))}</strong></div>
        <div><span>Длительность</span><strong>≈ ${draft.durationMin} мин</strong></div>
        <div><span>Приоритет</span><strong>${escapeHTML(priorities)}</strong></div>
        <div><span>Цель</span><strong>${escapeHTML(profileBuilderGoal(draft.goal).label)}</strong></div>
      </div>
      <div class="profile-builder-days">
        ${preview.days.map((day, index) => `<details class="profile-builder-day" ${index === 0 ? 'open' : ''}>
          <summary><span class="day-badge small-badge">${index + 1}</span><span><strong>${escapeHTML(day.name)}</strong><small>≈ ${day.durationMin} мин · ${day.exercises.length} упражнений</small></span><b>⌄</b></summary>
          <div>${day.exercises.map((entry, exerciseIndex) => { const exercise = getExercise(entry.exerciseId); return `<p><span>${exerciseIndex + 1}</span><strong>${escapeHTML(exercise?.name || entry.exerciseId)}</strong><small>${escapeHTML(workPrescription(exercise, entry))}</small></p>`; }).join('')}</div>
        </details>`).join('')}
      </div>
      <div class="notice success"><strong>После создания всё редактируется.</strong><br>В разделе «План» можно менять упражнения, подходы, порядок и названия дней.</div>
    </div>`;
  }

  function renderProfileBuilder() {
    const draft = state.profileBuilder || defaultProfileBuilderDraft(!state.profiles.length);
    state.profileBuilder = draft;
    const header = profileBuilderHeader(draft);
    const shell = `
      <div class="profile-builder-shell">
        ${profileBuilderProgress(draft)}
        <div class="profile-builder-heading"><div class="eyebrow">Шаг ${draft.step + 1} из 7</div><h2>${escapeHTML(header.title)}</h2><p>${escapeHTML(header.subtitle)}</p></div>
        ${renderProfileBuilderStep(draft)}
        <div class="profile-builder-actions">
          ${draft.step > 0 ? '<button class="button ghost" id="profile-builder-back" type="button">Назад</button>' : ''}
          <button class="button primary" id="profile-builder-next" type="button">${draft.step === 6 ? 'Создать профиль и программу' : 'Далее'}</button>
        </div>
      </div>`;
    if (draft.firstRun) {
      document.querySelector('.bottom-nav').classList.add('hidden');
      el.quickAdd.classList.add('hidden');
      el.profileSwitch.classList.add('hidden');
      setTopbar('Настройка профиля', 'Первый запуск');
      el.main.innerHTML = `<section class="section onboarding-section"><div class="card profile-builder-card">${shell}</div></section>`;
    } else {
      showModal(`<div class="modal-head"><div><div class="eyebrow">Новый профиль</div><h2>Конструктор программы</h2></div><button class="modal-close" data-close>×</button></div>${shell}`);
    }
    bindProfileBuilderEvents(draft.firstRun ? document : el.modalRoot);
  }

  function readProfileBuilderInputs(root) {
    const draft = state.profileBuilder;
    if (!draft) return;
    if (draft.step === 0) {
      draft.name = root.querySelector('#builder-name')?.value.trim() || '';
      draft.age = Math.max(14, Math.min(100, Number(root.querySelector('#builder-age')?.value || 30)));
      draft.heightCm = Math.max(120, Math.min(230, Number(root.querySelector('#builder-height')?.value || 175)));
      draft.weightKg = Math.max(35, Math.min(250, Number(root.querySelector('#builder-weight')?.value || 75)));
    }
    if (draft.step === 5) draft.customConstraint = root.querySelector('#builder-custom-constraint')?.value.trim() || '';
  }

  function bindProfileBuilderEvents(root) {
    const draft = state.profileBuilder;
    if (!draft) return;
    root.querySelectorAll('[data-builder-group]').forEach((group) => {
      group.querySelectorAll('.profile-builder-option').forEach((button) => button.addEventListener('click', () => {
        readProfileBuilderInputs(root);
        const key = group.dataset.builderGroup;
        const value = button.dataset.value;
        if (button.classList.contains('locked')) return;
        if (key === 'scheduleMode') {
          draft.scheduleMode = value;
          renderProfileBuilder();
          return;
        }
        if (key === 'daysPerWeek') draft.daysPerWeek = Number(value);
        else if (key === 'durationMin') draft.durationMin = Number(value);
        else if (key === 'level') draft.level = value;
        else if (key === 'goal') draft.goal = value;
        else if (key === 'muscles') {
          if (value === 'balanced') draft.priorityMuscles = [];
          else {
            const selected = new Set(draft.priorityMuscles || []);
            selected.has(value) ? selected.delete(value) : selected.add(value);
            draft.priorityMuscles = [...selected];
          }
        } else if (key === 'equipment') {
          const selected = new Set(draft.equipmentIds || []);
          selected.has(value) ? selected.delete(value) : selected.add(value);
          selected.add('bodyweight');
          draft.equipmentIds = [...selected];
        } else if (key === 'constraints') {
          if (value === 'none') {
            draft.constraintAreas = [];
            draft.customConstraint = '';
          } else {
            const selected = new Set(draft.constraintAreas || []);
            selected.has(value) ? selected.delete(value) : selected.add(value);
            draft.constraintAreas = [...selected];
          }
        }
        renderProfileBuilder();
      }));
    });
    root.querySelector('#builder-equipment-ship')?.addEventListener('click', () => {
      draft.equipmentIds = profileBuilderEquipment.map((item) => item.id);
      renderProfileBuilder();
    });
    root.querySelector('#builder-equipment-minimal')?.addEventListener('click', () => {
      draft.equipmentIds = ['bodyweight', 'mat', 'chair'];
      renderProfileBuilder();
    });
    root.querySelector('#profile-builder-back')?.addEventListener('click', () => {
      readProfileBuilderInputs(root);
      draft.step = Math.max(0, draft.step - 1);
      renderProfileBuilder();
    });
    root.querySelector('#profile-builder-next')?.addEventListener('click', async () => {
      readProfileBuilderInputs(root);
      if (draft.step === 0 && !draft.name) return toast('Введи имя профиля');
      if (draft.step < 6) {
        draft.step += 1;
        renderProfileBuilder();
        return;
      }
      await createProfileFromBuilder(draft);
    });
  }

  function profileExerciseAvailable(exercise, equipmentIds) {
    if (!exercise) return false;
    const selected = new Set(['bodyweight', ...(equipmentIds || [])]);
    const text = String(exercise.equipment || '').toLowerCase();
    if (text.includes('штанга или гантели')) return selected.has('barbell') || selected.has('dumbbells');
    if (text.includes('гантели или собственный вес')) return true;
    if (text.includes('стул / собственный вес')) return true;
    if (text.includes('мультитренаж') && !selected.has('multigym')) return false;
    if (text.includes('степпер') && !selected.has('stepper')) return false;
    if (text.includes('ролик') && !selected.has('roller')) return false;
    if (text.includes('брусья') && !selected.has('dips')) return false;
    if (text.includes('упоры для отжиманий') && !selected.has('pushup-handles')) return false;
    if (text.includes('стойки') && !selected.has('rack')) return false;
    if (text.includes('скамья') && !selected.has('bench')) return false;
    if (text.includes('штанг') && !selected.has('barbell')) return false;
    if (text.includes('гантел') && !selected.has('dumbbells')) return false;
    if (text.includes('коврик') && !selected.has('mat')) return false;
    if (text.includes('стул') && !(selected.has('chair') || selected.has('bench'))) return false;
    if (exercise.id === 'barbell-squat' && !(selected.has('barbell') && selected.has('rack'))) return false;
    return true;
  }

  function profileExerciseAllowed(exercise, draft) {
    if (!profileExerciseAvailable(exercise, draft.equipmentIds)) return false;
    if ((draft.level === 'beginner' || draft.goal === 'return') && profileBuilderAdvancedExerciseIds.has(exercise.id)) return false;
    if ((draft.constraintAreas || []).some((areaId) => exerciseMatchesPainRule(exercise, painRiskRules[areaId]))) return false;
    return true;
  }

  function profileProgramBlueprints(draft) {
    const count = draft.scheduleMode === 'every_other_day' ? 4 : Math.max(2, Math.min(6, Number(draft.daysPerWeek || 4)));
    const presets = {
      2: [
        { name: 'Всё тело A', groups: ['legs', 'chest', 'back', 'abs'] },
        { name: 'Всё тело B', groups: ['glutes', 'back', 'shoulders', 'abs'] },
      ],
      3: [
        { name: 'Верх тела', groups: ['chest', 'back', 'shoulders', 'triceps'] },
        { name: 'Ноги и ягодицы', groups: ['legs', 'glutes', 'abs'] },
        { name: 'Всё тело + приоритет', groups: ['back', 'chest', 'legs', 'abs', 'biceps'] },
      ],
      4: [
        { name: 'Верх тела A', groups: ['chest', 'back', 'shoulders', 'triceps'] },
        { name: 'Низ тела A', groups: ['legs', 'glutes', 'abs'] },
        { name: 'Верх тела B', groups: ['back', 'chest', 'shoulders', 'biceps'] },
        { name: 'Низ тела B + кор', groups: ['glutes', 'legs', 'abs'] },
      ],
      5: [
        { name: 'Грудь, плечи + трицепс', groups: ['chest', 'shoulders', 'triceps'] },
        { name: 'Спина + бицепс', groups: ['back', 'biceps', 'shoulders'] },
        { name: 'Ноги', groups: ['legs', 'glutes', 'abs'] },
        { name: 'Верх тела + приоритет', groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
        { name: 'Ягодицы + кор', groups: ['glutes', 'legs', 'abs'] },
      ],
      6: [
        { name: 'Жимовой верх A', groups: ['chest', 'shoulders', 'triceps'] },
        { name: 'Тяговый верх A', groups: ['back', 'biceps', 'shoulders'] },
        { name: 'Ноги A', groups: ['legs', 'glutes', 'abs'] },
        { name: 'Жимовой верх B', groups: ['chest', 'shoulders', 'triceps'] },
        { name: 'Тяговый верх B', groups: ['back', 'biceps', 'shoulders'] },
        { name: 'Ноги B + кор', groups: ['glutes', 'legs', 'abs'] },
      ],
    };
    const blueprints = clone(presets[count]);
    const priorities = draft.priorityMuscles || [];
    const upperGroups = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']);
    const lowerGroups = new Set(['legs', 'glutes']);
    const desiredPriorityFrequency = count >= 4 ? 2 : count === 2 ? 2 : 1;
    for (const priority of priorities) {
      let currentFrequency = blueprints.filter((day) => day.groups.includes(priority)).length;
      while (currentFrequency < desiredPriorityFrequency) {
        const compatible = blueprints.filter((day) => {
          if (day.groups.includes(priority)) return false;
          if (upperGroups.has(priority)) return day.groups.some((group) => upperGroups.has(group));
          if (lowerGroups.has(priority)) return day.groups.some((group) => lowerGroups.has(group));
          return true;
        });
        const target = (compatible.length ? compatible : blueprints.filter((day) => !day.groups.includes(priority)))
          .slice()
          .sort((a, b) => a.groups.length - b.groups.length)[0];
        if (!target) break;
        target.groups.unshift(priority);
        currentFrequency += 1;
      }
    }
    return blueprints;
  }

  function profileProgramExerciseEntry(exercise, draft) {
    const entry = { exerciseId: exercise.id };
    const unit = exercise.defaults?.unit || 'reps';
    const compound = profileBuilderCompoundIds.has(exercise.id);
    let sets = draft.level === 'beginner' || draft.goal === 'return' ? 2 : draft.level === 'experienced' ? (compound ? 4 : 3) : 3;
    if (draft.durationMin <= 30) sets = Math.min(sets, 3);
    entry.sets = sets;
    if (unit === 'reps') {
      if (draft.goal === 'strength' && compound) {
        entry.repsMin = 5;
        entry.repsMax = 8;
        entry.restSec = 120;
      } else if (draft.goal === 'weight' || draft.goal === 'shape') {
        entry.repsMin = Math.max(8, Number(exercise.defaults.repsMin || 8));
        entry.repsMax = Math.max(entry.repsMin + 2, Math.min(15, Number(exercise.defaults.repsMax || 12)));
        entry.restSec = Math.min(75, Number(exercise.defaults.restSec || 60));
      } else if (draft.goal === 'return') {
        entry.repsMin = 8;
        entry.repsMax = 12;
        entry.restSec = Math.max(60, Number(exercise.defaults.restSec || 60));
      }
    }
    if (unit === 'seconds' && draft.level === 'beginner') entry.durationSec = Math.max(20, Math.round(Number(exercise.defaults.durationSec || 30) * 0.75));
    return entry;
  }

  function profileProgramCandidate(groupId, draft, used, selected, dayIndex, round) {
    const pool = smartWorkoutExercisePools[groupId] || [];
    const candidates = pool.map((id) => getExercise(id)).filter((exercise) => exercise && !selected.has(exercise.id) && profileExerciseAllowed(exercise, draft));
    candidates.sort((a, b) => {
      const usageDiff = (used.get(a.id) || 0) - (used.get(b.id) || 0);
      if (usageDiff) return usageDiff;
      const compoundDiff = Number(profileBuilderCompoundIds.has(b.id)) - Number(profileBuilderCompoundIds.has(a.id));
      if (round === 0 && compoundDiff) return compoundDiff;
      return (smartStringScore(`${a.id}:${dayIndex}:${round}`) % 101) - (smartStringScore(`${b.id}:${dayIndex}:${round}`) % 101);
    });
    return candidates[0] || null;
  }

  function buildProfileProgram(draft, profileId, preview = false) {
    const createdAt = new Date().toISOString();
    const blueprints = profileProgramBlueprints(draft);
    const used = new Map();
    const prioritySet = new Set(draft.priorityMuscles || []);
    const targetCount = draft.durationMin <= 20 ? 3 : draft.durationMin <= 30 ? 4 : draft.durationMin <= 45 ? 5 : 6;
    const days = blueprints.map((blueprint, dayIndex) => {
      const groups = [...new Set([...blueprint.groups].sort((a, b) => Number(prioritySet.has(b)) - Number(prioritySet.has(a))))];
      const selected = new Set();
      const work = [];
      for (let round = 0; work.length < targetCount && round < 4; round += 1) {
        for (const groupId of groups) {
          if (work.length >= targetCount) break;
          const exercise = profileProgramCandidate(groupId, draft, used, selected, dayIndex, round);
          if (!exercise) continue;
          selected.add(exercise.id);
          used.set(exercise.id, (used.get(exercise.id) || 0) + 1);
          work.push(profileProgramExerciseEntry(exercise, draft));
        }
      }
      if (work.length < targetCount) {
        for (const groupId of ['chest', 'back', 'legs', 'glutes', 'shoulders', 'abs', 'biceps', 'triceps']) {
          if (work.length >= targetCount) break;
          const exercise = profileProgramCandidate(groupId, draft, used, selected, dayIndex, 5);
          if (!exercise) continue;
          selected.add(exercise.id);
          used.set(exercise.id, (used.get(exercise.id) || 0) + 1);
          work.push(profileProgramExerciseEntry(exercise, draft));
        }
      }
      if ((draft.goal === 'weight' || draft.goal === 'shape') && draft.durationMin >= 45 && profileExerciseAllowed(getExercise('stepper-short'), draft) && !selected.has('stepper-short')) {
        work.push({ exerciseId: 'stepper-short', durationMin: draft.durationMin >= 60 ? 10 : 6 });
      }
      const warmupMinutes = draft.durationMin <= 20 ? 3 : draft.durationMin <= 30 ? 4 : draft.durationMin >= 60 ? 7 : 5;
      const exercises = [{ exerciseId: 'warmup-joints', durationMin: warmupMinutes }, ...work];
      const focusLabels = groups.slice(0, 4).map(profileBuilderMuscleLabel);
      return {
        id: preview ? `preview-day-${dayIndex + 1}` : uid('day'),
        name: blueprint.name,
        durationMin: draft.durationMin,
        focus: focusLabels.join(', '),
        exercises,
        short: exercises.slice(0, Math.min(5, exercises.length)).map((entry) => entry.exerciseId),
      };
    });
    const scheduleText = profileBuilderScheduleText(draft);
    return {
      id: preview ? 'preview-program' : uid(`program-${profileId}`),
      name: 'Моя стартовая программа',
      description: `${scheduleText} · около ${draft.durationMin} мин · цель: ${profileBuilderGoal(draft.goal).label.toLowerCase()}.`,
      ownerProfileId: profileId,
      templateId: 'generated-profile-program',
      generatedBy: 'profile-builder-v1',
      scheduleMode: draft.scheduleMode,
      daysPerWeek: draft.scheduleMode === 'weekly' ? draft.daysPerWeek : null,
      durationMin: draft.durationMin,
      priorityMuscles: [...(draft.priorityMuscles || [])],
      trainingGoal: draft.goal,
      trainingLevel: draft.level,
      createdAt,
      updatedAt: createdAt,
      days,
    };
  }

  function showProfileOnboarding() {
    state.profileBuilder = defaultProfileBuilderDraft(true);
    renderProfileBuilder();
  }

  function showCreateProfileModal() {
    state.profileBuilder = defaultProfileBuilderDraft(false);
    renderProfileBuilder();
  }

  async function createProfileFromBuilder(draft) {
    if (!draft?.name?.trim()) return toast('Введи имя профиля');
    const profileId = uid('profile');
    const personalProgram = buildProfileProgram(draft, profileId, false);
    if (!personalProgram.days.length || personalProgram.days.some((day) => day.exercises.length < 2)) return toast('Не удалось собрать программу. Проверь оборудование и ограничения');
    const goal = profileBuilderGoal(draft.goal);
    const priorities = draft.priorityMuscles.length ? draft.priorityMuscles.map(profileBuilderMuscleLabel) : ['Всё тело равномерно'];
    const profile = {
      id: profileId,
      name: draft.name.trim(),
      age: Number(draft.age || 30),
      heightCm: Number(draft.heightCm || 175),
      currentWeightKg: Number(draft.weightKg || 75),
      goals: [goal.label, ...priorities.map((label) => `Приоритет: ${label}`)],
      equipment: profileBuilderEquipmentValues(draft),
      constraints: profileBuilderConstraintValues(draft),
      progressNote: '',
      trainingPreferences: {
        scheduleMode: draft.scheduleMode,
        daysPerWeek: draft.scheduleMode === 'weekly' ? draft.daysPerWeek : null,
        durationMin: draft.durationMin,
        priorityMuscles: [...draft.priorityMuscles],
        goal: draft.goal,
        level: draft.level,
        equipmentIds: [...draft.equipmentIds],
        constraintAreas: [...draft.constraintAreas],
      },
    };
    await DB.put('programs', personalProgram);
    const settings = {
      ...clone(window.NIKITA_SEED.settings),
      activeProgramId: personalProgram.id,
      currentDayIndex: 0,
      scheduleMode: draft.scheduleMode,
      daysPerWeek: draft.scheduleMode === 'weekly' ? draft.daysPerWeek : null,
      workoutDurationMin: draft.durationMin,
      priorityMuscles: [...draft.priorityMuscles],
      trainingGoal: draft.goal,
      trainingLevel: draft.level,
      lastBackupAt: null,
    };
    await DB.createProfile(profile, clone(window.NIKITA_SEED.nutrition), settings);
    await DB.put('measurements', {
      id: uid('measurement'), profileId, date: todayISO(), weightKg: profile.currentWeightKg,
      waistCm: null, abdomenCm: null, chestCm: null, hipsCm: null, armCm: null,
      note: 'Стартовый вес при создании профиля.',
    });
    state.profileBuilder = null;
    clearInterval(state.workoutClockInterval);
    state.currentWorkout = null;
    closeModal();
    await loadState();
    await ensurePersonalActiveProgram();
    document.querySelector('.bottom-nav').classList.remove('hidden');
    el.quickAdd.classList.remove('hidden');
    el.profileSwitch.classList.remove('hidden');
    toast(`Профиль «${profile.name}» и программа созданы`);
    navigate('home');
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
              <span class="list-row-main"><span class="list-row-title">${escapeHTML(profile.name)}</span><span class="list-row-sub">${profile.age || '—'} лет · ${profile.heightCm || '—'} см · ${profile.id === state.activeProfileId ? formatBodyValue(latestProfileWeightKg()) : (profile.currentWeightKg || '—')} кг${profile.id === state.activeProfileId ? ' · выбран' : ''}</span></span>
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
    stopRestTimer();
    clearInterval(state.workoutClockInterval);
    await DB.setActiveProfileId(profileId);
    state.activeProfileId = profileId;
    await loadActiveProfileData();
    await ensurePersonalActiveProgram();
    await restoreDraftWorkout();
    closeModal();
    toast(`Выбран профиль «${state.profile.name}»`);
    navigate('home');
    syncPushAutomationSettings({ silent: true }).catch((error) => console.warn('Push schedule sync after profile switch failed', error));
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

  function openMoreGroup(groupId, targetSelector = '') {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.open = true;
    requestAnimationFrame(() => {
      const target = targetSelector ? group.querySelector(targetSelector) : group;
      (target || group).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function nutritionMealOptions() {
    return [
      { id: 'breakfast', label: 'Завтрак', icon: '☀', note: 'Начало дня' },
      { id: 'lunch', label: 'Обед', icon: '◐', note: 'Основной приём' },
      { id: 'dinner', label: 'Ужин', icon: '◒', note: 'Вечером' },
      { id: 'snack', label: 'Перекусы', icon: '◇', note: 'Между приёмами' },
    ];
  }

  function nutritionMealMeta(mealId) {
    return nutritionMealOptions().find((meal) => meal.id === mealId) || nutritionMealOptions()[3];
  }

  function defaultNutritionMeal() {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    if (hour < 21) return 'dinner';
    return 'snack';
  }

  function normalizeFoodSearch(value = '') {
    return String(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function foodSearchText(food) {
    return normalizeFoodSearch([
      food?.name,
      ...(Array.isArray(food?.aliases) ? food.aliases : []),
      food?.brand,
      food?.barcode,
      food?.category,
      food?.subcategory,
      food?.search,
    ].filter(Boolean).join(' '));
  }

  function foodTypeLabel(food) {
    if (food?.custom) {
      if (food.type === 'dish') return 'Своё блюдо';
      if (food.type === 'beverage') return 'Свой напиток';
      if (food.type === 'supplement') return 'Свой спортпит';
      return 'Свой продукт';
    }
    if (food?.type === 'dish') return 'Готовое блюдо';
    if (food?.type === 'beverage') return food.subcategory || 'Напиток';
    if (food?.type === 'supplement') return food.subcategory || 'Спортивное питание';
    if (food?.type === 'branded') return food.brand || 'Магазинный товар';
    return food?.category || 'Продукт';
  }

  function customFoodRecords() {
    return state.savedFoods.filter((record) => record.recordType === 'custom' && record.food?.id);
  }

  function customFoods() {
    return customFoodRecords().map((record) => ({
      ...record.food,
      custom: true,
      savedRecordId: record.id,
      favorite: record.favorite !== false,
    }));
  }

  function favoriteRecordForFood(foodId) {
    return state.savedFoods.find((record) => record.recordType === 'favorite' && record.foodId === foodId) || null;
  }

  function customRecordForFood(foodId) {
    return customFoodRecords().find((record) => record.food.id === foodId) || null;
  }

  function isFoodFavorite(food) {
    if (!food?.id) return false;
    const customRecord = customRecordForFood(food.id);
    if (customRecord) return customRecord.favorite !== false;
    return Boolean(favoriteRecordForFood(food.id));
  }

  function foodSnapshot(food) {
    return {
      id: food.id,
      type: food.type || 'generic',
      custom: Boolean(food.custom),
      name: String(food.name || 'Без названия'),
      aliases: Array.isArray(food.aliases) ? food.aliases.slice(0, 12) : [],
      brand: food.brand || null,
      barcode: food.barcode || null,
      category: food.category || 'Другое',
      subcategory: food.subcategory || null,
      nutrition: {
        basis: Number(food.nutrition?.basis || 100),
        unit: food.nutrition?.unit || 'g',
        kcal: Number(food.nutrition?.kcal || 0),
        protein: Number(food.nutrition?.protein || 0),
        fat: Number(food.nutrition?.fat || 0),
        carbs: Number(food.nutrition?.carbs || 0),
        fiber: food.nutrition?.fiber !== null && food.nutrition?.fiber !== undefined && Number.isFinite(Number(food.nutrition.fiber)) ? Number(food.nutrition.fiber) : null,
        sugar: food.nutrition?.sugar !== null && food.nutrition?.sugar !== undefined && Number.isFinite(Number(food.nutrition.sugar)) ? Number(food.nutrition.sugar) : null,
        sodiumMg: food.nutrition?.sodiumMg !== null && food.nutrition?.sodiumMg !== undefined && Number.isFinite(Number(food.nutrition.sodiumMg)) ? Number(food.nutrition.sodiumMg) : null,
        caffeineMg: food.nutrition?.caffeineMg !== null && food.nutrition?.caffeineMg !== undefined && Number.isFinite(Number(food.nutrition.caffeineMg)) ? Number(food.nutrition.caffeineMg) : null,
        alcoholG: food.nutrition?.alcoholG !== null && food.nutrition?.alcoholG !== undefined && Number.isFinite(Number(food.nutrition.alcoholG)) ? Number(food.nutrition.alcoholG) : null,
      },
      portions: (Array.isArray(food.portions) ? food.portions : [])
        .filter((portion) => Number(portion?.grams) > 0)
        .slice(0, 20)
        .map((portion, index) => ({
          id: portion.id || `p${index + 1}`,
          label: String(portion.label || 'порция'),
          grams: Number(portion.grams),
        })),
      source: food.source ? clone(food.source) : null,
      note: food.note || null,
      search: foodSearchText(food),
    };
  }

  function foodFromEntry(entry) {
    if (entry?.foodSnapshot?.id) return { ...entry.foodSnapshot, custom: Boolean(entry.foodSnapshot.custom) };
    const found = findNutritionFood(entry?.foodId);
    if (found) return found;
    return {
      id: entry?.foodId || uid('missing-food'),
      type: 'generic',
      name: entry?.name || 'Продукт',
      brand: entry?.brand || null,
      category: 'Другое',
      nutrition: entry?.per100 || { basis: 100, unit: 'g', kcal: 0, protein: 0, fat: 0, carbs: 0 },
      portions: [],
    };
  }

  function findNutritionFood(foodId) {
    if (!foodId) return null;
    return customFoods().find((food) => food.id === foodId)
      || state.foodDatabase.find((food) => food.id === foodId)
      || state.savedFoods.find((record) => record.recordType === 'favorite' && record.foodId === foodId)?.food
      || null;
  }

  function favoriteFoods() {
    const rows = [];
    for (const record of state.savedFoods) {
      if (record.recordType === 'custom' && record.favorite !== false && record.food?.id) {
        rows.push({ ...record.food, custom: true, savedRecordId: record.id });
      } else if (record.recordType === 'favorite' && record.food?.id) {
        rows.push(record.food);
      }
    }
    return uniqueFoods(rows);
  }

  function recentFoods(limit = 12) {
    const rows = [];
    const seen = new Set();
    for (const entry of [...state.foodEntries].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))) {
      if (!entry.foodId || seen.has(entry.foodId)) continue;
      seen.add(entry.foodId);
      rows.push(foodFromEntry(entry));
      if (rows.length >= limit) break;
    }
    return rows;
  }

  function uniqueFoods(foods) {
    const seen = new Set();
    return foods.filter((food) => {
      if (!food?.id || seen.has(food.id)) return false;
      seen.add(food.id);
      return true;
    });
  }

  function balancedFoodsBySubcategory(foods, limit = 180) {
    const groups = new Map();
    for (const food of foods) {
      const key = food.subcategory || food.category || 'Другое';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(food);
    }
    const queues = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ru'))
      .map(([, rows]) => rows.sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    const result = [];
    let hasRows = true;
    while (result.length < limit && hasRows) {
      hasRows = false;
      for (const queue of queues) {
        if (!queue.length || result.length >= limit) continue;
        hasRows = true;
        result.push(queue.shift());
      }
    }
    return result;
  }

  function nutritionCatalog() {
    return uniqueFoods([...customFoods(), ...state.foodDatabase]);
  }

  function foodMatchScore(food, query) {
    const normalized = normalizeFoodSearch(query);
    if (!normalized) return 0;
    const name = normalizeFoodSearch(food.name);
    const brand = normalizeFoodSearch(food.brand);
    const barcode = String(food.barcode || '');
    if (barcode && barcode === normalized.replace(/\s/g, '')) return 1000;
    if (name === normalized) return 900;
    if (name.startsWith(normalized)) return 700;
    if (brand && brand.startsWith(normalized)) return 500;
    return 100;
  }

  function searchNutritionFoods(query) {
    const normalized = normalizeFoodSearch(query);
    if (!normalized) return [];
    const tokens = normalized.split(' ').filter(Boolean);
    return nutritionCatalog()
      .filter((food) => {
        const haystack = foodSearchText(food);
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => foodMatchScore(b, normalized) - foodMatchScore(a, normalized)
        || Number(isFoodFavorite(b)) - Number(isFoodFavorite(a))
        || a.name.localeCompare(b.name, 'ru'))
      .slice(0, 60);
  }

  async function toggleFoodFavorite(food) {
    if (!food?.id) return;
    const now = new Date().toISOString();
    const customRecord = customRecordForFood(food.id);
    if (customRecord) {
      const next = { ...customRecord, favorite: customRecord.favorite === false, updatedAt: now };
      await DB.put('savedFoods', next);
      state.savedFoods = state.savedFoods.map((record) => record.id === next.id ? next : record);
      return;
    }
    const existing = favoriteRecordForFood(food.id);
    if (existing) {
      await DB.remove('savedFoods', existing.id);
      state.savedFoods = state.savedFoods.filter((record) => record.id !== existing.id);
      return;
    }
    const record = {
      id: `favorite:${state.activeProfileId}:${food.id}`,
      profileId: state.activeProfileId,
      recordType: 'favorite',
      foodId: food.id,
      food: foodSnapshot(food),
      createdAt: now,
      updatedAt: now,
    };
    await DB.put('savedFoods', record);
    state.savedFoods.unshift(record);
  }

  function nutritionEntriesForDate(date = state.nutritionDate || todayISO()) {
    return state.foodEntries.filter((entry) => entry.date === date);
  }

  function nutritionTotals(entries) {
    return entries.reduce((total, entry) => {
      const values = entry.nutrition || {};
      total.kcal += Number(values.kcal || 0);
      total.protein += Number(values.protein || 0);
      total.fat += Number(values.fat || 0);
      total.carbs += Number(values.carbs || 0);
      return total;
    }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  }


  function nutritionMacroMeta(metric) {
    return {
      protein: { key: 'protein', label: 'Белки', short: 'Б', colorClass: 'protein' },
      fat: { key: 'fat', label: 'Жиры', short: 'Ж', colorClass: 'fat' },
      carbs: { key: 'carbs', label: 'Углеводы', short: 'У', colorClass: 'carbs' },
    }[metric] || null;
  }

  function nutritionMacroBreakdown(entries, metric) {
    const groups = new Map();
    for (const entry of entries) {
      const value = Number(entry?.nutrition?.[metric] || 0);
      if (!(value > 0)) continue;
      const name = String(entry.name || entry.foodSnapshot?.name || 'Продукт').trim() || 'Продукт';
      const brand = String(entry.brand || entry.foodSnapshot?.brand || '').trim();
      const key = String(entry.foodId || entry.foodSnapshot?.id || `${name.toLowerCase()}|${brand.toLowerCase()}`);
      const current = groups.get(key) || {
        id: key,
        name,
        brand,
        value: 0,
        kcal: 0,
        entries: 0,
        meals: new Set(),
      };
      current.value += value;
      current.kcal += Number(entry?.nutrition?.kcal || 0);
      current.entries += 1;
      current.meals.add(nutritionMealMeta(entry.meal).label);
      groups.set(key, current);
    }
    return [...groups.values()]
      .map((row) => ({ ...row, value: roundNutrition(row.value), kcal: roundNutrition(row.kcal, 0), meals: [...row.meals] }))
      .sort((a, b) => b.value - a.value || b.kcal - a.kcal || a.name.localeCompare(b.name, 'ru'));
  }

  function nutritionMacroStatus(metric, total, target) {
    const meta = nutritionMacroMeta(metric);
    const value = Number(total || 0);
    const goal = Math.max(0, Number(target || 0));
    const delta = roundNutrition(value - goal);
    const ratio = goal > 0 ? value / goal : 0;
    if (!meta || !goal) return { tone: 'neutral', title: 'Цель не задана', text: 'Укажи дневную цель, чтобы приложение оценило баланс.' };
    if (value <= 0) return { tone: 'neutral', title: `${meta.label}: пока 0 г`, text: 'Добавь еду — здесь появятся главные источники за день.' };

    if (metric === 'protein') {
      if (ratio < .85) return { tone: 'low', title: `Не хватает ${formatNutritionValue(Math.abs(delta))} г`, text: 'Добрать можно постным мясом, рыбой, творогом или протеином.' };
      if (ratio <= 1.15) return { tone: 'good', title: 'Белок в норме', text: 'Цель закрыта без заметного перекоса.' };
      return { tone: 'high', title: `Выше цели на ${formatNutritionValue(delta)} г`, text: 'Белка уже достаточно — остаток дня не обязательно собирать только из белковых продуктов.' };
    }
    if (metric === 'fat') {
      if (ratio < .70) return { tone: 'low', title: `Не хватает ${formatNutritionValue(Math.abs(delta))} г`, text: 'Можно добавить немного рыбы, орехов, масла или молочных продуктов.' };
      if (ratio <= 1.10) return { tone: 'good', title: 'Жиры в норме', text: 'Дневная цель закрыта без заметного перебора.' };
      return { tone: 'high', title: `Перебор ${formatNutritionValue(delta)} г`, text: 'Остаток дня лучше собрать из постного белка и углеводов без лишнего масла и жирных соусов.' };
    }
    if (ratio < .85) return { tone: 'low', title: `Не хватает ${formatNutritionValue(Math.abs(delta))} г`, text: 'Добрать можно крупой, картофелем, макаронами, хлебом или фруктами.' };
    if (ratio <= 1.15) return { tone: 'good', title: 'Углеводы в норме', text: 'Цель закрыта без заметного перекоса.' };
    return { tone: 'high', title: `Выше цели на ${formatNutritionValue(delta)} г`, text: 'Дополнительные углеводы сегодня уже не обязательны.' };
  }

  function showNutritionMacroBreakdown(metric = 'protein') {
    const meta = nutritionMacroMeta(metric) || nutritionMacroMeta('protein');
    const entries = nutritionEntriesForDate();
    const totals = nutritionTotals(entries);
    const target = nutritionTargetForDate(state.nutritionDate || todayISO());
    const rows = nutritionMacroBreakdown(entries, meta.key);
    const total = Number(totals[meta.key] || 0);
    const goal = Number(target[meta.key] || 0);
    const status = nutritionMacroStatus(meta.key, total, goal);
    const dateLabel = nutritionDateLabel(state.nutritionDate || todayISO());

    showModal(`
      <div class="modal-head nutrition-breakdown-head">
        <div><span class="eyebrow">${escapeHTML(dateLabel)}</span><h2>Раскладка по БЖУ</h2></div>
        <button class="modal-close" data-close type="button">×</button>
      </div>
      <div class="nutrition-breakdown-tabs" role="tablist" aria-label="Выбрать показатель">
        ${['protein', 'fat', 'carbs'].map((key) => {
          const item = nutritionMacroMeta(key);
          const value = Number(totals[key] || 0);
          return `<button class="nutrition-breakdown-tab ${key === meta.key ? 'active' : ''} ${item.colorClass}" data-macro="${key}" type="button" role="tab" aria-selected="${key === meta.key}"><span>${item.label}</span><strong>${formatNutritionValue(value)} г</strong></button>`;
        }).join('')}
      </div>
      <section class="nutrition-breakdown-summary ${meta.colorClass} ${status.tone}">
        <div><span>${escapeHTML(meta.label)}</span><strong>${formatNutritionValue(total)} / ${formatNutritionValue(goal)} г</strong></div>
        <div class="nutrition-breakdown-progress"><span style="width:${Math.min(nutritionProgress(total, goal), 100)}%"></span></div>
        <h3>${escapeHTML(status.title)}</h3>
        <p>${escapeHTML(status.text)}</p>
      </section>
      <div class="nutrition-breakdown-section-head"><h3>Что дало ${meta.label.toLowerCase()}</h3><span>${rows.length} ${rows.length === 1 ? 'источник' : rows.length < 5 ? 'источника' : 'источников'}</span></div>
      <div class="nutrition-breakdown-list ${meta.colorClass}">
        ${rows.length ? rows.map((row, index) => {
          const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
          const details = [row.brand, row.meals.join(' · ')].filter(Boolean).join(' · ');
          return `
            <div class="nutrition-breakdown-row">
              <span class="nutrition-breakdown-rank">${index + 1}</span>
              <div class="nutrition-breakdown-food">
                <div><strong>${escapeHTML(row.name)}</strong><b>${formatNutritionValue(row.value)} г</b></div>
                <small>${details ? escapeHTML(details) : `${row.entries} ${row.entries === 1 ? 'запись' : 'записи'}`} · ${share}% от итога</small>
                <div class="nutrition-breakdown-food-bar"><span style="width:${share}%"></span></div>
              </div>
            </div>`;
        }).join('') : '<div class="nutrition-breakdown-empty">Пока нет продуктов с этим макросом.</div>'}
      </div>
    `);

    el.modalRoot.querySelectorAll('.nutrition-breakdown-tab').forEach((button) => button.addEventListener('click', () => showNutritionMacroBreakdown(button.dataset.macro)));
  }

  function roundNutrition(value, precision = 1) {
    const scale = 10 ** precision;
    return Math.round((Number(value) || 0) * scale) / scale;
  }

  function formatNutritionValue(value, suffix = '') {
    const rounded = roundNutrition(value, 1);
    const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
    return `${text}${suffix}`;
  }

  function calculateFoodNutrition(food, grams) {
    const basis = Math.max(1, Number(food?.nutrition?.basis || 100));
    const factor = Math.max(0, Number(grams || 0)) / basis;
    const values = {
      kcal: roundNutrition(Number(food?.nutrition?.kcal || 0) * factor, 0),
      protein: roundNutrition(Number(food?.nutrition?.protein || 0) * factor),
      fat: roundNutrition(Number(food?.nutrition?.fat || 0) * factor),
      carbs: roundNutrition(Number(food?.nutrition?.carbs || 0) * factor),
    };
    for (const key of ['fiber', 'sugar', 'sodiumMg', 'caffeineMg', 'alcoholG']) {
      const raw = food?.nutrition?.[key];
      const source = Number(raw);
      values[key] = raw !== null && raw !== undefined && Number.isFinite(source)
        ? roundNutrition(source * factor)
        : null;
    }
    return values;
  }

  function nutritionUnitCode(foodOrNutrition) {
    const nutrition = foodOrNutrition?.nutrition || foodOrNutrition || {};
    return nutrition.unit === 'ml' ? 'ml' : 'g';
  }

  function nutritionUnitLabel(foodOrNutrition) {
    return nutritionUnitCode(foodOrNutrition) === 'ml' ? 'мл' : 'г';
  }

  function foodEntryUnitLabel(entry) {
    return nutritionUnitLabel(entry?.foodSnapshot?.nutrition || entry?.per100 || { unit: entry?.amountUnit });
  }

  function nutritionTargetForDate(date) {
    const rows = state.workouts.filter((workout) => (
      workout?.status === 'completed'
      && localDateISO(new Date(workout.startedAt || workout.date || Date.now())) === date
    ));
    let recovery = rows.length ? !rows.some((workout) => !isRecoveryWorkout(workout) && !isManualDayEntry(workout)) : true;
    if (date === todayISO() && !rows.length) {
      const current = getCurrentDay();
      recovery = Boolean(current?.day?.recovery || current?.day?.restDay);
    }
    const nutrition = state.nutrition || window.NIKITA_SEED.nutrition;
    return recovery ? {
      mode: 'recovery',
      label: 'день восстановления',
      calories: Number(nutrition.recoveryCalories || 0),
      protein: Number(nutrition.proteinG || 0),
      fat: Number(nutrition.recoveryFatG || 0),
      carbs: Number(nutrition.recoveryCarbsG || 0),
    } : {
      mode: 'training',
      label: 'тренировочный день',
      calories: Number(nutrition.trainingCalories || 0),
      protein: Number(nutrition.proteinG || 0),
      fat: Number(nutrition.trainingFatG || 0),
      carbs: Number(nutrition.trainingCarbsG || 0),
    };
  }

  function nutritionProgress(value, target) {
    if (!target) return 0;
    return Math.max(0, Math.round((Number(value || 0) / Number(target)) * 100));
  }

  function nutritionDateLabel(date) {
    if (date === todayISO()) return 'Сегодня';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date === localDateISO(yesterday)) return 'Вчера';
    return formatDate(new Date(`${date}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'long' });
  }

  function shiftNutritionDate(delta) {
    const current = new Date(`${state.nutritionDate || todayISO()}T12:00:00`);
    current.setDate(current.getDate() + delta);
    const next = localDateISO(current);
    if (next > todayISO()) return;
    state.nutritionDate = next;
    renderNutrition();
  }

  function renderNutritionEntry(entry) {
    const values = entry.nutrition || {};
    const brand = entry.foodSnapshot?.brand || entry.brand || '';
    const unitLabel = foodEntryUnitLabel(entry);
    return `
      <div class="nutrition-entry">
        <button class="nutrition-entry-main edit-food-entry" data-entry-id="${escapeAttr(entry.id)}" type="button">
          <span class="nutrition-entry-name">${escapeHTML(entry.name || entry.foodSnapshot?.name || 'Продукт')}</span>
          <small>${brand ? `${escapeHTML(brand)} · ` : ''}${formatNutritionValue(entry.grams, ` ${unitLabel}`)}${entry.portionLabel ? ` · ${escapeHTML(entry.portionLabel)}` : ''}</small>
        </button>
        <div class="nutrition-entry-values"><strong>${formatNutritionValue(values.kcal)} ккал</strong><small>Б ${formatNutritionValue(values.protein)} · Ж ${formatNutritionValue(values.fat)} · У ${formatNutritionValue(values.carbs)}</small></div>
        <button class="nutrition-entry-delete delete-food-entry" data-entry-id="${escapeAttr(entry.id)}" type="button" aria-label="Удалить ${escapeAttr(entry.name || 'продукт')}">×</button>
      </div>
    `;
  }

  function renderNutritionMeal(meal, entries) {
    const rows = entries.filter((entry) => entry.meal === meal.id);
    const totals = nutritionTotals(rows);
    return `
      <article class="card nutrition-meal-card">
        <div class="nutrition-meal-head">
          <div class="nutrition-meal-icon" aria-hidden="true">${meal.icon}</div>
          <div><h3>${meal.label}</h3><p>${rows.length ? `${formatNutritionValue(totals.kcal)} ккал · ${rows.length} поз.` : meal.note}</p></div>
          <button class="nutrition-meal-add add-food-to-meal" data-meal="${meal.id}" type="button" aria-label="Добавить в ${meal.label.toLowerCase()}">＋</button>
        </div>
        <div class="nutrition-entry-list">
          ${rows.length ? rows.map(renderNutritionEntry).join('') : `<button class="nutrition-empty-meal add-food-to-meal" data-meal="${meal.id}" type="button">Добавить еду или напиток</button>`}
        </div>
      </article>
    `;
  }

  function renderNutritionQuickFoods() {
    const rows = uniqueFoods([...favoriteFoods(), ...recentFoods(8)]).slice(0, 8);
    if (!rows.length) return '';
    return `
      <div class="nutrition-quick-foods" aria-label="Быстрый выбор">
        ${rows.map((food) => `<button class="nutrition-quick-food quick-add-food" data-food-id="${escapeAttr(food.id)}" type="button"><span>${isFoodFavorite(food) ? '★' : '◷'}</span><strong>${escapeHTML(food.name)}</strong></button>`).join('')}
      </div>
    `;
  }

  function renderNutrition() {
    state.nutritionDate = state.nutritionDate || todayISO();
    const entries = nutritionEntriesForDate();
    const totals = nutritionTotals(entries);
    const target = nutritionTargetForDate(state.nutritionDate);
    const caloriePercent = nutritionProgress(totals.kcal, target.calories);
    const remaining = Math.round(target.calories - totals.kcal);
    const isToday = state.nutritionDate === todayISO();
    const databaseTotal = Number(state.foodDatabaseInfo?.stats?.total || state.foodDatabase.length || 0);
    const databaseBeverages = Number(state.foodDatabaseInfo?.stats?.beverages || state.foodDatabase.filter((food) => food.type === 'beverage').length || 0);
    const databaseSportNutrition = Number(state.foodDatabaseInfo?.stats?.sportNutrition || state.foodDatabase.filter((food) => food.type === 'supplement' || food.category === 'Спортивное питание').length || 0);

    setTopbar('Питание', state.nutritionDate === todayISO()
      ? formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })
      : nutritionDateLabel(state.nutritionDate));
    el.main.innerHTML = `
      <section class="section nutrition-screen">
        <div class="nutrition-date-nav">
          <button id="nutrition-date-prev" type="button" aria-label="Предыдущий день">‹</button>
          <button id="nutrition-date-today" type="button"><strong>${escapeHTML(nutritionDateLabel(state.nutritionDate))}</strong><span>${formatShortDate(state.nutritionDate)}</span></button>
          <button id="nutrition-date-next" type="button" aria-label="Следующий день" ${isToday ? 'disabled' : ''}>›</button>
        </div>

        <article class="card nutrition-summary-card">
          <div class="nutrition-summary-head">
            <div>
              <span class="eyebrow">${escapeHTML(target.label)}</span>
              <h2>${remaining >= 0 ? `Осталось ${formatNutritionValue(remaining)} ккал` : `Перебор ${formatNutritionValue(Math.abs(remaining))} ккал`}</h2>
              <p>${formatNutritionValue(totals.kcal)} из ${formatNutritionValue(target.calories)} ккал</p>
            </div>
            <div class="nutrition-calorie-ring" style="--nutrition-progress:${Math.min(caloriePercent, 100) * 3.6}deg"><strong>${formatNutritionValue(totals.kcal)} / ${formatNutritionValue(target.calories)}</strong><span>ккал</span></div>
          </div>
          <div class="nutrition-macro-grid">
            ${[
              ['Белки', totals.protein, target.protein, 'protein'],
              ['Жиры', totals.fat, target.fat, 'fat'],
              ['Углеводы', totals.carbs, target.carbs, 'carbs'],
            ].map(([label, value, goal, className]) => `
              <button class="nutrition-macro ${className} open-nutrition-macro" data-macro="${className}" type="button" aria-label="Показать источники: ${label}">
                <div><span>${label}</span><strong>${formatNutritionValue(value)} / ${formatNutritionValue(goal)} г <b aria-hidden="true">›</b></strong></div>
                <div class="nutrition-macro-bar"><span style="width:${Math.min(nutritionProgress(value, goal), 100)}%"></span></div>
              </button>
            `).join('')}
          </div>
          <button class="nutrition-goals-link" id="nutrition-edit-goals" type="button">Изменить дневные цели</button>
        </article>

        <button class="nutrition-search-launch" id="open-food-search" type="button">
          <span aria-hidden="true">⌕</span>
          <span><strong>Найти еду или напиток</strong><small>${databaseTotal ? `${databaseTotal} позиций · названия, бренды и штрихкоды` : 'Свои продукты доступны даже без встроенной базы'}</small></span>
          <b aria-hidden="true">›</b>
        </button>

        ${renderNutritionQuickFoods()}

        <div class="nutrition-meals">
          ${nutritionMealOptions().map((meal) => renderNutritionMeal(meal, entries)).join('')}
        </div>

        <div class="nutrition-own-actions">
          <button class="button secondary" id="nutrition-own-food" type="button">＋ Своя позиция</button>
          <button class="button ghost" id="nutrition-open-favorites" type="button">★ Избранное</button>
        </div>

        <div class="nutrition-database-note ${state.foodDatabaseStatus === 'error' ? 'warning' : ''}">
          <strong>${state.foodDatabaseStatus === 'error' ? 'Встроенная база пока не загрузилась' : `Русская офлайн-база · ${databaseTotal} позиций`}</strong>
          <span>${state.foodDatabaseStatus === 'error' ? 'Дневник и свои продукты работают. Подключись к интернету один раз после обновления, чтобы скачать справочник.' : `${databaseBeverages} напитков · ${databaseSportNutrition} позиций спортпита. USDA FoodData Central (CC0), Open Food Facts (ODbL) и справочные расчёты. Для упаковочных товаров сверяй КБЖУ с этикеткой.`}</span>
        </div>
      </section>
    `;

    document.getElementById('nutrition-date-prev')?.addEventListener('click', () => shiftNutritionDate(-1));
    document.getElementById('nutrition-date-next')?.addEventListener('click', () => shiftNutritionDate(1));
    document.getElementById('nutrition-date-today')?.addEventListener('click', () => {
      state.nutritionDate = todayISO();
      renderNutrition();
    });
    document.getElementById('open-food-search')?.addEventListener('click', () => showFoodPicker(defaultNutritionMeal()));
    document.getElementById('nutrition-own-food')?.addEventListener('click', () => showCustomFoodModal());
    document.getElementById('nutrition-open-favorites')?.addEventListener('click', () => showFoodPicker(defaultNutritionMeal(), 'favorites'));
    document.getElementById('nutrition-edit-goals')?.addEventListener('click', showNutritionModal);
    el.main.querySelectorAll('.open-nutrition-macro').forEach((button) => button.addEventListener('click', () => showNutritionMacroBreakdown(button.dataset.macro)));
    el.main.querySelectorAll('.add-food-to-meal').forEach((button) => button.addEventListener('click', () => showFoodPicker(button.dataset.meal)));
    el.main.querySelectorAll('.quick-add-food').forEach((button) => button.addEventListener('click', () => {
      const food = findNutritionFood(button.dataset.foodId) || recentFoods(20).find((item) => item.id === button.dataset.foodId);
      if (food) showFoodAmountModal(food, { meal: defaultNutritionMeal() });
    }));
    el.main.querySelectorAll('.edit-food-entry').forEach((button) => button.addEventListener('click', () => {
      const entry = state.foodEntries.find((item) => item.id === button.dataset.entryId);
      if (entry) showFoodAmountModal(foodFromEntry(entry), { meal: entry.meal, entry });
    }));
    el.main.querySelectorAll('.delete-food-entry').forEach((button) => button.addEventListener('click', () => deleteFoodEntry(button.dataset.entryId)));
  }

  function foodPickerRow(food, key) {
    const nutrition = food.nutrition || {};
    const detail = [food.brand, food.category].filter(Boolean).join(' · ');
    const unitLabel = nutritionUnitLabel(nutrition);
    return `
      <div class="food-picker-row">
        <button class="food-picker-main choose-food" data-food-key="${escapeAttr(key)}" type="button">
          <span class="food-picker-type">${escapeHTML(foodTypeLabel(food))}</span>
          <strong>${escapeHTML(food.name)}</strong>
          <small>${detail ? `${escapeHTML(detail)} · ` : ''}${formatNutritionValue(nutrition.kcal)} ккал · Б ${formatNutritionValue(nutrition.protein)} · Ж ${formatNutritionValue(nutrition.fat)} · У ${formatNutritionValue(nutrition.carbs)} на 100 ${unitLabel}</small>
        </button>
        <button class="food-favorite-toggle ${isFoodFavorite(food) ? 'active' : ''}" data-food-key="${escapeAttr(key)}" type="button" aria-label="${isFoodFavorite(food) ? 'Убрать из избранного' : 'Добавить в избранное'}">★</button>
        ${food.custom ? `<button class="food-custom-edit edit-custom-food" data-food-id="${escapeAttr(food.id)}" type="button" aria-label="Изменить свой продукт">✎</button>` : ''}
      </div>
    `;
  }

  function showFoodPicker(meal = defaultNutritionMeal(), initialView = 'all') {
    const picker = { meal, view: initialView, query: '', visible: new Map() };
    showModal(`
      <div class="modal-head"><div><span class="eyebrow">${escapeHTML(nutritionMealMeta(meal).label)}</span><h2>Добавить в дневник</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="food-search-box"><span aria-hidden="true">⌕</span><input id="food-search-input" type="search" inputmode="search" autocomplete="off" placeholder="Творог, кофе, протеин или штрихкод"></div>
      <div class="food-picker-tabs" role="tablist">
        ${[
          ['all', 'Все'],
          ['beverages', 'Напитки'],
          ['sport', 'Спортпит'],
          ['favorites', '★ Избранное'],
          ['recent', 'Недавние'],
          ['custom', 'Свои'],
        ].map(([id, label]) => `<button class="food-picker-tab ${picker.view === id ? 'active' : ''}" data-food-view="${id}" type="button">${label}</button>`).join('')}
      </div>
      <button class="food-create-own" id="food-create-own" type="button"><span>＋</span><strong>Создать свою позицию</strong><b>›</b></button>
      <div id="food-picker-results" class="food-picker-results"></div>
      <div class="help food-picker-help">КБЖУ указано на 100 г продукта или порошка и на 100 мл готового напитка. Для магазинного товара сверяй цифры с текущей упаковкой.</div>
    `);

    const input = document.getElementById('food-search-input');
    const resultsRoot = document.getElementById('food-picker-results');

    const refresh = () => {
      if (!resultsRoot) return;
      picker.visible.clear();
      let rows = [];
      let emptyTitle = 'Ничего не найдено';
      let emptyText = 'Попробуй другое название, бренд или цифры штрихкода.';
      if (picker.query.trim()) {
        rows = searchNutritionFoods(picker.query);
      } else if (picker.view === 'favorites') {
        rows = favoriteFoods();
        emptyTitle = 'Избранное пустое';
        emptyText = 'Нажимай звёздочку возле продуктов — они появятся здесь.';
      } else if (picker.view === 'recent') {
        rows = recentFoods(30);
        emptyTitle = 'Недавних пока нет';
        emptyText = 'После первой записи сюда попадут последние продукты.';
      } else if (picker.view === 'beverages') {
        rows = balancedFoodsBySubcategory(
          nutritionCatalog().filter((food) => food.type === 'beverage' || food.category === 'Напитки'),
          180,
        );
        emptyTitle = 'Напитки не найдены';
        emptyText = 'Попробуй поиск по названию или бренду.';
      } else if (picker.view === 'sport') {
        rows = balancedFoodsBySubcategory(
          nutritionCatalog().filter((food) => food.type === 'supplement' || food.category === 'Спортивное питание'),
          120,
        );
        emptyTitle = 'Спортпит не найден';
        emptyText = 'Попробуй поиск: протеин, гейнер, изотоник или креатин.';
      } else if (picker.view === 'custom') {
        rows = customFoods();
        emptyTitle = 'Своих позиций пока нет';
        emptyText = 'Создай продукт, блюдо, напиток или спортпит со своими КБЖУ.';
      } else {
        rows = uniqueFoods([
          ...favoriteFoods(),
          ...recentFoods(10),
          ...nutritionCatalog().filter((food) => food.type === 'dish').slice(0, 18),
          ...nutritionCatalog().filter((food) => food.type === 'generic').slice(0, 18),
          ...nutritionCatalog().filter((food) => food.type === 'beverage').slice(0, 10),
          ...nutritionCatalog().filter((food) => food.type === 'supplement').slice(0, 8),
        ]).slice(0, 42);
      }
      resultsRoot.innerHTML = rows.length
        ? rows.map((food, index) => {
          const key = `${index}:${food.id}`;
          picker.visible.set(key, food);
          return foodPickerRow(food, key);
        }).join('')
        : `<div class="empty compact-empty food-picker-empty"><strong>${emptyTitle}</strong>${emptyText}</div>`;

      resultsRoot.querySelectorAll('.choose-food').forEach((button) => button.addEventListener('click', () => {
        const food = picker.visible.get(button.dataset.foodKey);
        if (food) showFoodAmountModal(food, { meal: picker.meal });
      }));
      resultsRoot.querySelectorAll('.food-favorite-toggle').forEach((button) => button.addEventListener('click', async () => {
        const food = picker.visible.get(button.dataset.foodKey);
        if (!food) return;
        await toggleFoodFavorite(food);
        refresh();
      }));
      resultsRoot.querySelectorAll('.edit-custom-food').forEach((button) => button.addEventListener('click', () => showCustomFoodModal(button.dataset.foodId)));
    };

    input?.addEventListener('input', () => {
      picker.query = input.value;
      refresh();
    });
    el.modalRoot.querySelectorAll('.food-picker-tab').forEach((button) => button.addEventListener('click', () => {
      picker.view = button.dataset.foodView;
      picker.query = '';
      if (input) input.value = '';
      el.modalRoot.querySelectorAll('.food-picker-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
      refresh();
    }));
    document.getElementById('food-create-own')?.addEventListener('click', () => showCustomFoodModal());
    refresh();
    window.setTimeout(() => input?.focus(), 80);
  }

  function showFoodAmountModal(food, { meal = defaultNutritionMeal(), entry = null } = {}) {
    const portions = (Array.isArray(food.portions) ? food.portions : []).filter((portion) => Number(portion.grams) > 0);
    const initialMode = entry ? 'grams' : portions.length ? 'portion' : 'grams';
    const initialGrams = Number(entry?.grams || portions[0]?.grams || 100);
    const selectedPortionId = portions.find((portion) => Math.abs(Number(portion.grams) - initialGrams) < 0.01)?.id || portions[0]?.id || '';
    const unitLabel = nutritionUnitLabel(food);
    const directModeLabel = unitLabel === 'мл' ? 'В миллилитрах' : 'В граммах';
    const amountFieldLabel = unitLabel === 'мл' ? 'Объём, мл' : 'Вес, г';
    const per100Extra = Number(food.nutrition?.caffeineMg) > 0
      ? ` · кофеин ${formatNutritionValue(food.nutrition.caffeineMg)} мг`
      : '';
    showModal(`
      <div class="modal-head"><div><span class="eyebrow">${escapeHTML(foodTypeLabel(food))}</span><h2>${escapeHTML(food.name)}</h2></div><button class="modal-close" data-close>×</button></div>
      ${food.brand ? `<div class="food-amount-brand">${escapeHTML(food.brand)}${food.barcode ? ` · ${escapeHTML(food.barcode)}` : ''}</div>` : ''}
      <div class="food-amount-per100">На 100 ${unitLabel}: <strong>${formatNutritionValue(food.nutrition?.kcal)} ккал</strong> · Б ${formatNutritionValue(food.nutrition?.protein)} · Ж ${formatNutritionValue(food.nutrition?.fat)} · У ${formatNutritionValue(food.nutrition?.carbs)}${per100Extra}</div>
      <div class="field" style="margin-top:14px"><label>Приём пищи</label><select id="food-entry-meal">${nutritionMealOptions().map((item) => `<option value="${item.id}" ${item.id === meal ? 'selected' : ''}>${item.label}</option>`).join('')}</select></div>
      <div class="food-amount-modes" role="group" aria-label="Способ ввода количества">
        <button class="food-amount-mode ${initialMode === 'grams' ? 'active' : ''}" data-amount-mode="grams" type="button">${directModeLabel}</button>
        <button class="food-amount-mode ${initialMode === 'portion' ? 'active' : ''}" data-amount-mode="portion" type="button" ${portions.length ? '' : 'disabled'}>Обычной порцией</button>
      </div>
      <div class="food-grams-fields ${initialMode === 'grams' ? '' : 'hidden'}">
        <div class="field"><label>${amountFieldLabel}</label><input id="food-entry-grams" type="number" inputmode="decimal" min="1" max="5000" step="1" value="${initialGrams}"></div>
      </div>
      <div class="food-portion-fields ${initialMode === 'portion' ? '' : 'hidden'}">
        <div class="inline-fields">
          <div class="field"><label>Порция</label><select id="food-entry-portion">${portions.map((portion) => `<option value="${escapeAttr(portion.id)}" ${portion.id === selectedPortionId ? 'selected' : ''}>${escapeHTML(portion.label)} · ${formatNutritionValue(portion.grams)} ${unitLabel}</option>`).join('')}</select></div>
          <div class="field"><label>Количество</label><input id="food-entry-portions-count" type="number" inputmode="decimal" min="0.25" max="20" step="0.25" value="1"></div>
        </div>
      </div>
      <div class="food-amount-result" id="food-amount-result"></div>
      <div class="food-amount-actions">
        <button class="button secondary" id="food-amount-favorite" type="button">${isFoodFavorite(food) ? '★ В избранном' : '☆ В избранное'}</button>
        <button class="button primary" id="save-food-entry" type="button">${entry ? 'Сохранить изменения' : 'Добавить'}</button>
      </div>
    `);

    let mode = initialMode;
    const gramsInput = document.getElementById('food-entry-grams');
    const portionSelect = document.getElementById('food-entry-portion');
    const countInput = document.getElementById('food-entry-portions-count');
    const result = document.getElementById('food-amount-result');
    const readAmount = () => {
      if (mode === 'portion') {
        const portion = portions.find((item) => item.id === portionSelect?.value) || portions[0];
        const count = Math.max(0, Number(countInput?.value || 0));
        return {
          grams: roundNutrition(Number(portion?.grams || 0) * count),
          portionLabel: portion ? `${formatNutritionValue(count)} × ${portion.label}` : '',
        };
      }
      return { grams: Math.max(0, Number(gramsInput?.value || 0)), portionLabel: '' };
    };
    const refresh = () => {
      const amount = readAmount();
      const values = calculateFoodNutrition(food, amount.grams);
      const caffeine = Number(values.caffeineMg) > 0 ? ` · кофеин ${formatNutritionValue(values.caffeineMg)} мг` : '';
      result.innerHTML = `<div><span>${formatNutritionValue(amount.grams)} ${unitLabel}</span><strong>${formatNutritionValue(values.kcal)} ккал</strong></div><small>Белки ${formatNutritionValue(values.protein)} г · жиры ${formatNutritionValue(values.fat)} г · углеводы ${formatNutritionValue(values.carbs)} г${caffeine}</small>`;
    };

    el.modalRoot.querySelectorAll('.food-amount-mode').forEach((button) => button.addEventListener('click', () => {
      if (button.disabled) return;
      mode = button.dataset.amountMode;
      el.modalRoot.querySelectorAll('.food-amount-mode').forEach((item) => item.classList.toggle('active', item === button));
      el.modalRoot.querySelector('.food-grams-fields')?.classList.toggle('hidden', mode !== 'grams');
      el.modalRoot.querySelector('.food-portion-fields')?.classList.toggle('hidden', mode !== 'portion');
      refresh();
    }));
    [gramsInput, portionSelect, countInput].filter(Boolean).forEach((input) => input.addEventListener('input', refresh));
    document.getElementById('food-amount-favorite')?.addEventListener('click', async () => {
      await toggleFoodFavorite(food);
      const button = document.getElementById('food-amount-favorite');
      if (button) button.textContent = isFoodFavorite(food) ? '★ В избранном' : '☆ В избранное';
    });
    document.getElementById('save-food-entry')?.addEventListener('click', async () => {
      const amount = readAmount();
      if (!Number.isFinite(amount.grams) || amount.grams <= 0) return toast('Укажи количество больше нуля');
      if (amount.grams > 5000) return toast(`Проверь количество: максимум 5000 ${unitLabel} за одну запись`);
      await saveFoodEntry(food, {
        existing: entry,
        meal: document.getElementById('food-entry-meal').value,
        grams: amount.grams,
        portionLabel: amount.portionLabel,
      });
    });
    refresh();
  }

  async function saveFoodEntry(food, { existing = null, meal, grams, portionLabel = '' }) {
    const now = new Date().toISOString();
    const snapshot = foodSnapshot(food);
    const record = {
      id: existing?.id || uid('food-entry'),
      profileId: state.activeProfileId,
      date: existing?.date || state.nutritionDate || todayISO(),
      meal: nutritionMealOptions().some((item) => item.id === meal) ? meal : defaultNutritionMeal(),
      foodId: snapshot.id,
      name: snapshot.name,
      brand: snapshot.brand,
      grams: roundNutrition(grams),
      amountUnit: snapshot.nutrition.unit,
      portionLabel: String(portionLabel || ''),
      per100: clone(snapshot.nutrition),
      nutrition: calculateFoodNutrition(snapshot, grams),
      foodSnapshot: snapshot,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await DB.put('foodEntries', record);
    const index = state.foodEntries.findIndex((entry) => entry.id === record.id);
    if (index >= 0) state.foodEntries.splice(index, 1, record);
    else state.foodEntries.unshift(record);
    closeModal();
    if (state.route === 'nutrition') renderNutrition();
    toast(existing ? 'Запись обновлена' : `${record.name} добавлен${record.name.endsWith('а') ? 'а' : ''}`);
  }

  async function deleteFoodEntry(entryId) {
    const entry = state.foodEntries.find((item) => item.id === entryId);
    if (!entry) return;
    if (!window.confirm(`Удалить «${entry.name || 'продукт'}» из дневника?`)) return;
    await DB.remove('foodEntries', entry.id);
    state.foodEntries = state.foodEntries.filter((item) => item.id !== entry.id);
    renderNutrition();
    toast('Запись удалена');
  }

  function showCustomFoodModal(foodId = null) {
    const existing = foodId ? customRecordForFood(foodId) : null;
    const food = existing?.food || {};
    const portion = food.portions?.[0] || {};
    const existingUnit = nutritionUnitCode(food.nutrition || { unit: food.type === 'beverage' ? 'ml' : 'g' });
    showModal(`
      <div class="modal-head"><div><span class="eyebrow">Личная база</span><h2>${existing ? 'Изменить позицию' : 'Своя позиция'}</h2></div><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="inline-fields">
          <div class="field"><label>Тип</label><select id="custom-food-type"><option value="generic" ${!['dish', 'beverage', 'supplement'].includes(food.type) ? 'selected' : ''}>Продукт</option><option value="dish" ${food.type === 'dish' ? 'selected' : ''}>Готовое блюдо</option><option value="beverage" ${food.type === 'beverage' ? 'selected' : ''}>Напиток</option><option value="supplement" ${food.type === 'supplement' ? 'selected' : ''}>Спортпит</option></select></div>
          <div class="field"><label>Категория</label><input id="custom-food-category" value="${escapeAttr(food.category || '')}" placeholder="Например, молочка"></div>
        </div>
        <div class="field"><label>Название *</label><input id="custom-food-name" value="${escapeAttr(food.name || '')}" maxlength="100" placeholder="Например, запеканка Лёхи"></div>
        <div class="field"><label>Бренд, необязательно</label><input id="custom-food-brand" value="${escapeAttr(food.brand || '')}" maxlength="80" placeholder="Производитель или домашнее"></div>
        <div class="field"><label>Единица учёта</label><select id="custom-food-unit"><option value="g" ${existingUnit === 'g' ? 'selected' : ''}>Граммы — на 100 г</option><option value="ml" ${existingUnit === 'ml' ? 'selected' : ''}>Миллилитры — на 100 мл</option></select></div>
        <div class="custom-food-nutrition-label"><strong id="custom-food-nutrition-basis">КБЖУ на 100 ${existingUnit === 'ml' ? 'мл' : 'г'}</strong><span>Перепиши с упаковки или рецепта</span></div>
        <div class="inline-fields">
          <div class="field"><label>Калории</label><input id="custom-food-kcal" type="number" inputmode="decimal" min="0" max="1000" step="1" value="${food.nutrition?.kcal ?? ''}"></div>
          <div class="field"><label>Белки, г</label><input id="custom-food-protein" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${food.nutrition?.protein ?? ''}"></div>
          <div class="field"><label>Жиры, г</label><input id="custom-food-fat" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${food.nutrition?.fat ?? ''}"></div>
          <div class="field"><label>Углеводы, г</label><input id="custom-food-carbs" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${food.nutrition?.carbs ?? ''}"></div>
        </div>
        <div class="custom-food-nutrition-label"><strong>Привычная порция</strong><span>Можно оставить пустой</span></div>
        <div class="inline-fields">
          <div class="field"><label>Название порции</label><input id="custom-food-portion-label" value="${escapeAttr(portion.label || '')}" placeholder="штука, тарелка, стакан"></div>
          <div class="field"><label id="custom-food-portion-amount-label">${existingUnit === 'ml' ? 'Объём порции, мл' : 'Вес порции, г'}</label><input id="custom-food-portion-grams" type="number" inputmode="decimal" min="1" max="5000" step="1" value="${portion.grams ?? ''}"></div>
        </div>
      </div>
      <div class="custom-food-actions">
        ${existing ? '<button class="button danger" id="delete-custom-food" type="button">Удалить</button>' : '<span></span>'}
        <button class="button primary" id="save-custom-food" type="button">${existing ? 'Сохранить' : 'Создать'}</button>
      </div>
      <div class="help" style="margin-top:10px">Своя позиция хранится только в текущем профиле и входит в резервную копию.</div>
    `);
    const customType = document.getElementById('custom-food-type');
    const customUnit = document.getElementById('custom-food-unit');
    const customCategory = document.getElementById('custom-food-category');
    const refreshCustomUnit = () => {
      const isMl = customUnit?.value === 'ml';
      const basis = document.getElementById('custom-food-nutrition-basis');
      const portionAmountLabel = document.getElementById('custom-food-portion-amount-label');
      if (basis) basis.textContent = `КБЖУ на 100 ${isMl ? 'мл' : 'г'}`;
      if (portionAmountLabel) portionAmountLabel.textContent = isMl ? 'Объём порции, мл' : 'Вес порции, г';
    };
    customType?.addEventListener('change', () => {
      if (customType.value === 'beverage') {
        if (customUnit) customUnit.value = 'ml';
        if (customCategory && !customCategory.value.trim()) customCategory.value = 'Мои напитки';
      } else if (customType.value === 'supplement') {
        if (customUnit) customUnit.value = 'g';
        if (customCategory && !customCategory.value.trim()) customCategory.value = 'Мой спортпит';
      } else if (customUnit) {
        customUnit.value = 'g';
      }
      refreshCustomUnit();
    });
    customUnit?.addEventListener('change', refreshCustomUnit);
    document.getElementById('save-custom-food')?.addEventListener('click', async () => {
      const name = document.getElementById('custom-food-name').value.trim();
      const type = document.getElementById('custom-food-type').value;
      const unit = document.getElementById('custom-food-unit').value === 'ml' ? 'ml' : 'g';
      const unitLabel = unit === 'ml' ? 'мл' : 'г';
      const kcal = Number(document.getElementById('custom-food-kcal').value);
      const protein = Number(document.getElementById('custom-food-protein').value);
      const fat = Number(document.getElementById('custom-food-fat').value);
      const carbs = Number(document.getElementById('custom-food-carbs').value);
      if (!name) return toast('Введи название');
      if (![kcal, protein, fat, carbs].every((value) => Number.isFinite(value) && value >= 0)) return toast('Заполни КБЖУ числами от нуля');
      if (kcal > 1000 || protein > 100 || fat > 100 || carbs > 100) return toast(`Проверь КБЖУ на 100 ${unitLabel}`);
      const portionLabel = document.getElementById('custom-food-portion-label').value.trim();
      const portionGrams = Number(document.getElementById('custom-food-portion-grams').value);
      if ((portionLabel && !(portionGrams > 0)) || (!portionLabel && portionGrams > 0)) return toast('Для порции укажи и название, и размер');
      const now = new Date().toISOString();
      const customFood = {
        id: food.id || uid('custom-food'),
        type: ['dish', 'beverage', 'supplement'].includes(type) ? type : 'generic',
        custom: true,
        name,
        aliases: [],
        brand: document.getElementById('custom-food-brand').value.trim() || null,
        barcode: null,
        category: document.getElementById('custom-food-category').value.trim()
          || (type === 'beverage' ? 'Мои напитки' : type === 'supplement' ? 'Мой спортпит' : 'Мои продукты'),
        nutrition: {
          basis: 100,
          unit,
          kcal: roundNutrition(kcal),
          protein: roundNutrition(protein),
          fat: roundNutrition(fat),
          carbs: roundNutrition(carbs),
        },
        portions: portionLabel && portionGrams > 0 ? [{ id: 'p1', label: portionLabel, grams: roundNutrition(portionGrams) }] : [],
        source: { provider: 'Пользователь', license: 'private' },
        note: null,
        search: normalizeFoodSearch([name, document.getElementById('custom-food-brand').value, document.getElementById('custom-food-category').value].join(' ')),
      };
      const record = {
        id: existing?.id || uid('saved-food'),
        profileId: state.activeProfileId,
        recordType: 'custom',
        foodId: customFood.id,
        food: customFood,
        favorite: existing?.favorite !== false,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await DB.put('savedFoods', record);
      const index = state.savedFoods.findIndex((item) => item.id === record.id);
      if (index >= 0) state.savedFoods.splice(index, 1, record);
      else state.savedFoods.unshift(record);
      closeModal();
      if (state.route === 'nutrition') renderNutrition();
      toast(existing ? 'Своя позиция обновлена' : 'Своя позиция создана');
    });
    document.getElementById('delete-custom-food')?.addEventListener('click', async () => {
      if (!existing || !window.confirm(`Удалить «${existing.food.name}» из личной базы? Записи в дневнике останутся.`)) return;
      await DB.remove('savedFoods', existing.id);
      state.savedFoods = state.savedFoods.filter((record) => record.id !== existing.id);
      closeModal();
      if (state.route === 'nutrition') renderNutrition();
      toast('Позиция удалена из личной базы');
    });
  }

  function renderMore() {
    setTopbar('Профиль', 'Настройки без свалки');
    const goals = state.profile.goals?.length ? state.profile.goals : ['Цель пока не указана'];
    const profileInitial = escapeHTML((state.profile.name || '?').trim().charAt(0).toUpperCase() || '?');
    el.main.innerHTML = `
      <section class="section more-profile-section">
        <div class="card more-profile-card">
          <div class="more-profile-head">
            <div class="more-profile-avatar" aria-hidden="true">${profileInitial}</div>
            <div class="more-profile-copy">
              <div class="eyebrow">Текущий профиль · ${state.profiles.length} всего</div>
              <h2>${escapeHTML(state.profile.name)}</h2>
              <p>${state.profile.age || '—'} лет · ${state.profile.heightCm || '—'} см · ${formatBodyValue(latestProfileWeightKg())} кг</p>
            </div>
          </div>
          <div class="more-goal-scroll" aria-label="Цели профиля">
            ${goals.map((goal) => `<span class="more-goal-chip">✓ ${escapeHTML(goal)}</span>`).join('')}
          </div>
          <div class="more-profile-actions">
            <button class="button secondary" id="switch-profile" type="button">Сменить</button>
            <button class="button secondary" id="edit-profile" type="button">Изменить</button>
            <button class="button primary" id="new-profile" type="button">＋ Профиль</button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Быстрый доступ</h2></div>
        <div class="more-shortcuts">
          <button class="more-shortcut" id="open-offline-guide" type="button">
            <span class="more-shortcut-icon guide" aria-hidden="true">?</span>
            <span><strong>Справочник</strong><small>17 тем офлайн</small></span>
            <span class="more-shortcut-arrow" aria-hidden="true">›</span>
          </button>
          <button class="more-shortcut" id="open-iron-calculator" type="button">
            <span class="more-shortcut-icon iron" aria-hidden="true">⚖</span>
            <span><strong>Калькулятор</strong><small>Штанга и гантели</small></span>
            <span class="more-shortcut-arrow" aria-hidden="true">›</span>
          </button>
          <button class="more-shortcut" id="open-sound-settings" type="button">
            <span class="more-shortcut-icon sound" aria-hidden="true">♪</span>
            <span><strong>Звук таймера</strong><small>${state.settings.soundEnabled ? `${timerVolumePercent()}% громкости` : 'Выключен'}</small></span>
            <span class="more-shortcut-arrow" aria-hidden="true">›</span>
          </button>
          <button class="more-shortcut" id="open-push-settings" type="button">
            <span class="more-shortcut-icon push" aria-hidden="true">🔔</span>
            <span><strong>Уведомления</strong><small>${escapeHTML(pushSupportSummary())}</small></span>
            <span class="more-shortcut-arrow" aria-hidden="true">›</span>
          </button>
          <button class="more-shortcut" id="open-backup-settings" type="button">
            <span class="more-shortcut-icon backup" aria-hidden="true">⇅</span>
            <span><strong>Резервная копия</strong><small>Все профили</small></span>
            <span class="more-shortcut-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </section>

      <section class="section more-groups" aria-label="Разделы настроек">
        <details class="more-group" id="more-group-training">
          <summary>
            <span class="more-group-icon training" aria-hidden="true">●</span>
            <span class="more-group-copy"><strong>Тренировки и самочувствие</strong><small>Калории, сигналы таймера и история боли</small></span>
            <span class="more-group-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="more-group-content">
            <div class="more-subsection nutrition-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Питание</span><h3>Калории и БЖУ</h3></div><button class="link-button" id="edit-nutrition" type="button">Изменить</button></div>
              <div class="card">
                <div class="stats-grid"><div><div class="stat-value">${state.nutrition.trainingCalories}</div><div class="stat-label">тренировка, ккал</div></div><div><div class="stat-value">${state.nutrition.recoveryCalories}</div><div class="stat-label">восстановление</div></div><div><div class="stat-value">${state.nutrition.proteinG}</div><div class="stat-label">белок, г</div></div><div><div class="stat-value">${state.nutrition.trainingFatG}</div><div class="stat-label">жиры, г</div></div></div>
                <div class="divider"></div><div class="help">${escapeHTML(state.nutrition.note)}</div>
              </div>
            </div>

            <div class="more-subsection timer-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Таймер отдыха</span><h3>Сигналы и вибрация</h3></div></div>
              <div class="card list-card timer-signal-card">
                <label class="list-row"><div><div class="list-row-title">Звук</div><div class="list-row-sub">Двойной сигнал после окончания отдыха</div></div><input id="sound-toggle" type="checkbox" ${state.settings.soundEnabled ? 'checked' : ''}></label>
                <label class="list-row"><div><div class="list-row-title">Отсчёт 3–2–1</div><div class="list-row-sub">Короткий сигнал на последних трёх секундах</div></div><input id="countdown-sound-toggle" type="checkbox" ${state.settings.countdownSoundEnabled ? 'checked' : ''} ${state.settings.soundEnabled ? '' : 'disabled'}></label>
                <div class="timer-volume-control"><div class="timer-volume-head"><div><div class="list-row-title">Громкость таймера</div><div class="list-row-sub">Уровень сигнала внутри приложения</div></div><strong id="timer-volume-value">${timerVolumePercent()}%</strong></div><input id="timer-volume" type="range" min="0" max="100" step="5" value="${timerVolumePercent()}" ${state.settings.soundEnabled ? '' : 'disabled'} aria-label="Громкость таймера"></div>
                <label class="list-row"><div><div class="list-row-title">Вибрация</div><div class="list-row-sub">На iPhone Safari может не поддерживаться</div></div><input id="vibration-toggle" type="checkbox" ${state.settings.vibrationEnabled ? 'checked' : ''}></label>
                <div class="timer-sound-test"><button class="button secondary full" id="test-timer-sound" type="button" ${state.settings.soundEnabled ? '' : 'disabled'}>Проверить звук</button><div class="help" id="timer-sound-status">Проверка также активирует звук для iPhone перед тренировкой.</div></div>
              </div>
            </div>

            <div class="more-subsection workout-interface-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Активная тренировка</span><h3>Интерфейс под тебя</h3></div></div>
              <div class="card list-card workout-interface-settings">
                <label class="list-row"><div><div class="list-row-title">Режим фокуса</div><div class="list-row-sub">Текущее упражнение крупно, следующие компактно</div></div><input id="workout-focus-toggle" type="checkbox" ${state.settings.workoutFocusMode !== false ? 'checked' : ''}></label>
                <label class="list-row"><div><div class="list-row-title">Прошлые значения</div><div class="list-row-sub">Показывать результат прошлого раза возле подхода</div></div><input id="workout-previous-toggle" type="checkbox" ${state.settings.workoutShowPrevious !== false ? 'checked' : ''}></label>
                <label class="list-row"><div><div class="list-row-title">Автопрокрутка</div><div class="list-row-sub">Переходить к следующему упражнению после завершения</div></div><input id="workout-autoscroll-toggle" type="checkbox" ${state.settings.workoutAutoScroll !== false ? 'checked' : ''}></label>
                <label class="list-row"><div><div class="list-row-title">Свайпы</div><div class="list-row-sub">Вправо — завершить, влево — действия</div></div><input id="workout-swipes-toggle" type="checkbox" ${state.settings.workoutSwipeGestures !== false ? 'checked' : ''}></label>
                <label class="list-row"><div><div class="list-row-title">Крупные быстрые кнопки</div><div class="list-row-sub">−2 / −1 / +1 / +2 кг и быстрые повторы</div></div><input id="workout-large-controls-toggle" type="checkbox" ${state.settings.workoutLargeControls !== false ? 'checked' : ''}></label>
                <label class="list-row"><div><div class="list-row-title">Быстрая оценка</div><div class="list-row-sub">Легко, нормально, тяжело, отказ или дискомфорт</div></div><input id="workout-feedback-toggle" type="checkbox" ${state.settings.workoutQuickFeedback !== false ? 'checked' : ''}></label>
                <label class="list-row workout-completed-setting"><div><div class="list-row-title">После завершения упражнения</div><div class="list-row-sub">Как освобождать список</div></div><select id="workout-completed-behavior" class="set-select"><option value="collapse" ${workoutCompletedBehavior() === 'collapse' ? 'selected' : ''}>Сворачивать</option><option value="hide" ${workoutCompletedBehavior() === 'hide' ? 'selected' : ''}>Скрывать</option><option value="keep" ${workoutCompletedBehavior() === 'keep' ? 'selected' : ''}>Оставлять открытым</option></select></label>
              </div>
            </div>

            <div class="more-subsection pain-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Самочувствие</span><h3>История боли</h3></div><div class="section-actions"><button class="link-button" id="open-pain-cleanup" type="button">Очистить</button><button class="link-button" id="open-pain-history" type="button">Показать всё</button></div></div>
              <div class="card list-card">${state.painEntries.length ? state.painEntries.slice(0, 4).map(renderPainEntry).join('') : '<div class="empty compact-empty"><strong>Пока пусто</strong>Отметки появятся после тренировок с контролем боли.</div>'}</div>
            </div>
          </div>
        </details>

        <details class="more-group" id="more-group-data">
          <summary>
            <span class="more-group-icon data" aria-hidden="true">⇅</span>
            <span class="more-group-copy"><strong>Данные и безопасность</strong><small>Резервная копия и локальное хранилище</small></span>
            <span class="more-group-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="more-group-content">
            <div class="more-subsection backup-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Страховка данных</span><h3>Резервная копия всех профилей</h3></div></div>
              <div class="card"><div class="button-row"><button class="button primary" id="export-data" type="button">Данные JSON</button><button class="button secondary" id="export-full" type="button">С фото</button></div><button class="button ghost full" id="import-data" type="button" style="margin-top:10px">Импортировать копию</button><input id="import-file" type="file" accept="application/json" hidden><div class="help" style="margin-top:10px">Копия включает все профили. «Данные JSON» не содержит фото; перед импортом приложение отдельно предупредит о возможном удалении локальных фотографий.</div></div>
            </div>

            <div class="more-subsection storage-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">На этом iPhone</span><h3>Хранилище приложения</h3></div></div>
              <div class="card"><p class="muted more-storage-copy">Профили, тренировки, замеры и фотографии хранятся локально в IndexedDB.</p><button class="button secondary full" id="storage-info" type="button">Проверить хранилище</button><div class="help" style="margin-top:10px">Версия приложения ${escapeHTML(APP_VERSION)} · база IndexedDB v4</div></div>
              <div class="notice warning more-storage-warning"><strong>Важно.</strong> Данные PWA могут исчезнуть после удаления иконки, очистки данных Safari или при критической нехватке памяти. Экспорт — обязательная страховка.</div>
            </div>
          </div>
        </details>

        <details class="more-group" id="more-group-app">
          <summary>
            <span class="more-group-icon app" aria-hidden="true">↗</span>
            <span class="more-group-copy"><strong>Приложение</strong><small>Поделиться, обновить и установить PWA</small></span>
            <span class="more-group-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="more-group-content">
            <div class="more-subsection share-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Ссылка на PWA</span><h3>Поделиться приложением</h3></div></div>
              <div class="card share-app-card"><div class="share-app-head"><div><h3>Отправить приложение</h3><p>Передаётся только ссылка. Профили, история, фото, замеры и тренировки остаются на этом телефоне.</p></div><div class="share-app-mark" aria-hidden="true">↗</div></div><button class="button primary full" id="share-app-system" type="button">Поделиться через iPhone</button><div class="share-fast-grid" aria-label="Быстрый шаринг"><button class="share-fast-button telegram" id="share-app-telegram" type="button"><span>✈️</span><strong>Telegram</strong></button><button class="share-fast-button whatsapp" id="share-app-whatsapp" type="button"><span>🟢</span><strong>WhatsApp</strong></button><button class="share-fast-button vk" id="share-app-vk" type="button"><span>VK</span><strong>ВК</strong></button><button class="share-fast-button max" id="share-app-max" type="button"><span>MAX</span><strong>MAX</strong></button></div><div class="button-row share-link-row"><button class="button secondary" id="copy-app-link" type="button">Скопировать ссылку</button><button class="button ghost" id="open-app-link" type="button">Открыть в Safari</button></div><div class="help share-app-url" id="share-app-url">${escapeHTML(getAppShareUrl())}</div></div>
            </div>

            <div class="more-subsection notifications-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Для этого iPhone</span><h3>Системные уведомления</h3></div></div>
              <div class="card push-card">
                <div class="list-row no-border">
                  <div class="list-row-main"><div class="list-row-title">Web Push</div><div class="list-row-sub">Работает при закрытом приложении и на заблокированном экране</div></div>
                  <span class="push-status-mark" aria-hidden="true">🔔</span>
                </div>
                <div class="update-status-grid push-status-grid">
                  <div><span>Статус</span><strong id="push-status-text">${escapeHTML(pushSupportSummary())}</strong></div>
                  <div><span>Разрешение</span><strong id="push-permission-text">${escapeHTML(pushPermissionLabel(state.push.permission))}</strong></div>
                  <div><span>Запуск</span><strong id="push-device-text">${state.push.standalone ? 'PWA на экране Домой' : 'Открыто в браузере'}</strong></div>
                </div>
                <div class="notice push-detail" id="push-detail-text">${escapeHTML(state.push.detailText || state.push.statusText)}</div>
                <div class="button-row push-actions">
                  <button class="button primary" id="push-enable" type="button">Включить уведомления</button>
                  <button class="button secondary" id="push-test" type="button" ${state.push.subscribed ? '' : 'disabled'}>Тестовый пуш</button>
                </div>
                <button class="button ghost full" id="push-disable" type="button" ${state.push.subscribed ? '' : 'disabled'}>Отключить на этом iPhone</button>
                <div class="push-auto-summary">
                  <div><strong>💧 Вода</strong><span>09:00–22:00 · каждые 75 мин · Владивосток</span></div>
                  <div><strong>⚖️ Вес</strong><span>каждый день в 08:00 · до еды и воды</span></div>
                  <div><strong>💪 Тренировка</strong><span>19:00 · по ближайшему дню цикла</span></div>
                  <div><strong>🚀 Обновления</strong><span>автоматический пуш при новой версии</span></div>
                </div>
                <div class="help" id="push-automation-text" style="margin-top:10px">${escapeHTML(state.push.automationText || 'Автоматические напоминания синхронизируются после включения уведомлений.')}</div>
              </div>
            </div>

            <div class="more-subsection update-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">Версия ${escapeHTML(APP_VERSION)}</span><h3>Обновление приложения</h3></div></div>
              <div class="card update-card"><div class="list-row no-border"><div class="list-row-main"><div class="list-row-title">Текущая версия: ${escapeHTML(APP_VERSION)}</div><div class="list-row-sub">Проверка не трогает профили, историю, фото и IndexedDB.</div></div><span class="update-status-dot" aria-hidden="true">↻</span></div><div class="update-status-grid"><div><span>Статус</span><strong id="app-update-status-text">${escapeHTML(state.update.statusText || 'Пока не проверяли')}</strong></div><div><span>Кэш</span><strong id="app-cache-status-text">${escapeHTML(state.update.cacheStatus || 'неизвестно')}</strong></div><div><span>Последняя проверка</span><strong id="app-update-last-check">${escapeHTML(formatUpdateTimestamp(state.update.lastCheckAt))}</strong></div></div><div class="button-row"><button class="button primary" id="check-app-update" type="button">Проверить обновление</button><button class="button secondary" id="force-app-refresh" type="button">Обновить кэш</button></div><div class="help" style="margin-top:10px">«Обновить кэш» очищает только файлы приложения. Профили, история, фото, боль, рекорды и черновики остаются в IndexedDB.</div></div>
            </div>

            <div class="more-subsection install-subsection">
              <div class="more-subsection-head"><div><span class="eyebrow">iPhone</span><h3>Установка PWA</h3></div></div>
              <div class="card"><ol class="muted more-install-list"><li>Открой опубликованный адрес в Safari.</li><li>Нажми «Поделиться».</li><li>Выбери «На экран Домой».</li><li>Открой иконку один раз при интернете — после этого оболочка работает офлайн.</li></ol></div>
            </div>
          </div>
        </details>
      </section>
    `;
    document.getElementById('switch-profile').addEventListener('click', showProfileSwitcher);
    document.getElementById('new-profile').addEventListener('click', showCreateProfileModal);
    document.getElementById('edit-profile').addEventListener('click', showProfileModal);
    document.getElementById('open-offline-guide').addEventListener('click', () => navigate('guide'));
    document.getElementById('open-iron-calculator').addEventListener('click', () => showIronCalculatorModal());
    document.getElementById('open-sound-settings').addEventListener('click', () => openMoreGroup('more-group-training', '.timer-subsection'));
    document.getElementById('open-push-settings').addEventListener('click', () => openMoreGroup('more-group-app', '.notifications-subsection'));
    document.getElementById('open-backup-settings').addEventListener('click', () => openMoreGroup('more-group-data', '.backup-subsection'));
    document.getElementById('share-app-system').addEventListener('click', shareAppViaSystem);
    document.getElementById('share-app-telegram').addEventListener('click', () => openShareTarget('telegram'));
    document.getElementById('share-app-whatsapp').addEventListener('click', () => openShareTarget('whatsapp'));
    document.getElementById('share-app-vk').addEventListener('click', () => openShareTarget('vk'));
    document.getElementById('share-app-max').addEventListener('click', () => openShareTarget('max'));
    document.getElementById('copy-app-link').addEventListener('click', copyAppLink);
    document.getElementById('open-app-link').addEventListener('click', openAppSharePage);
    document.getElementById('edit-nutrition').addEventListener('click', showNutritionModal);
    document.getElementById('sound-toggle').addEventListener('change', async (event) => {
      const unlockPromise = event.target.checked ? prepareTimerAudio({ force: true }).catch(() => null) : Promise.resolve(null);
      await saveToggle('soundEnabled', event.target.checked);
      await unlockPromise;
      syncTimerSoundControls();
      const shortcutStatus = document.querySelector('#open-sound-settings small');
      if (shortcutStatus) shortcutStatus.textContent = event.target.checked ? `${timerVolumePercent()}% громкости` : 'Выключен';
    });
    document.getElementById('countdown-sound-toggle').addEventListener('change', (event) => saveToggle('countdownSoundEnabled', event.target.checked));
    document.getElementById('timer-volume').addEventListener('input', (event) => {
      document.getElementById('timer-volume-value').textContent = `${event.target.value}%`;
    });
    document.getElementById('timer-volume').addEventListener('change', async (event) => {
      await saveToggle('timerVolume', Number(event.target.value));
      const shortcutStatus = document.querySelector('#open-sound-settings small');
      if (shortcutStatus && state.settings.soundEnabled) shortcutStatus.textContent = `${timerVolumePercent()}% громкости`;
    });
    document.getElementById('test-timer-sound').addEventListener('click', testTimerSound);
    document.getElementById('vibration-toggle').addEventListener('change', (event) => saveToggle('vibrationEnabled', event.target.checked));
    document.getElementById('workout-focus-toggle').addEventListener('change', (event) => saveToggle('workoutFocusMode', event.target.checked));
    document.getElementById('workout-previous-toggle').addEventListener('change', (event) => saveToggle('workoutShowPrevious', event.target.checked));
    document.getElementById('workout-autoscroll-toggle').addEventListener('change', (event) => saveToggle('workoutAutoScroll', event.target.checked));
    document.getElementById('workout-swipes-toggle').addEventListener('change', (event) => saveToggle('workoutSwipeGestures', event.target.checked));
    document.getElementById('workout-large-controls-toggle').addEventListener('change', (event) => saveToggle('workoutLargeControls', event.target.checked));
    document.getElementById('workout-feedback-toggle').addEventListener('change', (event) => saveToggle('workoutQuickFeedback', event.target.checked));
    document.getElementById('workout-completed-behavior').addEventListener('change', (event) => saveToggle('workoutCompletedBehavior', event.target.value));
    syncTimerSoundControls();
    document.getElementById('open-pain-history').addEventListener('click', showPainHistoryModal);
    document.getElementById('open-pain-cleanup').addEventListener('click', showPainCleanupModal);
    document.getElementById('export-data').addEventListener('click', () => exportBackup(false));
    document.getElementById('export-full').addEventListener('click', () => exportBackup(true));
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importBackupFile);
    document.getElementById('check-app-update').addEventListener('click', () => checkForAppUpdate(true));
    document.getElementById('push-enable').addEventListener('click', enablePushNotifications);
    document.getElementById('push-test').addEventListener('click', sendTestPush);
    document.getElementById('push-disable').addEventListener('click', disablePushNotifications);
    document.getElementById('force-app-refresh').addEventListener('click', forceRefreshAppShell);
    refreshPushState({ verifyServer: true }).catch((error) => console.warn('Push panel refresh failed', error));
    document.getElementById('storage-info').addEventListener('click', showStorageInfo);
  }


  function getOfflineGuideData() {
    const data = window.OFFLINE_GUIDE;
    if (!data?.articles?.length) return { categories: [], articles: [], quick: [], sourceLabel: '' };
    return data;
  }

  function getOfflineGuideCategory(categoryId) {
    return getOfflineGuideData().categories.find((category) => category.id === categoryId) || null;
  }

  function getOfflineGuideArticle(articleId) {
    return getOfflineGuideData().articles.find((article) => article.id === articleId) || null;
  }

  function normalizeGuideText(value = '') {
    return String(value).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function filteredOfflineGuideArticles() {
    const { articles } = getOfflineGuideData();
    const query = normalizeGuideText(state.guideQuery);
    return articles.filter((article) => {
      if (state.guideCategory !== 'all' && article.category !== state.guideCategory) return false;
      if (!query) return true;
      const searchable = normalizeGuideText([
        article.title,
        article.summary,
        article.short,
        ...(article.tags || []),
        ...(article.steps || []),
        ...(article.avoid || []),
        ...(article.check || []),
        ...(article.stop || []),
      ].join(' '));
      return query.split(' ').every((part) => searchable.includes(part));
    });
  }

  function renderOfflineGuideArticleCard(article) {
    const category = getOfflineGuideCategory(article.category);
    return `
      <button class="guide-article-card" type="button" data-guide-article="${escapeAttr(article.id)}">
        <span class="guide-article-icon" aria-hidden="true">${escapeHTML(article.icon || '?')}</span>
        <span class="guide-article-copy">
          <span class="guide-article-category">${escapeHTML(category?.title || 'Справочник')}</span>
          <strong>${escapeHTML(article.title)}</strong>
          <span>${escapeHTML(article.summary)}</span>
        </span>
        <span class="guide-article-arrow" aria-hidden="true">›</span>
      </button>`;
  }

  function renderOfflineGuide() {
    const data = getOfflineGuideData();
    setTopbar('Справочник', 'БЕЗ ИНТЕРНЕТА · ВСЕГДА ДОСТУПЕН');
    if (!data.articles.length) {
      el.main.innerHTML = '<section class="section"><div class="notice warning"><strong>Справочник не загрузился.</strong><br>Обнови оболочку приложения в разделе «Ещё».</div><button class="button secondary full" data-go="more" type="button" style="margin-top:12px">Назад в «Ещё»</button></section>';
      bindGoButtons();
      return;
    }

    el.main.innerHTML = `
      <section class="section guide-top-actions"><button class="guide-back-button" data-go="more" type="button">← Назад в «Ещё»</button></section>
      <section class="section">
        <div class="card guide-hero-card">
          <div class="guide-hero-badge">OFFLINE</div>
          <h2>Ответ прямо во время тренировки</h2>
          <p>Коротко, без воды и без подключения к сети. Найди тему или открой быстрый сценарий.</p>
          <label class="guide-search-wrap" for="offline-guide-search">
            <span aria-hidden="true">⌕</span>
            <input id="offline-guide-search" type="search" inputmode="search" autocomplete="off" placeholder="Например: боль, разминка, креатин" value="${escapeAttr(state.guideQuery)}">
            <button id="clear-offline-guide-search" type="button" aria-label="Очистить поиск" ${state.guideQuery ? '' : 'hidden'}>×</button>
          </label>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Нужно быстро</h2></div>
        <div class="guide-quick-grid">
          ${data.quick.map((item) => `<button class="guide-quick-card" type="button" data-guide-article="${escapeAttr(item.articleId)}"><span>${escapeHTML(item.icon)}</span><strong>${escapeHTML(item.label)}</strong></button>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="guide-category-strip" id="offline-guide-categories" aria-label="Категории справочника">
          <button class="guide-category-pill ${state.guideCategory === 'all' ? 'active' : ''}" type="button" data-guide-category="all">Все</button>
          ${data.categories.map((category) => `<button class="guide-category-pill ${state.guideCategory === category.id ? 'active' : ''}" type="button" data-guide-category="${escapeAttr(category.id)}">${escapeHTML(category.title)}</button>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 id="offline-guide-results-title">Все темы</h2><span class="guide-result-count" id="offline-guide-result-count"></span></div>
        <div class="guide-article-list" id="offline-guide-results"></div>
      </section>

      <section class="section"><div class="notice guide-disclaimer"><strong>Важно.</strong> Справочник помогает принять безопасное бытовое решение, но не ставит диагноз и не заменяет врача. При опасных симптомах останови тренировку и обратись за медицинской помощью.<div class="guide-source-note">${escapeHTML(data.sourceLabel)}</div></div></section>`;

    bindGoButtons();
    const search = document.getElementById('offline-guide-search');
    const clear = document.getElementById('clear-offline-guide-search');
    search.addEventListener('input', (event) => {
      state.guideQuery = event.target.value;
      clear.hidden = !state.guideQuery;
      refreshOfflineGuideResults();
    });
    clear.addEventListener('click', () => {
      state.guideQuery = '';
      search.value = '';
      clear.hidden = true;
      refreshOfflineGuideResults();
      search.focus();
    });
    document.getElementById('offline-guide-categories').addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-category]');
      if (!button) return;
      state.guideCategory = button.dataset.guideCategory;
      document.querySelectorAll('.guide-category-pill').forEach((pill) => pill.classList.toggle('active', pill.dataset.guideCategory === state.guideCategory));
      refreshOfflineGuideResults();
    });
    el.main.querySelectorAll('.guide-quick-card').forEach((button) => button.addEventListener('click', () => showOfflineGuideArticle(button.dataset.guideArticle)));
    refreshOfflineGuideResults();
  }

  function refreshOfflineGuideResults() {
    const container = document.getElementById('offline-guide-results');
    const count = document.getElementById('offline-guide-result-count');
    const title = document.getElementById('offline-guide-results-title');
    if (!container || !count || !title) return;
    const articles = filteredOfflineGuideArticles();
    const category = state.guideCategory === 'all' ? null : getOfflineGuideCategory(state.guideCategory);
    title.textContent = state.guideQuery ? 'Результаты поиска' : (category?.title || 'Все темы');
    count.textContent = `${articles.length} ${pluralizeGuideTopic(articles.length)}`;
    container.innerHTML = articles.length
      ? articles.map(renderOfflineGuideArticleCard).join('')
      : '<div class="empty guide-empty"><strong>Ничего не найдено</strong>Попробуй другое слово или выбери категорию «Все».</div>';
    container.querySelectorAll('[data-guide-article]').forEach((button) => button.addEventListener('click', () => showOfflineGuideArticle(button.dataset.guideArticle)));
  }

  function pluralizeGuideTopic(value) {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 'тема';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'темы';
    return 'тем';
  }

  function renderOfflineGuideList(title, items, className = '') {
    if (!items?.length) return '';
    return `<section class="guide-detail-section ${className}"><h3>${escapeHTML(title)}</h3><ul>${items.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section>`;
  }

  function showOfflineGuideArticle(articleId) {
    const article = getOfflineGuideArticle(articleId);
    if (!article) return toast('Тема справочника не найдена');
    const category = getOfflineGuideCategory(article.category);
    showModal(`
      <article class="guide-detail">
        <div class="modal-head guide-detail-head"><div><div class="eyebrow">${escapeHTML(category?.title || 'Офлайн-справочник')}</div><h2>${escapeHTML(article.title)}</h2></div><button class="modal-close" data-close>×</button></div>
        <div class="guide-detail-lead"><span class="guide-detail-icon" aria-hidden="true">${escapeHTML(article.icon || '?')}</span><p>${escapeHTML(article.short)}</p></div>
        ${renderOfflineGuideList('Что делать', article.steps, 'guide-detail-do')}
        ${renderOfflineGuideList('Чего не делать', article.avoid, 'guide-detail-avoid')}
        ${renderOfflineGuideList('Быстрая проверка', article.check, 'guide-detail-check')}
        ${renderOfflineGuideList('Остановись, если…', article.stop, 'guide-detail-stop')}
        <div class="notice guide-detail-note"><strong>Без самодиагностики.</strong><br>Если симптом сильный, новый, нарастает или мешает обычному движению — прекрати нагрузку и обратись за медицинской помощью.</div>
      </article>`);
  }

  function getAppShareUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '#/home';
    url.pathname = url.pathname.replace(/index\.html$/i, '');
    return url.toString();
  }

  function getAppShareData() {
    const url = getAppShareUrl();
    const title = 'РЕЖИМ';
    const text = 'РЕЖИМ — офлайн-система тренировок, питания, восстановления и прогресса.';
    return { title, text, url, message: `${text}\n${url}` };
  }

  async function shareAppViaSystem() {
    const { title, text, url } = getAppShareData();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyAppLink();
  }

  function openShareTarget(target) {
    const { title, text, url, message } = getAppShareData();
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const encodedTitle = encodeURIComponent(title);
    const encodedMessage = encodeURIComponent(message);
    const links = {
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedMessage}`,
      vk: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}&description=${encodedText}`,
      max: `https://max.ru/:share?text=${encodedMessage}`,
    };
    openExternalLink(links[target] || url);
  }

  function openAppSharePage() {
    openExternalLink(getAppShareUrl());
  }

  function openExternalLink(url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function copyAppLink() {
    const url = getAppShareUrl();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackCopyText(url);
      }
      toast('Ссылка на приложение скопирована');
    } catch (error) {
      fallbackCopyText(url);
      toast('Ссылка скопирована');
    }
  }

  function fallbackCopyText(value) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  const defaultIronCalculatorSettings = Object.freeze({
    mode: 'dumbbell',
    targetKg: 28,
    dumbbellHandleKg: 2,
    barbellBarKg: 20,
    platesPerSide: '10, 5, 2.5, 1.25, 1',
  });

  function ironCalculatorSettings(overrides = {}) {
    return {
      ...defaultIronCalculatorSettings,
      ...(state.settings.ironCalculator || {}),
      ...overrides,
    };
  }

  function parseIronWeight(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function parseIronPlates(value) {
    return String(value || '')
      .split(/[\n,;]+/)
      .map(parseIronWeight)
      .filter((number) => Number.isFinite(number) && number > 0)
      .slice(0, 16)
      .sort((a, b) => b - a);
  }

  function formatKg(value, fallback = '—') {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const rounded = Math.round(number * 100) / 100;
    const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    return text.replace('.', ',');
  }

  function ironModeLabel(mode) {
    return mode === 'barbell' ? 'Штанга' : 'Гантель';
  }

  function ironBaseWeight(settings) {
    return settings.mode === 'barbell'
      ? Number(settings.barbellBarKg || 0)
      : Number(settings.dumbbellHandleKg || 0);
  }

  function calculateIronOptions(settings) {
    const targetKg = Number(settings.targetKg || 0);
    const baseKg = ironBaseWeight(settings);
    const plates = parseIronPlates(settings.platesPerSide);
    const mode = settings.mode === 'barbell' ? 'barbell' : 'dumbbell';
    const neededPerSide = (targetKg - baseKg) / 2;

    if (!Number.isFinite(targetKg) || targetKg <= 0) return { status: 'bad-target', mode, targetKg, baseKg, plates, neededPerSide, options: [] };
    if (!Number.isFinite(baseKg) || baseKg < 0) return { status: 'bad-base', mode, targetKg, baseKg, plates, neededPerSide, options: [] };
    if (neededPerSide < 0) return { status: 'too-light', mode, targetKg, baseKg, plates, neededPerSide, options: [] };
    if (!plates.length) return { status: 'no-plates', mode, targetKg, baseKg, plates, neededPerSide, options: [] };

    const bySum = new Map();
    bySum.set(0, { sum: 0, plates: [] });
    for (const plate of plates) {
      const current = [...bySum.values()];
      for (const item of current) {
        const nextSum = Math.round((item.sum + plate) * 100) / 100;
        const nextPlates = [...item.plates, plate].sort((a, b) => b - a);
        const previous = bySum.get(Math.round(nextSum * 100));
        if (!previous || nextPlates.length < previous.plates.length) {
          bySum.set(Math.round(nextSum * 100), { sum: nextSum, plates: nextPlates });
        }
      }
    }

    const options = [...bySum.values()]
      .map((item) => ({
        ...item,
        totalKg: Math.round((baseKg + item.sum * 2) * 100) / 100,
        diffKg: Math.round((baseKg + item.sum * 2 - targetKg) * 100) / 100,
      }))
      .sort((a, b) => Math.abs(a.diffKg) - Math.abs(b.diffKg) || Math.abs(a.totalKg - targetKg) - Math.abs(b.totalKg - targetKg) || a.plates.length - b.plates.length);

    const exact = options.find((option) => Math.abs(option.diffKg) < 0.005) || null;
    const lighter = options.filter((option) => option.totalKg < targetKg - 0.005).sort((a, b) => b.totalKg - a.totalKg)[0] || null;
    const heavier = options.filter((option) => option.totalKg > targetKg + 0.005).sort((a, b) => a.totalKg - b.totalKg)[0] || null;
    const best = exact || options[0] || null;
    return { status: exact ? 'exact' : 'nearest', mode, targetKg, baseKg, plates, neededPerSide, exact, best, lighter, heavier, options };
  }

  function renderIronPlateStack(plates) {
    if (!plates?.length) return '<span class="iron-empty-stack">без блинов</span>';
    return plates.map((plate) => `<span class="iron-plate-chip">${formatKg(plate)} кг</span>`).join('');
  }

  function renderIronResult(result, compact = false) {
    if (result.status === 'bad-target') return '<div class="notice warning"><strong>Укажи целевой вес.</strong><br>Например: 28 кг для гантели или 60 кг для штанги.</div>';
    if (result.status === 'bad-base') return '<div class="notice warning"><strong>Проверь вес ручки/грифа.</strong><br>Он не может быть отрицательным.</div>';
    if (result.status === 'too-light') return `<div class="notice warning"><strong>Цель легче основы.</strong><br>${ironModeLabel(result.mode)} уже весит ${formatKg(result.baseKg)} кг без блинов.</div>`;
    if (result.status === 'no-plates') return '<div class="notice warning"><strong>Добавь блины.</strong><br>Введи доступные блины на одну сторону через запятую.</div>';
    if (!result.best) return '<div class="notice warning"><strong>Не удалось посчитать.</strong><br>Проверь введённые веса.</div>';

    const best = result.best;
    const diff = Math.abs(best.diffKg) < 0.005 ? 'точно' : best.diffKg > 0 ? `+${formatKg(best.diffKg)} кг` : `−${formatKg(Math.abs(best.diffKg))} кг`;
    const nearest = [result.lighter, result.heavier]
      .filter(Boolean)
      .map((option) => `${formatKg(option.totalKg)} кг`)
      .join(' / ');

    return `
      <div class="iron-result-card ${result.status === 'exact' ? 'exact' : 'nearest'}">
        <div class="iron-result-top">
          <div><span>${result.status === 'exact' ? 'Собирается точно' : 'Ближайший вариант'}</span><strong>${formatKg(best.totalKg)} кг</strong></div>
          <em>${escapeHTML(diff)}</em>
        </div>
        <div class="iron-side-load"><span>На каждую сторону</span><div>${renderIronPlateStack(best.plates)}</div></div>
        ${compact ? '' : `<div class="iron-result-details"><div><span>Основа</span><strong>${formatKg(result.baseKg)} кг</strong></div><div><span>Нужно на сторону</span><strong>${formatKg(Math.max(result.neededPerSide, 0))} кг</strong></div><div><span>Ближайшие</span><strong>${escapeHTML(nearest || '—')}</strong></div></div>`}
      </div>
    `;
  }

  function renderIronCalculatorCard() {
    const settings = ironCalculatorSettings();
    const result = calculateIronOptions(settings);
    const plates = parseIronPlates(settings.platesPerSide);
    return `
      <div class="card iron-card">
        <div class="iron-card-head">
          <div><div class="eyebrow">Гантели · штанга · блины</div><h3>Собрать нужный вес</h3><p>Считает симметрично: ручка/гриф + одинаковые блины с двух сторон.</p></div>
          <div class="iron-card-mark" aria-hidden="true">⚖️</div>
        </div>
        ${renderIronResult(result, true)}
        <div class="iron-mini-grid">
          <div><span>Режим</span><strong>${escapeHTML(ironModeLabel(settings.mode))}</strong></div>
          <div><span>Цель</span><strong>${formatKg(settings.targetKg)} кг</strong></div>
          <div><span>Блинов</span><strong>${plates.length}</strong></div>
        </div>
        <button class="button primary full" id="open-iron-calculator" type="button">Открыть калькулятор</button>
      </div>
    `;
  }

  function currentWorkoutTargetWeight() {
    const fallback = ironCalculatorSettings().targetKg;
    const exercise = state.currentWorkout?.exercises?.find((result) => result.defaults?.unit === 'reps' && !result.skipped && result.sets?.some((set) => !set.completed));
    if (!exercise) return fallback;
    const activeIndex = workoutActiveSetIndex(exercise);
    const value = exercise.sets?.[activeIndex]?.weightKg;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function modalIronSettings(presetTargetKg = null) {
    const settings = ironCalculatorSettings();
    if (presetTargetKg !== null && presetTargetKg !== undefined) {
      const target = Number(presetTargetKg);
      if (Number.isFinite(target) && target > 0) settings.targetKg = target;
    }
    return settings;
  }

  function getIronModalSettings() {
    return {
      mode: el.modalRoot.querySelector('#iron-mode')?.value === 'barbell' ? 'barbell' : 'dumbbell',
      targetKg: parseIronWeight(el.modalRoot.querySelector('#iron-target')?.value) || 0,
      dumbbellHandleKg: parseIronWeight(el.modalRoot.querySelector('#iron-dumbbell-handle')?.value) ?? 0,
      barbellBarKg: parseIronWeight(el.modalRoot.querySelector('#iron-barbell-bar')?.value) ?? 0,
      platesPerSide: el.modalRoot.querySelector('#iron-plates')?.value || '',
    };
  }

  function updateIronCalculatorResult() {
    const settings = getIronModalSettings();
    const result = calculateIronOptions(settings);
    const resultNode = el.modalRoot.querySelector('#iron-calculator-result');
    const modeHint = el.modalRoot.querySelector('#iron-mode-hint');
    const baseLabel = settings.mode === 'barbell' ? `Гриф ${formatKg(settings.barbellBarKg)} кг` : `Ручка ${formatKg(settings.dumbbellHandleKg)} кг`;
    if (modeHint) modeHint.textContent = `${ironModeLabel(settings.mode)} · ${baseLabel} · блины на одну сторону`;
    if (resultNode) resultNode.innerHTML = renderIronResult(result);
  }

  function showIronCalculatorModal(presetTargetKg = null) {
    const settings = modalIronSettings(presetTargetKg);
    showModal(`
      <div class="modal-head"><h2>Калькулятор железа</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice"><strong>Считает симметрично.</strong><br>Введи блины, которые доступны на одну сторону. Одинаковые блины можно указать несколько раз.</div>
      <div class="form-grid iron-form">
        <div class="field"><label>Что собираем</label><select id="iron-mode"><option value="dumbbell" ${settings.mode === 'dumbbell' ? 'selected' : ''}>Гантель</option><option value="barbell" ${settings.mode === 'barbell' ? 'selected' : ''}>Штанга</option></select><div class="help" id="iron-mode-hint"></div></div>
        <div class="field"><label>Нужный общий вес, кг</label><input id="iron-target" type="number" inputmode="decimal" step="0.5" min="0" value="${escapeAttr(String(settings.targetKg ?? ''))}"></div>
        <div class="inline-fields two">
          <div class="field"><label>Ручка гантели, кг</label><input id="iron-dumbbell-handle" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeAttr(String(settings.dumbbellHandleKg ?? ''))}"></div>
          <div class="field"><label>Гриф штанги, кг</label><input id="iron-barbell-bar" type="number" inputmode="decimal" step="0.5" min="0" value="${escapeAttr(String(settings.barbellBarKg ?? ''))}"></div>
        </div>
        <div class="field"><label>Блины на одну сторону</label><textarea id="iron-plates" rows="3" placeholder="10, 5, 2.5, 1.25, 1">${escapeHTML(settings.platesPerSide || '')}</textarea><div class="help">Например: 10, 5, 2.5, 1.25, 1. Если есть две одинаковые пары — повтори вес два раза.</div></div>
      </div>
      <div id="iron-calculator-result" class="iron-modal-result"></div>
      <div class="button-row" style="margin-top:12px"><button class="button primary" id="save-iron-calculator" type="button">Сохранить набор</button><button class="button secondary" id="copy-iron-calculator" type="button">Скопировать расчёт</button></div>
    `);

    ['iron-mode', 'iron-target', 'iron-dumbbell-handle', 'iron-barbell-bar', 'iron-plates'].forEach((id) => {
      el.modalRoot.querySelector(`#${id}`)?.addEventListener(id === 'iron-mode' ? 'change' : 'input', updateIronCalculatorResult);
    });
    el.modalRoot.querySelector('#save-iron-calculator')?.addEventListener('click', saveIronCalculatorSettings);
    el.modalRoot.querySelector('#copy-iron-calculator')?.addEventListener('click', copyIronCalculatorResult);
    updateIronCalculatorResult();
  }

  async function saveIronCalculatorSettings() {
    const settings = getIronModalSettings();
    state.settings.ironCalculator = settings;
    await DB.setSettingsObject({ ironCalculator: settings }, state.activeProfileId);
    toast('Набор железа сохранён');
  }

  async function copyIronCalculatorResult() {
    const settings = getIronModalSettings();
    const text = ironResultText(settings, calculateIronOptions(settings));
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else fallbackCopyText(text);
      toast('Расчёт скопирован');
    } catch (error) {
      fallbackCopyText(text);
      toast('Расчёт скопирован');
    }
  }

  function ironResultText(settings, result) {
    const lines = [`${ironModeLabel(settings.mode)}: цель ${formatKg(settings.targetKg)} кг`];
    lines.push(`Основа: ${formatKg(result.baseKg)} кг`);
    if (!result.best) {
      lines.push('Не удалось подобрать вес.');
      return lines.join('\n');
    }
    lines.push(`Итого: ${formatKg(result.best.totalKg)} кг`);
    lines.push(`На каждую сторону: ${result.best.plates.length ? result.best.plates.map((plate) => `${formatKg(plate)} кг`).join(' + ') : 'без блинов'}`);
    if (Math.abs(result.best.diffKg) >= 0.005) lines.push(`Отклонение: ${result.best.diffKg > 0 ? '+' : '-'}${formatKg(Math.abs(result.best.diffKg))} кг`);
    if (result.lighter || result.heavier) lines.push(`Ближайшие: ${[result.lighter, result.heavier].filter(Boolean).map((option) => `${formatKg(option.totalKg)} кг`).join(' / ')}`);
    return lines.join('\n');
  }

  function showProfileModal() {
    showModal(`
      <div class="modal-head"><h2>Профиль ${escapeHTML(state.profile.name)}</h2><button class="modal-close" data-close>×</button></div>
      <div class="form-grid">
        <div class="field"><label>Имя</label><input id="profile-name" value="${escapeAttr(state.profile.name)}"></div>
        <div class="inline-fields three"><div class="field"><label>Возраст</label><input id="profile-age" type="number" value="${state.profile.age || ''}"></div><div class="field"><label>Рост, см</label><input id="profile-height" type="number" value="${state.profile.heightCm || ''}"></div><div class="field"><label>Вес, кг</label><input id="profile-weight" type="number" step="0.1" value="${latestProfileWeightKg() ?? ''}"></div></div>
        <div class="field"><label>Цели — по одной на строке</label><textarea id="profile-goals">${escapeHTML((state.profile.goals || []).join('\n'))}</textarea></div>
        <div class="field"><label>Инвентарь — по одному на строке</label><textarea id="profile-equipment">${escapeHTML((state.profile.equipment || []).join('\n'))}</textarea></div>
        <div class="field"><label>Ограничения — по одному на строке</label><textarea id="profile-constraints">${escapeHTML((state.profile.constraints || []).join('\n'))}</textarea></div>
        <div class="notice"><strong>Текущий режим:</strong> ${escapeHTML(profileBuilderScheduleText({ scheduleMode: state.profile.trainingPreferences?.scheduleMode || state.settings.scheduleMode || 'weekly', daysPerWeek: state.profile.trainingPreferences?.daysPerWeek || state.settings.daysPerWeek || 4 }))}.<br>Упражнения и дни по-прежнему редактируются в разделе «План».</div>
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
      state.profile.constraints=document.getElementById('profile-constraints').value.split('\n').map((item)=>item.trim()).filter(Boolean);
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
      await DB.put('nutrition',state.nutrition);
      closeModal();
      if (state.route === 'nutrition') renderNutrition();
      else renderMore();
      toast('Питание обновлено');
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
        throw new Error('Это не резервная копия приложения «РЕЖИМ»');
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
      stopRestTimer();
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


  function painEntryDateKey(entry) {
    const raw = entry.date || entry.createdAt || entry.timestamp || todayISO();
    return String(raw).slice(0, 10);
  }

  function painEntryTime(entry) {
    const value = new Date(entry.createdAt || entry.date || entry.timestamp || 0).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function sortedPainEntries() {
    return [...(state.painEntries || [])].sort((a, b) => painEntryTime(b) - painEntryTime(a));
  }

  function painDateGroups() {
    const groups = new Map();
    for (const entry of sortedPainEntries()) {
      const key = painEntryDateKey(entry);
      const current = groups.get(key) || { date: key, count: 0, maxScore: 0 };
      current.count += 1;
      current.maxScore = Math.max(current.maxScore, Number(entry.score) || 0);
      groups.set(key, current);
    }
    return [...groups.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  async function deletePainEntries(ids, message = 'Записи боли удалены') {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) {
      toast('Нечего удалять');
      return false;
    }
    await Promise.all(uniqueIds.map((id) => DB.remove('painEntries', id)));
    state.painEntries = (state.painEntries || []).filter((entry) => !uniqueIds.includes(entry.id));
    toast(message);
    return true;
  }

  async function confirmDeletePainEntries(ids, label, afterDelete = 'history') {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) {
      toast('Нечего удалять');
      return;
    }
    const text = `${label}: ${uniqueIds.length} запис${uniqueIds.length === 1 ? 'ь' : uniqueIds.length < 5 ? 'и' : 'ей'}. Удалить?\n\nТренировки, профили, фото и замеры не трогаются.`;
    if (!window.confirm(text)) return;
    await deletePainEntries(uniqueIds, 'История боли очищена');
    if (afterDelete === 'cleanup') showPainCleanupModal();
    else showPainHistoryModal();
    if (state.route === 'more') renderMore();
  }

  function showPainHistoryModal() {
    const entries = sortedPainEntries();
    showModal(`
      <div class="modal-head"><h2>История боли</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice"><strong>Это дневник ощущений, не диагноз.</strong><br>Если боль сильная, новая, нарастает или появляется выпуклость/отёк — лучше остановиться и обратиться к врачу.</div>
      <div class="button-row pain-history-tools" style="margin-top:12px">
        <button class="button secondary" id="open-pain-cleanup-modal" type="button" ${entries.length ? '' : 'disabled'}>Очистить</button>
        <button class="button ghost" id="delete-latest-pain" type="button" ${entries.length ? '' : 'disabled'}>Удалить последнюю</button>
      </div>
      <div class="card list-card" style="margin-top:12px">
        ${entries.length ? entries.slice(0, 80).map((entry) => renderPainEntry(entry, { withDelete: true })).join('') : '<div class="empty compact-empty"><strong>Пока нет записей</strong>Отметь боль перед тренировкой или возле упражнения.</div>'}
      </div>
    `);
    el.modalRoot.querySelector('#open-pain-cleanup-modal')?.addEventListener('click', showPainCleanupModal);
    el.modalRoot.querySelector('#delete-latest-pain')?.addEventListener('click', () => confirmDeletePainEntries(entries.slice(0, 1).map((entry) => entry.id), 'Удалить последнюю запись'));
    el.modalRoot.querySelectorAll('.delete-pain-entry').forEach((button) => {
      button.addEventListener('click', () => confirmDeletePainEntries([button.dataset.id], 'Удалить эту запись'));
    });
  }

  function showPainCleanupModal() {
    const entries = sortedPainEntries();
    const weekFrom = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const lastWeekIds = entries.filter((entry) => painEntryTime(entry) >= weekFrom).map((entry) => entry.id);
    const groups = painDateGroups();
    showModal(`
      <div class="modal-head"><h2>Очистить историю боли</h2><button class="modal-close" data-close>×</button></div>
      <div class="notice warning"><strong>Удаляются только отметки боли.</strong><br>Тренировки, профили, фото, замеры, программы и резервные копии не трогаются.</div>
      <div class="pain-cleanup-grid" style="margin-top:12px">
        <button class="button secondary" id="delete-pain-last" type="button" ${entries.length ? '' : 'disabled'}>Последнюю</button>
        <button class="button secondary" id="delete-pain-week" type="button" ${lastWeekIds.length ? '' : 'disabled'}>За 7 дней</button>
        <button class="button danger" id="delete-pain-all" type="button" ${entries.length ? '' : 'disabled'}>Очистить всё</button>
      </div>
      <div class="section-head pain-days-head" style="margin-top:16px"><h2>Выбрать дни</h2><button class="link-button" id="select-all-pain-days" type="button" ${groups.length ? '' : 'disabled'}>Все дни</button></div>
      <div class="card list-card pain-day-list">
        ${groups.length ? groups.map((group) => `<label class="list-row pain-day-row"><div class="list-row-main"><div class="list-row-title">${formatShortDate(group.date)}</div><div class="list-row-sub">${group.count} запис${group.count === 1 ? 'ь' : group.count < 5 ? 'и' : 'ей'} · максимум ${group.maxScore}/10</div></div><input class="pain-day-check" type="checkbox" value="${escapeAttr(group.date)}"></label>`).join('') : '<div class="empty compact-empty"><strong>Пока нечего удалять</strong>История боли пустая.</div>'}
      </div>
      <button class="button primary full" id="delete-selected-pain-days" type="button" style="margin-top:12px" ${groups.length ? '' : 'disabled'}>Удалить выбранные дни</button>
    `);
    el.modalRoot.querySelector('#delete-pain-last')?.addEventListener('click', () => confirmDeletePainEntries(entries.slice(0, 1).map((entry) => entry.id), 'Удалить последнюю запись', 'cleanup'));
    el.modalRoot.querySelector('#delete-pain-week')?.addEventListener('click', () => confirmDeletePainEntries(lastWeekIds, 'Удалить записи за 7 дней', 'cleanup'));
    el.modalRoot.querySelector('#delete-pain-all')?.addEventListener('click', () => confirmDeletePainEntries(entries.map((entry) => entry.id), 'Очистить всю историю боли', 'cleanup'));
    el.modalRoot.querySelector('#select-all-pain-days')?.addEventListener('click', () => {
      el.modalRoot.querySelectorAll('.pain-day-check').forEach((input) => { input.checked = true; });
    });
    el.modalRoot.querySelector('#delete-selected-pain-days')?.addEventListener('click', () => {
      const dates = [...el.modalRoot.querySelectorAll('.pain-day-check:checked')].map((input) => input.value);
      const ids = entries.filter((entry) => dates.includes(painEntryDateKey(entry))).map((entry) => entry.id);
      confirmDeletePainEntries(ids, 'Удалить записи за выбранные дни', 'cleanup');
    });
  }

  async function showStorageInfo() {
    let text='Браузер не сообщил объём хранилища.';
    if(navigator.storage?.estimate){const e=await navigator.storage.estimate(); text=`Использовано примерно ${formatBytes(e.usage||0)} из ${formatBytes(e.quota||0)}.`;}
    let persistent='';
    if(navigator.storage?.persisted){persistent=(await navigator.storage.persisted())?' Хранилище помечено постоянным.':' Постоянное хранение не гарантировано.';}
    showModal(`<div class="modal-head"><h2>Хранилище</h2><button class="modal-close" data-close>×</button></div><div class="notice">${escapeHTML(text+persistent)}</div><p class="muted">Даже при большом лимите делай резервную копию: пользовательская очистка Safari удаляет локальную базу.</p>`);
  }

  function showQuickAdd() {
    if (state.route === 'nutrition') {
      showFoodPicker(defaultNutritionMeal());
      return;
    }
    showModal(`
      <div class="modal-head"><h2>Быстро добавить</h2><button class="modal-close" data-close>×</button></div>
      <div class="card list-card"><button class="list-row quick-measure" style="width:100%;background:transparent;border-left:0;border-right:0;border-top:0;color:inherit"><div class="list-row-main"><div class="list-row-title">Замер тела</div><div class="list-row-sub">Вес, талия, живот и объёмы</div></div><span>＋</span></button><button class="list-row quick-photo" style="width:100%;background:transparent;border:0;color:inherit"><div class="list-row-main"><div class="list-row-title">Фото прогресса</div><div class="list-row-sub">Хранится локально</div></div><span>＋</span></button></div>
    `);
    el.modalRoot.querySelector('.quick-measure').addEventListener('click',()=>{closeModal();showMeasurementModal();});
    el.modalRoot.querySelector('.quick-photo').addEventListener('click',()=>{closeModal();showPhotoModal();});
  }

  function showModal(content) {
    document.body.classList.add('modal-open');
    el.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-handle"></div>${content}</div></div>`;
    el.modalRoot.querySelectorAll('[data-close]').forEach((x)=>x.addEventListener('click',closeModal));
    el.modalRoot.querySelector('.modal-backdrop').addEventListener('click',(e)=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
  }

  function closeModal() {
    const shouldSaveProgramDraft = Boolean(state.programBuilder && el.modalRoot.querySelector('.program-builder-modal'));
    if (shouldSaveProgramDraft) {
      readProgramBuilderInputs();
      clearProgramBuilderDraftSaveTimer();
      const draft = state.programBuilder;
      state.programBuilder = null;
      persistProgramBuilderDraft(draft)
        .then((snapshot) => toast(`Черновик «${String(snapshot?.name || 'Моя программа').trim() || 'Без названия'}» сохранён`))
        .catch((error) => {
          console.error('Program draft save on close failed', error);
          toast('Не удалось сохранить черновик программы');
        });
    }
    el.modalRoot.innerHTML='';
    document.body.classList.remove('modal-open');
    if (shouldSaveProgramDraft) {
      if (state.route === 'home') renderHome();
      else if (state.route === 'plan') renderPlan();
      else if (state.route === 'movement') renderMovement();
    }
  }

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
    stopRestTimer();
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

  function exerciseHistoryResults(exerciseId, limit = 4) {
    const rows = [];
    for (const workout of completedWorkoutList(state.workouts)) {
      const result = (workout.exercises || []).find((item) => item.exerciseId === exerciseId && !item.skipped && completedSets(item).length);
      if (!result) continue;
      rows.push({ workout, result });
      if (rows.length >= limit) break;
    }
    return rows;
  }

  function latestStoredProgression(exerciseId) {
    for (const workout of completedWorkoutList(state.workouts)) {
      const row = (workout.progression || []).find((item) => item.exerciseId === exerciseId);
      if (row?.text) return row;
    }
    return null;
  }

  function progressionSuggestion(exercise,last) {
    const stored = latestStoredProgression(exercise?.id);
    if (stored) return { ...stored, text: stored.text || stored.title || 'Повтори прошлую нагрузку' };
    if(!last)return {kind:'start',weightKg:exercise.defaults.weightKg??null,text:'Введи первый рабочий вес'};
    if(exercise.defaults.unit!=='reps')return {kind:'same',weightKg:null,text:'Повтори прошлую длительность'};
    const completed=last.sets.filter((s)=>s.completed);if(!completed.length)return {kind:'reduce',weightKg:null,text:'Начни спокойно'};
    const base=Math.max(...completed.map((s)=>Number(s.weightKg)||0));
    const days=Math.floor((Date.now()-new Date(last.workoutDate).getTime())/86400000);
    if(days>30)return {kind:'reduce',weightKg:roundHalf(base*0.8),text:'Перерыв больше месяца: начни примерно на 20% легче'};
    if(days>14)return {kind:'reduce',weightKg:roundHalf(base*0.9),text:'После перерыва начни примерно на 10% легче'};
    const diff=completed.map((s)=>s.difficulty);
    if(completed.length===last.sets.length && diff.every((x)=>x==='easy')){const next=roundHalf(base>0?base+recommendedWeightStep(base):base);return {kind:'increase',weightKg:next,text:base>0?`Можно попробовать ${formatKg(next)} кг или +1 повтор`:'Добавь 1–2 повтора'};}
    if(diff.some((x)=>x==='failure') || completed.length<last.sets.length){const next=base>0?roundHalf(base*0.95):base;return {kind:'reduce',weightKg:next,text:base>0?`Спокойнее: около ${formatKg(next)} кг`:'Снизь повторы'};}
    if(diff.some((x)=>x==='hard'))return {kind:'same',weightKg:base,text:`Оставь ${formatKg(base, 'тот же')} кг`};
    return {kind:'same',weightKg:base,text:`Повтори ${formatKg(base, 'тот же вес')} кг`};
  }

  function recommendedWeightStep(weight) {
    const value = Number(weight) || 0;
    if (value <= 0) return 0;
    if (value < 10) return 0.5;
    if (value < 30) return 1;
    return 2;
  }

  function progressionMetrics(result) {
    const done = completedSets(result);
    const weights = done.map((set) => Number(set.weightKg) || 0);
    const reps = done.map((set) => Number(set.reps) || 0);
    const hardCount = done.filter((set) => ['hard', 'failure'].includes(set.difficulty)).length;
    const failureCount = done.filter((set) => set.difficulty === 'failure').length;
    return {
      done,
      completedSets: done.length,
      plannedSets: result?.sets?.length || 0,
      fullCompletion: Boolean(done.length && done.length === (result?.sets?.length || 0)),
      maxWeight: weights.length ? Math.max(...weights) : 0,
      minReps: reps.length ? Math.min(...reps) : 0,
      maxReps: reps.length ? Math.max(...reps) : 0,
      averageReps: reps.length ? reps.reduce((sum, value) => sum + value, 0) / reps.length : 0,
      volume: done.reduce((sum, set) => sum + (Number(set.weightKg) || 0) * (Number(set.reps) || 0), 0),
      hardRatio: done.length ? hardCount / done.length : 0,
      failureCount,
      discomfort: result?.feedback === 'discomfort' || Boolean(result?.painEvents?.length),
    };
  }

  function smartPostWorkoutRecommendation(result, workout = null) {
    const exercise = getExercise(result.exerciseId) || { defaults: result.defaults || {}, name: result.name };
    const metrics = progressionMetrics(result);
    const history = exerciseHistoryResults(result.exerciseId, 3);
    const previous = history[0]?.result ? progressionMetrics(history[0].result) : null;
    const confidence = history.length >= 3 ? 'высокая' : history.length >= 1 ? 'средняя' : 'начальная';
    const base = {
      exerciseId: result.exerciseId,
      exerciseName: result.name || exercise.name,
      createdAt: new Date().toISOString(),
      confidence,
      previousDate: history[0]?.workout?.startedAt || null,
    };
    if (result.skipped || !metrics.completedSets) {
      return { ...base, kind: 'reduce', title: 'Вернуться спокойно', text: 'Упражнение не выполнено — в следующий раз начни без повышения нагрузки.', reason: 'нет завершённых подходов' };
    }
    if (metrics.discomfort || resultHasHighPain(result, workout)) {
      const nextWeight = metrics.maxWeight > 0 ? roundHalf(metrics.maxWeight * 0.9) : null;
      return { ...base, kind: 'reduce', title: 'Сначала комфорт', weightKg: nextWeight, text: nextWeight ? `Не повышать. Начни примерно с ${formatKg(nextWeight)} кг или выбери замену.` : 'Не повышать нагрузку; сократи амплитуду или выбери замену.', reason: 'отмечен дискомфорт или боль' };
    }
    if (exercise.defaults?.unit === 'minutes' || exercise.defaults?.unit === 'seconds') {
      const field = exercise.defaults.unit === 'minutes' ? 'durationMin' : 'durationSec';
      const unit = exercise.defaults.unit === 'minutes' ? 'мин' : 'сек';
      const current = Math.max(...metrics.done.map((set) => Number(set[field]) || 0));
      if (!metrics.fullCompletion || metrics.failureCount || metrics.hardRatio >= 0.5) {
        const next = Math.max(1, Math.round(current * 0.9));
        return { ...base, kind: 'reduce', title: 'Сделать легче', duration: next, text: `Следующий раз: около ${next} ${unit} без выхода на предел.`, reason: 'часть работы была тяжёлой или не завершена' };
      }
      if (metrics.done.every((set) => set.difficulty === 'easy')) {
        const add = exercise.defaults.unit === 'minutes' ? Math.max(1, Math.round(current * 0.1)) : Math.max(5, Math.round(current * 0.1));
        return { ...base, kind: 'increase', title: 'Немного добавить', duration: current + add, text: `Попробуй ${current + add} ${unit}.`, reason: 'вся работа выполнена легко' };
      }
      return { ...base, kind: 'same', title: 'Закрепить', duration: current, text: `Повтори около ${current} ${unit}.`, reason: 'нагрузка была рабочей' };
    }
    if (!metrics.fullCompletion || metrics.failureCount) {
      const nextWeight = metrics.maxWeight > 0 ? roundHalf(metrics.maxWeight * 0.95) : null;
      return { ...base, kind: 'reduce', title: 'Сделать устойчивее', weightKg: nextWeight, text: nextWeight ? `Попробуй ${formatKg(nextWeight)} кг и выполни все подходы без отказа.` : 'Снизь повторения на 1–2 и закончи все подходы.', reason: 'были незавершённые подходы или отказ' };
    }
    if (metrics.hardRatio >= 0.5 || result.feedback === 'hard') {
      return { ...base, kind: 'same', title: 'Оставить нагрузку', weightKg: metrics.maxWeight || null, text: metrics.maxWeight ? `Оставь ${formatKg(metrics.maxWeight)} кг и закрепи технику.` : 'Повтори тот же объём.', reason: 'больше половины подходов были тяжёлыми' };
    }
    const targetMax = Number(result.defaults?.repsMax || exercise.defaults?.repsMax || 0);
    const allEasy = metrics.done.every((set) => set.difficulty === 'easy') || result.feedback === 'easy';
    const previousImproved = previous && (metrics.volume > previous.volume * 1.03 || metrics.maxReps > previous.maxReps);
    if (metrics.maxWeight > 0 && (allEasy || (targetMax > 0 && metrics.minReps >= targetMax))) {
      const nextWeight = roundHalf(metrics.maxWeight + recommendedWeightStep(metrics.maxWeight));
      return { ...base, kind: 'increase', title: 'Добавить вес', weightKg: nextWeight, text: `Попробуй ${formatKg(nextWeight)} кг. Если техника поплывёт — вернись к ${formatKg(metrics.maxWeight)} кг.`, reason: allEasy ? 'все подходы выполнены легко' : `во всех подходах достигнут верх диапазона повторов${previousImproved ? ', результат вырос' : ''}` };
    }
    if (targetMax > 0 && metrics.minReps < targetMax) {
      const nextMin = Math.min(targetMax, Math.max(metrics.minReps + 1, Number(result.defaults?.repsMin || 1)));
      return { ...base, kind: 'increase', title: 'Добавить повтор', weightKg: metrics.maxWeight || null, repsMin: nextMin, repsMax: targetMax, text: `Оставь ${metrics.maxWeight ? `${formatKg(metrics.maxWeight)} кг` : 'тот же вариант'} и целься минимум в ${nextMin} повторов в каждом подходе.`, reason: 'вес уже рабочий, но диапазон повторов ещё не закрыт' };
    }
    return { ...base, kind: 'same', title: 'Закрепить', weightKg: metrics.maxWeight || null, text: metrics.maxWeight ? `Повтори ${formatKg(metrics.maxWeight)} кг с той же техникой.` : 'Повтори тот же объём.', reason: 'нагрузка выполнена ровно' };
  }

  function postWorkoutSuggestion(result, workout = null){
    return smartPostWorkoutRecommendation(result, workout);
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



  function deloadSnapshot(analysis) {
    return {
      suggestedAt: new Date().toISOString(),
      status: analysis.status,
      statusLabel: analysis.statusLabel,
      score: analysis.score,
      title: analysis.title,
      detailText: analysis.detailText,
      signals: analysis.signals.map((signal) => ({ id: signal.id, title: signal.title, label: signal.label, weight: signal.weight })),
      plan: { weightPercent: 80, setPercent: 65, noFailure: true, lightStepper: true },
      applied: false,
    };
  }

  function renderWorkoutDeloadBanner(workout) {
    if (!workout?.deload || workout.deload.dismissed) return '';
    const applied = workout.deload.applied;
    const tone = workout.deload.status === 'critical' ? 'danger' : 'warning';
    return `<div class="notice ${tone} deload-workout-banner">
      <strong>${applied ? 'Разгрузка применена' : 'Предложена разгрузка'}:</strong> ${escapeHTML(workout.deload.detailText || workout.deload.title || 'Организм просит полегче')}
      <div class="help" style="margin-top:6px">План: вес −15–20%, подходы −30–40%, без отказа, степпер легко.</div>
      ${applied ? '<div class="help" style="margin-top:6px">Рабочие веса/время уже снижены в незавершённых подходах.</div>' : '<button class="button secondary small" id="apply-deload-workout" type="button" style="margin-top:10px">Применить −20% к этой тренировке</button>'}
    </div>`;
  }

  function renderWorkoutDeloadDetailsBlock(workout) {
    if (!workout?.deload) return '';
    const signals = workout.deload.signals?.length ? workout.deload.signals.map((signal) => escapeHTML(signal.label)).join('<br>') : 'Сигналы не сохранены';
    return `<div class="notice ${workout.deload.applied ? 'success' : 'warning'}" style="margin-top:12px"><strong>Разгрузка:</strong> ${escapeHTML(workout.deload.applied ? 'применена' : 'предлагалась')}<br>${signals}</div>`;
  }

  async function applyDeloadToCurrentWorkout() {
    const workout = state.currentWorkout;
    if (!workout?.deload || workout.deload.applied) return;
    workout.exercises.forEach((result) => {
      if (result.skipped) return;
      result.deloadAdjusted = true;
      result.sets.forEach((set) => {
        if (set.completed) return;
        if (result.defaults?.unit === 'reps') {
          const weight = Number(set.weightKg) || 0;
          if (weight > 0) set.weightKg = roundHalf(weight * 0.8);
          if (set.difficulty === 'failure') set.difficulty = 'hard';
        } else if (result.defaults?.unit === 'minutes') {
          const minutes = Number(set.durationMin) || 0;
          if (minutes > 1) set.durationMin = Math.max(1, Math.round(minutes * 0.7));
        } else if (result.defaults?.unit === 'seconds') {
          const seconds = Number(set.durationSec) || 0;
          if (seconds > 10) set.durationSec = Math.max(10, Math.round(seconds * 0.7));
        }
      });
      result.suggestion = { ...(result.suggestion || {}), kind: 'reduce', text: 'Разгрузка: легче, без отказа' };
    });
    workout.deload.applied = true;
    workout.deload.appliedAt = new Date().toISOString();
    await saveDraftWorkout();
    renderWorkout();
    toast('Разгрузка применена: незавершённые подходы стали легче');
  }


  function isRecoveryWorkout(workout) {
    return workout?.type === 'recovery_day' || Boolean(workout?.recoveryDay);
  }

  function workoutTrainingSetCount(workout) {
    if (!workout?.exercises?.length) return 0;
    return workout.exercises.reduce((sum, result) => sum + completedSets(result).length, 0);
  }

  function isTrainingWorkout(workout) {
    return workout?.status === 'completed' && !isRecoveryWorkout(workout) && Array.isArray(workout.exercises) && workout.exercises.length > 0;
  }

  function workoutHasOnlyLightActivity(workout) {
    if (!isTrainingWorkout(workout)) return false;
    const sets = workoutTrainingSetCount(workout);
    const load = Number(workout.totalLoadKg || 0);
    const hard = (workout.exercises || []).flatMap((result) => completedSets(result)).filter((set) => ['hard', 'failure'].includes(set.difficulty)).length;
    const allStepper = (workout.exercises || []).filter((result) => completedSets(result).length).every((result) => getExercise(result.exerciseId)?.equipment === 'Степпер' || isTimeResult(result));
    return allStepper || (sets > 0 && sets <= 4 && load <= 0 && hard === 0) || Boolean(workout.shortMode && hard === 0 && sets <= 6);
  }

  function hasRecoveryDayForDate(date) {
    return state.workouts.some((workout) => workout.status === 'completed' && localDateISO(new Date(workout.startedAt || workout.date)) === date && isRecoveryWorkout(workout));
  }

  function activityKindForDate(date, workouts = state.workouts) {
    const rows = workouts.filter((workout) => workout?.status === 'completed' && localDateISO(new Date(workout.startedAt || workout.date)) === date);
    const manual = rows.filter(isManualDayEntry).sort((a,b) => new Date(b.manualDay?.updatedAt || b.finishedAt || 0) - new Date(a.manualDay?.updatedAt || a.finishedAt || 0))[0];
    if (manual?.manualDay?.kind) return manual.manualDay.kind;
    if (rows.some(isTrainingWorkout)) {
      return rows.some((workout) => !workoutHasOnlyLightActivity(workout)) ? 'training' : 'light';
    }
    if (rows.some(isRecoveryWorkout)) return 'recovery';
    return 'rest';
  }

  function buildActivityDays(days = 14) {
    const today = startOfDay(new Date());
    return Array.from({ length: days }, (_, index) => {
      const d = new Date(today.getTime() - index * 86400000);
      const iso = localDateISO(d);
      const kind = activityKindForDate(iso);
      const loggedRest = manualDayEntryForDate(iso)?.manualDay?.kind === 'rest';
      const label = kind === 'training'
        ? 'Тренировка'
        : kind === 'light'
          ? 'Лёгкая активность'
          : kind === 'recovery'
            ? 'Восстановление'
            : loggedRest
              ? 'Полный отдых отмечен'
              : 'Нет тренировки';
      const shortLabel = kind === 'training' ? 'Т' : kind === 'light' ? 'Л' : kind === 'recovery' ? 'В' : loggedRest ? 'О' : '·';
      return { date: iso, dateObj: d, kind, label, shortLabel, shortDate: formatTinyDate(iso), loggedRest };
    });
  }

  function countConsecutiveKind(days, acceptedKinds, startIndex = 0) {
    let count = 0;
    for (let i = startIndex; i < days.length; i += 1) {
      if (!acceptedKinds.includes(days[i].kind)) break;
      count += 1;
    }
    return count;
  }

  function smartRestAnalysis({ includeTodayTraining = false } = {}) {
    const days = buildActivityDays(14);
    const todayWasTraining = days[0]?.kind === 'training' || days[0]?.kind === 'light';
    const yesterdayTrainingRun = countConsecutiveKind(days, ['training'], todayWasTraining ? 0 : 1);
    const currentTrainingRun = countConsecutiveKind(days, ['training'], 0);
    const potentialConsecutiveTrainingDays = includeTodayTraining && !todayWasTraining ? yesterdayTrainingRun + 1 : currentTrainingRun;
    const daysWithoutFullRestBase = countConsecutiveKind(days, ['training', 'light', 'recovery'], 0);
    const daysWithoutFullRest = includeTodayTraining && days[0]?.kind === 'rest' ? 1 + countConsecutiveKind(days, ['training', 'light', 'recovery'], 1) : daysWithoutFullRestBase;
    const last7 = days.slice(0, 7);
    const trainingDays7 = last7.filter((day) => day.kind === 'training').length;
    const lightDays7 = last7.filter((day) => day.kind === 'light').length;
    const recoveryDays7 = last7.filter((day) => day.kind === 'recovery').length;
    const fullRestDays7 = last7.filter((day) => day.kind === 'rest').length;
    const throughDayPattern = trainingDays7 >= 3 && potentialConsecutiveTrainingDays <= 2 && fullRestDays7 >= 2;
    const signals = [];
    const push = (id, title, label, weight) => signals.push({ id, title, label, weight });

    if (potentialConsecutiveTrainingDays >= 5) push('consecutive-critical', 'Много тренировок подряд', `${potentialConsecutiveTrainingDays} тренировочных дней подряд с учётом сегодняшней`, 3);
    else if (potentialConsecutiveTrainingDays >= 3) push('consecutive-watch', 'Тренировки подряд', `${potentialConsecutiveTrainingDays} дня подряд — лучше не разгонять до отказа`, 1);

    if (daysWithoutFullRest >= 6) push('no-full-rest-critical', 'Долго без полного отдыха', `${daysWithoutFullRest} дней подряд была активность`, 2);
    else if (daysWithoutFullRest >= 4 && fullRestDays7 <= 1) push('no-full-rest-watch', 'Мало полного отдыха', `${daysWithoutFullRest} дня без пустого дня в календаре`, 1);

    if (trainingDays7 >= 5 && fullRestDays7 <= 1) push('dense-week', 'Плотная неделя', `${trainingDays7} тренировочных дней за 7 дней и мало полного отдыха`, 2);
    if (throughDayPattern) push('through-day-ok', 'Тренировки через отдых', `${trainingDays7} тренировки за неделю, но между ними были дни восстановления`, -2);

    const completed = completedWorkoutList(state.workouts);
    const recentHard = completed.slice(0, 4).filter(isHardWorkout).length;
    if (recentHard >= 3) push('hard-recent', 'Много тяжёлых тренировок', `${recentHard} из последних 4 были тяжёлыми или с отказом`, 2);

    const painFrom = startOfDay(new Date(Date.now() - 6 * 86400000));
    const highPain = state.painEntries.filter((entry) => Number(entry.score) >= 7 && new Date(entry.createdAt || `${entry.date}T00:00:00`) >= painFrom).length;
    if (highPain) push('high-pain', 'Была сильная боль', `${highPain} отметк. боли 7/10+ за 7 дней`, 3);

    const muscles = muscleLoadSummary(7);
    const overloaded = muscles.rows.filter((row) => row.status === 'overload');
    const high = muscles.rows.filter((row) => row.status === 'high');
    if (overloaded.length) push('muscle-overload-rest', 'Перегруз мышц', `${overloaded.map((row) => row.label).join(', ')} — перегруз за 7 дней`, 2);
    else if (high.length >= 3) push('muscle-high-rest', 'Много нагрузки по мышцам', `${high.map((row) => row.label).join(', ')} — много подходов`, 1);

    let score = signals.reduce((sum, signal) => sum + signal.weight, 0);
    score = Math.max(0, score);
    const status = score >= 5 ? 'critical' : score >= 3 ? 'recommended' : score >= 1 ? 'watch' : 'ok';
    const shouldRest = status === 'critical' || (status === 'recommended' && (potentialConsecutiveTrainingDays >= 3 || daysWithoutFullRest >= 5 || highPain > 0));
    const gateWorkout = status === 'critical' || status === 'recommended';
    const statusLabel = status === 'critical' ? 'лучше отдых' : status === 'recommended' ? 'отдых просится' : status === 'watch' ? 'наблюдаем' : 'режим норм';
    const title = status === 'critical' ? 'Сегодня лучше восстановиться' : status === 'recommended' ? 'Отдых сильно просится' : status === 'watch' ? 'Есть признаки усталости' : 'Режим восстановления нормальный';
    const modeNote = throughDayPattern && status === 'ok' ? 'Тренировки идут через день — приложение это учитывает и не душнит.' : fullRestDays7 >= 2 ? 'В календаре есть дни отдыха, режим выглядит адекватно.' : 'Сохрани больше тренировок — оценка станет точнее.';
    const homeText = status === 'critical'
      ? 'Календарь и нагрузка намекают: силовую сегодня лучше заменить восстановлением.'
      : status === 'recommended'
        ? 'Не просто “много тренировок”, а сочетание нагрузки, календаря и восстановления. Лучше сделать отдых или лёгкую.'
        : status === 'watch'
          ? 'Есть лёгкие сигналы усталости. Если самочувствие нормальное — можно тренироваться без героизма.'
          : modeNote;
    const detailText = status === 'ok'
      ? `${modeNote} Схема через день считается нормальной, если нет боли и перегруза.`
      : homeText;
    const modalTitle = status === 'critical' ? 'Силовая сегодня не лучший ход' : 'Может, сегодня восстановление?';
    const modalText = `${homeText} Можно записать день восстановления, сделать короткую лёгкую тренировку или продолжить всё равно.`;
    return { days, status, statusLabel, title, homeText, detailText, modalTitle, modalText, shouldRest, gateWorkout, score, signals: signals.filter((signal) => signal.weight > 0), modeNote, trainingDays7, lightDays7, recoveryDays7, fullRestDays7, daysWithoutFullRest, potentialConsecutiveTrainingDays };
  }

  function smartRestSnapshot(analysis) {
    if (!analysis) return null;
    return {
      status: analysis.status,
      statusLabel: analysis.statusLabel,
      title: analysis.title,
      homeText: analysis.homeText,
      score: analysis.score,
      signals: (analysis.signals || []).map((signal) => ({ id: signal.id, title: signal.title, label: signal.label, weight: signal.weight })),
      trainingDays7: analysis.trainingDays7,
      fullRestDays7: analysis.fullRestDays7,
      daysWithoutFullRest: analysis.daysWithoutFullRest,
      potentialConsecutiveTrainingDays: analysis.potentialConsecutiveTrainingDays,
      createdAt: new Date().toISOString(),
    };
  }

  function deloadAnalysis({ days = 14 } = {}) {
    const periodDays = Number(days) || 14;
    const now = new Date();
    const from = startOfDay(new Date(now.getTime() - (periodDays - 1) * 86400000));
    const completed = completedWorkoutList(state.workouts).filter((workout) => new Date(workout.startedAt || workout.date) >= from).sort((a, b) => new Date(b.startedAt || b.date) - new Date(a.startedAt || a.date));
    const signals = [];
    const pushSignal = (id, title, label, weight) => signals.push({ id, title, label, weight });

    if (!completed.length) {
      return { hasData: false, shouldSuggest: false, status: 'ok', statusLabel: 'нет данных', title: 'Разгрузка пока не оценивается', homeText: 'Нужна история тренировок.', detailText: 'Сохрани несколько тренировок, и приложение начнёт отслеживать признаки усталости.', score: 0, signals: [], completedCount: 0, highPainCount: 0, overloadGroups: 0 };
    }

    const recentThree = completed.slice(0, 3);
    const hardWorkouts = recentThree.filter(isHardWorkout).length;
    if (recentThree.length >= 3 && hardWorkouts >= 2) pushSignal('hard-streak', 'Тяжёлая серия', `${hardWorkouts} из последних ${recentThree.length} тренировок были тяжёлыми или с отказом`, 2);

    const lowCompletion = recentThree.filter((workout) => (Number(workout.completionPct ?? workoutCompletion(workout)) < 75) || (workout.exercises || []).filter((result) => result.skipped).length >= 2).length;
    if (recentThree.length >= 2 && lowCompletion >= 2) pushSignal('low-completion', 'Много недовыполнения', `${lowCompletion} последние тренировки с низким выполнением или пропусками`, 2);

    const painFrom = from.getTime();
    const painEntries = (state.painEntries || []).filter((entry) => new Date(entry.date || entry.createdAt || entry.timestamp || 0).getTime() >= painFrom && Number(entry.score) >= 4);
    const highPainCount = painEntries.filter((entry) => Number(entry.score) >= 7).length;
    if (highPainCount) pushSignal('high-pain', 'Сильная боль', `${highPainCount} отметк. 7/10 и выше за ${periodDays} дней`, 3);
    const painAreasCount = painEntries.reduce((map, entry) => map.set(entry.areaLabel || entry.areaId || 'боль', (map.get(entry.areaLabel || entry.areaId || 'боль') || 0) + 1), new Map());
    const repeatedPain = [...painAreasCount.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])[0];
    if (repeatedPain && !highPainCount) pushSignal('repeated-pain', 'Повторяется боль', `${repeatedPain[0]} — ${repeatedPain[1]} раза за ${periodDays} дней`, 2);

    const muscles = muscleLoadSummary(7);
    const overloaded = muscles.rows.filter((row) => row.status === 'overload');
    const high = muscles.rows.filter((row) => row.status === 'high');
    if (overloaded.length) pushSignal('muscle-overload', 'Перегруз мышц', `${overloaded.map((row) => row.label).join(', ')} — перегруз за 7 дней`, 2);
    else if (high.length >= 2) pushSignal('muscle-high', 'Много нагрузки', `${high.map((row) => row.label).join(', ')} — много подходов за 7 дней`, 1);

    const sevenFrom = startOfDay(new Date(now.getTime() - 6 * 86400000));
    const lastSeven = completed.filter((workout) => new Date(workout.startedAt || workout.date) >= sevenFrom);
    const totalSets7 = lastSeven.reduce((sum, workout) => sum + (workout.exercises || []).reduce((s, result) => s + completedSets(result).length, 0), 0);
    if (totalSets7 >= 60) pushSignal('high-volume', 'Высокий объём', `${totalSets7} рабочих подходов за 7 дней`, 1);

    const dropCount = performanceDropCount(completed.slice(0, 8));
    if (dropCount >= 2) pushSignal('performance-drop', 'Падение результатов', `${dropCount} упражнения просели примерно на 10%+`, 2);

    const recordsLast14 = completed.reduce((sum, workout) => sum + (Array.isArray(workout.records) ? workout.records.length : 0), 0);
    if (completed.length >= 4 && recordsLast14 === 0) pushSignal('no-progress', 'Давно без рекордов', 'За последние тренировки нет новых рекордов — возможно, накопилась усталость', 1);

    const score = signals.reduce((sum, signal) => sum + signal.weight, 0);
    const status = score >= 6 ? 'critical' : score >= 3 ? 'recommended' : score >= 1 ? 'watch' : 'ok';
    const shouldSuggest = score >= 3;
    const statusLabel = status === 'critical' ? 'лучше разгрузка' : status === 'recommended' ? 'разгрузка просится' : status === 'watch' ? 'наблюдаем' : 'нормально';
    const title = shouldSuggest ? 'Разгрузочная неделя просится' : status === 'watch' ? 'Есть лёгкие признаки усталости' : 'Разгрузка не нужна';
    const homeText = shouldSuggest ? 'Есть несколько признаков накопленной усталости. Следующую тренировку лучше сделать легче.' : status === 'watch' ? 'Есть мелкие сигналы, но пока без паники. Следи за самочувствием.' : 'Критичных признаков усталости нет. Можно продолжать цикл спокойно.';
    const detailText = shouldSuggest ? 'На ближайшие 5–7 дней приложение советует снизить вес на 15–20%, убрать часть подходов и не идти до отказа.' : homeText;
    return { hasData: true, shouldSuggest, status, statusLabel, title, homeText, detailText, score, signals, completedCount: completed.length, highPainCount, overloadGroups: overloaded.length };
  }

  function isHardWorkout(workout) {
    const sets = (workout.exercises || []).flatMap((result) => completedSets(result));
    if (!sets.length) return false;
    const hard = sets.filter((set) => ['hard', 'failure'].includes(set.difficulty)).length;
    const failure = sets.filter((set) => set.difficulty === 'failure').length;
    return failure >= 2 || hard / sets.length >= 0.45 || Number(workout.completionPct ?? workoutCompletion(workout)) < 70;
  }

  function performanceDropCount(workouts) {
    const byExercise = new Map();
    workouts.forEach((workout) => {
      (workout.exercises || []).forEach((result) => {
        if (result.skipped || isTimeResult(result)) return;
        const best = bestSetScore(result);
        if (best <= 0) return;
        const list = byExercise.get(result.exerciseId) || [];
        list.push({ date: new Date(workout.startedAt || workout.date), score: best, name: result.name });
        byExercise.set(result.exerciseId, list);
      });
    });
    let drops = 0;
    byExercise.forEach((list) => {
      const sorted = list.sort((a, b) => b.date - a.date);
      if (sorted.length < 2) return;
      const latest = sorted[0].score;
      const previousBest = Math.max(...sorted.slice(1).map((item) => item.score));
      if (previousBest > 0 && latest < previousBest * 0.9) drops += 1;
    });
    return drops;
  }

  function bestSetScore(result) {
    return Math.max(0, ...completedSets(result).map((set) => (Number(set.weightKg) || 0) * (Number(set.reps) || 0)));
  }

  function muscleShortAdvice(rows) {
    const overloaded = rows.filter((row) => row.status === 'overload').map((row) => row.label);
    if (overloaded.length) return `Перегруз: ${overloaded.join(', ')}. Лучше не добивать эти зоны сегодня.`;
    const high = rows.filter((row) => row.status === 'high').map((row) => row.label);
    if (high.length) return `Много нагрузки: ${high.join(', ')}. Следи за восстановлением.`;
    const low = rows.filter((row) => row.status === 'low').map((row) => row.label);
    if (low.length) return `Недобор: ${low.join(', ')}. Можно добавить в следующем цикле.`;
    return 'Баланс нормальный.';
  }

  function getMuscleGroupsForExercise(exercise, result = null) {
    const direct = muscleGroupMap[result?.exerciseId || exercise?.id];
    if (direct?.length) return direct;
    const haystack = `${exercise?.group || ''} ${exercise?.name || ''} ${result?.name || ''}`.toLowerCase();
    const groups = new Set();
    if (/груд|жим|отжим|развод|бабоч/.test(haystack)) groups.add('chest');
    if (/спин|тяга|широч|лопат|пуловер|трапец/.test(haystack)) groups.add('back');
    if (/плеч|дельт|шраг/.test(haystack)) groups.add('shoulders');
    if (/бицеп|сгибан/.test(haystack)) groups.add('biceps');
    if (/трицеп|разгибан|узкие/.test(haystack)) groups.add('triceps');
    if (/ног|квадрицеп|икр|бедр|присед|выпад|стульчик/.test(haystack)) groups.add('legs');
    if (/ягод|мост|задняя цепь/.test(haystack)) groups.add('glutes');
    if (/пресс|кор|бок|планк|скруч|живот/.test(haystack)) groups.add('abs');
    return [...groups];
  }

  function muscleThresholds(days) {
    const scale = Math.max(1, Number(days) / 7);
    return {
      minNormal: Math.round(4 * scale),
      maxNormal: Math.round(10 * scale),
      high: Math.round(16 * scale),
      overload: Math.round(17 * scale),
    };
  }

  function muscleStatusForCount(count, days) {
    const thresholds = muscleThresholds(days);
    if (count < thresholds.minNormal) return { status: 'low', label: 'мало', thresholds };
    if (count <= thresholds.maxNormal) return { status: 'normal', label: 'нормально', thresholds };
    if (count < thresholds.overload) return { status: 'high', label: 'много', thresholds };
    return { status: 'overload', label: 'перегруз', thresholds };
  }

  function muscleLoadSummary(days = 7) {
    const periodDays = Number(days) === 14 ? 14 : 7;
    const from = startOfDay(new Date(Date.now() - (periodDays - 1) * 86400000));
    const workouts = completedWorkoutList(state.workouts).filter((workout) => new Date(workout.startedAt || workout.date) >= from);
    const groups = new Map(muscleGroups.map((group) => [group.id, { ...group, sets: 0, sourcesMap: new Map() }]));

    for (const workout of workouts) {
      for (const result of workout.exercises || []) {
        if (result.skipped) continue;
        const done = completedSets(result);
        if (!done.length) continue;
        const exercise = getExercise(result.exerciseId) || { id: result.exerciseId, name: result.name, group: '' };
        const targetGroups = getMuscleGroupsForExercise(exercise, result);
        if (!targetGroups.length) continue;
        for (const groupId of targetGroups) {
          const row = groups.get(groupId);
          if (!row) continue;
          row.sets += done.length;
          const sourceName = result.name || exercise.name || result.exerciseId;
          row.sourcesMap.set(sourceName, (row.sourcesMap.get(sourceName) || 0) + done.length);
        }
      }
    }

    const rows = muscleGroups.map((group) => {
      const raw = groups.get(group.id);
      const status = muscleStatusForCount(raw.sets, periodDays);
      const sources = [...raw.sourcesMap.entries()].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets);
      return {
        ...group,
        shortLabel: group.label.replace('Трицепс', 'Триц.').replace('Бицепс', 'Биц.').replace('Ягодицы', 'Ягод.'),
        sets: raw.sets,
        sources,
        status: status.status,
        statusLabel: status.label,
        thresholds: status.thresholds,
      };
    });
    const warningCount = rows.filter((row) => ['low', 'high', 'overload'].includes(row.status)).length;
    const normalCount = rows.filter((row) => row.status === 'normal').length;
    return {
      days: periodDays,
      from,
      rows,
      completedWorkouts: workouts.length,
      totalSets: rows.reduce((sum, row) => sum + row.sets, 0),
      warningCount,
      normalCount,
    };
  }

  function completedWorkoutList(workouts = state.workouts) {
    return (workouts || []).filter((workout) => isTrainingWorkout(workout));
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

  function workoutsSince(date){return state.workouts.filter((w)=>isTrainingWorkout(w)&&new Date(w.startedAt)>=date);}
  function avgCompletion(workouts){const rows=(workouts||[]).filter((w)=>isTrainingWorkout(w));if(!rows.length)return 0;return rows.reduce((s,w)=>s+(w.completionPct??workoutCompletion(w)),0)/rows.length;}
  function calculateStreak(){const dates=[...new Set(state.workouts.filter((w)=>isTrainingWorkout(w)).map((w)=>localDateISO(new Date(w.startedAt))))].sort().reverse();if(!dates.length)return 0;let streak=0;let cursor=startOfDay(new Date());const latest=new Date(`${dates[0]}T00:00:00`);if((cursor-latest)/86400000>1)return 0;cursor=latest;for(const date of dates){const d=new Date(`${date}T00:00:00`);if(Math.round((cursor-d)/86400000)===0){streak++;cursor=new Date(cursor.getTime()-86400000);}else if(Math.round((cursor-d)/86400000)>0)break;}return streak;}

  function strengthSeries(exerciseId){return state.workouts.slice().reverse().flatMap((w)=>{const r=w.exercises.find((x)=>x.exerciseId===exerciseId);if(!r)return[];const max=Math.max(0,...r.sets.filter((s)=>s.completed).map((s)=>Number(s.weightKg)||0));return max?[{date:localDateISO(new Date(w.startedAt)),value:max}]:[];});}
  function stepperSeries(){return state.workouts.slice().reverse().map((w)=>{let value=0;for(const r of w.exercises){const ex=getExercise(r.exerciseId);if(ex?.equipment==='Степпер')value+=r.sets.filter((s)=>s.completed).reduce((sum,s)=>sum+(Number(s.durationMin)||0),0);}return{date:localDateISO(new Date(w.startedAt)),value};}).filter((x)=>x.value>0);}
  function aggregateWeeks(count){const rows=[];const now=startOfWeek(new Date());for(let i=count-1;i>=0;i--){const start=new Date(now.getTime()-i*7*86400000);const end=new Date(start.getTime()+7*86400000);rows.push({label:`${start.getDate()}.${start.getMonth()+1}`,count:state.workouts.filter((w)=>isTrainingWorkout(w)&&new Date(w.startedAt)>=start&&new Date(w.startedAt)<end).length});}return rows;}

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
    window.setTimeout(() => syncPushAutomationSettings({ silent: true }).catch((error) => console.warn('Push schedule sync after app ready failed', error)), 2200);
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

  function isIOSDevice() {
    return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalonePWA() {
    return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  }

  function getPushDeviceId() {
    let value = localStorage.getItem(PUSH_DEVICE_ID_KEY);
    if (value && /^[A-Za-z0-9_-]{24,160}$/.test(value)) return value;
    const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    value = `device-${random}`;
    localStorage.setItem(PUSH_DEVICE_ID_KEY, value);
    return value;
  }

  function pushApplicationUrl(route = 'more') {
    const url = new URL('./', window.location.href);
    url.hash = `/${route}`;
    return url.href;
  }

  function urlBase64ToUint8Array(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
  }

  async function pushApi(path, options = {}) {
    if (!navigator.onLine) throw new Error('Нет интернета');
    const response = await fetch(`${PUSH_API_URL}${path}`, {
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `Сервер уведомлений ответил ${response.status}`);
    }
    return payload || { ok: true };
  }

  function pushPermissionLabel(value) {
    return ({ granted: 'Разрешены', denied: 'Запрещены', default: 'Не запрошены' })[value] || 'Неизвестно';
  }

  function pushSupportSummary() {
    if (!state.push.supported) return 'Не поддерживаются';
    if (isIOSDevice() && !state.push.standalone) return 'Нужно установить PWA';
    if (state.push.permission === 'denied') return 'Запрещены в iPhone';
    if (state.push.subscribed) return 'Подключены';
    return 'Не подключены';
  }

  function refreshPushPanel() {
    const status = document.getElementById('push-status-text');
    const permission = document.getElementById('push-permission-text');
    const device = document.getElementById('push-device-text');
    const detail = document.getElementById('push-detail-text');
    const shortcut = document.querySelector('#open-push-settings small');
    const enable = document.getElementById('push-enable');
    const test = document.getElementById('push-test');
    const disable = document.getElementById('push-disable');
    const automation = document.getElementById('push-automation-text');

    if (status) status.textContent = pushSupportSummary();
    if (permission) permission.textContent = pushPermissionLabel(state.push.permission);
    if (device) device.textContent = state.push.standalone ? 'PWA на экране Домой' : 'Открыто в браузере';
    if (detail) detail.textContent = state.push.detailText || state.push.statusText;
    if (shortcut) shortcut.textContent = pushSupportSummary();
    if (enable) {
      enable.disabled = state.push.busy || !state.push.supported || state.push.subscribed || state.push.permission === 'denied';
      enable.textContent = state.push.busy ? 'Подождите…' : (state.push.subscribed ? 'Уведомления включены' : 'Включить уведомления');
    }
    if (test) test.disabled = state.push.busy || !state.push.subscribed || state.push.permission !== 'granted';
    if (disable) disable.disabled = state.push.busy || !state.push.subscribed;
    if (automation) automation.textContent = state.push.automationText || 'Автоматические напоминания синхронизируются после включения уведомлений.';
  }

  async function refreshPushState({ verifyServer = false } = {}) {
    state.push.supported = Boolean('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
    state.push.standalone = isStandalonePWA();
    state.push.permission = 'Notification' in window ? Notification.permission : 'default';
    state.push.subscribed = false;

    if (!state.push.supported) {
      state.push.statusText = 'Устройство не поддерживает Web Push';
      state.push.detailText = 'Нужны Service Worker, Push API и системные уведомления.';
      refreshPushPanel();
      return state.push;
    }

    if (isIOSDevice() && !state.push.standalone) {
      state.push.statusText = 'Открой приложение с экрана Домой';
      state.push.detailText = 'На iPhone Web Push работает только у PWA, добавленного на экран Домой.';
      refreshPushPanel();
      return state.push;
    }

    if (state.push.permission === 'denied') {
      state.push.statusText = 'Разрешение запрещено';
      state.push.detailText = 'Открой Настройки iPhone → Уведомления → РЕЖИМ и разреши уведомления.';
      refreshPushPanel();
      return state.push;
    }

    try {
      const registration = state.swRegistration || await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      state.push.subscribed = Boolean(subscription);
      state.push.statusText = subscription ? 'Подписка активна' : 'Можно подключить уведомления';
      state.push.detailText = subscription
        ? 'Телефон подписан. Тестовый пуш можно отправить прямо сейчас.'
        : 'Нажми «Включить уведомления» и подтверди системный запрос iPhone.';

      if (subscription && verifyServer && navigator.onLine) {
        const result = await pushApi(`/api/status?deviceId=${encodeURIComponent(getPushDeviceId())}`, { method: 'GET', headers: {} });
        if (!result.subscribed) {
          await registerPushSubscription(subscription);
          state.push.detailText = 'Подписка телефона восстановлена на сервере.';
        }
        await syncPushAutomationSettings({ silent: true });
      }
    } catch (error) {
      console.warn('Push state check failed', error);
      state.push.statusText = 'Не удалось проверить подписку';
      state.push.detailText = error.message || String(error);
    }

    state.push.lastCheckedAt = new Date().toISOString();
    refreshPushPanel();
    return state.push;
  }

  async function registerPushSubscription(subscription) {
    return pushApi('/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: getPushDeviceId(),
        subscription: subscription.toJSON ? subscription.toJSON() : subscription,
        timezone: PUSH_TIMEZONE,
        locale: navigator.language || 'ru-RU',
        appUrl: pushApplicationUrl(),
        settings: buildPushAutomationSettings(),
      }),
    });
  }

  function tomorrowISOFromLocal(date = new Date()) {
    const tomorrow = localDateStart(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return localDateISO(tomorrow);
  }

  function workoutReminderPlan() {
    const scheduled = nextScheduledWorkoutForReminder();
    if (scheduled) {
      return {
        enabled: true,
        nextLocalDate: scheduled.scheduledDate,
        timeMinutes: scheduledWorkoutTimeMinutes(scheduled),
        note: `запланирована «${scheduled.customDay?.name || 'Своя тренировка'}»`,
        scheduledWorkout: scheduled,
      };
    }

    const today = todayISO();
    const completedToday = completedWorkoutList(state.workouts).some((workout) => String(workout.date || workout.startedAt || '').slice(0, 10) === today);
    const inProgressToday = state.currentWorkout?.status === 'in_progress' && String(state.currentWorkout.date || state.currentWorkout.startedAt || '').slice(0, 10) === today;
    if (completedToday || inProgressToday) {
      return {
        enabled: true,
        nextLocalDate: tomorrowISOFromLocal(),
        timeMinutes: PUSH_AUTOMATION_DEFAULTS.workoutTimeMinutes,
        note: 'сегодня уже была тренировка',
      };
    }

    const status = trainingScheduleStatus();
    if (status.mode === 'every_other_day' && !status.due && status.nextDate) {
      return {
        enabled: true,
        nextLocalDate: localDateISO(status.nextDate),
        timeMinutes: PUSH_AUTOMATION_DEFAULTS.workoutTimeMinutes,
        note: 'по графику через день',
      };
    }
    return {
      enabled: true,
      nextLocalDate: today,
      timeMinutes: PUSH_AUTOMATION_DEFAULTS.workoutTimeMinutes,
      note: 'можно продолжать цикл',
    };
  }

  function buildPushAutomationSettings() {
    const workoutPlan = workoutReminderPlan();
    return {
      ...PUSH_AUTOMATION_DEFAULTS,
      timezone: PUSH_TIMEZONE,
      workoutEnabled: workoutPlan.enabled,
      workoutTimeMinutes: workoutPlan.timeMinutes,
      workoutNextLocalDate: workoutPlan.nextLocalDate,
    };
  }

  function pushAutomationSummaryText() {
    const plan = workoutReminderPlan();
    const workoutTime = `${String(Math.floor(plan.timeMinutes / 60)).padStart(2, '0')}:${String(plan.timeMinutes % 60).padStart(2, '0')}`;
    return `Авто: вода 09:00–22:00 каждые 75 мин, вес каждый день 08:00, тренировка ${workoutTime} (${plan.note}), обновления включены.`;
  }

  async function syncPushAutomationSettings({ silent = true } = {}) {
    if (!state.push.subscribed || state.push.permission !== 'granted' || !navigator.onLine) return null;
    try {
      const result = await pushApi('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: getPushDeviceId(),
          settings: buildPushAutomationSettings(),
        }),
      });
      state.push.automationSyncedAt = new Date().toISOString();
      state.push.automationText = pushAutomationSummaryText();
      refreshPushPanel();
      if (!silent) toast('Расписание уведомлений обновлено');
      return result;
    } catch (error) {
      console.warn('Push automation sync failed', error);
      state.push.automationText = `Автоматические напоминания не синхронизированы: ${error.message}`;
      refreshPushPanel();
      if (!silent) toast(`Не удалось обновить расписание: ${error.message}`);
      return null;
    }
  }

  async function enablePushNotifications() {
    if (state.push.busy) return;
    state.push.supported = Boolean('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
    state.push.standalone = isStandalonePWA();
    state.push.permission = 'Notification' in window ? Notification.permission : 'default';
    if (!state.push.supported) return toast('Уведомления не поддерживаются на этом устройстве');
    if (isIOSDevice() && !state.push.standalone) {
      toast('Сначала добавь приложение на экран Домой');
      openMoreGroup('more-group-app', '.install-subsection');
      return;
    }
    if (Notification.permission === 'denied') {
      toast('Уведомления запрещены в настройках iPhone');
      return;
    }

    const permissionPromise = Notification.permission === 'granted'
      ? Promise.resolve('granted')
      : Notification.requestPermission();
    state.push.busy = true;
    state.push.detailText = 'Запрашиваю разрешение…';
    refreshPushPanel();
    try {
      const permission = await permissionPromise;
      state.push.permission = permission;
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Уведомления запрещены' : 'Разрешение не получено');

      const registration = state.swRegistration || await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY),
        });
      }
      await registerPushSubscription(subscription);
      state.push.subscribed = true;
      state.push.statusText = 'Уведомления подключены';
      state.push.detailText = 'Готово. Автоматические напоминания синхронизируются с Cloudflare.';
      state.push.automationText = pushAutomationSummaryText();
      await syncPushAutomationSettings({ silent: true });
      toast('Уведомления подключены');
    } catch (error) {
      console.warn('Push subscribe failed', error);
      state.push.statusText = 'Не удалось подключить';
      state.push.detailText = error.message || String(error);
      toast(`Не удалось подключить: ${error.message}`);
    } finally {
      state.push.busy = false;
      refreshPushPanel();
    }
  }

  async function sendTestPush() {
    if (state.push.busy) return;
    state.push.busy = true;
    state.push.detailText = 'Отправляю тестовый пуш…';
    refreshPushPanel();
    try {
      await pushApi('/api/test', {
        method: 'POST',
        body: JSON.stringify({ deviceId: getPushDeviceId(), requestId: `test-${Date.now()}` }),
      });
      state.push.detailText = 'Пуш отправлен. Заблокируй экран или сверни приложение — уведомление должно появиться системно.';
      toast('Тестовый пуш отправлен');
    } catch (error) {
      console.warn('Test push failed', error);
      state.push.detailText = error.message || String(error);
      toast(`Пуш не отправился: ${error.message}`);
    } finally {
      state.push.busy = false;
      refreshPushPanel();
    }
  }

  async function disablePushNotifications() {
    if (state.push.busy) return;
    const confirmed = window.confirm('Отключить уведомления на этом iPhone? Настройки тренировок и данные приложения не изменятся.');
    if (!confirmed) return;
    state.push.busy = true;
    state.push.detailText = 'Отключаю подписку…';
    refreshPushPanel();
    try {
      const registration = state.swRegistration || await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      if (navigator.onLine) {
        await pushApi('/api/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ deviceId: getPushDeviceId() }),
        }).catch((error) => console.warn('Server unsubscribe failed', error));
      }
      localStorage.removeItem(PUSH_DEVICE_ID_KEY);
      state.push.subscribed = false;
      state.push.statusText = 'Уведомления отключены';
      state.push.detailText = 'Подписка удалена с телефона и сервера.';
      state.push.automationText = 'Автоматические напоминания отключены на этом iPhone.';
      toast('Уведомления отключены');
    } catch (error) {
      console.warn('Push unsubscribe failed', error);
      state.push.detailText = error.message || String(error);
      toast(`Не удалось отключить: ${error.message}`);
    } finally {
      state.push.busy = false;
      refreshPushPanel();
    }
  }

  async function registerServiceWorker(){
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${encodeURIComponent(APP_VERSION)}`);
      state.swRegistration = registration;
      refreshPushState({ verifyServer: true }).catch((error) => console.warn('Initial push check failed', error));

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
      await flushProgramBuilderDraftSave();
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
