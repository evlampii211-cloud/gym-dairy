/* ============================================================
   UI: Exercises
   Справочник названий упражнений (карточка "Список упражнений") и
   datalist для автодополнения в форме добавления. Переименование
   здесь каскадно затрагивает всю историю — после успешного
   переименования просим полный перерендер через App.UI.renderAll().
   ============================================================ */
(function (App) {
  "use strict";
  const { qs, qsa, toast, showConfirm, escapeHtml } = App.UI.Common;
  const DM = App.DataManager;

  function rebuildDatalist() {
    const dl = qs("exerciseList");
    dl.innerHTML = DM.getState().exercises.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
  }

  function render() {
    rebuildDatalist();
    const area = qs("exercisesArea");
    const count = qs("exercisesCount");
    const list = DM.getState().exercises;
    count.textContent = list.length ? String(list.length) : "";

    if (!list.length) {
      area.innerHTML = '<div class="empty"><div class="big">Пока пусто</div><div class="small">Упражнения появятся здесь после первой записи</div></div>';
      return;
    }

    area.innerHTML = list.map(name => `
      <div class="entry">
        <div class="entry-head">
          <input class="ex" type="text" value="${escapeHtml(name)}" data-old="${escapeHtml(name)}">
          <button class="entry-x" data-del-ex="${escapeHtml(name)}" title="Удалить">×</button>
        </div>
      </div>`).join("");

    qsa(area, "input.ex").forEach(inp => {
      const apply = () => {
        const oldName = inp.dataset.old;
        const newName = inp.value.trim();
        if (!newName) { inp.value = oldName; return; }
        if (newName === oldName) return;
        const res = DM.renameExercise(oldName, newName);
        if (!res.ok) {
          toast(res.reason === "duplicate" ? "Такое упражнение уже есть в списке" : "Введите название");
          render();
          return;
        }
        App.UI.renderAll();
        toast("Упражнение переименовано");
      };
      inp.addEventListener("change", apply);
      inp.addEventListener("blur", apply);
    });

    qsa(area, "[data-del-ex]").forEach(b => {
      b.onclick = () => {
        const name = b.dataset.delEx;
        showConfirm(`Удалить «${name}» из списка упражнений? Уже сохранённые записи это не затронет.`, () => {
          DM.deleteExerciseFromList(name);
          render();
          toast("Упражнение удалено из списка");
        }, "Удалить");
      };
    });
  }

  App.UI.Exercises = { render, rebuildDatalist };
})(window.App = window.App || {});
