import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
class Boundary extends React.Component {
  state = { e: false };
  static getDerivedStateFromError() { return { e: true }; }
  render() { return this.state.e ? <div className="p-10 text-center"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-2">Please refresh the page.</p></div> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<Boundary><BrowserRouter><App /></BrowserRouter></Boundary>);
