// games/plates/ui/ending.ts — sealing and the endings (story §12): C (returned, play on), the choice,
// Ottilie's second letter, the Board's reply A or B with Nell's line, plate 13, the chords, the final card.
import type { ReturnStatus } from '../contracts'
import { openSheet } from './documents'
import { ENDING_C, CHOICE_TEXT, CHOICE_A, CHOICE_B, ENVELOPE, OTTILIE_2, BOARD_A, BOARD_B, NELL_A, NELL_B, FINAL_CARD, BOOK } from '../story/text'

export interface EndingDeps {
  root: HTMLElement
  setPalette(p: 'bone' | 'ruby'): void
  seal(named: boolean | null): ReturnStatus
  releasePlate13(): void
  onDone(): void
}

/** Confirm, then seal. Shows ending C, or the choice → letters → plate 13. */
export function startSeal(d: EndingDeps, accounted: boolean): void {
  openSheet(d.root, [BOOK.sealConfirm], { cls: 'pl-doc--board pl-doc--small', buttons: [
    { label: BOOK.sealYes, on: () => accounted ? choice(d) : endingC(d) },
    { label: BOOK.sealNo, on: () => d.onDone() },
  ] })
}
export function endingC(d: EndingDeps): void {
  d.seal(null)
  d.setPalette('bone')
  openSheet(d.root, [ENDING_C], { cls: 'pl-doc--board', onClose: () => { d.setPalette('ruby'); d.onDone() }, buttons: [{ label: 'Back to the bench', on: () => { d.setPalette('ruby'); d.onDone() } }] })
}
export function choice(d: EndingDeps): void {
  openSheet(d.root, [CHOICE_TEXT], { cls: 'pl-doc--board', buttons: [
    { label: CHOICE_A, on: () => letters(d, true) },
    { label: CHOICE_B, on: () => letters(d, false) },
  ] })
}
export function letters(d: EndingDeps, named: boolean): void {
  d.seal(named)
  d.setPalette('bone')
  openSheet(d.root, [`*${ENVELOPE}*`, ...OTTILIE_2], { cls: 'pl-doc--ottilie', buttons: [{ label: 'The Board’s reply', on: () => board(d, named) }], onClose: () => board(d, named) })
}
function board(d: EndingDeps, named: boolean): void {
  openSheet(d.root, [...(named ? BOARD_A : BOARD_B), '', named ? NELL_A : NELL_B], { cls: 'pl-doc--board', buttons: [{ label: 'The camera in the corner', on: () => { d.setPalette('ruby'); d.releasePlate13(); d.onDone() } }], onClose: () => { d.setPalette('ruby'); d.releasePlate13(); d.onDone() } })
}
export function finalCard(d: { root: HTMLElement; status: ReturnStatus; wick: number; onBack(): void; onSheet(): void; onKeep(): void }): void {
  const s = d.status
  const line = `(persons examined ${s.persons}/10 · findings ${s.findings}/5 · ${s.sector ? 'the Sector accounted for' : 'the Sector not accounted for'} · Wick found ${d.wick}/14)`
  openSheet(d.root, [`**${FINAL_CARD.title}**`, `*${FINAL_CARD.sub}*`, FINAL_CARD.line, `*${line}*`], { cls: 'pl-doc--board pl-doc--final', buttons: [
    { label: FINAL_CARD.keep, on: d.onKeep }, { label: FINAL_CARD.back, on: d.onBack }, { label: FINAL_CARD.sheet, on: d.onSheet },
  ] })
}
