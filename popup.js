// popup.js
// Reads current state from chrome.storage and wires up the toggle, mode
// buttons, alert banner, quota line, and footer links.

const enabledToggle = document.getElementById("enabled-toggle");
const blockedTodayEl = document.getElementById("blocked-today");
const blockedTotalEl = document.getElementById("blocked-total");
const modeButtons = document.querySelectorAll(".mode-btn");
const openOptionsLink = document.getElementById("open-options");
const alertEl = document.getElementById("alert");
const quotaLine = document.getElementById("quota-line");

async function load() {
  const sync = await chrome.storage.sync.get(["enabled", "mode", "dailyLimit"]);
  const local = await chrome.storage.local.get([
    "blockedCount",
    "blockedToday",
    "lastDate",
    "checksToday",
    "checksDate",
    "apiStatus",
    "apiStatusDetail",
  ]);

  enabledToggle.checked = sync.enabled !== false; // default true
  const mode = sync.mode || "blur";
  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  blockedTotalEl.textContent = (local.blockedCount || 0).toLocaleString();

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = today === local.lastDate ? (local.blockedToday || 0) : 0;
  blockedTodayEl.textContent = todayCount.toLocaleString();

  // Quota line.
  const dailyLimit = sync.dailyLimit || 100;
  const checksToday = today === local.checksDate ? (local.checksToday || 0) : 0;
  quotaLine.textContent =
    "API checks today: " + checksToday + " / " + dailyLimit;

  // Alert banner.
  const status = local.apiStatus || "ok";
  if (status === "no_credentials") {
    showAlert(
      "No API credentials yet. Open Settings and add your Sightengine keys.",
      "warn"
    );
  } else if (status === "quota_reached") {
    showAlert(
      "Daily check limit reached. Detection paused until midnight. You can raise the limit in Settings.",
      "warn"
    );
  } else if (status === "api_error") {
    showAlert(
      "Last API call failed: " + (local.apiStatusDetail || "unknown error") +
      ". Check your credentials in Settings.",
      "error"
    );
  }
}

function showAlert(text, type) {
  alertEl.textContent = text;
  alertEl.className = "alert " + type;
  alertEl.style.display = "block";
}

enabledToggle.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabledToggle.checked });
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const mode = btn.dataset.mode;
    await chrome.storage.sync.set({ mode });
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
});

openOptionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

load();
