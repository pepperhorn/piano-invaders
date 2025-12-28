import React, { useEffect, useRef, useState } from 'react';
import { PIANO_KEYS, WHITE_KEYS, BLACK_KEYS } from '../constants/gameConfig.js';

const Keyboard = ({ onKeyPress, onPositionsCalculated }) => {
  const [activeKeys, setActiveKeys] = useState(new Set());
  const keyRefs = useRef({});

  useEffect(() => {
    // Calculate key positions after render
    const calculatePositions = () => {
      const positions = {};
      PIANO_KEYS.forEach(key => {
        const el = keyRefs.current[key.midi.toLowerCase()];
        if (el) {
          const rect = el.getBoundingClientRect();
          positions[key.midi.toLowerCase()] = rect.left + rect.width / 2;
        }
      });
      onPositionsCalculated(positions);
    };

    // Use timeout to ensure DOM is fully rendered
    setTimeout(calculatePositions, 100);

    window.addEventListener('resize', calculatePositions);
    return () => window.removeEventListener('resize', calculatePositions);
  }, [onPositionsCalculated]);

  const handleKeyDown = (midi) => {
    setActiveKeys(prev => new Set(prev).add(midi));
    onKeyPress(midi);
  };

  const handleKeyUp = (midi) => {
    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(midi);
      return newSet;
    });
  };

  const renderKey = (key, className, gridColumn) => {
    const midi = key.midi.toLowerCase();
    const isActive = activeKeys.has(midi);

    return (
      <div
        key={key.midi}
        ref={el => keyRefs.current[midi] = el}
        className={`piano-key ${className} ${isActive ? 'active' : ''}`}
        data-midi={key.midi}
        data-index={key.index}
        style={gridColumn ? { gridColumn } : undefined}
        onPointerDown={(e) => {
          e.preventDefault();
          handleKeyDown(midi);
        }}
        onPointerUp={() => handleKeyUp(midi)}
        onPointerLeave={() => handleKeyUp(midi)}
      >
        {key.name}
      </div>
    );
  };

  // Standard piano keyboard pattern:
  // White keys: B2, C3, D3, E3, F3, G3, A3, B3, C4, D4, E4
  // Black keys: C#3 (between C3-D3), D#3 (between D3-E3), gap, 
  //             F#3 (between F3-G3), G#3 (between G3-A3), A#3 (between A3-B3), gap,
  //             C#4 (between C4-D4), D#4 (between D4-E4)
  
  // Grid layout: 11 columns for white keys, black keys span between columns
  // Column positions: 1=B2, 2=C3, 3=D3, 4=E3, 5=F3, 6=G3, 7=A3, 8=B3, 9=C4, 10=D4, 11=E4
  
  // Map white keys to grid columns
  const whiteKeyGridMap = {
    'B2': 1,
    'C3': 2,
    'D3': 3,
    'E3': 4,
    'F3': 5,
    'G3': 6,
    'A3': 7,
    'B3': 8,
    'C4': 9,
    'D4': 10,
    'E4': 11
  };

  // Map black keys to grid column spans (positioned between white keys)
  const blackKeyGridMap = {
    'C#3': { start: 2, end: 3 },  // Between C3(2) and D3(3)
    'D#3': { start: 3, end: 4 },  // Between D3(3) and E3(4)
    'F#3': { start: 5, end: 6 },  // Between F3(5) and G3(6)
    'G#3': { start: 6, end: 7 },  // Between G3(6) and A3(7)
    'A#3': { start: 7, end: 8 },  // Between A3(7) and B3(8)
    'C#4': { start: 9, end: 10 }, // Between C4(9) and D4(10)
    'D#4': { start: 10, end: 11 } // Between D4(10) and E4(11)
  };

  return (
    <div className="keyboard">
      <div className="keyboard-grid">
        {/* White keys row */}
        {WHITE_KEYS.map(key => {
          const gridColumn = whiteKeyGridMap[key.midi];
          return renderKey(key, 'white-key', gridColumn);
        })}
      </div>
      
      {/* Black keys container - positioned absolutely over white keys */}
      <div className="black-keys-container">
        {BLACK_KEYS.map(key => {
          const gridSpan = blackKeyGridMap[key.midi];
          const midi = key.midi.toLowerCase();
          const isActive = activeKeys.has(midi);
          
          if (!gridSpan) return null;
          
          // Calculate position: center between two white keys
          // Grid has 11 columns, each column center is at (n - 0.5) / 11
          // Black key between columns start and end is at their midpoint
          const centerColumn = (gridSpan.start + gridSpan.end) / 2;
          const leftPercent = ((centerColumn - 0.5) / 11) * 100;
          
          return (
            <div
              key={key.midi}
              ref={el => keyRefs.current[midi] = el}
              className={`piano-key black-key ${isActive ? 'active' : ''}`}
              data-midi={key.midi}
              data-index={key.index}
              style={{
                left: `${leftPercent}%`
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                handleKeyDown(midi);
              }}
              onPointerUp={() => handleKeyUp(midi)}
              onPointerLeave={() => handleKeyUp(midi)}
            >
              {key.name}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Keyboard;
