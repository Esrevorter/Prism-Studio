import React from 'react';
import { useStore } from '../store.js';

// Gentle, non-intrusive contextual reminders (spec §2.2).
export default function NudgeTray() {
  const nudges = useStore((s) => s.nudges);
  const dismiss = useStore((s) => s.dismissNudge);
  return (
    <div className="nudge-tray" aria-live="polite">
      {nudges.map((n) => (
        <div key={n.id} className={`nudge${n.tone === 'warning' ? ' warning' : ''}`}>
          <span>{n.text}</span>
          <button onClick={() => dismiss(n.id)} aria-label="Dismiss reminder">×</button>
        </div>
      ))}
    </div>
  );
}
