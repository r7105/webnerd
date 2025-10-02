// Simple stock market game
// Features:
// - Simulate a small market of tickers with random walk + occasional events
// - Buy/sell with cash, track portfolio with average price
// - Auto-tick timer, persistence via localStorage

(function(){
  const DEFAULT_STATE = {
    cash: 10000,
    tick: 0,
    stocks: {}, // symbol -> {price, history:[], volatility}
    portfolio: {}, // symbol -> {qty, avg}
    log: []
  };

  const SYMBOLS = ["WBD","ZEN","ACME","ORCL","TSL","NXT"];

  // Utilities
  const $ = id => document.getElementById(id);
  function money(v){ return Number(v).toFixed(2); }
  function now(){ return new Date().toLocaleTimeString(); }

  // State
  let state = loadState();
  let timer = null;

  // Initialize market if empty
  if(Object.keys(state.stocks).length===0){
    SYMBOLS.forEach(s => {
      state.stocks[s] = { price: (20 + Math.random()*180), history: [], vol: (0.01+Math.random()*0.04) };
    });
    saveState();
  }

  // DOM refs
  const marketEl = $('market');
  const cashEl = $('cash');
  const cashAsideEl = $('cash-aside');
  const portfolioTbody = $('portfolio').querySelector('tbody');
  const netEl = $('networth') || { textContent: '0' };
  const logEl = $('log');
  const chartCanvas = document.getElementById('chartCanvas');
  const chartSymEl = document.getElementById('chartSym');
  const chartPriceEl = document.getElementById('chartPrice');
  const chartChangeEl = document.getElementById('chartChange');
  const chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
  const multiCanvas = document.getElementById('multiChart');
  const multiCtx = multiCanvas ? multiCanvas.getContext('2d') : null;
  const multiHover = document.getElementById('multiHover');

  // color palette for stocks
  const COLORS = ['#38bdf8','#60a5fa','#34d399','#f472b6','#fb923c','#f87171','#a78bfa'];

  // Menu / slots
  const mainMenu = $('mainMenu');
  const slotsContainer = $('slotsContainer');
  const continueBtn = $('continueBtn');
  const newGameBtn = $('newGame');
  const closeMenuBtn = $('closeMenu');
  const openMenuBtn = $('openMenu');
  const shopBtn = $('shopBtn');

  // Shop modal (create lazily)
  let shopModal = null;

  // Controls
  $('tick').addEventListener('click', ()=>{ step(); render(); saveState(); });
  $('autoToggle').addEventListener('click', toggleAuto);
  $('speed').addEventListener('change', ()=>{ if(timer){ toggleAuto(); toggleAuto(); } });
  $('buy').addEventListener('click', buyAction);
  $('sell').addEventListener('click', sellAction);
  $('reset').addEventListener('click', resetGame);

  // populate symbol dropdown
  function populateSymbolDropdown(){
    const sel = document.getElementById('symSelect'); if(!sel) return;
    sel.innerHTML = '';
    Object.keys(state.stocks).forEach(sym => {
      const opt = document.createElement('option'); opt.value = sym; opt.textContent = sym; sel.appendChild(opt);
    });
  }
  populateSymbolDropdown();

  // menu handlers
  openMenuBtn.addEventListener('click', ()=>{ showMenu(true); });
  if(shopBtn) shopBtn.addEventListener('click', ()=>{ openShop(); });
  closeMenuBtn.addEventListener('click', ()=>{ showMenu(false); });
  continueBtn.addEventListener('click', ()=>{ showMenu(false); });
  newGameBtn.addEventListener('click', ()=>{ resetGame(); showMenu(false); });

  // render save slots
  renderSlots();

  // Throttle cookie autosave to once per minute
  let lastCookieSave = Date.now();
  setInterval(()=>{
    if(Date.now() - lastCookieSave >= 60000){
      autoSaveCookies();
      lastCookieSave = Date.now();
    }
  }, 5000);

  function autoSaveCookies(){
    // Save to slot 1 as autosave (or all slots if you want)
    try{
      const snapshot = JSON.stringify(state);
      setCookie(slotKey(1), snapshot, 365);
    }catch(e){}
  }

  // Shop state
  let shopCooldown = 0; // ticks until shop usable
  const SHOP_COST_BASE = 500; // base cost to influence
  const SHOP_COOLDOWN_TICKS = 5;

  // currently selected symbol for single chart
  let currentChartSym = Object.keys(state.stocks)[0] || null;

  render();

  // Functions
  function render(){
    marketEl.innerHTML = '';
    Object.keys(state.stocks).forEach(sym => {
      const s = state.stocks[sym];
      const row = document.createElement('div'); row.className='stock-row';
      row.innerHTML = `<div><strong>${sym}</strong> <span class="small">$${money(s.price)}</span></div>`;
      const actions = document.createElement('div'); actions.className='stock-actions';
  const buy = document.createElement('button'); buy.textContent='Buy'; buy.onclick = (e)=>{ e.stopPropagation(); const sel=document.getElementById('symSelect'); if(sel) sel.value=sym; $('qty').value=1; buyAction(); };
  const sell = document.createElement('button'); sell.textContent='Sell'; sell.onclick = (e)=>{ e.stopPropagation(); const sel=document.getElementById('symSelect'); if(sel) sel.value=sym; $('qty').value=1; sellAction(); };
      actions.appendChild(buy); actions.appendChild(sell);
      row.appendChild(actions);
      marketEl.appendChild(row);
      // clicking the row shows the chart
      row.addEventListener('click', ()=>{ currentChartSym = sym; showChart(sym); });
    });

  cashEl.textContent = money(state.cash);
  if(cashAsideEl) cashAsideEl.textContent = money(state.cash);

    // portfolio
    portfolioTbody.innerHTML='';
    let net = state.cash;
    Object.keys(state.portfolio).forEach(sym => {
      const p = state.portfolio[sym];
      const price = state.stocks[sym]?.price || 0;
      const value = price * p.qty;
      net += value;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${sym}</td><td>${p.qty}</td><td>$${money(p.avg)}</td><td>$${money(value)}</td><td><button data-sym="${sym}">Close</button></td>`;
      tr.querySelector('button').addEventListener('click', ()=>closePosition(sym));
      portfolioTbody.appendChild(tr);
    });
    netEl.textContent = money(net);

    // log
    logEl.innerHTML = '';
    (state.log.slice().reverse()).forEach(l => {
      const d = document.createElement('div'); d.textContent = `[${l.t}] ${l.msg}`; logEl.appendChild(d);
    });

    // shop cooldown display
    if(shopModal){
      const cd = shopModal.querySelector('.shop-cd'); if(cd) cd.textContent = shopCooldown>0? `Cooldown: ${shopCooldown}` : 'Ready';
    }

    // draw live multi-chart and selected single chart
    drawMultiChart(); // draw live multi-chart only
  }

  // Multi-stock chart drawing
  function drawMultiChart(){
    if(!multiCtx) return;
    const w = multiCanvas.width; const h = multiCanvas.height;
    multiCtx.clearRect(0,0,w,h);
    // background
    const grad = multiCtx.createLinearGradient(0,0,0,h); grad.addColorStop(0,'rgba(255,255,255,0.02)'); grad.addColorStop(1,'rgba(255,255,255,0.01)');
    multiCtx.fillStyle = grad; multiCtx.fillRect(0,0,w,h);

    const symbols = Object.keys(state.stocks);
    // compute global min/max across recent histories
    let globalMin = Infinity, globalMax = -Infinity;
    const series = symbols.map(sym=>{
      const hist = state.stocks[sym].history.length? state.stocks[sym].history.slice(-200) : [state.stocks[sym].price];
      hist.forEach(v=>{ if(v<globalMin) globalMin=v; if(v>globalMax) globalMax=v; });
      return { sym, hist };
    });
    if(globalMin===Infinity){ globalMin=0; globalMax=1; }
    const range = Math.max(globalMax-globalMin, 0.0001);

    // draw each series
    series.forEach((s,idx)=>{
      const color = COLORS[idx % COLORS.length];
      multiCtx.beginPath();
      s.hist.forEach((p,i)=>{
        const x = (i/(s.hist.length-1||1)) * (w-8) + 4;
        const y = h - ((p-globalMin)/range) * (h-8) - 4;
        if(i===0) multiCtx.moveTo(x,y); else multiCtx.lineTo(x,y);
      });
      multiCtx.strokeStyle = color; multiCtx.lineWidth = 1.8; multiCtx.stroke();
    });
  }

  // Hover detection: show nearest symbol/value under mouse
  if(multiCanvas){
    multiCanvas.addEventListener('mousemove', (ev)=>{
      const rect = multiCanvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (multiCanvas.width/rect.width);
      // map x to index
      const symbols = Object.keys(state.stocks);
      let hoverText = [];
      symbols.forEach((sym,idx)=>{
        const hist = state.stocks[sym].history.length? state.stocks[sym].history.slice(-200) : [state.stocks[sym].price];
        const i = Math.floor(((x-4)/(multiCanvas.width-8))*(hist.length-1));
        const clamp = Math.max(0, Math.min(hist.length-1, i));
        const val = hist[clamp] || state.stocks[sym].price;
        hoverText.push(`<span style="color:${COLORS[idx%COLORS.length]}"><strong>${sym}</strong></span>: $${money(val)}`);
      });
      multiHover.innerHTML = hoverText.join(' • ');
    });
    multiCanvas.addEventListener('mouseleave', ()=>{ multiHover.textContent = 'Hover over lines to see values.'; });
  }


  // Removed showChart and single-stock chart logic
  openMenuBtn.addEventListener('click', ()=>{
    showMenu(true);
    // Pause the game (stop auto-tick)
    if(timer){ clearInterval(timer); timer = null; $('autoToggle').textContent='Start Auto'; }
  });

  function openShop(){
    if(!shopModal){
      shopModal = document.createElement('div'); shopModal.className='menu';
      shopModal.style.maxWidth='420px';
      shopModal.innerHTML = `<h3>Market Shop</h3>
        <div class="muted">Spend cash to influence a stock's price. Costs scale with magnitude.</div>
        <div style="margin-top:10px;display:flex;gap:8px"><button class="tab active" data-tab="influence">Influence</button><button class="tab" data-tab="booster">Booster</button><button class="tab" data-tab="news">News</button></div>
        <div id="shopContent" style="margin-top:10px"></div>
        <div class="muted shop-cd" style="margin-top:8px"></div>`;
      document.body.appendChild(shopModal);
      shopModal.querySelectorAll('.tab').forEach(t=> t.addEventListener('click',(e)=>{ shopModal.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); e.target.classList.add('active'); renderShopTab(e.target.dataset.tab); }));
      renderShopTab('influence');
      // close button in content will be wired per tab
    }
    shopModal.style.position='fixed'; shopModal.style.left='50%'; shopModal.style.top='50%'; shopModal.style.transform='translate(-50%,-50%)'; shopModal.style.zIndex='9999';
    shopModal.style.display='block';
    render();
  }

  function closeShop(){ if(shopModal) shopModal.style.display='none'; }

  function shopAction(type){
    if(shopCooldown>0) return addLog('Shop cooling down');
    const sym = (document.getElementById('shopSym')?.value || '').trim().toUpperCase();
    const mag = Number(document.getElementById('shopMag')?.value || 0.05);
    if(!sym || !state.stocks[sym]) return addLog('Invalid symbol for shop');
    const price = state.stocks[sym].price;
    // cost scales with percent and price and a base
    const cost = Math.round(SHOP_COST_BASE * mag * (price/10));
    if(state.cash < cost) return addLog('Not enough cash for shop action');
    state.cash -= cost;
    const impact = (type==='pump'? 1 : -1) * mag;
    state.stocks[sym].price = Math.max(0.1, state.stocks[sym].price * (1 + impact));
    addLog(`${type==='pump'?'Pumped':'Dumped'} ${sym} by ${Math.round(mag*100)}% for $${money(cost)}`);
    shopCooldown = SHOP_COOLDOWN_TICKS;
    saveState(); render();
  }

  // Booster implementation: reduce volatility for a short duration
  let boosters = []; // active boosters {untilTick, factor}
  function buyBooster(){
    const cost = 1500;
    if(state.cash < cost) return addLog('Not enough cash for booster');
    state.cash -= cost;
    boosters.push({ untilTick: state.tick + 20, factor: 0.5 });
    addLog(`Bought booster: market volatility halved for 20 ticks ($${money(cost)})`);
    saveState(); render();
  }

  function applyBoosters(){
    const nowTick = state.tick;
    // if boosters active, apply multiplicative effect to volatility when computing step
    // We will compute a globalVolFactor each step
    let factor = 1;
    boosters = boosters.filter(b=> b.untilTick > nowTick);
    boosters.forEach(b => factor *= b.factor);
    return factor;
  }

  function renderShopTab(tab){
    const content = shopModal.querySelector('#shopContent'); if(!content) return;
    content.innerHTML = '';
    if(tab==='influence'){
      content.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><label style="flex:1">Symbol <input id="shopSym" value="WBD"></label>
        <label>Magnitude <select id="shopMag"><option value="0.05">5%</option><option value="0.1">10%</option><option value="0.2">20%</option></select></label></div>
        <div style="margin-top:10px;display:flex;gap:8px"><button id="pump">Pump (raise) - $<span id="pumpCost">0</span></button><button id="dump">Dump (lower) - $<span id="dumpCost">0</span></button><button id="shopClose">Close</button></div>`;
      const magSel = content.querySelector('#shopMag'); const updateCosts = ()=>{
        const mag = Number(magSel.value); const exampleSym = (content.querySelector('#shopSym').value||'WBD').toUpperCase(); const price = state.stocks[exampleSym]?.price || 20; const cost = Math.round(SHOP_COST_BASE * mag * (price/10)); content.querySelector('#pumpCost').textContent = cost; content.querySelector('#dumpCost').textContent = cost; };
      content.querySelector('#shopSym').addEventListener('input', updateCosts);
      magSel.addEventListener('change', updateCosts); updateCosts();
      content.querySelector('#pump').addEventListener('click', ()=>{ shopAction('pump'); });
      content.querySelector('#dump').addEventListener('click', ()=>{ shopAction('dump'); });
      content.querySelector('#shopClose').addEventListener('click', ()=>{ closeShop(); });
    } else if(tab==='booster'){
      content.innerHTML = `<div class="muted">Buy temporary market boosters. Booster halves volatility for 20 ticks.</div>
        <div style="margin-top:10px;display:flex;gap:8px"><button id="buyBooster">Buy Booster - $1500</button><button id="shopClose2">Close</button></div>`;
      content.querySelector('#buyBooster').addEventListener('click', ()=>{ buyBooster(); });
      content.querySelector('#shopClose2').addEventListener('click', ()=>{ closeShop(); });
    } else if(tab==='news'){
      content.innerHTML = `<div class="muted">News tab: for future features (paid news stories, rumor mill).</div>
        <div style="margin-top:10px"><button id="shopClose3">Close</button></div>`;
      content.querySelector('#shopClose3').addEventListener('click', ()=>{ closeShop(); });
    }
  }

  /* Cookie-based slot saves (3 slots) */
  function setCookie(name, value, days=365){
    try{
      const v = encodeURIComponent(value);
      const d = new Date(); d.setTime(d.getTime() + (days*24*60*60*1000));
      document.cookie = `${name}=${v}; expires=${d.toUTCString()}; path=/`;
    }catch(e){ console.warn('cookie set failed', e); }
  }
  function getCookie(name){
    const kv = document.cookie.split(';').map(s=>s.trim());
    for(const pair of kv){
      if(!pair) continue;
      const [k,v] = pair.split('='); if(k===name) return decodeURIComponent(v||'');
    }
    return null;
  }
  function deleteCookie(name){ document.cookie = `${name}=; Max-Age=0; path=/`; }

  function slotKey(i){ return `wn_slot_${i}`; }
  function saveToSlot(i){
    try{
      const snapshot = JSON.stringify(state);
      setCookie(slotKey(i), snapshot, 365);
      addLog(`Saved slot ${i}`); renderSlots();
      lastCookieSave = Date.now(); // reset autosave timer
    }catch(e){ addLog('Save failed'); }
  }
  function loadFromSlot(i){
    const raw = getCookie(slotKey(i));
    if(!raw) return addLog(`Slot ${i} empty`);
    try{
      state = JSON.parse(raw);
      addLog(`Loaded slot ${i}`);
      saveState(); render();
    }catch(e){ addLog('Load failed'); }
  }
  function clearSlot(i){ deleteCookie(slotKey(i)); renderSlots(); addLog(`Cleared slot ${i}`); }

  function renderSlots(){
    slotsContainer.innerHTML = '';
    for(let i=1;i<=3;i++){
      const raw = getCookie(slotKey(i));
      const div = document.createElement('div'); div.className='slot';
      if(raw){
        let info = 'Saved';
        try{ const s = JSON.parse(raw); info = `Cash $${money(s.cash||0)} • ${Object.keys(s.portfolio||{}).length} positions`; }catch(e){}
        div.innerHTML = `<div><strong>Slot ${i}</strong><div class="muted">${info}</div><button id="load_${i}">Load</button><button id="save_${i}">Save</button><button id="clear_${i}">Clear</button></div>`;
      } else {
        div.innerHTML = `<div><strong>Slot ${i}</strong><div class="muted">Empty</div><button id="load_${i}" disabled>Load</button><button id="save_${i}">Save</button><button id="clear_${i}" disabled>Clear</button></div>`;
      }
      slotsContainer.appendChild(div);
      // wire buttons
      const ld = document.getElementById(`load_${i}`);
      const sv = document.getElementById(`save_${i}`);
      const cl = document.getElementById(`clear_${i}`);
      if(ld) ld.addEventListener('click', ()=>{ loadFromSlot(i); showMenu(false); });
      if(sv) sv.addEventListener('click', ()=>{ saveToSlot(i); });
      if(cl) cl.addEventListener('click', ()=>{ if(confirm('Clear slot?')) clearSlot(i); });
    }
  }

  function showMenu(v){ if(mainMenu) mainMenu.style.display = v? 'flex' : 'none'; }

  function fillSymbol(sym){ $('sym').value = sym; }

  function buyAction(){
    const sel = document.getElementById('symSelect');
    const sym = (sel ? sel.value : $('sym')?.value || '').trim().toUpperCase();
    const qty = Math.max(1, Math.floor(Number($('qty').value) || 1));
    if(!sym || !state.stocks[sym]) return addLog(`Unknown symbol ${sym}`);
    const price = state.stocks[sym].price;
    const cost = price * qty;
    if(cost > state.cash) return addLog(`Not enough cash to buy ${qty} ${sym} ($${money(cost)})`);
    state.cash -= cost;
    if(!state.portfolio[sym]) state.portfolio[sym] = { qty:0, avg:0 };
    const pos = state.portfolio[sym];
    pos.avg = ((pos.avg*pos.qty)+cost)/(pos.qty+qty);
    pos.qty += qty;
    addLog(`Bought ${qty} ${sym} @ $${money(price)} = $${money(cost)}`);
    saveState(); render();
  }

  function sellAction(){
    const sel = document.getElementById('symSelect');
    const sym = (sel ? sel.value : $('sym')?.value || '').trim().toUpperCase();
    const qty = Math.max(1, Math.floor(Number($('qty').value) || 1));
    if(!sym || !state.portfolio[sym]) return addLog(`No position in ${sym}`);
    const pos = state.portfolio[sym];
    const sellQty = Math.min(qty, pos.qty);
    const price = state.stocks[sym].price;
    const proceeds = price * sellQty;
    pos.qty -= sellQty;
    if(pos.qty===0) delete state.portfolio[sym];
    state.cash += proceeds;
    addLog(`Sold ${sellQty} ${sym} @ $${money(price)} = $${money(proceeds)}`);
    saveState(); render();
  }

  function closePosition(sym){
    if(!state.portfolio[sym]) return;
    const pos = state.portfolio[sym];
    const price = state.stocks[sym].price;
    const proceeds = price * pos.qty;
    state.cash += proceeds;
    addLog(`Closed ${pos.qty} ${sym} @ $${money(price)} = $${money(proceeds)}`);
    delete state.portfolio[sym];
    saveState(); render();
  }

  function addLog(msg){
    state.log.push({ t: now(), msg });
    if(state.log.length>200) state.log.shift();
  }

  function step(){
    state.tick += 1;
    if(shopCooldown>0) shopCooldown = Math.max(0, shopCooldown-1);
    // random walk + occasional news events
    const volFactor = applyBoosters();
    Object.keys(state.stocks).forEach(sym => {
      const s = state.stocks[sym];
      // base random movement
      const rnd = (Math.random()-0.5) * 2 * s.vol * volFactor * s.price;
      s.price = Math.max(0.1, s.price + rnd);
      // small chance of news event
      if(Math.random() < 0.02){
        const impact = (Math.random()>0.5?1:-1) * (0.05 + Math.random()*0.25);
        s.price = Math.max(0.1, s.price * (1+impact));
        addLog(`${sym} news: ${impact>0? 'positive':'negative'} (${Math.round(impact*100)}%) -> $${money(s.price)}`);
      }
      s.history.push(s.price);
      if(s.history.length>100) s.history.shift();
    });

    // small periodic dividend/event awarding small cash bonuses
    if(Math.random() < 0.01){
      const bonus = Math.round(10 + Math.random()*200);
      state.cash += bonus;
      addLog(`Market dividend: received $${money(bonus)}`);
    }
  }

  function toggleAuto(){
    if(timer){ clearInterval(timer); timer = null; $('autoToggle').textContent='Start Auto'; return; }
    const ms = Number($('speed').value);
    timer = setInterval(()=>{ step(); render(); saveState(); }, ms);
    $('autoToggle').textContent='Stop Auto';
  }

  function resetGame(){
    if(!confirm('Reset game? This clears progress.')) return;
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    SYMBOLS.forEach(s => state.stocks[s] = { price: (20 + Math.random()*180), history: [], vol: (0.01+Math.random()*0.04) });
    saveState(true);
    render();
  }

  function saveState(forceClear){
    try{
      if(forceClear) localStorage.removeItem('wn-stock-state');
      localStorage.setItem('wn-stock-state', JSON.stringify(state));
    }catch(e){ console.error('save failed', e); }
  }

  function loadState(){
    try{
      const raw = localStorage.getItem('wn-stock-state');
      if(!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(raw);
      // Basic validation
      parsed.cash = Number(parsed.cash||0);
      parsed.stocks = parsed.stocks || {};
      parsed.portfolio = parsed.portfolio || {};
      parsed.log = parsed.log || [];
      parsed.tick = parsed.tick || 0;
      return parsed;
    }catch(e){ console.warn('load failed', e); return JSON.parse(JSON.stringify(DEFAULT_STATE)); }
  }

})();
