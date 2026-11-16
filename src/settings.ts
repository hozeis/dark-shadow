// Player settings that are remembered between visits.

export type ArtStyle = 'drawn' | 'shapes';

function load(): ArtStyle {
  try {
    return localStorage.getItem('artStyle') === 'shapes' ? 'shapes' : 'drawn';
  } catch {
    return 'drawn';
  }
}

export const settings = {
  /** 'drawn' = use the hand drawings when a fighter has them, 'shapes' = the original shape style */
  artStyle: load(),

  toggleArtStyle() {
    this.artStyle = this.artStyle === 'drawn' ? 'shapes' : 'drawn';
    try {
      localStorage.setItem('artStyle', this.artStyle);
    } catch {
      /* private mode: just don't remember */
    }
  },
};
