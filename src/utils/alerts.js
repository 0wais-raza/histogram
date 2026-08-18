import Swal from "sweetalert2";

// ──────────────────────────────────────────────
// 🎨  CUSTOMIZABLE THEME  — edit these defaults
// ──────────────────────────────────────────────
const alertTheme = {
  // Global styling
  borderRadius: "14px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // Colors
  colors: {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
    confirm: "#0095f6",
    cancel: "#6b7280",
  },

  // Button labels
  labels: {
    confirm: "OK",
    cancel: "Cancel",
    yes: "Yes",
    no: "No",
  },

  // Animation
  showClass: { popup: "swal2-show swal2-bounce-in" },
  hideClass: { popup: "swal2-hide swal2-bounce-out" },
};

// ──────────────────────────────────────────────
// 🧩  BASE CONFIG  (all alerts inherit this)
// ──────────────────────────────────────────────
const baseConfig = {
  customClass: {
    popup: "swal-custom-popup",
    title: "swal-custom-title",
    htmlContainer: "swal-custom-html",
    confirmButton: "swal-confirm-btn",
    cancelButton: "swal-cancel-btn",
  },
  showClass: alertTheme.showClass,
  hideClass: alertTheme.hideClass,
  buttonsStyling: true,
};

// ──────────────────────────────────────────────
// 📢  PUBLIC API  — use these in your components
// ──────────────────────────────────────────────

/**
 * Success alert
 * @param {string} title
 * @param {string} [text]
 * @param {object} [overrides] - any Swal.fire options to merge
 */
export function alertSuccess(title, text, overrides = {}) {
  return Swal.fire({
    ...baseConfig,
    icon: "success",
    title,
    text,
    confirmButtonColor: alertTheme.colors.success,
    confirmButtonText: alertTheme.labels.confirm,
    ...overrides,
  });
}

/**
 * Error alert
 * @param {string} title
 * @param {string} [text]
 * @param {object} [overrides]
 */
export function alertError(title, text, overrides = {}) {
  return Swal.fire({
    ...baseConfig,
    icon: "error",
    title,
    text,
    confirmButtonColor: alertTheme.colors.error,
    confirmButtonText: alertTheme.labels.confirm,
    ...overrides,
  });
}

/**
 * Warning alert
 * @param {string} title
 * @param {string} [text]
 * @param {object} [overrides]
 */
export function alertWarning(title, text, overrides = {}) {
  return Swal.fire({
    ...baseConfig,
    icon: "warning",
    title,
    text,
    confirmButtonColor: alertTheme.colors.warning,
    confirmButtonText: alertTheme.labels.confirm,
    ...overrides,
  });
}

/**
 * Info alert
 * @param {string} title
 * @param {string} [text]
 * @param {object} [overrides]
 */
export function alertInfo(title, text, overrides = {}) {
  return Swal.fire({
    ...baseConfig,
    icon: "info",
    title,
    text,
    confirmButtonColor: alertTheme.colors.info,
    confirmButtonText: alertTheme.labels.confirm,
    ...overrides,
  });
}

/**
 * Confirmation dialog (returns Promise<boolean>)
 * @param {string} title
 * @param {string} [text]
 * @param {object} [overrides]
 */
export function alertConfirm(title, text, overrides = {}) {
  return Swal.fire({
    ...baseConfig,
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonColor: alertTheme.colors.confirm,
    cancelButtonColor: alertTheme.colors.cancel,
    confirmButtonText: alertTheme.labels.yes,
    cancelButtonText: alertTheme.labels.no,
    ...overrides,
  }).then((result) => result.isConfirmed);
}

/**
 * Toast notification (small popup in corner)
 * @param {"success"|"error"|"warning"|"info"} icon
 * @param {string} message
 * @param {object} [overrides]
 */
export function alertToast(icon, message, overrides = {}) {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    customClass: {
      popup: "swal-custom-toast",
    },
    ...overrides,
  });
}

/**
 * Prompt dialog (returns Promise<string | null>)
 * @param {string} title
 * @param {string} [inputLabel]
 * @param {object} [overrides]
 */
export function alertPrompt(title, inputLabel = "", overrides = {}) {
  return Swal.fire({
    ...baseConfig,
    title,
    input: "text",
    inputLabel,
    inputPlaceholder: inputLabel,
    showCancelButton: true,
    confirmButtonColor: alertTheme.colors.confirm,
    cancelButtonColor: alertTheme.colors.cancel,
    confirmButtonText: alertTheme.labels.confirm,
    cancelButtonText: alertTheme.labels.cancel,
    inputValidator: (value) => {
      if (!value) return "This field is required";
      return null;
    },
    ...overrides,
  }).then((result) => (result.isConfirmed ? result.value : null));
}

/**
 * Loading spinner — returns a Swal instance you can .close() later
 * @param {string} [title]
 */
export function alertLoading(title = "Loading...") {
  return Swal.fire({
    ...baseConfig,
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
}

/**
 * Fully custom alert — pass any Swal.fire options
 * @param {object} options
 */
export function alertCustom(options) {
  return Swal.fire({ ...baseConfig, ...options });
}

// Export the theme config so consumers can tweak it at runtime
export { alertTheme };
