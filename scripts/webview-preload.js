// Injected only by the trusted host, before the local React document starts.
(() => {
  'use strict';
  if (location.origin !== 'https://compost.invalid' || window !== window.top) return;
  const pending = new Map();
  const subscribers = new Set();
  const port = chrome.webview;
  port.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'view') {
      for (const callback of subscribers) callback(data.view);
    } else if (data.type === 'reply') {
      const task = pending.get(data.id);
      if (!task) return;
      pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data.view);
    } else if (data.type === 'fatal') {
      for (const task of pending.values()) task.reject(new Error(data.error));
      pending.clear();
      window.dispatchEvent(new CustomEvent('compost:host-error', { detail: data.error }));
    }
  });
  Object.defineProperty(window, 'compost', {
    configurable: false,
    writable: false,
    value: Object.freeze({
      invoke(command) {
        if (pending.size >= 64) return Promise.reject(new Error('Дождитесь завершения действий.'));
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          pending.set(id, { resolve, reject });
          try {
            port.postMessage({ type: 'invoke', id, command });
          } catch (error) {
            pending.delete(id);
            reject(error);
          }
        });
      },
      subscribe(callback) {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
    }),
  });
  port.postMessage({ type: 'rendererReady' });
  window.addEventListener('compost:ready', () => port.postMessage({ type: 'applicationReady' }));
})();
