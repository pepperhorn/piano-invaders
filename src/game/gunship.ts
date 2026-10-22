export interface GunshipState { x: number; v: number; targetX: number }

export const GUNSHIP_SETTLE_MS = 120

// Critically damped spring. With x(t) = (A + B t) e^{-wt}, the residual after
// GUNSHIP_SETTLE_MS from 300 px must be <= 0.5 px, which needs w*t >= ~8.4,
// i.e. w >= ~70 rad/s. (2*pi/0.12*0.6 = 31 would only reach 99% in ~210 ms.)
const OMEGA = 75

export function stepGunship(s: GunshipState, dtSec: number): GunshipState {
  if (dtSec <= 0) return s
  const a = s.x - s.targetX
  const b = s.v + OMEGA * a
  const e = Math.exp(-OMEGA * dtSec)
  return {
    x: s.targetX + (a + b * dtSec) * e,
    v: (s.v - OMEGA * b * dtSec) * e,
    targetX: s.targetX,
  }
}

export function isSettled(s: GunshipState, epsPx = 0.5): boolean {
  return Math.abs(s.x - s.targetX) <= epsPx
}
