import React from 'react';
import { createRoot } from 'react-dom/client';
//import { Provider } from 'react-redux';
//import { store } from './app/store';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.scss';

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
