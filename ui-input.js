/* ============================================================
   UI: Input
   Форма "Новая запись" (упражнение) и форма "Кардио". Обе только
   читают ввод пользователя и передают его в DataManager; сам ввод
   не хранит никакого состояния помимо того, что лежит в DOM.
   ============================================================ */
(function (App) {
  "use strict";
  const { qs, toast } = App.UI.Common;
  const Utils = App.Utils;
  const DM = App.DataManager;

  /* ---------- упражнение: подсказка "в прошлый раз" ---------- */
  function updateSuggestion() {
    const ex = qs("exerciseInput").value.trim();
    const hint = qs("suggestHint");
    const state = DM.getState();
    if (!ex || !state.currentDate) { hint.textContent = ""; hint.classList.remove("clickable"); hint.onclick = null; return; }
    const last = DM.getLastUsed(ex, state.currentDate);
    if (last) {
      hint.innerHTML = `В прошлый раз: <span class="pill">${Utils.formatNum(last.weight)} кг × ${last.reps}</span> — ${Utils.fmtDate(last.date)}. Нажмите, чтобы подставить.`;
      hint.classList.add("clickable");
      hint.onclick = () => {
        qs("weightInput").value = last.weight;
        qs("repsInput").value = last.reps;
        qs("weightInput").focus();
      };
    } else {
      hint.textContent = "Для этого упражнения записей ещё нет.";
      hint.classList.remove("clickable");
      hint.onclick = null;
    }
  }

  /* ---------- упражнение: добавление подхода(ов) в черновик ---------- */
  function addSet(opts = {}) {
    const exEl = qs("exerciseInput"), wEl = qs("weightInput"), rEl = qs("repsInput"), sEl = qs("setsInput");
    const ex = exEl.value.trim();
    const weight = Utils.toNum(wEl.value);
    const reps = Utils.toInt(rEl.value, NaN);
    const count = Utils.toInt(sEl.value, NaN);

    if (!ex) { toast("Введите упражнение"); exEl.focus(); return false; }
    if (Number.isNaN(weight) || weight < 0) { toast("Введите вес"); wEl.focus(); return false; }
    if (Number.isNaN(reps) || reps < 0) { toast("Введите повторы"); rEl.focus(); return false; }
    if (Number.isNaN(count) || count < 1) { toast("Подходов ≥ 1"); sEl.focus(); return false; }

    DM.addSetToDraft({ exercise: ex, weight, reps, count });

    if (opts.keepExercise) {
      wEl.value = ""; rEl.value = ""; sEl.value = "";
      wEl.focus();
    } else {
      exEl.value = ""; wEl.value = ""; rEl.value = ""; sEl.value = "";
      qs("suggestHint").textContent = "";
      exEl.focus();
    }
    App.UI.Draft.render();
    return true;
  }

  /* ---------- кардио: форма добавления ---------- */
  function populateCardioTypes() {
    const sel = qs("cardioType");
    sel.innerHTML = App.CardioManager.TYPES.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.label)}</option>`).join("");
  }

  function addCardio() {
    const typeEl = qs("cardioType"), durEl = qs("cardioDuration"), distEl = qs("cardioDistance"), noteEl = qs("cardioNote");
    const durationMin = Utils.toInt(durEl.value, 0);
    const distanceKm = Utils.toNum(distEl.value) || 0;
    if (!durationMin && !distanceKm) { toast("Укажите время или дистанцию"); durEl.focus(); return false; }
    DM.addCardioToDraft({ type: typeEl.value, durationMin, distanceKm, note: noteEl.value });
    durEl.value = ""; distEl.value = ""; noteEl.value = "";
    App.UI.Draft.render();
    return true;
  }

  function bindEvents() {
    qs("exerciseInput").addEventListener("input", updateSuggestion);
    qs("exerciseInput").addEventListener("change", updateSuggestion);
    ["exerciseInput", "weightInput", "repsInput", "setsInput"].forEach(id => {
      qs(id).addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (id === "exerciseInput" && qs("weightInput").value === "") qs("weightInput").focus();
          else addSet();
        }
      });
    });
    qs("addSetBtn").onclick = () => addSet();
    qs("anotherWeightBtn").onclick = () => addSet({ keepExercise: true });

    App.UI.Common.qsa(document, ".qw[data-bump]").forEach(btn => {
      btn.onclick = () => {
        const wEl = qs("weightInput");
        const current = Utils.toNum(wEl.value) || 0;
        const next = Math.max(0, current + parseFloat(btn.dataset.bump));
        wEl.value = String(next).replace(".", ",");
        wEl.focus();
      };
    });

    qs("addCardioBtn").onclick = addCardio;
  }

  function init() {
    populateCardioTypes();
    bindEvents();
  }

  App.UI.Input = { init, updateSuggestion };
})(window.App = window.App || {});
