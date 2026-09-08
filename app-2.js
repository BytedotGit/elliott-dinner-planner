function renderToday(){
  const el=document.getElementById('view-today');
  const ranked=rankedMeals(), best=ranked[0];
  const completed=state.history.length;
  const spent=state.history.reduce((s,h)=>s+(h.estimatedCost||0),0);
  const saved=Math.max(0,completed*(state.settings.takeawayComparison||55)-spent);
  const urgent=state.inventory.filter(i=>i.remaining>0&&daysLeft(i)!==999).sort((a,b)=>daysLeft(a)-daysLeft(b)).slice(0,5);
  let bestHtml=best?`
    <div class="card">
      <div class="eyebrow">BEST CHOICE TONIGHT</div>
      <h2>${best.title}</h2>
      <div class="actions"><span class="badge">${best.minutes} min</span><span class="badge">${best.effort}</span><span class="badge">${money(estimatedMealCost(best))} est.</span></div>
      <div class="why">${whyMeal(best)}</div>
      <div class="thaw"><strong>Protein:</strong> ${thawText(best)}</div>
      <div class="actions">
        <button class="btn good" onclick="openRecipe('${best.id}')">Cook this</button>
        <button class="btn secondary" onclick="route('meals')">Pick something else</button>
      </div>
    </div>`:`<div class="card success"><strong>Fortnight complete.</strong><br>You have no remaining planned dinners.</div>`;
  el.innerHTML=`
    <div class="hero"><div class="eyebrow">DYNAMIC PLAN</div><h2>What should I eat tonight?</h2><p class="muted">Ranked from your remaining stock, produce freshness and protein storage state.</p></div>
    <div class="progress"><div style="width:${(completed/MEALS.length)*100}%"></div></div>
    <div class="stats">
      <div class="stat"><strong>${MEALS.length-completed}</strong><span>meals left</span></div>
      <div class="stat"><strong>${money(spent)}</strong><span>food cooked</span></div>
      <div class="stat"><strong>${money(saved)}</strong><span>vs ${state.settings.takeawayComparison} takeaway</span></div>
    </div>
    ${bestHtml}
    <div class="card"><h3>Freshness watch</h3>${urgent.map(i=>`<div class="list-row"><div class="list-row-main"><strong>${i.name}</strong><div class="sub">${daysLeft(i)<=0?'Past target window':Math.ceil(daysLeft(i))+' day(s) of best-quality window left'} · ${fmt(i.remaining,i.unit)} remaining</div></div>${urgencyBadge(i)}</div>`).join('')||'<p class="muted">No fragile ingredients remaining.</p>'}</div>
    <div class="card"><h3>Tonight → tomorrow</h3><p class="muted">${ranked[1]?thawText(ranked[1]):'No next meal to prepare.'}</p><div class="actions"><button class="btn secondary" onclick="route('freezer')">Manage freezer</button><button class="btn secondary" onclick="route('shopping')">Next shop</button></div></div>
  `;
}

function renderMeals(){
  const el=document.getElementById('view-meals');
  let arr=rankedMeals();
  if(mealFilter==='fast')arr=arr.filter(m=>m.minutes<=30);
  if(mealFilter==='easy')arr=arr.filter(m=>['Very easy','Easy'].includes(m.effort));
  if(mealFilter==='beef')arr=arr.filter(m=>m.protein==='beef_mince');
  if(mealFilter==='chicken')arr=arr.filter(m=>m.protein.includes('chicken'));
  el.innerHTML=`
    <div class="hero"><div class="eyebrow">REMAINING DINNERS</div><h2>Choose what you feel like.</h2><p class="muted">The order automatically updates after every meal, skip, discard or inventory adjustment.</p></div>
    <input class="search" id="mealSearch" placeholder="Search meals…">
    <div class="filter-row">${[['all','Freshness order'],['fast','≤30 min'],['easy','Easy'],['beef','Beef'],['chicken','Chicken']].map(([k,l])=>`<button class="filter ${mealFilter===k?'active':''}" onclick="setMealFilter('${k}')">${l}</button>`).join('')}</div>
    <div id="mealList">${arr.map(mealCard).join('')||'<div class="card"><p class="muted">No meals match that filter.</p></div>'}</div>
  `;
  document.getElementById('mealSearch').addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('#mealList .meal-card').forEach(c=>c.style.display=c.dataset.search.includes(q)?'block':'none');
  });
}
function mealCard(m){
  return `<article class="meal-card" data-search="${(m.title+' '+m.effort).toLowerCase()}">
    <div class="meal-top"><div><div class="eyebrow">${m.effort.toUpperCase()}</div><h3>${m.title}</h3></div><div class="score">priority ${m.score.toFixed(1)}</div></div>
    <div><span class="badge">${m.minutes} min</span> <span class="badge">${money(estimatedMealCost(m))} est.</span></div>
    <div class="why">${whyMeal(m)}</div>
    <div class="thaw">${thawText(m)}</div>
    <div class="actions"><button class="btn" onclick="openRecipe('${m.id}')">Open recipe</button><button class="btn secondary" onclick="skipMeal('${m.id}')">Not tonight</button></div>
  </article>`;
}

function renderInventory(){
  const el=document.getElementById('view-inventory');
  const cats=['protein','produce','dairy','bread','pantry','frozen'];
  el.innerHTML=`<div class="hero"><div class="eyebrow">SOURCE OF TRUTH</div><h2>What you actually have.</h2><p class="muted">Recipes can never consume more than this inventory. Tap an item to correct the delivered quantity, price or storage.</p></div>
    <div class="warning"><strong>Check the variable-weight packs.</strong> Chicken starts at 1.38 kg and beef at 1.90 kg as estimates. Update them from the labels and chicken portions recalculate automatically.</div>
    ${cats.map(cat=>`<div class="card flush"><div class="list-row"><strong>${cat[0].toUpperCase()+cat.slice(1)}</strong></div>${state.inventory.filter(i=>i.category===cat).map(inventoryRow).join('')}</div>`).join('')}
  `;
}
function inventoryRow(i){
  const pct=Math.max(0,Math.min(100,i.remaining/Math.max(1,i.startQty)*100));
  return `<div class="list-row" onclick="editInventory('${i.id}')"><div class="list-row-main"><strong>${i.name}</strong><div class="sub">${fmt(i.remaining,i.unit)} left of ${fmt(i.startQty,i.unit)} · ${money(i.cost)} paid/est.</div><div class="bar"><div style="width:${pct}%"></div></div></div><div>${urgencyBadge(i)}</div></div>`;
}

function renderFreezer(){
  const el=document.getElementById('view-freezer');
  normalizeDynamicPortions();
  const groups=['fridge','freezer','used'];
  el.innerHTML=`<div class="hero"><div class="eyebrow">PROTEIN PORTIONS</div><h2>Freezer → fridge workflow.</h2><p class="muted">Moving a portion here changes tonight's recommendations. Thaw raw meat in the fridge, not on the bench.</p></div>
    ${groups.map(g=>`<div class="card flush"><div class="list-row"><strong>${g==='used'?'Used':g[0].toUpperCase()+g.slice(1)}</strong></div>${state.portions.filter(p=>(p.used?'used':p.location)===g).map(portionRow).join('')||'<div class="list-row"><span class="muted">None</span></div>'}</div>`).join('')}
    <div class="card"><h3>Recommended night-before move</h3><p>${rankedMeals()[1]?thawText(rankedMeals()[1]):rankedMeals()[0]?thawText(rankedMeals()[0]):'Nothing to move.'}</p></div>`;
}
