/* ============================================================
   RecordsManager
   Считает личные рекорды по всей истории тренировок. Рекорды не
   хранятся отдельно в localStorage — они всегда пересчитываются
   из sessions, поэтому не могут разойтись с реальными данными
   (никакого кэша, который нужно было бы инвалидировать).

   Три независимых категории:
     - maxWeight   — лучший рабочий вес по каждому упражнению;
     - maxTonnage  — лучший тоннаж по каждому упражнению
                     (сумма веса × повторы по всем подходам);
     - workoutTonnage — лучший суммарный тоннаж тренировки за день
                     (один общий рекорд, не по упражнениям).
   ============================================================ */
(function (App) {
  "use strict";

  function computeRecords(sessions) {
    const byExercise = {};
    let workoutTonnageRecord = null;

    Object.keys(sessions).sort().forEach(date => {
      const session = sessions[date];
      const entries = session.exercises || [];

      entries.forEach(entry => {
        if (!entry.sets.length) return;
        const key = entry.exercise.toLowerCase();
        if (!byExercise[key]) byExercise[key] = { exercise: entry.exercise, maxWeight: null, maxTonnage: null };
        const rec = byExercise[key];
        rec.exercise = entry.exercise; // отображаем последнее актуальное написание названия

        const weight = App.WorkoutManager.maxWeightInEntry(entry);
        if (weight > 0 && (!rec.maxWeight || weight > rec.maxWeight.weight)) {
          rec.maxWeight = { weight, date };
        }
        const tonnage = App.WorkoutManager.exerciseTonnage(entry);
        if (tonnage > 0 && (!rec.maxTonnage || tonnage > rec.maxTonnage.tonnage)) {
          rec.maxTonnage = { tonnage, date };
        }
      });

      const dayTonnage = App.WorkoutManager.workoutTonnage(entries);
      if (dayTonnage > 0 && (!workoutTonnageRecord || dayTonnage > workoutTonnageRecord.tonnage)) {
        workoutTonnageRecord = { date, tonnage: dayTonnage };
      }
    });

    return { byExercise, workoutTonnageRecord };
  }

  function listByWeight(byExercise) {
    return Object.values(byExercise).filter(r => r.maxWeight).sort((a, b) => b.maxWeight.weight - a.maxWeight.weight);
  }
  function listByTonnage(byExercise) {
    return Object.values(byExercise).filter(r => r.maxTonnage).sort((a, b) => b.maxTonnage.tonnage - a.maxTonnage.tonnage);
  }

  App.RecordsManager = { computeRecords, listByWeight, listByTonnage };
})(window.App = window.App || {});
