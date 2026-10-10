// Every in-game string that carries the fiction (studio.md §3.2, §6.4). O. is the house owner; Q. made the
// bellows; Nightjar Photographic makes the film. Rename here if those change.

export const POSTCARD_TEXT: Record<string, { text: string; hint: string; front: string }> = {
  P1: { text: 'Welcome to the house. Make one picture, any picture, and put it on the fridge.', hint: 'The can on the stump. — O.', front: 'sea' },
  P2: { text: 'Dot will not sit. Could you photograph the yard without him in it?', hint: 'Later light, smaller hole. — O.', front: 'lake' },
  P3: { text: 'Stop the water.', hint: 'Fast shutter, sprinkler on. — O.', front: 'mesa' },
  P4: { text: 'Now turn the water into silk.', hint: 'Tripod. Slow. Let it run. — O.', front: 'sea' },
  P5: { text: 'Swing the lantern after dark and let it draw.', hint: 'Bulb, tripod, push it. — O.', front: 'lake' },
  P6: { text: 'Photograph something falling.', hint: 'Throw high, fire fast. — O.', front: 'mesa' },
  P7: { text: 'Get closer to the mailbox than anyone ever has.', hint: 'Bellows out. All the way. — O.', front: 'sea' },
  P8: { text: 'The swing, right at the very top.', hint: 'Fire at the turnaround. — O.', front: 'lake' },
}

export const UNLOCKS: Record<string, { parts: string[]; label: string }> = {
  P1: { parts: ['box', 'meniscus75', 'leaf', 'nj100'], label: 'a box camera, Meniscus 75, a leaf shutter and Nightjar 100' },
  P2: { parts: ['nj400', 'drop'], label: 'Nightjar 400 and a gravity-drop shutter' },
  P3: { parts: ['field', 'plasmat150', 'tilt'], label: 'a field camera and a Plasmat 150' },
  P4: { parts: ['colour200', 'portrait120'], label: 'Nightjar Colour 200 and a Portrait 120' },
  P5: { parts: ['gels'], label: 'lantern gels, red and green' },
  P6: { parts: ['bucket6'], label: 'a crate and a bucket of balls' },
  P7: { parts: ['closeup2'], label: 'a +2 close-up lens' },
  P8: { parts: [], label: 'a key. The house is yours.' },
}

export const NOTES = {
  start: 'Tap the camera, then hold the round button for 15 seconds.',
  pinhole: 'open · count to 15 · close',
  box: 'Sun? f/16 at 1/ISO.',
  ground: "Yes, it's upside down.",
  tank: 'Turn it when it blinks.',
  switch: 'Light on = fog.',
  fridge: 'Best ones go here. Be honest.',
  thermo: '20° down here, all summer.',
  basement: 'The basement door glows.',
}

export const REPLIES = {
  preAnswered: "Saw your picture. Exactly what I'd have asked for.",
  final: 'The house is yours.',
}
