import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.scss';

const container = document.getElementById('root');
if (!container) throw new Error('index.html is missing the #root mount point');

const root = createRoot(container);

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
