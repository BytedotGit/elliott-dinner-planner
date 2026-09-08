const DB_NAME = 'elliott-meal-planner-v4';
const DB_VERSION = 1;
const STORE = 'state';

let db;
let deferredInstall = null;
let state = null;
let currentRoute = 'today';
let mealFilter = 'all';
let cook = {mealId:null, step:0, timer:null, timerEnd:null, wakeLock:null};

function clone(x){return JSON.parse(JSON.stringify(x));}
function isoDate(d=new Date()){return d.toISOString().slice(0,10);}
function daysBetween(a,b){return Math.max(0,(new Date(b)-new Date(a))/86400000);}
function fmt(n, unit){
  if(unit==='g' && n>=1000) return (n/1000).toFixed(n%1000?1:0)+' kg';
  if(unit==='ml' && n>=1000) return (n/1000).toFixed(n%1000?1:0)+' L';
  if(unit==='each') return Number(n.toFixed(2))+'';
  return Number(n.toFixed(1))+' '+unit;
}
function money(n){return '$'+Number(n||0).toFixed(2);}
function inv(id){return state.inventory.find(x=>x.id===id);}
function meal(id){return MEALS.find(x=>x.id===id);}
function doneIds(){return state.history.map(h=>h.mealId);}
function isDone(id){return doneIds().includes(id);}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE);};
    req.onsuccess=e=>{db=e.target.result;resolve(db);};
    req.onerror=e=>reject(e.target.error);
  });
}
function dbGet(key){
  return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
function dbPut(key,val){
  return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(val,key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
}
function freshState(){
  const today=isoDate();
  return {
    version:4,
    cycleStart:today,
    inventory:SEED_INVENTORY.map(x=>({...x, startQty:x.qty, remaining:x.qty, openedAt:null, discarded:0, purchasedAt:today})),
    portions:PORTION_TEMPLATES.map(p=>({...p, used:false, movedAt:null})),
    history:[],
    skipped:{},
    settings:{basketSpend:0, takeawayComparison:55, notifications:false},
    feedback:[]
  };
}
async function save(){await dbPut('appState',state);renderCurrent();}
async function load(){
  state=await dbGet('appState');
  if(!state||state.version!==4){state=freshState();await dbPut('appState',state);}
  normalizeDynamicPortions();
}
function normalizeDynamicPortions(){
  const cb=inv('chicken_breast');
  state.portions.filter(p=>p.ingredient==='chicken_breast').forEach(p=>p.qty=cb.startQty/6);
  const beef=inv('beef_mince');
  const backup=state.portions.find(p=>p.id==='bfX');
  if(backup) backup.qty=Math.max(0,beef.startQty-1500);
}

function effectiveMealIngredients(m){
  const req={...m.ingredients};
  if(m.dynamicChicken) req.chicken_breast=inv('chicken_breast').startQty/6;
  return req;
}
function canCook(m){
  const req=effectiveMealIngredients(m);
  return Object.entries(req).every(([id,q])=>inv(id)&&inv(id).remaining+1e-6>=q);
}
function openedAge(item){
  return item.openedAt?daysBetween(item.openedAt,isoDate()):null;
}
function daysLeft(item){
  if(item.storage==='freezer'||item.storage==='pantry'&& !item.openedAt) return 999;
  const age=daysBetween(item.purchasedAt||state.cycleStart,isoDate());
  if(item.openedAt&&item.openedShelfDays) return item.openedShelfDays-openedAge(item);
  return (item.shelfDays||30)-age;
}
function ingredientUrgency(item){
  if(item.remaining<=0)return 0;
  const left=daysLeft(item);
  if(left===999)return 0;
  const base=Math.max(0, Math.min(1.4, (item.fragility||1)/5 * (1 + Math.max(0,4-left)/4)));
  return base;
}
function mealScore(m){
  if(isDone(m.id)||!canCook(m)) return -999;
  const req=effectiveMealIngredients(m);
  let s=0, reasons=[];
  for(const [id,q] of Object.entries(req)){
    const item=inv(id); if(!item)continue;
    const u=ingredientUrgency(item);
    if(u>0) s += u * Math.min(1, q/Math.max(1,item.remaining)) * 10 + u*2;
    if(u>=.75) reasons.push(item.name);
  }
  const p=getAvailablePortionForMeal(m);
  if(p?.location==='fridge') s+=1.8;
  else if(p?.location==='freezer') s-=0.6;
  if(state.skipped[m.id]) s-=Math.min(1.2,state.skipped[m.id]*0.25);
  return s;
}
function rankedMeals(){
  return MEALS.filter(m=>!isDone(m.id)&&canCook(m)).map(m=>({...m,score:mealScore(m)})).sort((a,b)=>b.score-a.score);
}
function whyMeal(m){
  const req=effectiveMealIngredients(m);
  const urgent=Object.keys(req).map(inv).filter(Boolean).filter(i=>ingredientUrgency(i)>=.55).sort((a,b)=>daysLeft(a)-daysLeft(b));
  if(urgent.length) return 'Uses '+urgent.slice(0,3).map(i=>i.name).join(', ')+' while they are relatively fresh.';
  return 'Mostly uses ingredients that keep well, so this meal can safely sit later in the fortnight.';
}
function getAvailablePortionForMeal(m){
  const ing=m.protein;
  if(!ing)return null;
  return state.portions.find(p=>p.ingredient===ing&&!p.used&&p.location==='fridge') ||
         state.portions.find(p=>p.ingredient===ing&&!p.used&&p.location==='freezer') || null;
}
function thawText(m){
  const p=getAvailablePortionForMeal(m);
  if(!p)return 'No separate protein portion required.';
  if(p.location==='fridge') return p.label+' is already in the fridge.';
  return 'Move '+p.label+' from freezer → fridge the night before.';
}
function estimatedMealCost(m){
  const req=effectiveMealIngredients(m);
  let total=0;
  for(const [id,q] of Object.entries(req)){
    const item=inv(id); if(!item||!item.startQty)continue;
    total += (item.cost||0)*(q/item.startQty);
  }
  return total;
}

function urgencyBadge(i){
  const d=daysLeft(i);
  if(d===999)return '<span class="badge good">Long-life</span>';
  if(d<=1)return '<span class="badge urgent">Use now</span>';
  if(d<=3)return '<span class="badge warn">Use soon</span>';
  return '<span class="badge good">Fine</span>';
}

