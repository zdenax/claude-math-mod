// Run: node --experimental-strip-types latex-pane/latex.selftest.ts
import assert from 'node:assert/strict'
import { extractMath, texToUnicode } from './hooks/latex.ts'

const flat = (t: string) => texToUnicode(t, { display: false }).join('\n')
const wide = (t: string) => texToUnicode(t, { display: true }).join('\n')
const show = process.argv.includes('--show')
const chk = (got: string, want: string) => {
  if (show) console.log(got + '\n')
  assert.equal(got, want)
}

chk(flat(String.raw`n! = n\cdot(n-1)\cdots(n-k+1)\cdot(n-k)!`), 'n! = n·(n−1)⋯(n−k+1)·(n−k)!')
chk(flat(String.raw`\binom{n}{k} = \frac{n!}{(n-k)!\cdot k!}`), 'C(n, k) = n!/((n−k)!·k!)')
chk(flat(String.raw`(a+b)^n = \sum_{k=0}^{n} \binom{n}{k} a^{n-k} b^k`), '(a+b)ⁿ = ∑ₖ₌₀ⁿ C(n, k) aⁿ⁻ᵏbᵏ')
chk(flat(String.raw`\delta : Q \times \Sigma \to Q`), 'δ : Q × Σ → Q')
chk(flat("V'(k,n) = n^k"), 'V′(k, n) = nᵏ')
chk(flat(String.raw`\binom{n+1}{k+1} = \frac{(n+1)!}{(k+1)!(n-k)!}`), 'C(n+1, k+1) = (n+1)!/((k+1)!(n−k)!)')

// display mode: several rows
chk(wide(String.raw`\binom{n+1}{k+1} = \frac{(n+1)!}{(k+1)!(n-k)!}`),
  '⎛n+1⎞       (n+1)!\n⎝k+1⎠ = ──────────────\n         (k+1)!(n−k)!')
chk(wide(String.raw`\sum_{k=0}^{n} k`), ' n\n ∑  k\nk=0')
chk(wide(String.raw`\underbrace{n\cdot(n-1)}_{2\ \text{faktory}}\cdot x`),
  ' n·(n−1) ·x\n╰───────╯\n2 faktory')
assert.equal(texToUnicode(String.raw`\frac{a}{b}`, { display: true, width: 2 }).join(''), 'a/b') // too narrow -> one row

// bad input never throws, text is never lost
for (const bad of ['', '   ', String.raw`\frac{1}`, '{{{', '}}}', String.raw`\unknown{x}`, '^', '_{', String.raw`\begin{align} a &= b \\ c &= d \end{align}`, '\\']) {
  const r = texToUnicode(bad, { display: true })
  assert.ok(Array.isArray(r) && r.length > 0)
}
assert.equal(flat(String.raw`\unknown{x}`), '\\unknown x')
assert.equal(flat(String.raw`\mathbb{R}^2`), 'ℝ²')

// finding math in a reply
const reply = 'Cena je $5 a $10. Vzorec $x^2$ a\n$$\\frac{a}{b}$$ i \\[ y \\] ale `$nic$` a ```\n$$no$$\n```'
assert.deepEqual(extractMath(reply), [
  { display: false, tex: 'x^2' },
  { display: true, tex: '\\frac{a}{b}' },
  { display: true, tex: 'y' },
])
// pathological input must stay fast (nested fractions used to grow exponentially)
const fast = (f: () => unknown) => { const t0 = Date.now(); f(); assert.ok(Date.now() - t0 < 1000) }
for (const bad of [String.raw`\frac{`.repeat(24), String.raw`\frac{`.repeat(600), String.raw`\underbrace{`.repeat(24)]) fast(() => texToUnicode(bad, { display: true }))
fast(() => extractMath('\\['.repeat(50000)))

console.log('latex selftest OK')
