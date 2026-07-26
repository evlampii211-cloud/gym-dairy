/* ============================================================
   UI: Draft
   Рендер и инлайн-редактирование черновика: упражнения с подходами
   (объединённые по названию) и кардио-записи. Точечные правки поля
   (вес/повторы/время/дистанция) не перерисовывают всю карточку —
   только меняют состояние и точечно обновляют цифру тоннажа, чтобы
   не терять фокус посреди ввода. Структурные изменения (удаление
   подхода/упражнения, добавление подхода, переименование с
   возможным слиянием) перерисовывают карточку целиком.
   ============================================================ */
(function (App) {
  "use strict";
  const { qs, qsa, toast, showConfirm, escapeHtml } = App.UI.Common;
  const Utils = App.Utils;
  const DM = App.DataManager;
  const WM = App.WorkoutManager;

  function exerciseEntryHtml(entry, index) {
    const tonnage = WM.exerciseTonnage(entry);
    const rows = entry.sets.map((s, i) => `
      <div class="set-row" data-set-i="${i}">
        <span class="set-label">Подход ${i + 1}</span>
        <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="${s.weight}" data-role="set-weight" placeholder="кг">
        <input type="number" inputmode="numeric" min="0" value="${s.reps}" data-role="set-reps" placeholder="повт">
        <button class="set-x" data-role="del-set" data-set-i="${i}" title="Убрать подход">×</button>
      </div>`).join("");
    return `
      <div class="entry" data-eid="${entry.id}">
        <div class="entry-head">
          <span class="entry-idx">${index + 1}</span>
          <input class="ex" type="text" list="exerciseList" value="${escapeHtml(entry.exercise)}" data-role="entry-name">
          <button class="entry-x" data-role="del-entry" title="Убрать упражнение">×</button>
        </div>
        <div class="set-rows">${rows}</div>
        <button type="button" class="add-set-row-btn" data-role="add-set">+ Добавить подход</button>
        <div class="entry-tonnage">Тоннаж упражнения: <strong>${Utils.formatNum(tonnage)} кг</strong></div>
      </div>`;
  }

  function cardioEntryHtml(c) {
    const options = App.CardioManager.TYPES.map(t => `<option value="${t.id}"${t.id === c.type ? " selected" : ""}>${escapeHtml(t.label)}</option>`).join("");
    return `
      <div class="cardio-entry" data-cid="${c.id}">
        <div class="cardio-entry-head">
          <select data-role="cardio-type">${options}</select>
          <button class="entry-x" data-role="del-cardio" title="Убрать">×</button>
        </div>
        <div class="cardio-row-fields">
          <div><label>Время, мин</label><input type="number" min="0" value="${c.durationMin || ""}" data-role="cardio-duration"></div>
          <div><label>Дистанция, км</label><input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="${c.distanceKm || ""}" data-role="cardio-distance"></div>
        </div>
        <div class="cardio-note-row"><input type="text" value="${escapeHtml(c.note || "")}" placeholder="Заметка" data-role="cardio-note"></div>
      </div>`;
  }

  function render() {
    const state = DM.getState();
    const draft = state.draft;
    const area = qs("draftArea");
    const cardioArea = qs("draftCardioArea");
    const total = draft.exercises.length + draft.cardio.length;
    qs("draftCount").textContent = total ? `${total} зап.` : "";

    const banner = qs("editBanner");
    if (state.editingDate) {
      qs("editDate").textContent = Utils.fmtDate(state.editingDate);
      banner.classList.add("active");
    } else {
      banner.classList.remove("active");
    }

    if (!total) {
      area.innerHTML = '<div class="empty"><div class="big">Пока пусто</div><div class="small">Добавьте первое упражнение выше</div></div>';
      cardioArea.innerHTML = "";
      return;
    }

    area.innerHTML = draft.exercises.map(exerciseEntryHtml).join("");
    cardioArea.innerHTML = draft.cardio.map(cardioEntryHtml).join("");
    bindExerciseEvents(area);
    bindCardioEvents(cardioArea);
  }

  function refreshTonnageDisplays() {
    const state = DM.getState();
    state.draft.exercises.forEach(entry => {
      const el = document.querySelector(`.entry[data-eid="${entry.id}"] .entry-tonnage strong`);
      if (el) el.textContent = `${Utils.formatNum(WM.exerciseTonnage(entry))} кг`;
    });
    const total = state.draft.exercises.length + state.draft.cardio.length;
    qs("draftCount").textContent = total ? `${total} зап.` : "";
  }

  function bindExerciseEvents(area) {
    qsa(area, ".entry").forEach(entryEl => {
      const eid = entryEl.dataset.eid;

      const nameInput = entryEl.querySelector('[data-role="entry-name"]');
      const applyName = () => {
        const val = nameInput.value.trim();
        if (!val) { render(); return; }
        DM.renameEntryInDraft(eid, val);
        render(); // переименование могло объединить два упражнения — структура изменилась
      };
      nameInput.addEventListener("change", applyName);
      nameInput.addEventListener("blur", applyName);

      qsa(entryEl, '[data-role="set-weight"], [data-role="set-reps"]').forEach(inp => {
        const apply = () => {
          const setI = parseInt(inp.closest(".set-row").dataset.setI, 10);
          const patch = {};
          if (inp.dataset.role === "set-weight") {
            let v = Utils.toNum(inp.value); if (Number.isNaN(v) || v < 0) v = 0;
            patch.weight = v; inp.value = v;
          } else {
            let v = Utils.toInt(inp.value, 0); if (v < 0) v = 0;
            patch.reps = v; inp.value = v;
          }
          DM.updateSetInDraft(eid, setI, patch);
          refreshTonnageDisplays();
        };
        inp.addEventListener("change", apply);
        inp.addEventListener("blur", apply);
      });

      qsa(entryEl, '[data-role="del-set"]').forEach(btn => {
        btn.onclick = () => { DM.removeSetFromDraft(eid, parseInt(btn.dataset.setI, 10)); render(); };
      });

      const addBtn = entryEl.querySelector('[data-role="add-set"]');
      if (addBtn) addBtn.onclick = () => { DM.addEmptySetToDraftEntry(eid); render(); };

      const delEntryBtn = entryEl.querySelector('[data-role="del-entry"]');
      if (delEntryBtn) delEntryBtn.onclick = () => { DM.removeEntryFromDraft(eid); render(); };
    });
  }

  function bindCardioEvents(area) {
    qsa(area, ".cardio-entry").forEach(el => {
      const cid = el.dataset.cid;
      const typeSel = el.querySelector('[data-role="cardio-type"]');
      typeSel.onchange = () => DM.updateCardioInDraft(cid, { type: typeSel.value });

      const durInp = el.querySelector('[data-role="cardio-duration"]');
      const applyDur = () => { let v = Utils.toInt(durInp.value, 0); if (v < 0) v = 0; DM.updateCardioInDraft(cid, { durationMin: v }); durInp.value = v || ""; };
      durInp.addEventListener("change", applyDur); durInp.addEventListener("blur", applyDur);

      const distInp = el.querySelector('[data-role="cardio-distance"]');
      const applyDist = () => { let v = Utils.toNum(distInp.value) || 0; if (v < 0) v = 0; DM.updateCardioInDraft(cid, { distanceKm: v }); distInp.value = v || ""; };
      distInp.addEventListener("change", applyDist); distInp.addEventListener("blur", applyDist);

      const noteInp = el.querySelector('[data-role="cardio-note"]');
      const applyNote = () => DM.updateCardioInDraft(cid, { note: noteInp.value.trim() });
      noteInp.addEventListener("change", applyNote); noteInp.addEventListener("blur", applyNote);

      const delBtn = el.querySelector('[data-role="del-cardio"]');
      delBtn.onclick = () => { DM.removeCardioFromDraft(cid); render(); };
    });
  }

  function bindStaticButtons() {
    qs("cancelEditBtn").onclick = () => {
      DM.cancelEdit();
      render();
      App.UI.History.render();
      App.UI.History.refreshRepeatSelect();
    };
    qs("deleteSessionBtn").onclick = () => {
      const state = DM.getState();
      if (!state.editingDate) return;
      const date = state.editingDate;
      showConfirm(`Удалить тренировку за ${Utils.fmtDate(date)}?`, () => {
        DM.deleteSession();
        App.UI.renderAll();
        toast("Тренировка удалена");
      }, "Удалить");
    };
    qs("clearDraftBtn").onclick = () => {
      if (DM.draftIsEmpty()) { toast("Черновик уже пуст"); return; }
      showConfirm("Удалить все записи текущей тренировки? Несохранённые данные будут потеряны.", () => {
        DM.clearDraft();
        render();
        App.UI.History.render();
        App.UI.History.refreshRepeatSelect();
        toast("Текущая тренировка удалена");
      }, "Удалить");
    };
  }

  function init() { bindStaticButtons(); }

  App.UI.Draft = { init, render };
})(window.App = window.App || {});
