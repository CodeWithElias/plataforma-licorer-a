import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Pos from './Pos.tsx'

// Web Component que usa el Shell Angular: <licoreria-pos></licoreria-pos>
class LicoreriaPos extends HTMLElement {
  private root?: Root

  connectedCallback() {
    this.root = createRoot(this)
    this.root.render(
      <StrictMode>
        <Pos />
      </StrictMode>,
    )
  }

  disconnectedCallback() {
    this.root?.unmount()
  }
}

if (!customElements.get('licoreria-pos')) {
  customElements.define('licoreria-pos', LicoreriaPos)
}

export { LicoreriaPos }
