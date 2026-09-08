function renderSettings(){
  const el=document.getElementById('view-settings');
  el.innerHTML=`<div class="hero"><div class="eyebrow">SETTINGS & DATA</div><h2>Planner controls.</h2></div>
    <div class="card">
      <div class="form-group"><label>Actual total grocery spend ($)</label><input id="basketSpend" type="number" step="0.01" value="${state.settings.basketSpend||''}" placeholder="e.g. 142.60"></div>
      <div class="form-group"><label>Typical takeaway dinner comparison ($)</label><input id="takeaway" type="number" step="1" value="${state.settings.takeawayComparison||55}"></div>
      <button class="btn full" onclick="saveSettings()">Save settings</button>
    </div>
    <div class="card"><h3>Backup / transfer</h3><p class="muted">IndexedDB remembers on this browser and installed PWA. Export a JSON backup before clearing Safari data or moving to another device.</p><div class="actions"><button class="btn secondary" onclick="downloadBackup()">Export backup</button><label class="btn secondary" style="text-align:center">Import backup<input id="backupInput" type="file" accept=".json" hidden onchange="importBackup(event)"></label></div></div>
    <div class="card"><h3>Cycle</h3><div class="form-group"><label>Fortnight start date</label><input id="cycleStart" type="date" value="${state.cycleStart}"></div><button class="btn secondary full" onclick="updateCycleDate()">Update freshness clock</button></div>
    <div class="card"><h3>Reset</h3><p class="muted">Returns to the original grocery inventory and clears cooked history.</p><button class="btn danger full" onclick="resetAll()">Reset entire planner</button></div>`;
}

function renderCurrent(){
  normalizeDynamicPortions();
  renderToday();renderMeals();renderInventory();renderFreezer();renderHistory();renderShopping();renderSettings();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+currentRoute).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.route===currentRoute));
}

function route(r){currentRoute=r;renderCurrent();window.scrollTo({top:0,behavior:'smooth'});}
function setMealFilter(f){mealFilter=f;renderMeals();}
async function skipMeal(id){state.skipped[id]=(state.skipped[id]||0)+1;await save();toast('Re-ranked for tonight');}

function ingredientListHtml(m){
  const req=effectiveMealIngredients(m);
  return Object.entries(req).map(([id,q])=>{const i=inv(id);return `<li><strong>${fmt(q,i.unit)}</strong> — ${i.name}</li>`}).join('');
}
function openRecipe(id){
  const m=meal(id), dlg=document.getElementById('recipeDialog');
  dlg.innerHTML=`<div class="sheet-head"><div><div class="eyebrow">${m.minutes} MIN · ${m.effort.toUpperCase()}</div><h2>${m.title}</h2></div><button class="close" onclick="this.closest('dialog').close()">×</button></div>
  <div class="sheet-body">
    <div class="why">${whyMeal(m)}</div><div class="thaw">${thawText(m)}</div>
    <h3>Required from your shop</h3><ul class="ingredients">${ingredientListHtml(m)}</ul>
    <div class="optional"><strong>Optional — only if already in your kitchen:</strong><br>${m.optional.join(' · ')}</div>
    <h3>Method</h3>${m.steps.map((s,i)=>`<div class="step"><div class="step-num">STEP ${i+1}</div><p>${s.text}</p></div>`).join('')}
    <div class="actions"><button class="btn good" onclick="startCook('${m.id}')">Start Cook Mode</button><button class="btn secondary" onclick="completeMeal('${m.id}')">Mark cooked without Cook Mode</button></div>
  </div>`;
  dlg.showModal();
}

async function startCook(id){
  document.getElementById('recipeDialog').close();
  cook.mealId=id;cook.step=0;cook.timer=null;cook.timerEnd=null;
  try{if('wakeLock'in navigator)cook.wakeLock=await navigator.wakeLock.request('screen');}catch(e){}
  renderCook();document.getElementById('cookDialog').showModal();
}
function renderCook(){
  const m=meal(cook.mealId), s=m.steps[cook.step], dlg=document.getElementById('cookDialog');
  dlg.innerHTML=`<div class="sheet-head"><div><div class="eyebrow">COOK MODE · ${cook.step+1} / ${m.steps.length}</div><h2>${m.title}</h2></div><button class="close" onclick="closeCook()">×</button></div>
  <div class="sheet-body step-current"><div class="step-num">STEP ${cook.step+1}</div><p style="font-size:1.35rem">${s.text}</p>
    ${s.timerMin?`<button class="btn warn" onclick="startTimer(${s.timerMin})">Start ${s.timerMin} min timer</button><div id="timerDisplay" class="timer"></div>`:''}
  </div>
  <div class="cook-nav"><button class="btn secondary" onclick="cookPrev()" ${cook.step===0?'disabled':''}>← Back</button><button class="btn good" onclick="${cook.step===m.steps.length-1?`finishCook('${m.id}')`:'cookNext()'}">${cook.step===m.steps.length-1?'Finish & log meal':'Next →'}</button></div>`;
}
function cookPrev(){if(cook.step>0){cook.step--;clearCookTimer();renderCook();}}
function cookNext(){const m=meal(cook.mealId);if(cook.step<m.steps.length-1){cook.step++;clearCookTimer();renderCook();}}
function startTimer(min){
  clearCookTimer();cook.timerEnd=Date.now()+min*60000;
  const tick=()=>{const left=Math.max(0,cook.timerEnd-Date.now()), sec=Math.ceil(left/1000), mm=Math.floor(sec/60), ss=sec%60;const e=document.getElementById('timerDisplay');if(e){e.classList.add('running');e.textContent=`${mm}:${String(ss).padStart(2,'0')}`;}if(left<=0){clearCookTimer();toast('Timer finished');try{navigator.vibrate?.([250,150,250]);}catch(e){}}};
  tick();cook.timer=setInterval(tick,500);
}
function clearCookTimer(){if(cook.timer)clearInterval(cook.timer);cook.timer=null;cook.timerEnd=null;}
async function closeCook(){clearCookTimer();try{await cook.wakeLock?.release();}catch(e){}document.getElementById('cookDialog').close();}
async function finishCook(id){await closeCook();await completeMeal(id);}

function openRating(id){
  const h=state.history.find(x=>x.mealId===id), m=meal(id), dlg=document.getElementById('editDialog');
  const chosen=new Set(h.feedback||[]);
  const opts=['Loved it','Too much food','Too little food','Too bland','Too spicy','Too much effort','Would cook again'];
  dlg.innerHTML=`<div class="sheet-head"><div><div class="eyebrow">MEAL FEEDBACK</div><h2>${m.title}</h2></div><button class="close" onclick="this.closest('dialog').close()">×</button></div><div class="sheet-body">
    <div class="form-group"><label>Rating</label><div class="stars">${[1,2,3,4,5].map(n=>`<button class="star ${(h.rating||0)>=n?'on':''}" onclick="setRating('${id}',${n})">★</button>`).join('')}</div></div>
    <div class="form-group"><label>Quick feedback</label><div class="pill-toggle">${opts.map(o=>`<button class="${chosen.has(o)?'on':''}" onclick="toggleFeedback('${id}','${o.replaceAll("'","\\'")}',this)">${o}</button>`).join('')}</div></div>
    <button class="btn good full" onclick="document.getElementById('editDialog').close();renderCurrent()">Done</button>
  </div>`;
  dlg.showModal();
}
