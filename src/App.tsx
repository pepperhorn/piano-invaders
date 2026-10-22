import React from 'react';
import PianoInvadersJs from './components/PianoInvaders.jsx';

// Legacy JSX component; typed loosely until it is converted to TypeScript.
const PianoInvaders = PianoInvadersJs as unknown as React.ComponentType<{ songs?: unknown[] }>;

function App() {
  // Optional: pass custom songs via props
  // const customSongs = [
  //   {
  //     name: "My Song",
  //     bpm: 80,
  //     melody: ["C3", "D3", "E3", "F3", "G3"]
  //   }
  // ];

  return <PianoInvaders />;
}

export default App;
