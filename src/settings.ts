// Player settings that are remembered between visits.

/**
 * sprites = sprite-sheet animation, sheet = character-sheet puppet,
 * drawn = the hand drawings, shapes = the original shape style
 */
export type ArtStyle = 'sprites' | 'sheet' | 'drawn' | 'shapes';
const STYLES: ArtStyle[] = ['sprites', 'sheet', 'drawn', 'shapes'];
export const ART_STYLE_NAMES: Record<ArtStyle, string> = {
  sprites: 'SPRITES', sheet: 'SHEET', drawn: 'HAND-DRAWN', shapes: 'SHAPES',
};
const KEY = 'artStyle3';

function load(): ArtStyle {
  try {
    const s = localStorage.getItem(KEY) as ArtStyle | null;
    return s && STYLES.includes(s) ? s : 'sprites';
  } catch {
    return 'sprites';
  }
}

export const settings = {
  artStyle: load(),

  toggleArtStyle() {
    this.artStyle = STYLES[(STYLES.indexOf(this.artStyle) + 1) % STYLES.length];
    try {
      localStorage.setItem(KEY, this.artStyle);
    } catch {
      /* private mode: just don't remember */
    }
  },
};
