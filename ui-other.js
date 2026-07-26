/* ============================================================
   UI: Other
   Кнопки карточки "Другое": экспорт/импорт JSON, очистка всех
   данных, копирование текущего черновика в буфер обмена.
   ============================================================ */
(function (App) {
  "use strict";
  const { qs, toast, showConfirm } = App.UI.Common;
  const Utils = App.Utils;
  const DM = App.DataManager;

  function bindEvents() {
    qs("exportBtn").onclick = () => { DM.exportData(); toast("Экспортировано в JSON"); };

    qs("importBtn").onclick = () => qs("importFile").click();
    qs("importFile").onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const res = await DM.importFromFile(file);
      if (!res.ok) { toast("Ошибка импорта: некорректный JSON"); return; }
      App.UI.renderAll();
      toast(`Импортировано дат: ${res.importedDates}`);
    };

    qs("clearBtn").onclick = () => {
      showConfirm("Удалить ВСЕ данные из этого браузера? Это необратимо.", () => {
        DM.clearAllData();
        App.UI.renderAll();
        toast("Все данные очищены");
      }, "Очистить всё");
    };

    qs("copyDraftBtn").onclick = () => {
      if (DM.draftIsEmpty()) { toast("Нечего копировать — добавьте упражнения"); return; }
      const state = DM.getState();
      const date = state.editingDate || state.currentDate;
      const text = App.WorkoutManager.buildSessionText(state.draft, date);
      Utils.copyText(text).then(ok => toast(ok ? "Тренировка скопирована" : "Не удалось скопировать"));
    };
  }

  function init() { bindEvents(); }

  App.UI.Other = { init };
})(window.App = window.App || {});
