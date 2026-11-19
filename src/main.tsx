import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>
      <p>It wasn't a very good adventure, but I'm grateful for the little good that was in it.  Goodbye.</p>
      <p>You did this Amal.  Enjoy your ego.  I hope it was worth it.</p>
    </div>
  </StrictMode>,
);
