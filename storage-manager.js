/* ============================================================
   StorageManager
   Единственный модуль, который трогает localStorage напрямую.
   Отвечает за формат хранения, версию схемы и миграцию старых
   данных. DataManager обращается сюда за загрузкой/сохранением,
   но сам ничего не знает про localStorage.

   Схема v1 (старая):
     { version:1, exercises:[...], sessions:{ "ГГГГ-ММ-ДД":[{exercise,weight,reps,sets}] } }
   Схема v2 (текущая):
     { version:2, exercises:[...], sessions:{ "ГГГГ-ММ-ДД": {
         exercises:[{id,exercise,sets:[{weight,reps}, ...]}],
         cardio:[{id,type,durationMin,distanceKm,note,metrics:{}}]
     } } }
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  const STORAGE_KEY = "workoutLog";
  const DRAFT_KEY = "workoutLogDraft";
  const BACKUP_KEY = "workoutLog_backup_pre_v2";
  const CURRENT_VERSION = 2;

  /* ---------- нормализация одной записи ---------- */
  function normalizeExerciseEntry(e) {
    const sets = Array.isArray(e && e.sets) ? e.sets.map(s => {
      const weight = Utils.toNum(s && s.weight);
      const reps = Utils.toInt(s && s.reps, 0);
      return { weight: Number.isNaN(weight) ? 0 : weight, reps: reps < 0 ? 0 : reps };
    }) : [];
    return {
      id: (e && e.id) || Utils.generateId("ex"),
      exercise: String((e && e.exercise) || "").trim(),
      sets
    };
  }

  function normalizeCardioEntry(c) {
    return {
      id: (c && c.id) || Utils.generateId("cardio"),
      type: String((c && c.type) || "other"),
      durationMin: Math.max(0, Utils.toNum(c && c.durationMin) || 0),
      distanceKm: Math.max(0, Utils.toNum(c && c.distanceKm) || 0),
      note: String((c && c.note) || ""),
      // резерв под будущие метрики (калории, пульс, темп, скорость) —
      // не заполняется сейчас, но поле уже существует в схеме
      metrics: (c && typeof c.metrics === "object" && c.metrics) || {}
    };
  }

  // Превращает плоский список записей v1 в сгруппированные упражнения v2:
  // одинаковые упражнения (без учёта регистра) объединяются в один объект,
  // а поле "sets" (количество одинаковых подходов) разворачивается в
  // отдельные подходы внутри массива sets.
  function groupFlatSetsIntoExercises(flatArray) {
    const order = [];
    const byKey = new Map();
    (flatArray || []).forEach(rec => {
      const name = String((rec && rec.exercise) || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      let entry = byKey.get(key);
      if (!entry) {
        entry = { id: Utils.generateId("ex"), exercise: name, sets: [] };
        byKey.set(key, entry);
        order.push(entry);
      }
      const weight = Utils.toNum(rec.weight);
      const reps = Utils.toInt(rec.reps, 0);
      const count = Math.max(1, Utils.toInt(rec.sets, 1));
      for (let i = 0; i < count; i++) {
        entry.sets.push({ weight: Number.isNaN(weight) ? 0 : weight, reps: reps < 0 ? 0 : reps });
      }
    });
    return order;
  }

  // Приводит значение sessions[date] (в любой из схем) к каноническому
  // виду v2: { exercises: ExerciseEntry[], cardio: CardioSession[] }.
  // Идемпотентна — безопасно вызывать повторно даже на уже нормальных данных,
  // это самовосстанавливающийся шаг, а не разовая миграция.
  function normalizeSessionShape(value) {
    if (Array.isArray(value)) {
      return { exercises: groupFlatSetsIntoExercises(value), cardio: [] };
    }
    if (value && typeof value === "object") {
      const exercises = Array.isArray(value.exercises) ? value.exercises.map(normalizeExerciseEntry).filter(e => e.exercise) : [];
      const cardio = Array.isArray(value.cardio) ? value.cardio.map(normalizeCardioEntry) : [];
      return { exercises, cardio };
    }
    return { exercises: [], cardio: [] };
  }

  function migrateStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const exercises = Array.isArray(source.exercises)
      ? Utils.uniq(source.exercises.filter(Boolean).map(String))
      : [];
    const sessions = {};
    const rawSessions = (source.sessions && typeof source.sessions === "object") ? source.sessions : {};
    Object.keys(rawSessions).forEach(date => {
      sessions[date] = normalizeSessionShape(rawSessions[date]);
    });
    return { version: CURRENT_VERSION, exercises, sessions };
  }

  function detectsOldShape(parsed) {
    if (!parsed || typeof parsed !== "object") return false;
    if (!parsed.version || parsed.version < CURRENT_VERSION) return true;
    const sessions = parsed.sessions || {};
    return Object.keys(sessions).some(d => Array.isArray(sessions[d]));
  }

  /* ---------- основное хранилище ---------- */
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: CURRENT_VERSION, exercises: [], sessions: {} };
      const parsed = JSON.parse(raw);
      const isOld = detectsOldShape(parsed);
      const store = migrateStore(parsed);
      if (isOld) {
        try {
          if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, raw);
        } catch (e) { /* бэкап не критичен для работы */ }
        saveStore(store);
      }
      return store;
    } catch (e) {
      return { version: CURRENT_VERSION, exercises: [], sessions: {} };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CURRENT_VERSION,
      exercises: store.exercises,
      sessions: store.sessions
    }));
  }

  /* ---------- автосохранение черновика ---------- */
  function saveDraftAutosave(payload) {
    try {
      const draft = payload && payload.draft;
      const hasContent = draft && ((draft.exercises && draft.exercises.length) || (draft.cardio && draft.cardio.length));
      if (!hasContent) { localStorage.removeItem(DRAFT_KEY); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch (e) { /* автосохранение — best effort */ }
  }
  function clearDraftAutosave() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function loadDraftAutosave() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.draft) parsed.draft = normalizeSessionShape(parsed.draft);
      return parsed;
    } catch (e) { return null; }
  }

  /* ---------- клонирование (для повтора/редактирования/импорта) ---------- */
  function cloneEntry(e) {
    return { id: e.id || Utils.generateId("ex"), exercise: e.exercise, sets: e.sets.map(s => ({ weight: s.weight, reps: s.reps })) };
  }
  function cloneCardio(c) {
    return { id: c.id || Utils.generateId("cardio"), type: c.type, durationMin: c.durationMin, distanceKm: c.distanceKm, note: c.note || "", metrics: { ...(c.metrics || {}) } };
  }
  function cloneSession(s) {
    return { exercises: (s.exercises || []).map(cloneEntry), cardio: (s.cardio || []).map(cloneCardio) };
  }

  /* ---------- импорт: слияние без дублей ---------- */
  function setKey(s) { return `${s.weight}|${s.reps}`; }
  function setsArraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((s, i) => s.weight === b[i].weight && s.reps === b[i].reps);
  }
  function appendNonDuplicateSets(targetSets, incomingSets) {
    const counts = new Map();
    targetSets.forEach(s => { const k = setKey(s); counts.set(k, (counts.get(k) || 0) + 1); });
    incomingSets.forEach(s => {
      const k = setKey(s);
      const c = counts.get(k) || 0;
      if (c > 0) { counts.set(k, c - 1); return; } // такой подход уже есть — считаем дублем
      targetSets.push({ weight: s.weight, reps: s.reps });
    });
  }
  function cardioEqual(a, b) {
    return a.type === b.type && a.durationMin === b.durationMin && a.distanceKm === b.distanceKm && (a.note || "") === (b.note || "");
  }
  function mergeSessionsForDate(existing, incoming) {
    const exercises = existing.exercises.map(cloneEntry);
    incoming.exercises.forEach(incEntry => {
      const match = exercises.find(e => Utils.sameName(e.exercise, incEntry.exercise));
      if (!match) { exercises.push(cloneEntry(incEntry)); return; }
      if (!setsArraysEqual(match.sets, incEntry.sets)) appendNonDuplicateSets(match.sets, incEntry.sets);
    });
    const cardio = existing.cardio.map(cloneCardio);
    incoming.cardio.forEach(incC => {
      if (!cardio.some(c => cardioEqual(c, incC))) cardio.push(cloneCardio(incC));
    });
    return { exercises, cardio };
  }

  function mergeImportedStore(current, incomingRaw) {
    const incoming = migrateStore(incomingRaw);
    const mergedExercises = Utils.uniq(current.exercises.concat(incoming.exercises)).sort((a, b) => a.localeCompare(b, "ru"));
    const mergedSessions = {};
    Object.keys(current.sessions).forEach(date => { mergedSessions[date] = cloneSession(current.sessions[date]); });
    let importedDates = 0;
    Object.keys(incoming.sessions).forEach(date => {
      const incSession = incoming.sessions[date];
      importedDates += 1;
      mergedSessions[date] = mergedSessions[date] ? mergeSessionsForDate(mergedSessions[date], incSession) : cloneSession(incSession);
    });
    return { store: { version: CURRENT_VERSION, exercises: mergedExercises, sessions: mergedSessions }, importedDates };
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error("read-failed"));
      reader.readAsText(file);
    });
  }

  function triggerExportDownload(store) {
    const data = { version: CURRENT_VERSION, exportedAt: new Date().toISOString(), exercises: store.exercises, sessions: store.sessions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `workout-log-${Utils.todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    clearDraftAutosave();
  }

  App.StorageManager = {
    CURRENT_VERSION,
    loadStore, saveStore,
    loadDraftAutosave, saveDraftAutosave, clearDraftAutosave,
    migrateStore, normalizeSessionShape,
    cloneEntry, cloneCardio, cloneSession,
    mergeImportedStore, readFileAsText, triggerExportDownload,
    clearAllData
  };
})(window.App = window.App || {});
