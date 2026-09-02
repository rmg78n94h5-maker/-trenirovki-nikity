(() => {
  'use strict';

  const MARK = 'data-exercise-card-v230';
  let scheduled = false;

  const GROUP_LABELS = {
    chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', biceps: 'Бицепс',
    triceps: 'Трицепс', legs: 'Ноги', glutes: 'Ягодицы', abs: 'Пресс',
  };

  function norm(value = '') {
    return String(value).toLowerCase().replace(/ё/g, 'е');
  }

  function inferGroups(text = '') {
    const value = norm(text);
    const groups = [];
    const push = (id) => { if (!groups.includes(id)) groups.push(id); };
    if (/груд|жим|отжим|бабоч|развод|пуловер/.test(value)) push('chest');
    if (/спин|широч|тяга|греб|трапец|шраг|подтяг/.test(value)) push('back');
    if (/плеч|дельт|армейск|мах.*сторон/.test(value)) push('shoulders');
    if (/бицеп|сгибан.*рук|молот/.test(value)) push('biceps');
    if (/трицеп|разгибан.*рук|француз|узк.*жим/.test(value)) push('triceps');
    if (/ног|квадриц|бедр|икр|голен|выпад|присед|степпер|разгибан.*ног|сгибан.*ног/.test(value)) push('legs');
    if (/ягод|мост|хип.*траст/.test(value)) push('glutes');
    if (/пресс|кор|планк|скруч|живот|ролик|подъем.*ног/.test(value)) push('abs');
    return groups.length ? groups : ['back'];
  }

  function inferEquipment(text = '') {
    const value = norm(text);
    if (/гантел/.test(value)) return ['dumbbell', 'Гантели'];
    if (/штанг|гриф/.test(value)) return ['barbell', 'Штанга'];
    if (/тренаж|блок|канат|трос|кроссовер/.test(value)) return ['machine', 'Тренажёр'];
    if (/степпер/.test(value)) return ['stepper', 'Степпер'];
    if (/ролик/.test(value)) return ['roller', 'Ролик'];
    if (/скам|стул/.test(value)) return ['bench', 'Скамья'];
    if (/коврик/.test(value)) return ['mat', 'Коврик'];
    if (/собственн|вес тела|без оборуд/.test(value)) return ['bodyweight', 'Вес тела'];
    return ['generic', 'Оборудование'];
  }

  function equipmentIcon(type) {
    const paths = {
      dumbbell: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
      barbell: '<path d="M2 10v4M5 7v10M19 7v10M22 10v4M5 12h14"/>',
      machine: '<path d="M5 20V5h8M13 5v4M10 9h6M16 9v11M7 15h6M7 15v5"/><circle cx="16" cy="5" r="2"/>',
      stepper: '<path d="M4 19h6v-5h5V9h5"/><path d="m14 5 2-2 2 2M16 3v5"/>',
      roller: '<circle cx="12" cy="13" r="5"/><path d="M3 13h4M17 13h4M12 8V5"/>',
      bench: '<path d="M4 14h13M7 14v6M16 14v6M12 14V8h7M19 8v6"/>',
      mat: '<rect x="4" y="7" width="16" height="10" rx="3"/><path d="M7 10h10M7 14h10"/>',
      bodyweight: '<circle cx="12" cy="5" r="2"/><path d="M12 7v6M8 10l4 3 4-3M12 13l-3 7M12 13l3 7"/>',
      generic: '<circle cx="12" cy="12" r="7"/><path d="M12 8v8M8 12h8"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.generic}</svg>`;
  }

  function muscleMap(groups, compact = false) {
    const active = new Set(groups);
    const zone = (id) => `v230-zone${active.has(id) ? ' is-active' : ''}`;
    return `<svg class="v230-muscle-map${compact ? ' compact' : ''}" viewBox="0 0 120 86" aria-hidden="true">
      <g class="v230-body-base">
        <circle cx="30" cy="10" r="5"/><path d="M24 18Q30 15 36 18L39 42Q35 50 30 50T21 42Z"/><path d="M23 21 15 39 19 41 27 27M37 21l8 18-4 2-8-14"/><path d="M25 48 21 75h5l4-18 4 18h5l-4-27Z"/>
        <circle cx="90" cy="10" r="5"/><path d="M84 18Q90 15 96 18L99 42Q95 50 90 50T81 42Z"/><path d="M83 21 75 39 79 41 87 27M97 21l8 18-4 2-8-14"/><path d="M85 48 81 75h5l4-18 4 18h5l-4-27Z"/>
      </g>
      <g class="v230-body-zones">
        <ellipse class="${zone('shoulders')}" cx="23" cy="23" rx="5" ry="4"/><ellipse class="${zone('shoulders')}" cx="37" cy="23" rx="5" ry="4"/>
        <ellipse class="${zone('chest')}" cx="27" cy="28" rx="5" ry="4"/><ellipse class="${zone('chest')}" cx="33" cy="28" rx="5" ry="4"/>
        <rect class="${zone('abs')}" x="26" y="33" width="8" height="15" rx="4"/>
        <ellipse class="${zone('biceps')}" cx="18" cy="34" rx="3" ry="7"/><ellipse class="${zone('biceps')}" cx="42" cy="34" rx="3" ry="7"/>
        <path class="${zone('legs')}" d="M24 50h6l-3 23h-5ZM30 50h6l2 23h-5Z"/>
        <ellipse class="${zone('shoulders')}" cx="83" cy="23" rx="5" ry="4"/><ellipse class="${zone('shoulders')}" cx="97" cy="23" rx="5" ry="4"/>
        <path class="${zone('back')}" d="M84 24Q90 20 96 24l1 17q-7 7-14 0Z"/>
        <ellipse class="${zone('triceps')}" cx="78" cy="34" rx="3" ry="7"/><ellipse class="${zone('triceps')}" cx="102" cy="34" rx="3" ry="7"/>
        <ellipse class="${zone('glutes')}" cx="87" cy="49" rx="5" ry="4"/><ellipse class="${zone('glutes')}" cx="93" cy="49" rx="5" ry="4"/>
        <path class="${zone('legs')}" d="M84 51h6l-3 22h-5ZM90 51h6l2 22h-5Z"/>
      </g>
      ${compact ? '' : '<g class="v230-map-labels"><text x="30" y="84">ПЕРЕД</text><text x="90" y="84">СПИНА</text></g>'}
    </svg>`;
  }

  function extractInfo(node) {
    const text = node.textContent || '';
    const groups = inferGroups(text);
    const [equipmentType, equipmentLabel] = inferEquipment(text);
    return { groups, equipmentType, equipmentLabel };
  }

  function visual(info, compact = false) {
    const labels = info.groups.map((id) => GROUP_LABELS[id]).filter(Boolean).join(' · ');
    return `<span class="v230-exercise-visual${compact ? ' compact' : ''}">
      <span class="v230-map-wrap">${muscleMap(info.groups, compact)}</span>
      <span class="v230-visual-meta">
        <span class="v230-muscle-label">${labels || 'Целевые мышцы'}</span>
        <span class="v230-equipment"><span class="v230-equipment-icon">${equipmentIcon(info.equipmentType)}</span>${info.equipmentLabel}</span>
      </span>
    </span>`;
  }

  function decoratePicker(node) {
    if (!node || node.hasAttribute(MARK)) return;
    node.setAttribute(MARK, 'picker');
    node.classList.add('v230-exercise-card');
    node.insertAdjacentHTML('afterbegin', visual(extractInfo(node)));
  }

  function decorateReplacement(node) {
    if (!node || node.hasAttribute(MARK)) return;
    node.setAttribute(MARK, 'replacement');
    node.classList.add('v230-replacement-card');
    node.insertAdjacentHTML('afterbegin', visual(extractInfo(node), true));
  }

  function decorateWorkout(article) {
    if (!article || article.hasAttribute(MARK)) return;
    const head = article.querySelector('.sport-workout-exercise-head');
    const meta = head?.querySelector('.exercise-meta');
    if (!head || !meta) return;
    article.setAttribute(MARK, 'workout');
    const info = extractInfo(head);
    meta.insertAdjacentHTML('afterend', `<div class="v230-workout-visual">${visual(info, true)}</div>`);
  }

  function scan() {
    scheduled = false;
    document.querySelectorAll('.custom-library-card, .pick-exercise').forEach(decoratePicker);
    document.querySelectorAll('.choose-smart-replacement, .replacement-best-card.choose-replacement').forEach(decorateReplacement);
    document.querySelectorAll('.sport-workout-exercise').forEach(decorateWorkout);
  }

  function queueScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }

  const observer = new MutationObserver(queueScan);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    queueScan();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
