/* ============================================================
   CardioManager
   Работа с кардио-записями (CardioSession). Список типов вынесен
   в отдельный реестр TYPES — чтобы добавить новый вид кардио,
   достаточно дописать одну строку сюда, ничего больше в приложении
   менять не нужно.

   Поле metrics зарезервировано под будущие показатели (калории,
   пульс, темп, скорость) — оно уже есть в каждой записи, просто
   пока не заполняется и не отображается.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  const TYPES = [
    { id: "treadmill", label: "Беговая дорожка" },
    { id: "elliptical", label: "Эллипс" },
    { id: "bike", label: "Велотренажёр" },
    { id: "swim", label: "Плавание" }
  ];

  function typeLabel(id) {
    const t = TYPES.find(t => t.id === id);
    return t ? t.label : "Кардио";
  }

  function addSession(list, { type, durationMin, distanceKm, note }) {
    const entry = {
      id: Utils.generateId("cardio"),
      type: type || TYPES[0].id,
      durationMin: Math.max(0, durationMin || 0),
      distanceKm: Math.max(0, distanceKm || 0),
      note: (note || "").trim(),
      metrics: {}
    };
    return list.concat([entry]);
  }

  function removeSession(list, id) {
    return list.filter(c => c.id !== id);
  }

  function updateSession(list, id, patch) {
    return list.map(c => (c.id === id ? { ...c, ...patch } : c));
  }

  function formatLine(c) {
    const parts = [typeLabel(c.type)];
    if (c.durationMin) parts.push(`${Utils.formatNum(c.durationMin)} мин`);
    if (c.distanceKm) parts.push(`${Utils.formatNum(c.distanceKm)} км`);
    let line = parts.join(", ");
    if (c.note) line += ` — ${c.note}`;
    return line;
  }

  // Итоги по одному списку кардио-записей (например, за один день)
  function sessionTotals(list) {
    return (list || []).reduce((acc, c) => ({
      durationMin: acc.durationMin + (c.durationMin || 0),
      distanceKm: acc.distanceKm + (c.distanceKm || 0),
      count: acc.count + 1
    }), { durationMin: 0, distanceKm: 0, count: 0 });
  }

  App.CardioManager = { TYPES, typeLabel, addSession, removeSession, updateSession, formatLine, sessionTotals };
})(window.App = window.App || {});
