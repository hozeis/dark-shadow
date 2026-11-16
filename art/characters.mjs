// ============================================================
//  HOW EACH DRAWING IS CUT INTO PUPPET PARTS
//  All numbers are pixel coordinates on the original photo.
//  Run `npm run art` after changing anything here.
//  paper: [r,g,b] = color for the uncolored paper areas (on a character or a single part)
//  solid: true  = keep everything inside the outline (for faint pencil lines
//                 where the automatic paper removal leaks inside)
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
];
