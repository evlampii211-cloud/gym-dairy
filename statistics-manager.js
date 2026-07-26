/* ============================================================
   StatisticsManager
   Агрегированная статистика поверх sessions. Не хранит собственных
   данных — только читает то, что уже есть в DataManager, и отдаёт
   готовые к отображению цифры. Новые виды статистики (объём по
   неделям, разбивка по типам кардио и т.п.) добавляются сюда как
   новые функции, не трогая остальные модули.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  // Сводка для подзаголовка шапки: сколько всего записей, тренировок, когда последняя
  function headerSummary(sessions) {
    const dates = Object.keys(sessions).filter(d => (sessions[d].exercises || []).length).sort();
    if (!dates.length) return { empty: true, text: "Первая запись — начало журнала." };
    const totalEntries = dates.reduce((sum, d) => sum + sessions[d].exercises.length, 0);
    const text = `Записей: ${totalEntries} · тренировок: ${dates.length} · последняя ${Utils.fmtDate(dates[dates.length - 1])}`;
    return { empty: false, text };
  }

  // Суммарная статистика кардио по всей истории
  function cardioStats(sessions) {
    let durationMin = 0, distanceKm = 0, count = 0;
    Object.values(sessions).forEach(session => {
      const t = App.CardioManager.sessionTotals(session.cardio || []);
      durationMin += t.durationMin;
      distanceKm += t.distanceKm;
      count += t.count;
    });
    return { durationMin, distanceKm, count };
  }

  App.StatisticsManager = { headerSummary, cardioStats };
})(window.App = window.App || {});
