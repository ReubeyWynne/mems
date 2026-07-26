// Datastar attribute plugin: data-intl-time
// Converts UTC times in <time> elements to local time via Intl.DateTimeFormat.
// Highlights converted elements; click to toggle between local and UTC.
//
// Usage:
//   <time data-intl-time="date" datetime="2026-07-26T00:00:00Z">…</time>
//   <time data-intl-time="time" datetime="2026-07-26T14:30:00Z">…</time>
//   <time data-intl-time        datetime="2026-07-26T14:30:00Z">…</time>  (defaults to "full")

import { attribute } from 'https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.2/bundles/datastar.js'

const FORMAT_OPTIONS = {
  date: { dateStyle: 'full' },
  time: { timeStyle: 'short' },
  full: { dateStyle: 'full', timeStyle: 'short' },
}

const formatDate = (iso, options, timeZone) => {
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) throw new Error('Invalid date')
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date)
  } catch {
    return iso
  }
}

attribute({
  name: 'intl-time',
  requirement: {
    key: 'denied',
    value: 'allowed',
  },

  apply({ el, value }) {
    const format = value || 'full'
    const options = FORMAT_OPTIONS[format] || FORMAT_OPTIONS.full

    let showingUtc = false
    const utcRaw = el.getAttribute('datetime')
    if (!utcRaw) return

    const localText = formatDate(utcRaw, options)
    const utcText = formatDate(utcRaw, options, 'UTC')

    const update = () => {
      el.textContent = showingUtc ? utcText : localText
      el.classList.toggle('intl-showing-utc', showingUtc)
    }

    el.classList.add('intl-converted')
    el.title = showingUtc ? 'Click for local time' : 'Click for UTC'

    const onClick = () => {
      showingUtc = !showingUtc
      el.title = showingUtc ? 'Click for local time' : 'Click for UTC'
      update()
    }
    el.addEventListener('click', onClick)

    update()

    return () => {
      el.removeEventListener('click', onClick)
      el.classList.remove('intl-converted', 'intl-showing-utc')
      el.title = ''
    }
  },
})
