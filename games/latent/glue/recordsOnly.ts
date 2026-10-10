// Records-only mode (GDD §11.7): a DOM amber terminal with the same search, documents and tape.
import { installGameApi } from '@shared/core'
import { RECORDS_ONLY, TERM } from '../data/text'
import { getDoc, search } from '../search'

export function recordsOnly(stage: HTMLElement): void {
  const root = document.createElement('div')
  root.className = 'li-records'
  const note = document.createElement('p'); note.className = 'li-records-note'; note.textContent = RECORDS_ONLY
  const form = document.createElement('form')
  const input = document.createElement('input'); input.setAttribute('aria-label', 'Search the records'); input.autocapitalize = 'characters'; input.value = 'HOLD'
  const out = document.createElement('div'); out.setAttribute('aria-live', 'polite')
  form.append(input)
  root.append(note, form, out)
  stage.append(root)
  const show = (q: string): void => {
    const r = search(q)
    out.innerHTML = ''
    const st = document.createElement('p')
    st.textContent = r.status === 'ok' ? TERM.results(r.count) : r.status === 'none' ? TERM.none : r.status === 'everything' ? TERM.everything : r.status === 'tooMany' ? TERM.tooMany : r.status === 'help' ? TERM.help : ''
    out.append(st)
    for (const id of r.shown) {
      const d = getDoc(id)!
      const b = document.createElement('button'); b.type = 'button'; b.textContent = `${d.date}  ${d.id}  ${d.type}`
      b.addEventListener('click', () => {
        out.innerHTML = ''
        const pre = document.createElement('div')
        pre.textContent = [`${d.id} · ${d.date} · ${d.type}`, d.headline, ...d.body, ...d.margin.map((m) => `(${m.tag}) ${m.text}`)].filter(Boolean).join('\n\n')
        out.append(pre)
      })
      out.append(b)
    }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); show(input.value) })
  show('HOLD')
  installGameApi('latent', 'latent@1', { state: () => ({ recordsOnly: true }), search: (q: string) => search(q) })
}
