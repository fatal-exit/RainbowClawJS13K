/**
 * Rainbow Claw — Wavedash Telemetry & Leaderboard Service
 * Game ID: rainbow_claw_2026
 */

export interface WavedashPlayer {
  userId: string;
  username: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  day: number;
}

const LOCAL_STORAGE_KEY = 'rainbowclaw_highscore_v1';
const LOCAL_LEADERBOARD_KEY = 'rainbowclaw_lb_v1';

export class WavedashService {
  private boardId: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSdk(): any {
    return (globalThis as any).Wavedash || (typeof window !== 'undefined' ? (window as any).Wavedash : null) || null;
  }

  public isWavedash(): boolean {
    return !!this.getSdk();
  }

  public reportProgress(progress: number): void {
    const sdk = this.getSdk();
    if (sdk && typeof sdk.updateLoadProgressZeroToOne === 'function') {
      try {
        sdk.updateLoadProgressZeroToOne(Math.min(1.0, Math.max(0, progress)));
      } catch {
        /* ignore */
      }
    }
  }

  public init(debug = false): void {
    const sdk = this.getSdk();
    if (!sdk) return;
    try {
      this.reportProgress(1.0);
      if (typeof sdk.init === 'function') sdk.init({ debug });
      if (typeof sdk.loadComplete === 'function') sdk.loadComplete();
    } catch {
      /* ignore */
    }
  }

  public getPlayer(): WavedashPlayer {
    const sdk = this.getSdk();
    if (sdk && typeof sdk.getUser === 'function') {
      try {
        const u = sdk.getUser();
        if (u) {
          return {
            userId: u.id || u.userId || 'clawmaster',
            username: u.username || u.name || 'ClawMaster',
          };
        }
      } catch {
        /* fall through */
      }
    }
    return { userId: 'local', username: 'ClawMaster' };
  }

  public getLocalHighScore(): number {
    try {
      return parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  private async ensureBoard(): Promise<string | null> {
    if (this.boardId) return this.boardId;
    const sdk = this.getSdk();
    if (!sdk) return null;
    try {
      let res = typeof sdk.getLeaderboard === 'function'
        ? await sdk.getLeaderboard('rainbow-claw-top')
        : null;
      if ((!res || res.success === false) && typeof sdk.getOrCreateLeaderboard === 'function') {
        res = await sdk.getOrCreateLeaderboard('rainbow-claw-top', 1, 0);
      }
      if (!res || res.success === false) return null;
      this.boardId = typeof res === 'string' ? res : res.data?.id || res.id || null;
    } catch {
      return null;
    }
    return this.boardId;
  }

  public async fetchLeaderboardTop(limit = 8): Promise<LeaderboardEntry[]> {
    const sdk = this.getSdk();
    if (sdk && typeof sdk.listLeaderboardEntries === 'function') {
      try {
        const id = await this.ensureBoard();
        if (id) {
          const raw = await sdk.listLeaderboardEntries(id, 0, limit, false);
          const data = raw && typeof raw === 'object' && 'success' in raw ? (raw.success ? raw.data : null) : raw;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entries: any[] = Array.isArray(data) ? data : data?.entries ?? [];
          return entries.map((e, i) => ({
            rank: typeof e.globalRank === 'number' ? e.globalRank : i + 1,
            score: typeof e.score === 'number' ? e.score : 0,
            name: typeof e.username === 'string' && e.username.length > 0 ? e.username : 'UnicornHunter',
            day: typeof e.extraData === 'number' ? e.extraData : 1,
          }));
        }
      } catch {
        /* fallback */
      }
    }

    try {
      const stored = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return [
      { rank: 1, name: 'ArcadeAce', score: 8500, day: 5 },
      { rank: 2, name: 'PrismQueen', score: 5400, day: 4 },
      { rank: 3, name: 'ClawMaster', score: 2800, day: 3 },
      { rank: 4, name: 'NeonPony', score: 1200, day: 2 },
    ];
  }

  public async submitScore(score: number, day: number): Promise<void> {
    const best = this.getLocalHighScore();
    if (score > best) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, score.toString());
      } catch {
        /* ignore */
      }
    }

    const sdk = this.getSdk();
    if (sdk) {
      try {
        const id = await this.ensureBoard();
        if (id && typeof sdk.uploadLeaderboardScore === 'function') {
          await sdk.uploadLeaderboardScore(id, score, true);
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const top = await this.fetchLeaderboardTop(8);
      const player = this.getPlayer();
      const existing = top.findIndex(e => e.name === player.username);
      if (existing >= 0) {
        if (score > top[existing].score) {
          top[existing].score = score;
          top[existing].day = day;
        }
      } else {
        top.push({ rank: 0, name: player.username, score, day });
      }
      top.sort((a, b) => b.score - a.score);
      top.forEach((e, idx) => { e.rank = idx + 1; });
      localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(top.slice(0, 8)));
    } catch {
      /* ignore */
    }
  }
}

export const wavedash = new WavedashService();
