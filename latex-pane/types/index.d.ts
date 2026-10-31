export type Formula = { display: boolean; tex: string }

declare module 'claude-code' {
  interface PluginState {
    'latex-pane': { formulas: Formula[] }
  }
}
