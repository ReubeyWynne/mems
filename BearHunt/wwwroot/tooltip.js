// Datastar attribute plugin: data-tip
// Replaces CSS pseudo-element tooltips with Popover + CSS Anchor Positioning.
// Tooltips render in the top layer: no z-index fighting, no overflow clipping.
// On mobile viewports within .tl, tooltips position to the right instead of above.
//
// Usage:
//   <div data-tip="Rally fires at 5:00" class="tl-fire" style="--at:5.0"></div>

import { attribute } from 'https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.2/bundles/datastar.js'

let tipId = 0

const mobileQuery = window.matchMedia('(max-width: 640px)')

attribute({
  name: 'tip',
  requirement: {
    key: 'denied',
    value: 'allowed',
  },

  apply({ el, value }) {
    const text = value
    if (!text) return

    const id = ++tipId
    const anchorName = `--tip-${id}`

    const tip = document.createElement('div')
    tip.popover = 'manual'
    tip.className = 'tl-tooltip'
    tip.textContent = text
    tip.style.positionAnchor = anchorName

    el.style.anchorName = anchorName
    document.body.appendChild(tip)

    const updatePosition = () => {
      const insideTl = el.closest('.tl')
      if (insideTl && mobileQuery.matches) {
        tip.style.setProperty('position-area', 'right')
      } else {
        tip.style.setProperty('position-area', 'top')
      }
    }

    const show = () => {
      updatePosition()
      tip.showPopover()
    }

    const hide = () => {
      tip.hidePopover()
    }

    const onResize = () => {
      if (tip.matches(':popover-open')) {
        updatePosition()
      }
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    el.addEventListener('focus', show)
    el.addEventListener('blur', hide)
    mobileQuery.addEventListener('change', onResize)

    return () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      el.removeEventListener('focus', show)
      el.removeEventListener('blur', hide)
      mobileQuery.removeEventListener('change', onResize)
      tip.remove()
      el.style.anchorName = ''
    }
  },
})
