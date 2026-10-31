import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'latex-pane',
  component: 'Pane',
  requestId: 'latex',
  surface: 'terminal',
  props: { title: 'LaTeX', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('a formula in the answer shows in the pane as Unicode', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.turn.complete({ answer: 'Platí $$\\frac{a}{b}$$ a $x^2$.', durationMs: 1, isAborted: false, turnId: 't', reason: 'complete' } as never)

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /──/ }))?.text).toContain('──')
  expect((await ui.find({ type: 'Text', text: /x²/ }))?.text).toBe('x²')
  await ui.unmount()
})
