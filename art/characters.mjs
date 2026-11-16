// ============================================================
//  HOW EACH DRAWING IS CUT INTO PUPPET PARTS
//  All numbers are pixel coordinates on the original photo.
//  Run `npm run art` after changing anything here.
//  paper: [r,g,b] = color for the uncolored paper areas (on a character or a single part)
//  solid: true  = keep everything inside the outline (for faint pencil lines
//                 where the automatic paper removal leaks inside)
//
//  Digital character sheets (dark background) use:
//    source: 'sheet'   no paper cleaning, the figure is found against the dark background
//    mirror: true      flip the picture so the figure faces right (coordinates stay as on the original)
//    gameScale         sheet pixels -> game pixels for this character
//    faceCamera: false the head turns with the body (3/4 or side views)
// ============================================================

export const GAME_SCALE = 0.2278; // photo pixels -> game pixels (R is ~210px tall in game)
export const EXPORT_SCALE = 0.3; // default resolution of the saved PNGs (a character can override with exportScale)

export const CHARACTERS = [
  {
    id: 'r',
    photo: 'art/drawings/r-and-masked-giant.jpg',
    ground: [462, 1302], // point between the feet on the floor
    hip: [462, 965],
    // A loose outline around the whole figure (keeps the move notes out)
    outline: [[285, 372], [560, 372], [560, 600], [672, 690], [672, 1320], [340, 1320], [285, 1060]],
    images: {
      head: { poly: [[398, 382], [505, 382], [512, 440], [540, 505], [545, 560], [525, 600], [508, 648], [425, 652], [405, 612], [382, 565], [380, 505], [392, 470]], pivot: [462, 645] },
      torso: { poly: [[428, 638], [500, 638], [505, 688], [590, 708], [615, 745], [595, 790], [585, 968], [360, 968], [345, 790], [330, 745], [355, 708], [425, 688]], pivot: [462, 965] },
      arm: { poly: [[300, 730], [330, 703], [365, 738], [372, 860], [375, 985], [380, 1040], [308, 1040], [303, 985], [296, 860]], pivot: [335, 735] },
      legL: { poly: [[352, 955], [478, 955], [482, 1100], [470, 1310], [366, 1310], [358, 1100]], pivot: [415, 968], solid: true },
      legR: { poly: [[470, 955], [566, 955], [563, 1100], [562, 1310], [472, 1310], [478, 1100]], pivot: [515, 968], solid: true },
    },
    slots: {
      legB: { image: 'legL', joint: [415, 968] },
      legF: { image: 'legR', joint: [515, 968] },
      torso: { image: 'torso', joint: [462, 965] },
      head: { image: 'head', joint: [462, 645] },
      armB: { image: 'arm', joint: [335, 735] },
      armF: { image: 'arm', joint: [600, 735] },
    },
  },
  {
    id: 'r-shadow',
    exportScale: 0.6, // shadows get bigger PNGs because they grow into giants
    paper: [182, 166, 238], // he colored the giant lavender; the photo lost most of it, so we bring it back
    photo: 'art/drawings/r-and-masked-giant.jpg',
    ground: [690, 1292],
    hip: [690, 900],
    outline: [[625, 428], [762, 428], [762, 620], [892, 670], [892, 1050], [790, 1050], [790, 1305], [655, 1305], [655, 640]],
    images: {
      head: { poly: [[648, 438], [748, 438], [752, 520], [752, 580], [735, 612], [712, 642], [668, 642], [645, 612], [632, 560], [635, 500]], pivot: [690, 635] },
      // Only the right half is clean (R stands in front of the left half), so we mirror it
      torso: { poly: [[690, 626], [790, 626], [806, 680], [800, 720], [795, 800], [782, 880], [775, 902], [690, 902]], pivot: [690, 900], mirrorX: 690, solid: true },
      arm: { poly: [[760, 660], [805, 668], [850, 705], [875, 800], [882, 900], [874, 960], [877, 1042], [788, 1044], [782, 960], [770, 860], [758, 760]], pivot: [795, 695], solid: true },
      leg: { poly: [[688, 888], [774, 888], [780, 1000], [777, 1240], [780, 1300], [693, 1300], [688, 1240], [681, 1000]], pivot: [725, 905], paper: [246, 214, 92] },
    },
    slots: {
      legB: { image: 'leg', joint: [655, 905] },
      legF: { image: 'leg', joint: [725, 905] },
      torso: { image: 'torso', joint: [690, 900] },
      head: { image: 'head', joint: [690, 635] },
      armB: { image: 'arm', joint: [585, 695] },
      armF: { image: 'arm', joint: [795, 695] },
    },
  },
  // ---------- From the character sheet (art/drawings/r-character-sheet.webp), 3/4 view ----------
  {
    id: 'r-sheet',
    source: 'sheet',
    photo: 'art/drawings/r-character-sheet.webp',
    mirror: true,
    faceCamera: false,
    gameScale: 0.83,
    exportScale: 1,
    ground: [678, 291],
    hip: [675, 150],
    outline: [[628, 32], [728, 32], [728, 296], [628, 296]],
    images: {
      head: { poly: [[644, 52], [654, 38], [681, 36], [690, 47], [692, 58], [688, 69], [681, 79], [661, 81], [654, 73], [649, 63], [645, 59]], pivot: [670, 79] },
      torso: { poly: [[652, 76], [690, 76], [705, 85], [709, 100], [702, 140], [704, 153], [647, 153], [650, 120], [646, 96], [650, 85]], pivot: [675, 150] },
      armNear: { poly: [[690, 82], [709, 84], [718, 100], [718, 130], [720, 150], [716, 158], [717, 178], [695, 179], [692, 160], [689, 130], [686, 100]], pivot: [702, 92] },
      armFar: { poly: [[639, 88], [656, 86], [658, 110], [654, 150], [657, 160], [652, 179], [632, 177], [634, 150], [635, 110]], pivot: [648, 93] },
      legFar: { poly: [[657, 147], [683, 147], [685, 200], [683, 262], [675, 262], [674, 294], [631, 294], [639, 262], [641, 200], [642, 182], [658, 181]], pivot: [660, 155] },
      legNear: { poly: [[667, 147], [691, 147], [691, 181], [716, 183], [717, 200], [723, 250], [720, 262], [722, 294], [692, 294], [691, 262], [680, 255], [677, 200]], pivot: [690, 155] },
    },
    slots: {
      legB: { image: 'legFar', joint: [660, 155] },
      legF: { image: 'legNear', joint: [690, 155] },
      torso: { image: 'torso', joint: [675, 150] },
      head: { image: 'head', joint: [670, 79] },
      armB: { image: 'armFar', joint: [648, 93] },
      armF: { image: 'armNear', joint: [702, 92] },
    },
  },
  {
    id: 'r-sheet-shadow',
    source: 'sheet',
    photo: 'art/drawings/r-character-sheet.webp',
    mirror: true,
    faceCamera: false,
    gameScale: 0.83,
    exportScale: 2, // bigger PNGs because the shadow grows into a giant
    ground: [1210, 290],
    hip: [1210, 150],
    outline: [[1160, 32], [1272, 32], [1272, 296], [1160, 296]],
    images: {
      head: { poly: [[1191, 52], [1196, 42], [1210, 38], [1221, 44], [1225, 55], [1224, 66], [1216, 73], [1206, 80], [1195, 78], [1191, 68]], pivot: [1208, 80] },
      torso: { poly: [[1195, 76], [1218, 74], [1230, 81], [1239, 100], [1236, 125], [1229, 140], [1231, 153], [1189, 153], [1188, 130], [1183, 105], [1185, 91]], pivot: [1210, 150] },
      armNear: { poly: [[1221, 78], [1241, 76], [1256, 87], [1258, 105], [1262, 130], [1260, 160], [1257, 194], [1230, 194], [1233, 160], [1237, 135], [1231, 110], [1224, 95]], pivot: [1240, 92] },
      armFar: { poly: [[1181, 86], [1199, 90], [1195, 120], [1191, 150], [1189, 165], [1188, 192], [1166, 192], [1170, 165], [1177, 130], [1179, 105]], pivot: [1188, 98] },
      legFar: { poly: [[1190, 147], [1221, 147], [1223, 200], [1233, 255], [1217, 262], [1215, 293], [1166, 293], [1179, 262], [1181, 200], [1190, 195]], pivot: [1200, 155] },
      legNear: { poly: [[1204, 147], [1230, 147], [1230, 196], [1241, 200], [1253, 250], [1247, 262], [1251, 293], [1215, 293], [1227, 262], [1229, 250], [1222, 215], [1212, 175]], pivot: [1222, 155] },
    },
    slots: {
      legB: { image: 'legFar', joint: [1200, 155] },
      legF: { image: 'legNear', joint: [1222, 155] },
      torso: { image: 'torso', joint: [1210, 150] },
      head: { image: 'head', joint: [1208, 80] },
      armB: { image: 'armFar', joint: [1188, 98] },
      armF: { image: 'armNear', joint: [1240, 92] },
    },
  },
];
