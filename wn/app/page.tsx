import AuthPanel from "./components/AuthPanel";
import ChitterInvitePanel from "./components/ChitterInvitePanel";
import { prisma } from "../lib/prisma";
import { syncCatalog } from "../lib/catalog";
import { getSessionUserFromCookies } from "../lib/auth";

function formatPlaytime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default async function Home() {
  await syncCatalog();
  const games = await prisma.game.findMany({ orderBy: { title: "asc" } });
  const achievements = await prisma.achievement.findMany({ select: { gameId: true } });
  const totalByGame: Record<string, number> = {};
  achievements.forEach((row) => {
    totalByGame[row.gameId] = (totalByGame[row.gameId] || 0) + 1;
  });

  const user = await getSessionUserFromCookies();
  const unlockedByGame: Record<string, number> = {};
  const playtimeByGame: Record<string, number> = {};
  let achievementCount = 0;
  let playtimeTotal = 0;
  let invites: Array<{ id: string; toUsername: string; status: string }> = [];

  if (user) {
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: { select: { gameId: true } } },
    });
    userAchievements.forEach((row) => {
      unlockedByGame[row.achievement.gameId] = (unlockedByGame[row.achievement.gameId] || 0) + 1;
    });
    achievementCount = userAchievements.length;

    const stats = await prisma.userGameStat.findMany({ where: { userId: user.id } });
    stats.forEach((stat) => {
      playtimeByGame[stat.gameId] = stat.playtimeSeconds;
      playtimeTotal += stat.playtimeSeconds;
    });

    invites = await prisma.chitterInvite.findMany({
      where: { fromUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, toUsername: true, status: true },
    });
  }

  const userSummary = user
    ? {
        id: user.id,
        username: user.username,
        currencyBalance: user.currencyBalance,
        achievementCount,
        playtimeSeconds: playtimeTotal,
        createdAt: user.createdAt.toISOString(),
      }
    : null;

  return (
    <main className="library-root">
      <div className="library-bg" />
      <header className="library-header">
        <div className="brand">
          <span className="brand-mark">WN</span>
          <div>
            <div className="brand-title">WebNerd Library</div>
            <div className="brand-sub">Your curated arcade vault</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-wrap">
            <input className="search-input" placeholder="Search your library..." />
          </div>
          <div className="status-pill">Online</div>
        </div>
      </header>

      <section className="library-shell">
        <aside className="library-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">Library</div>
            <nav className="sidebar-links">
              <a className="active" href="#">
                Home
              </a>
              <a href="#">Recently Played</a>
              <a href="#">Achievements</a>
              <a href="#">Friends</a>
            </nav>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-title">Collections</div>
            <div className="chip-row">
              <span className="chip">Arcade</span>
              <span className="chip">Strategy</span>
              <span className="chip">Sandbox</span>
              <span className="chip">Simulation</span>
            </div>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-title">Session</div>
            <p className="sidebar-copy">
              Track achievements, earn currency, and sync progress across your games.
            </p>
          </div>
        </aside>

        <div className="library-main">
          <div className="section-header">
            <div>
              <h2>All Games</h2>
              <p>Two experiences, one unified profile. Launch a game to start tracking stats.</p>
            </div>
            <div className="meta-row">
              <div className="meta-card">
                <span className="meta-label">Total Games</span>
                <span className="meta-value">{games.length}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Achievements Unlocked</span>
                <span className="meta-value">{achievementCount}</span>
              </div>
            </div>
          </div>

          <div className="game-grid">
            {games.map((game, index) => {
              const unlocked = unlockedByGame[game.id] || 0;
              const total = totalByGame[game.id] || 0;
              const playtime = playtimeByGame[game.id] || 0;
              return (
                <article className="game-card" key={game.id}>
                  <div className={`game-art art-${index % 3}`}>
                    <div className="game-glow" />
                    <div className="game-title">{game.title}</div>
                    <div className="game-subtitle">{game.description}</div>
                  </div>
                  <div className="game-body">
                    <div className="game-meta">
                      <span>{unlocked} / {total} achievements</span>
                      <span>{playtime ? formatPlaytime(playtime) : "No playtime yet"}</span>
                    </div>
                    <div className="game-actions">
                      <a className="primary-btn" href={`/${game.slug}`}>
                        Play
                      </a>
                      <button className="ghost-btn">Details</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="library-right">
          <AuthPanel user={userSummary} />
          <ChitterInvitePanel enabled={Boolean(user)} invites={invites} />
          <section className="panel currency-panel">
            <div className="panel-header">Currency System</div>
            <div className="panel-body">
              <p>
                Earn credits by playing games and unlocking achievements. Use them for future skins,
                boosts, and store perks.
              </p>
              <div className="currency-hint">Server-backed. JWT secured. No local storage.</div>
            </div>
          </section>
        </aside>
      </section>

      <style jsx global>{`
        :root {
          --bg: #0a0f1e;
          --panel: rgba(10, 17, 33, 0.82);
          --panel-strong: rgba(18, 26, 48, 0.9);
          --text: #e7edf7;
          --muted: #8ea1c0;
          --accent: #7dd3fc;
          --accent-strong: #38bdf8;
          --outline: rgba(125, 211, 252, 0.2);
          --glow: rgba(125, 211, 252, 0.25);
          --danger: #ff6b6b;
        }

        body {
          background: var(--bg);
          color: var(--text);
        }

        .library-root {
          min-height: 100vh;
          padding: 32px 48px 64px;
          position: relative;
          overflow: hidden;
        }

        .library-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 15% 20%, rgba(125, 211, 252, 0.15), transparent 45%),
            radial-gradient(circle at 80% 10%, rgba(56, 189, 248, 0.18), transparent 40%),
            radial-gradient(circle at 60% 90%, rgba(129, 140, 248, 0.12), transparent 42%),
            linear-gradient(160deg, rgba(9, 13, 26, 0.9), rgba(9, 15, 33, 0.96));
          z-index: 0;
        }

        .library-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(125, 211, 252, 0.08);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          border-radius: 16px;
          background: linear-gradient(140deg, #38bdf8, #0ea5e9);
          color: #041527;
          font-family: var(--font-display);
          font-size: 22px;
          letter-spacing: 1px;
          box-shadow: 0 12px 24px rgba(56, 189, 248, 0.25);
        }

        .brand-title {
          font-family: var(--font-display);
          font-size: 28px;
          letter-spacing: 2px;
        }

        .brand-sub {
          color: var(--muted);
          font-size: 14px;
          margin-top: 4px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .search-wrap {
          background: rgba(12, 20, 38, 0.7);
          border: 1px solid rgba(125, 211, 252, 0.2);
          border-radius: 18px;
          padding: 8px 14px;
          min-width: 280px;
        }

        .search-input {
          width: 100%;
          background: transparent;
          border: none;
          color: var(--text);
          font-size: 14px;
          outline: none;
        }

        .status-pill {
          padding: 8px 16px;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.15);
          color: #86efac;
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .library-shell {
          position: relative;
          z-index: 1;
          margin-top: 24px;
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr) 300px;
          gap: 24px;
        }

        .library-sidebar,
        .library-right {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .library-sidebar {
          background: var(--panel);
          border: 1px solid rgba(125, 211, 252, 0.08);
          border-radius: 20px;
          padding: 20px;
          backdrop-filter: blur(6px);
        }

        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sidebar-title {
          font-family: var(--font-display);
          letter-spacing: 1px;
          font-size: 16px;
        }

        .sidebar-links {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sidebar-links a {
          color: var(--muted);
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 10px;
        }

        .sidebar-links a.active,
        .sidebar-links a:hover {
          color: var(--text);
          background: rgba(125, 211, 252, 0.12);
        }

        .chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.12);
          color: var(--text);
        }

        .sidebar-copy {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.4;
        }

        .library-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 28px;
          font-family: var(--font-display);
          letter-spacing: 1px;
        }

        .section-header p {
          color: var(--muted);
          max-width: 520px;
          margin-top: 8px;
        }

        .meta-row {
          display: flex;
          gap: 12px;
        }

        .meta-card {
          background: var(--panel);
          border-radius: 14px;
          padding: 12px 16px;
          border: 1px solid rgba(125, 211, 252, 0.12);
          min-width: 150px;
        }

        .meta-label {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .meta-value {
          font-size: 20px;
          font-family: var(--font-display);
        }

        .game-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
        }

        .game-card {
          background: var(--panel);
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(125, 211, 252, 0.12);
          display: flex;
          flex-direction: column;
          min-height: 260px;
        }

        .game-art {
          position: relative;
          padding: 22px;
          min-height: 140px;
          background: linear-gradient(145deg, rgba(56, 189, 248, 0.12), rgba(15, 23, 42, 0.8));
        }

        .game-art.art-1 {
          background: linear-gradient(145deg, rgba(129, 140, 248, 0.18), rgba(15, 23, 42, 0.8));
        }

        .game-art.art-2 {
          background: linear-gradient(145deg, rgba(251, 146, 60, 0.18), rgba(15, 23, 42, 0.8));
        }

        .game-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top right, rgba(56, 189, 248, 0.45), transparent 55%);
          opacity: 0.6;
        }

        .game-title {
          position: relative;
          font-family: var(--font-display);
          font-size: 22px;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .game-subtitle {
          position: relative;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.4;
        }

        .game-body {
          padding: 18px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
        }

        .game-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--muted);
        }

        .game-actions {
          display: flex;
          gap: 12px;
        }

        .panel {
          background: var(--panel);
          border-radius: 18px;
          border: 1px solid rgba(125, 211, 252, 0.12);
          overflow: hidden;
        }

        .panel-header {
          padding: 14px 18px;
          background: var(--panel-strong);
          font-family: var(--font-display);
          letter-spacing: 1px;
          font-size: 14px;
        }

        .panel-body {
          padding: 16px 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .auth-panel .profile-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(125, 211, 252, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          letter-spacing: 1px;
        }

        .profile-name {
          font-size: 16px;
        }

        .profile-sub {
          font-size: 12px;
          color: var(--muted);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .stat-label {
          font-size: 10px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .stat-value {
          font-size: 16px;
        }

        .tab-row {
          display: flex;
          gap: 8px;
        }

        .tab {
          flex: 1;
          padding: 8px 10px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(125, 211, 252, 0.2);
          color: var(--muted);
          cursor: pointer;
        }

        .tab.active {
          color: var(--text);
          border-color: rgba(125, 211, 252, 0.5);
          background: rgba(125, 211, 252, 0.12);
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: var(--muted);
        }

        .field input {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(125, 211, 252, 0.2);
          background: rgba(7, 12, 24, 0.7);
          color: var(--text);
        }

        .hint {
          font-size: 12px;
          color: var(--muted);
        }

        .hint.error {
          color: var(--danger);
        }

        .primary-btn {
          padding: 10px 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent-strong), #1d4ed8);
          color: #041527;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .ghost-btn {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(125, 211, 252, 0.35);
          background: transparent;
          color: var(--text);
          cursor: pointer;
        }

        .invite-panel .search {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(125, 211, 252, 0.2);
          background: rgba(7, 12, 24, 0.7);
          color: var(--text);
        }

        .friend-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .friend-chip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(125, 211, 252, 0.16);
          background: rgba(12, 18, 34, 0.6);
          color: var(--text);
          cursor: pointer;
        }

        .chip-cta {
          color: var(--accent);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .invite-history {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .subhead {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .invite-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .tag {
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.12);
          color: var(--accent);
          font-size: 10px;
          text-transform: uppercase;
        }

        .currency-panel p {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.4;
        }

        .currency-hint {
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(125, 211, 252, 0.08);
          font-size: 12px;
          color: var(--accent);
        }

        @media (max-width: 1100px) {
          .library-shell {
            grid-template-columns: 1fr;
          }
          .library-sidebar {
            order: 2;
          }
          .library-right {
            order: 3;
          }
          .section-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
