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

  const renderKey = (key, className) => {
    const midi = key.midi.toLowerCase();
    const isActive = activeKeys.has(midi);

    return (
      <div
        key={key.midi}
        ref={el => keyRefs.current[midi] = el}
        className={`piano-key ${className} ${isActive ? 'active' : ''}`}
        data-midi={key.midi}
        data-index={key.index}
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

  // Black key pattern with spacers for proper alignment
  const blackPattern = [
    { type: 'half-spacer' },
    { midi: 'C#3' },
    { midi: 'D#3' },
    { type: 'spacer' },
    { midi: 'F#3' },
    { midi: 'G#3' },
    { midi: 'A#3' },
    { type: 'spacer' },
    { midi: 'C#4' },
    { midi: 'D#4' },
    { type: 'half-spacer' }
  ];

  return (
    <div className="keyboard">
      <div className="key-row black-row">
        {blackPattern.map((item, idx) => {
          if (item.type === 'spacer') {
            return <div key={`spacer-${idx}`} className="black-spacer" />;
          } else if (item.type === 'half-spacer') {
            return <div key={`half-spacer-${idx}`} className="black-spacer half-spacer" />;
          } else {
            const key = PIANO_KEYS.find(k => k.midi === item.midi);
            return renderKey(key, 'black-key');
          }
        })}
      </div>

      <div className="key-row white-row">
        {WHITE_KEYS.map(key => renderKey(key, 'white-key'))}
      </div>
    </div>
  );
};

export default Keyboard;
