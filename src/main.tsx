import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// App-shell caching only: exchange requests, local ledgers and authorization are never cached.
if(import.meta.env.PROD&&typeof navigator!=='undefined'&&'serviceWorker' in navigator){
 window.addEventListener('load',()=>{
   void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',
     {scope:import.meta.env.BASE_URL}).catch(e=>console.warn('Offline shell registration unavailable',e));
 });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
