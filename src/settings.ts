// Player settings that are remembered between visits.

/** sheet = character-sheet art, drawn = the hand drawings, shapes = the original shape style */
export type ArtStyle = 'sheet' | 'drawn' | 'shapes';
const STYLES: ArtStyle[] = ['sheet', 'drawn', 'shapes'];
export const ART_STYLE_NAMES: Record<ArtStyle, string> = { sheet: 'SHEET', drawn: 'HAND-DRAWN', shapes: 'SHAPES' };

function load(): ArtStyle {
  try {
    const s = localStorage.getItem('artStyle2') as ArtStyle | null;
    return s && STYLES.includes(s) ? s : 'sheet';
  } catch {
    return 'sheet';
  }
}

export const settings = {
  artStyle: load(),

  toggleArtStyle() {
    this.artStyle = STYLES[(STYLES.indexOf(this.artStyle) + 1) % STYLES.length];
    try {
      localStorage.setItem('artStyle2', this.artStyle);
    } catch {
      /* private mode: just don't remember */
    }
  },
};
