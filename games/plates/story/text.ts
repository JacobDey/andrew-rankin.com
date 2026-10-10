// games/plates/story/text.ts — every FINAL string from plates-story.md §7, §8, §12 and §13, verbatim.
// Markup: *italic* runs are rendered in Ottilie's/Amos's hand; ** marks small capitals (the Board).
import type { SoulId, FateId, FindingId } from '../contracts'

export interface DocDef { id: string; title: string; voice: 'board' | 'ottilie' | 'amos' | 'print' | 'nell'; paras: string[] }

export const DOCS: DocDef[] = [
  { id: 'board', title: 'The Board’s covering note', voice: 'board', paras: [
    '**BOARD OF SEA LAMPS**',
    '*Office of the Secretary, 14 Wharf Row, Trevennor. 12th October, 1888.*',
    'To the Board’s Examiner of Plates.',
    'You will proceed by Tuesday’s tender to Gaunt Rock, where the old tower is to be extinguished upon the lighting of the new on the 1st prox.',
    'Under the bench of the store-room lately used by Miss O. Frane as a dark-room you will find a tin of exposed photographic plates, of which the Board was informed by the enclosed letter, received after Miss Frane’s death.',
    'You will develop the plates upon the Rock, as the letter desires, and compare them with the Return of the Board’s Inquiry into the stranding of the ketch *Annick Rose* (enclosed). You will name each person shown upon the plates and state his or her part, and where the plates show a Finding of the Inquiry to be in error you will so mark it, citing the plate.',
    'The Board reminds you that white light is on no account to be admitted to the store while plates are uncovered.',
    'I am, &c.,',
    '**H. J. CALLOW**, *Secretary.*',
  ] },
  { id: 'ottilie1', title: 'Miss Frane’s letter', voice: 'ottilie', paras: [
    '*Wendlow, 30th August 1888.*',
    'Gentlemen,',
    'Under the bench in the store-room at Gaunt Rock there is a tin of twelve plates and a trial. I exposed them on the 10th, 11th and 12th of November last. I have not developed them.',
    'I am not able to come back to the Rock, and they must not be carried off it. They have waited a year in the dark and would not bear the journey. Send someone who knows the work. Let them develop the plates there, with my lamp, and then let them read your Return again.',
    'I am sorry it has taken me so long. I was keeping a promise, and I have found that I cannot keep it and a good man’s name as well.',
    '*Ottilie Frane.*',
  ] },
  { id: 'inquiry', title: 'Return of Inquiry', voice: 'board', paras: [
    '**BOARD OF SEA LAMPS: RETURN OF INQUIRY**',
    'Into the stranding of the ketch ANNICK ROSE, of Trevennor, upon the Teeth, Gaunt Rock, on the 11th November 1887, and the loss of life attending it. Held at Trevennor, 2nd to 4th December 1887. Captain R. Oddie, R.N., Inspector of Lights, presiding.',
    '**FINDINGS**',
    '**1.** That the ruby glass of Sector III of the Gaunt Rock light was carried away by a sea breaking in the lantern glazing at or about 7.10 p.m., as entered in the Station Log, whereby the light showed white over the Teeth.',
    '**2.** That the First Assistant Keeper, S. Penwarden, exhibited from the gallery at or about 7 p.m. a steady light not authorised by the Board’s Regulations, which the vessel may have taken for a leading light.',
    '**3.** That the seaman A. Rype came by his death through a blow to the head, the hand being unknown, his body having been recovered by the said Penwarden.',
    '**4.** That spirits from the cargo of the vessel were taken into the station on the night of the stranding and there broached, the First Assistant being chiefly answerable.',
    '**5.** That the Second Assistant Keeper, D. Lusk, was carried off the landing by the sea and drowned while assisting in the rescue of the vessel’s company.',
    '**CONCLUSION.** The First Assistant Keeper to be dismissed the Service. The Principal Keeper to be commended for his prompt entry of the Log. No blame to attach to the watch.',
  ] },
  { id: 'muster', title: 'Station muster', voice: 'print', paras: [
    '**GAUNT ROCK LIGHT: MUSTER, NOVEMBER 1887**',
    'Amos Ketteridge. Principal Keeper. Aged 56. Thirty-one years’ service.',
    'Saul Penwarden. First Assistant Keeper. Aged 41. Late R.N. Nine years’ service.',
    'David Lusk. Second Assistant Keeper. Aged 19. Appointed September 1887.',
    'Keturah Ketteridge. Wife of the Principal Keeper. Aged 47.',
    'Nell Ketteridge. Daughter of the same. Aged 11.',
    '*Visitor by the Board’s leave:* Miss Ottilie Frane, photographer. Aged 34. Landed 4th November.',
    '*(added in pencil, in a child’s hand)* and WICK the cat',
  ] },
  { id: 'crew', title: 'Crew list of the Annick Rose', voice: 'print', paras: [
    '**ANNICK ROSE**, ketch, of Trevennor, 61 tons. Bound Trevennor for Saltinch with brandy, salt and slate.',
    'Caleb Hosken. Master. Aged 52. Born Trevennor.',
    'Joseph Abery. Mate. Aged 33. Born Pellow Cove.',
    'Anders Rype. A.B. Aged 24. Born Norway.',
    'Thomas Shilling. Boy. Aged 13. Born Trevennor.',
  ] },
  { id: 'stores', title: 'Stores Return (extract)', voice: 'print', paras: [
    '**GAUNT ROCK: STORES RETURN, QUARTER TO 30th SEPTEMBER 1887** *(extract)*',
    'Wicks, circular, No. 2: 48',
    'Colza oil, gallons: 610',
    'Chimney glasses: 22',
    '**Ruby glass for Sector, spare panes, 10 in. × 12 in.: 1 broken in landing; 0 serviceable. Replacement requisitioned 3rd Oct. A.K.**',
    'Linen for the lens, yards: 14',
  ] },
  { id: 'log', title: 'Station Log (facsimile)', voice: 'amos', paras: [
    '*Friday 11th November 1887.*',
    '*6h00. Wind SW 6, rising. Heavy sea struck tower 6h05. No damage.*',
    '*10h00. Lens cleaned. Glazing cleaned. Sector glasses examined, in order. A.K.*',
    '*16h32. Lit up. All in order. A.K.*',
    '*19h00. Wind SW 9. Vessel standing in to E.*',
    '~*19h10. Sea broke in the lantern glazing & carried away Sector glass III. Canvas rigged. A.K.*',
    '*19h15. Vessel struck upon the Teeth.*',
    '*19h35. All hands to the landing. Line got to the vessel.*',
    '*19h50. D. Lusk, 2nd Asst., carried off the landing by the sea & drowned.*',
    '*21h00. Body of a seaman recovered by S.P.*',
    '*Saturday 12th. 0h00. Wind SW 8. Light burning well. S.P.*',
  ] },
  { id: 'abery', title: 'Deposition of Joseph Abery, Mate', voice: 'print', paras: [
    '“We were running for the lee of the Rock and kept the light red on our quarter, as the Master knew it. About seven the red went white on us, all of a sudden as it seemed, and the Master said we were past the Teeth and stood in. Then a light was shown from the gallery, steady as I thought, and we stood on for it. We struck about a quarter past. I came ashore on the keeper’s line (the big man’s) with my arm broke. I saw the boy go into the water, and the young keeper go down after him. Rype was in the sea by the outer rocks, holding to the boom, when I saw him last. I never saw the Master after the mast went.”',
  ] },
  { id: 'penwarden', title: 'Statement of Saul Penwarden', voice: 'print', paras: [
    '“I saw her standing in from my window and knew she was wrong. I took the hand-lamp up to the gallery and swung it to warn her off, as any man would. I did not show a steady light. I did not broach any cask. I take nothing, and have not since the Navy. I found the Norwegian in the gully below the landing and carried him up, and he was dead when I found him. The Principal Keeper was at the lamp. I did not look at the Sector glass. I had no cause to. I will not say more, for I am not believed.”',
  ] },
  { id: 'exhibit7', title: 'Exhibit 7', voice: 'ottilie', paras: [
    '*Trevennor, 20th Octr. 1887.* Mr S. Penwarden. Sir: the sum of Fourteen Pounds lent upon your note in March for your wife’s doctoring is now three months past due. I must have it by Christmas or I shall go to the Board. *J. Treloar.*',
  ] },
]

export const REGISTER_COVER = 'Register of Exposures. O. Frane. Gaunt Rock, Novr. 1887. Extra rapid dry plates, stereoscopic, 6¾ × 3¼.'
export const REGISTER_TRIAL = [
  'Trial of the batch, the store-room door. f/16, 20 sec. Wick would sleep in the plate box.',
  'Rules for whoever helps me:',
  '1. Ruby light only, until the milk is gone.',
  '2. Rock it corner to corner. Stop when the eighth square shows.',
  '3. Water, then hypo, till the glass is clear.',
  '4. The canary lamp is for fixed glass. Lay it on the velvet to see it as it was.',
]

export const SOUL_NAMES: Record<SoulId, string> = {
  saul: 'Saul Penwarden', amos: 'Amos Ketteridge', nell: 'Nell Ketteridge', keturah: 'Keturah Ketteridge', davy: 'David Lusk',
  hosken: 'Caleb Hosken', rype: 'Anders Rype', abery: 'Joseph Abery', ottilie: 'Ottilie Frane', shilling: 'Thomas Shilling',
}
export const SOUL_ORDER: SoulId[] = ['amos', 'keturah', 'nell', 'saul', 'davy', 'ottilie', 'hosken', 'abery', 'rype', 'shilling']
export const FATE_LABELS: Record<FateId, string> = {
  survived: 'Survived', rescuedBy: 'Rescued from the sea by…', drowned: 'Drowned', drownedSaving: 'Drowned saving…',
  mast: 'Crushed by the falling mast', struckBy: 'Struck down by…', cold: 'Died of cold', lost: 'Lost; body not found',
}
export const FATE_ORDER: FateId[] = ['survived', 'rescuedBy', 'drowned', 'drownedSaving', 'mast', 'struckBy', 'cold', 'lost']
export const FATE_TAKES_AGENT: Record<FateId, boolean> = { survived: false, rescuedBy: true, drowned: false, drownedSaving: true, mast: false, struckBy: true, cold: false, lost: false }

export const FINDING_TEXT: Record<FindingId, string> = {
  f1: 'That the ruby glass of Sector III of the Gaunt Rock light was carried away by a sea breaking in the lantern glazing at or about 7.10 p.m., as entered in the Station Log, whereby the light showed white over the Teeth.',
  f2: 'That the First Assistant Keeper, S. Penwarden, exhibited from the gallery at or about 7 p.m. a steady light not authorised by the Board’s Regulations, which the vessel may have taken for a leading light.',
  f3: 'That the seaman A. Rype came by his death through a blow to the head, the hand being unknown, his body having been recovered by the said Penwarden.',
  f4: 'That spirits from the cargo of the vessel were taken into the station on the night of the stranding and there broached, the First Assistant being chiefly answerable.',
  f5: 'That the Second Assistant Keeper, D. Lusk, was carried off the landing by the sea and drowned while assisting in the rescue of the vessel’s company.',
}

export const SECTOR_Q = {
  when: { q: 'When was the glass of Sector III removed?', options: ['Before 10.15 a.m.', 'Between 10.15 a.m. and 1.50 p.m.', 'Between 1.50 p.m. and lighting-up', 'At 7.10 p.m., by the sea'] },
  where: { q: 'Where is the glass now?' },
  who: { q: 'By whose hand?' },
  why: { q: 'Why was the white not seen from the lantern?', options: ['The watch was not kept', 'The Principal Keeper’s sight had failed', 'Canvas was over the frame', 'The lamp was not yet lit'] },
}

export const BOOK = {
  spine: 'RETURN', spine2: 'B.S.L.',
  tabs: { persons: 'Persons', findings: 'Findings', sector: 'The Sector', documents: 'Documents' },
  personsHeader: 'Each person shown upon the plates to be named, and his or her part stated.',
  emptyRow: '(not yet seen upon a plate)',
  fieldName: 'Name', fieldPart: 'Part', fieldAgent: 'by / saving',
  findingsHeader: 'Where a Finding is shown to be in error, mark it Withdrawn and cite the plate.',
  stands: 'Stands', withdraw: 'Withdraw', citeSlot: 'drag a plate here',
  sectorHeader: 'Of the glass of Sector III.',
  stamps: { examined: 'EXAMINED', withdrawn: 'WITHDRAWN', stands: 'STANDS', found: 'FOUND', accounted: 'ACCOUNTED FOR' },
  seal: 'Seal the Return', sealConfirm: 'Send the Return to the Board as it stands?', sealYes: 'Seal', sealNo: 'Not yet',
}
export const FOUND_TEXT = 'in the dark-room lamp, where you have been working under it.'

export const ENDING_C = '**BOARD OF SEA LAMPS.** The Board has received the Examiner’s Return, which it finds incomplete in particulars. It is returned herewith for further inquiry. *H. J. Callow, Secretary.*'
export const CHOICE_TEXT = 'The Board will ask whose hand. You may name it, or you may write *“a person unknown”*; the plates will clear Mr Penwarden either way.'
export const CHOICE_A = 'Name the hand'
export const CHOICE_B = 'Write: “a person unknown”'
export const ENVELOPE = 'To be opened when the Return is made. O. F.'
export const OTTILIE_2 = [
  'If you have read the lamp, you know.',
  'She was eleven. She saw that I could not work, and she loved the work, and she thought she could have the glass back in its frame before the light was wanted. Her father went up to light the lamp before she had the courage to follow him, and his eyes, which he had hidden from the Board for two years, did not see the empty frame. I never asked her where she had found red glass the size of my window. I knew by supper. I did nothing until the ship was on the Teeth, and then there was nothing to do but burn ribbon.',
  'In the night Mr Ketteridge found her wool on the frame and wrote the lie into his book, to save her and to save his place. In the morning she came to me and asked me to keep it. I put the glass back in my lamp because I could not think of a darker place. I kept the plates because I could not destroy them, and I did not develop them because then I should have had to decide.',
  'Mr Penwarden was dismissed for a light he showed to save them. He was drowned in March. I have been dying since June, and I find I would rather the Board thought ill of me than of him.',
  'Please be kind to her. She was the best help I ever had.',
  '*O. F.*',
  '*There is one more plate. It is still in my camera. I could not put it with the others.*',
]
export const BOARD_A = [
  '**BOARD OF SEA LAMPS.** *9th November 1888.*',
  'The Board has received the Examiner’s Return, with the plates.',
  'Findings 1 to 4 of the Inquiry are withdrawn. The late First Assistant Keeper S. Penwarden is restored to the Board’s books from the date of his dismissal, and his widow will receive the pension due to her.',
  'The Board records that the glass of Sector III was removed by the Principal Keeper’s daughter, then aged eleven, for a purpose she believed harmless, and that the Principal Keeper, whose sight had failed, did not observe the empty frame. No proceedings lie against a child. The Principal Keeper, retired in May on the ground of his sight, will not be further troubled.',
  'At the request of Miss N. Ketteridge, the glass has been refitted in the sector of the new tower. The new tower was lit on the 1st inst. and shows red over the Teeth.',
  '*H. J. Callow, Secretary.*',
]
export const BOARD_B = [
  '**BOARD OF SEA LAMPS.** *9th November 1888.*',
  'The Board has received the Examiner’s Return, with the plates.',
  'Findings 1 to 4 of the Inquiry are withdrawn. The late First Assistant Keeper S. Penwarden is restored to the Board’s books from the date of his dismissal, and his widow will receive the pension due to her.',
  'The Board records that the glass of Sector III was removed on the afternoon of the 11th November 1887 for use in the store-room lamp, by a person the Examiner does not name, and that the Principal Keeper’s sight had failed. The Board does not press the Examiner.',
  'The glass has been refitted in the sector of the new tower. The new tower was lit on the 1st inst. and shows red over the Teeth.',
  '*H. J. Callow, Secretary.*',
]
export const NELL_B = '*Wendlow, 2nd Decr. 1888.* Dear Examiner. Mr Callow showed me your Return. Thank you for leaving my name off it. I have written it on myself and sent it to him, because it was mine. Father says I am right. I am to be apprenticed to a photographer here in the spring. *Nell Ketteridge.*'
export const NELL_A = '*Wendlow, 2nd Decr. 1888.* Dear Examiner. Mr Callow sent me a copy. It is all true. I am to be apprenticed to a photographer here in the spring. *Nell Ketteridge.*'
export const CAMERA_LABEL = 'one more'
export const FINAL_CARD = { title: 'RUBY SECTOR', sub: 'The Gaunt Rock Plates, 1887', line: 'The new light shows red over the Teeth.', keep: 'Keep the print', back: 'Back to the bench', sheet: 'Contact sheet' }
export const TITLE = { title: 'RUBY SECTOR', sub: 'The Gaunt Rock Plates, 1887', begin: 'Begin', small: 'Best with sound. A darkroom mystery in one bit.' }
export const STATIONS = { shelf: 'Shelf', trays: 'Trays', table: 'Table' }
export const WARN = { fixed: 'Fixed glass will not develop again.', uncovered: 'Plates uncovered.', canary: 'Canary fogs glass that is not fixed.' }
export const DRYING = { empty: 'Peg a print here to keep this moment.', print: 'Double-click (or double-tap) to go back to it. Drag it down to take it off the line.', auto: 'auto' }
export const SETTINGS = { sound: 'Sound', reduced: 'Reduced motion', hurry: 'Hurry the chemistry', bone: 'Read the Return in Bone', restart: 'Start again…', restartQ: 'Wipe your bench and your Return?', wipe: 'Wipe', keep: 'Keep', noSave: '(saves will not outlive this tab)' }
export const CREDITS = [
  'RUBY SECTOR is part of the Andrew Rankin Minigame Collection.',
  'From an idea Andrew Rankin dictated over a sink of dishes: “Darkroom, but styled like Return of the Obra Dinn.”',
  'The look is a tribute to Lucas Pope’s 1-bit style. Every person, place, ship and Board in this game is invented.',
  'All images, sounds and type are made in your browser.',
]
export const FALLBACK = '*This darkroom needs WebGL2, and your browser hasn’t lent it one.* Try a recent Chrome, Edge, Firefox or Safari. *(In the meantime, the trial plate still develops below.)*'
export const WRAPPERS: Record<1 | 2 | 3, string> = { 1: 'I: Thurs. & Fri. forenoon', 2: 'II: Fri. afternoon', 3: 'III: Fri. night & Sat.' }

/** Minimal inline markup → HTML: **x** small caps, *x* italic, leading ~ = cramped line. Escapes everything else. */
export function md(s: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let cramped = false
  if (s.startsWith('~')) { cramped = true; s = s.slice(1) }
  let out = esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="pl-sc">$1</span>').replace(/\*(.+?)\*/g, '<em>$1</em>')
  if (cramped) out = `<span class="pl-cramped">${out}</span>`
  return out
}
