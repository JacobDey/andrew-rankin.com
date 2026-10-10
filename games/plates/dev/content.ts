// games/plates/dev/content.ts — harness: the contact sheet (see content/gallery.ts for flags).
import { mountGallery } from '../content/gallery'
const stage = document.getElementById('stage')
if (stage) void mountGallery(stage)
