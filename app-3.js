function portionRow(p){
  const item=inv(p.ingredient);
  return `<div class="list-row"><div class="list-row-main"><strong>${p.label}</strong><div class="sub">${fmt(p.qty||0,item.unit)}${p.backup?' · backup':''}</div></div><div class="actions">${p.used?`<button class="btn secondary small" onclick="unusePortion('${p.id}')">Restore</button>`:p.location==='freezer'?`<button class="btn small" onclick="movePortion('${p.id}','fridge')">Move to fridge</button>`:`<button class="btn secondary small" onclick="movePortion('${p.id}','freezer')">Freeze</button>`}</div></div>`;
}

function renderHistory(){
  const el=document.getElementById('view-history');
  const total=state.history.reduce((s,h)=>s+(h.estimatedCost||0),0);
  el.innerHTML=`<div class="hero"><div class="eyebrow">WHAT YOU ACTUALLY COOKED</div><h2>History & ratings.</h2><p class="muted">Your ratings and portion feedback are used when generating the next shop.</p></div>
    <div class="stats"><div class="stat"><strong>${state.history.length}</strong><span>cooked</span></div><div class="stat"><strong>${money(total)}</strong><span>meal cost</span></div><div class="stat"><strong>${state.feedback.length}</strong><span>rated</span></div></div>
    ${state.history.slice().reverse().map(h=>{const m=meal(h.mealId);return `<div class="card"><div class="meal-top"><div><h3>${m?.title||h.mealId}</h3><div class="sub">${new Date(h.completedAt).toLocaleDateString()} · ${money(h.estimatedCost)}</div></div><div>${'★'.repeat(h.rating||0)}${'☆'.repeat(Math.max(0,5-(h.rating||0)))}</div></div><p class="muted">${h.feedback?.join(' · ')||'No feedback yet.'}</p><div class="actions"><button class="btn secondary small" onclick="rateMeal('${h.mealId}')">Rate/edit</button><button class="btn danger small" onclick="undoMeal('${h.mealId}')">Undo meal</button></div></div>`}).join('')||'<div class="card"><p class="muted">Nothing cooked yet.</p></div>'}
    <div class="card"><button class="btn secondary full" onclick="route('shopping')">Generate next fortnight shop</button></div>`;
}

function renderShopping(){
  const el=document.getElementById('view-shopping');
  const text=generateShoppingText();
  const waste=state.inventory.reduce((s,i)=>s+(i.discarded||0),0);
  el.innerHTML=`<div class="hero"><div class="eyebrow">NEXT FORTNIGHT</div><h2>Shopping list generator.</h2><p class="muted">Starts from the quantities this plan actually used, then nudges them using leftovers, waste and your meal feedback.</p></div>
    <div class="card"><h3>DoorDash-friendly draft</h3><textarea id="shopText" class="shopping-text">${text}</textarea><div class="actions"><button class="btn" onclick="copyShop()">Copy list</button><button class="btn secondary" onclick="downloadBackup()">Export app backup</button></div></div>
    <div class="card"><h3>How it adapts</h3><p class="muted">Meals rated poorly are flagged for review rather than automatically duplicated. Ingredient waste reduces the next suggested quantity where practical; running short increases it.</p><div class="sub">Recorded discarded quantity across tracked items: ${Number(waste.toFixed(1))} mixed units (see Inventory for item-level detail).</div></div>`;
}

function generateShoppingText(){
  const map={
    chicken_breast:'Broad Oak Farms RSPCA Approved Chicken Breast Fillets Bulk Pack',
    beef_mince:'Jindurra Station 3 Star Beef Mince Pack approx. 1.9 kg',
    chicken_mince:'Broad Oak Farms RSPCA Approved Chicken Mince 500 g',
    meatballs:'Ready, Set... Cook! Pork & Beef Meatballs 420 g',
    cheese:'Westacre Tasty Cheese Block 1 kg', sour_cream:'Sour Cream 300 g',
    rice:'Jasmine Rice 1 kg', pasta:'Pasta 500 g', wraps:'Bakers Life Large White Wraps 8 Pack',
    buns:'Bakers Life Burger Buns 6 Pack', potatoes:'Washed White Potatoes 2 kg', onions:'Brown Onions 1 kg',
    carrots:'Carrots 1 kg', capsicum:'Red Capsicum', lettuce:'Bagged Iceberg Lettuce',
    tomatoes:'Tomatoes 500 g', cucumber:'Lebanese Cucumber', broccoli:'Broccoli Loose',
    frozen_veg:'Frozen Mixed Vegetables 1 kg', diced_tomatoes:'Diced Tomatoes 400 g',
    passata:'Passata', tomato_paste:'Tomato Paste', coconut_milk:'Oh So Natural Organic Coconut Milk 400 ml',
    panko:'Panko Breadcrumbs 200 g'
  };
  const base={
    chicken_breast:'1 x',beef_mince:'1 x',chicken_mince:'1 x',meatballs:'1 x',cheese:'1 x',sour_cream:'1 x',
    rice:'1 x',pasta:'2 x',wraps:'2 x',buns:'1 x',potatoes:'1 x',onions:'1 x',carrots:'1 x',capsicum:'4 x',
    lettuce:'1 x',tomatoes:'1 x',cucumber:'1 x',broccoli:'2 x',frozen_veg:'1 x',diced_tomatoes:'4 x',
    passata:'1 x',tomato_paste:'1 x',coconut_milk:'2 x',panko:'1 x'
  };
  let lines=[];
  for(const i of state.inventory){
    if(!map[i.id])continue;
    const used=i.startQty-i.remaining-(i.discarded||0);
    const ratio=i.startQty?used/i.startQty:0;
    let note='';
    if(state.history.length>=8 && ratio<0.25) note='  ← consider reducing; lots remained';
    if((i.discarded||0)>i.startQty*0.2) note='  ← consider smaller quantity; some was discarded';
    lines.push(`${base[i.id]} ${map[i.id]}${note}`);
  }
  const lowRated=state.history.filter(h=>(h.rating||5)<=2).map(h=>meal(h.mealId)?.title).filter(Boolean);
  if(lowRated.length)lines.push('\nREVIEW BEFORE REBUYING THESE MEALS:\n- '+lowRated.join('\n- '));
  return lines.join('\n');
}

