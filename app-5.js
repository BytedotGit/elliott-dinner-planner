async function setRating(id,n){const h=state.history.find(x=>x.mealId===id);h.rating=n;await dbPut('appState',state);openRatingRefresh(id);}
function openRatingRefresh(id){document.getElementById('editDialog').close();openRating(id);}
async function toggleFeedback(id,t,btn){const h=state.history.find(x=>x.mealId===id);h.feedback=h.feedback||[];h.feedback=h.feedback.includes(t)?h.feedback.filter(x=>x!==t):[...h.feedback,t];await dbPut('appState',state);btn.classList.toggle('on');}
function rateMeal(id){openRating(id);}

async function completeMeal(id){
  const m=meal(id);if(isDone(id))return;
  if(!canCook(m)){toast('Inventory says an ingredient is short');return;}
  const req=effectiveMealIngredients(m);
  for(const [iid,q] of Object.entries(req)){
    const i=inv(iid);i.remaining=Math.max(0,i.remaining-q);
    if(['sour_cream','passata','tomato_paste','coconut_milk','lettuce'].includes(iid)&&!i.openedAt)i.openedAt=isoDate();
  }
  const p=getAvailablePortionForMeal(m);if(p)p.used=true;
  state.history.push({mealId:id,completedAt:new Date().toISOString(),estimatedCost:estimatedMealCost(m),rating:null,feedback:[]});
  await save();toast('Meal logged & stock deducted');setTimeout(()=>openRating(id),350);
}
async function undoMeal(id){
  const idx=state.history.findIndex(h=>h.mealId===id);if(idx<0)return;
  const m=meal(id), req=effectiveMealIngredients(m);
  for(const [iid,q] of Object.entries(req)){const i=inv(iid);i.remaining=Math.min(i.startQty,i.remaining+q);}
  const used=state.portions.find(p=>p.ingredient===m.protein&&p.used);if(used)used.used=false;
  state.history.splice(idx,1);await save();toast('Meal restored');
}
async function movePortion(id,loc){const p=state.portions.find(x=>x.id===id);p.location=loc;p.movedAt=new Date().toISOString();await save();toast(loc==='fridge'?'Moved to fridge':'Moved to freezer');}
async function unusePortion(id){const p=state.portions.find(x=>x.id===id);p.used=false;await save();}

function editInventory(id){
  const i=inv(id), dlg=document.getElementById('editDialog');
  dlg.innerHTML=`<div class="sheet-head"><div><div class="eyebrow">INVENTORY</div><h2>${i.name}</h2></div><button class="close" onclick="this.closest('dialog').close()">×</button></div><div class="sheet-body">
    <div class="form-row"><div class="form-group"><label>Starting quantity (${i.unit})</label><input id="editStart" type="number" step="0.01" value="${i.startQty}"></div><div class="form-group"><label>Remaining (${i.unit})</label><input id="editRemain" type="number" step="0.01" value="${i.remaining}"></div></div>
    <div class="form-row"><div class="form-group"><label>Paid / estimated cost ($)</label><input id="editCost" type="number" step="0.01" value="${i.cost||0}"></div><div class="form-group"><label>Storage</label><select id="editStorage">${['fridge','freezer','pantry','cool_dark'].map(s=>`<option value="${s}" ${i.storage===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}</select></div></div>
    <div class="form-group"><label>Discard / waste amount now (${i.unit})</label><input id="discardNow" type="number" step="0.01" value="0"></div>
    <p class="muted">${i.note||''}</p>
    <div class="actions"><button class="btn good" onclick="saveInventory('${id}')">Save</button><button class="btn danger" onclick="discardInventory('${id}')">Record waste</button></div>
  </div>`;
  dlg.showModal();
}
async function saveInventory(id){
  const i=inv(id), oldStart=i.startQty;
  i.startQty=Number(document.getElementById('editStart').value);i.remaining=Number(document.getElementById('editRemain').value);i.cost=Number(document.getElementById('editCost').value);i.storage=document.getElementById('editStorage').value;
  if(id==='chicken_breast'||id==='beef_mince')normalizeDynamicPortions();
  document.getElementById('editDialog').close();await save();toast('Inventory updated');
}
async function discardInventory(id){
  const i=inv(id), n=Math.max(0,Number(document.getElementById('discardNow').value)||0);if(!n)return;
  i.remaining=Math.max(0,i.remaining-n);i.discarded=(i.discarded||0)+n;document.getElementById('editDialog').close();await save();toast('Waste recorded');
}
async function saveSettings(){state.settings.basketSpend=Number(document.getElementById('basketSpend').value)||0;state.settings.takeawayComparison=Number(document.getElementById('takeaway').value)||55;await save();toast('Settings saved');}
async function updateCycleDate(){state.cycleStart=document.getElementById('cycleStart').value||isoDate();state.inventory.forEach(i=>i.purchasedAt=state.cycleStart);await save();toast('Freshness clock updated');}
async function resetAll(){if(!confirm('Reset all inventory, history, ratings and freezer state?'))return;state=freshState();normalizeDynamicPortions();await save();toast('Planner reset');}
function copyShop(){navigator.clipboard?.writeText(document.getElementById('shopText').value).then(()=>toast('Shopping list copied'));}
function downloadBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='elliott-meal-planner-backup.json';a.click();URL.revokeObjectURL(url);
}
async function importBackup(ev){
  const file=ev.target.files?.[0];if(!file)return;
  try{const s=JSON.parse(await file.text());if(s.version!==4)throw new Error('Wrong version');state=s;normalizeDynamicPortions();await save();toast('Backup imported');}catch(e){alert('Could not import this backup.');}
}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1300);}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.getElementById('installBtn').classList.remove('hidden');});
document.getElementById('installBtn').onclick=async()=>{if(!deferredInstall)return;await deferredInstall.prompt();deferredInstall=null;document.getElementById('installBtn').classList.add('hidden');};
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>route(b.dataset.route));
document.querySelector('.app-header h1').onclick=()=>route('settings');

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

(async()=>{await openDB();await load();renderCurrent();})();
