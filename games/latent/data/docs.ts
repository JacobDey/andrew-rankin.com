// The records database: story bible (docs/design/latent-story.md) §6.2, transcribed verbatim by script.
// Do not paraphrase: the search engine indexes these exact words.
export interface DocMargin { tag: string; text: string }
export interface Doc { id: string; date: string; type: string; headline: string; body: string[]; margin: DocMargin[] }
export const DOCS: Doc[] = [
 {
  "id": "GO 14.2",
  "date": "1962-01-01",
  "type": "GENERAL ORDER",
  "headline": "",
  "body": [
   "GENERAL ORDERS, VARROW POLICE. REG. 14.2 LATENT MATERIAL.",
   "LATENT (UNDEVELOPED) PHOTOGRAPHIC MATERIAL SHALL NOT BE DESTROYED UNTIL PROCESSED AND INDEXED BY A PARTY HAVING NO CONNECTION WITH THE CASE. THE PROCESSING PARTY SHALL RECORD ONE DISPOSITION: FILE (REFER TO PROFESSIONAL STANDARDS) OR PURGE (DESTROY). THE DISPOSITION IS FINAL."
  ],
  "margin": []
 },
 {
  "id": "PERS P-114",
  "date": "1966-04-04",
  "type": "PERSONNEL",
  "headline": "",
  "body": [
   "KESSANE, RUTH ANN. DOB 14.06.41. HT 5 FT 11 IN. APPOINTED PHOTOGRAPHER, PHOTOGRAPHIC UNIT, BADGE P-114.",
   "1972: INSTRUCTOR, UNIT FILM PROCESSING COURSE.",
   "1979: RESIGNED BY LETTER (SEE 79-0306). NO FORWARDING ADDRESS."
  ],
  "margin": []
 },
 {
  "id": "TRG 74/2",
  "date": "1974-10-11",
  "type": "TRAINING RECORD",
  "headline": "",
  "body": [
   "UNIT FILM PROCESSING COURSE 74/2. INSTRUCTOR R. KESSANE. 6 TRAINEES, ALL PASSED.",
   "INSTRUCTOR'S NOTE: REELS ARE LOADED BY FEEL, IN THE DARK. EVERY TRAINEE KINKS FILM IN THE FIRST WEEK. A KINK LEAVES A CRESCENT MARK ON THE NEGATIVE. I HAVE NOT KINKED A ROLL SINCE 1963 AND NEITHER WILL YOU BY FRIDAY. R.K."
  ],
  "margin": []
 },
 {
  "id": "SV EMP 0212",
  "date": "1975-06-02",
  "type": "EMPLOYEE CARD (Sallow Valley Photofinishing, copy held by F&I)",
  "headline": "",
  "body": [
   "LUSK, MINA JANE. DOB 03.09.52. HEIGHT 5'3\". POSITION: NIGHT OPERATOR, LINE 2 (MACHINE). HAND PROCESSING: NOT TRAINED.",
   "ADDRESS: 14 SALT ST. (amended 10/78:) c/o 9 WICK LANE."
  ],
  "margin": []
 },
 {
  "id": "UNIT NOTE 77/1",
  "date": "1977-03-01",
  "type": "UNIT PRACTICE",
  "headline": "",
  "body": [
   "PHOTOGRAPHIC UNIT PRACTICE. 1. SLATE THE FIRST FRAME OF EVERY CASE ROLL: CASE NO., DATE, INITIALS. 2. BRACKET EVERY SCENE: -1, 0, +1 STOP. 3. LABEL CASSETTES IN BLOCK CAPITALS. NOBODY CAN READ YOUR HANDWRITING AT 3 AM. R.K."
  ],
  "margin": []
 },
 {
  "id": "FIRE 78-1211",
  "date": "1978-12-11",
  "type": "FIRE REPORT",
  "headline": "",
  "body": [
   "BRACK & SONS TANNERY, THE FLATS. FIRE 02:10. PREMISES DESTROYED. NO CASUALTIES.",
   "CAUSE: ELECTRICAL. FUSE BOARD, REAR CORRIDOR. NO ACCELERANT DETECTED. INSURER: CORRAN MUTUAL. NFA.",
   "DS C. HALE, FIRE & INSURANCE SQUAD.",
   "PHOTOGRAPHS: P-114, ROLL 78-1211."
  ],
  "margin": []
 },
 {
  "id": "JOB 78-1211",
  "date": "1978-12-11",
  "type": "UNIT JOB SHEET",
  "headline": "",
  "body": [
   "JOB 78-1211. TANNERY. REQUESTED: OVERALLS, FUSE BOARD. ALSO SHOT: BOOTPRINTS IN SOOT, REAR STEP, GRAZING FLASH. NOT REQUESTED BY F&I. FILED ANYWAY. R.K."
  ],
  "margin": []
 },
 {
  "id": "MEMO 78-1221",
  "date": "1978-12-21",
  "type": "MEMO",
  "headline": "",
  "body": [
   "FROM: DS C. HALE, F&I. TO: PHOTOGRAPHIC UNIT.",
   "THE UNIT WILL CONFINE ITSELF TO PHOTOGRAPHS REQUESTED BY THE INVESTIGATING OFFICER. UNREQUESTED MATERIAL WILL NOT BE PROCESSED AT DEPARTMENTAL EXPENSE."
  ],
  "margin": [
   {
    "tag": "margin",
    "text": "she's processing it at her own expense then. D.P."
   }
  ]
 },
 {
  "id": "DAYBOOK 78-1222",
  "date": "1978-12-22",
  "type": "UNIT DAY BOOK",
  "headline": "",
  "body": [
   "Christmas do in the canteen. Ruth set the timer and ran for it and still made the back row. Mr Hale put his boot on my chair for the photo. Cake from Atwell's mum. D.P."
  ],
  "margin": []
 },
 {
  "id": "CASE 79-0108",
  "date": "1979-01-08",
  "type": "CASE SUMMARY",
  "headline": "",
  "body": [
   "BURGLARY, HOLLOWAY'S CHANDLERY, QUAY ROAD. ENTRY BY JEMMY, SIDE DOOR. CASH TAKEN. PHOTOGRAPHS P-114. NO SUSPECT. NFA."
  ],
  "margin": []
 },
 {
  "id": "CASE 79-0122",
  "date": "1979-01-22",
  "type": "CASE SUMMARY",
  "headline": "",
  "body": [
   "RTA, TANNER'S ROW. DELIVERY VAN VRN 2207 STRUCK N WALL BELOW FLOOD PLAQUE. DRIVER UNHURT. PHOTOGRAPHS P-114.",
   "PHOTOGRAPHER'S NOTE: FOR SCALE, TOP OF FLOOD PLAQUE (AND PAINTED FLOOD LINE, BOTH WALLS) IS 5 FT 0 IN ABOVE PAVEMENT. R.K."
  ],
  "margin": []
 },
 {
  "id": "NIGHT 79-0215",
  "date": "1979-02-15",
  "type": "NIGHT LINE LOG",
  "headline": "",
  "body": [
   "00:12 INCOMING, SV PHOTO (QUAY RD), FEMALE CALLER, FOR R.K. PUT THROUGH TO DARKROOM. 00:20 R.K. OUT, \"BACK BY 3\". 02:55 R.K. IN."
  ],
  "margin": []
 },
 {
  "id": "REG KDL 417",
  "date": "1979-02-15",
  "type": "VEHICLE REGISTRY EXTRACT",
  "headline": "",
  "body": [
   "REG. KDL 417. BLACK SALOON. KEEPER: HALE, CONRAD. 14 ORME ROAD, VARROW.",
   "ENQUIRY 15.02.79 09:12 BY P-114. REASON GIVEN: SV PHOTO ORDER 4471.",
   "FLAG ON RECORD: NOTIFY DS HALE (F&I) OF ANY ENQUIRY. NOTIFIED 09:40."
  ],
  "margin": []
 },
 {
  "id": "ROSTER 79-07",
  "date": "1979-02-16",
  "type": "DUTY ROSTER (WEEK 7)",
  "headline": "",
  "body": [
   "PHOTOGRAPHIC UNIT. MON 12–WED 14: KESSANE (DAYS), ODELL (NIGHTS). THU 15–FRI 16: KESSANE REST DAYS. ODELL ON CALL."
  ],
  "margin": []
 },
 {
  "id": "FIRE 79-0216",
  "date": "1979-02-16",
  "type": "FIRE REPORT",
  "headline": "",
  "body": [
   "SALLOW VALLEY PHOTOFINISHING, QUAY ROAD. FIRE APPROX 02:35. PREMISES DESTROYED. ONE FATALITY (SEE 79-F-022).",
   "CAUSE: ELECTRICAL. DRYER CABINET, PROCESSING HALL. SINGLE SEAT OF FIRE. NO ACCELERANT DETECTED. INSURER: CORRAN MUTUAL. NFA.",
   "DS C. HALE, F&I."
  ],
  "margin": []
 },
 {
  "id": "STMT ATWELL",
  "date": "1979-02-16",
  "type": "STATEMENT",
  "headline": "",
  "body": [
   "PC B. ATWELL. ON PATROL QUAY ROAD 02:44, SAW GLOW, ATTENDED. AS I REACHED THE DOCK LANE A DARK SALOON PULLED OUT WITHOUT LIGHTS AND WENT TOWARD TANNER'S ROW. DID NOT GET THE NUMBER. SOMEONE SMALL WENT OFF THE END OF THE DOCK TOWARD THE RIVER PATH, RUNNING, CARRYING SOMETHING. I TOOK THEM FOR A KID. I MENTIONED BOTH TO DS HALE AT THE SCENE."
  ],
  "margin": [
   {
    "tag": "margin, different pen",
    "text": "Nobody asked me again. B.A. 1979."
   }
  ]
 },
 {
  "id": "SCENE 79-0216",
  "date": "1979-02-16",
  "type": "PHOTOGRAPH CAPTIONS (P. ODELL)",
  "headline": "",
  "body": [
   "SCENE PHOTOGRAPHS, SALLOW VALLEY. 1–6 EXTERIOR. 7–9 DRYER CABINET (ORIGIN PER F&I). 10–12 DECEASED, PROCESSING HALL, BESIDE LIGHT TABLE 3. WRISTWATCH, LEFT WRIST. LIGHT-TABLE DRAWER OPEN AND EMPTY. P.O."
  ],
  "margin": []
 },
 {
  "id": "TIMECARD 0212",
  "date": "1979-02-16",
  "type": "TIMECARD (recovered from office safe)",
  "headline": "",
  "body": [
   "SALLOW VALLEY. LUSK M. 0212. WEEK ENDING 17.02.79. THU 15: IN 22:00. OUT: —"
  ],
  "margin": []
 },
 {
  "id": "CLIP 79-0217",
  "date": "1979-02-17",
  "type": "NEWSPAPER (Varrow Courier, halftone)",
  "headline": "PHOTO PLANT FIRE: WOMAN DIES.",
  "body": [
   "A night worker died early yesterday when fire destroyed the Sallow Valley Photofinishing works on Quay Road. Fire investigator Det. Sgt. Conrad Hale said the blaze began in a drying cabinet. \"These old plants are tinderboxes,\" he said. The owner, Mr Gilbert Dunmore, said he was \"devastated\"."
  ],
  "margin": []
 },
 {
  "id": "ID 79-F-022",
  "date": "1979-02-17",
  "type": "IDENTIFICATION FORM",
  "headline": "",
  "body": [
   "DECEASED: LUSK, M. (FEMALE). IDENTIFIED BY EFFECTS: (1) LADIES' WATCH, CASEBACK ENGRAVED \"M.\"; (2) TIMECARD, IN 22:00, NO OUT. NEXT OF KIN: NONE TRACED.",
   "DENTAL COMPARISON: NOT REQUIRED. C. HALE DS."
  ],
  "margin": []
 },
 {
  "id": "CORONER 79-022",
  "date": "1979-02-18",
  "type": "CORONER (PRELIMINARY)",
  "headline": "",
  "body": [
   "F-022. FEMALE, ADULT. STATURE ESTIMATED FROM FEMUR LENGTH: 175–180 CM. CAUSE OF DEATH: SMOKE INHALATION. IDENTIFICATION ACCEPTED AS PER POLICE FORM 79-F-022."
  ],
  "margin": []
 },
 {
  "id": "DAYBOOK 79-0219",
  "date": "1979-02-19",
  "type": "UNIT DAY BOOK",
  "headline": "",
  "body": [
   "R.K. phoned in sick 07:10. Very hoarse. Said not to send anyone round. Have put her tea mug in the cupboard. D.P."
  ],
  "margin": []
 },
 {
  "id": "CLIP 79-0220",
  "date": "1979-02-20",
  "type": "NEWSPAPER (notices)",
  "headline": "",
  "body": [
   "LUSK, Mina Jane, aged 26, in the Sallow Valley fire. Service at St. Ebba's, Saturday 24th, 11 a.m. No flowers."
  ],
  "margin": []
 },
 {
  "id": "DAYBOOK 79-0224",
  "date": "1979-02-24",
  "type": "UNIT DAY BOOK",
  "headline": "",
  "body": [
   "Went to St. Ebba's for the girl from the photo place, Ruth's friend. Six of us and the vicar. Ruth wasn't there. That's not like her. D.P."
  ],
  "margin": []
 },
 {
  "id": "ODGERS 79-0302",
  "date": "1979-03-02",
  "type": "LETTER (forwarded to F&I)",
  "headline": "",
  "body": [
   "Dear Sirs, I left a film at Sallow Valley on 12 February (order 4471, receipt enclosed). It was destroyed in the fire and Mr Dunmore's office will not discuss compensation. It contained twenty-four exposures of night herons at the Brack & Sons outfall, taken on the night of 10 December, the best I have ever made. I appreciate that a woman died and I do not wish to seem callous, but I would like someone to tell me whether anything at all was saved. Yours faithfully, C. Odgers (Mr)."
  ],
  "margin": [
   {
    "tag": "stamp",
    "text": "F&I: NFA. C.H."
   }
  ]
 },
 {
  "id": "CLAIM SV-0216",
  "date": "1979-03-02",
  "type": "INSURANCE (F&I file copy)",
  "headline": "",
  "body": [
   "CORRAN MUTUAL. CLAIM SV/79/0216, SALLOW VALLEY PHOTOFINISHING (PROP. G. DUNMORE). FIRE 16.02.79. CAUSE PER POLICE REPORT: ELECTRICAL. SETTLED IN FULL. ASSESSOR: F. RUSK."
  ],
  "margin": []
 },
 {
  "id": "LTR 79-0306",
  "date": "1979-03-06",
  "type": "LETTER (typed)",
  "headline": "",
  "body": [
   "To the Photographic Unit. I resign with immediate effect. I am not well. Please don't try to find me. R. KESSANE"
  ],
  "margin": [
   {
    "tag": "envelope",
    "text": "POSTMARK: PORT AVEL, 5 MAR 1979."
   }
  ]
 },
 {
  "id": "PROP 79-0311",
  "date": "1979-03-07",
  "type": "PROPERTY LOG",
  "headline": "",
  "body": [
   "RECD BY POST 1 CARTON, NO NOTE. LID MARKED \"HOLD — R.K.\". CONTENTS: 9 × 35MM CASSETTES, EXPOSED, UNDEVELOPED; 1 × ROLL DEVELOPED, IN SLEEVE. TOTAL 10. SHELF 4, COLD STORE (4 °C). HELD PENDING R.K."
  ],
  "margin": [
   {
    "tag": "margin",
    "text": "Odd. Ruth always prints her labels. D.P."
   }
  ]
 },
 {
  "id": "DAYBOOK 79-0308",
  "date": "1979-03-08",
  "type": "UNIT DAY BOOK",
  "headline": "",
  "body": [
   "Rang the landlord at Wick Lane. Miss Kessane paid to the end of March and went. \"Took nothing but a camera.\" She'd have taken her books. D.P."
  ],
  "margin": []
 },
 {
  "id": "DAYBOOK 79-0312",
  "date": "1979-03-12",
  "type": "UNIT DAY BOOK",
  "headline": "",
  "body": [
   "Mr Hale came down asking whether R.K. had left anything with us before she went. I said no. I don't know why I said that. Moved her HOLD box to the back of shelf 4. D.P."
  ],
  "margin": []
 },
 {
  "id": "MEMO 80-0601",
  "date": "1980-06-01",
  "type": "MEMO",
  "headline": "",
  "body": [
   "FROM: P. ODELL. REQUEST SHELF 4 (HOLD R.K.) BE CLEARED. SPACE NEEDED FOR 1980 MATERIAL."
  ],
  "margin": [
   {
    "tag": "margin",
    "text": "No. D.P."
   }
  ]
 },
 {
  "id": "MEMO 83-0502",
  "date": "1983-05-02",
  "type": "PROCUREMENT",
  "headline": "",
  "body": [
   "NEW FILM STOCK FROM THIS MONTH CARRIES DX CODING: A CHECKERBOARD OF SILVER AND BLACK PATCHES ON THE CASSETTE THAT TELLS NEWER CAMERAS THE FILM SPEED. OLD CAMERAS IGNORE IT. NO ACTION NEEDED."
  ],
  "margin": []
 },
 {
  "id": "CLIP 85-0110",
  "date": "1985-01-10",
  "type": "NEWSPAPER",
  "headline": "FIRE DETECTIVE MADE SUPERINTENDENT.",
  "body": [
   "Conrad Hale, whose Fire & Insurance Squad closed forty-one cases without a single unsolved fire, was promoted yesterday. \"I never let a fire beat me,\" he said."
  ],
  "margin": []
 },
 {
  "id": "PROP 87-0040",
  "date": "1987-02-24",
  "type": "PROPERTY LOG",
  "headline": "",
  "body": [
   "RECD BY POST 1 × 35MM CASSETTE, EXPOSED, NO NOTE, NO LABEL. POSTMARK PORT AVEL. ADDED TO CARTON HOLD R.K., SHELF 4."
  ],
  "margin": [
   {
    "tag": "margin",
    "text": "I haven't told anyone. Who would I tell. D.P."
   }
  ]
 },
 {
  "id": "OBIT 91-0812",
  "date": "1991-08-12",
  "type": "NEWSPAPER",
  "headline": "",
  "body": [
   "DUNMORE, Gilbert, 61, businessman, formerly of Sallow Valley Photofinishing, suddenly at home."
  ],
  "margin": []
 },
 {
  "id": "MEMO 96-1129",
  "date": "1996-11-29",
  "type": "MEMO",
  "headline": "",
  "body": [
   "D. PENHALLOW, UNIT CLERK SINCE 1971, RETIRES TODAY. AT HER REQUEST SHELF 4 (HOLD R.K.) WILL BE LEFT UNDISTURBED UNTIL THE UNIT CLOSES. AGREED. UNIT SUPT."
  ],
  "margin": []
 },
 {
  "id": "CLIP 99-0602",
  "date": "1999-06-02",
  "type": "NEWSPAPER",
  "headline": "HALE NAMED DEPUTY CHIEF.",
  "body": [
   "Superintendent Conrad Hale, 61, becomes Deputy Chief of Varrow Police. He says his proudest years were \"on the fire squad, when this city was burning down around us.\""
  ],
  "margin": []
 },
 {
  "id": "CONTRACT C-0303",
  "date": "2003-03-03",
  "type": "CONTRACT RECORD",
  "headline": "",
  "body": [
   "CONTRACT RECORDS CLERK (REMOTE). KESSANE, R. DOB 14.06.41. START 03.03.03. WORKS OFF-SITE; PAID BY CHEQUE TO PORT AVEL ADDRESS. HAS NOT ATTENDED IN PERSON. PREVIOUS SERVICE WITH VARROW POLICE: NONE DECLARED."
  ],
  "margin": []
 },
 {
  "id": "MEMO 03-0310",
  "date": "2003-03-10",
  "type": "MEMO",
  "headline": "",
  "body": [
   "DIGITAL TRANSITION. THE PHOTOGRAPHIC UNIT CLOSES 31.03.03. COLD STORE CONTENTS TO SILVER RECOVERY, COLLECTION SAT 29.03.03, 06:00."
  ],
  "margin": []
 },
 {
  "id": "MEMO 03-0314",
  "date": "2003-03-14",
  "type": "MEMO",
  "headline": "",
  "body": [
   "RETIREMENT DINNER FOR DEPUTY CHIEF C. HALE, FRIDAY 4 APRIL, RIVERSIDE ROOMS. PRESENTATION OF THE CHIEF'S MEDAL. 36 YEARS OF SERVICE."
  ],
  "margin": []
 },
 {
  "id": "WO 03-0417",
  "date": "2003-03-27",
  "type": "WORK ORDER",
  "headline": "",
  "body": [
   "WORK ORDER 03-0417. PURGE PHOTOGRAPHIC UNIT COLD STORE, SHELF 4: CARTON \"HOLD — R.K.\" (PROPERTY 79-0311, 87-0040).",
   "LATENT MATERIAL TO BE PROCESSED AND INDEXED PER REG 14.2 BY A NEUTRAL PARTY PRIOR TO DISPOSAL. DISPOSITION: FILE OR PURGE. TO CLOSE, ENTER: CLOSE 03-0417.",
   "REQUESTED BY: R. KESSANE, RECORDS (CONTRACT)."
  ],
  "margin": []
 },
 {
  "id": "CALDER 2711",
  "date": "2003-03-27",
  "type": "BOOKING (Calder Records Services)",
  "headline": "",
  "body": [
   "ONE NIGHT TECHNICIAN, FRI 28.03.03, 21:00–06:00, FERRY STREET. CLIENT: R. KESSANE. CLIENT'S REQUIREMENT: TECHNICIAN FROM OUT OF REGION, NO CONNECTION WITH VARROW. \"PLEASE SEND SOMEONE WHO LOOKS CAREFULLY.\""
  ],
  "margin": []
 },
 {
  "id": "DESK 03-0328",
  "date": "2003-03-28",
  "type": "FRONT DESK LOG",
  "headline": "",
  "body": [
   "20:52 CALDER TECHNICIAN ARRIVED FOR PHOTO UNIT. SHOWN DOWN. CLIENT KESSANE R. NOT ON SITE. SGT B. ATWELL."
  ],
  "margin": []
 }
]
