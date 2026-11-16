// ============================================================
//  SPRITE SHEETS -> GAME ANIMATIONS
//  Run `npm run sprites` after changing anything here.
//
//  Each animation lists where its frames are on a sheet:
//    y:     [top, bottom] of the strip of frames (pixels on the sheet)
//    cells: [left, right] of each frame. The middle of the cell is where the
//           character stands, so keep cells centered on the body.
//    base:  y of the floor line (where the feet touch). 'own' = each frame's own bottom
//           (for jumps, where the game moves the character up and down itself)
//    ax:    optional { frameIndex: x } to fix where a frame's body center is
//    clipY: true = also take blobs that stick out of the strip (cut at the strip's edge)
// ============================================================

/** Evenly spaced frames: first center, distance between centers, how many */
const grid = (first, step, n) =>
  Array.from({ length: n }, (_, i) => [first + i * step - step / 2, first + i * step + step / 2]);

export const SPRITE_CHARACTERS = [
  {
    id: 'rondo',
    height: 200, // how tall Rondo stands in the game (pixels)
    sheets: {
      // standingHeight = how tall the character stands on that sheet, so both sheets match
      basic: { file: 'art/drawings/rondo-basic-sheet.webp', standingHeight: 89 },
      moves: { file: 'art/drawings/rondo-moves-sheet.webp', standingHeight: 47 },
    },
    anims: {
      // ---- basic sheet (big frames, on a grid 111px apart) ----
      idle: { sheet: 'basic', y: [0, 96], base: 94, cells: grid(197.5, 111.2, 7) },
      walk: { sheet: 'basic', y: [97, 187], base: 185, cells: grid(197.5, 111.2, 7) },
      run: { sheet: 'basic', y: [188, 272], base: 271, cells: grid(197.5, 111.2, 7) },
      jump: { sheet: 'basic', y: [260, 358], base: 'own', cells: grid(197.5, 111.2, 6) },
      crouch: { sheet: 'basic', y: [359, 425], base: 423, cells: grid(197.5, 111.2, 4) },
      guard: { sheet: 'basic', y: [428, 499], base: 498, cells: grid(197.5, 111.2, 4) },
      punch: { sheet: 'basic', y: [500, 570], base: 568, cells: grid(197.5, 111.2, 6) },
      kick: { sheet: 'basic', y: [571, 642], base: 640, cells: grid(197.5, 111.2, 6) },
      hurt: { sheet: 'basic', y: [643, 715], base: 713, cells: grid(197.5, 111.2, 4) },
      knockdown: { sheet: 'basic', y: [716, 789], base: 787, cells: grid(197.5, 111.2, 6) },
      recovery: { sheet: 'basic', y: [790, 868], base: 866, cells: grid(197.5, 111.2, 6) },

      // ---- moves sheet (small frames) ----
      dash: {
        sheet: 'moves', y: [223, 273], base: 271,
        cells: [[16, 72], [72, 128], [128, 185], [185, 238], [238, 285], [285, 345], [345, 405], [405, 452]],
      },
      wave: { sheet: 'moves', y: [223, 273], base: 271, cells: [[486, 527], [532, 580], [585, 632], [637, 686]] },
      waveFx: { sheet: 'moves', y: [223, 273], base: 'center', cells: [[691, 740], [740, 790], [790, 840], [840, 890]] },
      rising: {
        sheet: 'moves', y: [205, 273], base: 271, ax: { 7: 1328, 8: 1398, 9: 1456 },
        cells: [[933, 965], [978, 1015], [1029, 1068], [1077, 1122], [1126, 1184], [1185, 1243], [1244, 1303], [1308, 1376], [1381, 1424], [1440, 1482]],
      },
      bind: { sheet: 'moves', y: [306, 370], base: 363, cells: [[13, 50], [63, 101], [112, 152], [162, 209], [209, 257]] },
      summon: { sheet: 'moves', y: [306, 370], base: 366, cells: [[516, 577], [583, 637]] },

      // ---- the Shadow Guardian ----
      guardian: { sheet: 'moves', y: [284, 370], base: 368, cells: [[730, 810]] },
      groundBreaker: {
        sheet: 'moves', y: [306, 370], base: 368,
        cells: [[836, 896], [903, 967], [972, 1044], [1046, 1114], [1115, 1187], [1189, 1257], [1258, 1336], [1340, 1414], [1422, 1481]],
      },
      overdrive: {
        sheet: 'moves', y: [411, 487], base: 484, clipY: true,
        cells: [[3, 103], [103, 178], [178, 253], [254, 348], [348, 443], [443, 540], [540, 634], [635, 720], [728, 810], [813, 893], [893, 967], [967, 1048], [1048, 1134], [1138, 1230], [1230, 1322], [1322, 1413], [1414, 1498]],
      },
    },
  },
];
