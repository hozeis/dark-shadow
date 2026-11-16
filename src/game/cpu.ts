import { NO_INPUT, type Input } from './input';
import type { Fighter } from './Fighter';

/** A very simple computer opponent. Makes a new decision every ~0.2 seconds. */
export class CpuBrain {
  private next = 0;
  private hold: Input = { ...NO_INPUT };

  think(me: Fighter, opp: Fighter, time: number): Input {
    if (time < this.next) return { ...this.hold, punch: false, kick: false, ult: false };
    this.next = time + 120 + Math.random() * 180;

    const d = Math.abs(opp.x - me.x);
    const toward: keyof Input = opp.x > me.x ? 'right' : 'left';
    const away: keyof Input = toward === 'right' ? 'left' : 'right';
    const oppAttacking = opp.state === 'punch' || opp.state === 'kick';
    const h: Input = { ...NO_INPUT };
    const out: Input = { ...NO_INPUT };

    if (me.meter >= 100 && d < 500 && Math.random() < 0.3) {
      out.ult = true;
    } else if (oppAttacking && d < 200 && Math.random() < 0.45) {
      h.down = true;
    } else if (d > 170) {
      h[toward] = true;
      if (Math.random() < 0.08) h.up = true;
    } else {
      const r = Math.random();
      if (r < 0.4) out.punch = true;
      else if (r < 0.7) out.kick = true;
      else if (r < 0.8) h[away] = true;
      else if (r < 0.88) { h.up = true; h[toward] = true; }
    }

    this.hold = h;
    return { ...h, punch: out.punch, kick: out.kick, ult: out.ult };
  }
}
