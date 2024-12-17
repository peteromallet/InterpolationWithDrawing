import React from 'https://cdn.skypack.dev/react@19.0.0';
import ReactDOM from 'https://cdn.skypack.dev/react-dom@19.0.0';
import TrajectoryDrawer from './components/TrajectoryDrawer.js';

function App() {
  return (
    <main className="min-h-screen p-8">
      <TrajectoryDrawer />
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />); 