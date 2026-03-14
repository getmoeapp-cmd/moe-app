import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './kitchen_inventory_app';

window.storage = {
  get: (key) => Promise.resolve(localStorage.getItem(key) ? { value: localStorage.getItem(key) } : null),
  set: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  delete: (key) => Promise.resolve(localStorage.removeItem(key)),
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
