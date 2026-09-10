// Explicit ingredient-source labels and migration for existing saved planner data.
// This keeps fresh tomatoes, canned diced tomatoes, passata and tomato paste unmistakable.

const INGREDIENT_LABEL_OVERRIDES = {
  tomatoes: 'Fresh tomatoes (whole produce)',
  diced_tomatoes: 'Canned diced tomatoes (400 g cans)',
  passata: 'Passata (bottled tomato purée)',
  tomato_paste: 'Tomato paste (concentrated)'
};

// New/reset planner states inherit the clearer labels.
SEED_INVENTORY.forEach(i => {
  if (INGREDIENT_LABEL_OVERRIDES[i.id]) i.name = INGREDIENT_LABEL_OVERRIDES[i.id];
});

function syncIngredientDisplayLabels() {
  if (!state?.inventory) return;
  state.inventory.forEach(i => {
    if (INGREDIENT_LABEL_OVERRIDES[i.id]) i.name = INGREDIENT_LABEL_OVERRIDES[i.id];
  });
}

// Existing IndexedDB states keep quantities/history but receive the clearer names.
const baseLoadForLabels = load;
load = async function () {
  await baseLoadForLabels();
  syncIngredientDisplayLabels();
  await dbPut('appState', state);
};

function ingredientSourceBadge(id) {
  if (id === 'tomatoes') return '<span class="badge good">FRESH WHOLE TOMATO</span>';
  if (id === 'diced_tomatoes') return '<span class="badge warn">CANNED DICED TOMATO</span>';
  if (id === 'passata') return '<span class="badge">BOTTLED PASSATA</span>';
  if (id === 'tomato_paste') return '<span class="badge">TOMATO PASTE</span>';
  return '';
}

// Replace the recipe ingredient renderer so the source is visible at a glance.
ingredientListHtml = function (m) {
  const req = effectiveMealIngredients(m);
  return Object.entries(req).map(([id, q]) => {
    const i = inv(id);
    const badge = ingredientSourceBadge(id);
    return `<li><strong>${fmt(q, i.unit)}</strong> — ${i.name}${badge ? ` <span style="margin-left:6px">${badge}</span>` : ''}</li>`;
  }).join('');
};

// Make cooking instructions explicit as well, without changing quantities or recipes.
MEALS.forEach(m => {
  const usesFresh = Object.prototype.hasOwnProperty.call(m.ingredients, 'tomatoes');
  const usesCanned = Object.prototype.hasOwnProperty.call(m.ingredients, 'diced_tomatoes');
  m.steps.forEach(s => {
    if (usesFresh) {
      s.text = s.text
        .replace(/100 g tomato\b/g, '100 g fresh tomato')
        .replace(/diced tomato\b/g, 'diced fresh tomato')
        .replace(/lettuce, tomato and cucumber/g, 'lettuce, fresh tomato and cucumber')
        .replace(/lettuce\/tomato\/cucumber/g, 'lettuce/fresh tomato/cucumber')
        .replace(/lettuce and tomato/g, 'lettuce and fresh tomato');
    }
    if (usesCanned) {
      s.text = s.text.replace(/\bdiced tomatoes\b/g, 'canned diced tomatoes');
    }
  });
});
