// options.js
// Settings page logic: Sightengine credentials (save + test), detection
// threshold, daily check limit, cache and stats reset.

const apiUserInput = document.getElementById("api-user");
const apiSecretInput = document.getElementById("api-secret");
const saveCredsBtn = document.getElementById("save-creds");
const testBtn = document.getElementById("test-connection");
const credsStatus = document.getElementById("creds-status");
const thresholdInput = document.getElementById("threshold");
const thresholdValue = document.getElementById("threshold-value");
const dailyLimitInput = document.getElementById("daily-limit");
const dailyLimitValue = document.getElementById("daily-limit-value");
const clearCacheBtn = document.getElementById("clear-cache");
const resetStatsBtn = document.getElementById("reset-stats");

function setStatus(text, type) {
  credsStatus.textContent = text;
  credsStatus.className = "status " + (type || "");
}

async function load() {
  const {
    sightengineUser = "",
    sightengineSecret = "",
    threshold = 0.5,
    dailyLimit = 100,
  } = await chrome.storage.sync.get([
    "sightengineUser",
    "sightengineSecret",
    "threshold",
    "dailyLimit",
  ]);

  if (sightengineUser) apiUserInput.value = sightengineUser;
  if (sightengineSecret) {
    apiSecretInput.placeholder = "Secret saved. Paste a new one to replace.";
  }

  thresholdInput.value = threshold;
  thresholdValue.textContent = Number(threshold).toFixed(2);
  dailyLimitInput.value = dailyLimit;
  dailyLimitValue.textContent = dailyLimit;
}

saveCredsBtn.addEventListener("click", async () => {
  const user = apiUserInput.value.trim();
  const secret = apiSecretInput.value.trim();

  if (!user) {
    setStatus("Please enter your API user.", "error");
    return;
  }

  // Only overwrite the secret if the user typed a new one, so saving the
  // form with an empty secret field doesn't wipe a previously saved secret.
  const updates = { sightengineUser: user };
  if (secret) updates.sightengineSecret = secret;

  await chrome.storage.sync.set(updates);

  // Saving valid-looking credentials clears any stale error state so the
  // popup doesn't keep showing an outdated alert.
  await chrome.storage.local.set({ apiStatus: "ok", apiStatusDetail: "" });

  if (secret) {
    apiSecretInput.value = "";
    apiSecretInput.placeholder = "Secret saved. Paste a new one to replace.";
  }

  setStatus("Saved.", "success");
  setTimeout(() => setStatus(""), 2500);
});

testBtn.addEventListener("click", async () => {
  setStatus("Testing connection...", "");
  testBtn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "TEST_CONNECTION",
    });
    if (result?.ok) {
      setStatus(result.message, "success");
    } else {
      setStatus(result?.message || "Test failed.", "error");
    }
  } catch (err) {
    setStatus("Test failed: " + err.message, "error");
  } finally {
    testBtn.disabled = false;
  }
});

thresholdInput.addEventListener("input", async () => {
  const v = parseFloat(thresholdInput.value);
  thresholdValue.textContent = v.toFixed(2);
  await chrome.storage.sync.set({ threshold: v });
});

dailyLimitInput.addEventListener("input", async () => {
  const v = parseInt(dailyLimitInput.value, 10);
  dailyLimitValue.textContent = v;
  await chrome.storage.sync.set({ dailyLimit: v });
});

clearCacheBtn.addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((k) => k.startsWith("cache:"));
  await chrome.storage.local.remove(cacheKeys);
  alert("Cache cleared (" + cacheKeys.length + " entries).");
});

resetStatsBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    blockedCount: 0,
    blockedToday: 0,
    lastDate: "",
  });
  alert("Stats reset.");
});

load();
