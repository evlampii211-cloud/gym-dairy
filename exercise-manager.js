/* ============================================================
   ExerciseManager
   Отвечает только за справочник названий упражнений (autocomplete-
   список) и за переименование/удаление упражнения с каскадом по
   уже сохранённым тренировкам. Сами тренировки (подходы, тоннаж)
   — зона ответственности WorkoutManager.

   Все функции чистые: принимают данные, возвращают новые данные,
   ничего не пишут в localStorage и не трогают DOM.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  function sortList(list) {
    return list.slice().sort((a, b) => a.localeCompare(b, "ru"));
  }

  // Добавляет упражнение в справочник, если его там ещё нет (без учёта регистра)
  function register(list, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return { list, changed: false };
    if (list.some(e => Utils.sameName(e, trimmed))) return { list, changed: false };
    return { list: sortList(list.concat(trimmed)), changed: true };
  }

  function remove(list, name) {
    return list.filter(e => !Utils.sameName(e, name));
  }

  // Переименовывает упражнение в справочнике; отклоняет, если новое имя
  // конфликтует с уже существующим (кроме самого себя)
  function rename(list, oldName, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return { list, ok: false, reason: "empty" };
    const clash = list.some(e => Utils.sameName(e, trimmed) && !Utils.sameName(e, oldName));
    if (clash) return { list, ok: false, reason: "duplicate" };
    const nextList = sortList(list.map(e => (Utils.sameName(e, oldName) ? trimmed : e)));
    return { list: nextList, ok: true };
  }

  // Каскадное переименование внутри одного объекта-сессии {exercises, cardio}.
  // Если переименование сталкивает упражнение с уже существующим под новым
  // именем (например, "Жим штанги" переименовали в уже занятое "Жим лежа"),
  // оба объекта объединяются в один — дубли внутри дня недопустимы.
  function renameInSession(session, oldName, newName) {
    const renamed = session.exercises.map(entry =>
      Utils.sameName(entry.exercise, oldName)
        ? { ...entry, exercise: newName, sets: entry.sets.map(s => ({ ...s })) }
        : entry
    );
    const merged = [];
    renamed.forEach(entry => {
      const existing = merged.find(e => Utils.sameName(e.exercise, entry.exercise));
      if (existing) existing.sets = existing.sets.concat(entry.sets);
      else merged.push({ ...entry, sets: entry.sets.slice() });
    });
    return { exercises: merged, cardio: session.cardio };
  }

  // Каскадное переименование по всей карте sessions{date: session}
  function renameInSessions(sessions, oldName, newName) {
    const next = {};
    Object.keys(sessions).forEach(date => {
      next[date] = renameInSession(sessions[date], oldName, newName);
    });
    return next;
  }

  function usedExerciseNames(sessions) {
    const used = new Set();
    Object.values(sessions).forEach(session => {
      (session.exercises || []).forEach(e => used.add(e.exercise));
    });
    return Array.from(used).sort((a, b) => a.localeCompare(b, "ru"));
  }

  App.ExerciseManager = { register, remove, rename, renameInSession, renameInSessions, usedExerciseNames };
})(window.App = window.App || {});
