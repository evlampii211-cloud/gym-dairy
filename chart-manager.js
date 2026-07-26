/* ============================================================
   ChartManager
   Готовит данные для визуализаций. Сам ничего не рисует — этим
   занимается UI-слой (ui-chart.js), который берёт готовые точки
   и превращает их в SVG. Такое разделение позволяет позже
   подключить любую другую библиотеку графиков, не трогая расчёты.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  const METRICS = ["weight", "volume", "reps", "sets"];

  function metricLabel(m) {
    return ({
      weight: "Вес, кг",
      volume: "Тоннаж, кг",
      reps: "Повторы (макс. за день)",
      sets: "Подходы, шт."
    })[m] || "";
  }

  function metricValue(entry, metric) {
    if (!entry.sets.length) return 0;
    switch (metric) {
      case "weight": return Math.max(...entry.sets.map(s => s.weight || 0));
      case "reps": return Math.max(...entry.sets.map(s => s.reps || 0));
      case "sets": return entry.sets.length;
      case "volume": return App.WorkoutManager.exerciseTonnage(entry);
      default: return 0;
    }
  }

  // Точки для графика прогресса по одному упражнению
  function buildChartPoints(sessions, exerciseName, metric) {
    const points = [];
    Object.keys(sessions).sort().forEach(date => {
      const entry = (sessions[date].exercises || []).find(e => Utils.sameName(e.exercise, exerciseName));
      if (!entry || !entry.sets.length) return;
      points.push({ date, value: metricValue(entry, metric) });
    });
    return points;
  }

  // Сетка дней календаря на месяц: ведущие/хвостовые дни соседних месяцев
  // и отметка дней, где есть хоть тренировка, хоть кардио
  function buildCalendarDays(sessions, year, month) {
    const days = [];
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = понедельник
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const todayStr = Utils.todayISO();

    for (let i = firstDow - 1; i >= 0; i--) days.push({ label: daysInPrevMonth - i, otherMonth: true });

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const session = sessions[iso];
      const has = !!(session && (((session.exercises || []).length) || ((session.cardio || []).length)));
      days.push({ label: d, iso, otherMonth: false, hasSession: has, isToday: iso === todayStr });
    }
    const totalCells = firstDow + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= trailing; d++) days.push({ label: d, otherMonth: true });
    return days;
  }

  App.ChartManager = { METRICS, metricLabel, metricValue, buildChartPoints, buildCalendarDays };
})(window.App = window.App || {});
