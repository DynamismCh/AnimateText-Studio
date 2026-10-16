export type CartoonAction = 'walk' | 'run' | 'jump' | 'wave' | 'dance' | 'talk';

export type MotionFrame = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  shadowScale: number;
  speedLines: boolean;
  sparkles: boolean;
  interaction: number;
};

/**
 * Lightweight, deterministic 2D motion curves.
 * Designed to run in the browser without a GPU or external inference service.
 * Progress is expected to be in the 0..1 range for the current scene.
 */
export function getMotionFrame(action: CartoonAction, progress: number, actorIndex: number): MotionFrame {
  const t = Math.max(0, Math.min(1, progress));
  const phase = t * Math.PI * 2;
  const offset = actorIndex === 0 ? 1 : -1;
  const frame: MotionFrame = {
    x: 0,
    y: Math.sin(phase * 2 + actorIndex * 0.7) * 3,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    shadowScale: 1,
    speedLines: false,
    sparkles: false,
    interaction: 0,
  };

  switch (action) {
    case 'walk':
      frame.x = Math.sin(phase) * 25 * offset;
      frame.y += Math.abs(Math.sin(phase * 2 + actorIndex)) * -7;
      frame.rotation = Math.sin(phase) * 0.055 * offset;
      frame.scaleY = 1 + Math.abs(Math.sin(phase * 2)) * 0.035;
      frame.scaleX = 1 - Math.abs(Math.sin(phase * 2)) * 0.025;
      frame.shadowScale = 1 - Math.abs(Math.sin(phase * 2)) * 0.12;
      frame.interaction = Math.max(0, 1 - Math.abs(t - 0.5) * 3);
      break;
    case 'run':
      frame.x = Math.sin(phase * 1.4) * 42 * offset;
      frame.y += Math.abs(Math.sin(phase * 2.8 + actorIndex)) * -18;
      frame.rotation = Math.sin(phase * 1.4) * 0.12 * offset;
      frame.scaleY = 1 + Math.abs(Math.sin(phase * 2.8)) * 0.07;
      frame.scaleX = 1 - Math.abs(Math.sin(phase * 2.8)) * 0.045;
      frame.shadowScale = 0.7 + Math.abs(Math.sin(phase * 2.8)) * 0.2;
      frame.speedLines = true;
      break;
    case 'jump': {
      const jump = Math.max(0, Math.sin(t * Math.PI * 2));
      frame.y -= jump * 62;
      frame.rotation = Math.sin(phase) * 0.035;
      frame.scaleX = 1 + jump * 0.045;
      frame.scaleY = 1 - jump * 0.035;
      frame.shadowScale = 1 - jump * 0.35;
      frame.sparkles = jump > 0.55;
      break;
    }
    case 'wave':
      frame.rotation = Math.sin(phase * 2) * 0.09;
      frame.x = Math.sin(phase) * 5 * offset;
      frame.sparkles = Math.sin(phase * 2) > 0.65;
      break;
    case 'dance':
      frame.x = Math.sin(phase * 2 + actorIndex) * 24;
      frame.y -= Math.abs(Math.sin(phase * 2 + actorIndex)) * 23;
      frame.rotation = Math.sin(phase * 2 + actorIndex) * 0.16;
      frame.scaleX = 1 + Math.sin(phase * 2) * 0.035;
      frame.scaleY = 1 - Math.sin(phase * 2) * 0.035;
      frame.shadowScale = 0.8 + Math.abs(Math.sin(phase * 2)) * 0.15;
      frame.sparkles = true;
      break;
    case 'talk':
      frame.x = Math.sin(phase * 0.7 + actorIndex) * 7;
      frame.rotation = Math.sin(phase * 1.2 + actorIndex) * 0.025;
      frame.scaleY = 1 + Math.max(0, Math.sin(phase * 3 + actorIndex)) * 0.018;
      frame.interaction = Math.max(0, Math.sin(t * Math.PI * 2 + actorIndex * Math.PI));
      break;
  }

  return frame;
}
