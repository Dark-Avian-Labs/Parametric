import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { CompareProvider } from './context/CompareContext';
import './styles/input.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CompareProvider>
        <App />
      </CompareProvider>
    </BrowserRouter>
  </StrictMode>,
);
