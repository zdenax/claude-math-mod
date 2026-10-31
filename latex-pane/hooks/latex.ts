// LaTeX -> Unicode text. Pure functions, no dependencies, no Node/DOM APIs.
// shortcut: a subset of LaTeX (no matrices, align, \left/\right sizing, accents), unknown \commands
// are shown as written; upgrade to a real parser (or images) if the subset stops being enough.

type Box = { l: string[]; b: number } // lines + index of the baseline line
type Kind = 'o' | 'r' | 'x' | 'w' | 'p' | 'f' // ord, relation, spaced binary, wide, punct, function name
type Item = { b: Box; k: Kind }

const pairs = (a: string, b: string) => {
  const x = [...a], y = [...b]
  if (x.length !== y.length) throw new Error('bad table: ' + a)
  return new Map(x.map((c, i) => [c, y[i]]))
}
const SUP = pairs(
  '0123456789+−=()abcdefghijklmnoprstuvwxyzABDEGHIJKLMNOPRTUVWβγδθφχ',
  '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂᵝᵞᵟᶿᵠᵡ',
)
const SUB = pairs('0123456789+−=()aehijklmnoprstuvxβγρφχ', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ')

const words = (s: string) => {
  const t = s.trim().split(/\s+/), m = new Map<string, string>()
  for (let i = 0; i < t.length; i += 2) m.set(t[i], t[i + 1])
  return m
}
const GREEK = words(`alpha α beta β gamma γ delta δ epsilon ε varepsilon ε zeta ζ eta η theta θ vartheta ϑ iota ι
  kappa κ lambda λ mu μ nu ν xi ξ pi π rho ρ sigma σ tau τ upsilon υ phi φ varphi φ chi χ psi ψ omega ω
  Gamma Γ Delta Δ Theta Θ Lambda Λ Xi Ξ Pi Π Sigma Σ Phi Φ Psi Ψ Omega Ω`)
const SYM = words(`cdot · infty ∞ partial ∂ nabla ∇ emptyset ∅ varnothing ∅ forall ∀ exists ∃ neg ¬ ldots … dots …
  cdots ⋯ vdots ⋮ ddots ⋱ prime ′ hbar ℏ ell ℓ aleph ℵ angle ∠ langle ⟨ rangle ⟩ lfloor ⌊ rfloor ⌋ lceil ⌈ rceil ⌉
  pm ± mp ∓ ast ∗ bullet • lbrace { rbrace } vert | Vert ‖ sum ∑ prod ∏ int ∫ oint ∮
  bigcup ⋃ bigcap ⋂`)
const BIN = words(`times × div ÷ setminus ∖ cup ∪ cap ∩ wedge ∧ land ∧ vee ∨ lor ∨ oplus ⊕ otimes ⊗ circ ∘`)
const REL = words(`le ≤ leq ≤ ge ≥ geq ≥ ne ≠ neq ≠ approx ≈ equiv ≡ sim ∼ cong ≅ propto ∝ in ∈ notin ∉ ni ∋
  subset ⊂ subseteq ⊆ supset ⊃ supseteq ⊇ to → rightarrow → leftarrow ← gets ← Rightarrow ⇒ Leftarrow ⇐
  Leftrightarrow ⇔ leftrightarrow ↔ mapsto ↦ implies ⟹ iff ⟺ ll ≪ gg ≫ perp ⊥ parallel ∥ mid ∣
  therefore ∴ because ∵ colon : lt < gt >`)
const FUNC = new Set('sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln lg exp det dim deg gcd lcm arg ker Pr lim limsup liminf max min sup inf'.split(' '))
const LIMITS = new Set('sum prod bigcup bigcap lim limsup liminf max min sup inf'.split(' '))
const BLACKBOARD = words('R ℝ N ℕ Z ℤ Q ℚ C ℂ P ℙ')
const IGNORED = new Set('limits nolimits displaystyle textstyle scriptstyle big Big bigg Bigg bigl bigr Bigl Bigr left right'.split(' '))

const cw = (s: string) => [...s].filter(c => !/\p{M}/u.test(c)).length
const width = (x: Box) => Math.max(0, ...x.l.map(cw))
const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - cw(s)))
const center = (s: string, w: number) => {
  const left = Math.floor((w - cw(s)) / 2)
  return pad(' '.repeat(left) + s, w)
}
const box = (s: string): Box => ({ l: [s], b: 0 })

function hcat(bs: Box[]): Box {
  const up = Math.max(0, ...bs.map(x => x.b))
  const dn = Math.max(0, ...bs.map(x => x.l.length - x.b - 1))
  const rows = Array.from({ length: up + dn + 1 }, () => '')
  for (const x of bs) {
    const w = width(x)
    rows.forEach((_, r) => {
      const k = r - (up - x.b)
      rows[r] += pad(k >= 0 && k < x.l.length ? x.l[k] : '', w)
    })
  }
  return { l: rows, b: up }
}

const script = (s: string, map: Map<string, string>, mark: string) => {
  const m = [...s].map(c => map.get(c))
  if (s && m.every(Boolean)) return m.join('')
  return s.length <= 1 ? mark + s : `${mark}(${s})`
}

const isAtomic = (s: string) => {
  if (/^[\p{L}\p{N}\p{M}!′″.⁰-₟]+$/u.test(s)) return true
  const g = s.replace(/[!′]+$/, '') // `(n+1)!` counts as one group
  if (g[0] !== '(' || g.at(-1) !== ')') return false
  let d = 0
  for (const [i, c] of [...g].entries()) {
    d += c === '(' ? 1 : c === ')' ? -1 : 0
    if (d === 0 && i < g.length - 1) return false
  }
  return true
}
const paren = (s: string) => (isAtomic(s) ? s : `(${s})`)

// shortcut: tall parentheses only for 2 rows (binom); upgrade with ⎛⎜⎝ stacking for taller content
const bigParens = (x: Box): Box => {
  if (x.l.length !== 2) return hcat([box('('), x, box(')')])
  return hcat([{ l: ['⎛', '⎝'], b: x.b }, x, { l: ['⎞', '⎠'], b: x.b }])
}

class Parser {
  i = 0
  s: string
  flat: boolean
  constructor(s: string, flat: boolean) {
    this.s = s
    this.flat = flat
  }
  ws() {
    while (/\s/.test(this.s[this.i] ?? '')) this.i++
  }
  atStop() {
    const c = this.s[this.i]
    return c === '}' || c === '&' || this.s.startsWith('\\\\', this.i)
  }
  // `\\` starts a new row (shortcut: align/cases/matrix cells are only stacked as rows, `&` becomes a space)
  top(): Box {
    const rows: Box[] = []
    let cur: Box[] = []
    while (this.i < this.s.length) {
      cur.push(this.seq(true))
      if (this.s.startsWith('\\\\', this.i)) {
        this.i += 2
        rows.push(hcat(cur))
        cur = []
      } else if (this.i < this.s.length) {
        cur.push(box(' ')) // `&` or a stray `}`: skipped, so the loop always advances
        this.i++
      }
    }
    rows.push(hcat(cur))
    const real = rows.filter(r => r.l.join('').trim())
    if (real.length <= 1) return real[0] ?? box('')
    if (this.flat) return box(real.map(r => r.l[0]).join('; '))
    return { l: real.flatMap(r => r.l), b: 0 }
  }
  seq(top: boolean): Box {
    const items: Item[] = []
    for (this.ws(); this.i < this.s.length && !this.atStop(); this.ws()) items.push(this.item())
    const out: Box[] = []
    items.forEach((it, n) => {
      const p = items[n - 1]
      const t = it.b.l[0] ?? ''
      const spaced = (top && (it.k === 'r' || it.k === 'x' || p?.k === 'r' || p?.k === 'x')) || p?.k === 'w' || it.k === 'w' || p?.k === 'p' || p?.k === 'f'
      if (p && spaced && it.k !== 'p' && !/^[)\]}]/.test(t) && !(p.k === 'f' && t.startsWith('('))) out.push(box(' '))
      out.push(it.b)
    })
    return hcat(out)
  }
  item(): Item {
    const a = this.atom()
    const name = this.lastCmd
    let sup = '', sub = '', has = false
    this.ws()
    const lim = /^\\(?:no)?limits(?![a-zA-Z])/.exec(this.s.slice(this.i))
    if (lim) this.i += lim[0].length
    for (this.ws(); this.s[this.i] === '^' || this.s[this.i] === '_'; this.ws()) {
      const isSup = this.s[this.i++] === '^'
      const v = this.inFlat(() => this.arg()).l[0] ?? ''
      has = true
      if (isSup) sup = v
      else sub = v
    }
    if (!has) return a
    if (!this.flat && name && LIMITS.has(name)) {
      const w = Math.max(cw(sup), cw(a.b.l[0]), cw(sub))
      const l = [...(sup ? [center(sup, w)] : []), center(a.b.l[0], w), ...(sub ? [center(sub, w)] : [])]
      return { b: { l, b: sup ? 1 : 0 }, k: 'w' }
    }
    const text = a.b.l[0] + (sub ? script(sub, SUB, '_') : '') + (sup ? script(sup, SUP, '^') : '')
    return { b: a.b.l.length > 1 ? a.b : box(text), k: a.k === 'f' || LIMITS.has(name) ? 'w' : a.k }
  }
  lastCmd = ''
  inFlat<T>(f: () => T): T {
    const old = this.flat
    this.flat = true
    try {
      return f()
    } finally {
      this.flat = old
    }
  }
  arg(): Box {
    this.ws()
    if (this.s[this.i] === '{') return this.group()
    return this.atom().b
  }
  group(): Box {
    this.i++ // {
    const b = this.seq(false)
    if (this.s[this.i] === '}') this.i++
    return b
  }
  raw(): string {
    this.ws()
    if (this.s[this.i] !== '{') return this.s[this.i++] ?? ''
    let d = 0, out = ''
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i]
      d += c === '{' ? 1 : c === '}' ? -1 : 0
      if (d === 0) break
      if (!(d === 1 && c === '{')) out += c
    }
    this.i++
    return out
  }
  atom(): Item {
    this.lastCmd = ''
    this.ws()
    const c = this.s[this.i++] ?? ''
    if (c === '{') {
      this.i--
      return { b: this.group(), k: 'o' }
    }
    if (c !== '\\') return this.char(c)
    const m = /^[a-zA-Z]+/.exec(this.s.slice(this.i))
    const name = m ? m[0] : (this.s[this.i] ?? '')
    this.i += name.length || 1
    return this.cmd(name)
  }
  char(c: string): Item {
    if (c === '-') return { b: box('−'), k: 'o' }
    if (c === "'") return { b: box('′'), k: 'o' }
    if (c === ',') return { b: box(','), k: 'p' }
    if ('=<>:'.includes(c)) return { b: box(c), k: 'r' }
    if (c === '~') return { b: box(' '), k: 'o' }
    return { b: box(c), k: 'o' }
  }
  cmd(n: string): Item {
    this.lastCmd = n
    const o = (b: Box, k: Kind = 'o'): Item => ({ b, k })
    const t = (s: string, k: Kind = 'o') => o(box(s), k)
    if (GREEK.has(n)) return t(GREEK.get(n)!)
    if (REL.has(n)) return t(REL.get(n)!, 'r')
    if (BIN.has(n)) return t(BIN.get(n)!, 'x')
    if (FUNC.has(n)) return t(n, 'f')
    if (SYM.has(n)) return t(SYM.get(n)!, LIMITS.has(n) ? 'w' : 'o')
    if (IGNORED.has(n)) return t('')
    switch (n) {
      case 'begin': case 'end': this.raw(); return t('') // environment names are dropped
      case 'quad': return t('  ')
      case 'qquad': return t('    ')
      case ',': case ';': case ':': case ' ': return t(' ')
      case '!': return t('')
      case '{': case '}': case '|': case '%': case '$': case '&': case '#': case '_':
        return t(n === '|' ? '‖' : n)
      case 'frac': case 'dfrac': case 'tfrac': {
        const a = this.arg(), d = this.arg()
        if (this.flat || a.l.length > 1 || d.l.length > 1) {
          const s = (x: Box) => x.l.join(' ')
          return t(`${paren(s(a))}/${paren(s(d))}`, 'w')
        }
        const w = Math.max(cw(a.l[0]), cw(d.l[0])) + 2
        return o({ l: [center(a.l[0], w), '─'.repeat(w), center(d.l[0], w)], b: 1 }, 'w')
      }
      case 'binom': case 'dbinom': case 'tbinom': {
        const a = this.arg(), d = this.arg()
        if (this.flat) return t(`C(${a.l[0]}, ${d.l[0]})`, 'w')
        const w = Math.max(cw(a.l[0]), cw(d.l[0]))
        return o(bigParens({ l: [center(a.l[0], w), center(d.l[0], w)], b: 1 }), 'w')
      }
      case 'sqrt': {
        let idx = ''
        this.ws()
        if (this.s[this.i] === '[') {
          const e = this.s.indexOf(']', this.i)
          idx = this.s.slice(this.i + 1, e < 0 ? this.i + 1 : e)
          this.i = e < 0 ? this.i + 1 : e + 1
        }
        const x = this.inFlat(() => this.arg()).l[0]
        const root = idx === '3' ? '∛' : idx === '4' ? '∜' : idx ? script(idx, SUP, '^') + '√' : '√'
        return t(root + paren(x))
      }
      case 'text': case 'mbox': case 'textrm': case 'textbf': case 'textit': return t(this.raw())
      case 'mathbb': {
        const r = this.raw()
        return t([...r].map(c => BLACKBOARD.get(c) ?? c).join(''))
      }
      case 'operatorname': return t(this.raw(), 'f')
      case 'mathrm': case 'mathbf': case 'mathit': case 'mathcal': case 'boldsymbol': case 'bm':
        return o(this.arg()) // shortcut: font styles dropped; add Unicode math alphabets if wanted
      case 'underbrace': case 'overbrace': {
        const x = this.arg(), up = n === 'overbrace'
        this.ws()
        const lab = this.s[this.i] === (up ? '^' : '_') ? (this.i++, this.arg()) : box('')
        if (this.flat || x.l.length > 1) return t(`${x.l.join(' ')}⏟${lab.l[0] ? `(${lab.l[0]})` : ''}`)
        const w = Math.max(cw(x.l[0]), cw(lab.l[0]))
        const br = up ? '╭' + '─'.repeat(Math.max(0, w - 2)) + '╮' : '╰' + '─'.repeat(Math.max(0, w - 2)) + '╯'
        const l = up ? [center(lab.l[0], w), br, center(x.l[0], w)] : [center(x.l[0], w), br, center(lab.l[0], w)]
        return o({ l, b: up ? 2 : 0 })
      }
      case 'pmod': return t(` (mod ${this.inFlat(() => this.arg()).l[0]})`)
      case 'bmod': return t(' mod ')
      default: return t('\\' + n, 'f') // unknown command: shown as written
    }
  }
}

// Renders one formula to lines. display = may use several rows; width = the room (columns).
// Broken or too long input never throws: worst case the original text comes back.
export function texToUnicode(tex: string, opts: { display?: boolean; width?: number } = {}): string[] {
  const src = tex.trim()
  if (!src || src.length > 4000) return [src]
  const room = opts.width ?? 80
  try {
    for (const flat of opts.display ? [false, true] : [true]) {
      const lines = new Parser(src, flat).top().l.map(s => s.trimEnd())
      if (flat || Math.max(...lines.map(cw)) <= room) return lines
    }
  } catch {
    /* fall through to the raw text */
  }
  return [src]
}

export type Formula = { display: boolean; tex: string }

const MATH =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\\begin\{(equation|align|gather)(\*?)\}([\s\S]+?)\\end\{\4\5\}|(?<![\\$])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?!\d)/g

// shortcut: `$...$` is guessed (no space inside the edges, no digit after), so odd prose with two dollar signs may slip through
export function extractMath(text: string): Formula[] {
  const noCode = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, m => ' '.repeat(m.length))
  return [...noCode.matchAll(MATH)].map(m => {
    const tex = m[1] ?? m[2] ?? m[3] ?? m[6] ?? m[7]
    return { display: m[7] === undefined && m[3] === undefined, tex: tex.trim() }
  })
}
