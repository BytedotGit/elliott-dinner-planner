// PWA hot-update controller. Keeps app code fresh without uninstalling the Home Screen app.
// User data lives separately in IndexedDB and is never replaced by an application update.
(() => {
  if (!('serviceWorker' in navigator)) return;

  const RELOAD_GUARD = 'elliott-meal-planner-sw-reload';
  let registration = null;
  let updateReady = false;

  function cookingNow() {
    const dlg = document.getElementById('cookDialog');
    return !!(dlg && dlg.open);
  }

  function reloadForUpdate() {
    if (sessionStorage.getItem(RELOAD_GUARD) === '1') return;
    if (cookingNow()) {
      updateReady = true;
      if (typeof toast === 'function') toast('Update ready — applies after Cook Mode');
      return;
    }
    sessionStorage.setItem(RELOAD_GUARD, '1');
    location.reload();
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadForUpdate();
  });

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'APP_UPDATED') reloadForUpdate();
  });

  async function checkForUpdate() {
    try {
      registration = registration || await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.register('./sw.js');
      await registration.update();
      const waiting = registration.waiting;
      if (waiting) waiting.postMessage({type:'SKIP_WAITING'});
    } catch (e) {
      // Offline is expected; cached app remains usable.
    }
  }

  // Clear the single-reload guard after a successful fresh page boot.
  window.addEventListener('load', () => {
    setTimeout(() => sessionStorage.removeItem(RELOAD_GUARD), 1500);
    checkForUpdate();
  });

  // An installed iPhone PWA may be resumed instead of navigated. Check whenever it returns to foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });

  window.addEventListener('online', checkForUpdate);

  // If an update arrived during Cook Mode, apply it when the dialog closes.
  const cookDialog = document.getElementById('cookDialog');
  if (cookDialog) cookDialog.addEventListener('close', () => {
    if (updateReady) reloadForUpdate();
  });
})();
