// Bear Academy — lesson interactivity (vanilla ES module, no framework)
// Lesson 2 (Split, Don't Stack): Q = simultaneous rallies (max 6).
// Damage follows the square-root rule: Q equal rallies deal √Q × the damage of
// one big march, regardless of troop composition. Pure relative numbers — no
// member data.

const qSlider = document.getElementById('q-slider')

if (qSlider) {
  const qValue = document.getElementById('q-value')
  const splitRatio = document.getElementById('split-ratio')

  const update = () => {
    const q = Number(qSlider.value)
    const ratio = Math.sqrt(q)
    if (qValue) qValue.textContent = String(q)
    if (splitRatio) splitRatio.textContent = ratio.toFixed(1)
  }

  qSlider.addEventListener('input', update)
  update()
}

// Lesson 3 (Formation): the Custom stats panel only shows for the "Custom
// stats" leader, and Compute updates the numbers without reloading the page.

const formationForm = document.getElementById('formation-form')
const leaderSelect = formationForm?.querySelector('select[name="leader"]')
const customStats = document.getElementById('custom-stats')
const formationOutput = document.getElementById('formation-output')

if (leaderSelect && customStats) {
  const sync = () => { customStats.open = leaderSelect.value === 'custom' }
  leaderSelect.addEventListener('change', sync)
  sync()
}

if (formationForm && formationOutput) {
  formationForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const params = new URLSearchParams(new FormData(formationForm))
    const url = `${location.pathname}?${params.toString()}`
    fetch(url, { headers: { Accept: 'text/html' } })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const next = doc.getElementById('formation-output')
        if (next) formationOutput.innerHTML = next.innerHTML
        history.replaceState(null, '', url)
      })
      .catch(() => formationForm.submit()) // fall back to a plain GET if the fetch fails
  })
}
