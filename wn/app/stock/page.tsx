"use client";

import { useEffect } from "react";

export default function StockPage() {
  useEffect(() => {
    const sessionStart = Date.now();
    const cleanup = (function () {
      const DEFAULT_STATE = {
        cash: 10000,
        tick: 0,
        stocks: {},
        portfolio: {},
        log: [],
      } as {
        cash: number;
        tick: number;
        stocks: Record<string, { price: number; history: number[]; vol: number }>;
        portfolio: Record<string, { qty: number; avg: number }>;
        log: Array<{ t: string; msg: string }>;
      };

      const SYMBOLS = ["WBD", "ZEN", "ACME", "ORCL", "TSL", "NXT"];

      const $ = (id: string) => document.getElementById(id);
      function money(v: number) {
        return Number(v).toFixed(2);
      }
      function now() {
        return new Date().toLocaleTimeString();
      }

      let state = loadState();
      let timer: ReturnType<typeof setInterval> | null = null;

      if (Object.keys(state.stocks).length === 0) {
        SYMBOLS.forEach((s) => {
          state.stocks[s] = { price: 20 + Math.random() * 180, history: [], vol: 0.01 + Math.random() * 0.04 };
        });
        saveState();
      }

      const marketEl = $("market");
      const cashEl = $("cash");
      const cashAsideEl = $("cash-aside");
      const portfolioTbody = $("portfolio")?.querySelector("tbody");
      const netEl = $("networth") || { textContent: "0" };
      const logEl = $("log");
      const multiCanvas = document.getElementById("multiChart") as HTMLCanvasElement | null;
      const multiCtx = multiCanvas ? multiCanvas.getContext("2d") : null;
      const multiHover = $("multiHover");

      const COLORS = ["#38bdf8", "#60a5fa", "#34d399", "#f472b6", "#fb923c", "#f87171", "#a78bfa"];

      const mainMenu = $("mainMenu");
      const slotsContainer = $("slotsContainer");
      const continueBtn = $("continueBtn");
      const newGameBtn = $("newGame");
      const closeMenuBtn = $("closeMenu");
      const openMenuBtn = $("openMenu");
      const shopBtn = $("shopBtn");

      let shopModal: HTMLDivElement | null = null;

      $("tick")?.addEventListener("click", () => {
        step();
        render();
        saveState();
      });
      $("autoToggle")?.addEventListener("click", toggleAuto);
      $("speed")?.addEventListener("change", () => {
        if (timer) {
          toggleAuto();
          toggleAuto();
        }
      });
      $("buy")?.addEventListener("click", buyAction);
      $("sell")?.addEventListener("click", sellAction);
      $("reset")?.addEventListener("click", resetGame);

      function populateSymbolDropdown() {
        const sel = document.getElementById("symSelect") as HTMLSelectElement | null;
        if (!sel) return;
        sel.innerHTML = "";
        Object.keys(state.stocks).forEach((sym) => {
          const opt = document.createElement("option");
          opt.value = sym;
          opt.textContent = sym;
          sel.appendChild(opt);
        });
      }
      populateSymbolDropdown();

      shopBtn?.addEventListener("click", () => {
        openShop();
      });
      closeMenuBtn?.addEventListener("click", () => {
        showMenu(false);
      });
      continueBtn?.addEventListener("click", () => {
        showMenu(false);
      });
      newGameBtn?.addEventListener("click", () => {
        resetGame();
        showMenu(false);
      });

      renderSlots();

      let lastCookieSave = Date.now();
      const cookieInterval = setInterval(() => {
        if (Date.now() - lastCookieSave >= 60000) {
          autoSaveCookies();
          lastCookieSave = Date.now();
        }
      }, 5000);

      function autoSaveCookies() {
        try {
          const snapshot = JSON.stringify(state);
          setCookie(slotKey(1), snapshot, 365);
        } catch (e) {
          return;
        }
      }

      function normalizeState(input: any) {
        const base = JSON.parse(JSON.stringify(DEFAULT_STATE)) as typeof DEFAULT_STATE;
        const safe = { ...base, ...input } as typeof DEFAULT_STATE;
        safe.cash = Number(safe.cash || 0);
        safe.stocks = safe.stocks || {};
        safe.portfolio = safe.portfolio || {};
        safe.log = safe.log || [];
        safe.tick = safe.tick || 0;
        return safe;
      }

      async function loadRemoteState() {
        try {
          const res = await fetch("/api/game-state/stock");
          const data = await res.json();
          if (data?.state) {
            state = normalizeState(data.state);
            if (Object.keys(state.stocks).length === 0) {
              SYMBOLS.forEach((s) => {
                state.stocks[s] = { price: 20 + Math.random() * 180, history: [], vol: 0.01 + Math.random() * 0.04 };
              });
            }
          }
        } catch (e) {
          return;
        }
      }

      let shopCooldown = 0;
      const SHOP_COST_BASE = 500;
      const SHOP_COOLDOWN_TICKS = 5;

      loadRemoteState().finally(() => {
        render();
      });

      function render() {
        if (marketEl) marketEl.innerHTML = "";
        Object.keys(state.stocks).forEach((sym) => {
          const s = state.stocks[sym];
          const row = document.createElement("div");
          row.className = "stock-row";
          row.innerHTML = `<div><strong>${sym}</strong> <span class="small">$${money(s.price)}</span></div>`;
          const actions = document.createElement("div");
          actions.className = "stock-actions";
          const buy = document.createElement("button");
          buy.textContent = "Buy";
          buy.onclick = (e) => {
            e.stopPropagation();
            const sel = document.getElementById("symSelect") as HTMLSelectElement | null;
            if (sel) sel.value = sym;
            const qtyInput = $("qty") as HTMLInputElement | null;
            if (qtyInput) qtyInput.value = "1";
            buyAction();
          };
          const sell = document.createElement("button");
          sell.textContent = "Sell";
          sell.onclick = (e) => {
            e.stopPropagation();
            const sel = document.getElementById("symSelect") as HTMLSelectElement | null;
            if (sel) sel.value = sym;
            const qtyInput = $("qty") as HTMLInputElement | null;
            if (qtyInput) qtyInput.value = "1";
            sellAction();
          };
          actions.appendChild(buy);
          actions.appendChild(sell);
          row.appendChild(actions);
          marketEl?.appendChild(row);
        });

        if (cashEl) cashEl.textContent = money(state.cash);
        if (cashAsideEl) cashAsideEl.textContent = money(state.cash);

        if (portfolioTbody) {
          portfolioTbody.innerHTML = "";
          let net = state.cash;
          Object.keys(state.portfolio).forEach((sym) => {
            const p = state.portfolio[sym];
            const price = state.stocks[sym]?.price || 0;
            const value = price * p.qty;
            net += value;
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${sym}</td><td>${p.qty}</td><td>$${money(p.avg)}</td><td>$${money(value)}</td><td><button data-sym="${sym}">Close</button></td>`;
            tr.querySelector("button")?.addEventListener("click", () => closePosition(sym));
            portfolioTbody.appendChild(tr);
          });
          netEl.textContent = money(net);
        }

        if (logEl) {
          logEl.innerHTML = "";
          state.log
            .slice()
            .reverse()
            .forEach((l) => {
              const d = document.createElement("div");
              d.textContent = `[${l.t}] ${l.msg}`;
              logEl.appendChild(d);
            });
        }

        if (shopModal) {
          const cd = shopModal.querySelector(".shop-cd");
          if (cd) cd.textContent = shopCooldown > 0 ? `Cooldown: ${shopCooldown}` : "Ready";
        }

        drawMultiChart();
      }

      function drawMultiChart() {
        if (!multiCtx || !multiCanvas) return;
        const w = multiCanvas.width;
        const h = multiCanvas.height;
        multiCtx.clearRect(0, 0, w, h);
        const grad = multiCtx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(255,255,255,0.02)");
        grad.addColorStop(1, "rgba(255,255,255,0.01)");
        multiCtx.fillStyle = grad;
        multiCtx.fillRect(0, 0, w, h);

        const symbols = Object.keys(state.stocks);
        let globalMin = Infinity;
        let globalMax = -Infinity;
        const series = symbols.map((sym) => {
          const hist = state.stocks[sym].history.length ? state.stocks[sym].history.slice(-200) : [state.stocks[sym].price];
          hist.forEach((v) => {
            if (v < globalMin) globalMin = v;
            if (v > globalMax) globalMax = v;
          });
          return { sym, hist };
        });
        if (globalMin === Infinity) {
          globalMin = 0;
          globalMax = 1;
        }
        const range = Math.max(globalMax - globalMin, 0.0001);

        series.forEach((s, idx) => {
          const color = COLORS[idx % COLORS.length];
          multiCtx.beginPath();
          s.hist.forEach((p, i) => {
            const x = (i / (s.hist.length - 1 || 1)) * (w - 8) + 4;
            const y = h - ((p - globalMin) / range) * (h - 8) - 4;
            if (i === 0) multiCtx.moveTo(x, y);
            else multiCtx.lineTo(x, y);
          });
          multiCtx.strokeStyle = color;
          multiCtx.lineWidth = 1.8;
          multiCtx.stroke();
        });
      }

      if (multiCanvas) {
        const handleHover = (ev: MouseEvent) => {
          const rect = multiCanvas.getBoundingClientRect();
          const x = (ev.clientX - rect.left) * (multiCanvas.width / rect.width);
          const symbols = Object.keys(state.stocks);
          const hoverText: string[] = [];
          symbols.forEach((sym, idx) => {
            const hist = state.stocks[sym].history.length ? state.stocks[sym].history.slice(-200) : [state.stocks[sym].price];
            const i = Math.floor(((x - 4) / (multiCanvas.width - 8)) * (hist.length - 1));
            const clamp = Math.max(0, Math.min(hist.length - 1, i));
            const val = hist[clamp] || state.stocks[sym].price;
            hoverText.push(`<span style="color:${COLORS[idx % COLORS.length]}"><strong>${sym}</strong></span>: $${money(val)}`);
          });
          if (multiHover) multiHover.innerHTML = hoverText.join(" * ");
        };
        const handleLeave = () => {
          if (multiHover) multiHover.textContent = "Hover over lines to see values.";
        };
        multiCanvas.addEventListener("mousemove", handleHover);
        multiCanvas.addEventListener("mouseleave", handleLeave);
      }

      openMenuBtn?.addEventListener("click", () => {
        showMenu(true);
        if (timer) {
          clearInterval(timer);
          timer = null;
          const autoToggle = $("autoToggle");
          if (autoToggle) autoToggle.textContent = "Start Auto";
        }
      });

      function openShop() {
        if (!shopModal) {
          shopModal = document.createElement("div");
          shopModal.className = "menu";
          shopModal.style.maxWidth = "420px";
          shopModal.innerHTML = `<h3>Market Shop</h3>
        <div class="muted">Spend cash to influence a stock's price. Costs scale with magnitude.</div>
        <div style="margin-top:10px;display:flex;gap:8px"><button class="tab active" data-tab="influence">Influence</button><button class="tab" data-tab="booster">Booster</button><button class="tab" data-tab="news">News</button></div>
        <div id="shopContent" style="margin-top:10px"></div>
        <div class="muted shop-cd" style="margin-top:8px"></div>`;
          document.body.appendChild(shopModal);
          shopModal.querySelectorAll(".tab").forEach((t) =>
            t.addEventListener("click", (e) => {
              shopModal?.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
              const target = e.target as HTMLElement;
              target.classList.add("active");
              renderShopTab(target.dataset.tab || "influence");
            })
          );
          renderShopTab("influence");
        }
        shopModal.style.position = "fixed";
        shopModal.style.left = "50%";
        shopModal.style.top = "50%";
        shopModal.style.transform = "translate(-50%,-50%)";
        shopModal.style.zIndex = "9999";
        shopModal.style.display = "block";
        render();
      }

      function closeShop() {
        if (shopModal) shopModal.style.display = "none";
      }

      function shopAction(type: "pump" | "dump") {
        if (shopCooldown > 0) return addLog("Shop cooling down");
        const sym = (document.getElementById("shopSym") as HTMLInputElement | null)?.value.trim().toUpperCase() || "";
        const mag = Number((document.getElementById("shopMag") as HTMLSelectElement | null)?.value || 0.05);
        if (!sym || !state.stocks[sym]) return addLog("Invalid symbol for shop");
        const price = state.stocks[sym].price;
        const cost = Math.round(SHOP_COST_BASE * mag * (price / 10));
        if (state.cash < cost) return addLog("Not enough cash for shop action");
        state.cash -= cost;
        const impact = (type === "pump" ? 1 : -1) * mag;
        state.stocks[sym].price = Math.max(0.1, state.stocks[sym].price * (1 + impact));
        addLog(`${type === "pump" ? "Pumped" : "Dumped"} ${sym} by ${Math.round(mag * 100)}% for $${money(cost)}`);
        shopCooldown = SHOP_COOLDOWN_TICKS;
        saveState();
        render();
      }

      let boosters: Array<{ untilTick: number; factor: number }> = [];
      function buyBooster() {
        const cost = 1500;
        if (state.cash < cost) return addLog("Not enough cash for booster");
        state.cash -= cost;
        boosters.push({ untilTick: state.tick + 20, factor: 0.5 });
        addLog(`Bought booster: market volatility halved for 20 ticks ($${money(cost)})`);
        saveState();
        render();
      }

      function applyBoosters() {
        const nowTick = state.tick;
        let factor = 1;
        boosters = boosters.filter((b) => b.untilTick > nowTick);
        boosters.forEach((b) => {
          factor *= b.factor;
        });
        return factor;
      }

      function renderShopTab(tab: string) {
        if (!shopModal) return;
        const content = shopModal.querySelector("#shopContent") as HTMLDivElement | null;
        if (!content) return;
        content.innerHTML = "";
        if (tab === "influence") {
          content.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><label style="flex:1">Symbol <input id="shopSym" value="WBD"></label>
        <label>Magnitude <select id="shopMag"><option value="0.05">5%</option><option value="0.1">10%</option><option value="0.2">20%</option></select></label></div>
        <div style="margin-top:10px;display:flex;gap:8px"><button id="pump">Pump (raise) - $<span id="pumpCost">0</span></button><button id="dump">Dump (lower) - $<span id="dumpCost">0</span></button><button id="shopClose">Close</button></div>`;
          const magSel = content.querySelector("#shopMag") as HTMLSelectElement | null;
          const updateCosts = () => {
            if (!magSel) return;
            const mag = Number(magSel.value);
            const symInput = content.querySelector("#shopSym") as HTMLInputElement | null;
            const exampleSym = (symInput?.value || "WBD").toUpperCase();
            const price = state.stocks[exampleSym]?.price || 20;
            const cost = Math.round(SHOP_COST_BASE * mag * (price / 10));
            const pumpCost = content.querySelector("#pumpCost");
            const dumpCost = content.querySelector("#dumpCost");
            if (pumpCost) pumpCost.textContent = String(cost);
            if (dumpCost) dumpCost.textContent = String(cost);
          };
          content.querySelector("#shopSym")?.addEventListener("input", updateCosts);
          magSel?.addEventListener("change", updateCosts);
          updateCosts();
          content.querySelector("#pump")?.addEventListener("click", () => {
            shopAction("pump");
          });
          content.querySelector("#dump")?.addEventListener("click", () => {
            shopAction("dump");
          });
          content.querySelector("#shopClose")?.addEventListener("click", () => {
            closeShop();
          });
        } else if (tab === "booster") {
          content.innerHTML = `<div class="muted">Buy temporary market boosters. Booster halves volatility for 20 ticks.</div>
        <div style="margin-top:10px;display:flex;gap:8px"><button id="buyBooster">Buy Booster - $1500</button><button id="shopClose2">Close</button></div>`;
          content.querySelector("#buyBooster")?.addEventListener("click", () => {
            buyBooster();
          });
          content.querySelector("#shopClose2")?.addEventListener("click", () => {
            closeShop();
          });
        } else if (tab === "news") {
          content.innerHTML = `<div class="muted">News tab: for future features (paid news stories, rumor mill).</div>
        <div style="margin-top:10px"><button id="shopClose3">Close</button></div>`;
          content.querySelector("#shopClose3")?.addEventListener("click", () => {
            closeShop();
          });
        }
      }

      function setCookie(name: string, value: string, days = 365) {
        try {
          const v = encodeURIComponent(value);
          const d = new Date();
          d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
          document.cookie = `${name}=${v}; expires=${d.toUTCString()}; path=/`;
        } catch (e) {
          return;
        }
      }
      function getCookie(name: string) {
        const kv = document.cookie.split(";").map((s) => s.trim());
        for (const pair of kv) {
          if (!pair) continue;
          const [k, v] = pair.split("=");
          if (k === name) return decodeURIComponent(v || "");
        }
        return null;
      }
      function deleteCookie(name: string) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }

      function slotKey(i: number) {
        return `wn_slot_${i}`;
      }
      function saveToSlot(i: number) {
        try {
          const snapshot = JSON.stringify(state);
          setCookie(slotKey(i), snapshot, 365);
          addLog(`Saved slot ${i}`);
          renderSlots();
          lastCookieSave = Date.now();
        } catch (e) {
          addLog("Save failed");
        }
      }
      function loadFromSlot(i: number) {
        const raw = getCookie(slotKey(i));
        if (!raw) return addLog(`Slot ${i} empty`);
        try {
          state = JSON.parse(raw);
          addLog(`Loaded slot ${i}`);
          saveState();
          render();
        } catch (e) {
          addLog("Load failed");
        }
      }
      function clearSlot(i: number) {
        deleteCookie(slotKey(i));
        renderSlots();
        addLog(`Cleared slot ${i}`);
      }

      function renderSlots() {
        if (!slotsContainer) return;
        slotsContainer.innerHTML = "";
        for (let i = 1; i <= 3; i += 1) {
          const raw = getCookie(slotKey(i));
          const div = document.createElement("div");
          div.className = "slot";
          if (raw) {
            let info = "Saved";
            try {
              const s = JSON.parse(raw);
              info = `Cash $${money(s.cash || 0)} * ${Object.keys(s.portfolio || {}).length} positions`;
            } catch (e) {
              return;
            }
            div.innerHTML = `<div><strong>Slot ${i}</strong><div class="muted">${info}</div><button id="load_${i}">Load</button><button id="save_${i}">Save</button><button id="clear_${i}">Clear</button></div>`;
          } else {
            div.innerHTML = `<div><strong>Slot ${i}</strong><div class="muted">Empty</div><button id="load_${i}" disabled>Load</button><button id="save_${i}">Save</button><button id="clear_${i}" disabled>Clear</button></div>`;
          }
          slotsContainer.appendChild(div);
          const ld = document.getElementById(`load_${i}`);
          const sv = document.getElementById(`save_${i}`);
          const cl = document.getElementById(`clear_${i}`);
          ld?.addEventListener("click", () => {
            loadFromSlot(i);
            showMenu(false);
          });
          sv?.addEventListener("click", () => {
            saveToSlot(i);
          });
          cl?.addEventListener("click", () => {
            if (confirm("Clear slot?")) clearSlot(i);
          });
        }
      }

      function showMenu(v: boolean) {
        if (mainMenu) mainMenu.style.display = v ? "flex" : "none";
      }

      function buyAction() {
        const sel = document.getElementById("symSelect") as HTMLSelectElement | null;
        const sym = (sel ? sel.value : "").trim().toUpperCase();
        const qtyInput = $("qty") as HTMLInputElement | null;
        const qty = Math.max(1, Math.floor(Number(qtyInput?.value) || 1));
        if (!sym || !state.stocks[sym]) return addLog(`Unknown symbol ${sym}`);
        const price = state.stocks[sym].price;
        const cost = price * qty;
        if (cost > state.cash) return addLog(`Not enough cash to buy ${qty} ${sym} ($${money(cost)})`);
        state.cash -= cost;
        if (!state.portfolio[sym]) state.portfolio[sym] = { qty: 0, avg: 0 };
        const pos = state.portfolio[sym];
        pos.avg = (pos.avg * pos.qty + cost) / (pos.qty + qty);
        pos.qty += qty;
        addLog(`Bought ${qty} ${sym} @ $${money(price)} = $${money(cost)}`);
        saveState();
        render();
      }

      function sellAction() {
        const sel = document.getElementById("symSelect") as HTMLSelectElement | null;
        const sym = (sel ? sel.value : "").trim().toUpperCase();
        const qtyInput = $("qty") as HTMLInputElement | null;
        const qty = Math.max(1, Math.floor(Number(qtyInput?.value) || 1));
        if (!sym || !state.portfolio[sym]) return addLog(`No position in ${sym}`);
        const pos = state.portfolio[sym];
        const sellQty = Math.min(qty, pos.qty);
        const price = state.stocks[sym].price;
        const proceeds = price * sellQty;
        pos.qty -= sellQty;
        if (pos.qty === 0) delete state.portfolio[sym];
        state.cash += proceeds;
        addLog(`Sold ${sellQty} ${sym} @ $${money(price)} = $${money(proceeds)}`);
        saveState();
        render();
      }

      function closePosition(sym: string) {
        if (!state.portfolio[sym]) return;
        const pos = state.portfolio[sym];
        const price = state.stocks[sym].price;
        const proceeds = price * pos.qty;
        state.cash += proceeds;
        addLog(`Closed ${pos.qty} ${sym} @ $${money(price)} = $${money(proceeds)}`);
        delete state.portfolio[sym];
        saveState();
        render();
      }

      function addLog(msg: string) {
        state.log.push({ t: now(), msg });
        if (state.log.length > 200) state.log.shift();
      }

      function step() {
        state.tick += 1;
        if (shopCooldown > 0) shopCooldown = Math.max(0, shopCooldown - 1);
        const volFactor = applyBoosters();
        Object.keys(state.stocks).forEach((sym) => {
          const s = state.stocks[sym];
          const rnd = (Math.random() - 0.5) * 2 * s.vol * volFactor * s.price;
          s.price = Math.max(0.1, s.price + rnd);
          if (Math.random() < 0.02) {
            const impact = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.25);
            s.price = Math.max(0.1, s.price * (1 + impact));
            addLog(`${sym} news: ${impact > 0 ? "positive" : "negative"} (${Math.round(impact * 100)}%) -> $${money(s.price)}`);
          }
          s.history.push(s.price);
          if (s.history.length > 100) s.history.shift();
        });

        if (Math.random() < 0.01) {
          const bonus = Math.round(10 + Math.random() * 200);
          state.cash += bonus;
          addLog(`Market dividend: received $${money(bonus)}`);
        }
      }

      function toggleAuto() {
        if (timer) {
          clearInterval(timer);
          timer = null;
          const autoToggle = $("autoToggle");
          if (autoToggle) autoToggle.textContent = "Start Auto";
          return;
        }
        const speed = $("speed") as HTMLSelectElement | null;
        const ms = Number(speed?.value || 1000);
        timer = setInterval(() => {
          step();
          render();
          saveState();
        }, ms);
        const autoToggle = $("autoToggle");
        if (autoToggle) autoToggle.textContent = "Stop Auto";
      }

      function resetGame() {
        if (!confirm("Reset game? This clears progress.")) return;
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        SYMBOLS.forEach((s) => (state.stocks[s] = { price: 20 + Math.random() * 180, history: [], vol: 0.01 + Math.random() * 0.04 }));
        saveState();
        render();
      }

      function saveState() {
        try {
          const payload = JSON.stringify({ state });
          fetch("/api/game-state/stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        } catch (e) {
          return;
        }
      }

      function loadState() {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
      }

      return () => {
        if (timer) clearInterval(timer);
        clearInterval(cookieInterval);
        if (shopModal) shopModal.remove();
      };
    })();
    return () => {
      const seconds = Math.floor((Date.now() - sessionStart) / 1000);
      if (seconds > 10) {
        const payload = JSON.stringify({ gameSlug: "stock", seconds });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/stats/playtime", blob);
        } else {
          fetch("/api/stats/playtime", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        }
      }
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  return (
    <div className="stock-page">
      <div className="app">
        <header>
          <div className="hamb" id="openMenu" title="Menu">
            Menu
          </div>
          <h1>WebNerd Stocks - Mini Market</h1>
          <div style={{ marginLeft: "auto" }} className="muted">
            Cash: $<span id="cash">0</span> * Net: $<span id="networth">0</span>
          </div>
        </header>

        <div className="grid">
          <div>
            <div className="card">
              <h2 className="muted">Portfolio</h2>
              <table className="portfolio" id="portfolio">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Avg</th>
                    <th>Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
              <div style={{ marginTop: "8px" }} className="muted">
                Cash: $<span id="cash-aside">0</span>
              </div>
            </div>

            <div className="card" style={{ marginTop: "12px" }}>
              <h2 className="muted">Controls</h2>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  Symbol <select id="symSelect"></select>
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  Qty <input id="qty" type="number" defaultValue={1} min={1} style={{ width: "80px" }} />
                </label>
              </div>
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button id="buy">Buy</button>
                <button id="sell">Sell</button>
                <button id="shopBtn">Shop</button>
                <button id="reset">Reset Game</button>
              </div>
            </div>

            <div className="card" style={{ marginTop: "12px" }}>
              <h2 className="muted">News & Log</h2>
              <div id="log" className="log"></div>
            </div>
          </div>

          <div>
            <div className="card">
              <h2 className="muted">Market</h2>
              <div id="market" className="market-list"></div>
              <div className="controls">
                <button id="tick" title="Advance time">
                  Tick
                </button>
                <button id="autoToggle">Start Auto</button>
                <label className="muted" style={{ marginLeft: "auto" }}>
                  Speed:
                  <select id="speed">
                    <option value="1000">1x</option>
                    <option value="500">2x</option>
                    <option value="200">5x</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="card" style={{ marginTop: "12px" }}>
              <h2 className="muted">Market Chart (All Stocks)</h2>
              <canvas
                id="multiChart"
                width={960}
                height={220}
                style={{ width: "100%", height: "180px", borderRadius: "8px", background: "linear-gradient(180deg, rgba(255,255,255,0.01), transparent)" }}
              ></canvas>
              <div id="multiHover" className="muted" style={{ marginTop: "8px" }}>
                Hover over lines to see values.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="mainMenu" aria-hidden="false">
        <div className="menu">
          <h2>WebNerd Stocks</h2>
          <p className="muted">Choose an action or manage save slots. Data is stored in cookies (3 slots).</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button id="newGame">New Game</button>
            <button id="continueBtn">Continue</button>
            <button id="closeMenu">Close</button>
          </div>

          <div style={{ marginTop: "14px" }}>
            <div className="muted">Save Slots</div>
            <div className="slots" id="slotsContainer"></div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --bg: #0b1220;
          --card: #0f1724;
          --muted: #9fb0c8;
          --accent: #38bdf8;
          --glass: rgba(255, 255, 255, 0.04);
          --radius: 12px;
          --gap: 16px;
          --glass-border: rgba(255, 255, 255, 0.04);
        }
        html,
        body {
          height: 100%;
          margin: 0;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          background: var(--bg);
          color: #e6f0fb;
        }
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          backdrop-filter: blur(4px);
          background: rgba(2, 6, 12, 0.18);
          z-index: 0;
        }
        body {
          background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            radial-gradient(circle at 11px 11px, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 22px 22px, 22px 22px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .app {
          max-width: 1100px;
          margin: 34px auto;
          padding: 20px;
          position: relative;
          z-index: 1;
        }
        header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .hamb {
          background: var(--glass);
          border: 1px solid var(--glass-border);
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
        }
        h1 {
          margin: 0;
          font-size: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 18px;
          align-items: start;
        }
        .card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
          padding: 14px;
          border-radius: var(--radius);
          border: 1px solid var(--glass-border);
          box-shadow: 0 6px 18px rgba(2, 6, 23, 0.6);
        }
        .market-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .stock-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.01), transparent);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.02);
          cursor: pointer;
        }
        .stock-row strong {
          font-size: 15px;
        }
        .stock-actions button {
          margin-left: 8px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.04);
          color: var(--accent);
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
        }
        button {
          background: linear-gradient(180deg, var(--accent), #2bb8ef);
          border: none;
          color: #042033;
          padding: 8px 10px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(3, 18, 30, 0.4);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px rgba(3, 18, 30, 0.45);
        }
        button:active {
          transform: translateY(0);
          box-shadow: 0 6px 14px rgba(3, 18, 30, 0.35);
        }
        .controls {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .log {
          max-height: 220px;
          overflow: auto;
          padding: 8px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.01), transparent);
        }
        table.portfolio {
          width: 100%;
          border-collapse: collapse;
        }
        table.portfolio th,
        table.portfolio td {
          padding: 8px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
          text-align: left;
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
        }
        input[type="number"],
        input[type="text"],
        select {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.03);
          padding: 6px 8px;
          border-radius: 8px;
          color: inherit;
        }
        aside {
          position: relative;
        }
        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
          aside {
            order: 2;
          }
        }
        #mainMenu {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(2, 6, 23, 0.6), rgba(2, 6, 23, 0.6));
          backdrop-filter: blur(3px);
          z-index: 2;
        }
        #mainMenu .menu {
          width: 520px;
          padding: 20px;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .slots {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .slot {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .slot button {
          margin-top: 8px;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
