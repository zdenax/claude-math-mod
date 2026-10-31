import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Formula } from '../types'
import { extractMath, texToUnicode } from './latex'

const PANE = 'latex'
// Change the tag when Formula changes: an earlier version's stored value is declined.
const formulas = atom({ plugin: 'latex-pane', key: 'formulas' } as const, [], { shape: 'formulas-1' })

export const register: Register = on => {
  let isOpened = false // open the pane unasked once per session; later the person decides (/tex reopens)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tex',
      description: 'Show LaTeX in a side pane: /tex <formula or text with $...$>, or just /tex for the last answer',
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const found = e.agentId ? [] : extractMath(e.answer)
    if (found.length > 0) {
      await update($, formulas, () => found.slice(0, 50))
      if (!isOpened) {
        isOpened = true
        void $.ui.open({ id: PANE, title: 'LaTeX' })
      }
    }

    return next(e)
  })

  on('command.run', { command: 'tex' }, async ($, e) => {
    const text = e.args.trim()
    if (text) {
      const found = extractMath(text)
      // no $...$ in the argument: take the whole argument as one display formula
      await update($, formulas, () => (found.length > 0 ? found : [{ display: true, tex: text }]))
    }
    await $.ui.open({ id: PANE, title: 'LaTeX' })

    return { text: 'LaTeX pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, formulas)
    const room = e.props.bodyColumns

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No LaTeX in the last answer.</Text>}
        {list.map((f: Formula) => (
          <Box flexDirection="column" marginBottom={1}>
            {texToUnicode(f.tex, { display: f.display, width: room }).map(line => (
              <Text wrap="truncate-end">{line || ' '}</Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
