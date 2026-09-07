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

const LOCAL_STORAGE_KEY = 'rc_hs';


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
            userId: u.id || u.userId || '',
            username: u.username || u.name || '',
          };
        }
      } catch {
        /* fall through */
      }
    }
    return { userId: '', username: '' };
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
      let res = sdk.getLeaderboard ? await sdk.getLeaderboard('rainbow-claw-top') : null;
      if (!res?.success && sdk.getOrCreateLeaderboard) {
        res = await sdk.getOrCreateLeaderboard('rainbow-claw-top', 1, 0);
      }
      this.boardId = typeof res === 'string' ? res : res?.data?.id || res?.id || null;
    } catch { /* ignore */ }
    return this.boardId;
  }

  public async fetchLeaderboardTop(limit = 8): Promise<LeaderboardEntry[]> {
    const sdk = this.getSdk();
    if (sdk?.listLeaderboardEntries) {
      try {
        const id = await this.ensureBoard();
        if (id) {
          const raw = await sdk.listLeaderboardEntries(id, 0, limit, false);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entries: any[] = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.entries) ? raw.entries : (Array.isArray(raw) ? raw : []));
          return entries.map((e, i) => ({
            rank: e.globalRank || i + 1,
            score: e.score || 0,
            name: e.username || e.name || '',
            day: Number(e.metadata?.day ?? e.metadata?.extraData ?? e.extraData ?? 1),
          }));
        }
      } catch { /* fallback */ }
    }
    return [];
  }

  public async submitScore(score: number, day: number): Promise<void> {
    const best = this.getLocalHighScore();
    if (score > best) {
      try { localStorage.setItem(LOCAL_STORAGE_KEY, score.toString()); } catch { /* ignore */ }
    }

    const sdk = this.getSdk();
    if (sdk?.uploadLeaderboardScore) {
      try {
        const id = await this.ensureBoard();
        if (id) await sdk.uploadLeaderboardScore(id, score, true, undefined, { day, extraData: day });
      } catch { /* ignore */ }
    }
  }
}

export const wavedash = new WavedashService();
