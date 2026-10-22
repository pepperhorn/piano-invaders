export interface LiveNote { id: number; midi: number; x: number; y: number; group?: number; alive: boolean }
export type Shot = { noteId: number; kind: 'straight' | 'explosive'; fromX: number }

export function resolvePress(
  midi: number,
  gunX: number,
  keyX: (midi: number) => number,
  live: LiveNote[],
): { moveTo: number | null; shots: Shot[] } {
  let target: LiveNote | undefined
  for (const n of live) {
    if (n.alive && n.midi === midi && (!target || n.y > target.y)) target = n
  }
  if (!target) return { moveTo: null, shots: [] }

  if (target.group === undefined) {
    const x = keyX(midi)
    return { moveTo: x, shots: [{ noteId: target.id, kind: 'straight', fromX: x }] }
  }

  const siblings = live.filter(n => n.group === target!.group && n.id !== target!.id)
  if (siblings.length === 0) {
    const x = keyX(midi)
    return { moveTo: x, shots: [{ noteId: target.id, kind: 'straight', fromX: x }] }
  }
  // A sibling already shot (anchor gone): remaining members are explosive from the gun.
  if (siblings.some(n => !n.alive)) {
    return { moveTo: null, shots: [{ noteId: target.id, kind: 'explosive', fromX: gunX }] }
  }

  let anchor = target
  for (const n of siblings) {
    if (Math.abs(keyX(n.midi) - gunX) < Math.abs(keyX(anchor.midi) - gunX)) anchor = n
  }
  const ax = keyX(anchor.midi)
  if (anchor.id === target.id) return { moveTo: ax, shots: [{ noteId: target.id, kind: 'straight', fromX: ax }] }
  return { moveTo: ax, shots: [{ noteId: target.id, kind: 'explosive', fromX: ax }] }
}
