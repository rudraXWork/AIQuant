import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom'
import './index.css'; 

// Context import removed

createRoot(document.getElementById('root')).render(

   
       <BrowserRouter>
          <App/>
      </BrowserRouter>
    
  
  )