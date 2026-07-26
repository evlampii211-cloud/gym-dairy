/* ============================================================
   DataManager
   Единственный держатель состояния приложения (state). UI-слой
   никогда не трогает StorageManager / ExerciseManager / WorkoutManager
   / CardioManager напрямую для изменения данных — только через
   методы DataManager. Это даёт одну точку, где происходит и
   мутация state, и её сохранение, и не даёт разным частям UI
   разойтись в том, как именно применяется изменение.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;
  const Storage = App.StorageManager;
  const ExerciseM = App.ExerciseManager;
  const WorkoutM = App.WorkoutManager;
  const CardioM = App.CardioManager;

  function emptySession() { return { exercises: [], cardio: [] }; }

  const state = {
    exercises: [],
    sessions: {},
    draft: emptySession(),
    currentDate: "",
    editingDate: null
  };

  function persist() {
    Storage.saveStore({ exercises: state.exercises, sessions: state.sessions });
  }
  function persistDraft() {
    Storage.saveDraftAutosave({ draft: state.draft, currentDate: state.currentDate, editingDate: state.editingDate });
  }
  function clearDraftAutosave() { Storage.clearDraftAutosave(); }

  /* ---------- инициализация ---------- */
  function init() {
    const store = Storage.loadStore();
    state.exercises = store.exercises;
    state.sessions = store.sessions;
    state.currentDate = Utils.todayISO();

    const autosaved = Storage.loadDraftAutosave();
    const hasAutosaved = autosaved && autosaved.draft &&
      ((autosaved.draft.exercises && autosaved.draft.exercises.length) || (autosaved.draft.cardio && autosaved.draft.cardio.length));
    if (hasAutosaved) {
      state.draft = autosaved.draft;
      state.currentDate = autosaved.currentDate || state.currentDate;
      state.editingDate = autosaved.editingDate || null;
    }
    return { restoredDraft: !!hasAutosaved };
  }

  function getState() { return state; }

  /* ---------- дата ---------- */
  function setCurrentDate(date) { state.currentDate = date || Utils.todayISO(); persistDraft(); }
  function setToday() { state.currentDate = Utils.todayISO(); persistDraft(); }

  /* ---------- справочник упражнений ---------- */
  function registerExercise(name) {
    const res = ExerciseM.register(state.exercises, name);
    if (res.changed) { state.exercises = res.list; persist(); }
    return res.changed;
  }
  function renameExercise(oldName, newName) {
    const res = ExerciseM.rename(state.exercises, oldName, newName);
    if (!res.ok) return res;
    state.exercises = res.list;
    state.sessions = ExerciseM.renameInSessions(state.sessions, oldName, newName);
    state.draft = ExerciseM.renameInSession(state.draft, oldName, newName);
    persist(); persistDraft();
    return res;
  }
  function deleteExerciseFromList(name) {
    state.exercises = ExerciseM.remove(state.exercises, name);
    persist();
  }

  /* ---------- черновик: упражнения ---------- */
  function addSetToDraft({ exercise, weight, reps, count }) {
    state.draft.exercises = WorkoutM.addSet(state.draft.exercises, { exercise, weight, reps, count });
    registerExercise(exercise);
    persistDraft();
  }
  function removeSetFromDraft(entryId, setIndex) {
    state.draft.exercises = WorkoutM.removeSet(state.draft.exercises, entryId, setIndex);
    persistDraft();
  }
  function updateSetInDraft(entryId, setIndex, patch) {
    state.draft.exercises = WorkoutM.updateSet(state.draft.exercises, entryId, setIndex, patch);
    persistDraft();
  }
  function addEmptySetToDraftEntry(entryId) {
    state.draft.exercises = WorkoutM.addEmptySet(state.draft.exercises, entryId);
    persistDraft();
  }
  function removeEntryFromDraft(entryId) {
    state.draft.exercises = WorkoutM.removeEntry(state.draft.exercises, entryId);
    persistDraft();
  }
  function renameEntryInDraft(entryId, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    let next = WorkoutM.renameEntry(state.draft.exercises, entryId, trimmed);
    // если переименование столкнуло два упражнения с одним именем — объединяем подходы
    const renamedEntry = next.find(e => e.id === entryId);
    const duplicate = next.find(e => e.id !== entryId && Utils.sameName(e.exercise, trimmed));
    if (renamedEntry && duplicate) {
      duplicate.sets = duplicate.sets.concat(renamedEntry.sets);
      next = next.filter(e => e.id !== entryId);
    }
    state.draft.exercises = next;
    registerExercise(trimmed);
    persistDraft();
  }

  /* ---------- черновик: кардио ---------- */
  function addCardioToDraft(payload) {
    state.draft.cardio = CardioM.addSession(state.draft.cardio, payload);
    persistDraft();
  }
  function removeCardioFromDraft(id) {
    state.draft.cardio = CardioM.removeSession(state.draft.cardio, id);
    persistDraft();
  }
  function updateCardioInDraft(id, patch) {
    state.draft.cardio = CardioM.updateSession(state.draft.cardio, id, patch);
    persistDraft();
  }

  /* ---------- жизненный цикл черновика/сессии ---------- */
  function draftIsEmpty() {
    return !state.draft.exercises.length && !state.draft.cardio.length;
  }

  function clearDraft() {
    state.draft = emptySession();
    state.editingDate = null;
    clearDraftAutosave();
  }

  function saveSession() {
    if (!state.currentDate) return { ok: false, reason: "no-date" };
    if (draftIsEmpty()) return { ok: false, reason: "empty" };

    let savedDate;
    if (state.editingDate) {
      savedDate = state.editingDate;
      state.sessions[savedDate] = { exercises: WorkoutM.cloneEntries(state.draft.exercises), cardio: state.draft.cardio.map(c => ({ ...c })) };
      state.editingDate = null;
    } else {
      savedDate = state.currentDate;
      const existing = state.sessions[savedDate] || emptySession();
      state.sessions[savedDate] = {
        exercises: WorkoutM.mergeAppend(existing.exercises, state.draft.exercises),
        cardio: existing.cardio.concat(state.draft.cardio.map(c => ({ ...c })))
      };
    }
    state.draft = emptySession();
    persist();
    clearDraftAutosave();
    return { ok: true, date: savedDate };
  }

  function editSession(date) {
    const session = state.sessions[date];
    if (!session || (!session.exercises.length && !session.cardio.length)) return false;
    state.editingDate = date;
    state.draft = Storage.cloneSession(session);
    state.currentDate = date;
    persistDraft();
    return true;
  }

  function cancelEdit() {
    state.editingDate = null;
    state.draft = emptySession();
    clearDraftAutosave();
  }

  function deleteSession() {
    if (!state.editingDate) return null;
    const date = state.editingDate;
    delete state.sessions[date];
    state.editingDate = null;
    state.draft = emptySession();
    persist();
    clearDraftAutosave();
    return date;
  }

  function repeatSessionIntoDraft(date) {
    const session = state.sessions[date];
    if (!session || (!session.exercises.length && !session.cardio.length)) return null;
    state.editingDate = null;
    state.draft = Storage.cloneSession(session);
    persistDraft();
    return { exercises: session.exercises.length, cardio: session.cardio.length };
  }

  /* ---------- импорт / экспорт / очистка ---------- */
  function exportData() {
    Storage.triggerExportDownload({ exercises: state.exercises, sessions: state.sessions });
  }

  async function importFromFile(file) {
    try {
      const text = await Storage.readFileAsText(file);
      const parsed = JSON.parse(text);
      const { store, importedDates } = Storage.mergeImportedStore({ exercises: state.exercises, sessions: state.sessions }, parsed);
      state.exercises = store.exercises;
      state.sessions = store.sessions;
      persist();
      return { ok: true, importedDates };
    } catch (e) {
      return { ok: false, reason: "parse" };
    }
  }

  function clearAllData() {
    Storage.clearAllData();
    state.exercises = [];
    state.sessions = {};
    state.draft = emptySession();
    state.editingDate = null;
  }

  /* ---------- производные данные только для чтения ---------- */
  function getRecords() { return App.RecordsManager.computeRecords(state.sessions); }
  function getHeaderSummary() { return App.StatisticsManager.headerSummary(state.sessions); }
  function getCardioStats() { return App.StatisticsManager.cardioStats(state.sessions); }
  function getChartPoints(exerciseName, metric) { return App.ChartManager.buildChartPoints(state.sessions, exerciseName, metric); }
  function getCalendarDays(year, month) { return App.ChartManager.buildCalendarDays(state.sessions, year, month); }
  function getUsedExerciseNames() { return ExerciseM.usedExerciseNames(state.sessions); }
  function getLastUsed(exerciseName, beforeDate) { return WorkoutM.lastUsed(state.sessions, exerciseName, beforeDate); }
  function getHistoryDates() {
    return Object.keys(state.sessions)
      .filter(d => { const s = state.sessions[d]; return (s.exercises && s.exercises.length) || (s.cardio && s.cardio.length); })
      .sort().reverse();
  }

  App.DataManager = {
    init, getState,
    setCurrentDate, setToday,
    registerExercise, renameExercise, deleteExerciseFromList,
    addSetToDraft, removeSetFromDraft, updateSetInDraft, addEmptySetToDraftEntry, removeEntryFromDraft, renameEntryInDraft,
    addCardioToDraft, removeCardioFromDraft, updateCardioInDraft,
    draftIsEmpty, clearDraft, saveSession, editSession, cancelEdit, deleteSession, repeatSessionIntoDraft,
    exportData, importFromFile, clearAllData,
    getRecords, getHeaderSummary, getCardioStats, getChartPoints, getCalendarDays,
    getUsedExerciseNames, getLastUsed, getHistoryDates
  };
})(window.App = window.App || {});
