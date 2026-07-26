/* ============================================================
   Utils
   Общие функции без состояния: даты, числа, строки, id.
   Ни один другой модуль не должен дублировать эту логику —
   любое форматирование даты/числа идёт только через Utils.
   ============================================================ */
(function (App) {
  "use strict";

  function todayISO() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  function shortDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  // Разбор чисел, введённых пользователем (принимает и запятую, и точку)
  function toNum(v) {
    if (v == null) return NaN;
    if (typeof v === "number") return v;
    return parseFloat(String(v).trim().replace(",", "."));
  }

  // Целое число из пользовательского ввода, с запасным значением
  function toInt(v, fallback) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function formatNum(v) {
    if (v == null || Number.isNaN(v)) return "0";
    return Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

  let idCounter = 0;
  function generateId(prefix) {
    idCounter += 1;
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix || "id"}_${Date.now().toString(36)}_${idCounter}_${rand}`;
  }

  function sameName(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  // Копирование текста в буфер обмена: сначала Clipboard API,
  // затем запасной вариант через textarea (нужен старым/встроенным webview)
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* переходим к запасному варианту */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.setAttribute("readonly", "");
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  App.Utils = {
    todayISO, fmtDate, shortDate, uniq, toNum, toInt, formatNum,
    escapeHtml, generateId, sameName, copyText
  };
})(window.App = window.App || {});
