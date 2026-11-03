// ===== 保存まわり（データはこのスマホの中＝localStorageに保存） =====
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

let customRecipes = load("mk_custom", []); // 自作レシピ
let records = load("mk_records", []);      // 淹れた記録
let favs = load("mk_favs", []);            // お気に入りのレシピID
let longBrews = load("mk_long", []);       // 進行中の氷出し・水出し

const allRecipes = () => [...customRecipes, ...RECIPES];
const findRecipe = (id) => allRecipes().find((r) => r.id === id);

const CATS = [
  { id: "all", label: "すべて" },
  { id: "fav", label: "★ お気に入り" },
  { id: "hot", label: "ホット" },
  { id: "iced", label: "急冷アイス" },
  { id: "icedrip", label: "氷出し" },
  { id: "cold", label: "水出し" },
  { id: "milk", label: "ミルク・ラテ" },
  { id: "arrange", label: "アレンジ" },
  { id: "mine", label: "自作" },
];
const CAT_ICON = { hot: "☕", iced: "🧊", icedrip: "❄️", cold: "🫙", milk: "🥛", arrange: "✨" };
const LONG_CATS = ["icedrip", "cold"];

// ===== 小さな道具 =====
const $ = (sel) => document.querySelector(sel);
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
function parseTime(str) {
  // "1:30" → 90秒、"45" → 45秒
  const parts = String(str).trim().split(":");
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  return Number(parts[0]) || 0;
}
function fmtClock(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const roundHalf = (n) => Math.round(n * 2) / 2;

// ===== 画面の切り替え =====
function show(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("#view-" + name).classList.remove("hidden");
  document.body.classList.toggle("brewing", name === "brew");
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  window.scrollTo(0, 0);
  if (name === "list") renderList();
  if (name === "records") renderRecords();
}
document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => show(b.dataset.tab)));
document.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => show(b.dataset.back)));

// ===== 分量の換算 =====
// 豆の量が変わった割合(factor)を、お湯・氷・各投・追加材料に全部かける
function scaled(r, beans) {
  const f = beans / r.beans;
  return {
    beans,
    water: Math.round(r.water * f),
    ice: r.ice ? Math.round(r.ice * f) : 0,
    cups: Math.round(r.cups * f * 10) / 10,
    extras: (r.extras || []).map((e) => ({
      ...e,
      amount: e.amount == null ? null : e.unit === "スクープ" ? roundHalf(e.amount * f) : Math.round(e.amount * f),
    })),
    steps: (r.steps || []).map((s) => ({ ...s, to: s.to == null ? null : Math.round(s.to * f) })),
  };
}
// 前回の「次回へのメモ」を探す
function lastNextMemo(recipeId) {
  const rec = records.find((x) => x.recipeId === recipeId && x.nextMemo);
  return rec ? rec : null;
}

// ===== レシピ一覧 =====
let currentCat = "all";
$("#search").oninput = () => renderRecipeCards();
$("#btn-add").onclick = () => openEdit(null);

function renderList() {
  renderLongBrews();
  $("#cat-chips").innerHTML = CATS.map(
    (c) => `<button class="chip ${c.id === currentCat ? "active" : ""}" onclick="setCat('${c.id}')">${c.label}</button>`
  ).join("");
  renderRecipeCards();
}
function setCat(id) { currentCat = id; renderList(); }

function renderRecipeCards() {
  const q = $("#search").value.trim();
  let list = allRecipes();
  if (currentCat === "fav") list = list.filter((r) => favs.includes(r.id));
  else if (currentCat === "mine") list = list.filter((r) => r.custom);
  else if (currentCat !== "all") list = list.filter((r) => r.cat === currentCat);
  if (q) list = list.filter((r) => (r.name + r.by + r.note).includes(q));
  // お気に入りを上に
  list.sort((a, b) => favs.includes(b.id) - favs.includes(a.id));

  if (list.length === 0) {
    $("#recipe-list").innerHTML = `<p class="empty">レシピがありません</p>`;
    return;
  }
  $("#recipe-list").innerHTML = list.map((r) => {
    const end = (r.steps || []).find((s) => s.end);
    const time = r.long ? `約${r.long.hours}時間` : end ? fmtTime(end.t) : "";
    return `
      <div class="card" onclick="openDetail('${r.id}')">
        <div class="card-icon">${CAT_ICON[r.cat] || "☕"}</div>
        <div class="card-body">
          <div class="card-name">${esc(r.name)}</div>
          <div class="card-meta">豆${r.beans}g・お湯${r.water}ml${r.ice ? `・氷${r.ice}g` : ""}・${time}</div>
          <div class="card-by">${esc(r.by || "")}</div>
        </div>
        <button class="star ${favs.includes(r.id) ? "on" : ""}" onclick="event.stopPropagation(); toggleFav('${r.id}')">★</button>
      </div>`;
  }).join("");
}
function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
  save("mk_favs", favs);
  if (!$("#view-detail").classList.contains("hidden")) renderDetail();
  else renderRecipeCards();
}

// 進行中の氷出し・水出し
function renderLongBrews() {
  if (longBrews.length === 0) { $("#long-list").innerHTML = ""; return; }
  const now = Date.now();
  $("#long-list").innerHTML = `<h3 class="sec-title">抽出中</h3>` + longBrews.map((b) => {
    const left = b.endAt - now;
    const status = left <= 0
      ? `<b class="done">完成しました！</b>`
      : `完成予定 ${fmtClock(b.endAt)}（あと${Math.floor(left / 3600000)}時間${Math.floor((left % 3600000) / 60000)}分）`;
    return `
      <div class="long-card">
        <div><b>${esc(b.name)}</b><div class="card-meta">${status}</div></div>
        <div class="long-btns">
          <button class="btn-main small" onclick="finishLong(${b.key})">記録する</button>
          <button class="btn-sub small" onclick="cancelLong(${b.key})">取消</button>
        </div>
      </div>`;
  }).join("");
}
setInterval(() => { if (!$("#view-list").classList.contains("hidden")) renderLongBrews(); }, 60000);

function finishLong(key) {
  const b = longBrews.find((x) => x.key === key);
  longBrews = longBrews.filter((x) => x.key !== key);
  save("mk_long", longBrews);
  openRecord({ recipeId: b.recipeId, name: b.name, beans: b.beans, water: b.water });
}
function cancelLong(key) {
  if (!confirm("この抽出を取り消しますか？")) return;
  longBrews = longBrews.filter((x) => x.key !== key);
  save("mk_long", longBrews);
  renderLongBrews();
}

// ===== レシピ詳細 =====
let cur = null; // { r: レシピ, beans: 今の豆の量 }

function openDetail(id, beans) {
  const r = findRecipe(id);
  cur = { r, beans: beans || r.beans };
  renderDetail();
  show("detail");
}

function renderDetail() {
  const r = cur.r;
  const memo = lastNextMemo(r.id);
  $("#detail").innerHTML = `
    <div class="detail-head">
      <div class="detail-icon">${CAT_ICON[r.cat] || "☕"}</div>
      <div class="detail-title">
        <h2>${esc(r.name)}</h2>
        <div class="card-by">${esc(r.by || "")}</div>
      </div>
      <button class="star big ${favs.includes(r.id) ? "on" : ""}" onclick="toggleFav('${r.id}')">★</button>
    </div>

    ${memo ? `<div class="memo-box"><div class="memo-title">📝 前回のメモ（${fmtClock(memo.date)}）</div>${esc(memo.nextMemo)}</div>` : ""}

    <section class="panel">
      <div class="panel-title">分量</div>
      <div id="cups-chips" class="chips"></div>
      <div class="bean-row">
        <span>豆</span>
        <button class="pm" onclick="stepBeans(-1)">−</button>
        <input id="bean-input" type="number" inputmode="decimal" step="0.5" value="${cur.beans}" oninput="setBeans(this.value)">
        <span>g</span>
        <button class="pm" onclick="stepBeans(1)">＋</button>
      </div>
      <div id="scaled-area"></div>
    </section>

    <div id="steps-area"></div>

    ${r.note ? `<p class="note">💡 ${esc(r.note)}</p>` : ""}
    ${r.source && r.source.url ? `<p class="source">出典：<a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(r.source.label)}</a></p>` : ""}

    <button class="btn-main wide" onclick="openBrew()">${r.long ? "❄️ 抽出をはじめる" : "☕ 淹れるモードへ"}</button>
    <div class="row-btns">
      ${r.custom
        ? `<button class="btn-sub" onclick="openEdit('${r.id}')">編集</button>
           <button class="btn-sub danger" onclick="deleteRecipe('${r.id}')">削除</button>`
        : `<button class="btn-sub" onclick="openEdit('${r.id}', true)">コピーして自分用に編集</button>`}
    </div>`;
  renderScaled();
}

function setBeans(v) {
  const n = Number(v);
  if (n > 0) { cur.beans = n; renderScaled(); }
}
function stepBeans(d) {
  cur.beans = Math.max(1, roundHalf(cur.beans + d));
  $("#bean-input").value = cur.beans;
  renderScaled();
}
function setCups(n) {
  cur.beans = roundHalf((cur.r.beans / cur.r.cups) * n);
  $("#bean-input").value = cur.beans;
  renderScaled();
}

// 豆の量に合わせて、数字の部分だけを描き直す（入力欄はそのまま）
function renderScaled() {
  const r = cur.r;
  const s = scaled(r, cur.beans);
  $("#cups-chips").innerHTML = [1, 2, 3, 4].map(
    (n) => `<button class="chip ${Math.abs(s.cups - n) < 0.05 ? "active" : ""}" onclick="setCups(${n})">${n}杯分</button>`
  ).join("");

  const ratio = (s.water / s.beans).toFixed(1);
  $("#scaled-area").innerHTML = `
    <div class="amount-grid">
      <div class="amount"><div class="a-label">お湯${r.long ? "・水" : ""}</div><div class="a-val">${s.water}<small>ml</small></div></div>
      ${s.ice ? `<div class="amount"><div class="a-label">氷</div><div class="a-val">${s.ice}<small>g</small></div></div>` : ""}
      <div class="amount"><div class="a-label">温度</div><div class="a-val sm">${esc(r.temp || "—")}</div></div>
      <div class="amount"><div class="a-label">挽き目</div><div class="a-val sm">${esc(r.grind || "—")}</div></div>
      <div class="amount"><div class="a-label">比率</div><div class="a-val sm">1 : ${ratio}</div></div>
    </div>
    ${s.extras.length ? `<div class="extras">${s.extras.map((e) => `<div>＋ ${esc(e.name)} <b>${e.amount ?? ""}${esc(e.unit)}</b></div>`).join("")}</div>` : ""}
    ${!r.long && s.water > 400 && cur.beans > r.beans ? `<p class="warn">量が多いので、落ちきるまでの時間が少し延びることがあります</p>` : ""}`;

  if (r.long) {
    $("#steps-area").innerHTML = `
      <section class="panel">
        <div class="panel-title">手順（目安 ${r.long.hours}時間）</div>
        <ol class="long-steps">${r.long.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      </section>`;
  } else {
    let prev = 0;
    $("#steps-area").innerHTML = `
      <section class="panel">
        <div class="panel-title">注ぎ方</div>
        <table class="steps">
          <tr><th>時間</th><th>内容</th><th>この回</th><th>合計</th></tr>
          ${s.steps.map((st) => {
            const delta = st.to != null ? `+${st.to - prev}` : "";
            const total = st.to != null ? st.to : "";
            if (st.to != null) prev = st.to;
            return `<tr class="${st.end ? "end" : ""}"><td>${fmtTime(st.t)}</td><td>${esc(st.label)}</td><td>${delta}</td><td>${total}</td></tr>`;
          }).join("")}
        </table>
      </section>`;
  }
}

function deleteRecipe(id) {
  if (!confirm("このレシピを削除しますか？")) return;
  customRecipes = customRecipes.filter((r) => r.id !== id);
  favs = favs.filter((x) => x !== id);
  save("mk_custom", customRecipes);
  save("mk_favs", favs);
  show("list");
}

// ===== 音・振動・画面を消さない =====
let audioCtx = null;
function sound(freq, len) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + len);
  } catch (e) { /* 音が出せない環境では何もしない */ }
}
function beepStep() { sound(880, 0.25); if (navigator.vibrate) navigator.vibrate(200); }
function beepTick() { sound(520, 0.08); }

// Wake Lock：画面が自動で消えないようにするブラウザの機能
let wakeLock = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
}
function releaseAwake() { if (wakeLock) { wakeLock.release(); wakeLock = null; } }
document.addEventListener("visibilitychange", () => {
  // アプリを切り替えて戻ってきたら、もう一度お願いし直す
  if (document.visibilityState === "visible" && brew) keepAwake();
});

// ===== 淹れるモード =====
let brew = null; // { r, s, startAt, offset, running, idx, lastTick, timer }

function openBrew() {
  const r = cur.r;
  brew = { r, s: scaled(r, cur.beans), startAt: 0, offset: 0, running: false, idx: -1, lastTick: -1, timer: null };
  keepAwake();
  renderBrewPrep();
  show("brew");
}

function exitBrew() {
  if (brew && brew.timer) clearInterval(brew.timer);
  brew = null;
  releaseAwake();
  show("detail");
}

// スタート前の準備画面
function renderBrewPrep() {
  const { r, s } = brew;
  const memo = lastNextMemo(r.id);
  const end = r.long ? Date.now() + r.long.hours * 3600000 : 0;
  $("#brew").innerHTML = `
    <div class="brew-top"><button class="brew-x" onclick="exitBrew()">✕ やめる</button></div>
    <div class="brew-name">${esc(r.name)}</div>
    <div class="prep-grid">
      <div><span>豆</span><b>${s.beans}g</b><small>${esc(r.grind || "")}</small></div>
      <div><span>${r.long ? "水" : "お湯"}</span><b>${s.water}ml</b><small>${esc(r.temp || "")}</small></div>
      ${s.ice ? `<div><span>氷</span><b>${s.ice}g</b><small>${r.cat === "icedrip" ? "粉の上に" : "サーバーに"}</small></div>` : ""}
    </div>
    ${s.extras.length ? `<div class="prep-extras">${s.extras.map((e) => `＋ ${esc(e.name)} ${e.amount ?? ""}${esc(e.unit)}`).join("<br>")}</div>` : ""}
    ${memo ? `<div class="memo-box dark"><div class="memo-title">📝 前回のメモ</div>${esc(memo.nextMemo)}</div>` : ""}
    ${r.long
      ? `<ol class="long-steps light">${r.long.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
         <label class="hours">待つ時間 <input id="long-hours" type="number" min="0.5" step="0.5" value="${r.long.hours}"> 時間</label>
         <button class="btn-start" onclick="startLong()">準備できた！抽出スタート<small>完成予定 ${fmtClock(end)}</small></button>`
      : `<button class="btn-start" onclick="startBrew()">スタート</button>
         <p class="hint">スケールを0にしてから押してね</p>`}`;
}

function startLong() {
  const { r, s } = brew;
  const hours = Number($("#long-hours").value) || r.long.hours;
  const now = Date.now();
  longBrews.push({ key: now, recipeId: r.id, name: r.name, beans: s.beans, water: s.water, startAt: now, endAt: now + hours * 3600000 });
  save("mk_long", longBrews);
  brew = null;
  releaseAwake();
  show("list");
}

function elapsed() {
  return brew.running ? brew.offset + (Date.now() - brew.startAt) / 1000 : brew.offset;
}
function startBrew() {
  sound(0, 0.01); // iPhoneでは、ボタンを押したときに一度音を鳴らしておかないと後で鳴らない
  brew.startAt = Date.now();
  brew.running = true;
  brew.timer = setInterval(tickBrew, 200);
  tickBrew();
}
function togglePause() {
  if (brew.running) { brew.offset = elapsed(); brew.running = false; }
  else { brew.startAt = Date.now(); brew.running = true; }
  renderBrewRun();
}
function restartBrew() {
  if (!confirm("最初からやり直しますか？")) return;
  clearInterval(brew.timer);
  Object.assign(brew, { offset: 0, running: false, idx: -1, lastTick: -1, timer: null });
  renderBrewPrep();
}

// 0.2秒ごとに呼ばれて、今どの手順かを判定する
function tickBrew() {
  const e = elapsed();
  const steps = brew.s.steps;
  let idx = 0;
  steps.forEach((st, i) => { if (st.t <= e) idx = i; });

  if (idx !== brew.idx) {
    brew.idx = idx;
    beepStep();
    renderBrewRun();
  }
  // 次の手順の3秒前から「ピッ」と知らせる
  const next = steps[idx + 1];
  if (next && brew.running) {
    const left = Math.ceil(next.t - e);
    if (left <= 3 && left >= 1 && left !== brew.lastTick) { brew.lastTick = left; beepTick(); }
  }
  updateBrewClock(e);
}

function updateBrewClock(e) {
  const clock = $("#b-clock");
  if (clock) clock.textContent = fmtTime(e);
  const next = brew.s.steps[brew.idx + 1];
  const left = $("#b-left");
  if (left && next) left.textContent = `あと ${Math.ceil(next.t - e)}秒`;
}

function renderBrewRun() {
  const { r, s, idx } = brew;
  const steps = s.steps;
  const st = steps[idx];
  // この手順までの「合計」と、この回の量を計算
  let prevTo = 0, curTo = 0;
  steps.slice(0, idx + 1).forEach((x, i) => {
    if (x.to != null) { if (i < idx) prevTo = x.to; curTo = x.to; }
  });
  const delta = st.to != null ? st.to - prevTo : null;
  const next = steps[idx + 1];
  const progress = Math.min(100, (curTo / s.water) * 100);

  $("#brew").innerHTML = `
    <div class="brew-top">
      <button class="brew-x" onclick="exitBrew()">✕</button>
      <div class="brew-name small">${esc(r.name)}・豆${s.beans}g</div>
    </div>
    <div id="b-clock" class="b-clock">${fmtTime(elapsed())}</div>
    <div class="b-label ${st.end ? "done" : ""}">${st.end ? "🎉 " : ""}${esc(st.label)}</div>

    ${st.end
      ? `${s.extras.length ? `<div class="prep-extras">${s.extras.map((e) => `＋ ${esc(e.name)} ${e.amount ?? ""}${esc(e.unit)}`).join("<br>")}</div>` : ""}
         <button class="btn-start" onclick="brewToRecord()">記録する</button>`
      : `<div class="pour-grid">
           <div class="pour"><div class="p-label">この回</div><div class="p-val">${delta != null ? "+" + delta : "—"}<small>ml</small></div></div>
           <div class="pour main"><div class="p-label">合計</div><div class="p-val">${curTo}<small>ml まで</small></div></div>
         </div>`}

    <div class="bar"><div style="width:${progress}%"></div></div>
    <div class="bar-label">${curTo} / ${s.water} ml</div>

    ${next ? `<div class="b-next">次 ${fmtTime(next.t)}：${esc(next.label)}${next.to != null ? `（合計${next.to}mlまで）` : ""}<br><b id="b-left"></b></div>` : ""}

    <div class="b-steps">${steps.map((x, i) =>
      `<div class="${i === idx ? "now" : i < idx ? "past" : ""}"><span>${fmtTime(x.t)}</span><span>${esc(x.label)}</span><span>${x.to != null ? x.to + "ml" : ""}</span></div>`
    ).join("")}</div>

    <div class="b-controls">
      <button onclick="togglePause()">${brew.running ? "⏸ 一時停止" : "▶ 再開"}</button>
      <button onclick="restartBrew()">↺ 最初から</button>
    </div>`;
  updateBrewClock(elapsed());
}

function brewToRecord() {
  const { r, s } = brew;
  clearInterval(brew.timer);
  brew = null;
  releaseAwake();
  openRecord({ recipeId: r.id, name: r.name, beans: s.beans, water: s.water });
}

// ===== 記録を書く =====
let draft = null;
const TASTES = [["acid", "酸味"], ["bitter", "苦味"], ["sweet", "甘み"], ["body", "濃さ"]];

function openRecord(base) {
  draft = { ...base, beanName: "", stars: 0, acid: 0, bitter: 0, sweet: 0, body: 0, comment: "", nextMemo: "" };
  renderRecordForm();
  show("record");
}

function renderRecordForm() {
  const beanNames = [...new Set(records.map((x) => x.beanName).filter(Boolean))];
  $("#record-form").innerHTML = `
    <h2 class="page-title">今日の1杯</h2>
    <div class="card-meta center">${esc(draft.name)}・豆${draft.beans}g・お湯${draft.water}ml</div>

    <label class="field">豆の名前
      <input id="f-bean" list="bean-names" value="${esc(draft.beanName)}" placeholder="例：エチオピア 浅煎り">
      <datalist id="bean-names">${beanNames.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    </label>

    <div class="field">総合
      <div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= draft.stars ? "on" : ""}" onclick="setDraft('stars', ${n})">★</button>`).join("")}</div>
    </div>

    ${TASTES.map(([key, label]) => `
      <div class="field taste">${label}
        <div class="seg">${[1, 2, 3, 4, 5].map((n) => `<button class="${draft[key] === n ? "on" : ""}" onclick="setDraft('${key}', ${n})">${n}</button>`).join("")}</div>
      </div>`).join("")}

    <label class="field">感想
      <textarea id="f-comment" rows="2" placeholder="例：すっきりして飲みやすい">${esc(draft.comment)}</textarea>
    </label>
    <label class="field">次回へのメモ
      <textarea id="f-next" rows="2" placeholder="例：次は少し細かく挽く">${esc(draft.nextMemo)}</textarea>
    </label>

    <button class="btn-main wide" onclick="saveRecord()">保存する</button>`;
}
function readDraftInputs() {
  draft.beanName = $("#f-bean").value.trim();
  draft.comment = $("#f-comment").value.trim();
  draft.nextMemo = $("#f-next").value.trim();
}
function setDraft(key, n) {
  readDraftInputs(); // 描き直す前に、入力中の文字を取っておく
  draft[key] = draft[key] === n ? 0 : n;
  renderRecordForm();
}
function saveRecord() {
  readDraftInputs();
  records.unshift({ ...draft, id: Date.now(), date: Date.now() });
  save("mk_records", records);
  show("records");
}

// ===== 記録一覧 =====
function renderRecords() {
  if (records.length === 0) {
    $("#records").innerHTML = `<p class="empty">まだ記録がありません。<br>淹れ終わったら「記録する」から残せます。</p>`;
    return;
  }
  $("#records").innerHTML = records.map((x) => `
    <div class="rec">
      <div class="rec-head">
        <span class="rec-date">${fmtClock(x.date)}</span>
        <span class="rec-stars">${"★".repeat(x.stars)}<span class="off">${"★".repeat(5 - x.stars)}</span></span>
      </div>
      <div class="rec-name">${esc(x.name)}</div>
      <div class="card-meta">${x.beanName ? esc(x.beanName) + "・" : ""}豆${x.beans}g・お湯${x.water}ml</div>
      <div class="rec-tastes">${TASTES.filter(([k]) => x[k]).map(([k, label]) =>
        `<span>${label}<em><i style="width:${x[k] * 20}%"></i></em></span>`).join("")}</div>
      ${x.comment ? `<p>${esc(x.comment)}</p>` : ""}
      ${x.nextMemo ? `<p class="rec-next">📝 次回：${esc(x.nextMemo)}</p>` : ""}
      <div class="row-btns">
        ${findRecipe(x.recipeId) ? `<button class="btn-sub small" onclick="openDetail('${x.recipeId}', ${x.beans})">同じ分量で淹れる</button>` : ""}
        <button class="btn-sub small danger" onclick="deleteRecord(${x.id})">削除</button>
      </div>
    </div>`).join("");
}
function deleteRecord(id) {
  if (!confirm("この記録を削除しますか？")) return;
  records = records.filter((x) => x.id !== id);
  save("mk_records", records);
  renderRecords();
}

// ===== 自作レシピの追加・編集 =====
let edit = null; // 編集中のレシピ（下書き）

function openEdit(id, isCopy) {
  if (id) {
    const r = JSON.parse(JSON.stringify(findRecipe(id))); // 元を壊さないようにコピー
    if (isCopy) { r.id = null; r.name += "（自分用）"; r.by = "自作"; }
    edit = r;
  } else {
    edit = { id: null, name: "", cat: "hot", by: "自作", beans: 15, water: 225, ice: 0, temp: "90℃", grind: "中細挽き", cups: 1, note: "",
      steps: [{ t: 0, to: 30, label: "蒸らし" }, { t: 30, to: 225, label: "注ぐ" }, { t: 150, label: "落ちきったら完成", end: true }] };
  }
  renderEditForm();
  show("edit");
}

function renderEditForm() {
  const e = edit;
  const isLong = LONG_CATS.includes(e.cat);
  const endStep = (e.steps || []).find((s) => s.end);
  const rows = (e.steps || []).filter((s) => !s.end);
  $("#edit-form").innerHTML = `
    <h2 class="page-title">${e.id ? "レシピを編集" : "レシピを追加"}</h2>
    <label class="field">名前<input id="e-name" value="${esc(e.name)}"></label>
    <label class="field">種類
      <select id="e-cat" onchange="readEdit(); renderEditForm()">
        ${CATS.filter((c) => CAT_ICON[c.id]).map((c) => `<option value="${c.id}" ${c.id === e.cat ? "selected" : ""}>${c.label}</option>`).join("")}
      </select>
    </label>
    <div class="grid2">
      <label class="field">豆(g)<input id="e-beans" type="number" step="0.5" value="${e.beans}"></label>
      <label class="field">${isLong ? "水" : "お湯"}(ml)<input id="e-water" type="number" value="${e.water}"></label>
      <label class="field">氷(g)<input id="e-ice" type="number" value="${e.ice || 0}"></label>
      <label class="field">何杯分<input id="e-cups" type="number" step="0.5" value="${e.cups}"></label>
      <label class="field">温度<input id="e-temp" value="${esc(e.temp)}"></label>
      <label class="field">挽き目<input id="e-grind" value="${esc(e.grind)}"></label>
    </div>

    ${isLong
      ? `<label class="field">待つ時間(時間)<input id="e-hours" type="number" step="0.5" value="${e.long ? e.long.hours : 10}"></label>
         <div class="field">手順（1行に1つ）<textarea id="e-longsteps" rows="4">${esc(e.long ? e.long.steps.join("\n") : "")}</textarea></div>`
      : `<div class="field">注ぎ方（時間・その時点の合計ml・内容）</div>
         <div id="e-rows">${rows.map((s, i) => `
           <div class="e-row">
             <input class="e-t" value="${fmtTime(s.t)}" placeholder="0:30">
             <input class="e-to" type="number" value="${s.to ?? ""}" placeholder="ml">
             <input class="e-label" value="${esc(s.label)}" placeholder="内容">
             <button class="pm" onclick="removeRow(${i})">×</button>
           </div>`).join("")}</div>
         <button class="btn-sub small" onclick="addRow()">＋ 手順を追加</button>
         <label class="field">完成の時間<input id="e-end" value="${fmtTime(endStep ? endStep.t : 150)}" placeholder="2:30"></label>`}

    <label class="field">メモ<textarea id="e-note" rows="2">${esc(e.note)}</textarea></label>
    <button class="btn-main wide" onclick="saveEdit()">保存する</button>`;
}

// 入力欄の中身を edit に取り込む
function readEdit() {
  const e = edit;
  e.name = $("#e-name").value.trim();
  e.cat = $("#e-cat").value;
  e.beans = Number($("#e-beans").value) || 1;
  e.water = Number($("#e-water").value) || 0;
  e.ice = Number($("#e-ice").value) || 0;
  e.cups = Number($("#e-cups").value) || 1;
  e.temp = $("#e-temp").value.trim();
  e.grind = $("#e-grind").value.trim();
  e.note = $("#e-note").value.trim();
  if ($("#e-hours")) {
    e.long = { hours: Number($("#e-hours").value) || 1, steps: $("#e-longsteps").value.split("\n").map((s) => s.trim()).filter(Boolean) };
  }
  if ($("#e-rows")) {
    const steps = [...document.querySelectorAll(".e-row")].map((row) => ({
      t: parseTime(row.querySelector(".e-t").value),
      to: row.querySelector(".e-to").value === "" ? null : Number(row.querySelector(".e-to").value),
      label: row.querySelector(".e-label").value.trim(),
    }));
    steps.sort((a, b) => a.t - b.t);
    steps.push({ t: parseTime($("#e-end").value), label: "完成", end: true });
    e.steps = steps;
  }
}
function addRow() {
  readEdit();
  const rows = edit.steps.filter((s) => !s.end);
  const last = rows[rows.length - 1];
  edit.steps.splice(rows.length, 0, { t: last ? last.t + 30 : 0, to: null, label: "" });
  renderEditForm();
}
function removeRow(i) {
  readEdit();
  edit.steps.splice(i, 1);
  renderEditForm();
}
function saveEdit() {
  readEdit();
  const e = edit;
  if (!e.name) { alert("名前を入れてください"); return; }
  if (LONG_CATS.includes(e.cat)) delete e.steps; else delete e.long;
  e.custom = true;
  if (e.id) {
    customRecipes = customRecipes.map((r) => (r.id === e.id ? e : r));
  } else {
    e.id = "c" + Date.now();
    customRecipes.unshift(e);
  }
  save("mk_custom", customRecipes);
  openDetail(e.id);
}

// ===== スタート =====
show("list");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
