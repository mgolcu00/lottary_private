import { useState } from 'react';
import './ChristmasEffects.css';

export function Snowflakes() {
  const [snowflakes] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 3 + 6}s`,
      animationDelay: `${Math.random() * 5}s`,
      fontSize: `${Math.random() * 10 + 12}px`
    }))
  );

  return (
    <div className="christmas-snowflakes">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: flake.left,
            animationDuration: flake.animationDuration,
            animationDelay: flake.animationDelay,
            fontSize: flake.fontSize
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
}

export function ChristmasDecorations() {
  const [decorations] = useState(() => [
    { id: 1, emoji: '🎄', top: '5%', left: '5%', size: '60px', delay: '0s' },
    { id: 2, emoji: '🎅', top: '8%', right: '8%', size: '50px', delay: '1s' },
    { id: 3, emoji: '🎁', bottom: '10%', left: '10%', size: '45px', delay: '2s' },
    { id: 4, emoji: '⛄', bottom: '8%', right: '12%', size: '55px', delay: '3s' },
    { id: 5, emoji: '🔔', top: '15%', left: '50%', size: '40px', delay: '1.5s' },
    { id: 6, emoji: '⭐', top: '40%', left: '5%', size: '35px', delay: '2.5s' },
    { id: 7, emoji: '🎀', top: '60%', right: '8%', size: '40px', delay: '0.5s' }
  ]);

  return (
    <div className="christmas-decorations">
      {decorations.map((deco) => (
        <div
          key={deco.id}
          className="christmas-decoration"
          style={{
            top: deco.top,
            left: deco.left,
            right: deco.right,
            bottom: deco.bottom,
            fontSize: deco.size,
            animationDelay: deco.delay
          }}
        >
          {deco.emoji}
        </div>
      ))}
    </div>
  );
}

export function ChristmasLights() {
  const [lights] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${(i * 100) / 20}%`,
      color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'][i % 5],
      delay: `${i * 0.1}s`
    }))
  );

  return (
    <div className="christmas-lights">
      {lights.map((light) => (
        <div
          key={light.id}
          className="christmas-light"
          style={{
            left: light.left,
            backgroundColor: light.color,
            animationDelay: light.delay
          }}
        />
      ))}
    </div>
  );
}
