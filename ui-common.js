/* ============================================================
   UI: common
   Общие для всего интерфейса вещи: тост, кастомное подтверждение
   (нативный confirm() блокируется в некоторых webview) и короткие
   обёртки над document.querySelector. Любой другой ui-*.js модуль
   может полагаться на App.UI.Common.
   ============================================================ */
(function (App) {
  "use strict";
  const Utils = App.Utils;

  function qs(id) { return document.getElementById(id); }
  function qsa(root, sel) { return Array.from((root || document).querySelectorAll(sel)); }

  function toast(msg) {
    const t = qs("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 1700);
  }

  function showConfirm(message, onConfirm, okLabel) {
    const overlay = qs("confirmOverlay");
    const msgEl = qs("confirmMsg");
    const okBtn = qs("confirmOkBtn");
    const cancelBtn = qs("confirmCancelBtn");
    msgEl.textContent = message;
    okBtn.textContent = okLabel || "Удалить";
    overlay.classList.add("show");

    const close = () => overlay.classList.remove("show");
    const onOk = () => { close(); cleanup(); onConfirm(); };
    const onCancel = () => { close(); cleanup(); };
    function cleanup() {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
    }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  }

  App.UI = App.UI || {};
  App.UI.Common = { qs, qsa, toast, showConfirm, escapeHtml: Utils.escapeHtml };
})(window.App = window.App || {});
