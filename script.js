/* ========== STORAGE LAYER ========== */
const LS_KEY = "fitness_tracker_entries_v1";
const GOAL_KEY = "fitness_tracker_goals_v1";

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? []; }
  catch { return []; }
}
function saveEntries(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
function loadGoals() {
  const defaults = { steps: 8000, calories: 500, workouts: 1 };
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(GOAL_KEY)) ?? {}) }; }
  catch { return defaults; }
}
function saveGoals(goals) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goals));
}

/* ========== UTILITIES ========== */
const $ = (sel) => document.querySelector(sel);
const todayISO = () => new Date().toISOString().slice(0,10);
const fmtNum = (n) => Number(n || 0).toLocaleString();

/* Group entries by date */
function aggregate(entries) {
  const map = {};
  for (const e of entries) {
    const d = e.date;
    map[d] ||= { steps:0, calories:0, workouts:0 };
    if (e.type === "steps") map[d].steps += Number(e.value)||0;
    else if (e.type === "calories") map[d].calories += Number(e.value)||0;
    else if (e.type === "workout") map[d].workouts += 1; // value = minutes, but count workout qty
  }
  return map;
}

/* Get ISO dates for last 7 days (Mon..Sun feel) ending today */
function last7() {
  const out = [];
  for (let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}

/* ========== STATE ========== */
let entries = loadEntries();
let goals = loadGoals();

/* ========== DOM HOOKUP ========== */
const dateEl = $("#date");
const typeEl = $("#type");
const valueEl = $("#value");
const notesEl = $("#notes");
const formEl = $("#logForm");

const todayStepsEl = $("#todaySteps");
const todayCaloriesEl = $("#todayCalories");
const todayWorkoutsEl = $("#todayWorkouts");
const stepsBar = $("#stepsBar");
const calBar = $("#calBar");
const woBar = $("#woBar");
const stepsGoalText = $("#stepsGoalText");
const calGoalText = $("#calGoalText");
const woGoalText = $("#woGoalText");

const weekChart = $("#weekChart");
const wSteps = $("#wSteps");
const wCalories = $("#wCalories");
const wWorkouts = $("#wWorkouts");

const logTable = $("#logTable");

const clearAllBtn = $("#clearAll");
const clearTodayBtn = $("#clearToday");
const exportBtn = $("#exportBtn");
const importBtn = $("#importBtn");
const importFile = $("#importFile");

const settingsDlg = $("#settingsDlg");
const openSettings = $("#openSettings");
const saveGoalsBtn = $("#saveGoals");
const gSteps = $("#goalSteps");
const gCal = $("#goalCalories");
const gWo = $("#goalWorkouts");

/* ========== INIT ========== */
function init() {
  // default date = today
  dateEl.value = todayISO();
  // set goal fields
  gSteps.value = goals.steps;
  gCal.value = goals.calories;
  gWo.value = goals.workouts;
  render();
}
document.addEventListener("DOMContentLoaded", init);

/* ========== RENDER ========== */
function render() {
  // Update goals text
  stepsGoalText.textContent = `Goal: ${fmtNum(goals.steps)}`;
  calGoalText.textContent   = `Goal: ${fmtNum(goals.calories)} kcal`;
  woGoalText.textContent    = `Goal: ${fmtNum(goals.workouts)}`;

  renderTable();
  renderDashboard();
  renderWeeklyChart();
}

function renderTable() {
  logTable.innerHTML = "";
  const rows = [...entries].sort((a,b)=> (a.date < b.date ? 1 : -1));
  for (const e of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date}</td>
      <td class="cap">${e.type}</td>
      <td>${fmtNum(e.value)}${e.type==="calories"?" kcal": e.type==="workout"?" min":""}</td>
      <td>${e.notes || ""}</td>
      <td>
        <button class="btn ghost sm" data-edit="${e.id}">Edit</button>
        <button class="btn danger sm" data-del="${e.id}">Delete</button>
      </td>
    `;
    logTable.appendChild(tr);
  }

  // wire actions
  logTable.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      entries = entries.filter(x => x.id !== id);
      saveEntries(entries);
      render();
    });
  });
  logTable.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const e = entries.find(x => x.id === id);
      if (!e) return;
      dateEl.value = e.date;
      typeEl.value = e.type;
      valueEl.value = e.value;
      notesEl.value = e.notes || "";
      // mark id on form for update
      formEl.setAttribute("data-editing", id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function renderDashboard() {
  const byDate = aggregate(entries);
  const t = todayISO();
  const today = byDate[t] || { steps:0, calories:0, workouts:0 };

  todayStepsEl.textContent    = fmtNum(today.steps);
  todayCaloriesEl.textContent = fmtNum(today.calories);
  todayWorkoutsEl.textContent = fmtNum(today.workouts);

  stepsBar.style.width = `${Math.min(100, (today.steps/goals.steps)*100 || 0)}%`;
  calBar.style.width   = `${Math.min(100, (today.calories/goals.calories)*100 || 0)}%`;
  woBar.style.width    = `${Math.min(100, (today.workouts/goals.workouts)*100 || 0)}%`;
}

function renderWeeklyChart() {
  const ctx = weekChart.getContext("2d");
  // clear
  ctx.clearRect(0,0,weekChart.width, weekChart.height);

  const dates = last7();
  const agg = aggregate(entries);

  const steps = dates.map(d => agg[d]?.steps || 0);
  const cals  = dates.map(d => agg[d]?.calories || 0);
  const works = dates.map(d => agg[d]?.workouts || 0);

  // totals
  const tSteps = steps.reduce((a,b)=>a+b,0);
  const tCals  = cals.reduce((a,b)=>a+b,0);
  const tWorks = works.reduce((a,b)=>a+b,0);
  wSteps.textContent = fmtNum(tSteps);
  wCalories.textContent = fmtNum(tCals);
  wWorkouts.textContent = fmtNum(tWorks);

  // Draw axes
  const W = weekChart.width, H = weekChart.height;
  const P = 40; // padding
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#44506b";
  ctx.beginPath();
  ctx.moveTo(P, P/2);
  ctx.lineTo(P, H-P);
  ctx.lineTo(W-P/2, H-P);
  ctx.stroke();

  // compute scales
  const maxY = Math.max(100, ...steps, ...cals, ...works);
  const yScale = (H - P*1.5) / maxY;

  // helper to plot a line
  function line(data, color) {
    const dx = (W - P*1.5) / (data.length - 1 || 1);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    data.forEach((v,i)=>{
      const x = P + i*dx;
      const y = H - P - v*yScale;
      if (i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
      // points
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x,y,3,0,Math.PI*2);
      ctx.fill();
    });
    ctx.stroke();
  }

  // three series (use default canvas colors that look distinct)
  line(steps,  "#22c55e");   // green-ish
  line(cals,   "#60a5fa");   // blue-ish
  line(works,  "#f59e0b");   // amber-ish

  // x labels (dates)
  ctx.fillStyle = "#9aa6c3";
  ctx.font = "12px system-ui, sans-serif";
  const dx = (W - P*1.5) / (dates.length - 1 || 1);
  dates.forEach((d,i)=>{
    const x = P + i*dx;
    const label = d.slice(5); // MM-DD
    ctx.fillText(label, x-14, H-P+16);
  });
}

/* ========== EVENTS ========== */
formEl.addEventListener("submit", (e)=>{
  e.preventDefault();

  const date = dateEl.value || todayISO();
  const type = typeEl.value;
  const value = Number(valueEl.value);
  const notes = notesEl.value.trim();

  if (!(value >= 0)) return alert("Please enter a valid non-negative number.");

  const editingId = formEl.getAttribute("data-editing");
  if (editingId) {
    const idx = entries.findIndex(x=>x.id===editingId);
    if (idx>=0) entries[idx] = { ...entries[idx], date, type, value, notes };
    formEl.removeAttribute("data-editing");
  } else {
    entries.push({ id: crypto.randomUUID(), date, type, value, notes });
  }

  saveEntries(entries);
  valueEl.value = "";
  notesEl.value = "";
  render();
});

clearAllBtn.addEventListener("click", ()=>{
  if (confirm("This will delete ALL your fitness data. Continue?")) {
    entries = [];
    saveEntries(entries);
    render();
  }
});

clearTodayBtn.addEventListener("click", ()=>{
  const t = todayISO();
  const before = entries.length;
  entries = entries.filter(e => e.date !== t);
  if (entries.length !== before) {
    saveEntries(entries);
    render();
  } else {
    alert("No entries found for today.");
  }
});

exportBtn.addEventListener("click", ()=>{
  const data = { entries, goals, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "fitness-tracker-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", ()=> importFile.click());
importFile.addEventListener("change", async ()=>{
  const file = importFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    if (!Array.isArray(obj.entries)) throw new Error("Invalid file");
    entries = obj.entries;
    goals = { ...loadGoals(), ...(obj.goals||{}) };
    saveEntries(entries);
    saveGoals(goals);
    render();
    alert("Import successful!");
  } catch {
    alert("Failed to import file.");
  } finally {
    importFile.value = "";
  }
});

/* SETTINGS (Goals) */
openSettings.addEventListener("click", ()=> settingsDlg.showModal());
saveGoalsBtn.addEventListener("click", ()=>{
  const s = Number(gSteps.value)||0;
  const c = Number(gCal.value)||0;
  const w = Number(gWo.value)||0;
  goals = { steps:s, calories:c, workouts:w };
  saveGoals(goals);
  render();
  settingsDlg.close();
});
