/* ============================================================
   WorkoutManager
   Работа с "тренировкой" — набором упражнений (ExerciseEntry[])
   внутри черновика или сохранённого дня. Каждое упражнение хранит
   свои подходы в массиве sets:[{weight,reps}]; одинаковые названия
   упражнений всегда объединяются в один объект.

   Все функции чистые (entries -> новые entries), мутацию состояния
   и сохранение делает DataManager.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  function cloneEntries(entries) {
    return entries.map(e => ({ id: e.id, exercise: e.exercise, sets: e.sets.map(s => ({ ...s })) }));
  }

  // Добавляет count одинаковых подходов; если упражнение с таким названием
  // уже есть в этой тренировке — подходы уходят внутрь него (объединение),
  // иначе создаётся новый объект упражнения.
  function addSet(entries, { exercise, weight, reps, count }) {
    const name = (exercise || "").trim();
    const c = Math.max(1, Utils.toInt(count, 1));
    const next = cloneEntries(entries);
    let target = next.find(e => Utils.sameName(e.exercise, name));
    if (!target) {
      target = { id: Utils.generateId("ex"), exercise: name, sets: [] };
      next.push(target);
    }
    for (let i = 0; i < c; i++) target.sets.push({ weight, reps });
    return next;
  }

  // Убирает один подход; если это был последний подход упражнения —
  // упражнение целиком исчезает из тренировки
  function removeSet(entries, entryId, setIndex) {
    return entries
      .map(e => (e.id === entryId ? { ...e, sets: e.sets.filter((_, i) => i !== setIndex) } : e))
      .filter(e => e.sets.length > 0);
  }

  function updateSet(entries, entryId, setIndex, patch) {
    return entries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) };
    });
  }

  function addEmptySet(entries, entryId) {
    return entries.map(e => (e.id === entryId ? { ...e, sets: e.sets.concat([{ weight: 0, reps: 0 }]) } : e));
  }

  function removeEntry(entries, entryId) {
    return entries.filter(e => e.id !== entryId);
  }

  function renameEntry(entries, entryId, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return entries;
    return entries.map(e => (e.id === entryId ? { ...e, exercise: trimmed } : e));
  }

  function exerciseTonnage(entry) {
    return entry.sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
  }

  function workoutTonnage(entries) {
    return entries.reduce((sum, e) => sum + exerciseTonnage(e), 0);
  }

  function maxWeightInEntry(entry) {
    return entry.sets.reduce((max, s) => Math.max(max, s.weight || 0), 0);
  }

  // Присоединяет incomingEntries к baseEntries: если упражнение с таким
  // названием уже есть — подходы дописываются в него, иначе добавляется
  // новый объект упражнения. Используется при дозаписи в уже сохранённый
  // день и при загрузке черновика (повтор/редактирование).
  function mergeAppend(baseEntries, incomingEntries) {
    const next = cloneEntries(baseEntries);
    incomingEntries.forEach(inc => {
      let match = next.find(e => Utils.sameName(e.exercise, inc.exercise));
      if (!match) {
        match = { id: Utils.generateId("ex"), exercise: inc.exercise, sets: [] };
        next.push(match);
      }
      inc.sets.forEach(s => match.sets.push({ ...s }));
    });
    return next;
  }

  // Последнее использование упражнения до заданной даты — источник подсказки
  // "в прошлый раз: ... кг × ..." в форме добавления
  function lastUsed(sessionsByDate, exerciseName, beforeDate) {
    const dates = Object.keys(sessionsByDate).filter(d => d < beforeDate).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
      const entry = (sessionsByDate[dates[i]].exercises || []).find(e => Utils.sameName(e.exercise, exerciseName));
      if (entry && entry.sets.length) {
        const last = entry.sets[entry.sets.length - 1];
        return { date: dates[i], weight: last.weight, reps: last.reps };
      }
    }
    return null;
  }

  // Текстовая сводка тренировки (для копирования в буфер обмена).
  // Кардио форматирует CardioManager — WorkoutManager лишь собирает секции вместе.
  function buildSessionText(session, date) {
    const isToday = date === Utils.todayISO();
    const label = isToday ? "Сегодня" : "Тренировка";
    const lines = ["Журнал тренировок", "", `${label} (${date})`];
    session.exercises.forEach(e => {
      const parts = e.sets.map(s => `${Utils.formatNum(s.weight)} кг × ${s.reps}`).join(", ");
      lines.push(`- ${e.exercise}: ${parts}`);
    });
    if (session.cardio && session.cardio.length && App.CardioManager) {
      lines.push("", "Кардио:");
      session.cardio.forEach(c => lines.push(`- ${App.CardioManager.formatLine(c)}`));
    }
    return lines.join("\n");
  }

  App.WorkoutManager = {
    addSet, removeSet, updateSet, addEmptySet, removeEntry, renameEntry,
    exerciseTonnage, workoutTonnage, maxWeightInEntry, lastUsed, buildSessionText,
    cloneEntries, mergeAppend
  };
})(window.App = window.App || {});
