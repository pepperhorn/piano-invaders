import React from 'react';
import PianoInvaders from './components/PianoInvaders.jsx';

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
