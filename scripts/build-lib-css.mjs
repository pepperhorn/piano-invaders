// lib/style.css = src/styles/piano-invaders.css (already one `@layer piano-invaders { ... }`),
// verified to be scoped under .piano-invaders with no viewport units, fixed positions or font imports.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/styles/piano-invaders.css', import.meta.url), 'utf8')
const problems = []
if (!/@layer piano-invaders\s*\{/.test(src)) problems.push('missing @layer piano-invaders')
if (/@import/.test(src)) problems.push('@import found')
if (/\b\d*\.?\d+(vh|dvh|svh|lvh|vw)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, ''))) problems.push('viewport unit found')
if (/position:\s*fixed/.test(src)) problems.push('position: fixed found')
if (problems.length) { console.error('lib CSS check failed:\n  ' + problems.join('\n  ')); process.exit(1) }
mkdirSync(new URL('../lib/', import.meta.url), { recursive: true })
writeFileSync(new URL('../lib/style.css', import.meta.url), src)
rmSync(new URL('../lib/piano-invaders.css', import.meta.url), { force: true })
console.log('wrote lib/style.css')
