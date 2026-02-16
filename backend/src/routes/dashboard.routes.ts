/**
 * Circle for Life — Web Dashboard
 * Serves the full SPA from root URL with proper login/register flow.
 */

import { FastifyInstance } from 'fastify';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    reply.type('text/html').send(PAGE_HTML);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Full SPA — Login → Register → Dashboard
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Circle for Life</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #09090B; --bg2: #0D0D0F; --surface: #18181B; --surface2: #27272A;
      --border: #3F3F46; --text: #FAFAFA; --text2: #A1A1AA; --text3: #71717A;
      --accent: #6366F1; --accent2: #4F46E5; --accent-glow: rgba(99,102,241,0.12);
      --green: #22C55E; --red: #EF4444; --orange: #F59E0B; --purple: #A855F7;
      --pink: #EC4899; --radius: 12px; --radius-lg: 16px;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
      --shadow-lg: 0 8px 30px rgba(0,0,0,0.4);
      --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; min-height: 100vh; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    a { color: var(--accent); text-decoration: none; transition: color var(--transition); }
    a:hover { color: var(--accent2); }
    button { cursor: pointer; font-family: inherit; border: none; transition: all var(--transition); }
    input, select, textarea { font-family: inherit; outline: none; transition: border-color var(--transition), box-shadow var(--transition); }
    ::placeholder { color: var(--text3); }

    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border); }

    /* Smooth page transitions */
    .page { animation: pageIn 0.25s ease; }
    @keyframes pageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* ── Auth Pages ── */
    .auth-page { display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 20px;
      background: radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%);
    }
    .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 40px; width: 100%; max-width: 420px; box-shadow: var(--shadow-lg); }
    .auth-logo { text-align: center; margin-bottom: 32px; }
    .auth-logo h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .auth-logo h1 span { color: var(--accent); }
    .auth-logo p { color: var(--text3); font-size: 14px; margin-top: 6px; letter-spacing: 2px; font-weight: 500; }
    .auth-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .auth-subtitle { font-size: 14px; color: var(--text2); margin-bottom: 24px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
    .form-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; color: var(--text); font-size: 14px; }
    .form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    .form-input.error { border-color: var(--red); box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
    .form-error { color: var(--red); font-size: 12px; margin-top: 4px; display: none; }
    .form-error.show { display: block; }
    .btn-primary { width: 100%; background: var(--accent); color: #fff; padding: 12px; border-radius: var(--radius); font-size: 15px; font-weight: 700; }
    .btn-primary:hover { background: var(--accent2); box-shadow: 0 4px 16px rgba(99,102,241,0.3); transform: translateY(-1px); }
    .btn-primary:active { transform: translateY(0); box-shadow: none; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
    .auth-switch { text-align: center; margin-top: 20px; font-size: 14px; color: var(--text2); }
    .auth-switch a { font-weight: 600; }
    .auth-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--text3); font-size: 12px; }
    .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .alert-box { padding: 10px 14px; border-radius: var(--radius); font-size: 13px; margin-bottom: 16px; display: none; }
    .alert-box.show { display: block; animation: pageIn 0.2s ease; }
    .alert-box.error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: var(--red); }
    .alert-box.success { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); color: var(--green); }

    /* ── Dashboard Layout ── */
    .app { display: none; min-height: 100vh; }
    .app.show { display: flex; }
    .sidebar { width: 250px; background: var(--surface); border-right: 1px solid var(--border); position: fixed; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; }
    .sidebar-header { padding: 20px; border-bottom: 1px solid var(--border); }
    .sidebar-header h1 { font-size: 17px; font-weight: 800; }
    .sidebar-header h1 span { color: var(--accent); }
    .sidebar-header p { font-size: 10px; color: var(--text3); margin-top: 3px; letter-spacing: 1.5px; text-transform: uppercase; }
    .sidebar-nav { flex: 1; padding: 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 14px; color: var(--text3); font-size: 13px; font-weight: 500; cursor: pointer; border-radius: 8px; margin-bottom: 2px; border-left: none; }
    .nav-item:hover { color: var(--text2); background: rgba(255,255,255,0.04); }
    .nav-item.active { color: var(--text); background: var(--accent-glow); }
    .nav-item.active svg { color: var(--accent); }
    .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; opacity: 0.7; }
    .nav-item:hover svg { opacity: 1; }
    .nav-item.active svg { opacity: 1; }
    .sidebar-footer { padding: 16px; border-top: 1px solid var(--border); }
    .user-pill { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; transition: background var(--transition); }
    .user-pill:hover { background: rgba(255,255,255,0.03); }
    .user-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--purple)); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0; }
    .user-pill-info { flex: 1; min-width: 0; }
    .user-pill-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-pill-role { font-size: 11px; color: var(--text3); }
    .logout-btn { background: none; color: var(--text3); font-size: 18px; padding: 6px; line-height: 1; border-radius: 6px; }
    .logout-btn:hover { color: var(--red); background: rgba(239,68,68,0.08); }

    .main { flex: 1; margin-left: 250px; padding: 28px 36px; max-width: calc(100vw - 250px); overflow-x: hidden; box-sizing: border-box; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
    .page-subtitle { font-size: 14px; color: var(--text2); margin-top: 4px; }

    /* ── Stats ── */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; transition: all var(--transition); }
    .stat-card:hover { border-color: var(--surface2); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
    .stat-label { font-size: 12px; color: var(--text3); font-weight: 500; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-value.blue { color: var(--accent); }
    .stat-value.green { color: var(--green); }
    .stat-value.red { color: var(--red); }
    .stat-value.orange { color: var(--orange); }
    .stat-value.purple { color: var(--purple); }

    /* ── Table ── */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color var(--transition); }
    .card-toolbar { display: flex; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--border); flex-wrap: wrap; align-items: center; }
    .card-toolbar input, .card-toolbar select { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text); font-size: 13px; }
    .card-toolbar input:focus, .card-toolbar select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
    .card-toolbar input { flex: 1; min-width: 180px; }
    .toolbar-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .toolbar-btn:hover { transform: translateY(-1px); }
    .toolbar-btn:active { transform: translateY(0); }
    .toolbar-btn-primary { background: var(--accent); color: #fff; }
    .toolbar-btn-primary:hover { box-shadow: 0 2px 10px rgba(99,102,241,0.3); }
    .toolbar-btn-success { background: var(--green); color: #fff; }
    .toolbar-btn-success:hover { box-shadow: 0 2px 10px rgba(34,197,94,0.3); }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px 18px; font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; background: var(--bg); }
    td { padding: 12px 18px; font-size: 13px; border-top: 1px solid var(--border); transition: background var(--transition); }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .role-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    .role-super_admin { background: rgba(239,68,68,0.12); color: var(--red); }
    .role-admin { background: rgba(245,158,11,0.12); color: var(--orange); }
    .role-moderator { background: rgba(168,85,247,0.12); color: var(--purple); }
    .role-creator { background: rgba(34,197,94,0.12); color: var(--green); }
    .role-user { background: rgba(99,102,241,0.12); color: var(--accent); }
    .role-guest { background: rgba(113,113,122,0.12); color: var(--text3); }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
    .dot-green { background: var(--green); }
    .dot-red { background: var(--red); }
    .dot-orange { background: var(--orange); }
    .dot-gray { background: var(--text3); }
    .btn-xs { padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-right: 4px; margin-bottom: 4px; display: inline-block; }
    .btn-xs:hover { filter: brightness(1.2); }
    .btn-xs-blue { background: rgba(99,102,241,0.12); color: var(--accent); }
    .btn-xs-green { background: rgba(34,197,94,0.12); color: var(--green); }
    .btn-xs-red { background: rgba(239,68,68,0.12); color: var(--red); }
    .btn-xs-orange { background: rgba(245,158,11,0.12); color: var(--orange); }

    /* ── Modal ── */
    .modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; backdrop-filter: blur(6px); }
    .modal-bg.show { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px; max-width: 480px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: var(--shadow-lg); animation: modalIn 0.2s ease; }
    @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
    .modal h3 { font-size: 18px; margin-bottom: 20px; }
    .modal .form-group { margin-bottom: 14px; }
    .modal-footer { display: flex; gap: 8px; margin-top: 24px; justify-content: flex-end; }
    .modal-footer button { padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .modal-footer button:hover { transform: translateY(-1px); }
    .modal-footer button:active { transform: translateY(0); }
    .btn-modal-primary { background: var(--accent); color: #fff; }
    .btn-modal-primary:hover { box-shadow: 0 2px 10px rgba(99,102,241,0.3); }
    .btn-modal-cancel { background: var(--surface2); color: var(--text2); }
    .btn-modal-cancel:hover { background: var(--border); color: var(--text); }
    .btn-modal-danger { background: var(--red); color: #fff; }
    .btn-modal-danger:hover { box-shadow: 0 2px 10px rgba(239,68,68,0.3); }

    /* ── Chat ── */
    .chat-wrap { display: flex; flex-direction: column; height: calc(100vh - 180px); }
    .chat-settings { display: flex; gap: 8px; padding: 14px 0; flex-wrap: wrap; align-items: center; }
    .chat-settings select, .chat-settings input { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text); font-size: 13px; }
    .chat-settings select:focus, .chat-settings input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
    .chat-settings input { flex: 1; min-width: 180px; }
    .chat-box { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius) var(--radius) 0 0; overflow-y: auto; padding: 20px; scroll-behavior: smooth; }
    .msg { margin-bottom: 16px; max-width: 75%; animation: msgIn 0.2s ease; }
    @keyframes msgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .msg.user { margin-left: auto; }
    .msg .bubble { padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
    .msg.user .bubble { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
    .msg.bot .bubble { background: var(--surface2); border-bottom-left-radius: 4px; }
    .msg .ts { font-size: 10px; color: var(--text3); margin-top: 4px; }
    .chat-input { display: flex; gap: 0; border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); overflow: hidden; }
    .chat-input input { flex: 1; background: var(--surface); border: none; padding: 14px 18px; color: var(--text); font-size: 14px; }
    .chat-input button { background: var(--accent); color: #fff; padding: 14px 24px; font-weight: 700; font-size: 14px; }
    .chat-input button:hover { background: var(--accent2); }

    /* ── API Tester ── */
    .api-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .api-row select { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: var(--accent); font-weight: 600; }
    .api-row select:focus { border-color: var(--accent); }
    .api-row input { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; }
    .api-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
    .api-row button { background: var(--accent); color: #fff; border-radius: 8px; padding: 10px 24px; font-weight: 700; }
    .api-row button:hover { background: var(--accent2); box-shadow: 0 2px 10px rgba(99,102,241,0.3); }
    #apiBody { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; color: var(--text); font-size: 13px; font-family: 'SF Mono', 'Fira Code', monospace; min-height: 80px; resize: vertical; margin-bottom: 12px; }
    #apiBody:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
    #apiResponse { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-size: 13px; white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto; font-family: 'SF Mono', 'Fira Code', monospace; color: var(--green); }

    /* ── Toast ── */
    .toast { position: fixed; top: 20px; right: 20px; padding: 12px 24px; border-radius: var(--radius); font-size: 14px; font-weight: 600; z-index: 200; transform: translateY(-30px); opacity: 0; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); pointer-events: none; box-shadow: var(--shadow-lg); }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.ok { background: var(--green); color: #fff; }
    .toast.err { background: var(--red); color: #fff; }

    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--surface2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes callRipple { 0% { width:120px;height:120px;opacity:0.6; } 100% { width:300px;height:300px;opacity:0; } }
    @keyframes callPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
    @keyframes callRing { 0%,100%{transform:rotate(0deg)} 10%{transform:rotate(15deg)} 20%{transform:rotate(-15deg)} 30%{transform:rotate(10deg)} 40%{transform:rotate(-10deg)} 50%{transform:rotate(0deg)} }

    /* ── Online Status ── */
    .status-dot { width:12px;height:12px;border-radius:50%;display:inline-block;flex-shrink:0;border:2.5px solid var(--surface);transition:all var(--transition); }
    .status-dot.online { background:var(--green);box-shadow:0 0 8px rgba(34,197,94,0.5); }
    .status-dot.offline { background:#52525b;box-shadow:none; }
    .online-badge { display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px; }
    .online-badge.is-online { color:var(--green);background:rgba(34,197,94,0.1); }
    .online-badge.is-offline { color:var(--text3);background:transparent; }

    /* ── Conversation Items ── */
    .convo-item { background:transparent; border:1px solid transparent; }
    .convo-item:hover { background:rgba(255,255,255,0.03); }
    .convo-item.active { background:var(--accent-glow); border-color:rgba(99,102,241,0.2); }
    .convo-item.active:hover { background:var(--accent-glow); }

    /* ── Level System ── */
    .level-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px; position: relative; overflow: hidden; }
    .level-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
    .level-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .level-icon { font-size: 40px; line-height: 1; }
    .level-info h3 { font-size: 20px; font-weight: 700; }
    .level-info p { font-size: 13px; color: var(--text2); margin-top: 2px; }
    .level-bar-wrap { margin-bottom: 12px; }
    .level-bar-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text3); margin-bottom: 6px; }
    .level-bar { background: var(--surface2); border-radius: 6px; height: 10px; overflow: hidden; }
    .level-bar-fill { height: 100%; border-radius: 6px; transition: width 0.8s ease; }
    .level-perks { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .level-perk { font-size: 12px; padding: 4px 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 6px; color: var(--text2); }
    .level-perk.active { background: var(--accent-glow); border-color: rgba(99,102,241,0.3); color: var(--accent); }

    /* Level Roadmap */
    .levels-roadmap { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 16px; }
    .lvl-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; position: relative; transition: all 0.2s; }
    .lvl-card.locked { opacity: 0.5; }
    .lvl-card.current { border-color: var(--accent); box-shadow: 0 0 20px var(--accent-glow); }
    .lvl-card .lvl-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .lvl-card .lvl-icon { font-size: 24px; }
    .lvl-card .lvl-name { font-size: 15px; font-weight: 700; }
    .lvl-card .lvl-gems { font-size: 11px; color: var(--text3); }
    .lvl-card .lvl-perks { font-size: 11px; color: var(--text2); line-height: 1.6; }
    .lvl-card .lock-overlay { position: absolute; inset: 0; background: rgba(9,9,11,0.4); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; }
    .lvl-card .lock-overlay span { font-size: 24px; }

    /* Blog */
    .btn-small { font-size:11px; padding:5px 12px; border-radius:6px; background:var(--surface); border:1px solid var(--border); color:var(--text2); cursor:pointer; }
    .btn-small:hover { background:var(--surface2); color:var(--accent); border-color:var(--accent); }
    .btn-small:active { transform:scale(0.97); }
    .calllog-filter.active { background:var(--accent); color:#fff; border-color:var(--accent); }
    .btn-icon { background:none; border:none; cursor:pointer; color:var(--text2); padding:6px; border-radius:6px; }
    .btn-icon:hover { background:var(--surface2); color:var(--accent); }

    /* ── Blueprint Page ───────────────────────────────── */
    .bp-hero { text-align:center; padding:40px 24px; background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08)); border:1px solid var(--border); border-radius:16px; margin-bottom:32px; }
    .bp-hero-badge { display:inline-block; padding:4px 16px; background:var(--accent); color:#fff; border-radius:999px; font-size:0.7rem; font-weight:700; letter-spacing:2px; margin-bottom:12px; }
    .bp-hero-tagline { font-size:1.6rem; font-weight:800; margin:0 0 12px; background:linear-gradient(135deg,var(--accent),#a855f7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .bp-hero-pitch { max-width:620px; margin:0 auto 20px; color:var(--text2); line-height:1.6; }
    .bp-hero-actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
    .bp-section-title { font-size:1.15rem; font-weight:700; margin:32px 0 16px; padding-bottom:8px; border-bottom:2px solid var(--accent); display:inline-block; }
    .bp-growth-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; margin-bottom:24px; }
    .bp-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:20px; transition:all 0.2s; }
    .bp-card:hover { border-color:var(--accent); transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,0.1); }
    .bp-card-icon { font-size:1.8rem; margin-bottom:8px; }
    .bp-card h4 { margin:0 0 6px; font-weight:700; }
    .bp-card p { margin:0; color:var(--text2); font-size:0.85rem; line-height:1.5; }
    .bp-timeline { display:flex; gap:0; overflow-x:auto; padding-bottom:12px; margin-bottom:24px; }
    .bp-phase { flex:1; min-width:220px; position:relative; padding:20px; border:1px solid var(--border); border-radius:14px; background:var(--surface); margin-right:12px; }
    .bp-phase:last-child { margin-right:0; }
    .bp-phase.current { border-color:var(--accent); background:linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.06)); }
    .bp-phase-badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:0.65rem; font-weight:700; letter-spacing:1px; margin-bottom:8px; }
    .bp-phase.current .bp-phase-badge { background:var(--accent); color:#fff; }
    .bp-phase.planned .bp-phase-badge { background:var(--surface2); color:var(--text2); }
    .bp-phase h4 { margin:0 0 4px; font-weight:700; font-size:0.95rem; }
    .bp-phase .bp-phase-sub { margin:0 0 10px; color:var(--text2); font-size:0.78rem; }
    .bp-phase ul { margin:0; padding-left:18px; }
    .bp-phase li { font-size:0.78rem; color:var(--text2); margin-bottom:3px; }
    .bp-table-wrap { overflow-x:auto; margin-bottom:24px; }
    .bp-table { width:100%; border-collapse:collapse; background:var(--surface); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
    .bp-table th { text-align:left; padding:12px 14px; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text2); background:var(--surface2); border-bottom:1px solid var(--border); }
    .bp-table td { padding:12px 14px; font-size:0.85rem; border-bottom:1px solid var(--border); }
    .bp-table tr:last-child td { border-bottom:none; }
    .bp-status-badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:0.7rem; font-weight:600; }
    .bp-status-built { background:rgba(34,197,94,0.1); color:#22c55e; }
    .bp-status-planned { background:rgba(99,102,241,0.1); color:var(--accent); }
    .bp-status-in_progress { background:rgba(245,158,11,0.1); color:#f59e0b; }
    .bp-status-done { background:rgba(34,197,94,0.15); color:#16a34a; }
    .bp-status-shipped { background:rgba(99,102,241,0.15); color:#6366f1; }
    .bp-milestones { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; margin-bottom:24px; }
    .bp-ms-card { display:flex; align-items:center; gap:12px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 16px; transition:all 0.2s; }
    .bp-ms-card:hover { border-color:var(--accent); }
    .bp-ms-icon { font-size:1.2rem; flex-shrink:0; }
    .bp-ms-info { flex:1; min-width:0; }
    .bp-ms-title { font-weight:600; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bp-ms-cat { font-size:0.7rem; color:var(--text2); text-transform:uppercase; letter-spacing:0.5px; }
    .bp-ms-select { padding:4px 8px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text1); font-size:0.78rem; cursor:pointer; }
    .bp-ms-select:focus { border-color:var(--accent); outline:none; }
    .bp-copy-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; margin-bottom:24px; }
    .bp-copy-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; position:relative; }
    .bp-copy-label { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--accent); margin-bottom:6px; }
    .bp-copy-text { font-size:0.85rem; color:var(--text1); line-height:1.5; margin-bottom:10px; }
    .bp-copy-btn { position:absolute; top:12px; right:12px; font-size:0.7rem; }

    /* Nav locked state */
    .nav-item.locked { opacity: 0.35; }
    .nav-item.locked:hover { opacity: 0.5; }
    .nav-item .lock-icon { margin-left: auto; font-size: 11px; color: var(--text3); background:var(--surface2); padding:2px 6px; border-radius:4px; }

    /* Locked page */
    .locked-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; padding: 40px; }
    .locked-page .lock-big { font-size: 64px; margin-bottom: 20px; }
    .locked-page h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .locked-page p { color: var(--text2); font-size: 15px; max-width: 400px; line-height: 1.6; }
    .locked-page .unlock-info { margin-top: 16px; padding: 12px 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; }
    .locked-page .unlock-info strong { color: var(--accent); }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--text3); }
    .empty-state p { font-size: 15px; line-height: 1.6; }

    /* ── Mobile Top Bar ── */
    .mobile-topbar { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 90; background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 16px; height: 56px; align-items: center; justify-content: space-between; backdrop-filter: blur(12px); background: rgba(24,24,27,0.85); }
    .mobile-topbar h1 { font-size: 16px; font-weight: 800; }
    .mobile-topbar h1 span { color: var(--accent); }
    .hamburger { background: none; border: none; color: var(--text); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 8px; min-width: 44px; min-height: 44px; }
    .hamburger:hover { background: rgba(255,255,255,0.05); }
    .hamburger:active { background: rgba(255,255,255,0.08); }
    .hamburger svg { width: 24px; height: 24px; }

    /* ── Mobile Sidebar Overlay ── */
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 98; backdrop-filter: blur(4px); }
    .sidebar-overlay.show { display: block; }

    /* ════════ TABLET ≤ 1024px ════════ */
    @media (max-width: 1024px) {
      .main { padding: 20px; }
      .stats-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
      .levels-roadmap { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
    }

    /* ════════ MOBILE ≤ 768px ════════ */
    @media (max-width: 768px) {
      /* ─ Layout ─ */
      .mobile-topbar { display: flex; }
      .sidebar {
        position: fixed; left: -280px; width: 280px; top: 0; height: 100vh; z-index: 99;
        transition: left 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: none; border-right: none;
      }
      .sidebar.open { left: 0; box-shadow: 8px 0 40px rgba(0,0,0,0.6); }
      .main { margin-left: 0; padding: 16px; padding-top: 72px; max-width: 100vw; }
      .auth-card { padding: 24px 18px; max-width: 100%; }
      .auth-page { padding: 16px; }

      /* ─ Page content ─ */
      .page-header { margin-bottom: 16px; }
      .page-title { font-size: 20px; }
      .page-subtitle { font-size: 13px; }

      /* ─ Stats ─ */
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .stat-card { padding: 14px; }
      .stat-value { font-size: 22px; }
      .stat-label { font-size: 11px; }

      /* ─ Level ─ */
      .level-card { padding: 16px; }
      .level-header { gap: 12px; }
      .level-icon { font-size: 32px; }
      .level-info h3 { font-size: 18px; }
      .levels-roadmap { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .lvl-card { padding: 12px; }
      .lvl-card .lvl-icon { font-size: 20px; }
      .lvl-card .lvl-name { font-size: 13px; }

      /* ─ Tables → scrollable ─ */
      .card { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      table { min-width: 600px; }
      th, td { padding: 10px 12px; font-size: 12px; white-space: nowrap; }
      .card-toolbar { flex-wrap: wrap; gap: 6px; padding: 10px 12px; }
      .card-toolbar input { min-width: 120px; font-size: 12px; }
      .toolbar-btn { padding: 6px 12px; font-size: 12px; }

      /* ─ Chat ─ */
      .chat-wrap { height: calc(100vh - 140px); }
      .chat-settings { gap: 6px; padding: 10px 0; flex-direction: column; }
      .chat-settings select, .chat-settings input { width: 100%; min-width: 0; font-size: 13px; }
      .chat-box { padding: 12px; }
      .chat-input { flex-wrap: wrap; }
      .chat-input input { padding: 10px 12px; font-size: 16px; min-width: 0; flex: 1 1 60%; }
      .chat-input button { padding: 10px 12px; font-size: 12px; white-space: nowrap; }
      .msg { max-width: 90%; }
      .msg .bubble { padding: 10px 14px; font-size: 13px; }

      /* ─ API Tester ─ */
      .api-row { flex-direction: column; gap: 6px; }
      .api-row select, .api-row input, .api-row button { width: 100%; }
      #apiResponse { font-size: 11px; max-height: 300px; }

      /* ─ Modal ─ */
      .modal-bg { align-items: flex-end; }
      .modal { width: 100%; max-width: 100%; border-radius: var(--radius-lg) var(--radius-lg) 0 0; max-height: 90vh; padding: 20px; }
      .modal h3 { font-size: 16px; }
      .modal-footer { flex-direction: column; }
      .modal-footer button { width: 100%; }

      /* ─ Blog ─ */
      .blog-editor textarea, .blog-editor input, .blog-editor select { font-size: 13px; }

      /* ─ Voice Lab ─ */
      #p-voice .card { margin-bottom: 12px; }
      #p-voice .form-group { min-width: 100% !important; }

      /* ─ Image Studio ─ */
      #p-images .form-group { min-width: 100% !important; }

      /* ─ P2P Chat ─ */
      #p2pLayout { flex-direction: column; height: auto; min-height: 0; }
      #p2pConvoPane { width: 100% !important; min-width: 0 !important; max-height: 200px; }
      #p2pMessages { padding: 10px; }

      /* ─ Toast ─ */
      .toast { left: 16px; right: 16px; top: 64px; text-align: center; }

      /* ─ Misc ─ */
      .locked-page { padding: 20px; min-height: 40vh; }
      .locked-page .lock-big { font-size: 48px; }
      .locked-page h2 { font-size: 18px; }
      .locked-page p { font-size: 14px; }
      .form-input { font-size: 16px; padding: 10px 12px; } /* prevent iOS zoom */
      select.form-input { font-size: 16px; }
      .btn-small { font-size: 12px; padding: 6px 12px; }
      .btn-xs { font-size: 11px; padding: 4px 8px; }

      /* flex rows that should stack */
      [style*="display:flex"][style*="gap:12px"] { flex-wrap: wrap !important; }
    }

    /* ════════ SMALL MOBILE ≤ 480px ════════ */
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
      .stat-card { padding: 12px; }
      .stat-value { font-size: 20px; }
      .levels-roadmap { grid-template-columns: 1fr; }
      .level-perks { gap: 4px; }
      .level-perk { font-size: 11px; padding: 3px 8px; }
      .auth-logo h1 { font-size: 24px; }
      .chat-input button { padding: 8px 10px; font-size: 11px; }
      .modal { padding: 16px; }
    }
  </style>
</head>
<body>

<!-- ═══════════════════ AUTH PAGE ═══════════════════ -->
<div id="authPage" class="auth-page">
  <div class="auth-card">
    <div class="auth-logo">
      <h1><span>Circle</span> for Life</h1>
      <p>CREATE &middot; COMPETE &middot; EARN</p>
    </div>

    <!-- Login Form -->
    <div id="loginForm">
      <h2 class="auth-title">Welcome back</h2>
      <p class="auth-subtitle">Sign in to your account</p>
      <div class="alert-box" id="loginAlert"></div>
      <div class="form-group">
        <label>Email</label>
        <input class="form-input" type="email" id="loginEmail" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input class="form-input" type="password" id="loginPass" placeholder="Enter your password">
      </div>
      <button class="btn-primary" id="loginBtn" onclick="handleLogin()">Sign In</button>
      <div class="auth-switch">
        Don't have an account? <a href="#" onclick="showRegister(); return false;">Create one</a>
      </div>
      <div class="auth-divider">demo credentials</div>
      <p style="text-align:center;font-size:12px;color:var(--text3);">
        admin@circleforlife.app / admin123456
      </p>
    </div>

    <!-- Register Form -->
    <div id="registerForm" style="display:none;">
      <h2 class="auth-title">Create account</h2>
      <p class="auth-subtitle">Join the Circle</p>
      <div class="alert-box" id="registerAlert"></div>
      <div class="form-group">
        <label>Username</label>
        <input class="form-input" type="text" id="regUsername" placeholder="coolcreator">
      </div>
      <div class="form-group">
        <label>Display Name</label>
        <input class="form-input" type="text" id="regDisplayName" placeholder="Cool Creator">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input class="form-input" type="email" id="regEmail" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input class="form-input" type="password" id="regPass" placeholder="Min 8 characters">
      </div>
      <div class="form-group">
        <label>Referral Code <span style="color:var(--text3)">(optional)</span></label>
        <input class="form-input" type="text" id="regReferral" placeholder="ABCD1234">
      </div>
      <button class="btn-primary" id="regBtn" onclick="handleRegister()">Create Account</button>
      <div class="auth-switch">
        Already have an account? <a href="#" onclick="showLogin(); return false;">Sign in</a>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════ DASHBOARD ═══════════════════ -->
<div id="dashApp" class="app">
  <!-- Mobile Top Bar -->
  <div class="mobile-topbar" id="mobileTopbar">
    <button class="hamburger" id="hamburgerBtn" onclick="toggleMobileNav()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <h1><span>Circle</span> for Life</h1>
    <button class="hamburger" onclick="logout()" title="Logout">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    </button>
  </div>
  <!-- Sidebar Overlay (click to close) -->
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeMobileNav()"></div>

  <div class="sidebar" id="sidebarEl">
    <div class="sidebar-header">
      <h1><span>Circle</span> for Life</h1>
      <p>DASHBOARD</p>
    </div>
    <div class="sidebar-nav" id="sidebarNav">
      <!-- Populated dynamically by JS based on user level -->
    </div>
    <div class="sidebar-footer">
      <div class="user-pill">
        <div class="user-avatar" id="sidebarAvatar">A</div>
        <div class="user-pill-info">
          <div class="user-pill-name" id="sidebarName">-</div>
          <div class="user-pill-role" id="sidebarRole">-</div>
        </div>
        <button class="logout-btn" onclick="logout()" title="Logout">&times;</button>
      </div>
    </div>
  </div>

  <div class="main">
    <!-- Overview -->
    <div class="page" id="p-overview">
      <div class="page-header">
        <h2 class="page-title">Dashboard</h2>
        <p class="page-subtitle" id="overviewSubtitle">Your Circle for Life hub</p>
      </div>

      <!-- Level Progress Card -->
      <div class="level-card" id="levelCard"></div>

      <!-- Level Roadmap -->
      <div class="card" style="margin-bottom:24px;">
        <div style="padding:16px 18px;font-weight:700;font-size:14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">&#127942; Level Roadmap</div>
        <div style="padding:18px;">
          <div class="levels-roadmap" id="levelsRoadmap"></div>
        </div>
      </div>

      <div class="stats-grid" id="statsGrid"></div>
      <div class="card">
        <div style="padding:16px 18px;font-weight:700;font-size:14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">&#9889; Recent Activity</div>
        <div id="recentActivity" style="padding:18px;color:var(--text3);font-size:13px;">Loading...</div>
      </div>
    </div>

    <!-- Users -->
    <div class="page" id="p-users" style="display:none">
      <div class="page-header"><h2 class="page-title">User Management</h2><p class="page-subtitle">Manage users, roles, and permissions</p></div>
      <div class="card">
        <div class="card-toolbar">
          <input type="text" id="userSearch" placeholder="Search users..." onkeydown="if(event.key==='Enter')loadUsers()">
          <select id="roleFilter" onchange="loadUsers()">
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="creator">Creator</option>
            <option value="user">User</option>
            <option value="guest">Guest</option>
          </select>
          <select id="statusFilter" onchange="loadUsers()">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
            <option value="pending_review">Pending Review</option>
          </select>
          <button class="toolbar-btn toolbar-btn-primary" onclick="loadUsers()">Search</button>
          <button class="toolbar-btn toolbar-btn-success" onclick="openModal('createModal')">+ New User</button>
        </div>
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Tier</th><th>Level</th><th>Gems</th><th>Trust</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="usersTbody"><tr><td colspan="8" class="empty-state"><p>Loading...</p></td></tr></tbody>
        </table>
      </div>

      <!-- User Detail Panel (shown when clicking a user row) -->
      <div id="userDetailPanel" class="card" style="display:none;margin-top:16px;">
        <div style="padding:18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <h3 style="font-weight:700;" id="udpTitle">User Details</h3>
          <button onclick="closeUserDetail()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;">&times;</button>
        </div>
        <div style="padding:18px;" id="udpContent"></div>
      </div>
    </div>

    <!-- ═══════════ PROFILE PAGE ═══════════ -->
    <div class="page" id="p-profile" style="display:none">
      <div class="page-header">
        <h2 class="page-title">My Profile</h2>
        <p class="page-subtitle">View and edit your public profile</p>
      </div>

      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <!-- Profile Card -->
        <div class="card" style="flex:1;min-width:300px;max-width:420px;">
          <div style="padding:28px;text-align:center;">
            <!-- Avatar -->
            <div id="profileAvatarWrap" style="position:relative;display:inline-block;margin-bottom:16px;">
              <div id="profileAvatar" style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:700;color:#fff;margin:0 auto;overflow:hidden;box-shadow:0 4px 20px rgba(99,102,241,0.25);">
                <img id="profileAvatarImg" style="width:100%;height:100%;object-fit:cover;display:none;">
                <span id="profileAvatarLetter">?</span>
              </div>
              <button onclick="document.getElementById('avatarUrlInput').style.display=''" style="position:absolute;bottom:2px;right:2px;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;border:2px solid var(--surface);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;">&#9998;</button>
            </div>
            <div id="avatarUrlInput" style="display:none;margin-bottom:12px;">
              <input type="text" class="form-input" id="profileAvatarUrl" placeholder="Paste avatar URL..." style="font-size:12px;">
              <div style="display:flex;gap:4px;margin-top:4px;justify-content:center;">
                <button class="btn-small" onclick="saveAvatarUrl()">Save</button>
                <button class="btn-small" onclick="document.getElementById('avatarUrlInput').style.display='none'">Cancel</button>
              </div>
            </div>

            <!-- Name & Level Badge -->
            <h3 id="profileDisplayName" style="font-size:20px;font-weight:700;margin:0 0 4px;"></h3>
            <div id="profileUsername" style="font-size:13px;color:var(--text3);margin-bottom:8px;"></div>
            <div id="profileBadge" style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:12px;"></div>
            <div id="profileRole" style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;"></div>

            <!-- Bio -->
            <div id="profileBioDisplay" style="font-size:13px;color:var(--text2);line-height:1.6;padding:0 12px;min-height:20px;"></div>
          </div>

          <!-- Stats Grid -->
          <div style="border-top:1px solid var(--border);padding:16px 24px;">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;">
              <div>
                <div id="profStatGems" style="font-size:20px;font-weight:700;color:var(--accent);">0</div>
                <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Gems</div>
              </div>
              <div>
                <div id="profStatPosts" style="font-size:20px;font-weight:700;color:var(--accent);">0</div>
                <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Posts</div>
              </div>
              <div>
                <div id="profStatVotes" style="font-size:20px;font-weight:700;color:var(--accent);">0</div>
                <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Votes</div>
              </div>
            </div>
          </div>

          <!-- More Stats -->
          <div style="border-top:1px solid var(--border);padding:16px 24px;">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">Total Earned</span><span id="profStatTotalGems" style="font-weight:600;">0</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">Total Spent</span><span id="profStatSpent" style="font-weight:600;">0</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">Streak</span><span id="profStatStreak" style="font-weight:600;">0 days</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">Referrals</span><span id="profStatReferrals" style="font-weight:600;">0</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">Member Since</span><span id="profStatJoined" style="font-weight:600;">-</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">Last Login</span><span id="profStatLastLogin" style="font-weight:600;">-</span></div>
            </div>
          </div>

          <!-- Referral Code -->
          <div style="border-top:1px solid var(--border);padding:16px 24px;">
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">YOUR REFERRAL CODE</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <code id="profReferralCode" style="flex:1;background:var(--surface2);padding:8px 12px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:1px;color:var(--accent);"></code>
              <button class="btn-small" onclick="navigator.clipboard.writeText(document.getElementById('profReferralCode').textContent).then(()=>toast('Copied!','ok'))">Copy</button>
            </div>
          </div>
        </div>

        <!-- Edit Profile Form -->
        <div class="card" style="flex:1.2;min-width:300px;">
          <div style="padding:24px;">
            <h3 style="font-size:15px;font-weight:700;margin:0 0 20px;display:flex;align-items:center;gap:8px;">&#9998; Edit Profile</h3>

            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;">Display Name</label>
              <input type="text" class="form-input" id="editDisplayName" maxlength="50" placeholder="Your display name">
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;">Bio</label>
              <textarea class="form-input" id="editBio" rows="3" maxlength="300" placeholder="Tell people about yourself..." style="resize:vertical;"></textarea>
              <div style="font-size:10px;color:var(--text3);text-align:right;margin-top:2px;"><span id="bioCharCount">0</span>/300</div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;">Location</label>
              <input type="text" class="form-input" id="editLocation" maxlength="100" placeholder="City, Country">
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;">Website</label>
              <input type="text" class="form-input" id="editWebsite" maxlength="200" placeholder="https://...">
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;">Avatar URL</label>
              <input type="text" class="form-input" id="editAvatarUrl" maxlength="500" placeholder="https://example.com/avatar.png">
            </div>

            <button class="btn-primary" onclick="saveProfile()" style="width:100%;padding:12px;font-size:14px;" id="saveProfileBtn">Save Changes</button>
            <div id="profileSaveStatus" style="text-align:center;font-size:12px;margin-top:8px;color:var(--text3);"></div>
          </div>

          <!-- Level Progress -->
          <div style="border-top:1px solid var(--border);padding:24px;">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 16px;">Level Progress</h3>
            <div id="profileLevelInfo"></div>
          </div>

          <!-- Unlocked Features -->
          <div style="border-top:1px solid var(--border);padding:24px;">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 16px;">Unlocked Features</h3>
            <div id="profileFeatures" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
          </div>
        </div>
      </div>

      <!-- Platform Configuration (super_admin only) -->
      <div id="platformConfigPanel" style="display:none;margin-top:24px;">
        <div class="card">
          <div style="padding:24px;">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 4px;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Platform Configuration
            </h3>
            <p style="font-size:12px;color:var(--text3);margin:0 0 20px;">Runtime settings for phone calls, AI providers, and integrations. Changes take effect immediately.</p>

            <!-- Phone Numbers -->
            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">Phone &amp; Twilio</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Admin Phone (escalation)</label>
                  <input type="text" class="form-input" id="cfgAdminPhone" placeholder="+919512373608" style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Twilio Phone Number</label>
                  <input type="text" class="form-input" id="cfgTwilioPhone" placeholder="+13237843509" style="font-size:13px;">
                </div>
              </div>
            </div>

            <!-- LLM Provider -->
            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">AI / LLM for Phone Calls</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Groq API Key</label>
                  <input type="password" class="form-input" id="cfgGroqKey" placeholder="gsk_..." style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">OpenAI API Key</label>
                  <input type="password" class="form-input" id="cfgOpenaiKey" placeholder="sk-..." style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Anthropic API Key</label>
                  <input type="password" class="form-input" id="cfgAnthropicKey" placeholder="sk-ant-..." style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Google API Key</label>
                  <input type="password" class="form-input" id="cfgGoogleKey" placeholder="AI..." style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">OpenRouter API Key</label>
                  <input type="password" class="form-input" id="cfgOpenrouterKey" placeholder="sk-or-..." style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Together API Key</label>
                  <input type="password" class="form-input" id="cfgTogetherKey" placeholder="" style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">DeepSeek API Key</label>
                  <input type="password" class="form-input" id="cfgDeepseekKey" placeholder="" style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Mistral API Key</label>
                  <input type="password" class="form-input" id="cfgMistralKey" placeholder="" style="font-size:13px;">
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Default LLM Provider</label>
                  <select class="form-input" id="cfgDefaultProvider" style="font-size:13px;">
                    <option value="">-- not set --</option>
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="together">Together</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="mistral">Mistral</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Default LLM Key</label>
                  <input type="password" class="form-input" id="cfgDefaultKey" placeholder="API key for default provider" style="font-size:13px;">
                </div>
              </div>
            </div>

            <!-- Kaggle & ElevenLabs -->
            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">Kaggle &amp; Voice</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Kaggle Ollama URL</label>
                  <input type="text" class="form-input" id="cfgKaggleUrl" placeholder="https://xxxx.ngrok-free.app" style="font-size:13px;">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">ElevenLabs API Key</label>
                  <input type="password" class="form-input" id="cfgElevenLabsKey" placeholder="" style="font-size:13px;">
                </div>
              </div>
            </div>

            <!-- Server URL -->
            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">Server</div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:4px;">Server URL (for Twilio webhooks)</label>
                <input type="text" class="form-input" id="cfgServerUrl" placeholder="https://your-app.up.railway.app" style="font-size:13px;">
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:center;">
              <button class="btn-primary" onclick="savePlatformConfig()" style="padding:10px 28px;font-size:14px;" id="savePlatformConfigBtn">Save Configuration</button>
              <button class="btn-small" onclick="loadPlatformConfig()" style="padding:8px 16px;">Reload</button>
              <span id="platformConfigStatus" style="font-size:12px;color:var(--text3);"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat -->
    <div class="page" id="p-chat" style="display:none">
      <div class="page-header"><h2 class="page-title">AI Chat Playground</h2><p class="page-subtitle">Chat with AI models powered by multiple providers</p></div>
      <div class="chat-wrap">
        <!-- Provider Row -->
        <div class="chat-settings">
          <select id="chatProvider" onchange="onProviderChange()">
            <option value="" disabled selected>Select provider...</option>
            <option value="local">&#9889; Local LLM (In-Browser)</option>
            <optgroup label="Cloud Providers">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral AI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="together">Together AI</option>
            </optgroup>
            <optgroup label="Self-Hosted">
              <option value="kaggle">Kaggle / Ollama (Free GPU)</option>
            </optgroup>
          </select>
          <!-- API key (hidden for local) -->
          <input type="password" id="chatKey" placeholder="API Key" style="display:none" oninput="onApiKeyInput()">
          <!-- Model dropdown (populated dynamically) -->
          <select id="chatModel" style="display:none;min-width:220px;">
            <option value="">Enter API key to load models...</option>
          </select>
          <span id="modelStatus" style="font-size:11px;color:var(--text3);white-space:nowrap;"></span>
        </div>

        <!-- Kaggle / Ollama URL (shown when kaggle is selected) -->
        <div id="kaggleChatPanel" style="display:none;padding:0 0 8px;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="text" id="chatKaggleUrl" placeholder="Kaggle ngrok URL (e.g. https://xxxx.ngrok-free.app)" style="flex:1;min-width:280px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:13px;" oninput="saveChatSettings()">
            <button class="btn-small" onclick="fetchKaggleChatModels()" id="kaggleFetchBtn">Fetch Models</button>
            <span style="font-size:11px;color:var(--text3);">No API key needed — uses your Kaggle Ollama notebook</span>
          </div>
        </div>

        <!-- Local LLM Controls (shown when local is selected) -->
        <div id="localLlmPanel" style="display:none;padding:0 0 8px;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="localModelSelect" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:13px;min-width:280px;">
              <option value="" disabled selected>Select a model to download...</option>
              <optgroup label="Small (< 1GB — Fast)">
                <option value="SmolLM2-360M-Instruct-q4f16_1-MLC">SmolLM2 360M (350MB)</option>
                <option value="Qwen2.5-0.5B-Instruct-q4f16_1-MLC">Qwen2.5 0.5B (400MB)</option>
                <option value="TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC">TinyLlama 1.1B (600MB)</option>
              </optgroup>
              <optgroup label="Medium (1-2GB — Balanced)">
                <option value="Qwen2.5-1.5B-Instruct-q4f16_1-MLC">Qwen2.5 1.5B (1GB)</option>
                <option value="gemma-2-2b-it-q4f16_1-MLC">Gemma 2 2B (1.3GB)</option>
                <option value="Phi-3.5-mini-instruct-q4f16_1-MLC">Phi 3.5 Mini 3.8B (2GB)</option>
                <option value="Llama-3.2-3B-Instruct-q4f16_1-MLC">Llama 3.2 3B (1.8GB)</option>
              </optgroup>
              <optgroup label="Large (3GB+ — Best Quality)">
                <option value="Mistral-7B-Instruct-v0.3-q4f16_1-MLC">Mistral 7B (4GB)</option>
                <option value="Llama-3.1-8B-Instruct-q4f16_1-MLC">Llama 3.1 8B (4.5GB)</option>
              </optgroup>
            </select>
            <button id="localLoadBtn" onclick="loadLocalModel()" style="background:var(--accent);color:var(--bg);border:none;border-radius:8px;padding:8px 16px;font-weight:600;font-size:13px;">Download & Load</button>
            <button id="localUnloadBtn" onclick="unloadLocalModel()" style="display:none;background:var(--red);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:600;font-size:13px;">Unload</button>
            <button onclick="clearLocalCache()" style="background:var(--surface2);color:var(--text3);border:none;border-radius:8px;padding:8px 16px;font-size:12px;">Clear Cache</button>
          </div>
          <div id="localProgress" style="margin-top:8px;display:none;">
            <div style="background:var(--surface2);border-radius:6px;height:8px;overflow:hidden;">
              <div id="localProgressBar" style="background:var(--accent);height:100%;width:0%;transition:width 0.3s;border-radius:6px;"></div>
            </div>
            <p id="localProgressText" style="font-size:11px;color:var(--text3);margin-top:4px;">Downloading...</p>
          </div>
          <div id="localStatus" style="font-size:12px;margin-top:6px;color:var(--text3);"></div>
        </div>

        <div class="chat-box" id="chatBox">
          <div class="empty-state"><p>Select a provider to get started. For cloud providers, enter your API key and models will auto-load. For Local LLM, pick a model to download and run entirely in your browser.</p></div>
        </div>
        <!-- Live Recording Banner -->
        <div id="voiceRecBanner" style="display:none;padding:12px 16px;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.3);border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:10px;height:10px;background:var(--red);border-radius:50%;animation:pulse 1s infinite;"></span>
              <span style="font-size:13px;font-weight:700;color:var(--red);" id="recTimerText">0:00</span>
            </div>
            <div id="recLevelBars" style="display:flex;align-items:end;gap:2px;height:24px;flex:1;max-width:200px;">
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
              <div class="rlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:4px;"></div>
            </div>
            <div id="recLiveText" style="flex:1;font-size:13px;color:var(--text2);font-style:italic;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;"></div>
            <button onclick="stopVoiceInput()" style="background:var(--red);color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Stop</button>
          </div>
        </div>
        <!-- Voice Engine Settings (collapsible) -->
        <div id="voiceSettingsPanel" style="display:none;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;font-size:12px;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <label style="color:var(--text3);white-space:nowrap;">STT Engine:</label>
            <select id="chatSttEngine" class="form-input" style="padding:4px 8px;font-size:12px;width:auto;min-width:140px;" onchange="onChatSttChange()">
              <option value="recorder">Mic Recorder + Whisper API</option>
              <option value="webspeech">Web Speech API (Chrome only)</option>
              <option value="whisper_wasm">Whisper WASM (Local/Offline)</option>
            </select>
            <input type="password" id="chatWhisperKey" class="form-input" placeholder="OpenAI key for Whisper..." style="padding:4px 8px;font-size:12px;flex:1;min-width:120px;">
            <label style="display:flex;align-items:center;gap:4px;color:var(--text3);white-space:nowrap;cursor:pointer;font-size:12px;" title="Automatically send transcribed text to the LLM">
              <input type="checkbox" id="chatAutoSend" checked style="accent-color:var(--accent);"> Auto-send
            </label>
            <span id="chatVoiceStatus" style="color:var(--text3);">Ready</span>
          </div>
        </div>
        <div class="chat-input">
          <button id="voiceMicBtn" onclick="toggleVoiceInput()" title="Voice input — click gear to change engine" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text2);cursor:pointer;font-size:16px;white-space:nowrap;transition:all 0.2s;">&#127908;</button>
          <button id="voiceSettingsBtn" onclick="toggleVoiceSettings()" title="Voice settings" style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px 8px;color:var(--text3);cursor:pointer;font-size:12px;">&#9881;</button>
          <input type="text" id="chatInput" placeholder="Type a message or use the mic..." onkeydown="if(event.key==='Enter')sendChat()">
          <button id="chatSendBtn" onclick="sendChat()">Send</button>
          <button id="voiceSpeakBtn" onclick="speakLastResponse()" title="Read last response aloud" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text2);cursor:pointer;font-size:16px;white-space:nowrap;">&#128266;</button>
          <button onclick="postToBlockFromPlayground()" title="Post this conversation to Blog" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text2);cursor:pointer;font-size:12px;white-space:nowrap;">&#128221; Blog</button>
        </div>
      </div>
    </div>

    <!-- Audit -->
    <div class="page" id="p-audit" style="display:none">
      <div class="page-header"><h2 class="page-title">Audit Log</h2><p class="page-subtitle">Track all admin actions and system events</p></div>
      <div class="card" id="auditCard"><div class="empty-state"><p>Loading...</p></div></div>
    </div>

    <!-- API Tester -->
    <div class="page" id="p-api" style="display:none">
      <div class="page-header"><h2 class="page-title">API Tester</h2><p class="page-subtitle">Test any endpoint directly from the dashboard</p></div>
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:18px;">
          <h3 style="font-weight:700;margin-bottom:16px;font-size:15px;">Request</h3>
          <div class="api-row">
            <select id="apiMethod"><option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option></select>
            <input type="text" id="apiPath" placeholder="/v1/health" value="/v1/health">
            <button onclick="sendApiReq()">Send</button>
          </div>
          <textarea id="apiBody" placeholder='{ "key": "value" }'></textarea>
        </div>
      </div>
      <div class="card">
        <div style="padding:18px;font-weight:700;font-size:15px;border-bottom:1px solid var(--border);">Response</div>
        <div style="padding:0;">
          <pre id="apiResponse" style="border:none;border-radius:0;margin:0;">Response will appear here</pre>
        </div>
      </div>
    </div>

    <!-- ═══════════ IMAGE STUDIO PAGE ═══════════ -->
    <div class="page" id="p-images" style="display:none">
      <div class="page-header">
        <h2 class="page-title">Image Studio</h2>
        <p class="page-subtitle">Generate, save, and manage AI images</p>
      </div>

      <!-- Generation Panel -->
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:18px;">
          <h3 style="font-weight:700;margin-bottom:16px;font-size:15px;">&#127912; Generate Image</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="form-group" style="flex:1;min-width:180px;">
              <label>Provider</label>
              <select class="form-input" id="imgProvider" onchange="onImgProviderChange()">
                <option value="" disabled selected>Select provider...</option>
                <option value="openai">OpenAI (DALL-E)</option>
                <option value="stability">Stability AI</option>
                <option value="bfl">Black Forest Labs (Flux)</option>
                <option value="replicate">Replicate</option>
                <option value="fal">fal.ai</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;min-width:180px;">
              <label>API Key</label>
              <input type="password" class="form-input" id="imgApiKey" placeholder="Your API key...">
            </div>
            <div class="form-group" style="flex:1;min-width:180px;">
              <label>Model</label>
              <select class="form-input" id="imgModel"></select>
            </div>
          </div>
          <div class="form-group">
            <label>Prompt</label>
            <textarea class="form-input" id="imgPrompt" rows="3" placeholder="Describe the image you want to generate..."></textarea>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="form-group" style="flex:1;min-width:180px;">
              <label>Negative Prompt (optional)</label>
              <input class="form-input" id="imgNegPrompt" placeholder="What to avoid...">
            </div>
            <div class="form-group" style="min-width:100px;">
              <label>Width</label>
              <select class="form-input" id="imgWidth">
                <option value="512">512</option>
                <option value="768">768</option>
                <option value="1024" selected>1024</option>
                <option value="1280">1280</option>
                <option value="1792">1792</option>
              </select>
            </div>
            <div class="form-group" style="min-width:100px;">
              <label>Height</label>
              <select class="form-input" id="imgHeight">
                <option value="512">512</option>
                <option value="768">768</option>
                <option value="1024" selected>1024</option>
                <option value="1280">1280</option>
                <option value="1792">1792</option>
              </select>
            </div>
            <div class="form-group" style="min-width:100px;">
              <label>Steps</label>
              <input type="number" class="form-input" id="imgSteps" min="1" max="150" placeholder="Auto">
            </div>
          </div>
          <button class="btn-primary" id="imgGenBtn" onclick="generateImage()" style="width:100%;padding:12px;">Generate Image</button>
        </div>
      </div>

      <!-- Generation Result -->
      <div id="imgResult" class="card" style="display:none;margin-bottom:20px;">
        <div style="padding:18px;">
          <h3 style="font-weight:700;margin-bottom:12px;">Generated Image</h3>
          <div style="text-align:center;margin-bottom:16px;">
            <img id="imgResultImg" style="max-width:100%;max-height:512px;border-radius:var(--radius);border:1px solid var(--border);">
          </div>
          <div id="imgResultMeta" style="font-size:12px;color:var(--text3);text-align:center;margin-bottom:12px;"></div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button class="btn-primary" onclick="saveToGallery()">Save to Gallery</button>
            <button class="btn-primary" style="background:var(--green);" onclick="useInBlogPost()">Use in Blog Post</button>
            <button class="btn-primary" style="background:var(--purple);" onclick="downloadGenImage()">Download</button>
          </div>
        </div>
      </div>

      <!-- Gallery -->
      <div class="card">
        <div style="padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-weight:700;font-size:15px;">&#128444; My Gallery</h3>
            <button class="btn-small" onclick="loadImageGallery()">Refresh</button>
          </div>
          <div id="imgGallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
            <p style="color:var(--text3);grid-column:1/-1;text-align:center;padding:30px;">Generate your first image above to build your gallery.</p>
          </div>
          <div id="imgGalleryPagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px;"></div>
        </div>
      </div>
    </div>

    <!-- ═══════════ BLOG PAGE ═══════════ -->
    <div class="page" id="p-blog" style="display:none">
      <div class="page-header" style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="flex:1;">
          <h2 class="page-title">Blog</h2>
          <p class="page-subtitle">Read, write, and interact with the community</p>
        </div>
        <button class="btn-primary" style="width:auto;padding:10px 20px;font-size:13px;" onclick="showBlogEditor()" id="blogWriteBtn">+ Write Post</button>
      </div>

      <!-- Blog Editor (hidden by default) -->
      <div id="blogEditor" class="card" style="display:none;margin-bottom:24px;">
        <div style="padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-weight:700;font-size:15px;">&#9998; New Blog Post</h3>
            <button onclick="hideBlogEditor()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">&times;</button>
          </div>
          <div class="form-group"><label>Title</label><input class="form-input" id="blogTitle" placeholder="Give your post a title..."></div>
          <div class="form-group"><label>Content</label><textarea class="form-input" id="blogContent" rows="8" placeholder="Write your post content here... Markdown supported."></textarea></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div class="form-group" style="flex:1;min-width:150px;"><label>Tags</label><input class="form-input" id="blogTags" placeholder="ai, art, tech"></div>
            <div class="form-group" style="flex:1;min-width:150px;"><label>Category</label>
              <select class="form-input" id="blogCategory"><option value="general">General</option><option value="ai">AI / Tech</option><option value="art">Art / Creative</option><option value="tutorial">Tutorial</option><option value="discussion">Discussion</option></select>
            </div>
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Image</label>
              <div style="display:flex;gap:6px;">
                <input class="form-input" id="blogImage" placeholder="https://..." oninput="previewBlogImage()" style="flex:1;">
                <button class="btn-small" onclick="openBlogImageGallery()" title="Pick from Gallery" style="white-space:nowrap;">Gallery</button>
                <button class="btn-small" onclick="openBlogImageGen()" title="Generate with AI" style="white-space:nowrap;background:var(--accent-glow);color:var(--accent);">AI Gen</button>
              </div>
              <div id="blogImagePreview" style="display:none;margin-top:8px;"><img id="blogImagePreviewImg" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--border);"></div>
            </div>
          </div>

          <!-- Inline Image Generator (hidden by default) -->
          <div id="blogInlineGen" style="display:none;margin-bottom:12px;padding:12px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:600;font-size:13px;color:var(--accent);">Generate Image with AI</span>
              <button onclick="closeBlogInlineGen()" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;">&times;</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              <select class="form-input" id="blogGenProvider" style="flex:1;min-width:140px;font-size:12px;">
                <option value="openai">OpenAI (DALL-E)</option>
                <option value="stability">Stability AI</option>
                <option value="bfl">BFL (Flux)</option>
                <option value="replicate">Replicate</option>
                <option value="fal">fal.ai</option>
              </select>
              <input type="password" class="form-input" id="blogGenKey" placeholder="API Key" style="flex:1;min-width:140px;font-size:12px;">
            </div>
            <div style="display:flex;gap:8px;">
              <input class="form-input" id="blogGenPrompt" placeholder="Describe the image..." style="flex:1;font-size:12px;">
              <button class="btn-primary" id="blogGenBtn" onclick="generateBlogImage()" style="font-size:12px;padding:8px 16px;white-space:nowrap;">Generate</button>
            </div>
          </div>

          <!-- Gallery Picker (hidden by default) -->
          <div id="blogGalleryPicker" style="display:none;margin-bottom:12px;padding:12px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:600;font-size:13px;color:var(--accent);">Pick from Gallery</span>
              <button onclick="closeBlogGalleryPicker()" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;">&times;</button>
            </div>
            <div id="blogGalleryGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;max-height:200px;overflow-y:auto;"></div>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn-modal-cancel" onclick="hideBlogEditor()">Cancel</button>
            <button class="btn-primary" onclick="publishBlogPost()">Publish</button>
          </div>
        </div>
      </div>

      <!-- Blog Feed Controls -->
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <input type="text" class="form-input" id="blogSearch" placeholder="Search posts..." style="flex:1;min-width:200px;" oninput="loadBlogFeed()">
        <select class="form-input" id="blogSort" style="width:150px;" onchange="loadBlogFeed()">
          <option value="newest">Newest</option><option value="popular">Most Liked</option><option value="trending">Trending</option>
        </select>
      </div>

      <!-- Blog Feed -->
      <div id="blogFeed" style="display:flex;flex-direction:column;gap:16px;">
        <p style="color:var(--text3);text-align:center;padding:40px;">Loading blog posts...</p>
      </div>
      <div id="blogPagination" style="display:flex;justify-content:center;gap:8px;margin-top:20px;"></div>

      <!-- Blog Post Detail (hidden) -->
      <div id="blogDetail" style="display:none;">
        <button onclick="closeBlogDetail()" style="background:none;border:none;color:var(--accent);cursor:pointer;margin-bottom:16px;font-size:14px;">&larr; Back to Feed</button>
        <div id="blogDetailContent"></div>
        <div id="blogComments" style="margin-top:24px;"></div>
      </div>
    </div>

    <!-- ═══════════ VOICE LAB PAGE ═══════════ -->
    <div class="page" id="p-voice" style="display:none">
      <div class="page-header">
        <h2 class="page-title">Voice Lab</h2>
        <p class="page-subtitle">Speech-to-text, text-to-speech, and translation</p>
      </div>

      <!-- STT + Translation Section -->
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:18px;">
          <h3 style="font-weight:700;margin-bottom:16px;font-size:15px;">&#127760; Translation</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>LLM Provider</label>
              <select class="form-input" id="voiceTransProvider" onchange="onTransProviderChange()">
                <option value="local_llm">Local LLM (WebLLM — Offline)</option>
                <option value="kaggle">Kaggle / Ollama (Free GPU)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google Gemini</option>
                <option value="groq">Groq</option>
                <option value="mistral">Mistral AI</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div class="form-group" id="voiceTransKeyGroup" style="flex:1;min-width:150px;display:none;">
              <label>API Key</label>
              <input type="password" class="form-input" id="voiceTransKey" placeholder="API key for translation...">
            </div>
            <div id="kaggleTransPanel" style="flex:1;min-width:200px;display:none;">
              <label style="font-size:11px;color:var(--text3);">Kaggle ngrok URL</label>
              <input type="text" class="form-input" id="voiceKaggleUrl" placeholder="https://xxxx.ngrok-free.app" oninput="saveVoiceSettings()">
            </div>
            <div id="localLlmTransHint" style="flex:1;min-width:150px;display:flex;align-items:center;">
              <span id="localLlmTransStatus" style="font-size:12px;color:var(--text3);">Load a local model in AI Chat first, then translate here for free.</span>
            </div>
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Source Language</label>
              <select class="form-input" id="voiceTransSrc">
                <option value="">Auto-detect</option>
                <option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option>
                <option value="German">German</option><option value="Italian">Italian</option><option value="Portuguese">Portuguese</option>
                <option value="Russian">Russian</option><option value="Chinese">Chinese</option><option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option><option value="Arabic">Arabic</option><option value="Hindi">Hindi</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Target Language</label>
              <select class="form-input" id="voiceTransTgt">
                <option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option>
                <option value="German">German</option><option value="Italian">Italian</option><option value="Portuguese">Portuguese</option>
                <option value="Russian">Russian</option><option value="Chinese">Chinese</option><option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option><option value="Arabic">Arabic</option><option value="Hindi">Hindi</option>
              </select>
            </div>
          </div>

          <!-- Input modes: Text or Voice -->
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button class="btn-small" id="transTextModeBtn" onclick="setTransMode('text')" style="background:var(--accent-glow);color:var(--accent);">Text Input</button>
            <button class="btn-small" id="transVoiceModeBtn" onclick="setTransMode('voice')">Voice Input</button>
          </div>

          <div id="transTextInput">
            <textarea class="form-input" id="voiceTransInput" rows="4" placeholder="Enter text to translate..."></textarea>
          </div>
          <div id="transVoiceInput" style="display:none;">
            <div style="display:flex;gap:12px;align-items:center;padding:16px;background:var(--surface2);border-radius:var(--radius);margin-bottom:8px;">
              <button id="transRecBtn" onclick="toggleTransRecording()" style="width:56px;height:56px;border-radius:50%;border:2px solid var(--accent);background:var(--surface);color:var(--accent);font-size:24px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">&#127908;</button>
              <div style="flex:1;">
                <div id="transRecStatus" style="font-size:13px;font-weight:600;color:var(--text);">Click mic to start recording</div>
                <div id="transRecLang" style="font-size:11px;color:var(--text3);margin-top:2px;">Uses Web Speech API</div>
              </div>
              <select class="form-input" id="transSttEngine" style="width:160px;font-size:12px;">
                <option value="web">Web Speech API</option>
                <option value="whisper_wasm">Whisper WASM (Local)</option>
                <option value="whisper">Whisper Cloud API</option>
              </select>
            </div>
            <!-- Voice Lab Live Recording Banner -->
            <div id="transRecBanner" style="display:none;padding:10px 14px;margin-bottom:8px;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="display:flex;align-items:center;gap:5px;">
                  <span style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulse 1s infinite;"></span>
                  <span style="font-size:12px;font-weight:700;color:var(--red);" id="transRecTimer">0:00</span>
                </div>
                <div id="transLevelBars" style="display:flex;align-items:end;gap:2px;height:20px;flex:0 0 100px;">
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                  <div class="tlb" style="width:3px;background:var(--red);border-radius:2px;transition:height 0.05s;height:3px;"></div>
                </div>
                <div id="transRecLiveText" style="flex:1;font-size:12px;color:var(--text2);font-style:italic;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;">Speak now...</div>
              </div>
            </div>
            <textarea class="form-input" id="voiceTransInput2" rows="3" placeholder="Transcribed text will appear here..." readonly></textarea>
          </div>

          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn-primary" id="translateBtn" onclick="doTranslate()" style="flex:1;">Translate</button>
            <button class="btn-small" onclick="detectLang()" style="white-space:nowrap;">Detect Language</button>
          </div>

          <!-- Result -->
          <div id="transResult" style="display:none;margin-top:16px;padding:16px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:600;font-size:13px;color:var(--accent);">Translation Result</span>
              <div style="display:flex;gap:6px;">
                <button class="btn-small" onclick="speakTransResult()" title="Read aloud">&#128266; Speak</button>
                <button class="btn-small" onclick="copyTransResult()" title="Copy">&#128203; Copy</button>
              </div>
            </div>
            <div id="transResultText" style="font-size:14px;line-height:1.6;color:var(--text);white-space:pre-wrap;"></div>
            <div id="transResultMeta" style="font-size:11px;color:var(--text3);margin-top:8px;"></div>
          </div>
        </div>
      </div>

      <!-- TTS Demo Section -->
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:18px;">
          <h3 style="font-weight:700;margin-bottom:16px;font-size:15px;">&#128266; Text-to-Speech</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Engine</label>
              <select class="form-input" id="ttsEngine" onchange="onTtsEngineChange()">
                <option value="web">Web Speech (Free)</option>
                <option value="elevenlabs">ElevenLabs (Cloud)</option>
              </select>
            </div>
            <div class="form-group" id="ttsKeyGroup" style="flex:1;min-width:150px;display:none;">
              <label>ElevenLabs API Key</label>
              <input type="password" class="form-input" id="ttsElevenKey" placeholder="ElevenLabs key...">
            </div>
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Voice</label>
              <select class="form-input" id="ttsVoice"></select>
            </div>
          </div>
          <textarea class="form-input" id="ttsText" rows="3" placeholder="Enter text to speak aloud..."></textarea>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn-primary" onclick="speakTtsDemo()">Speak</button>
            <button class="btn-small" onclick="stopTts()">Stop</button>
          </div>
        </div>
      </div>

      <!-- Whisper WASM Section -->
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:18px;">
          <h3 style="font-weight:700;margin-bottom:16px;font-size:15px;">&#127908; Local Whisper STT (In-Browser)</h3>
          <p style="font-size:12px;color:var(--text3);margin-bottom:12px;">Run OpenAI Whisper entirely in your browser using WebAssembly. No API key needed. Models are downloaded once and cached.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="form-group" style="flex:1;min-width:200px;">
              <label>Model</label>
              <select class="form-input" id="whisperModel">
                <option value="onnx-community/whisper-tiny" selected>Whisper Tiny (~40MB, fast)</option>
                <option value="onnx-community/whisper-base">Whisper Base (~150MB, balanced)</option>
                <option value="onnx-community/whisper-small">Whisper Small (~460MB, best)</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Task</label>
              <select class="form-input" id="whisperTask">
                <option value="transcribe">Transcribe</option>
                <option value="translate">Translate to English</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn-primary" id="whisperLoadBtn" onclick="loadWhisperWasm()">Download & Load Model</button>
            <button class="btn-small" id="whisperRecBtn" onclick="toggleWhisperRec()" style="display:none;">&#127908; Record</button>
            <span id="whisperStatus" style="font-size:12px;color:var(--text3);"></span>
          </div>
          <div id="whisperProgress" style="display:none;margin-top:8px;">
            <div style="background:var(--surface2);border-radius:6px;height:8px;overflow:hidden;">
              <div id="whisperProgressBar" style="background:var(--accent);height:100%;width:0%;transition:width 0.3s;border-radius:6px;"></div>
            </div>
            <p id="whisperProgressText" style="font-size:11px;color:var(--text3);margin-top:4px;">Loading model...</p>
          </div>
          <div id="whisperResult" style="display:none;margin-top:12px;padding:12px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);">
            <div style="font-weight:600;font-size:12px;color:var(--accent);margin-bottom:4px;">Whisper Output</div>
            <div id="whisperResultText" style="font-size:14px;color:var(--text);white-space:pre-wrap;"></div>
          </div>
        </div>
      </div>

      <!-- Translation History -->
      <div class="card">
        <div style="padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-weight:700;font-size:15px;">&#128221; Translation History</h3>
            <button class="btn-small" onclick="loadTranslationHistory()">Refresh</button>
          </div>
          <div id="transHistory">
            <p style="color:var(--text3);text-align:center;padding:20px;">No translations yet.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ SYSTEM PROMPTS PAGE ═══════════ -->
    <div class="page" id="p-prompts" style="display:none">
      <div class="page-header">
        <h2 class="page-title">System Prompts</h2>
        <p class="page-subtitle">Configure prompts used by translation, safety, and injection detection</p>
      </div>
      <div class="card">
        <div id="promptsList" style="padding:18px;">
          <p style="color:var(--text3);text-align:center;padding:40px;">Loading prompts...</p>
        </div>
      </div>
    </div>

    <!-- ═══════════ P2P CHAT PAGE ═══════════ -->
    <div class="page" id="p-p2p" style="display:none">
      <div class="page-header">
        <h2 class="page-title">P2P Chat</h2>
        <p class="page-subtitle">Real humans only. AI-powered messaging.</p>
      </div>

      <div id="p2pLayout" style="display:flex;gap:16px;height:calc(100vh - 200px);min-height:500px;">
        <!-- Conversations sidebar -->
        <div id="p2pConvoPane" class="card" style="width:300px;min-width:300px;display:flex;flex-direction:column;overflow:hidden;">
          <div style="padding:14px;border-bottom:1px solid var(--border);">
            <button class="btn-primary" style="width:100%;font-size:13px;padding:10px;" onclick="showNewChatModal()">+ New Conversation</button>
          </div>
          <div style="padding:10px;border-bottom:1px solid var(--border);">
            <input type="text" class="form-input" id="convoSearch" placeholder="Search conversations..." style="font-size:13px;padding:9px 12px;" oninput="filterConversations()">
          </div>
          <div id="convoList" style="flex:1;overflow-y:auto;padding:4px;"></div>
        </div>

        <!-- Chat window -->
        <div class="card" style="flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;">
          <div id="chatHeader" style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
            <div style="position:relative;">
              <div id="chatHeaderAvatar" style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;">?</div>
              <span id="chatHeaderDot" class="status-dot offline" style="position:absolute;bottom:-1px;right:-1px;"></span>
            </div>
            <div style="flex:1;min-width:0;">
              <div id="chatHeaderName" style="font-weight:700;font-size:14px;">Select a conversation</div>
              <div id="chatHeaderStatus" style="font-size:11px;color:var(--text3);">Pick someone to chat with</div>
            </div>
            <div style="display:flex;gap:6px;" id="chatHeaderActions">
              <button onclick="startP2PCall(false)" title="Voice Call" style="background:none;border:1px solid var(--border);border-radius:8px;padding:7px 11px;color:var(--green);cursor:pointer;font-size:16px;">&#128222;</button>
              <button onclick="startP2PCall(true)" title="Video Call" style="background:none;border:1px solid var(--border);border-radius:8px;padding:7px 11px;color:var(--accent);cursor:pointer;font-size:16px;">&#127909;</button>
              <button class="btn-icon" onclick="toggleAiPanel()" title="AI Tools" style="font-size:18px;">&#129302;</button>
            </div>
          </div>

          <!-- AI Tools Panel (hidden) -->
          <div id="aiToolsPanel" style="display:none;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--bg2);">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn-small" onclick="aiToneCheck()" title="Check tone of your message">Tone Check</button>
              <button class="btn-small" onclick="aiScheduleDetect()" title="Detect scheduling in messages">Schedule Detect</button>
            </div>
            <div id="aiToolResult" style="margin-top:8px;font-size:12px;color:var(--text2);display:none;padding:8px;background:var(--surface);border-radius:6px;"></div>
          </div>

          <!-- Active Call Overlay -->
          <div id="p2pCallOverlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:50;background:linear-gradient(180deg,#0f0f23 0%,#1a1a3e 100%);border-radius:inherit;flex-direction:column;align-items:center;justify-content:center;gap:0;">
            <!-- Caller info -->
            <div id="callAvatarBig" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;margin-bottom:12px;border:3px solid rgba(255,255,255,0.2);">?</div>
            <div id="p2pCallName" style="color:#fff;font-size:18px;font-weight:700;margin-bottom:4px;"></div>
            <div id="p2pCallStatus" style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:20px;">Calling...</div>
            <!-- Video containers -->
            <div style="position:relative;width:100%;flex:1;max-height:50%;">
              <video id="p2pRemoteVideo" autoplay playsinline style="width:100%;height:100%;background:transparent;border-radius:12px;object-fit:cover;display:none;"></video>
              <video id="p2pLocalVideo" autoplay playsinline muted style="width:100px;height:75px;background:#222;border-radius:8px;object-fit:cover;position:absolute;bottom:10px;right:10px;display:none;border:2px solid var(--accent);z-index:2;"></video>
            </div>
            <!-- Timer -->
            <div id="p2pCallTimer" style="color:rgba(255,255,255,0.7);font-size:22px;font-weight:600;letter-spacing:1px;margin:12px 0;display:none;font-variant-numeric:tabular-nums;">0:00</div>
            <!-- Controls -->
            <div style="display:flex;gap:16px;padding:16px;">
              <button id="p2pMuteBtn" onclick="toggleP2PMute()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:54px;height:54px;font-size:22px;cursor:pointer;color:#fff;transition:all 0.2s;" title="Mute">&#128264;</button>
              <button onclick="endP2PCall()" style="background:#ef4444;border:none;border-radius:50%;width:54px;height:54px;cursor:pointer;color:#fff;transition:all 0.2s;display:flex;align-items:center;justify-content:center;" title="End Call"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg></button>
            </div>
          </div>

          <!-- Incoming Call Overlay -->
          <div id="p2pIncomingCallOverlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:60;background:linear-gradient(180deg,#0f0f23 0%,#1a1a3e 100%);border-radius:inherit;flex-direction:column;align-items:center;justify-content:center;gap:0;">
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;border-radius:inherit;">
              <div id="incomingCallRipple1" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:120px;height:120px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);animation:callRipple 2s ease-out infinite;"></div>
              <div id="incomingCallRipple2" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:120px;height:120px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);animation:callRipple 2s ease-out 0.5s infinite;"></div>
              <div id="incomingCallRipple3" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:120px;height:120px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);animation:callRipple 2s ease-out 1s infinite;"></div>
            </div>
            <div id="incomingCallAvatar" style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;color:#fff;margin-bottom:16px;border:3px solid rgba(255,255,255,0.2);z-index:1;animation:callPulse 1.5s ease-in-out infinite;">?</div>
            <div id="incomingCallName" style="color:#fff;font-size:20px;font-weight:700;margin-bottom:4px;z-index:1;"></div>
            <div id="incomingCallType" style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:8px;z-index:1;">Incoming voice call...</div>
            <div id="incomingCallRingTimer" style="color:rgba(255,255,255,0.4);font-size:12px;margin-bottom:30px;z-index:1;"></div>
            <!-- Accept / Decline buttons -->
            <div style="display:flex;gap:40px;z-index:1;">
              <div style="text-align:center;">
                <button onclick="declineP2PCall()" style="background:#ef4444;border:none;border-radius:50%;width:64px;height:64px;cursor:pointer;color:#fff;transition:all 0.2s;box-shadow:0 4px 20px rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg></button>
                <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:8px;">Decline</div>
              </div>
              <div style="text-align:center;">
                <button onclick="acceptP2PCall()" style="background:#22c55e;border:none;border-radius:50%;width:64px;height:64px;font-size:24px;cursor:pointer;color:#fff;transition:all 0.2s;box-shadow:0 4px 20px rgba(34,197,94,0.4);">&#128222;</button>
                <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:8px;">Accept</div>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div id="p2pMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;scroll-behavior:smooth;">
            <div style="text-align:center;color:var(--text3);font-size:13px;padding:60px 20px;">
              <p style="font-size:48px;margin-bottom:16px;opacity:0.8;">&#128172;</p>
              <p style="font-size:15px;font-weight:600;color:var(--text2);margin-bottom:4px;">Select a conversation</p>
              <p style="font-size:12px;">or start a new one from the sidebar</p>
            </div>
          </div>

          <!-- Message input -->
          <div style="padding:14px 18px;border-top:1px solid var(--border);background:var(--surface);">
            <div style="display:flex;gap:8px;align-items:flex-end;">
              <div style="flex:1;position:relative;">
                <textarea id="p2pInput" rows="1" placeholder="Type a message..." style="width:100%;box-sizing:border-box;resize:none;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px 14px;color:var(--text);font-size:14px;font-family:inherit;max-height:120px;line-height:1.5;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendP2PMessage();}"></textarea>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-end;">
                <button onclick="p2pShareImage()" title="Share image" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text3);cursor:pointer;font-size:16px;">&#128247;</button>
                <button onclick="toggleP2PMic()" id="p2pMicBtn" title="Voice input" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text3);cursor:pointer;font-size:16px;">&#127908;</button>
                <button class="btn-primary" onclick="sendP2PMessage()" id="p2pSendBtn" style="padding:8px 18px;font-size:13px;border-radius:8px;white-space:nowrap;height:38px;">Send</button>
              </div>
            </div>
            <!-- P2P Image preview -->
            <div id="p2pImagePreview" style="display:none;margin-top:8px;padding:8px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:8px;">
                <img id="p2pImageThumb" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" src="">
                <div style="flex:1;font-size:12px;color:var(--text2);" id="p2pImageName">image.png</div>
                <button onclick="clearP2PImage()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&#10005;</button>
              </div>
            </div>
            <input type="file" id="p2pImageFile" accept="image/*" style="display:none;" onchange="onP2PImageSelected(event)">
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ AI AGENTS CALL CENTER PAGE ═══════ -->
    <div class="page" id="p-agents" style="display:none">
      <style>
        .agents-page { max-width:100%; overflow:hidden; box-sizing:border-box; }
        .agent-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px; }
        .agent-card { border-radius:14px; padding:16px; position:relative; overflow:hidden; transition:transform 0.25s ease, box-shadow 0.25s ease; border:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:8px; cursor:pointer; }
        .agent-card::before { content:''; position:absolute; top:0; left:0; right:0; bottom:0; background:linear-gradient(180deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0) 100%); pointer-events:none; border-radius:14px; }
        .agent-card:hover { transform:translateY(-3px); box-shadow:0 16px 40px rgba(0,0,0,0.4); }
        .agent-card .agent-avatar { width:42px; height:42px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:20px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.15); margin-bottom:2px; }
        .agent-card h3 { color:#fff; font-size:15px; font-weight:700; margin:0; line-height:1.2; }
        .agent-card .agent-specialty { color:rgba(255,255,255,0.6); font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-top:1px; }
        .agent-card .agent-desc { color:rgba(255,255,255,0.5); font-size:11px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; flex:1; }
        .agent-card-footer { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:auto; }
        .agent-card .agent-voice { color:rgba(255,255,255,0.3); font-size:9px; }
        .agent-call-btn { background:rgba(255,255,255,0.15); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.25); color:#fff; padding:6px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
        .agent-call-btn:hover { background:rgba(255,255,255,0.25); transform:scale(1.03); }
        .agent-call-btn svg { width:14px; height:14px; }
        .agent-settings-toggle { background:var(--surface); border:1px solid var(--border); color:var(--text2); padding:7px 14px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; }
        .agent-settings-toggle:hover { border-color:var(--accent); color:var(--text); }
        .agent-config { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:20px; animation:slideDown 0.2s ease; }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .agent-config-row { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; }
        .agent-config-row .field label { display:block; font-size:10px; color:var(--text3); margin-bottom:3px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
        .agent-config-row .field input, .agent-config-row .field select { width:100%; padding:7px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text); font-size:12px; box-sizing:border-box; }
        .agent-config-row .field input:focus, .agent-config-row .field select:focus { border-color:var(--accent); outline:none; box-shadow:0 0 0 2px var(--accent-glow); }
        .agent-history-section { margin-top:8px; }
        .agent-history-section h3 { font-size:14px; font-weight:600; color:var(--text); margin-bottom:10px; }
        .call-history-item { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:10px; background:var(--surface); border:1px solid var(--border); margin-bottom:6px; transition:all 0.15s; }
        .call-history-item:hover { background:var(--surface2); border-color:var(--accent); }
        .call-history-avatar { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; background:var(--bg); flex-shrink:0; }
        .call-history-info { flex:1; min-width:0; }
        .call-history-name { font-size:13px; font-weight:600; color:var(--text); }
        .call-history-meta { font-size:10px; color:var(--text3); margin-top:1px; }
        .call-history-badge { font-size:9px; padding:2px 7px; border-radius:8px; font-weight:600; }
        .call-history-badge.ended { background:rgba(34,197,94,0.12); color:#22c55e; }
        .call-history-badge.escalated { background:rgba(239,68,68,0.12); color:#ef4444; }
        .admin-calls-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-top:16px; }
        .admin-call-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; border:1px solid var(--border); margin-bottom:5px; }
        .admin-call-row .live-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; animation:livePulse 1.5s infinite; flex-shrink:0; }
        @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        #agentCallOverlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:9500; background:linear-gradient(180deg,#0f0f23 0%,#1a1a3e 50%,#0f0f23 100%); flex-direction:column; }
        .call-header { text-align:center; padding:28px 20px 12px; }
        .call-avatar-ring { width:88px; height:88px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:38px; margin:0 auto 14px; border:3px solid rgba(255,255,255,0.15); position:relative; }
        .call-avatar-ring.speaking { animation:callSpeakPulse 1.2s ease-in-out infinite; }
        @keyframes callSpeakPulse { 0%,100% { box-shadow:0 0 0 0 rgba(99,102,241,0.4); } 50% { box-shadow:0 0 0 18px rgba(99,102,241,0); } }
        .call-agent-name { color:#fff; font-size:20px; font-weight:700; margin-bottom:2px; }
        .call-agent-specialty { color:rgba(255,255,255,0.45); font-size:12px; margin-bottom:4px; }
        .call-status { color:var(--accent); font-size:13px; font-weight:600; }
        .call-timer { color:rgba(255,255,255,0.5); font-size:26px; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:1px; }
        .call-transcript { flex:1; overflow-y:auto; padding:10px 20px; scroll-behavior:smooth; }
        .call-transcript::-webkit-scrollbar { width:3px; }
        .call-transcript::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
        .call-msg { display:flex; margin-bottom:8px; animation:msgIn 0.2s ease; }
        @keyframes msgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .call-msg.user { justify-content:flex-end; }
        .call-msg.agent { justify-content:flex-start; }
        .call-msg .call-bubble { max-width:80%; padding:9px 13px; border-radius:12px; font-size:13px; line-height:1.5; }
        .call-msg.user .call-bubble { background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; border-bottom-right-radius:3px; }
        .call-msg.agent .call-bubble { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.9); border-bottom-left-radius:3px; }
        .call-msg.system .call-bubble { background:rgba(239,68,68,0.12); color:rgba(255,255,255,0.65); border-radius:8px; font-size:11px; text-align:center; max-width:100%; }
        .call-msg .call-time { font-size:9px; color:rgba(255,255,255,0.25); margin-top:3px; }
        .call-waveform { display:flex; align-items:center; justify-content:center; gap:2px; height:28px; padding:6px 20px; }
        .call-waveform .wbar { width:3px; border-radius:2px; background:var(--accent); transition:height 0.05s; height:4px; }
        .call-controls { display:flex; align-items:center; justify-content:center; gap:16px; padding:16px 20px; padding-bottom:max(16px,env(safe-area-inset-bottom)); }
        .call-ctrl-btn { width:52px; height:52px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; color:#fff; }
        .call-ctrl-btn.mute { background:rgba(255,255,255,0.1); }
        .call-ctrl-btn.mute.active { background:#ef4444; }
        .call-ctrl-btn.speaker { background:rgba(255,255,255,0.1); }
        .call-ctrl-btn.escalate { background:rgba(245,158,11,0.25); border:1px solid rgba(245,158,11,0.4); }
        .call-ctrl-btn.escalate:hover { background:rgba(245,158,11,0.45); }
        .call-ctrl-btn.end-call { background:#ef4444; width:60px; height:60px; }
        .call-ctrl-btn.end-call:hover { background:#dc2626; transform:scale(1.06); }
        .call-ctrl-btn svg { width:22px; height:22px; }
      </style>
      <div class="agents-page">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700;margin:0;letter-spacing:-0.3px;">AI Agent Call Center</h2>
            <p style="font-size:12px;color:var(--text3);margin:2px 0 0;">Select an agent to start a voice call</p>
          </div>
          <button class="agent-settings-toggle" onclick="toggleAgentSettings()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Settings
          </button>
        </div>
        <div class="agent-config" id="agentConfigPanel" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:600;color:var(--text);">Provider &amp; Voice Configuration</span>
            <button onclick="toggleAgentSettings()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;">&times;</button>
          </div>
          <div class="agent-config-row">
            <div class="field"><label>AI Provider</label><select id="agentLLMProvider" onchange="updateAgentModelList()"><option value="kaggle">Kaggle / Ollama (Free GPU)</option><option value="groq">Groq (Fast)</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="deepseek">DeepSeek</option><option value="mistral">Mistral</option><option value="openrouter">OpenRouter</option><option value="together">Together AI</option></select></div>
            <div class="field" id="agentKeyField"><label>API Key</label><input type="password" id="agentLLMKey" placeholder="Enter your API key"></div>
            <div class="field" id="agentKaggleUrlField" style="display:none;"><label>Kaggle URL (ngrok)</label><input type="text" id="agentKaggleUrl" placeholder="https://abc123.ngrok-free.app"></div>
            <div class="field"><label>Model (optional)</label><input type="text" id="agentLLMModel" placeholder="Default model"></div>
            <div class="field"><label>ElevenLabs Key (voice)</label><input type="password" id="agentElevenLabsKey" placeholder="Optional — enables voice"></div>
          </div>
          <div id="agentKaggleHelp" style="display:none;margin-top:8px;padding:8px 12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px;"><p style="font-size:11px;color:var(--text);margin:0 0 4px;font-weight:600;">Kaggle Setup (free GPU):</p><ol style="font-size:10px;color:var(--text2);margin:0;padding-left:16px;line-height:1.7;"><li>Create a Kaggle notebook with <strong>GPU + Internet</strong> enabled</li><li>Paste the <code>kaggle_ollama_setup.py</code> script and run it</li><li>Copy the <strong>ngrok URL</strong> and paste it above</li></ol></div>
          <p id="agentNonKaggleHelp" style="font-size:10px;color:var(--text3);margin:6px 0 0;">Without ElevenLabs, agents respond in text only. Web Speech handles voice input.</p>
        </div>
        <div class="agent-grid" id="agentGrid"></div>
        <div class="agent-history-section" id="agentCallHistory"><h3>Recent Calls</h3><div id="agentHistoryList"></div></div>
        <div id="agentAdminPanel" style="display:none;"><div class="admin-calls-panel"><h3 style="font-size:14px;font-weight:600;margin-bottom:10px;">Active Calls (Admin)</h3><div id="adminActiveCallsList"><p style="color:var(--text3);font-size:12px;">No active calls.</p></div></div></div>
      </div>
    </div>

    <!-- Call Logs Page -->
    <div class="page" id="p-calllogs" style="display:none">
      <div class="page-header">
        <h2 class="page-title">Call Logs</h2>
        <p class="page-subtitle">Full history of all agent calls — browser and phone</p>
      </div>

      <!-- Filters Bar -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn-small calllog-filter active" data-filter="all" onclick="filterCallLogs('all')">All Calls</button>
        <button class="btn-small calllog-filter" data-filter="browser" onclick="filterCallLogs('browser')">Browser</button>
        <button class="btn-small calllog-filter" data-filter="phone" onclick="filterCallLogs('phone')">Phone</button>
        <button class="btn-small calllog-filter" data-filter="escalated" onclick="filterCallLogs('escalated')">Escalated</button>
        <button class="btn-small calllog-filter" data-filter="active" onclick="filterCallLogs('active')">Active Now</button>
        <div style="flex:1;"></div>
        <input type="text" class="form-input" id="callLogSearch" placeholder="Search calls..." oninput="filterCallLogs()" style="max-width:220px;font-size:12px;padding:6px 12px;">
        <button class="btn-small" onclick="loadCallLogs()" title="Refresh">&#x21bb; Refresh</button>
      </div>

      <!-- Stats Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="padding:14px;text-align:center;">
          <div id="clStatTotal" style="font-size:22px;font-weight:700;color:var(--accent);">0</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Total Calls</div>
        </div>
        <div class="card" style="padding:14px;text-align:center;">
          <div id="clStatPhone" style="font-size:22px;font-weight:700;color:#8b5cf6;">0</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Phone Calls</div>
        </div>
        <div class="card" style="padding:14px;text-align:center;">
          <div id="clStatBrowser" style="font-size:22px;font-weight:700;color:#3b82f6;">0</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Browser Calls</div>
        </div>
        <div class="card" style="padding:14px;text-align:center;">
          <div id="clStatEscalated" style="font-size:22px;font-weight:700;color:#ef4444;">0</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Escalated</div>
        </div>
        <div class="card" style="padding:14px;text-align:center;">
          <div id="clStatActive" style="font-size:22px;font-weight:700;color:#22c55e;">0</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Active Now</div>
        </div>
      </div>

      <!-- Call List -->
      <div class="card" style="overflow:hidden;">
        <div id="callLogsList" style="padding:12px;"></div>
      </div>

      <!-- Transcript Detail Modal -->
      <div id="callDetailOverlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9000;background:rgba(0,0,0,0.6);overflow-y:auto;padding:30px;">
        <div style="max-width:700px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <div id="callDetailHeader" style="padding:20px 24px;border-bottom:1px solid var(--border);background:var(--bg);"></div>
          <!-- Summary -->
          <div id="callDetailSummary" style="padding:16px 24px;border-bottom:1px solid var(--border);"></div>
          <!-- Transcript -->
          <div style="padding:16px 24px;">
            <h4 style="font-size:13px;font-weight:700;margin:0 0 12px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">Transcript</h4>
            <div id="callDetailTranscript" style="max-height:400px;overflow-y:auto;"></div>
          </div>
          <!-- Supervisor Notes -->
          <div id="callDetailSupervisor" style="display:none;padding:16px 24px;border-top:1px solid var(--border);"></div>
          <!-- Close -->
          <div style="padding:16px 24px;border-top:1px solid var(--border);text-align:center;">
            <button class="btn-primary" onclick="document.getElementById('callDetailOverlay').style.display='none'" style="padding:10px 40px;">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- BLUEPRINT PAGE                                             -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="page" id="p-blueprint" style="display:none">
      <div class="page-header">
        <h2 class="page-title">Blueprint &amp; Growth Roadmap</h2>
        <p class="page-subtitle">Your AI-Powered Social Universe — strategy, milestones, and the path to scale</p>
      </div>

      <!-- Section A: Hero / Vision -->
      <div class="bp-hero">
        <div class="bp-hero-badge">CIRCLE FOR LIFE</div>
        <h3 class="bp-hero-tagline">Your AI-Powered Social Universe</h3>
        <p class="bp-hero-pitch">Circle for Life combines social networking, AI tools, and gamification into one platform. Chat with AI, generate images, make voice translations, call AI agents — all while earning gems and leveling up.</p>
        <div class="bp-hero-actions">
          <button class="btn-primary" onclick="navigator.clipboard.writeText(window.location.origin).then(()=>showToast('Link copied!'))">Copy Share Link</button>
          <button class="btn-small" onclick="window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent('Check out Circle for Life — the AI-powered social platform! '+window.location.origin),'_blank')">Share on X</button>
        </div>
      </div>

      <!-- Section B: Growth Strategy Cards -->
      <h3 class="bp-section-title">Growth Strategy</h3>
      <div class="bp-growth-grid" id="blueprintGrowthCards">
        <div class="bp-card">
          <div class="bp-card-icon">📦</div>
          <h4>Standalone Modules</h4>
          <p>Release features as independent micro-apps (Image Studio, Voice Lab, AI Chat, API Tester) that funnel users to the main platform.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">🔗</div>
          <h4>Referral Engine</h4>
          <p>Leverage the built-in referral system — share-to-unlock rewards, referral leaderboard, and viral invite mechanics.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">📝</div>
          <h4>Content Marketing</h4>
          <p>Blog posts, AI-generated showcases, social media templates, and feature highlight reels to attract organic users.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">🎮</div>
          <h4>Community Hooks</h4>
          <p>Gamification (gems, levels, streaks), daily check-ins, streak rewards, and the gem economy to drive retention.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">👨‍💻</div>
          <h4>Developer Outreach</h4>
          <p>Open API, SDK, embed widgets, and the Kaggle + Ollama integration story for the developer community.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">📱</div>
          <h4>Mobile Launch</h4>
          <p>PWA first for instant mobile access, then native iOS/Android via React Native or Flutter for app store presence.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">🤝</div>
          <h4>Partnerships</h4>
          <p>EdTech platforms, AI communities, hackathon sponsorships, and student developer programs for acquisition.</p>
        </div>
        <div class="bp-card">
          <div class="bp-card-icon">🔍</div>
          <h4>SEO / ASO</h4>
          <p>App store optimization, SEO landing pages per feature, keyword targeting, and structured data for discoverability.</p>
        </div>
      </div>

      <!-- Section C: Visual Roadmap (Timeline) -->
      <h3 class="bp-section-title">Roadmap</h3>
      <div class="bp-timeline" id="blueprintTimeline"></div>

      <!-- Section D: Module Release Plan -->
      <h3 class="bp-section-title">Module Release Plan</h3>
      <div class="bp-table-wrap">
        <table class="bp-table" id="blueprintModuleTable">
          <thead>
            <tr><th>Module</th><th>Standalone?</th><th>Status</th><th>Priority</th><th>Description</th></tr>
          </thead>
          <tbody id="blueprintModuleBody"></tbody>
        </table>
      </div>

      <!-- Section E: Trackable Milestones -->
      <h3 class="bp-section-title">Milestones</h3>
      <p style="color:var(--text2);margin-bottom:16px;">Track progress toward key goals. Admins can update status directly.</p>
      <div class="bp-milestones" id="blueprintMilestones"></div>

      <!-- Section F: Punchlines + Marketing Copy -->
      <h3 class="bp-section-title">Marketing Copy &amp; Punchlines</h3>
      <div class="bp-copy-grid">
        <div class="bp-copy-card">
          <div class="bp-copy-label">Tagline</div>
          <div class="bp-copy-text">"Your AI-Powered Social Universe"</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Your AI-Powered Social Universe').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">Elevator Pitch</div>
          <div class="bp-copy-text">"Circle for Life combines social networking, AI tools, and gamification into one platform. Chat with AI, generate images, make voice translations, call AI agents — all while earning gems and leveling up."</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Circle for Life combines social networking, AI tools, and gamification into one platform. Chat with AI, generate images, make voice translations, call AI agents — all while earning gems and leveling up.').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">AI Chat Playground</div>
          <div class="bp-copy-text">"Talk to any AI model — cloud or local — in one beautiful interface."</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Talk to any AI model — cloud or local — in one beautiful interface.').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">Image Studio</div>
          <div class="bp-copy-text">"Generate stunning AI art and manage your creations in a personal gallery."</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Generate stunning AI art and manage your creations in a personal gallery.').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">Voice Lab</div>
          <div class="bp-copy-text">"Speak, translate, and listen — AI-powered voice tools at your fingertips."</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Speak, translate, and listen — AI-powered voice tools at your fingertips.').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">AI Agent Call Center</div>
          <div class="bp-copy-text">"Call an AI agent by voice — or let it call you. The future of customer support."</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Call an AI agent by voice — or let it call you. The future of customer support.').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">Social Post Template</div>
          <div class="bp-copy-text">"Just discovered @CircleForLife — AI chat, image gen, voice tools, and a gem economy all in one platform. This is the future! 🚀 #AI #CircleForLife"</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('Just discovered @CircleForLife — AI chat, image gen, voice tools, and a gem economy all in one platform. This is the future! 🚀 #AI #CircleForLife').then(()=>showToast('Copied!'))">Copy</button>
        </div>
        <div class="bp-copy-card">
          <div class="bp-copy-label">Launch Announcement</div>
          <div class="bp-copy-text">"We just launched Circle for Life — a free AI-powered social platform with chat, image gen, voice AI, phone agents, and gamification. Try it now!"</div>
          <button class="btn-small bp-copy-btn" onclick="navigator.clipboard.writeText('We just launched Circle for Life — a free AI-powered social platform with chat, image gen, voice AI, phone agents, and gamification. Try it now!').then(()=>showToast('Copied!'))">Copy</button>
        </div>
      </div>

    </div>
    <!-- END BLUEPRINT PAGE -->

  </div>
</div>

<!-- Create User Modal -->
<div class="modal-bg" id="createModal">
  <div class="modal">
    <h3>Create New User</h3>
    <div class="form-group"><label>Username</label><input class="form-input" id="newUser"></div>
    <div class="form-group"><label>Email</label><input class="form-input" type="email" id="newEmail"></div>
    <div class="form-group"><label>Password</label><input class="form-input" type="password" id="newPass" value="password123"></div>
    <div class="form-group"><label>Display Name</label><input class="form-input" id="newName"></div>
    <div class="form-group"><label>Role</label>
      <select class="form-input" id="newRole"><option value="user">User</option><option value="creator">Creator</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select>
    </div>
    <div class="modal-footer">
      <button class="btn-modal-cancel" onclick="closeModal('createModal')">Cancel</button>
      <button class="btn-modal-primary" onclick="createUser()">Create</button>
    </div>
  </div>
</div>

<!-- Action Modal -->
<div class="modal-bg" id="actionModal">
  <div class="modal"><h3 id="amTitle"></h3><div id="amBody"></div></div>
</div>

<!-- New Chat Modal -->
<div class="modal-bg" id="newChatModal">
  <div class="modal">
    <h3>Start New Conversation</h3>
    <div class="form-group"><label>Search Users</label><input class="form-input" id="chatUserSearch" placeholder="Search by name..." oninput="searchChatUsers()"></div>
    <div id="chatUserList" style="max-height:300px;overflow-y:auto;margin-bottom:12px;"></div>
    <div class="form-group"><label>First Message</label><textarea class="form-input" id="firstMessage" rows="3" placeholder="Say hello..."></textarea></div>
    <div class="modal-footer">
      <button class="btn-modal-cancel" onclick="closeModal('newChatModal')">Cancel</button>
      <button class="btn-modal-primary" id="startChatBtn" onclick="startNewConversation()" disabled>Start Chat</button>
    </div>
  </div>
</div>

<!-- Blog Post from Playground Modal -->
<div class="modal-bg" id="playgroundPostModal">
  <div class="modal">
    <h3>Post to Blog from Playground</h3>
    <div class="form-group"><label>Title</label><input class="form-input" id="pgPostTitle" placeholder="Title for your blog post"></div>
    <div class="form-group"><label>Content (pre-filled from playground)</label><textarea class="form-input" id="pgPostContent" rows="6"></textarea></div>
    <div class="form-group"><label>Tags</label><input class="form-input" id="pgPostTags" placeholder="ai, playground"></div>
    <div class="form-group"><label>Image (optional)</label>
      <div style="display:flex;gap:6px;">
        <input class="form-input" id="pgPostImage" placeholder="Paste image URL or pick from gallery..." style="flex:1;">
        <button class="btn-small" onclick="openPgGalleryPicker()" style="white-space:nowrap;">Gallery</button>
      </div>
      <div id="pgGalleryPicker" style="display:none;margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;max-height:150px;overflow-y:auto;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-modal-cancel" onclick="closeModal('playgroundPostModal')">Cancel</button>
      <button class="btn-modal-primary" onclick="publishFromPlayground()">Publish to Blog</button>
    </div>
  </div>
</div>

<!-- Agent Call Overlay (full-screen, position:fixed) -->
<div id="agentCallOverlay">
  <div class="call-header">
    <div class="call-avatar-ring" id="callAgentAvatar">?</div>
    <div class="call-agent-name" id="callAgentName"></div>
    <div class="call-agent-specialty" id="callAgentSpecialty"></div>
    <div class="call-status" id="callStatus">Connecting...</div>
    <div class="call-timer" id="callTimer">0:00</div>
  </div>
  <div class="call-transcript" id="callTranscript"></div>
  <div class="call-waveform" id="callWaveform">
    <div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div>
    <div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div>
    <div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div>
    <div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div><div class="wbar"></div>
  </div>
  <div class="call-controls">
    <button class="call-ctrl-btn mute" id="callMuteBtn" onclick="toggleAgentCallMute()" title="Mute">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
    </button>
    <button class="call-ctrl-btn speaker" id="callSpeakerBtn" onclick="toggleAgentSpeaker()" title="Speaker">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
    </button>
    <button class="call-ctrl-btn end-call" onclick="endAgentCall()" title="End Call">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
    </button>
    <button class="call-ctrl-btn escalate" id="callEscalateBtn" onclick="escalateAgentCall()" title="Talk to Human">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </button>
  </div>
</div>

<div class="toast" id="toast"></div>

<!-- ═══════ GLOBAL FLOATING VOICE-TO-TEXT WIDGET ═══════ -->
<div id="globalVoiceFab" onclick="toggleGlobalVoice()" title="Voice to Text — speak anywhere" style="
  position:fixed;bottom:28px;right:28px;z-index:9999;
  width:56px;height:56px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent),#8b5cf6);
  color:#fff;border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  font-size:24px;
  box-shadow:0 4px 20px rgba(99,102,241,0.35);
  transition:all 0.3s ease;
">&#127908;</div>

<!-- Global Voice Panel -->
<div id="globalVoicePanel" style="
  display:none;position:fixed;bottom:96px;right:28px;z-index:9998;
  width:360px;max-width:calc(100vw - 56px);
  background:var(--surface);border:1px solid var(--border);
  border-radius:16px;
  box-shadow:0 8px 32px rgba(0,0,0,0.3);
  overflow:hidden;
  animation:slideUp 0.2s ease-out;
">
  <style>
    @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    #globalVoicePanel .gv-header { padding:14px 16px;background:linear-gradient(135deg,var(--accent),#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:space-between; }
    #globalVoicePanel .gv-body { padding:16px; }
    #globalVoicePanel .gv-bars { display:flex;align-items:end;gap:2px;height:32px;justify-content:center; }
    #globalVoicePanel .gvb { width:4px;background:var(--accent);border-radius:2px;transition:height 0.05s;height:4px; }
    #globalVoicePanel .gv-text { min-height:80px;max-height:200px;overflow-y:auto;margin:12px 0;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word; }
    #globalVoicePanel .gv-actions { display:flex;gap:8px; }
    #globalVoicePanel .gv-actions button { flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s; }
    #globalVoicePanel .gv-actions button:hover { background:var(--accent-glow);color:var(--accent);border-color:var(--accent); }
    #globalVoicePanel .gv-status { text-align:center;font-size:12px;color:var(--text3);margin-top:8px; }
    @media(max-width:480px) {
      #globalVoicePanel { width:calc(100vw - 32px);right:16px;bottom:88px; }
      #globalVoiceFab { width:48px;height:48px;font-size:20px;bottom:20px;right:20px; }
    }
  </style>
  <div class="gv-header">
    <span style="font-weight:700;font-size:14px;">Voice to Text</span>
    <button onclick="toggleGlobalVoice()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;padding:0 4px;">&#10005;</button>
  </div>
  <div class="gv-body">
    <div style="text-align:center;margin-bottom:12px;">
      <button id="gvMicBtn" onclick="toggleGvRecording()" style="
        width:64px;height:64px;border-radius:50%;border:2px solid var(--accent);
        background:var(--surface2);color:var(--accent);font-size:28px;cursor:pointer;
        transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;
      ">&#127908;</button>
    </div>
    <div id="gvBars" class="gv-bars" style="display:none;">
      <div class="gvb"></div><div class="gvb"></div><div class="gvb"></div><div class="gvb"></div>
      <div class="gvb"></div><div class="gvb"></div><div class="gvb"></div><div class="gvb"></div>
      <div class="gvb"></div><div class="gvb"></div><div class="gvb"></div><div class="gvb"></div>
      <div class="gvb"></div><div class="gvb"></div><div class="gvb"></div><div class="gvb"></div>
      <div class="gvb"></div><div class="gvb"></div><div class="gvb"></div><div class="gvb"></div>
    </div>
    <div id="gvTimer" style="display:none;text-align:center;font-size:20px;font-weight:700;color:var(--red);margin:8px 0;">
      <span style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulse 1s infinite;margin-right:6px;vertical-align:middle;"></span>
      <span id="gvTimerText">0:00</span>
    </div>
    <div id="gvTranscript" class="gv-text" style="display:none;">
      <span style="color:var(--text3);font-style:italic;">Transcribed text will appear here...</span>
    </div>
    <div class="gv-actions">
      <button onclick="gvCopy()" title="Copy to clipboard">&#128203; Copy</button>
      <button onclick="gvClear()" title="Clear text">&#128465; Clear</button>
      <button onclick="gvPaste()" title="Paste into current input field">&#128229; Paste</button>
    </div>
    <div class="gv-actions" style="margin-top:6px;">
      <button onclick="gvAskLLM()" title="Send text to AI and get a response" style="background:var(--accent-glow);color:var(--accent);border-color:var(--accent);">&#129302; Ask AI</button>
      <button onclick="gvTranslate()" title="Translate text to English" style="background:var(--accent-glow);color:var(--accent);border-color:var(--accent);">&#127760; Translate</button>
    </div>
    <div id="gvAiResponse" class="gv-text" style="display:none;border-color:var(--accent);"></div>
    <div id="gvStatus" class="gv-status">Click the mic to start</div>
  </div>
</div>

<script>
  // ── State ──
  let token = localStorage.getItem('cfl_token');
  let user = JSON.parse(localStorage.getItem('cfl_user') || 'null');
  let levelData = JSON.parse(localStorage.getItem('cfl_level') || 'null');
  let chatHistory = [];
  let lastPlaygroundData = null;

  // Nav items config: id, icon SVG, label, minLevel, feature key
  const NAV_CONFIG = [
    { id: 'overview', label: 'Overview', minLevel: 1, feature: 'feed', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
    { id: 'profile', label: 'My Profile', minLevel: 1, feature: 'feed', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
    { id: 'chat', label: 'AI Chat', minLevel: 1, feature: 'chat_basic', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' },
    { id: 'blog', label: 'Blog', minLevel: 2, feature: 'blog_read', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>' },
    { id: 'images', label: 'Image Studio', minLevel: 4, feature: 'image_gen', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>' },
    { id: 'voice', label: 'Voice Lab', minLevel: 4, feature: 'voice_translate', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' },
    { id: 'api', label: 'API Tester', minLevel: 4, feature: 'api_tester', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg>' },
    { id: 'users', label: 'Users', minLevel: 6, feature: 'user_management', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>' },
    { id: 'audit', label: 'Audit Log', minLevel: 6, feature: 'audit_log', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    { id: 'prompts', label: 'System Prompts', minLevel: 8, feature: 'system_config', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>' },
    { id: 'p2p', label: 'P2P Chat', minLevel: 1, feature: 'p2p_chat', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h8"/><circle cx="19" cy="5" r="3"/></svg>' },
    { id: 'agents', label: 'AI Agents', minLevel: 3, feature: 'ai_agents', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>' },
    { id: 'calllogs', label: 'Call Logs', minLevel: 6, feature: 'full_admin', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>' },
    { id: 'blueprint', label: 'Blueprint', minLevel: 1, feature: 'feed', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>' },
  ];

  // ── Init ──
  window.addEventListener('load', () => {
    if (token && user) { refreshLevelAndEnter(); }
  });

  async function refreshLevelAndEnter() {
    try {
      const d = await api('GET', '/v1/auth/me');
      user = d.user;
      levelData = d.level;
      localStorage.setItem('cfl_user', JSON.stringify(user));
      localStorage.setItem('cfl_level', JSON.stringify(levelData));
    } catch(e) { /* use cached */ }
    enterDashboard();
  }

  // ── Auth Toggle ──
  function showLogin() { document.getElementById('loginForm').style.display = ''; document.getElementById('registerForm').style.display = 'none'; }
  function showRegister() { document.getElementById('loginForm').style.display = 'none'; document.getElementById('registerForm').style.display = ''; }

  // ── Login ──
  async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const alert = document.getElementById('loginAlert');
    const btn = document.getElementById('loginBtn');

    if (!email || !pass) { showAlert(alert, 'Please fill in all fields', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const data = await api('POST', '/v1/auth/login', { email, password: pass });
      token = data.tokens.accessToken;
      user = data.user;
      levelData = data.level;
      localStorage.setItem('cfl_token', token);
      localStorage.setItem('cfl_user', JSON.stringify(user));
      localStorage.setItem('cfl_level', JSON.stringify(levelData));
      enterDashboard();
    } catch (e) {
      showAlert(alert, e.message, 'error');
    } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  }

  // ── Register ──
  async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const displayName = document.getElementById('regDisplayName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    const referral = document.getElementById('regReferral').value.trim();
    const alert = document.getElementById('registerAlert');
    const btn = document.getElementById('regBtn');

    if (!username || !email || !pass) { showAlert(alert, 'Please fill in all required fields', 'error'); return; }
    if (pass.length < 8) { showAlert(alert, 'Password must be at least 8 characters', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      const body = { username, email, password: pass, displayName: displayName || username };
      if (referral) body.referralCode = referral;
      const data = await api('POST', '/v1/auth/register', body);
      token = data.tokens.accessToken;
      user = data.user;
      levelData = data.level;
      localStorage.setItem('cfl_token', token);
      localStorage.setItem('cfl_user', JSON.stringify(user));
      localStorage.setItem('cfl_level', JSON.stringify(levelData));
      enterDashboard();
      toast('Welcome to Circle for Life!', 'ok');
    } catch (e) {
      showAlert(alert, e.message, 'error');
    } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
  }

  // ── Mobile Navigation ──
  function toggleMobileNav() {
    const sidebar = document.getElementById('sidebarEl');
    const overlay = document.getElementById('sidebarOverlay');
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) { closeMobileNav(); } else { openMobileNav(); }
  }
  function openMobileNav() {
    document.getElementById('sidebarEl').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav() {
    document.getElementById('sidebarEl').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    document.body.style.overflow = '';
  }

  // ── Enter Dashboard ──
  function enterDashboard() {
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('dashApp').classList.add('show');

    const lvl = levelData?.current || { level: 1, icon: '🌱', name: 'newcomer', title: 'Newcomer', color: '#71717A' };

    document.getElementById('sidebarAvatar').textContent = lvl.icon;
    document.getElementById('sidebarAvatar').style.fontSize = '18px';
    document.getElementById('sidebarName').textContent = user.displayName || user.username;
    document.getElementById('sidebarRole').textContent = 'Lv.' + lvl.level + ' ' + lvl.title + ' · ' + user.role;

    renderSidebar();
    nav('overview');

    // Restore saved chat/voice settings
    loadChatSettings();
    loadVoiceSettings();

    // Start global heartbeat + incoming call polling so calls work from any page
    startHeartbeat();
    startGlobalCallPolling();
  }

  // ── Logout ──
  function logout() {
    // Stop all polling
    stopHeartbeat();
    stopGlobalCallPolling();
    if (p2pCallActive) endP2PCall();
    hideGlobalIncomingCall();

    token = null; user = null; levelData = null;
    chatHistory = [];
    lastPlaygroundData = null;
    localStorage.removeItem('cfl_token');
    localStorage.removeItem('cfl_user');
    localStorage.removeItem('cfl_level');
    // Clear chat UI
    const chatBox = document.getElementById('chatBox');
    if (chatBox) chatBox.innerHTML = '';
    document.getElementById('dashApp').classList.remove('show');
    document.getElementById('authPage').style.display = '';
    showLogin();
  }

  // ── Render Sidebar (level-aware) ──
  function renderSidebar() {
    const userLevel = levelData?.current?.level || 1;
    const navEl = document.getElementById('sidebarNav');
    // Admin/super_admin bypass: they see everything unlocked
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

    navEl.innerHTML = NAV_CONFIG.map((item, i) => {
      const unlocked = isAdmin || userLevel >= item.minLevel;
      return '<div class="nav-item' + (i === 0 ? ' active' : '') + (unlocked ? '' : ' locked') + '" data-s="' + item.id + '" onclick="nav(\\'' + item.id + '\\')">' +
        item.icon + '<span style="flex:1;">' + item.label + '</span>' +
        (unlocked ? '' : '<span class="lock-icon">Lv.' + item.minLevel + '</span>') +
      '</div>';
    }).join('');
  }

  // ── Navigation (level-gated) ──
  function nav(id) {
    closeMobileNav(); // Close sidebar on mobile when navigating
    const userLevel = levelData?.current?.level || 1;
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    const navItem = NAV_CONFIG.find(n => n.id === id);

    // Check if locked
    if (navItem && !isAdmin && userLevel < navItem.minLevel) {
      // Show locked page
      document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const q = document.querySelector('[data-s="' + id + '"]');
      if (q) q.classList.add('active');

      // Find or create locked page
      let lp = document.getElementById('p-locked');
      if (!lp) { lp = document.createElement('div'); lp.id = 'p-locked'; lp.className = 'page'; document.querySelector('.main').appendChild(lp); }
      lp.style.display = '';
      const neededLevel = levelData?.allLevels?.find(l => l.level === navItem.minLevel);
      lp.innerHTML = '<div class="locked-page">' +
        '<div class="lock-big">&#128274;</div>' +
        '<h2>' + navItem.label + ' is Locked</h2>' +
        '<p>You need to reach <strong style="color:' + (neededLevel?.color || 'var(--accent)') + ';">' + (neededLevel?.icon || '') + ' Level ' + navItem.minLevel + ' — ' + (neededLevel?.title || '') + '</strong> to unlock this feature.</p>' +
        '<div class="unlock-info">You are <strong>Level ' + userLevel + '</strong> · ' +
          (levelData?.next ? 'Earn <strong>' + levelData.gemsToNext + ' more gems</strong> to reach Level ' + levelData.next.level : 'Max level reached!') +
        '</div>' +
        '<div style="margin-top:20px;">' +
          '<p style="font-size:13px;color:var(--text3);">Keep creating, voting, and earning gems to level up!</p>' +
        '</div>' +
      '</div>';
      return;
    }

    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const lp = document.getElementById('p-locked');
    if (lp) lp.style.display = 'none';
    const pageEl = document.getElementById('p-' + id);
    if (pageEl) pageEl.style.display = '';
    const navEl = document.querySelector('[data-s="' + id + '"]');
    if (navEl) navEl.classList.add('active');
    // Scroll to top on page change — target every possible scroll container
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    var mainEl = document.querySelector('.main');
    if (mainEl) mainEl.scrollTop = 0;
    if (id === 'overview') loadOverview();
    if (id === 'profile') loadProfile();
    if (id === 'users') loadUsers();
    if (id === 'audit') loadAudit();
    if (id === 'blog') loadBlogFeed();
    if (id === 'images') loadImageGallery();
    if (id === 'voice') loadTranslationHistory();
    if (id === 'prompts') loadSystemPrompts();
    if (id === 'p2p') { loadConversations(); startHeartbeat(); }
    if (id === 'agents') { loadAgentPage(); }
    if (id === 'calllogs') { loadCallLogs(); }
    if (id === 'blueprint') { loadBlueprint(); }
  }

  // ── Has feature check (client-side) ──
  function hasFeature(feature) {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) return true;
    return levelData?.unlockedFeatures?.includes(feature) || false;
  }

  // ── API Helper ──
  async function api(method, path, body) {
    const h = {};
    if (token) h['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers: h };
    if (body && method !== 'GET') {
      h['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) { logout(); }
      throw new Error(d?.error?.message || 'Request failed (' + r.status + ')');
    }
    return d;
  }

  // ── Profile ──
  async function loadProfile() {
    try {
      const d = await api('GET', '/v1/auth/me');
      user = d.user;
      levelData = d.level;
      localStorage.setItem('cfl_user', JSON.stringify(user));
      localStorage.setItem('cfl_level', JSON.stringify(levelData));
    } catch (e) {
      toast('Failed to load profile: ' + e.message, 'error');
      return;
    }

    const u = user;
    const lvl = levelData?.current || { level: 1, title: 'Newcomer' };

    // Avatar
    const avatarImg = document.getElementById('profileAvatarImg');
    const avatarLetter = document.getElementById('profileAvatarLetter');
    if (u.avatarUrl) {
      avatarImg.src = u.avatarUrl;
      avatarImg.style.display = '';
      avatarLetter.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarLetter.style.display = '';
      avatarLetter.textContent = (u.displayName || u.username || '?').charAt(0).toUpperCase();
    }

    // Name & info
    document.getElementById('profileDisplayName').textContent = u.displayName || u.username || 'User';
    document.getElementById('profileUsername').textContent = '@' + (u.username || '');

    // Level badge
    const badge = document.getElementById('profileBadge');
    const badgeColors = { 1:'#6366f1', 2:'#3b82f6', 3:'#06b6d4', 4:'#10b981', 5:'#f59e0b', 6:'#f97316', 7:'#ef4444', 8:'#ec4899', 9:'#8b5cf6', 10:'#a855f7' };
    const bgColor = badgeColors[lvl.level] || '#6366f1';
    badge.style.background = bgColor + '22';
    badge.style.color = bgColor;
    badge.style.border = '1px solid ' + bgColor + '44';
    badge.textContent = 'Lv.' + lvl.level + ' ' + lvl.title;

    document.getElementById('profileRole').textContent = u.role || 'user';

    // Bio
    document.getElementById('profileBioDisplay').textContent = u.bio || 'No bio yet. Click "Edit Profile" to add one.';

    // Stats
    document.getElementById('profStatGems').textContent = u.gemBalance || 0;
    document.getElementById('profStatPosts').textContent = u.totalPosts || 0;
    document.getElementById('profStatVotes').textContent = u.totalVotesReceived || 0;
    document.getElementById('profStatTotalGems').textContent = u.totalGemsEarned || 0;
    document.getElementById('profStatSpent').textContent = u.totalGemsSpent || 0;
    document.getElementById('profStatStreak').textContent = (u.currentStreak || 0) + ' days';
    document.getElementById('profStatReferrals').textContent = u.referralCount || 0;
    document.getElementById('profStatJoined').textContent = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-';
    document.getElementById('profStatLastLogin').textContent = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '-';

    // Referral code
    document.getElementById('profReferralCode').textContent = u.referralCode || 'N/A';

    // Edit form
    document.getElementById('editDisplayName').value = u.displayName || '';
    document.getElementById('editBio').value = u.bio || '';
    document.getElementById('editLocation').value = u.location || '';
    document.getElementById('editWebsite').value = u.website || '';
    document.getElementById('editAvatarUrl').value = u.avatarUrl || '';
    document.getElementById('bioCharCount').textContent = (u.bio || '').length;

    // Bio char counter
    const bioInput = document.getElementById('editBio');
    bioInput.oninput = function() { document.getElementById('bioCharCount').textContent = this.value.length; };

    // Level progress
    const lvInfo = document.getElementById('profileLevelInfo');
    if (levelData?.next) {
      const pct = Math.min(100, Math.round(((Number(u.totalGemsEarned) || 0) / levelData.next.minGems) * 100));
      lvInfo.innerHTML =
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;">' +
          '<span style="font-weight:600;">Level ' + lvl.level + ' &rarr; ' + levelData.next.level + '</span>' +
          '<span style="color:var(--text3);">' + (u.totalGemsEarned || 0) + ' / ' + levelData.next.minGems + ' gems</span>' +
        '</div>' +
        '<div style="height:8px;border-radius:4px;background:var(--surface2);overflow:hidden;">' +
          '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--accent),#8b5cf6);border-radius:4px;transition:width 0.5s;"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:6px;">' + (levelData.gemsToNext || 0) + ' gems to next level</div>';
    } else {
      lvInfo.innerHTML = '<div style="text-align:center;color:var(--accent);font-weight:600;font-size:14px;">&#10024; Maximum Level Reached!</div>';
    }

    // Unlocked features
    const featEl = document.getElementById('profileFeatures');
    const allFeats = levelData?.unlockedFeatures || [];
    if (allFeats.length > 0) {
      featEl.innerHTML = allFeats.map(function(f) {
        return '<span style="display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(99,102,241,0.12);color:var(--accent);border:1px solid rgba(99,102,241,0.2);">' + f.replace(/_/g, ' ') + '</span>';
      }).join('');
    } else {
      featEl.innerHTML = '<span style="font-size:12px;color:var(--text3);">Level up to unlock features!</span>';
    }

    // Show Platform Config panel for super_admin only
    var cfgPanel = document.getElementById('platformConfigPanel');
    if (cfgPanel) {
      if (u.role === 'super_admin') {
        cfgPanel.style.display = '';
        loadPlatformConfig();
      } else {
        cfgPanel.style.display = 'none';
      }
    }
  }

  async function saveProfile() {
    const btn = document.getElementById('saveProfileBtn');
    const status = document.getElementById('profileSaveStatus');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    status.textContent = '';

    try {
      const body = {
        displayName: document.getElementById('editDisplayName').value.trim(),
        bio: document.getElementById('editBio').value.trim(),
        location: document.getElementById('editLocation').value.trim(),
        website: document.getElementById('editWebsite').value.trim(),
        avatarUrl: document.getElementById('editAvatarUrl').value.trim(),
      };

      const d = await api('PUT', '/v1/auth/profile', body);
      user = d.user;
      levelData = d.level;
      localStorage.setItem('cfl_user', JSON.stringify(user));
      localStorage.setItem('cfl_level', JSON.stringify(levelData));

      // Refresh the profile display
      loadProfile();

      // Update sidebar
      document.getElementById('sidebarName').textContent = user.displayName || user.username;

      status.style.color = 'var(--green)';
      status.textContent = 'Profile saved!';
      toast('Profile updated!', 'ok');
    } catch (e) {
      status.style.color = 'var(--red)';
      status.textContent = 'Error: ' + e.message;
      toast('Failed to save: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }

  function saveAvatarUrl() {
    var url = document.getElementById('profileAvatarUrl').value.trim();
    document.getElementById('editAvatarUrl').value = url;
    document.getElementById('avatarUrlInput').style.display = 'none';
    saveProfile();
  }

  // ── Platform Config (super_admin) ──
  var _cfgFieldMap = {
    'cfgAdminPhone': 'ADMIN_PHONE_NUMBER',
    'cfgTwilioPhone': 'TWILIO_PHONE_NUMBER',
    'cfgGroqKey': 'GROQ_API_KEY',
    'cfgOpenaiKey': 'OPENAI_API_KEY',
    'cfgAnthropicKey': 'ANTHROPIC_API_KEY',
    'cfgGoogleKey': 'GOOGLE_API_KEY',
    'cfgOpenrouterKey': 'OPENROUTER_API_KEY',
    'cfgTogetherKey': 'TOGETHER_API_KEY',
    'cfgDeepseekKey': 'DEEPSEEK_API_KEY',
    'cfgMistralKey': 'MISTRAL_API_KEY',
    'cfgDefaultProvider': 'DEFAULT_LLM_PROVIDER',
    'cfgDefaultKey': 'DEFAULT_LLM_KEY',
    'cfgKaggleUrl': 'KAGGLE_OLLAMA_URL',
    'cfgElevenLabsKey': 'ELEVENLABS_API_KEY',
    'cfgServerUrl': 'SERVER_URL',
  };

  async function loadPlatformConfig() {
    try {
      var d = await api('GET', '/v1/agent-calls/admin/platform-config');
      for (var fieldId in _cfgFieldMap) {
        var envKey = _cfgFieldMap[fieldId];
        var el = document.getElementById(fieldId);
        if (el) el.value = d[envKey] || '';
      }
    } catch (e) {
      console.warn('Failed to load platform config:', e.message);
    }
  }

  async function savePlatformConfig() {
    var btn = document.getElementById('savePlatformConfigBtn');
    var status = document.getElementById('platformConfigStatus');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    status.textContent = '';

    try {
      var body = {};
      for (var fieldId in _cfgFieldMap) {
        var envKey = _cfgFieldMap[fieldId];
        var el = document.getElementById(fieldId);
        if (el) body[envKey] = el.value.trim();
      }

      var d = await api('PUT', '/v1/agent-calls/admin/platform-config', body);
      status.style.color = 'var(--green)';
      status.textContent = 'Saved! Updated: ' + (d.updated || []).join(', ');
      toast('Platform config saved!', 'ok');

      // Reload to show masked values
      setTimeout(loadPlatformConfig, 500);
    } catch (e) {
      status.style.color = 'var(--red)';
      status.textContent = 'Error: ' + e.message;
      toast('Failed to save config: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Configuration';
    }
  }

  // ── Overview ──
  async function loadOverview() {
    // Refresh level data
    try {
      const d = await api('GET', '/v1/auth/me');
      user = d.user; levelData = d.level;
      localStorage.setItem('cfl_user', JSON.stringify(user));
      localStorage.setItem('cfl_level', JSON.stringify(levelData));
    } catch(e) { /* use cached */ }

    renderLevelCard();
    renderLevelRoadmap();

    // Stats (only if user has analytics or is admin)
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    const statsGrid = document.getElementById('statsGrid');
    if (isAdmin || hasFeature('analytics')) {
      try {
        const s = await api('GET', '/v1/manage/stats');
        statsGrid.innerHTML =
          sc('Total Users', s.totalUsers, 'blue') +
          sc('Gems Circulating', s.totalGemsInCirculation, 'blue') +
          sc('Banned', s.bannedCount, 'red') +
          sc('Shadow Banned', s.shadowBannedCount, 'orange') +
          Object.entries(s.roleCounts||{}).map(([r,c]) => sc(r.replace('_',' '), c, 'purple')).join('') +
          Object.entries(s.tierCounts||{}).map(([t,c]) => sc(t + ' tier', c, 'green')).join('');
      } catch(e) { statsGrid.innerHTML = ''; }
    } else {
      // Show personal stats only
      statsGrid.innerHTML =
        sc('Your Gems', user.gemBalance || 0, 'blue') +
        sc('Total Earned', user.totalGemsEarned || 0, 'green') +
        sc('Posts', user.totalPosts || 0, 'purple') +
        sc('Votes Received', user.totalVotesReceived || 0, 'orange') +
        sc('Current Streak', (user.currentStreak || 0) + ' days', 'blue') +
        sc('Referrals', user.referralCount || 0, 'green');
    }

    // Recent activity (only for admins/champions+)
    const actEl = document.getElementById('recentActivity');
    if (isAdmin || (levelData?.current?.level || 0) >= 5) {
      try {
        const a = await api('GET', '/v1/manage/audit-log?limit=8');
        actEl.innerHTML = (a.entries||[]).length ? a.entries.map(e =>
          '<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:center;gap:10px;">' +
          '<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;"></div>' +
          '<div style="flex:1;"><span style="color:var(--accent);font-weight:600;">' + e.action + '</span> on ' + e.targetType +
          (e.details ? ' <span style="color:var(--text3);">(' + esc(e.details).substring(0,60) + ')</span>' : '') +
          '<div style="color:var(--text3);font-size:11px;margin-top:2px;">' + new Date(e.createdAt).toLocaleString() + '</div></div></div>'
        ).join('') : '<p style="padding:20px 0;text-align:center;">No recent activity</p>';
      } catch(e) { actEl.innerHTML = '<p>Activity log available at Level 5</p>'; }
    } else {
      actEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);"><p>&#128274; Activity log unlocks at <strong>Level 5 — Champion</strong></p></div>';
    }
  }
  function sc(label, value, color) {
    return '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-value ' + color + '">' + value + '</div></div>';
  }

  // ── Level Card ──
  function renderLevelCard() {
    const lc = document.getElementById('levelCard');
    if (!levelData) { lc.innerHTML = '<p style="color:var(--text3)">Level data loading...</p>'; return; }

    const cur = levelData.current;
    const nxt = levelData.next;

    lc.style.borderColor = cur.color + '33';
    lc.querySelector('::before')?.style?.setProperty?.('background', cur.color);

    lc.innerHTML =
      '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:' + cur.color + ';"></div>' +
      '<div class="level-header">' +
        '<div class="level-icon">' + cur.icon + '</div>' +
        '<div class="level-info">' +
          '<h3 style="color:' + cur.color + ';">Level ' + cur.level + ' — ' + cur.title + '</h3>' +
          '<p>' + user.displayName + ' · ' + user.gemBalance + ' gems balance · ' + (user.totalGemsEarned || 0) + ' total earned</p>' +
        '</div>' +
      '</div>' +
      (nxt ?
        '<div class="level-bar-wrap">' +
          '<div class="level-bar-label"><span>Progress to Level ' + nxt.level + ' — ' + nxt.title + '</span><span>' + levelData.progress + '%</span></div>' +
          '<div class="level-bar"><div class="level-bar-fill" style="width:' + levelData.progress + '%;background:' + cur.color + ';"></div></div>' +
          '<div style="font-size:12px;color:var(--text3);margin-top:6px;">' + levelData.gemsToNext + ' gems to go · Earn gems by voting, creating content, daily logins, and referrals</div>' +
        '</div>'
        : '<p style="font-size:14px;color:' + cur.color + ';font-weight:600;">&#10024; Maximum level reached!</p>'
      ) +
      '<div class="level-perks">' +
        cur.perks.map(p => '<div class="level-perk active">' + p + '</div>').join('') +
      '</div>';

    document.getElementById('overviewSubtitle').textContent = cur.icon + ' Level ' + cur.level + ' ' + cur.title + ' — ' + (nxt ? levelData.gemsToNext + ' gems to next level' : 'Max level!');
  }

  // ── Level Roadmap ──
  function renderLevelRoadmap() {
    const rm = document.getElementById('levelsRoadmap');
    if (!levelData?.allLevels) { rm.innerHTML = ''; return; }

    rm.innerHTML = levelData.allLevels.map(l => {
      const isCurrent = l.current;
      const isLocked = !l.unlocked;
      return '<div class="lvl-card' + (isCurrent ? ' current' : '') + (isLocked ? ' locked' : '') + '" style="' + (isCurrent ? 'border-color:' + l.color + ';' : '') + '">' +
        '<div class="lvl-top">' +
          '<div class="lvl-icon">' + l.icon + '</div>' +
          '<div>' +
            '<div class="lvl-name" style="' + (isCurrent ? 'color:' + l.color : '') + '">Lv.' + l.level + ' ' + l.title + '</div>' +
            '<div class="lvl-gems">' + (l.minGems === 0 ? 'Starting level' : l.minGems.toLocaleString() + ' gems') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="lvl-perks">' + l.perks.slice(l.level > 1 ? l.perks.length - 3 : 0).map(p => '&bull; ' + p).join('<br>') + '</div>' +
        (isLocked ? '<div class="lock-overlay"><span>&#128274;</span></div>' : '') +
      '</div>';
    }).join('');
  }

  // ── Users ──
  let allUsersCache = [];

  async function loadUsers() {
    const search = document.getElementById('userSearch').value;
    const role = document.getElementById('roleFilter').value;
    const status = document.getElementById('statusFilter').value;
    let url = '/v1/manage/users?limit=100';
    if (search) url += '&search=' + encodeURIComponent(search);
    if (role) url += '&role=' + role;
    if (status) url += '&status=' + status;
    try {
      const d = await api('GET', url);
      allUsersCache = d.users || [];
      const tb = document.getElementById('usersTbody');
      if (!d.users?.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No users found</p></td></tr>'; return; }
      tb.innerHTML = d.users.map(function(u) {
        const isShadow = u.shadowBanned === true || String(u.shadowBanned) === 'true';
        const isBanned = u.bannedAt && u.bannedAt !== '';
        const statusDot = isBanned ? 'dot-red' : isShadow ? 'dot-orange' : u.status === 'active' ? 'dot-green' : 'dot-gray';
        const statusText = isBanned ? 'banned' : u.status + (isShadow ? ' (shadow)' : '');
        const lvl = getLevelForGems(Number(u.totalGemsEarned) || 0);
        return '<tr style="cursor:pointer;" onclick="showUserDetail(\\'' + u.id + '\\')">' +
          '<td><strong>' + esc(u.displayName||u.username) + '</strong><br><span style="color:var(--text3);font-size:11px;">@' + esc(u.username) + ' &middot; ' + esc(u.email) + '</span></td>' +
          '<td><span class="role-badge role-' + u.role + '">' + u.role + '</span></td>' +
          '<td>' + u.tier + '</td>' +
          '<td style="font-size:12px;">' + lvl.icon + ' Lv.' + lvl.level + '</td>' +
          '<td style="color:var(--accent);font-weight:600;">' + (Number(u.gemBalance)||0).toLocaleString() + '</td>' +
          '<td style="color:' + (Number(u.trustScore) > 50 ? 'var(--green)' : Number(u.trustScore) > 20 ? 'var(--orange)' : 'var(--red)') + ';font-weight:600;">' + u.trustScore + '</td>' +
          '<td><span class="dot ' + statusDot + '"></span>' + statusText + '</td>' +
          '<td style="white-space:nowrap;">' +
            btn('Manage', 'blue', "event.stopPropagation();showUserDetail(\\'" + u.id + "\\')") +
          '</td></tr>';
      }).join('');
    } catch(e) { toast(e.message, 'err'); }
  }

  function getLevelForGems(gems) {
    const lvls = [
      {level:1,icon:'🌱',title:'Newcomer',min:0},{level:2,icon:'🔍',title:'Explorer',min:50},
      {level:3,icon:'🎨',title:'Creator',min:200},{level:4,icon:'⭐',title:'Influencer',min:500},
      {level:5,icon:'🏆',title:'Champion',min:1500},{level:6,icon:'👑',title:'Legend',min:5000},
      {level:7,icon:'💎',title:'Mythic',min:15000},{level:8,icon:'🔥',title:'Titan',min:30000},
      {level:9,icon:'🌟',title:'Ascendant',min:50000},{level:10,icon:'♾️',title:'Eternal',min:100000}
    ];
    let cur = lvls[0];
    for (const l of lvls) { if (gems >= l.min) cur = l; else break; }
    return cur;
  }

  function btn(label, color, onclick) { return '<button class="btn-xs btn-xs-' + color + '" onclick="' + onclick + '">' + label + '</button>'; }

  // ── User Detail Panel ──
  function showUserDetail(userId) {
    const u = allUsersCache.find(function(x) { return x.id === userId; });
    if (!u) { toast('User not found in cache', 'err'); return; }

    const panel = document.getElementById('userDetailPanel');
    panel.style.display = '';
    document.getElementById('udpTitle').textContent = (u.displayName || u.username) + ' — ' + u.id;

    const lvl = getLevelForGems(Number(u.totalGemsEarned) || 0);
    const isShadow = u.shadowBanned === true || String(u.shadowBanned) === 'true';
    const isBanned = u.bannedAt && u.bannedAt !== '';
    const isVerified = u.emailVerified === true || String(u.emailVerified) === 'true';
    const id = u.id;

    document.getElementById('udpContent').innerHTML =
      // ─ User Info Grid ─
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;">' +
        infoCard('Username', '@' + esc(u.username)) +
        infoCard('Email', esc(u.email) + (isVerified ? ' &#9989;' : ' &#10060;')) +
        infoCard('Display Name', esc(u.displayName || '-')) +
        infoCard('Role', '<span class="role-badge role-' + u.role + '">' + u.role + '</span>') +
        infoCard('Tier', u.tier) +
        infoCard('Level', lvl.icon + ' Lv.' + lvl.level + ' ' + lvl.title) +
        infoCard('Gem Balance', '<span style="color:var(--accent);font-weight:700;">' + (Number(u.gemBalance)||0).toLocaleString() + '</span>') +
        infoCard('Total Earned', (Number(u.totalGemsEarned)||0).toLocaleString()) +
        infoCard('Total Spent', (Number(u.totalGemsSpent)||0).toLocaleString()) +
        infoCard('Trust Score', '<span style="color:' + (Number(u.trustScore) > 50 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;">' + u.trustScore + '/100</span>') +
        infoCard('Posts', u.totalPosts || 0) +
        infoCard('Votes Received', u.totalVotesReceived || 0) +
        infoCard('Streak', (u.currentStreak || 0) + ' days (best: ' + (u.longestStreak || 0) + ')') +
        infoCard('Referrals', (u.referralCount || 0) + ' (code: ' + (u.referralCode || '-') + ')') +
        infoCard('Status', u.status + (isShadow ? ' <span style="color:var(--orange);">(shadow banned)</span>' : '') + (isBanned ? ' <span style="color:var(--red);">(banned)</span>' : '')) +
        infoCard('Created', new Date(u.createdAt).toLocaleString()) +
        infoCard('Last Login', u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never') +
        (u.notes ? infoCard('Notes', esc(u.notes)) : '') +
      '</div>' +

      // ─ Action Sections ─
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">' +

        // Role & Tier
        actionSection('Role & Access', '' +
          '<div class="form-group"><label>Role</label><select class="form-input" id="ud_role"><option value="guest">Guest</option><option value="user">User</option><option value="creator">Creator</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></div>' +
          '<div class="form-group"><label>Reason</label><input class="form-input" id="ud_roleReason" placeholder="Optional reason"></div>' +
          '<button class="btn-primary" style="width:100%;" onclick="udAction(\\'role\\',\\'' + id + '\\')">Change Role</button>' +
          '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px;">' +
            '<div class="form-group"><label>Tier</label><select class="form-input" id="ud_tier"><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option></select></div>' +
            '<button class="btn-primary" style="width:100%;" onclick="udAction(\\'tier\\',\\'' + id + '\\')">Change Tier</button>' +
          '</div>'
        ) +

        // Gems & Level
        actionSection('Gems & Level', '' +
          '<div class="form-group"><label>Add / Remove Gems</label><input class="form-input" type="number" id="ud_gems" placeholder="+100 or -50"></div>' +
          '<div class="form-group"><label>Reason</label><input class="form-input" id="ud_gemsReason" placeholder="Admin adjustment"></div>' +
          '<button class="btn-primary" style="width:100%;margin-bottom:12px;" onclick="udAction(\\'gems\\',\\'' + id + '\\')">Adjust Gems</button>' +
          '<div style="border-top:1px solid var(--border);margin:4px 0 12px;padding-top:12px;">' +
            '<div class="form-group"><label>Set Level (overrides gems to match)</label><select class="form-input" id="ud_level">' +
              '<option value="1">Lv.1 Newcomer (0)</option><option value="2">Lv.2 Explorer (50)</option><option value="3">Lv.3 Creator (200)</option>' +
              '<option value="4">Lv.4 Influencer (500)</option><option value="5">Lv.5 Champion (1,500)</option><option value="6">Lv.6 Legend (5,000)</option>' +
              '<option value="7">Lv.7 Mythic (15,000)</option><option value="8">Lv.8 Titan (30,000)</option><option value="9">Lv.9 Ascendant (50,000)</option>' +
              '<option value="10">Lv.10 Eternal (100,000)</option>' +
            '</select></div>' +
            '<button class="btn-primary" style="width:100%;" onclick="udAction(\\'setLevel\\',\\'' + id + '\\')">Set Level</button>' +
          '</div>'
        ) +

        // Trust & Status
        actionSection('Trust & Status', '' +
          '<div class="form-group"><label>Trust Score (0-100)</label><input class="form-input" type="number" id="ud_trust" min="0" max="100" value="' + (u.trustScore||50) + '"></div>' +
          '<button class="btn-primary" style="width:100%;margin-bottom:12px;" onclick="udAction(\\'trust\\',\\'' + id + '\\')">Set Trust Score</button>' +
          '<div style="border-top:1px solid var(--border);margin:4px 0 12px;padding-top:12px;">' +
            '<div class="form-group"><label>Status</label><select class="form-input" id="ud_status"><option value="active">Active</option><option value="suspended">Suspended</option><option value="pending_review">Pending Review</option><option value="deleted">Deleted</option></select></div>' +
            '<button class="btn-primary" style="width:100%;" onclick="udAction(\\'status\\',\\'' + id + '\\')">Change Status</button>' +
          '</div>'
        ) +

        // Moderation & Security
        actionSection('Moderation & Security', '' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<button class="btn-xs btn-xs-' + (isBanned ? 'green' : 'red') + '" style="width:100%;padding:10px;" onclick="udAction(\\'' + (isBanned ? 'unban' : 'showBan') + '\\',\\'' + id + '\\')">' + (isBanned ? '&#9989; Unban User' : '&#128683; Ban User') + '</button>' +
            '<button class="btn-xs btn-xs-orange" style="width:100%;padding:10px;" onclick="udAction(\\'shadow\\',\\'' + id + '\\')">' + (isShadow ? '&#128065; Remove Shadow Ban' : '&#128065;&#8205;&#128488;&#65039; Shadow Ban') + '</button>' +
            '<button class="btn-xs btn-xs-blue" style="width:100%;padding:10px;" onclick="udAction(\\'verifyEmail\\',\\'' + id + '\\')">' + (isVerified ? '&#10060; Unverify Email' : '&#9989; Verify Email') + '</button>' +
            '<button class="btn-xs btn-xs-orange" style="width:100%;padding:10px;" onclick="udAction(\\'resetStreak\\',\\'' + id + '\\')">&#128260; Reset Streak</button>' +
            '<div style="border-top:1px solid var(--border);margin:8px 0;padding-top:8px;">' +
              '<div class="form-group"><label>New Password</label><input class="form-input" type="password" id="ud_pass" placeholder="Min 8 chars"></div>' +
              '<button class="btn-xs btn-xs-orange" style="width:100%;padding:10px;" onclick="udAction(\\'resetPass\\',\\'' + id + '\\')">&#128274; Reset Password</button>' +
            '</div>' +
            '<div style="border-top:1px solid var(--border);margin:8px 0;padding-top:8px;">' +
              '<div class="form-group"><label>Admin Notes</label><textarea class="form-input" id="ud_notes" rows="2" placeholder="Internal notes...">' + esc(u.notes||'') + '</textarea></div>' +
              '<button class="btn-xs btn-xs-blue" style="width:100%;padding:10px;" onclick="udAction(\\'notes\\',\\'' + id + '\\')">&#128221; Save Notes</button>' +
            '</div>' +
            '<div style="border-top:1px solid var(--border);margin:8px 0;padding-top:8px;">' +
              '<button class="btn-xs btn-xs-red" style="width:100%;padding:10px;" onclick="if(confirm(\\'Delete this user? This is a soft delete.\\'))udAction(\\'delete\\',\\'' + id + '\\')">&#128465; Delete User</button>' +
            '</div>' +
          '</div>'
        ) +

      '</div>' +

      // Ban form (hidden, shown when Ban button clicked)
      '<div id="udBanForm" style="display:none;margin-top:16px;padding:16px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--red);">' +
        '<h4 style="color:var(--red);margin-bottom:12px;">Ban User</h4>' +
        '<div class="form-group"><label>Reason</label><input class="form-input" id="ud_banReason" placeholder="Reason for ban"></div>' +
        '<div class="form-group"><label>Duration</label><select class="form-input" id="ud_banDur"><option value="1h">1 Hour</option><option value="24h">24 Hours</option><option value="7d" selected>7 Days</option><option value="30d">30 Days</option><option value="permanent">Permanent</option></select></div>' +
        '<div style="display:flex;gap:8px;"><button class="btn-modal-cancel" onclick="document.getElementById(\\'udBanForm\\').style.display=\\'none\\'">Cancel</button><button class="btn-modal-danger" onclick="udAction(\\'ban\\',\\'' + id + '\\')">Confirm Ban</button></div>' +
      '</div>';

    // Set current values in selects
    setTimeout(function() {
      var el;
      el = document.getElementById('ud_role'); if (el) el.value = u.role;
      el = document.getElementById('ud_tier'); if (el) el.value = u.tier;
      el = document.getElementById('ud_status'); if (el) el.value = u.status;
      el = document.getElementById('ud_level'); if (el) el.value = String(lvl.level);
    }, 50);

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function infoCard(label, value) {
    return '<div style="padding:10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);">' +
      '<div style="font-size:10px;text-transform:uppercase;color:var(--text3);margin-bottom:4px;">' + label + '</div>' +
      '<div style="font-size:13px;">' + value + '</div></div>';
  }
  function actionSection(title, body) {
    return '<div style="padding:16px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border);">' +
      '<h4 style="font-weight:700;font-size:14px;margin-bottom:12px;">' + title + '</h4>' + body + '</div>';
  }

  function closeUserDetail() {
    document.getElementById('userDetailPanel').style.display = 'none';
  }

  // ── Unified action handler ──
  async function udAction(action, userId) {
    try {
      switch(action) {
        case 'role': {
          const role = document.getElementById('ud_role').value;
          const reason = document.getElementById('ud_roleReason').value || undefined;
          await api('POST', '/v1/manage/users/' + userId + '/role', { role, reason });
          toast('Role updated to ' + role, 'ok');
          break;
        }
        case 'tier': {
          const tier = document.getElementById('ud_tier').value;
          await api('POST', '/v1/manage/users/' + userId + '/tier', { tier });
          toast('Tier changed to ' + tier, 'ok');
          break;
        }
        case 'gems': {
          const amount = parseInt(document.getElementById('ud_gems').value);
          if (isNaN(amount) || amount === 0) { toast('Enter a valid amount', 'err'); return; }
          const reason = document.getElementById('ud_gemsReason').value || 'Admin adjustment';
          const r = await api('POST', '/v1/manage/users/' + userId + '/gems', { amount, reason });
          toast('Gems: ' + r.previousBalance + ' → ' + r.newBalance, 'ok');
          break;
        }
        case 'setLevel': {
          const level = parseInt(document.getElementById('ud_level').value);
          const r = await api('POST', '/v1/manage/users/' + userId + '/set-level', { level });
          toast('Set to Level ' + level + ' (gems: ' + r.previousGems + ' → ' + r.newGems + ')', 'ok');
          break;
        }
        case 'trust': {
          const score = parseInt(document.getElementById('ud_trust').value);
          if (isNaN(score) || score < 0 || score > 100) { toast('Score must be 0-100', 'err'); return; }
          await api('POST', '/v1/manage/users/' + userId + '/trust-score', { score });
          toast('Trust score set to ' + score, 'ok');
          break;
        }
        case 'status': {
          const status = document.getElementById('ud_status').value;
          await api('POST', '/v1/manage/users/' + userId + '/status', { status });
          toast('Status changed to ' + status, 'ok');
          break;
        }
        case 'shadow': {
          const r = await api('POST', '/v1/manage/users/' + userId + '/shadow-ban');
          toast('Shadow ban: ' + (r.shadowBanned ? 'ON' : 'OFF'), 'ok');
          break;
        }
        case 'showBan': {
          document.getElementById('udBanForm').style.display = '';
          return; // Don't reload yet
        }
        case 'ban': {
          const reason = document.getElementById('ud_banReason').value || 'Policy violation';
          const duration = document.getElementById('ud_banDur').value;
          await api('POST', '/v1/manage/users/' + userId + '/ban', { reason, duration });
          toast('User banned (' + duration + ')', 'ok');
          break;
        }
        case 'unban': {
          await api('DELETE', '/v1/manage/users/' + userId + '/ban');
          toast('User unbanned', 'ok');
          break;
        }
        case 'verifyEmail': {
          const r = await api('POST', '/v1/manage/users/' + userId + '/verify-email');
          toast('Email ' + (r.emailVerified ? 'verified' : 'unverified'), 'ok');
          break;
        }
        case 'resetStreak': {
          const r = await api('POST', '/v1/manage/users/' + userId + '/reset-streak');
          toast('Streak reset: ' + r.previousStreak + ' → 0', 'ok');
          break;
        }
        case 'resetPass': {
          const pass = document.getElementById('ud_pass').value;
          if (!pass || pass.length < 8) { toast('Password must be at least 8 chars', 'err'); return; }
          await api('POST', '/v1/manage/users/' + userId + '/reset-password', { newPassword: pass });
          toast('Password reset successfully', 'ok');
          document.getElementById('ud_pass').value = '';
          break;
        }
        case 'notes': {
          const notes = document.getElementById('ud_notes').value;
          await api('POST', '/v1/manage/users/' + userId + '/notes', { notes });
          toast('Notes saved', 'ok');
          break;
        }
        case 'delete': {
          await api('DELETE', '/v1/manage/users/' + userId);
          toast('User deleted', 'ok');
          closeUserDetail();
          break;
        }
      }
      // Refresh user list and re-open detail
      await loadUsers();
      if (action !== 'delete') {
        showUserDetail(userId);
      }
    } catch(e) { toast(e.message, 'err'); }
  }

  // Legacy functions (still used by Create User modal)
  async function createUser() {
    try {
      await api('POST', '/v1/manage/users', {
        username: document.getElementById('newUser').value,
        email: document.getElementById('newEmail').value,
        password: document.getElementById('newPass').value,
        displayName: document.getElementById('newName').value || undefined,
        role: document.getElementById('newRole').value,
      });
      toast('User created', 'ok'); closeModal('createModal'); loadUsers();
    } catch(e) { toast(e.message, 'err'); }
  }

  // ── Audit ──
  async function loadAudit() {
    try {
      const d = await api('GET', '/v1/manage/audit-log?limit=100');
      const c = document.getElementById('auditCard');
      if (!d.entries?.length) { c.innerHTML = '<div class="empty-state"><p>No audit entries yet</p></div>'; return; }
      c.innerHTML = '<table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>' +
        d.entries.map(e =>
          '<tr><td style="white-space:nowrap;font-size:12px;color:var(--text3);">' + new Date(e.createdAt).toLocaleString() + '</td>' +
          '<td><span class="role-badge role-' + e.actorRole + '" style="font-size:9px;">' + e.actorRole + '</span></td>' +
          '<td style="color:var(--accent);font-weight:600;font-size:13px;">' + e.action + '</td>' +
          '<td style="font-size:12px;">' + e.targetType + '<br><span style="color:var(--text3)">' + e.targetId + '</span></td>' +
          '<td style="font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;">' + esc(e.details||'') + '</td></tr>'
        ).join('') + '</tbody></table>';
    } catch(e) { toast(e.message, 'err'); }
  }

  // ── Chat: Provider / Model Management ──
  let modelFetchTimer = null;
  let localEngine = null; // WebLLM engine instance
  let localModelLoaded = false;

  function onProviderChange() {
    const prov = document.getElementById('chatProvider').value;
    const keyInput = document.getElementById('chatKey');
    const modelSel = document.getElementById('chatModel');
    const localPanel = document.getElementById('localLlmPanel');
    const kagglePanel = document.getElementById('kaggleChatPanel');
    const statusEl = document.getElementById('modelStatus');

    if (prov === 'local_llm' || prov === 'local') {
      if (!hasFeature('local_llm')) {
        toast('Local LLM unlocks at Level 3 — Creator', 'err');
        document.getElementById('chatProvider').value = '';
        return;
      }
      keyInput.style.display = 'none';
      modelSel.style.display = 'none';
      localPanel.style.display = '';
      kagglePanel.style.display = 'none';
      statusEl.textContent = 'Local LLM — runs in your browser via WebGPU';
    } else if (prov === 'kaggle') {
      keyInput.style.display = 'none';
      modelSel.style.display = '';
      localPanel.style.display = 'none';
      kagglePanel.style.display = '';
      statusEl.textContent = 'Kaggle Ollama — free GPU-powered LLM';
      modelSel.innerHTML = '<option value="llama3.2:3b">llama3.2:3b</option><option value="llama3.1:8b">llama3.1:8b</option><option value="mistral:7b">mistral:7b</option><option value="phi3:mini">phi3:mini</option><option value="gemma2:2b">gemma2:2b</option><option value="qwen2.5:7b">qwen2.5:7b</option>';
      // Auto-fetch live models if URL is set
      var kagUrl = document.getElementById('chatKaggleUrl').value;
      if (kagUrl) fetchKaggleChatModels();
    } else {
      keyInput.style.display = '';
      modelSel.style.display = '';
      localPanel.style.display = 'none';
      kagglePanel.style.display = 'none';
      statusEl.textContent = '';
      modelSel.innerHTML = '<option value="">Enter API key to load models...</option>';
      // If key already has value, try fetching
      if (keyInput.value.length > 5) onApiKeyInput();
    }
    saveChatSettings();
  }

  function onApiKeyInput() {
    clearTimeout(modelFetchTimer);
    const key = document.getElementById('chatKey').value;
    if (key.length < 5) return;
    // Debounce 800ms
    modelFetchTimer = setTimeout(() => fetchModels(), 800);
    saveChatSettings();
  }

  async function fetchKaggleChatModels() {
    var kaggleUrl = document.getElementById('chatKaggleUrl').value;
    if (!kaggleUrl) { toast('Enter your Kaggle ngrok URL first', 'err'); return; }
    var modelSel = document.getElementById('chatModel');
    var statusEl = document.getElementById('modelStatus');
    statusEl.innerHTML = '<span class="spinner"></span> Fetching Kaggle models...';
    try {
      var d = await api('POST', '/v1/control-panel/models', { provider: 'kaggle', apiKey: 'ollama' });
      if (d.models && d.models.length > 0) {
        modelSel.innerHTML = d.models.map(function(m) { return '<option value="'+m.id+'">'+esc(m.name)+'</option>'; }).join('');
        statusEl.textContent = d.source === 'live' ? 'Live models from Kaggle' : 'Fallback model list';
      } else {
        statusEl.textContent = 'No models found — using defaults';
      }
    } catch(e) {
      statusEl.textContent = 'Could not fetch — using default models';
    }
    saveChatSettings();
  }

  // ── Chat settings persistence ──
  function saveChatSettings() {
    try {
      localStorage.setItem('cfl_chat_settings', JSON.stringify({
        provider: document.getElementById('chatProvider').value,
        apiKey: document.getElementById('chatKey').value,
        model: document.getElementById('chatModel').value,
        kaggleUrl: document.getElementById('chatKaggleUrl').value,
      }));
    } catch(e) {}
  }

  function loadChatSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem('cfl_chat_settings') || '{}');
      if (saved.provider) {
        document.getElementById('chatProvider').value = saved.provider;
      }
      if (saved.apiKey) document.getElementById('chatKey').value = saved.apiKey;
      if (saved.kaggleUrl) document.getElementById('chatKaggleUrl').value = saved.kaggleUrl;
      if (saved.provider) onProviderChange();
      if (saved.model) {
        setTimeout(function() {
          var sel = document.getElementById('chatModel');
          if (sel) { var opt = sel.querySelector('option[value="'+saved.model+'"]'); if (opt) sel.value = saved.model; }
        }, 1500);
      }
    } catch(e) {}
  }

  async function fetchModels() {
    const prov = document.getElementById('chatProvider').value;
    const key = document.getElementById('chatKey').value;
    if (!prov || prov === 'local_llm' || prov === 'local' || prov === 'kaggle' || !key) return;

    const statusEl = document.getElementById('modelStatus');
    const modelSel = document.getElementById('chatModel');
    statusEl.innerHTML = '<span class="spinner"></span> Loading models...';
    modelSel.innerHTML = '<option value="">Loading...</option>';

    try {
      const d = await api('POST', '/v1/control-panel/models', { provider: prov, apiKey: key });
      if (d.models && d.models.length > 0) {
        modelSel.innerHTML = d.models.map(m =>
          '<option value="' + esc(m.id) + '">' + esc(m.name || m.id) + (m.owned_by ? ' (' + esc(m.owned_by) + ')' : '') + '</option>'
        ).join('');
        statusEl.innerHTML = '<span style="color:var(--green);">&#10003;</span> ' + d.models.length + ' models loaded' + (d.source === 'fallback' ? ' (cached list)' : ' (live)');
      } else {
        modelSel.innerHTML = '<option value="">No models found</option>';
        statusEl.textContent = 'No models found for this key';
      }
    } catch (e) {
      statusEl.innerHTML = '<span style="color:var(--red);">&#10007;</span> ' + e.message;
      modelSel.innerHTML = '<option value="">Failed to load models</option>';
    }
  }

  // ── Chat: Local LLM (WebLLM) ──
  async function loadLocalModel() {
    const modelId = document.getElementById('localModelSelect').value;
    if (!modelId) { toast('Select a model first', 'err'); return; }

    const loadBtn = document.getElementById('localLoadBtn');
    const progressDiv = document.getElementById('localProgress');
    const progressBar = document.getElementById('localProgressBar');
    const progressText = document.getElementById('localProgressText');
    const statusEl = document.getElementById('localStatus');

    loadBtn.disabled = true; loadBtn.textContent = 'Loading...';
    progressDiv.style.display = '';
    progressBar.style.width = '0%';
    statusEl.innerHTML = '';

    try {
      // Dynamically load WebLLM from CDN (only once)
      if (!window.webllm) {
        statusEl.textContent = 'Loading WebLLM runtime (~1MB)...';
        // Load via script tag for browser compatibility
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.type = 'module';
          s.textContent = 'import * as webllm from "https://esm.run/@mlc-ai/web-llm"; window.webllm = webllm; window.dispatchEvent(new Event("webllm-ready"));';
          document.head.appendChild(s);
          window.addEventListener('webllm-ready', resolve, { once: true });
          setTimeout(() => reject(new Error('WebLLM load timeout — check your connection')), 30000);
        });
      }

      if (!window.webllm || !window.webllm.CreateMLCEngine) {
        throw new Error('WebLLM failed to initialize. Ensure you are using Chrome 113+ with WebGPU enabled.');
      }

      statusEl.textContent = 'Initializing engine & downloading model weights...';

      const engine = await window.webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          const pct = Math.round((report.progress || 0) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = report.text || ('Downloading... ' + pct + '%');
        },
      });

      localEngine = engine;
      localModelLoaded = true;
      progressDiv.style.display = 'none';
      loadBtn.style.display = 'none';
      document.getElementById('localUnloadBtn').style.display = '';
      statusEl.innerHTML = '<span style="color:var(--green);font-weight:600;">&#10003; ' + modelId + ' loaded and ready!</span><br><span style="color:var(--text3);font-size:11px;">Model runs entirely in your browser. No data sent to any server.</span>';
      toast('Local model loaded!', 'ok');
    } catch (e) {
      console.error('WebLLM load error:', e);
      statusEl.innerHTML = '<span style="color:var(--red);">Failed: ' + esc(e.message || String(e)) + '</span>' +
        '<br><span style="color:var(--text3);font-size:11px;">WebLLM requires a browser with WebGPU support (Chrome 113+, Edge 113+). Safari and Firefox may not work yet.</span>';
      progressDiv.style.display = 'none';
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = 'Download & Load';
    }
  }

  function unloadLocalModel() {
    if (localEngine) {
      try { localEngine.unload(); } catch {}
      localEngine = null;
    }
    localModelLoaded = false;
    document.getElementById('localUnloadBtn').style.display = 'none';
    document.getElementById('localLoadBtn').style.display = '';
    document.getElementById('localStatus').innerHTML = '<span style="color:var(--text3);">Model unloaded. Memory freed.</span>';
    toast('Model unloaded', 'ok');
  }

  async function clearLocalCache() {
    try {
      const cacheNames = await caches.keys();
      let cleared = 0;
      for (const name of cacheNames) {
        if (name.includes('webllm') || name.includes('mlc') || name.includes('transformers')) {
          await caches.delete(name); cleared++;
        }
      }
      // Also try clearing all caches if none matched
      if (cleared === 0) {
        for (const name of cacheNames) { await caches.delete(name); cleared++; }
      }
      toast('Cleared ' + cleared + ' cache(s)', 'ok');
    } catch (e) { toast('Cache clear failed: ' + e.message, 'err'); }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Chat: Send Message ──
  async function sendChat() {
    const msg = document.getElementById('chatInput').value.trim();
    if (!msg) return;

    const prov = document.getElementById('chatProvider').value;
    if (!prov) { toast('Select a provider first', 'err'); return; }

    document.getElementById('chatInput').value = '';
    chatHistory.push({ role: 'user', content: msg });
    renderChat();

    const btn = document.getElementById('chatSendBtn');
    btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

    try {
      if (prov === 'local_llm' || prov === 'local') {
        // ── Local LLM inference ──
        if (!localEngine || !localModelLoaded) { throw new Error('Load a local model first'); }
        // Build messages with a system prompt for coherent conversation
        var localMsgs = [
          { role: 'system', content: 'You are a helpful, friendly AI assistant. Answer the user\\'s questions directly and conversationally. Be concise and relevant. Do not give generic chatbot advice unless specifically asked.' }
        ].concat(chatHistory.map(m => ({ role: m.role, content: m.content })));
        const reply = await localEngine.chat.completions.create({
          messages: localMsgs,
          max_tokens: 2048,
          temperature: 0.7,
          stream: false,
        });
        const content = reply.choices?.[0]?.message?.content || '';
        chatHistory.push({ role: 'assistant', content });
      } else if (prov === 'kaggle') {
        // ── Kaggle / Ollama ──
        var kaggleUrl = document.getElementById('chatKaggleUrl').value;
        if (!kaggleUrl) { throw new Error('Enter your Kaggle ngrok URL'); }
        var model = document.getElementById('chatModel').value || 'llama3.2:3b';
        var d = await api('POST', '/v1/control-panel/chat', {
          provider: 'kaggle', model: model, apiKey: 'ollama', baseUrl: kaggleUrl,
          messages: chatHistory, maxTokens: 2048,
        });
        chatHistory.push({ role: 'assistant', content: d.content });
      } else {
        // ── Cloud provider ──
        const key = document.getElementById('chatKey').value;
        if (!key) { throw new Error('Enter an API key'); }
        const model = document.getElementById('chatModel').value || undefined;
        const d = await api('POST', '/v1/control-panel/chat', {
          provider: prov, model, apiKey: key,
          messages: chatHistory, maxTokens: 2048,
        });
        chatHistory.push({ role: 'assistant', content: d.content });
      }
    } catch(e) {
      chatHistory.push({ role: 'assistant', content: 'Error: ' + (e.message || e) });
    }
    renderChat();
    btn.innerHTML = 'Send'; btn.disabled = false;
  }

  function renderChat() {
    const box = document.getElementById('chatBox');
    box.innerHTML = chatHistory.map(m =>
      '<div class="msg ' + (m.role === 'user' ? 'user' : 'bot') + '"><div class="bubble">' + esc(m.content) + '</div></div>'
    ).join('');
    box.scrollTop = box.scrollHeight;
  }

  // ── API Tester ──
  async function sendApiReq() {
    const method = document.getElementById('apiMethod').value;
    const path = document.getElementById('apiPath').value;
    const bodyText = document.getElementById('apiBody').value;
    const out = document.getElementById('apiResponse');
    out.textContent = 'Sending...'; out.style.color = 'var(--text3)';
    try {
      let body; if (bodyText.trim() && method !== 'GET') body = JSON.parse(bodyText);
      const d = await api(method, path, body);
      out.textContent = JSON.stringify(d, null, 2); out.style.color = 'var(--green)';
    } catch(e) { out.textContent = 'Error: ' + e.message; out.style.color = 'var(--red)'; }
  }

  // ── Modal ──
  function openModal(id) { const el = document.getElementById(id); el.style.display = 'flex'; el.classList.add('show'); }
  function closeModal(id) { const el = document.getElementById(id); el.classList.remove('show'); el.style.display = 'none'; }
  document.querySelectorAll('.modal-bg').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) { el.classList.remove('show'); el.style.display = 'none'; } });
  });

  // ── Toast ──
  function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.className = 'toast show ' + (type||'ok');
    setTimeout(() => el.className = 'toast', 3000);
  }

  // ── Alert ──
  function showAlert(el, msg, type) {
    el.textContent = msg; el.className = 'alert-box show ' + type;
  }

  // ── Escape HTML ──
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // Enter on login fields
  document.getElementById('loginEmail').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
  document.getElementById('loginPass').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
  document.getElementById('regPass').addEventListener('keydown', e => { if(e.key==='Enter') handleRegister(); });

  // ═══════════════════════════════════════════════════════════════════════════
  // ██  BLOG SYSTEM  ██████████████████████████████████████████████████████████
  // ═══════════════════════════════════════════════════════════════════════════

  let blogPage = 1;

  function showBlogEditor() {
    if (!hasFeature('blog_write')) {
      toast('Blog writing unlocks at Level 3 — Creator', 'err');
      return;
    }
    document.getElementById('blogEditor').style.display = '';
  }
  function hideBlogEditor() {
    document.getElementById('blogEditor').style.display = 'none';
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogContent').value = '';
    document.getElementById('blogTags').value = '';
    document.getElementById('blogImage').value = '';
    document.getElementById('blogImagePreview').style.display = 'none';
    document.getElementById('blogInlineGen').style.display = 'none';
    document.getElementById('blogGalleryPicker').style.display = 'none';
  }

  async function loadBlogFeed() {
    const feed = document.getElementById('blogFeed');
    const sort = document.getElementById('blogSort').value;
    const search = document.getElementById('blogSearch').value;

    try {
      const data = await api('GET', '/v1/blog/posts?page=' + blogPage + '&sort=' + sort + '&search=' + encodeURIComponent(search));
      if (!data.posts || data.posts.length === 0) {
        feed.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><p style="font-size:40px;margin-bottom:12px;">&#128221;</p><p>No posts yet. Be the first to write!</p></div>';
        return;
      }

      feed.innerHTML = data.posts.map(function(p) {
        const time = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return '<div class="card" style="cursor:pointer;" onclick="openBlogPost(\\'' + p.id + '\\')">' +
          (p.imageUrl ? '<div style="width:100%;height:200px;background:var(--surface2);border-radius:var(--radius) var(--radius) 0 0;overflow:hidden;"><img src="' + esc(p.imageUrl) + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display=\\'none\\'"></div>' : '') +
          '<div style="padding:18px;">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
              '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--bg);">' + (p.authorDisplayName || 'A')[0].toUpperCase() + '</div>' +
              '<div><div style="font-weight:600;font-size:13px;">' + esc(p.authorDisplayName || p.authorUsername) + '</div><div style="font-size:11px;color:var(--text3);">' + time + (p.source === 'playground' ? ' &bull; From Playground' : '') + '</div></div>' +
              (p.category && p.category !== 'general' ? '<span style="margin-left:auto;font-size:10px;padding:3px 8px;background:var(--surface2);border-radius:4px;color:var(--text2);">' + esc(p.category) + '</span>' : '') +
            '</div>' +
            '<h3 style="font-size:17px;font-weight:700;margin-bottom:6px;">' + esc(p.title) + '</h3>' +
            '<p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:12px;">' + esc(p.excerpt || p.content) + '</p>' +
            '<div style="display:flex;gap:16px;font-size:12px;color:var(--text3);">' +
              '<span>&#10084; ' + (p.likeCount || 0) + '</span>' +
              '<span>&#128172; ' + (p.commentCount || 0) + '</span>' +
              '<span>&#128065; ' + (p.viewCount || 0) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      // Pagination
      const pg = data.pagination;
      if (pg.pages > 1) {
        let btns = '';
        for (let i = 1; i <= pg.pages; i++) {
          btns += '<button onclick="blogPage=' + i + ';loadBlogFeed()" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:' + (i === pg.page ? 'var(--accent)' : 'var(--surface)') + ';color:' + (i === pg.page ? 'var(--bg)' : 'var(--text2)') + ';cursor:pointer;font-size:12px;">' + i + '</button>';
        }
        document.getElementById('blogPagination').innerHTML = btns;
      } else {
        document.getElementById('blogPagination').innerHTML = '';
      }
    } catch(e) { feed.innerHTML = '<p style="color:var(--error);padding:20px;">' + e.message + '</p>'; }
  }

  async function openBlogPost(postId) {
    document.getElementById('blogFeed').style.display = 'none';
    document.getElementById('blogPagination').style.display = 'none';
    document.getElementById('blogEditor').style.display = 'none';
    const wrap = document.getElementById('blogSearch').parentElement;
    if (wrap) wrap.style.display = 'none';
    document.getElementById('blogWriteBtn').style.display = 'none';

    const detail = document.getElementById('blogDetail');
    detail.style.display = '';

    try {
      const data = await api('GET', '/v1/blog/posts/' + postId);
      const p = data.post;
      const time = new Date(p.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      // Check if user liked
      let userLiked = false;
      try {
        const likeData = await api('GET', '/v1/blog/posts/' + postId + '/has-liked');
        userLiked = likeData.liked;
      } catch(e) {}

      let playgroundInfo = '';
      if (p.source === 'playground' && p.playgroundData) {
        try {
          const pgd = JSON.parse(p.playgroundData);
          playgroundInfo = '<div style="background:var(--surface2);border-radius:8px;padding:14px;margin-top:16px;font-size:13px;">' +
            '<div style="font-weight:600;margin-bottom:6px;color:var(--accent);">&#129302; Created in AI Playground</div>' +
            (pgd.provider ? '<div>Provider: <strong>' + esc(pgd.provider) + '</strong></div>' : '') +
            (pgd.model ? '<div>Model: <strong>' + esc(pgd.model) + '</strong></div>' : '') +
            (pgd.prompt ? '<div style="margin-top:6px;color:var(--text3);">Prompt: ' + esc(pgd.prompt) + '</div>' : '') +
          '</div>';
        } catch(e) {}
      }

      document.getElementById('blogDetailContent').innerHTML =
        '<article>' +
          (p.imageUrl ? '<div style="width:100%;max-height:400px;overflow:hidden;border-radius:var(--radius-lg);margin-bottom:20px;"><img src="' + esc(p.imageUrl) + '" style="width:100%;object-fit:cover;" onerror="this.parentElement.style.display=\\'none\\'"></div>' : '') +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
            '<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:var(--bg);">' + (p.authorDisplayName || 'A')[0].toUpperCase() + '</div>' +
            '<div><div style="font-weight:600;">' + esc(p.authorDisplayName || p.authorUsername) + '</div><div style="font-size:12px;color:var(--text3);">' + time + '</div></div>' +
          '</div>' +
          '<h1 style="font-size:28px;font-weight:800;margin-bottom:16px;line-height:1.3;">' + esc(p.title) + '</h1>' +
          '<div style="font-size:15px;line-height:1.8;color:var(--text);white-space:pre-wrap;">' + esc(p.content) + '</div>' +
          playgroundInfo +
          '<div style="display:flex;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid var(--border);align-items:center;">' +
            '<button onclick="toggleBlogLike(\\'' + p.id + '\\')" id="likeBtn-' + p.id + '" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid ' + (userLiked ? 'var(--accent)' : 'var(--border)') + ';background:' + (userLiked ? 'var(--accent-glow)' : 'var(--surface)') + ';cursor:pointer;color:' + (userLiked ? 'var(--accent)' : 'var(--text2)') + ';font-size:14px;">' +
              (userLiked ? '&#10084;&#65039;' : '&#9825;') + ' <span id="likeCount-' + p.id + '">' + (p.likeCount || 0) + '</span>' +
            '</button>' +
            '<span style="color:var(--text3);font-size:13px;">&#128172; ' + (p.commentCount || 0) + ' comments</span>' +
            '<span style="color:var(--text3);font-size:13px;">&#128065; ' + (p.viewCount || 0) + ' views</span>' +
          '</div>' +
        '</article>';

      // Comments
      const cmts = data.comments || [];
      document.getElementById('blogComments').innerHTML =
        '<h3 style="font-weight:700;margin-bottom:16px;">Comments (' + cmts.length + ')</h3>' +
        '<div style="display:flex;gap:8px;margin-bottom:20px;">' +
          '<textarea id="commentInput-' + p.id + '" rows="2" placeholder="Write a comment..." style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:13px;font-family:inherit;resize:none;"></textarea>' +
          '<button onclick="postComment(\\'' + p.id + '\\')" style="padding:10px 16px;border-radius:8px;background:var(--accent);color:var(--bg);border:none;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;">Post</button>' +
        '</div>' +
        (cmts.length === 0 ? '<p style="color:var(--text3);text-align:center;padding:20px;">No comments yet. Be the first!</p>' :
          cmts.map(function(c) {
            const ct = new Date(c.createdAt).toLocaleString();
            return '<div style="padding:12px;background:var(--surface);border-radius:8px;margin-bottom:8px;">' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
                '<div style="width:24px;height:24px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--accent);">' + (c.displayName || 'U')[0].toUpperCase() + '</div>' +
                '<span style="font-weight:600;font-size:13px;">' + esc(c.displayName || c.username) + '</span>' +
                '<span style="font-size:11px;color:var(--text3);">' + ct + '</span>' +
              '</div>' +
              '<p style="font-size:13px;color:var(--text2);line-height:1.5;">' + esc(c.content) + '</p>' +
            '</div>';
          }).join(''));
    } catch(e) {
      document.getElementById('blogDetailContent').innerHTML = '<p style="color:var(--error);">' + e.message + '</p>';
    }
  }

  function closeBlogDetail() {
    document.getElementById('blogDetail').style.display = 'none';
    document.getElementById('blogFeed').style.display = '';
    document.getElementById('blogPagination').style.display = '';
    const wrap = document.getElementById('blogSearch').parentElement;
    if (wrap) wrap.style.display = '';
    document.getElementById('blogWriteBtn').style.display = '';
    loadBlogFeed();
  }

  async function toggleBlogLike(postId) {
    try {
      const data = await api('POST', '/v1/blog/posts/' + postId + '/like');
      const btn = document.getElementById('likeBtn-' + postId);
      const cnt = document.getElementById('likeCount-' + postId);
      if (btn) {
        btn.style.borderColor = data.liked ? 'var(--accent)' : 'var(--border)';
        btn.style.background = data.liked ? 'var(--accent-glow)' : 'var(--surface)';
        btn.style.color = data.liked ? 'var(--accent)' : 'var(--text2)';
      }
      if (cnt) cnt.textContent = data.likeCount;
      if (data.liked) toast('+1 gem to the author!', 'ok');
    } catch(e) { toast(e.message, 'err'); }
  }

  async function postComment(postId) {
    const input = document.getElementById('commentInput-' + postId);
    const content = input.value.trim();
    if (!content) return;
    try {
      await api('POST', '/v1/blog/posts/' + postId + '/comment', { content });
      input.value = '';
      toast('Comment posted! +1 gem', 'ok');
      openBlogPost(postId); // Refresh
    } catch(e) { toast(e.message, 'err'); }
  }

  async function publishBlogPost() {
    const title = document.getElementById('blogTitle').value.trim();
    const content = document.getElementById('blogContent').value.trim();
    const tags = document.getElementById('blogTags').value.trim();
    const category = document.getElementById('blogCategory').value;
    const imageUrl = document.getElementById('blogImage').value.trim();
    if (!title || !content) { toast('Title and content are required', 'err'); return; }
    try {
      await api('POST', '/v1/blog/posts', { title, content, tags, category, imageUrl, source: 'direct' });
      toast('Blog post published! +2 gems', 'ok');
      hideBlogEditor();
      loadBlogFeed();
    } catch(e) { toast(e.message, 'err'); }
  }

  // ── Post to Blog from Playground ──

  function postToBlockFromPlayground() {
    if (!hasFeature('blog_write')) {
      toast('Blog posting unlocks at Level 3 — Creator', 'err');
      return;
    }
    // Gather playground context
    const prov = document.getElementById('chatProvider')?.value || '';
    const model = document.getElementById('chatModel')?.value || '';
    const msgs = document.getElementById('chatMessages');
    const lastUserMsg = chatHistory.filter(m => m.role === 'user').pop();
    const lastAiMsg = chatHistory.filter(m => m.role === 'assistant').pop();

    lastPlaygroundData = {
      provider: (prov === 'local_llm' || prov === 'local') ? 'Local LLM' : prov,
      model: model,
      prompt: lastUserMsg?.content || '',
      response: lastAiMsg?.content || '',
    };

    document.getElementById('pgPostTitle').value = 'AI Chat: ' + (lastUserMsg?.content || '').substring(0, 60);
    document.getElementById('pgPostContent').value =
      '**Prompt:** ' + (lastUserMsg?.content || '') + '\\n\\n' +
      '**AI Response:** ' + (lastAiMsg?.content || '');
    document.getElementById('pgPostTags').value = 'ai, playground, ' + prov;
    openModal('playgroundPostModal');
  }

  async function publishFromPlayground() {
    const title = document.getElementById('pgPostTitle').value.trim();
    const content = document.getElementById('pgPostContent').value.trim();
    const tags = document.getElementById('pgPostTags').value.trim();
    const imageUrl = (document.getElementById('pgPostImage')?.value || '').trim();
    if (!title || !content) { toast('Title and content are required', 'err'); return; }
    try {
      await api('POST', '/v1/blog/posts', {
        title, content, tags, imageUrl,
        category: 'ai',
        source: 'playground',
        playgroundData: JSON.stringify(lastPlaygroundData || {}),
      });
      toast('Published to Blog from Playground! +2 gems', 'ok');
      closeModal('playgroundPostModal');
    } catch(e) { toast(e.message, 'err'); }
  }

  async function openPgGalleryPicker() {
    const grid = document.getElementById('pgGalleryPicker');
    grid.style.display = 'grid';
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:11px;">Loading...</p>';
    try {
      const d = await api('GET', '/v1/images?limit=20');
      if (!d.images || d.images.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:11px;">No images yet. Generate some in Image Studio!</p>';
        return;
      }
      grid.innerHTML = d.images.map(img =>
        '<img src="' + esc(img.imageUrl) + '" style="width:100%;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;" onclick="document.getElementById(\\'pgPostImage\\').value=\\'' + esc(img.imageUrl) + '\\';document.getElementById(\\'pgGalleryPicker\\').style.display=\\'none\\';" onmouseover="this.style.borderColor=\\'var(--accent)\\'" onmouseout="this.style.borderColor=\\'transparent\\'" title="' + esc(img.prompt) + '">'
      ).join('');
    } catch(e) { grid.innerHTML = '<p style="color:var(--red);font-size:11px;">Failed to load gallery</p>'; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ██  VOICE / STT / TTS / TRANSLATION  ██████████████████████████████████████
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Voice Input for AI Chat (multi-engine) ──
  let isListening = false;
  let chatMediaRecorder = null;
  let chatAudioChunks = [];
  let chatWebSpeech = null;
  let chatAudioStream = null;
  let chatAudioLevel = null;

  function toggleVoiceSettings() {
    const p = document.getElementById('voiceSettingsPanel');
    p.style.display = p.style.display === 'none' ? '' : 'none';
  }

  function onChatSttChange() {
    const engine = document.getElementById('chatSttEngine').value;
    const keyEl = document.getElementById('chatWhisperKey');
    keyEl.style.display = engine === 'recorder' ? '' : 'none';
    if (engine === 'whisper_wasm') {
      document.getElementById('chatVoiceStatus').textContent = whisperLoaded ? 'WASM model ready' : 'Load model in Voice Lab first';
    } else if (engine === 'webspeech') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      document.getElementById('chatVoiceStatus').textContent = SR ? 'Supported' : 'NOT supported in this browser';
    } else {
      document.getElementById('chatVoiceStatus').textContent = 'Ready';
    }
  }

  async function toggleVoiceInput() {
    if (isListening) { stopVoiceInput(); return; }
    const engine = document.getElementById('chatSttEngine')?.value || 'recorder';

    if (engine === 'webspeech') {
      await startWebSpeechSTT();
    } else if (engine === 'whisper_wasm') {
      await startWhisperWasmSTT();
    } else {
      await startRecorderSTT();
    }
  }

  // ── Engine 1: MediaRecorder → Whisper API (works everywhere) ──
  async function startRecorderSTT() {
    const key = document.getElementById('chatWhisperKey')?.value?.trim();
    if (!key) {
      toast('Enter your OpenAI API key in voice settings (gear icon) for Whisper transcription', 'err');
      toggleVoiceSettings();
      return;
    }
    try {
      chatAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e) {
      toast('Microphone access denied. Allow mic in browser settings.', 'err');
      return;
    }

    chatAudioChunks = [];
    chatMediaRecorder = new MediaRecorder(chatAudioStream, { mimeType: getMimeType() });
    chatMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chatAudioChunks.push(e.data); };
    chatMediaRecorder.onstop = async () => {
      // Stop live preview if running
      if (chatLivePreview) { try { chatLivePreview.stop(); } catch {} chatLivePreview = null; }
      chatAudioStream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chatAudioChunks, { type: chatMediaRecorder.mimeType });
      updateRecLiveText('Sending to Whisper API...');
      try {
        const base64 = await blobToBase64(blob);
        const d = await api('POST', '/v1/voice/transcribe', { audioBase64: base64, apiKey: key });
        if (d.text) {
          document.getElementById('chatInput').value = d.text;
          toast('Transcribed! (' + d.latencyMs + 'ms)', 'ok');
          if (document.getElementById('chatAutoSend')?.checked) { sendChat(); }
        } else {
          toast('No speech detected in recording', 'err');
        }
      } catch(e) { toast('Whisper error: ' + (e.error || e.message), 'err'); }
      setMicUI(false, 'Ready');
    };

    chatMediaRecorder.start();
    isListening = true;
    setMicUI(true, 'Recording... click mic to stop');
    startAudioVisualizer(chatAudioStream);
    // Start live preview with Web Speech API (best-effort, if available)
    startLivePreview();
    toast('Recording... speak now, click mic to stop & transcribe', 'ok');
  }

  // ── Engine 2: Web Speech API (Chrome/Edge only) ──
  async function startWebSpeechSTT() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Web Speech API not supported. Use "Mic Recorder + Whisper API" instead.', 'err'); return; }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioVisualizer(s);
      chatAudioStream = s;
    } catch(e) { toast('Mic access denied', 'err'); return; }

    chatWebSpeech = new SR();
    chatWebSpeech.continuous = true;
    chatWebSpeech.interimResults = true;
    chatWebSpeech.lang = 'en-US';

    chatWebSpeech.onstart = () => {
      isListening = true;
      setMicUI(true, 'Listening...');
      toast('Listening... speak now', 'ok');
    };
    chatWebSpeech.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; }
      document.getElementById('chatInput').value = text;
      updateRecLiveText(text);
    };
    chatWebSpeech.onerror = (e) => {
      console.error('WebSpeech error:', e.error);
      const msgs = { 'not-allowed': 'Mic blocked by browser', 'no-speech': 'No speech detected', 'network': 'Needs internet (use Recorder+Whisper instead)' };
      toast(msgs[e.error] || 'Voice error: ' + e.error, 'err');
      stopVoiceInput();
    };
    chatWebSpeech.onend = () => { if (isListening) { try { chatWebSpeech.start(); } catch(e) { stopVoiceInput(); } } };
    chatWebSpeech.start();
  }

  // ── Engine 3: Whisper WASM (fully offline) ──
  async function startWhisperWasmSTT() {
    if (!whisperPipeline) { toast('Load a Whisper model first in the Voice Lab page', 'err'); return; }
    try {
      chatAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e) { toast('Mic access denied', 'err'); return; }

    chatAudioChunks = [];
    chatMediaRecorder = new MediaRecorder(chatAudioStream, { mimeType: getMimeType() });
    chatMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chatAudioChunks.push(e.data); };
    chatMediaRecorder.onstop = async () => {
      if (chatLivePreview) { try { chatLivePreview.stop(); } catch {} chatLivePreview = null; }
      chatAudioStream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chatAudioChunks, { type: chatMediaRecorder.mimeType });
      updateRecLiveText('Processing with Whisper WASM...');
      try {
        const dataUrl = await blobToDataUrl(blob);
        const result = await whisperPipeline(dataUrl, { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
        if (result.text) {
          document.getElementById('chatInput').value = result.text;
          toast('Transcribed (offline)!', 'ok');
          if (document.getElementById('chatAutoSend')?.checked) { sendChat(); }
        } else { toast('No speech detected', 'err'); }
      } catch(e) { toast('Whisper WASM error: ' + e.message, 'err'); }
      setMicUI(false, 'Ready');
    };

    chatMediaRecorder.start();
    isListening = true;
    setMicUI(true, 'Recording (WASM)... click mic to stop');
    startAudioVisualizer(chatAudioStream);
    startLivePreview();
    toast('Recording... speak now, click mic to stop & transcribe offline', 'ok');
  }

  let chatLivePreview = null;

  function stopVoiceInput() {
    const wasWebSpeech = !!chatWebSpeech && !chatMediaRecorder;
    isListening = false;
    if (chatLivePreview) { try { chatLivePreview.stop(); } catch {} chatLivePreview = null; }
    if (chatWebSpeech) { try { chatWebSpeech.stop(); } catch {} chatWebSpeech = null; }
    if (chatMediaRecorder && chatMediaRecorder.state !== 'inactive') { chatMediaRecorder.stop(); return; /* onstop will handle cleanup + auto-send */ }
    if (chatAudioStream) { chatAudioStream.getTracks().forEach(t => t.stop()); chatAudioStream = null; }
    if (chatAudioLevel) { cancelAnimationFrame(chatAudioLevel); chatAudioLevel = null; }
    setMicUI(false, 'Ready');
    // For Web Speech engine, auto-send after stopping
    if (wasWebSpeech && document.getElementById('chatAutoSend')?.checked) {
      const text = document.getElementById('chatInput').value.trim();
      if (text) sendChat();
    }
  }

  // Live preview: runs Web Speech API in parallel to show what you're saying in real-time
  // (best-effort — only works in Chrome/Edge, silently does nothing otherwise)
  function startLivePreview() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // not available, skip silently
    try {
      chatLivePreview = new SR();
      chatLivePreview.continuous = true;
      chatLivePreview.interimResults = true;
      chatLivePreview.lang = 'en-US';
      chatLivePreview.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; }
        updateRecLiveText(text || 'Listening...');
      };
      chatLivePreview.onerror = () => {}; // ignore — this is just a preview
      chatLivePreview.onend = () => {
        if (isListening && chatLivePreview) { try { chatLivePreview.start(); } catch {} }
      };
      chatLivePreview.start();
    } catch(e) { /* preview is optional */ }
  }

  let recTimerInterval = null;
  let recStartTime = 0;

  function setMicUI(recording, statusText) {
    const btn = document.getElementById('voiceMicBtn');
    const banner = document.getElementById('voiceRecBanner');
    if (btn) {
      if (recording) {
        btn.style.background = 'var(--red)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--red)';
        btn.innerHTML = '&#9724;'; // stop square
      } else {
        btn.style.background = 'none'; btn.style.color = 'var(--text2)'; btn.style.borderColor = 'var(--border)';
        btn.innerHTML = '&#127908;';
        btn.style.transform = '';
      }
    }
    if (banner) {
      if (recording) {
        banner.style.display = '';
        recStartTime = Date.now();
        document.getElementById('recTimerText').textContent = '0:00';
        document.getElementById('recLiveText').textContent = 'Speak now...';
        if (recTimerInterval) clearInterval(recTimerInterval);
        recTimerInterval = setInterval(() => {
          const s = Math.floor((Date.now() - recStartTime) / 1000);
          const m = Math.floor(s / 60);
          document.getElementById('recTimerText').textContent = m + ':' + String(s % 60).padStart(2, '0');
        }, 500);
      } else {
        banner.style.display = 'none';
        if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
      }
    }
    const st = document.getElementById('chatVoiceStatus');
    if (st) st.textContent = statusText || '';
  }

  function updateRecLiveText(text) {
    const el = document.getElementById('recLiveText');
    if (el) el.textContent = text || '';
  }

  // Audio level visualizer — drives the bars in the recording banner
  function startAudioVisualizer(stream) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const bars = document.querySelectorAll('#recLevelBars .rlb');

      function tick() {
        if (!isListening) { ctx.close(); return; }
        analyser.getByteFrequencyData(freqData);
        // Map frequency bins to bars
        const step = Math.floor(freqData.length / bars.length);
        for (let i = 0; i < bars.length; i++) {
          const val = freqData[i * step] || 0;
          const h = Math.max(4, (val / 255) * 24);
          bars[i].style.height = h + 'px';
        }
        chatAudioLevel = requestAnimationFrame(tick);
      }
      tick();
    } catch(e) { /* visualizer is optional */ }
  }

  // Helpers
  function getMimeType() {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return '';
  }
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.readAsDataURL(blob);
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }

  // ── Web TTS for AI Chat ──
  function speakLastResponse() {
    const last = chatHistory.filter(m => m.role === 'assistant').pop();
    if (!last) { toast('No AI response to read', 'err'); return; }
    if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(last.content);
    u.rate = 1.0; u.pitch = 1.0;
    window.speechSynthesis.speak(u);
    toast('Speaking...', 'ok');
  }

  // ── Translation Page Logic ──
  let transRecording = false;
  let transRecognition = null;

  function setTransMode(mode) {
    document.getElementById('transTextInput').style.display = mode === 'text' ? '' : 'none';
    document.getElementById('transVoiceInput').style.display = mode === 'voice' ? '' : 'none';
    document.getElementById('transTextModeBtn').style.background = mode === 'text' ? 'var(--accent-glow)' : 'var(--surface)';
    document.getElementById('transTextModeBtn').style.color = mode === 'text' ? 'var(--accent)' : 'var(--text2)';
    document.getElementById('transVoiceModeBtn').style.background = mode === 'voice' ? 'var(--accent-glow)' : 'var(--surface)';
    document.getElementById('transVoiceModeBtn').style.color = mode === 'voice' ? 'var(--accent)' : 'var(--text2)';
  }

  let transTimerInterval = null;
  let transStartTime = 0;
  let transLivePreview = null;
  let transAudioCtx = null;
  let transAnimFrame = null;

  function showTransBanner(show) {
    const banner = document.getElementById('transRecBanner');
    if (!banner) return;
    if (show) {
      banner.style.display = '';
      transStartTime = Date.now();
      document.getElementById('transRecTimer').textContent = '0:00';
      document.getElementById('transRecLiveText').textContent = 'Speak now...';
      if (transTimerInterval) clearInterval(transTimerInterval);
      transTimerInterval = setInterval(() => {
        const s = Math.floor((Date.now() - transStartTime) / 1000);
        const m = Math.floor(s / 60);
        document.getElementById('transRecTimer').textContent = m + ':' + String(s % 60).padStart(2, '0');
      }, 500);
    } else {
      banner.style.display = 'none';
      if (transTimerInterval) { clearInterval(transTimerInterval); transTimerInterval = null; }
    }
  }

  function startTransVisualizer(stream) {
    try {
      transAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = transAudioCtx.createMediaStreamSource(stream);
      const analyser = transAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const bars = document.querySelectorAll('#transLevelBars .tlb');
      function tick() {
        if (!transRecording) { transAudioCtx.close(); transAudioCtx = null; return; }
        analyser.getByteFrequencyData(freqData);
        const step = Math.floor(freqData.length / bars.length);
        for (let i = 0; i < bars.length; i++) {
          const val = freqData[i * step] || 0;
          const h = Math.max(3, (val / 255) * 20);
          bars[i].style.height = h + 'px';
        }
        transAnimFrame = requestAnimationFrame(tick);
      }
      tick();
    } catch(e) {}
  }

  function startTransLivePreview() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      transLivePreview = new SR();
      transLivePreview.continuous = true;
      transLivePreview.interimResults = true;
      transLivePreview.lang = 'en-US';
      transLivePreview.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; }
        const el = document.getElementById('transRecLiveText');
        if (el) el.textContent = text || 'Listening...';
        document.getElementById('voiceTransInput2').value = text;
      };
      transLivePreview.onerror = () => {};
      transLivePreview.onend = () => {
        if (transRecording && transLivePreview) { try { transLivePreview.start(); } catch {} }
      };
      transLivePreview.start();
    } catch(e) {}
  }

  async function toggleTransRecording() {
    if (transRecording) { stopTransRecording(); return; }
    const engine = document.getElementById('transSttEngine').value;

    // Request mic permission first (for all engines)
    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      toast('Microphone access denied. Allow mic in browser settings.', 'err');
      return;
    }

    if (engine === 'web') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { micStream.getTracks().forEach(t => t.stop()); toast('Web Speech API not supported. Try Chrome or Edge.', 'err'); return; }

      transRecognition = new SR();
      transRecognition.continuous = true; transRecognition.interimResults = true; transRecognition.lang = 'en-US';
      transRecognition.onstart = () => { toast('Listening...', 'ok'); };
      transRecognition.onresult = (e) => {
        let final = ''; let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) { final += t; } else { interim += t; }
        }
        document.getElementById('voiceTransInput2').value = final + interim;
        const el = document.getElementById('transRecLiveText');
        if (el) el.textContent = (final + interim) || 'Listening...';
      };
      transRecognition.onerror = (e) => {
        if (e.error === 'no-speech') { toast('No speech detected. Try again.', 'err'); }
        else if (e.error === 'network') { toast('Network error — Web Speech API requires internet.', 'err'); }
        else { toast('STT error: ' + e.error, 'err'); }
        stopTransRecording();
      };
      transRecognition.onend = () => {
        if (transRecording) { try { transRecognition.start(); } catch(e) { stopTransRecording(); } }
      };
      transRecognition.start();
      transRecording = true;
      showTransBanner(true);
      startTransVisualizer(micStream);
      // For web speech, we don't need a separate live preview; the recognition itself feeds live text
    } else if (engine === 'whisper_wasm') {
      if (!whisperPipeline) { micStream.getTracks().forEach(t => t.stop()); toast('Load a Whisper model first (see Local Whisper section below)', 'err'); return; }
      startWhisperWasmForTranslation(micStream);
      return;
    } else {
      micStream.getTracks().forEach(t => t.stop());
      toast('For Whisper cloud, use the record button in the Whisper section below', 'err');
      return;
    }
    const btn = document.getElementById('transRecBtn');
    btn.style.background = 'var(--red)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--red)';
    document.getElementById('transRecStatus').textContent = 'Listening... click to stop';
  }

  // Whisper WASM recording for the translation voice input
  let transWhisperRecorder = null;
  let transWhisperChunks = [];
  async function startWhisperWasmForTranslation(stream) {
    try {
      if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      transWhisperChunks = [];
      transWhisperRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      transWhisperRecorder.ondataavailable = (e) => { if (e.data.size > 0) transWhisperChunks.push(e.data); };
      transWhisperRecorder.onstop = async () => {
        if (transLivePreview) { try { transLivePreview.stop(); } catch {} transLivePreview = null; }
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(transWhisperChunks, { type: 'audio/webm' });
        document.getElementById('transRecStatus').textContent = 'Processing with Whisper WASM...';
        const el = document.getElementById('transRecLiveText');
        if (el) el.textContent = 'Processing with Whisper WASM...';
        try {
          const reader = new FileReader();
          const audioUrl = await new Promise((resolve) => { reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
          const result = await whisperPipeline(audioUrl, { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
          document.getElementById('voiceTransInput2').value = result.text || '';
          document.getElementById('transRecStatus').textContent = 'Transcription complete (Whisper WASM)';
          toast('Whisper WASM transcription done!', 'ok');
        } catch(e) { toast('Whisper error: ' + e.message, 'err'); document.getElementById('transRecStatus').textContent = 'Error: ' + e.message; }
        stopTransRecording();
      };
      transWhisperRecorder.start();
      transRecording = true;
      showTransBanner(true);
      startTransVisualizer(stream);
      startTransLivePreview();
      const btn = document.getElementById('transRecBtn');
      btn.style.background = 'var(--red)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--red)';
      document.getElementById('transRecStatus').textContent = 'Recording with Whisper WASM... click to stop';
      document.getElementById('transRecLang').textContent = 'Using local Whisper model (offline)';
    } catch(e) { toast('Microphone access denied: ' + e.message, 'err'); }
  }

  function stopTransRecording() {
    if (transLivePreview) { try { transLivePreview.stop(); } catch {} transLivePreview = null; }
    if (transRecognition) { try { transRecognition.stop(); } catch {} }
    if (transWhisperRecorder && transWhisperRecorder.state !== 'inactive') { transWhisperRecorder.stop(); }
    if (transAnimFrame) { cancelAnimationFrame(transAnimFrame); transAnimFrame = null; }
    transRecording = false;
    showTransBanner(false);
    const btn = document.getElementById('transRecBtn');
    btn.style.background = 'var(--surface)'; btn.style.color = 'var(--accent)'; btn.style.borderColor = 'var(--accent)';
    document.getElementById('transRecStatus').textContent = 'Click mic to start recording';
    document.getElementById('transRecLang').textContent = 'Select an engine above';
  }

  function onTransProviderChange() {
    const provider = document.getElementById('voiceTransProvider').value;
    const isLocal = provider === 'local_llm';
    const isKaggle = provider === 'kaggle';
    document.getElementById('voiceTransKeyGroup').style.display = (isLocal || isKaggle) ? 'none' : '';
    document.getElementById('kaggleTransPanel').style.display = isKaggle ? '' : 'none';
    document.getElementById('localLlmTransHint').style.display = isLocal ? 'flex' : 'none';
    if (isLocal) {
      const status = document.getElementById('localLlmTransStatus');
      if (localEngine && localModelLoaded) {
        status.innerHTML = '<span style="color:var(--green);">&#10003; Local model loaded and ready!</span> Translation runs entirely in your browser — no API key needed, fully offline.';
      } else {
        status.innerHTML = '<span style="color:var(--orange);">&#9888; No local model loaded.</span> Go to <a href="#" onclick="nav(&quot;chat&quot;);return false;" style="color:var(--accent);">AI Chat</a> → select "Local LLM" provider → Download & Load a model. Then come back here.';
      }
    }
    saveVoiceSettings();
  }

  // ── Voice settings persistence ──
  function saveVoiceSettings() {
    try {
      localStorage.setItem('cfl_voice_settings', JSON.stringify({
        provider: document.getElementById('voiceTransProvider').value,
        apiKey: document.getElementById('voiceTransKey').value,
        kaggleUrl: document.getElementById('voiceKaggleUrl').value,
      }));
    } catch(e) {}
  }

  function loadVoiceSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem('cfl_voice_settings') || '{}');
      if (saved.provider) document.getElementById('voiceTransProvider').value = saved.provider;
      if (saved.apiKey) document.getElementById('voiceTransKey').value = saved.apiKey;
      if (saved.kaggleUrl) document.getElementById('voiceKaggleUrl').value = saved.kaggleUrl;
      if (saved.provider) onTransProviderChange();
    } catch(e) {}
  }

  async function doTranslate() {
    const provider = document.getElementById('voiceTransProvider').value;
    const srcLang = document.getElementById('voiceTransSrc').value;
    const tgtLang = document.getElementById('voiceTransTgt').value;
    const textMode = document.getElementById('transTextInput').style.display !== 'none';
    const text = textMode ? document.getElementById('voiceTransInput').value.trim() : document.getElementById('voiceTransInput2').value.trim();

    if (!text) { toast('Enter or speak some text to translate', 'err'); return; }

    const btn = document.getElementById('translateBtn');
    btn.innerHTML = 'Translating...'; btn.disabled = true;

    try {
      if (provider === 'local_llm') {
        // ── Local LLM translation (in-browser, no server round-trip) ──
        if (!localEngine || !localModelLoaded) {
          toast('Load a local model in AI Chat first', 'err');
          btn.innerHTML = 'Translate'; btn.disabled = false;
          return;
        }
        const sourceLabel = srcLang ? 'from ' + srcLang + ' ' : '';
        const systemPrompt = 'You are a translator. Translate text and output ONLY the translation. Rules: 1) Output ONLY the translated sentence. 2) Do NOT add URLs, links, explanations, notes, or anything extra. 3) Do NOT repeat yourself. 4) Keep it short and accurate.';
        const userMsg = 'Translate ' + sourceLabel + 'to ' + tgtLang + ': ' + text;
        const startTime = Date.now();
        try { await localEngine.resetChat(); } catch(rc) {}
        const reply = await localEngine.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.1,
          max_tokens: 256,
          stream: false,
          stop: ['\\n\\n', 'Enlace', 'http', 'https', 'Link:', 'Note:', 'Explanation:'],
        });
        var translated = reply.choices[0]?.message?.content?.trim() || '';
        // Post-process: strip hallucinated URLs, repeated lines, and garbage
        translated = translated.split('\\n').filter(function(line) {
          if (line.match(/^(Enlace|Link|URL|http|Note|Explanation|Respuesta|Response)/i)) return false;
          if (line.trim() === '') return false;
          return true;
        })[0] || translated.split('\\n')[0] || '';
        translated = translated.replace(/https?:\\/\\/\\S+/g, '').trim();
        if (!translated) throw new Error('Local model could not translate. Try a cloud provider (Groq is free) for better results.');
        const latency = Date.now() - startTime;
        document.getElementById('transResult').style.display = '';
        document.getElementById('transResultText').textContent = translated;
        document.getElementById('transResultMeta').innerHTML =
          'Provider: <strong>Local LLM (WebLLM)</strong> | Offline | ' + latency + 'ms' +
          '<br><span style="color:var(--text3);font-size:11px;">Tip: Small local models may produce poor translations. For best results, use Groq (free) or another cloud provider.</span>';
        toast('Translation complete (offline)!', 'ok');
      } else if (provider === 'kaggle') {
        // ── Kaggle / Ollama translation (via server, no API key) ──
        var kaggleUrl = document.getElementById('voiceKaggleUrl').value.trim();
        if (!kaggleUrl) { toast('Enter your Kaggle ngrok URL', 'err'); btn.innerHTML = 'Translate'; btn.disabled = false; return; }
        var d = await api('POST', '/v1/translate/text', {
          text, sourceLang: srcLang, targetLang: tgtLang, provider: 'kaggle', apiKey: 'ollama',
          model: 'llama3.2:3b', baseUrl: kaggleUrl,
          sourceType: textMode ? 'text' : 'voice',
        });
        document.getElementById('transResult').style.display = '';
        document.getElementById('transResultText').textContent = d.translatedText;
        document.getElementById('transResultMeta').innerHTML =
          'Provider: <strong>Kaggle / Ollama</strong> | Model: <strong>' + esc(d.model) + '</strong> | ' + d.latencyMs + 'ms';
        toast('Translation complete (Kaggle)!', 'ok');
      } else {
        // ── Cloud provider translation (via server) ──
        const apiKey = document.getElementById('voiceTransKey').value.trim();
        if (!apiKey) { toast('Enter your API key', 'err'); btn.innerHTML = 'Translate'; btn.disabled = false; return; }
        const d = await api('POST', '/v1/translate/text', {
          text, sourceLang: srcLang, targetLang: tgtLang, provider, apiKey,
          sourceType: textMode ? 'text' : 'voice',
        });
        document.getElementById('transResult').style.display = '';
        document.getElementById('transResultText').textContent = d.translatedText;
        document.getElementById('transResultMeta').innerHTML =
          'Provider: <strong>' + esc(d.provider) + '</strong> | Model: <strong>' + esc(d.model) + '</strong> | ' + d.latencyMs + 'ms';
        toast('Translation complete!', 'ok');
      }
    } catch(e) { toast('Translation failed: ' + (e.error || e.message || e), 'err'); }
    btn.innerHTML = 'Translate'; btn.disabled = false;
  }

  async function detectLang() {
    const provider = document.getElementById('voiceTransProvider').value;
    if (provider === 'local_llm') {
      if (!localEngine || !localModelLoaded) { toast('Load a local model in AI Chat first', 'err'); return; }
      const textMode = document.getElementById('transTextInput').style.display !== 'none';
      const text = textMode ? document.getElementById('voiceTransInput').value.trim() : document.getElementById('voiceTransInput2').value.trim();
      if (!text) { toast('Enter text first', 'err'); return; }
      try {
        try { await localEngine.resetChat(); } catch(rc) {}
        const reply = await localEngine.chat.completions.create({
          messages: [
            { role: 'system', content: 'Identify the language of the given text. Respond with ONLY the language name (e.g. "English", "Spanish"). Nothing else.' },
            { role: 'user', content: text },
          ],
          temperature: 0, max_tokens: 20, stream: false,
        });
        toast('Detected: ' + (reply.choices[0]?.message?.content?.trim() || 'Unknown'), 'ok');
      } catch(e) { toast('Detection failed: ' + e.message, 'err'); }
      return;
    }
    const textMode = document.getElementById('transTextInput').style.display !== 'none';
    const text = textMode ? document.getElementById('voiceTransInput').value.trim() : document.getElementById('voiceTransInput2').value.trim();
    if (!text) { toast('Enter text first', 'err'); return; }

    if (provider === 'kaggle') {
      var kaggleUrl = document.getElementById('voiceKaggleUrl').value.trim();
      if (!kaggleUrl) { toast('Enter your Kaggle ngrok URL', 'err'); return; }
      try {
        var d = await api('POST', '/v1/translate/detect', { text, provider: 'kaggle', apiKey: 'ollama', baseUrl: kaggleUrl });
        toast('Detected: ' + d.language + ' (confidence: ' + d.confidence + ')', 'ok');
      } catch(e) { toast('Detection failed: ' + (e.message || e), 'err'); }
      return;
    }

    const apiKey = document.getElementById('voiceTransKey').value.trim();
    if (!apiKey) { toast('Need API key', 'err'); return; }
    try {
      const d = await api('POST', '/v1/translate/detect', { text, provider, apiKey });
      toast('Detected: ' + d.language + ' (confidence: ' + d.confidence + ')', 'ok');
    } catch(e) { toast('Detection failed: ' + (e.message || e), 'err'); }
  }

  function speakTransResult() {
    const text = document.getElementById('transResultText').textContent;
    if (!text) return;
    if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }

  function copyTransResult() {
    const text = document.getElementById('transResultText').textContent;
    navigator.clipboard.writeText(text).then(() => toast('Copied!', 'ok')).catch(() => toast('Copy failed', 'err'));
  }

  // ── Translation History ──
  async function loadTranslationHistory() {
    const el = document.getElementById('transHistory');
    if (!el) return;
    el.innerHTML = '<p style="color:var(--text3);text-align:center;">Loading...</p>';
    try {
      const d = await api('GET', '/v1/translate/history?limit=20');
      if (!d.translations || d.translations.length === 0) {
        el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px;">No translations yet. Use the translation tool above!</p>';
        return;
      }
      el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + d.translations.map(t =>
        '<div class="card" style="padding:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:start;">' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:12px;color:var(--text3);margin-bottom:4px;">' + esc(t.sourceLanguage || 'Auto') + ' &rarr; ' + esc(t.targetLanguage) + ' &middot; ' + esc(t.provider) + ' &middot; ' + new Date(t.createdAt).toLocaleString() + (t.sourceType === 'voice' ? ' &middot; &#127908;' : '') + '</div>' +
              '<div style="font-size:13px;color:var(--text2);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(t.sourceText.substring(0, 100)) + '</div>' +
              '<div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(t.translatedText.substring(0, 100)) + '</div>' +
            '</div>' +
            '<button onclick="deleteTransHistory(\\'' + t.id + '\\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:4px;">&times;</button>' +
          '</div>' +
        '</div>'
      ).join('') + '</div>';
    } catch(e) { el.innerHTML = '<p style="color:var(--red);text-align:center;">Failed to load history</p>'; }
  }

  async function deleteTransHistory(id) {
    try {
      await api('DELETE', '/v1/translate/history/' + id);
      toast('Deleted', 'ok');
      loadTranslationHistory();
    } catch(e) { toast('Delete failed', 'err'); }
  }

  // ── TTS Demo ──
  function onTtsEngineChange() {
    const engine = document.getElementById('ttsEngine').value;
    document.getElementById('ttsKeyGroup').style.display = engine === 'elevenlabs' ? '' : 'none';
    populateTtsVoices();
  }

  function populateTtsVoices() {
    const sel = document.getElementById('ttsVoice');
    const engine = document.getElementById('ttsEngine').value;
    if (engine === 'web') {
      const voices = window.speechSynthesis.getVoices();
      sel.innerHTML = voices.map(v => '<option value="' + v.name + '">' + v.name + ' (' + v.lang + ')</option>').join('');
      if (voices.length === 0) {
        sel.innerHTML = '<option value="">Loading voices...</option>';
        window.speechSynthesis.onvoiceschanged = () => populateTtsVoices();
      }
    } else {
      sel.innerHTML = '<option value="21m00Tcm4TlvDq8ikWAM">Rachel</option><option value="EXAVITQu4vr4xnSDxMaL">Bella</option><option value="ErXwobaYiN019PkySvjV">Antoni</option><option value="MF3mGyEYCl7XYWbV9V6O">Elli</option>';
    }
  }

  async function speakTtsDemo() {
    const engine = document.getElementById('ttsEngine').value;
    const text = document.getElementById('ttsText').value.trim();
    if (!text) { toast('Enter some text', 'err'); return; }

    if (engine === 'web') {
      const u = new SpeechSynthesisUtterance(text);
      const voiceName = document.getElementById('ttsVoice').value;
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find(x => x.name === voiceName);
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } else {
      const key = document.getElementById('ttsElevenKey').value.trim();
      if (!key) { toast('Enter ElevenLabs API key', 'err'); return; }
      const voiceId = document.getElementById('ttsVoice').value;
      try {
        toast('Generating speech...', 'ok');
        const d = await api('POST', '/v1/voice/tts/elevenlabs', { text, apiKey: key, voiceId });
        const audio = new Audio('data:audio/mpeg;base64,' + d.audioBase64);
        audio.play();
      } catch(e) { toast('TTS failed: ' + (e.error || e.message || e), 'err'); }
    }
  }

  function stopTts() { window.speechSynthesis.cancel(); }

  // Initialize TTS voices on page load
  if (typeof window !== 'undefined') { setTimeout(populateTtsVoices, 500); }

  // ── Whisper WASM (via @huggingface/transformers) ──
  let whisperPipeline = null;
  let whisperLoaded = false;
  let whisperRecording = false;
  let whisperMediaRecorder = null;
  let whisperChunks = [];

  async function loadWhisperWasm() {
    const modelId = document.getElementById('whisperModel').value;
    const btn = document.getElementById('whisperLoadBtn');
    const progress = document.getElementById('whisperProgress');
    const status = document.getElementById('whisperStatus');

    btn.disabled = true; btn.innerHTML = 'Loading...';
    progress.style.display = '';
    status.textContent = 'Importing transformers library...';

    try {
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
      status.textContent = 'Downloading model: ' + modelId + '...';
      document.getElementById('whisperProgressBar').style.width = '30%';
      document.getElementById('whisperProgressText').textContent = 'Downloading model files...';

      whisperPipeline = await pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q8',
        device: 'wasm',
      });

      whisperLoaded = true;
      progress.style.display = 'none';
      status.textContent = 'Model loaded: ' + modelId;
      status.style.color = 'var(--green)';
      btn.innerHTML = 'Model Loaded';
      document.getElementById('whisperRecBtn').style.display = '';
      toast('Whisper model loaded!', 'ok');
    } catch(e) {
      status.textContent = 'Load failed: ' + e.message;
      status.style.color = 'var(--red)';
      btn.disabled = false; btn.innerHTML = 'Retry Download';
      progress.style.display = 'none';
      toast('Whisper load failed: ' + e.message, 'err');
    }
  }

  async function toggleWhisperRec() {
    if (whisperRecording) { stopWhisperRec(); return; }
    if (!whisperPipeline) { toast('Load a model first', 'err'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      whisperChunks = [];
      whisperMediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      whisperMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) whisperChunks.push(e.data); };
      whisperMediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(whisperChunks, { type: 'audio/webm' });
        await processWhisperAudio(blob);
      };
      whisperMediaRecorder.start();
      whisperRecording = true;
      const btn = document.getElementById('whisperRecBtn');
      btn.innerHTML = '&#9724; Stop'; btn.style.background = 'var(--red)'; btn.style.color = '#fff';
      document.getElementById('whisperStatus').textContent = 'Recording...';
    } catch(e) { toast('Microphone access denied: ' + e.message, 'err'); }
  }

  function stopWhisperRec() {
    if (whisperMediaRecorder && whisperMediaRecorder.state !== 'inactive') {
      whisperMediaRecorder.stop();
    }
    whisperRecording = false;
    const btn = document.getElementById('whisperRecBtn');
    btn.innerHTML = '&#127908; Record'; btn.style.background = ''; btn.style.color = '';
    document.getElementById('whisperStatus').textContent = 'Processing...';
  }

  async function processWhisperAudio(blob) {
    try {
      const task = document.getElementById('whisperTask').value;
      // Convert blob to audio data URL
      const reader = new FileReader();
      const audioUrl = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const result = await whisperPipeline(audioUrl, {
        task: task,
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      const text = result.text || '';
      document.getElementById('whisperResult').style.display = '';
      document.getElementById('whisperResultText').textContent = text;
      document.getElementById('whisperStatus').textContent = 'Done! Task: ' + task;

      // Also populate translation input if on voice tab
      const vi2 = document.getElementById('voiceTransInput2');
      if (vi2) vi2.value = text;

      toast('Whisper ' + task + ' complete!', 'ok');
    } catch(e) {
      document.getElementById('whisperStatus').textContent = 'Error: ' + e.message;
      toast('Whisper error: ' + e.message, 'err');
    }
  }

  // ── System Prompts Page ──
  async function loadSystemPrompts() {
    const el = document.getElementById('promptsList');
    if (!el) return;
    el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px;"><span class="spinner"></span> Loading system prompts...</p>';
    try {
      const d = await api('GET', '/v1/system-prompts');
      const prompts = d.prompts || [];
      if (prompts.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;">' +
          '<p style="color:var(--text3);margin-bottom:12px;">No system prompts found. They may not have been seeded yet.</p>' +
          '<p style="font-size:12px;color:var(--text3);">Try restarting the server, or they will be created on next server boot.</p>' +
        '</div>';
        return;
      }
      el.innerHTML = prompts.map(function(p) {
        const wordCount = (p.content || '').split(/\\s+/).filter(Boolean).length;
        return '<div class="card" style="margin-bottom:16px;padding:18px;" id="prompt-card-' + esc(p.key) + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">' +
            '<div>' +
              '<h3 style="font-weight:700;font-size:16px;margin:0;">' + esc(p.label) + '</h3>' +
              '<span style="font-size:11px;color:var(--text3);">Key: <code>' + esc(p.key) + '</code> | v' + (p.version || 1) + ' | ' + (p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Not updated') + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button class="btn-small" onclick="saveSystemPrompt(\\'' + esc(p.key) + '\\')">&#128190; Save</button>' +
              '<button class="btn-small" style="color:var(--orange);" onclick="resetSystemPrompt(\\'' + esc(p.key) + '\\')">&#8635; Reset</button>' +
            '</div>' +
          '</div>' +
          '<textarea class="form-input" id="prompt-editor-' + esc(p.key) + '" rows="10" style="font-family:monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;">' + esc(p.content) + '</textarea>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:6px;">' + wordCount + ' words</div>' +
        '</div>';
      }).join('');
    } catch(e) {
      const msg = e.message || e.error || String(e);
      el.innerHTML = '<div style="text-align:center;padding:40px;">' +
        '<p style="color:var(--red);margin-bottom:8px;">Failed to load system prompts</p>' +
        '<p style="font-size:12px;color:var(--text3);">' + esc(msg) + '</p>' +
        (msg.includes('403') || msg.includes('permission') ? '<p style="font-size:12px;color:var(--orange);margin-top:8px;">This page requires admin or super_admin role.</p>' : '') +
      '</div>';
    }
  }

  async function saveSystemPrompt(key) {
    const content = document.getElementById('prompt-editor-' + key)?.value;
    if (!content || content.length < 10) { toast('Prompt must be at least 10 characters', 'err'); return; }
    try {
      await api('PUT', '/v1/system-prompts/' + key, { content });
      toast('Prompt saved!', 'ok');
      loadSystemPrompts();
    } catch(e) { toast('Save failed: ' + (e.message || e), 'err'); }
  }

  async function resetSystemPrompt(key) {
    if (!confirm('Reset "' + key + '" to default?')) return;
    try {
      await api('POST', '/v1/system-prompts/' + key + '/reset');
      toast('Prompt reset to default', 'ok');
      loadSystemPrompts();
    } catch(e) { toast('Reset failed: ' + (e.message || e), 'err'); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ██  IMAGE STUDIO  █████████████████████████████████████████████████████████
  // ═══════════════════════════════════════════════════════════════════════════

  const IMG_MODELS = {
    openai: ['dall-e-3', 'dall-e-2'],
    stability: ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-v1-6'],
    bfl: ['flux-pro-1.1', 'flux-dev', 'flux-pro'],
    replicate: ['black-forest-labs/flux-schnell', 'black-forest-labs/flux-dev', 'stability-ai/sdxl'],
    fal: ['fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro/v1.1'],
  };

  let lastGenImageUrl = '';
  let lastGenImageBase64 = '';
  let lastGenPrompt = '';
  let lastGenProvider = '';
  let lastGenModel = '';

  function onImgProviderChange() {
    const prov = document.getElementById('imgProvider').value;
    const modelSel = document.getElementById('imgModel');
    const models = IMG_MODELS[prov] || [];
    modelSel.innerHTML = models.map(m => '<option value="' + m + '">' + m + '</option>').join('');
  }

  async function generateImage() {
    const prov = document.getElementById('imgProvider').value;
    const key = document.getElementById('imgApiKey').value.trim();
    const model = document.getElementById('imgModel').value;
    const prompt = document.getElementById('imgPrompt').value.trim();
    const negativePrompt = document.getElementById('imgNegPrompt').value.trim();
    const width = parseInt(document.getElementById('imgWidth').value) || 1024;
    const height = parseInt(document.getElementById('imgHeight').value) || 1024;
    const stepsVal = document.getElementById('imgSteps').value;
    const steps = stepsVal ? parseInt(stepsVal) : undefined;

    if (!prov) { toast('Select a provider', 'err'); return; }
    if (!key) { toast('Enter your API key', 'err'); return; }
    if (!prompt) { toast('Enter a prompt', 'err'); return; }

    const btn = document.getElementById('imgGenBtn');
    btn.innerHTML = 'Generating...';
    btn.disabled = true;

    try {
      const body = { provider: prov, apiKey: key, model, prompt, negativePrompt, width, height };
      if (steps) body.steps = steps;
      const d = await api('POST', '/v1/control-panel/image', body);

      lastGenImageUrl = d.imageUrl || '';
      lastGenImageBase64 = d.imageBase64 || '';
      lastGenPrompt = prompt;
      lastGenProvider = prov;
      lastGenModel = d.model || model;

      const imgEl = document.getElementById('imgResultImg');
      imgEl.src = d.imageUrl || d.imageBase64 || '';
      document.getElementById('imgResult').style.display = '';
      document.getElementById('imgResultMeta').innerHTML =
        'Provider: <strong>' + esc(prov) + '</strong> | Model: <strong>' + esc(d.model || model) + '</strong> | ' + d.latencyMs + 'ms';

      toast('Image generated!', 'ok');
    } catch(e) {
      toast('Generation failed: ' + (e.error || e.message || e), 'err');
    }
    btn.innerHTML = 'Generate Image';
    btn.disabled = false;
  }

  async function saveToGallery() {
    if (!lastGenImageUrl && !lastGenImageBase64) { toast('No image to save', 'err'); return; }
    try {
      const d = await api('POST', '/v1/images/upload', {
        imageUrl: lastGenImageUrl || undefined,
        imageBase64: lastGenImageBase64 || undefined,
        prompt: lastGenPrompt,
        provider: lastGenProvider,
        model: lastGenModel,
        width: parseInt(document.getElementById('imgWidth').value) || 1024,
        height: parseInt(document.getElementById('imgHeight').value) || 1024,
      });
      toast('Saved to gallery!', 'ok');
      // Update the displayed image to use the permanent URL
      if (d.image?.imageUrl) {
        lastGenImageUrl = d.image.imageUrl;
        document.getElementById('imgResultImg').src = d.image.imageUrl;
      }
      loadImageGallery();
    } catch(e) { toast('Save failed: ' + (e.message || e), 'err'); }
  }

  function useInBlogPost() {
    const url = lastGenImageUrl || lastGenImageBase64;
    if (!url) { toast('No image to use', 'err'); return; }
    // Switch to blog section and pre-fill image
    nav('blog');
    showBlogEditor();
    document.getElementById('blogImage').value = url;
    previewBlogImage();
    toast('Image added to blog editor', 'ok');
  }

  function downloadGenImage() {
    const url = lastGenImageUrl || lastGenImageBase64;
    if (!url) { toast('No image to download', 'err'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-' + Date.now() + '.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  let imgGalleryPage = 1;
  async function loadImageGallery() {
    const gallery = document.getElementById('imgGallery');
    if (!gallery) return;
    gallery.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text3);">Loading...</p>';
    try {
      const d = await api('GET', '/v1/images?page=' + imgGalleryPage + '&limit=12');
      if (!d.images || d.images.length === 0) {
        gallery.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text3);padding:30px;">No images yet. Generate your first image above!</p>';
        document.getElementById('imgGalleryPagination').innerHTML = '';
        return;
      }
      gallery.innerHTML = d.images.map(img =>
        '<div style="position:relative;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);background:var(--surface2);aspect-ratio:1;">' +
          '<img src="' + esc(img.imageUrl) + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.parentElement.innerHTML=\\'<div style=padding:20px;text-align:center;color:var(--text3);font-size:11px>Image unavailable</div>\\'">' +
          '<div style="position:absolute;bottom:0;left:0;right:0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,0.85));font-size:11px;">' +
            '<div style="color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(img.prompt) + '">' + esc(img.prompt.substring(0, 40)) + '</div>' +
            '<div style="color:rgba(255,255,255,0.6);font-size:10px;margin-top:2px;">' + esc(img.provider) + ' &middot; ' + new Date(img.createdAt).toLocaleDateString() + '</div>' +
          '</div>' +
          '<div style="position:absolute;top:4px;right:4px;display:flex;gap:4px;">' +
            '<button onclick="event.stopPropagation();useGalleryImage(\\'' + esc(img.imageUrl) + '\\')" style="background:rgba(0,0,0,0.7);border:none;color:#fff;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;" title="Use in blog">Blog</button>' +
            '<button onclick="event.stopPropagation();deleteGalleryImage(\\'' + img.id + '\\')" style="background:rgba(239,68,68,0.8);border:none;color:#fff;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;" title="Delete">&times;</button>' +
          '</div>' +
        '</div>'
      ).join('');

      // Pagination
      const pg = d.pagination;
      if (pg.totalPages > 1) {
        let btns = '';
        for (let i = 1; i <= pg.totalPages; i++) {
          btns += '<button onclick="imgGalleryPage=' + i + ';loadImageGallery()" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:' + (i === pg.page ? 'var(--accent)' : 'var(--surface)') + ';color:' + (i === pg.page ? 'var(--bg)' : 'var(--text2)') + ';cursor:pointer;font-size:12px;">' + i + '</button>';
        }
        document.getElementById('imgGalleryPagination').innerHTML = btns;
      } else {
        document.getElementById('imgGalleryPagination').innerHTML = '';
      }
    } catch(e) {
      gallery.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--red);">Failed to load gallery</p>';
    }
  }

  function useGalleryImage(url) {
    nav('blog');
    showBlogEditor();
    document.getElementById('blogImage').value = url;
    previewBlogImage();
    toast('Image added to blog editor', 'ok');
  }

  async function deleteGalleryImage(id) {
    if (!confirm('Delete this image?')) return;
    try {
      await api('DELETE', '/v1/images/' + id);
      toast('Image deleted', 'ok');
      loadImageGallery();
    } catch(e) { toast('Delete failed: ' + (e.message || e), 'err'); }
  }

  // ── Blog Image Helpers ──

  function previewBlogImage() {
    const url = document.getElementById('blogImage').value.trim();
    const preview = document.getElementById('blogImagePreview');
    const img = document.getElementById('blogImagePreviewImg');
    if (url) {
      img.src = url;
      img.onerror = function() { preview.style.display = 'none'; };
      preview.style.display = '';
    } else {
      preview.style.display = 'none';
    }
  }

  function openBlogImageGen() {
    document.getElementById('blogInlineGen').style.display = '';
    document.getElementById('blogGalleryPicker').style.display = 'none';
  }

  function closeBlogInlineGen() {
    document.getElementById('blogInlineGen').style.display = 'none';
  }

  async function generateBlogImage() {
    const prov = document.getElementById('blogGenProvider').value;
    const key = document.getElementById('blogGenKey').value.trim();
    const prompt = document.getElementById('blogGenPrompt').value.trim();
    if (!key) { toast('Enter API key', 'err'); return; }
    if (!prompt) { toast('Enter a prompt', 'err'); return; }

    const btn = document.getElementById('blogGenBtn');
    btn.innerHTML = 'Generating...'; btn.disabled = true;
    try {
      const d = await api('POST', '/v1/control-panel/image', {
        provider: prov, apiKey: key, prompt, width: 1024, height: 1024,
      });
      const imgUrl = d.imageUrl || d.imageBase64 || '';
      // Save to gallery automatically so we get a permanent URL
      const saved = await api('POST', '/v1/images/upload', {
        imageUrl: d.imageUrl || undefined,
        imageBase64: d.imageBase64 || undefined,
        prompt, provider: prov, model: d.model || '',
      });
      const permanentUrl = saved.image?.imageUrl || imgUrl;
      document.getElementById('blogImage').value = permanentUrl;
      previewBlogImage();
      closeBlogInlineGen();
      toast('Image generated and saved!', 'ok');
    } catch(e) {
      toast('Generation failed: ' + (e.error || e.message || e), 'err');
    }
    btn.innerHTML = 'Generate'; btn.disabled = false;
  }

  async function openBlogImageGallery() {
    document.getElementById('blogGalleryPicker').style.display = '';
    document.getElementById('blogInlineGen').style.display = 'none';
    const grid = document.getElementById('blogGalleryGrid');
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:11px;">Loading...</p>';
    try {
      const d = await api('GET', '/v1/images?limit=20');
      if (!d.images || d.images.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:11px;">No images. Generate some in Image Studio!</p>';
        return;
      }
      grid.innerHTML = d.images.map(img =>
        '<img src="' + esc(img.imageUrl) + '" style="width:100%;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;" ' +
        'onclick="document.getElementById(\\'blogImage\\').value=\\'' + esc(img.imageUrl) + '\\';previewBlogImage();closeBlogGalleryPicker();" ' +
        'onmouseover="this.style.borderColor=\\'var(--accent)\\'" onmouseout="this.style.borderColor=\\'transparent\\'" ' +
        'title="' + esc(img.prompt) + '" loading="lazy">'
      ).join('');
    } catch(e) {
      grid.innerHTML = '<p style="color:var(--red);font-size:11px;">Failed to load</p>';
    }
  }

  function closeBlogGalleryPicker() {
    document.getElementById('blogGalleryPicker').style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ██  P2P CHAT SYSTEM  ██████████████████████████████████████████████████████
  // ═══════════════════════════════════════════════════════════════════════════

  let activeConvoId = null;
  let activeConvoOther = null;
  let p2pPollingTimer = null;
  let selectedChatUserId = null;

  // Store conversation data by ID for clean click handling
  let convoDataMap = {};

  async function loadConversations() {
    const list = document.getElementById('convoList');
    try {
      const data = await api('GET', '/v1/chat/conversations');
      if (!data.conversations || data.conversations.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;"><p>No conversations yet.</p><p style="margin-top:6px;">Start chatting!</p></div>';
        return;
      }
      // Store all convo data in a lookup map
      convoDataMap = {};
      data.conversations.forEach(function(c) { convoDataMap[c.id] = c.otherUser || {}; });

      list.innerHTML = data.conversations.map(function(c) {
        const other = c.otherUser || {};
        const time = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const unread = c.unreadCount || 0;
        const isActive = activeConvoId === c.id;
        return '<div class="convo-item' + (isActive ? ' active' : '') + '" data-cid="' + esc(c.id) + '" data-uid="' + esc(other.id || '') + '" onclick="openConversationById(this.dataset.cid)" style="padding:10px 12px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:2px;transition:all 0.15s;">' +
          '<div style="position:relative;flex-shrink:0;">' +
            '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;">' + (other.displayName || other.username || '?')[0].toUpperCase() + '</div>' +
            '<span class="status-dot offline convo-status-dot" data-uid="' + esc(other.id || '') + '" style="position:absolute;bottom:-1px;right:-1px;"></span>' +
          '</div>' +
          '<div style="flex:1;overflow:hidden;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">' + esc(other.displayName || other.username || 'User') + '</span>' +
              '<span class="convo-online-label online-badge is-offline" data-uid="' + esc(other.id || '') + '">offline</span>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">' + esc((c.lastMessageText && c.lastMessageText.startsWith('[signal]')) ? 'Start chatting...' : (c.lastMessageText || 'Start chatting...')) + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-size:10px;color:var(--text3);">' + time + '</div>' +
            (unread > 0 ? '<div style="background:var(--accent);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:2px 7px;margin-top:4px;display:inline-block;min-width:18px;text-align:center;">' + unread + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
      // Update online status dots in sidebar
      refreshConvoStatusDots();
    } catch(e) {
      if (e.message && (e.message.includes('CHAT_LOCKED') || e.message.includes('Level 10'))) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;"><p>&#128274;</p><p>Earn your way here.</p></div>';
      } else {
        list.innerHTML = '<p style="color:var(--error);padding:12px;font-size:12px;">' + (e.message || e) + '</p>';
      }
    }
  }

  function openConversationById(convoId) {
    const other = convoDataMap[convoId] || {};
    openConversation(convoId, other);
  }

  async function openConversation(convoId, otherData) {
    activeConvoId = convoId;
    activeConvoOther = (typeof otherData === 'string') ? (function() { try { return JSON.parse(otherData); } catch(e) { return {}; } })() : (otherData || {});

    // Update header
    var name = activeConvoOther.displayName || activeConvoOther.username || '?';
    document.getElementById('chatHeaderAvatar').textContent = name[0].toUpperCase();
    document.getElementById('chatHeaderName').textContent = name;
    document.getElementById('chatHeaderStatus').textContent = 'Checking...';
    document.getElementById('chatHeaderDot').className = 'status-dot offline';

    // Start heartbeat (sends our own online status)
    startHeartbeat();

    // Check other user's online status
    updateChatHeaderStatus();

    // Load messages
    await loadMessages();
    loadConversations(); // Refresh sidebar to show active

    // Start message polling + signal polling
    stopP2PPolling();
    p2pPollingTimer = setInterval(loadMessages, 3000);
    startSignalPolling();
  }

  async function loadMessages() {
    if (!activeConvoId) return;
    const container = document.getElementById('p2pMessages');
    try {
      const data = await api('GET', '/v1/chat/conversations/' + activeConvoId + '/messages?limit=50');
      // Filter out any signal messages that leaked through (WebRTC signaling data)
      const msgs = (data.messages || []).filter(function(m) {
        if (m.contentType === 'signal') return false;
        if (m.content && typeof m.content === 'string' && m.content.startsWith('[signal]')) return false;
        return true;
      });

      if (msgs.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:40px;"><p>No messages yet. Say hello!</p></div>';
        return;
      }

      const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      container.innerHTML = msgs.map(function(m) {
        const isMine = m.senderId === user?.id;
        const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Content — handle image messages
        let contentHtml = '';
        if (m.contentType === 'image' && m.imageUrl) {
          contentHtml = '<img src="' + esc(m.imageUrl) + '" style="max-width:200px;max-height:200px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)" alt="Shared image">';
          if (m.content && m.content !== '[image]') contentHtml += '<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;margin-top:6px;">' + esc(m.content) + '</div>';
        } else {
          contentHtml = '<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">' + esc(m.content) + '</div>';
        }

        // AI indicators (show on ALL messages, not just received)
        let aiIndicators = '';
        if (m.toneFlag && m.toneFlag !== 'neutral') {
          const toneColors = { angry: 'var(--red)', happy: 'var(--green)', sad: '#6366f1', frustrated: 'var(--orange)', sarcastic: '#f59e0b', anxious: '#8b5cf6' };
          const toneEmoji = { angry: '&#128545;', happy: '&#128522;', sad: '&#128546;', frustrated: '&#128553;', sarcastic: '&#128527;', anxious: '&#128552;' }[m.toneFlag] || '&#128172;';
          const tColor = toneColors[m.toneFlag] || 'var(--text3)';
          aiIndicators += '<div style="font-size:10px;color:' + tColor + ';margin-top:4px;">' + toneEmoji + ' ' + m.toneFlag + (m.toneSuggestion ? ' — ' + esc(m.toneSuggestion) : '') + '</div>';
        }
        // Moderation warning
        if (m.moderationFlag) {
          aiIndicators += '<div style="font-size:10px;color:var(--red);margin-top:3px;">&#9888; Flagged: ' + esc(m.moderationFlag) + '</div>';
        }
        if (m.schedulingDetected === true || m.schedulingDetected === 'true') {
          let schedText = '';
          try { const sd = JSON.parse(m.schedulingData); schedText = sd.suggestion || ''; } catch(e) {}
          aiIndicators += '<div style="font-size:10px;color:var(--accent);margin-top:3px;">&#128197; ' + (schedText || 'Scheduling detected') + '</div>';
        }
        if (m.language && m.language !== 'en') {
          aiIndicators += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">&#127760; ' + m.language + '</div>';
        }

        // Translate button — available for all messages (both sent and received)
        const msgId = 'msg-' + m.id;
        const canTranslate = hasFeature('ai_translate') || (localEngine && localModelLoaded);
        const translateBtn = canTranslate
          ? '<button onclick="translateP2PMsg(this, document.getElementById(\\'' + msgId + '\\').dataset.text)" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--text3);cursor:pointer;margin-right:4px;">&#127760; Translate</button>'
          : '';

        const timeColor = isMine ? 'rgba(255,255,255,0.45)' : 'var(--text3)';

        return '<div id="' + msgId + '" data-text="' + esc(m.content.replace(/"/g, '')) + '" style="display:flex;justify-content:' + (isMine ? 'flex-end' : 'flex-start') + ';animation:msgIn 0.2s ease;">' +
          '<div style="max-width:72%;padding:10px 14px;border-radius:' + (isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + ';background:' + (isMine ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'var(--surface2)') + ';color:' + (isMine ? '#fff' : 'var(--text)') + ';box-shadow:0 1px 3px rgba(0,0,0,0.15);">' +
            contentHtml +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;gap:6px;">' +
              '<div style="display:flex;gap:2px;">' + translateBtn + '</div>' +
              '<span style="font-size:10px;color:' + timeColor + ';white-space:nowrap;">' + time + '</span>' +
            '</div>' +
            aiIndicators +
          '</div>' +
        '</div>';
      }).join('');

      if (wasAtBottom) container.scrollTop = container.scrollHeight;
    } catch(e) {
      container.innerHTML = '<p style="color:var(--error);padding:20px;">' + e.message + '</p>';
    }
  }

  async function translateP2PMsg(btn, text) {
    btn.textContent = 'Translating...'; btn.disabled = true;
    try {
      let translatedText = '';
      // Try local LLM first if loaded
      if (localEngine && localModelLoaded) {
        try { await localEngine.resetChat(); } catch(rc) {}
        const reply = await localEngine.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a translator. Translate text to English. Output ONLY the translated sentence. No URLs, no links, no explanations, no repetition.' },
            { role: 'user', content: 'Translate to English: ' + text },
          ],
          temperature: 0.1, max_tokens: 256, stream: false,
          stop: ['\\n\\n', 'Enlace', 'http', 'https', 'Link:', 'Note:'],
        });
        var rawTranslation = reply.choices[0]?.message?.content?.trim() || '';
        // Strip hallucinated URLs and garbage lines
        rawTranslation = rawTranslation.split('\\n').filter(function(l) {
          return !l.match(/^(Enlace|Link|URL|http|Note|Explanation|Respuesta)/i) && l.trim();
        })[0] || rawTranslation.split('\\n')[0] || '';
        translatedText = rawTranslation.replace(/https?:\\/\\/\\S+/g, '').trim();
      } else {
        // Fall back to cloud or Kaggle API
        var provider = document.getElementById('voiceTransProvider')?.value || 'openai';
        if (provider === 'kaggle') {
          var kaggleUrl = document.getElementById('voiceKaggleUrl')?.value?.trim() || document.getElementById('chatKaggleUrl')?.value?.trim();
          if (!kaggleUrl) { toast('Enter your Kaggle ngrok URL in Voice Lab or AI Chat', 'err'); btn.textContent = 'Translate'; btn.disabled = false; return; }
          var d = await api('POST', '/v1/translate/text', {
            text, targetLang: 'English', provider: 'kaggle', apiKey: 'ollama', baseUrl: kaggleUrl, saveHistory: false,
          });
          translatedText = d.translatedText;
        } else {
          var apiKey = document.getElementById('voiceTransKey')?.value?.trim();
          if (!apiKey) { toast('Load a local model in AI Chat, or set an API key in Voice Lab', 'err'); btn.textContent = 'Translate'; btn.disabled = false; return; }
          var d = await api('POST', '/v1/translate/text', {
            text, targetLang: 'English', provider, apiKey, saveHistory: false,
          });
          translatedText = d.translatedText;
        }
      }
      var translated = document.createElement('div');
      translated.style.cssText = 'font-size:11px;color:var(--accent);margin-top:4px;font-style:italic;';
      translated.textContent = '🌐 ' + translatedText;
      btn.parentElement.appendChild(translated);
      btn.style.display = 'none';
    } catch(e) {
      toast('Translation failed: ' + (e.error || e.message), 'err');
      btn.textContent = 'Translate'; btn.disabled = false;
    }
  }

  function stopP2PPolling() {
    if (p2pPollingTimer) { clearInterval(p2pPollingTimer); p2pPollingTimer = null; }
  }

  let p2pImageData = null; // base64 image data if sharing
  let p2pMicRec = null;

  async function sendP2PMessage() {
    if (!activeConvoId) { toast('Select a conversation first', 'err'); return; }
    const input = document.getElementById('p2pInput');
    const content = input.value.trim();
    const hasImage = !!p2pImageData;

    if (!content && !hasImage) return;

    input.value = '';
    input.style.height = 'auto';
    const btn = document.getElementById('p2pSendBtn');
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span>'; btn.disabled = true;

    try {
      const payload = {
        content: content || (hasImage ? '[image]' : ''),
        contentType: hasImage ? 'image' : 'text',
      };
      if (hasImage) payload.imageUrl = p2pImageData;
      await api('POST', '/v1/chat/conversations/' + activeConvoId + '/messages', payload);
      clearP2PImage();
      await loadMessages();
      const container = document.getElementById('p2pMessages');
      container.scrollTop = container.scrollHeight;
    } catch(e) { toast(e.error || e.message, 'err'); }
    btn.textContent = 'Send'; btn.disabled = false;
  }

  function p2pShareImage() {
    document.getElementById('p2pImageFile').click();
  }

  function onP2PImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)', 'err'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      p2pImageData = reader.result;
      document.getElementById('p2pImageThumb').src = reader.result;
      document.getElementById('p2pImageName').textContent = file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
      document.getElementById('p2pImagePreview').style.display = '';
    };
    reader.readAsDataURL(file);
  }

  function clearP2PImage() {
    p2pImageData = null;
    document.getElementById('p2pImagePreview').style.display = 'none';
    document.getElementById('p2pImageFile').value = '';
  }

  // P2P Voice input
  function toggleP2PMic() {
    if (p2pMicRec) {
      p2pMicRec.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Web Speech not supported. Use Chrome/Edge.', 'err'); return; }
    p2pMicRec = new SR();
    p2pMicRec.continuous = true;
    p2pMicRec.interimResults = true;
    p2pMicRec.lang = 'en-US';
    p2pMicRec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      document.getElementById('p2pInput').value = text;
    };
    p2pMicRec.onerror = () => { p2pMicRec = null; document.getElementById('p2pMicBtn').style.color = 'var(--text3)'; };
    p2pMicRec.onend = () => { p2pMicRec = null; document.getElementById('p2pMicBtn').style.color = 'var(--text3)'; };
    p2pMicRec.start();
    document.getElementById('p2pMicBtn').style.color = 'var(--red)';
    toast('Listening... click mic again to stop', 'ok');
  }

  // ── New Chat ──
  function showNewChatModal() {
    selectedChatUserId = null;
    document.getElementById('chatUserSearch').value = '';
    document.getElementById('firstMessage').value = '';
    document.getElementById('startChatBtn').disabled = true;
    document.getElementById('chatUserList').innerHTML = '<p style="color:var(--text3);padding:12px;font-size:12px;">Search for a user to chat with.</p>';
    openModal('newChatModal');
    searchChatUsers();
  }

  async function searchChatUsers() {
    const search = document.getElementById('chatUserSearch').value.trim();
    const list = document.getElementById('chatUserList');
    try {
      const data = await api('GET', '/v1/chat/users/available?search=' + encodeURIComponent(search));
      if (!data.users || data.users.length === 0) {
        list.innerHTML = '<p style="color:var(--text3);padding:12px;font-size:12px;">No users found.</p>';
        return;
      }
      list.innerHTML = data.users.map(function(u) {
        return '<div onclick="selectChatUser(\\'' + u.id + '\\', \\'' + esc(u.displayName || u.username) + '\\')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;border:2px solid ' + (selectedChatUserId === u.id ? 'var(--accent)' : 'transparent') + ';" onmouseover="this.style.background=\\'var(--surface2)\\'" onmouseout="this.style.background=\\'transparent\\'">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--bg);">' + (u.displayName || u.username || '?')[0].toUpperCase() + '</div>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:600;font-size:13px;">' + esc(u.displayName || u.username) + '</div>' +
            '<div style="font-size:11px;color:var(--text3);">' + u.totalGemsEarned + ' gems' + (u.hasChatAccess ? '' : ' · &#128274; No chat access yet') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e) { list.innerHTML = '<p style="color:var(--error);font-size:12px;">' + e.message + '</p>'; }
  }

  function selectChatUser(userId, name) {
    selectedChatUserId = userId;
    document.getElementById('startChatBtn').disabled = false;
    searchChatUsers(); // Re-render to show selection
  }

  async function startNewConversation() {
    if (!selectedChatUserId) return;
    const msg = document.getElementById('firstMessage').value.trim();
    if (!msg) { toast('Write a first message', 'err'); return; }
    try {
      const data = await api('POST', '/v1/chat/conversations', { targetUserId: selectedChatUserId, message: msg });
      closeModal('newChatModal');
      toast(data.isNew ? 'Conversation started! +3 gems' : 'Message sent!', 'ok');
      activeConvoId = data.conversation.id;
      loadConversations();
      openConversation(data.conversation.id, {});
    } catch(e) { toast(e.message, 'err'); }
  }

  function filterConversations() { loadConversations(); }

  // ── AI Tools ──
  function toggleAiPanel() {
    const panel = document.getElementById('aiToolsPanel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
  }

  async function aiToneCheck() {
    const text = document.getElementById('p2pInput').value.trim();
    if (!text) { toast('Type a message first', 'err'); return; }
    const result = document.getElementById('aiToolResult');
    result.style.display = '';
    result.innerHTML = '<span class="spinner"></span> Analyzing tone...';
    try {
      let data;
      // Try local LLM for tone analysis if loaded
      if (localEngine && localModelLoaded) {
        try { await localEngine.resetChat(); } catch(rc) {}
        const reply = await localEngine.chat.completions.create({
          messages: [
            { role: 'system', content: 'Analyze the emotional tone of the given message. Respond with ONLY a JSON object: {"tone": "angry|happy|sad|frustrated|sarcastic|neutral", "suggestion": "brief advice if needed, empty string if neutral/happy"}. Nothing else.' },
            { role: 'user', content: text },
          ],
          temperature: 0.1, max_tokens: 100, stream: false,
        });
        try {
          const parsed = JSON.parse(reply.choices[0]?.message?.content?.trim() || '{}');
          data = { flag: parsed.tone || 'neutral', suggestion: parsed.suggestion || '' };
        } catch(pe) {
          data = await api('POST', '/v1/chat/ai/tone-check', { text });
        }
      } else {
        data = await api('POST', '/v1/chat/ai/tone-check', { text });
      }
      const emoji = { angry: '&#128545;', happy: '&#128522;', sad: '&#128546;', neutral: '&#128578;', frustrated: '&#128553;', sarcastic: '&#128527;', anxious: '&#128552;' }[data.flag] || '&#128578;';
      const color = { angry: 'var(--red)', frustrated: 'var(--orange)', sarcastic: '#f59e0b', sad: '#6366f1', happy: 'var(--green)' }[data.flag] || 'var(--text)';
      result.innerHTML = emoji + ' <strong style="color:' + color + ';">Tone: ' + (data.flag || 'neutral') + '</strong>' + (data.suggestion ? '<br><span style="font-size:11px;color:var(--text3);">' + esc(data.suggestion) + '</span>' : '');
    } catch(e) { result.innerHTML = 'Error: ' + e.message; }
  }

  async function aiScheduleDetect() {
    const text = document.getElementById('p2pInput').value.trim();
    if (!text) { toast('Type a message first', 'err'); return; }
    const result = document.getElementById('aiToolResult');
    result.style.display = '';
    result.innerHTML = 'Checking for scheduling...';
    try {
      const data = await api('POST', '/v1/chat/ai/schedule-detect', { text });
      if (data.detected) {
        const sd = JSON.parse(data.data || '{}');
        result.innerHTML = '&#128197; <strong>Scheduling detected!</strong><br>' + (sd.suggestion || sd.matchedText || '');
      } else {
        result.innerHTML = 'No scheduling intent detected in this message.';
      }
    } catch(e) { result.innerHTML = 'Error: ' + e.message; }
  }

  // ═══════════════════════════════════════════════════════════
  //  GLOBAL FLOATING VOICE-TO-TEXT WIDGET
  // ═══════════════════════════════════════════════════════════
  let gvOpen = false;
  let gvRecording = false;
  let gvRecognition = null;
  let gvStream = null;
  let gvAudioCtx = null;
  let gvAnimFrame = null;
  let gvTimerInt = null;
  let gvStartTime = 0;
  let gvFullText = '';

  function toggleGlobalVoice() {
    gvOpen = !gvOpen;
    const panel = document.getElementById('globalVoicePanel');
    const fab = document.getElementById('globalVoiceFab');
    if (gvOpen) {
      panel.style.display = '';
      fab.style.background = 'var(--red)';
      fab.innerHTML = '&#10005;';
    } else {
      if (gvRecording) stopGvRecording();
      panel.style.display = 'none';
      fab.style.background = 'linear-gradient(135deg,var(--accent),#8b5cf6)';
      fab.innerHTML = '&#127908;';
    }
  }

  async function toggleGvRecording() {
    if (gvRecording) { stopGvRecording(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Web Speech API not supported. Use Chrome or Edge.', 'err'); return; }

    // Request mic permission
    try {
      gvStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e) {
      toast('Microphone access denied', 'err');
      document.getElementById('gvStatus').textContent = 'Mic access denied — check browser settings';
      return;
    }

    gvRecognition = new SR();
    gvRecognition.continuous = true;
    gvRecognition.interimResults = true;
    gvRecognition.lang = 'en-US';
    gvFullText = '';

    gvRecognition.onresult = (e) => {
      let final = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      gvFullText = final;
      const display = (final + (interim ? '<span style="color:var(--text3);">' + interim + '</span>' : '')) || '<span style="color:var(--text3);font-style:italic;">Listening...</span>';
      document.getElementById('gvTranscript').innerHTML = display;
      // Auto-scroll
      const el = document.getElementById('gvTranscript');
      el.scrollTop = el.scrollHeight;
    };

    gvRecognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        document.getElementById('gvStatus').textContent = 'No speech detected — try again';
      } else if (e.error === 'not-allowed') {
        document.getElementById('gvStatus').textContent = 'Mic blocked — check browser settings';
        stopGvRecording();
      }
    };

    gvRecognition.onend = () => {
      if (gvRecording) { try { gvRecognition.start(); } catch(e) { stopGvRecording(); } }
    };

    gvRecognition.start();
    gvRecording = true;

    // UI updates
    const btn = document.getElementById('gvMicBtn');
    btn.style.background = 'var(--red)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--red)';
    btn.innerHTML = '&#9724;';
    document.getElementById('gvBars').style.display = 'flex';
    document.getElementById('gvTimer').style.display = '';
    document.getElementById('gvTranscript').style.display = '';
    document.getElementById('gvTranscript').innerHTML = '<span style="color:var(--text3);font-style:italic;">Listening... speak now</span>';
    document.getElementById('gvStatus').textContent = 'Recording — click stop when done';

    // Timer
    gvStartTime = Date.now();
    document.getElementById('gvTimerText').textContent = '0:00';
    gvTimerInt = setInterval(() => {
      const s = Math.floor((Date.now() - gvStartTime) / 1000);
      document.getElementById('gvTimerText').textContent = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
    }, 500);

    // Audio visualizer
    startGvVisualizer(gvStream);
  }

  function startGvVisualizer(stream) {
    try {
      gvAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = gvAudioCtx.createMediaStreamSource(stream);
      const analyser = gvAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const bars = document.querySelectorAll('#gvBars .gvb');
      function tick() {
        if (!gvRecording) { gvAudioCtx.close(); gvAudioCtx = null; return; }
        analyser.getByteFrequencyData(freqData);
        const step = Math.max(1, Math.floor(freqData.length / bars.length));
        for (let i = 0; i < bars.length; i++) {
          const val = freqData[i * step] || 0;
          const h = Math.max(4, (val / 255) * 32);
          bars[i].style.height = h + 'px';
        }
        gvAnimFrame = requestAnimationFrame(tick);
      }
      tick();
    } catch(e) {}
  }

  function stopGvRecording() {
    gvRecording = false;
    if (gvRecognition) { try { gvRecognition.stop(); } catch {} gvRecognition = null; }
    if (gvStream) { gvStream.getTracks().forEach(t => t.stop()); gvStream = null; }
    if (gvAnimFrame) { cancelAnimationFrame(gvAnimFrame); gvAnimFrame = null; }
    if (gvTimerInt) { clearInterval(gvTimerInt); gvTimerInt = null; }

    const btn = document.getElementById('gvMicBtn');
    btn.style.background = 'var(--surface2)'; btn.style.color = 'var(--accent)'; btn.style.borderColor = 'var(--accent)';
    btn.innerHTML = '&#127908;';
    document.getElementById('gvBars').style.display = 'none';
    document.getElementById('gvTimer').style.display = 'none';
    document.getElementById('gvStatus').textContent = gvFullText ? 'Done! Copy or paste your text.' : 'Click the mic to start';
  }

  function gvCopy() {
    const text = gvFullText || document.getElementById('gvTranscript').textContent;
    if (!text) { toast('Nothing to copy', 'err'); return; }
    navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard!', 'ok')).catch(() => toast('Copy failed', 'err'));
  }

  function gvClear() {
    gvFullText = '';
    document.getElementById('gvTranscript').innerHTML = '<span style="color:var(--text3);font-style:italic;">Transcribed text will appear here...</span>';
    document.getElementById('gvAiResponse').style.display = 'none';
    document.getElementById('gvAiResponse').innerHTML = '';
    document.getElementById('gvStatus').textContent = 'Cleared. Click mic to start again.';
  }

  function gvPaste() {
    const text = gvFullText || document.getElementById('gvTranscript').textContent;
    if (!text) { toast('Nothing to paste', 'err'); return; }
    // Try to paste into the most relevant visible input
    const targets = [
      document.getElementById('chatInput'),
      document.getElementById('voiceTransInput'),
      document.getElementById('voiceTransInput2'),
      document.querySelector('.page[style*="display: block"] textarea'),
      document.querySelector('.page[style*="display: block"] input[type="text"]'),
    ];
    for (const el of targets) {
      if (el && el.offsetParent !== null) {
        el.value = (el.value ? el.value + ' ' : '') + text;
        el.focus();
        toast('Pasted into input field!', 'ok');
        return;
      }
    }
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(text).then(() => toast('No visible input found — copied to clipboard instead', 'ok'));
  }

  async function gvAskLLM() {
    const text = gvFullText || document.getElementById('gvTranscript').textContent?.trim();
    if (!text) { toast('Speak or type something first', 'err'); return; }
    const respEl = document.getElementById('gvAiResponse');
    respEl.style.display = '';
    respEl.innerHTML = '<span style="color:var(--text3);font-style:italic;">Thinking...</span>';
    document.getElementById('gvStatus').textContent = 'Asking AI...';

    try {
      let aiText = '';
      if (localEngine && localModelLoaded) {
        // Use local LLM (offline)
        try { await localEngine.resetChat(); } catch(rc) {}
        const reply = await localEngine.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Respond concisely and clearly.' },
            { role: 'user', content: text },
          ],
          temperature: 0.7, max_tokens: 1024, stream: false,
        });
        aiText = reply.choices[0]?.message?.content?.trim() || 'No response';
        document.getElementById('gvStatus').textContent = 'Response from Local LLM (offline)';
      } else {
        // Try cloud API if configured in chat page
        const prov = document.getElementById('chatProvider')?.value;
        const key = document.getElementById('chatKey')?.value?.trim();
        if (prov && prov !== 'local' && key) {
          const model = document.getElementById('chatModel')?.value || undefined;
          const d = await api('POST', '/v1/control-panel/chat', {
            provider: prov, model, apiKey: key,
            messages: [{ role: 'user', content: text }], maxTokens: 1024,
          });
          aiText = d.content || 'No response';
          document.getElementById('gvStatus').textContent = 'Response from ' + prov;
        } else {
          respEl.innerHTML = '<span style="color:var(--orange);">No AI available. Load a local model in AI Chat, or configure a cloud provider with API key.</span>';
          document.getElementById('gvStatus').textContent = 'No AI configured';
          return;
        }
      }
      respEl.textContent = aiText;
    } catch(e) {
      respEl.innerHTML = '<span style="color:var(--red);">Error: ' + esc(e.message || String(e)) + '</span>';
      document.getElementById('gvStatus').textContent = 'AI request failed';
    }
  }

  async function gvTranslate() {
    const text = gvFullText || document.getElementById('gvTranscript').textContent?.trim();
    if (!text) { toast('Speak or type something first', 'err'); return; }
    const respEl = document.getElementById('gvAiResponse');
    respEl.style.display = '';
    respEl.innerHTML = '<span style="color:var(--text3);font-style:italic;">Translating...</span>';
    document.getElementById('gvStatus').textContent = 'Translating...';

    try {
      let translated = '';
      if (localEngine && localModelLoaded) {
        try { await localEngine.resetChat(); } catch(rc) {}
        const reply = await localEngine.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a translator. Translate text to English. Output ONLY the translated sentence. No URLs, no links, no explanations, no repetition.' },
            { role: 'user', content: 'Translate to English: ' + text },
          ],
          temperature: 0.1, max_tokens: 256, stream: false,
          stop: ['\\n\\n', 'Enlace', 'http', 'https', 'Link:', 'Note:'],
        });
        var rawGvTranslation = reply.choices[0]?.message?.content?.trim() || '';
        rawGvTranslation = rawGvTranslation.split('\\n').filter(function(l) {
          return !l.match(/^(Enlace|Link|URL|http|Note|Explanation|Respuesta)/i) && l.trim();
        })[0] || rawGvTranslation.split('\\n')[0] || '';
        translated = rawGvTranslation.replace(/https?:\\/\\/\\S+/g, '').trim() || 'No translation';
        document.getElementById('gvStatus').textContent = 'Translated (Local LLM, offline)';
      } else {
        var provider = document.getElementById('voiceTransProvider')?.value || 'openai';
        if (provider === 'kaggle') {
          var kaggleUrl = document.getElementById('voiceKaggleUrl')?.value?.trim() || document.getElementById('chatKaggleUrl')?.value?.trim();
          if (!kaggleUrl) {
            respEl.innerHTML = '<span style="color:var(--orange);">Enter your Kaggle ngrok URL in Voice Lab or AI Chat.</span>';
            document.getElementById('gvStatus').textContent = 'No translator configured';
            return;
          }
          var d = await api('POST', '/v1/translate/text', {
            text, targetLang: 'English', provider: 'kaggle', apiKey: 'ollama', baseUrl: kaggleUrl, saveHistory: false,
          });
          translated = d.translatedText;
          document.getElementById('gvStatus').textContent = 'Translated via Kaggle / Ollama';
        } else {
          var apiKey = document.getElementById('voiceTransKey')?.value?.trim();
          if (!apiKey) {
            respEl.innerHTML = '<span style="color:var(--orange);">No AI available. Load a local model in AI Chat, or set an API key in Voice Lab.</span>';
            document.getElementById('gvStatus').textContent = 'No translator configured';
            return;
          }
          var d = await api('POST', '/v1/translate/text', {
            text, targetLang: 'English', provider, apiKey, saveHistory: false,
          });
          translated = d.translatedText;
          document.getElementById('gvStatus').textContent = 'Translated via ' + provider;
        }
      }
      respEl.innerHTML = '<strong style="color:var(--accent);">Translation:</strong> ' + esc(translated);
    } catch(e) {
      respEl.innerHTML = '<span style="color:var(--red);">Translation failed: ' + esc(e.message || String(e)) + '</span>';
      document.getElementById('gvStatus').textContent = 'Translation failed';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  ONLINE STATUS & HEARTBEAT
  // ═══════════════════════════════════════════════════════════
  let heartbeatTimer = null;
  let statusRefreshTimer = null;
  let onlineStatusCache = {}; // userId -> { online, lastChecked }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, 25000); // every 25s
    // Also start periodic status refresh for other users
    startStatusRefresh();
  }
  function sendHeartbeat() {
    api('PUT', '/v1/chat/heartbeat').catch(function(){});
  }
  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    stopStatusRefresh();
  }
  function startStatusRefresh() {
    if (statusRefreshTimer) return;
    statusRefreshTimer = setInterval(function() {
      // Clear cache so we get fresh data
      onlineStatusCache = {};
      refreshConvoStatusDots();
      updateChatHeaderStatus();
    }, 15000); // refresh every 15s
  }
  function stopStatusRefresh() {
    if (statusRefreshTimer) { clearInterval(statusRefreshTimer); statusRefreshTimer = null; }
  }

  async function checkUserOnline(uid) {
    if (!uid) return false;
    var c = onlineStatusCache[uid];
    if (c && Date.now() - c.lastChecked < 15000) return c.online;
    try {
      var d = await api('GET', '/v1/chat/users/' + uid + '/status');
      var isOnline = !!d.online;
      onlineStatusCache[uid] = { online: isOnline, lastSeen: d.lastSeen, lastChecked: Date.now() };
      return isOnline;
    } catch(e) { return false; }
  }

  function formatLastSeen(ts) {
    if (!ts) return 'Offline';
    var d = new Date(ts);
    var diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Online';
    if (diff < 3600000) return 'Last seen ' + Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return 'Last seen ' + Math.floor(diff/3600000) + 'h ago';
    return 'Last seen ' + d.toLocaleDateString();
  }

  async function refreshConvoStatusDots() {
    var dots = document.querySelectorAll('.convo-status-dot');
    for (var i = 0; i < dots.length; i++) {
      var uid = dots[i].getAttribute('data-uid');
      if (uid) {
        (function(dot, userId) {
          checkUserOnline(userId).then(function(isOnline) {
            dot.className = 'status-dot convo-status-dot ' + (isOnline ? 'online' : 'offline');
            // Also update the online badge next to the username
            var labels = document.querySelectorAll('.convo-online-label[data-uid="' + userId + '"]');
            for (var j = 0; j < labels.length; j++) {
              labels[j].className = 'convo-online-label online-badge ' + (isOnline ? 'is-online' : 'is-offline');
              labels[j].textContent = isOnline ? 'online' : 'offline';
            }
          });
        })(dots[i], uid);
      }
    }
  }

  async function updateChatHeaderStatus() {
    if (!activeConvoOther?.id) return;
    var uid = activeConvoOther.id;
    var isOnline = await checkUserOnline(uid);
    var dot = document.getElementById('chatHeaderDot');
    var statusEl = document.getElementById('chatHeaderStatus');
    if (dot) {
      dot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
    }
    if (statusEl) {
      var cached = onlineStatusCache[uid];
      statusEl.textContent = isOnline ? 'Online' : formatLastSeen(cached?.lastSeen);
      statusEl.style.color = isOnline ? 'var(--green)' : 'var(--text3)';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  WebRTC VOICE / VIDEO CALLING (Full Implementation)
  // ═══════════════════════════════════════════════════════════
  let p2pCallPeer = null;
  let p2pCallStream = null;
  let p2pCallActive = false;
  let p2pCallTimerInt = null;
  let p2pCallStart = 0;
  let p2pCallMuted = false;
  let p2pSignalPollTimer = null;
  let p2pLastSignalTime = '';
  let p2pIncomingSignal = null; // Stored incoming offer while ringing
  let p2pIncomingConvoId = null;
  let p2pIncomingCallerName = '';
  let p2pRingTimer = null;
  let p2pRingStart = 0;
  let p2pCallWithVideo = false;

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    // Free TURN servers from Open Relay Project (metered.ca)
    { urls: 'turn:global.relay.metered.ca:80', username: 'e8dd65b92f22baab5a1eb891', credential: 'uTwKVoMtVB3MU/Vy' },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'e8dd65b92f22baab5a1eb891', credential: 'uTwKVoMtVB3MU/Vy' },
    { urls: 'turn:global.relay.metered.ca:443', username: 'e8dd65b92f22baab5a1eb891', credential: 'uTwKVoMtVB3MU/Vy' },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'e8dd65b92f22baab5a1eb891', credential: 'uTwKVoMtVB3MU/Vy' },
  ];

  // ── Start outgoing call ──
  async function startP2PCall(withVideo) {
    if (!activeConvoId || !activeConvoOther) { toast('Select a conversation first', 'err'); return; }
    if (p2pCallActive) { toast('Already in a call', 'err'); return; }

    try {
      p2pCallStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
    } catch(e) {
      toast('Camera/mic access denied: ' + e.message, 'err');
      return;
    }

    p2pCallWithVideo = withVideo;
    p2pCallActive = true;

    // Show call overlay with "Calling..." state
    var overlay = document.getElementById('p2pCallOverlay');
    overlay.style.display = 'flex';
    var callerName = activeConvoOther.displayName || activeConvoOther.username || 'User';
    document.getElementById('callAvatarBig').textContent = callerName.charAt(0).toUpperCase();
    document.getElementById('p2pCallName').textContent = callerName;
    document.getElementById('p2pCallStatus').textContent = (withVideo ? 'Video' : 'Voice') + ' call — Ringing...';
    document.getElementById('p2pCallTimer').style.display = 'none';

    if (withVideo) {
      var lv = document.getElementById('p2pLocalVideo');
      lv.srcObject = p2pCallStream;
      lv.style.display = '';
    }

    // Create peer connection
    p2pCallPeer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    p2pCallStream.getTracks().forEach(function(track) { p2pCallPeer.addTrack(track, p2pCallStream); });

    p2pCallPeer.ontrack = function(event) {
      var rv = document.getElementById('p2pRemoteVideo');
      rv.srcObject = event.streams[0];
      rv.style.display = '';
      document.getElementById('p2pCallStatus').textContent = 'Connected';
      startCallTimer();
    };

    p2pCallPeer.onicecandidate = function(event) {
      if (event.candidate) {
        sendSignal(activeConvoId, { type: 'ice', candidate: event.candidate });
      }
    };

    p2pCallPeer.onconnectionstatechange = function() {
      if (p2pCallPeer && (p2pCallPeer.connectionState === 'disconnected' || p2pCallPeer.connectionState === 'failed')) {
        toast('Call disconnected', 'err');
        endP2PCall();
      }
    };

    // Create and send offer
    try {
      var offer = await p2pCallPeer.createOffer();
      await p2pCallPeer.setLocalDescription(offer);
      await sendSignal(activeConvoId, { type: 'call_offer', sdp: offer.sdp, video: withVideo, callerName: user?.displayName || user?.username || 'Someone' });
      toast('Calling ' + callerName + '...', 'ok');
    } catch(e) {
      toast('Call setup failed: ' + e.message, 'err');
      endP2PCall();
    }
  }

  // ── Signal polling (runs when user is on P2P page) ──
  function startSignalPolling() {
    stopSignalPolling();
    p2pLastSignalTime = new Date().toISOString();
    pollSignals();
    p2pSignalPollTimer = setInterval(pollSignals, 2000); // poll every 2s
  }
  function stopSignalPolling() {
    if (p2pSignalPollTimer) { clearInterval(p2pSignalPollTimer); p2pSignalPollTimer = null; }
  }

  async function pollSignals() {
    if (!activeConvoId) return;
    try {
      var d = await api('GET', '/v1/chat/conversations/' + activeConvoId + '/signals?since=' + encodeURIComponent(p2pLastSignalTime));
      var sigs = d.signals || [];
      for (var i = 0; i < sigs.length; i++) {
        var m = sigs[i];
        p2pLastSignalTime = m.createdAt || p2pLastSignalTime;
        try {
          var sig = JSON.parse(m.content);
          await handleSignal(sig, m.senderName || 'User');
        } catch(e) {}
      }
    } catch(e) {}
    // Also update online status
    updateChatHeaderStatus();
  }

  async function handleSignal(sig, senderName) {
    if (sig.type === 'call_offer' && !p2pCallActive && !p2pIncomingSignal) {
      // ── Incoming call! (Global poller may have already caught this) ──
      p2pIncomingSignal = sig;
      p2pIncomingConvoId = activeConvoId;
      p2pIncomingCallerName = sig.callerName || senderName || 'Unknown';
      showIncomingCall(p2pIncomingCallerName, sig.video);
    } else if (sig.type === 'call_answer' && p2pCallPeer && p2pCallActive) {
      // ── Remote answered our call ──
      try {
        await p2pCallPeer.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sig.sdp }));
        document.getElementById('p2pCallStatus').textContent = 'Connecting...';
      } catch(e) {}
    } else if (sig.type === 'ice' && p2pCallPeer) {
      try {
        await p2pCallPeer.addIceCandidate(new RTCIceCandidate(sig.candidate));
      } catch(e) {}
    } else if (sig.type === 'call_end' || sig.type === 'call_decline') {
      if (p2pCallActive) {
        endP2PCall(true); // silent — no signal back
        toast('Call ended by ' + senderName, 'ok');
      }
      hideIncomingCall();
    }
  }

  // ── Show incoming call ring UI ──
  function showIncomingCall(callerName, isVideo) {
    var overlay = document.getElementById('p2pIncomingCallOverlay');
    overlay.style.display = 'flex';
    document.getElementById('incomingCallAvatar').textContent = callerName.charAt(0).toUpperCase();
    document.getElementById('incomingCallName').textContent = callerName;
    document.getElementById('incomingCallType').textContent = (isVideo ? 'Incoming video call...' : 'Incoming voice call...');

    // Ring timer
    p2pRingStart = Date.now();
    if (p2pRingTimer) clearInterval(p2pRingTimer);
    p2pRingTimer = setInterval(function() {
      var elapsed = Math.floor((Date.now() - p2pRingStart) / 1000);
      document.getElementById('incomingCallRingTimer').textContent = elapsed + 's';
      // Auto-decline after 30 seconds
      if (elapsed >= 30) {
        declineP2PCall();
        toast('Missed call from ' + callerName, 'err');
      }
    }, 1000);

    // Play notification sound (use system beep)
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function playBeep() {
        if (!p2pIncomingSignal) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.2;
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        setTimeout(function() {
          if (!p2pIncomingSignal) return;
          var osc2 = ctx.createOscillator();
          var gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 554;
          gain2.gain.value = 0.2;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.2);
        }, 250);
        setTimeout(function() { if (p2pIncomingSignal) playBeep(); }, 2000);
      }
      playBeep();
    } catch(e) {}
  }

  function hideIncomingCall() {
    document.getElementById('p2pIncomingCallOverlay').style.display = 'none';
    if (p2pRingTimer) { clearInterval(p2pRingTimer); p2pRingTimer = null; }
    p2pIncomingSignal = null;
    p2pIncomingCallerName = '';
  }

  // ── Accept incoming call ──
  async function acceptP2PCall() {
    if (!p2pIncomingSignal) return;
    var sig = p2pIncomingSignal;
    var convoId = p2pIncomingConvoId || activeConvoId;
    hideIncomingCall();

    try {
      p2pCallStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!sig.video });
    } catch(e) {
      toast('Cannot answer: mic/camera denied', 'err');
      sendSignal(convoId, { type: 'call_decline' });
      return;
    }

    p2pCallActive = true;
    p2pCallWithVideo = !!sig.video;

    // Show active call overlay
    var overlay = document.getElementById('p2pCallOverlay');
    overlay.style.display = 'flex';
    var callerName = p2pIncomingCallerName || sig.callerName || 'User';
    document.getElementById('callAvatarBig').textContent = callerName.charAt(0).toUpperCase();
    document.getElementById('p2pCallName').textContent = callerName;
    document.getElementById('p2pCallStatus').textContent = 'Connecting...';
    document.getElementById('p2pCallTimer').style.display = 'none';

    if (sig.video) {
      var lv = document.getElementById('p2pLocalVideo');
      lv.srcObject = p2pCallStream;
      lv.style.display = '';
    }

    p2pCallPeer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    p2pCallStream.getTracks().forEach(function(track) { p2pCallPeer.addTrack(track, p2pCallStream); });

    p2pCallPeer.ontrack = function(event) {
      var rv = document.getElementById('p2pRemoteVideo');
      rv.srcObject = event.streams[0];
      rv.style.display = '';
      document.getElementById('p2pCallStatus').textContent = 'Connected';
      startCallTimer();
    };

    p2pCallPeer.onicecandidate = function(event) {
      if (event.candidate) {
        sendSignal(convoId, { type: 'ice', candidate: event.candidate });
      }
    };

    p2pCallPeer.onconnectionstatechange = function() {
      if (p2pCallPeer && (p2pCallPeer.connectionState === 'disconnected' || p2pCallPeer.connectionState === 'failed')) {
        toast('Call disconnected', 'err');
        endP2PCall();
      }
    };

    // Set remote description (the offer) and create answer
    try {
      await p2pCallPeer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sig.sdp }));
      var answer = await p2pCallPeer.createAnswer();
      await p2pCallPeer.setLocalDescription(answer);
      await sendSignal(convoId, { type: 'call_answer', sdp: answer.sdp });
    } catch(e) {
      toast('Failed to accept call: ' + e.message, 'err');
      endP2PCall();
    }
  }

  // ── Decline incoming call ──
  function declineP2PCall() {
    var convoId = p2pIncomingConvoId || activeConvoId;
    hideIncomingCall();
    if (convoId) {
      sendSignal(convoId, { type: 'call_decline' });
    }
  }

  // ── End active call ──
  async function endP2PCall(silent) {
    p2pCallActive = false;
    if (p2pCallPeer) { try { p2pCallPeer.close(); } catch(e) {} p2pCallPeer = null; }
    if (p2pCallStream) { p2pCallStream.getTracks().forEach(function(t) { t.stop(); }); p2pCallStream = null; }
    stopCallTimer();

    document.getElementById('p2pCallOverlay').style.display = 'none';
    document.getElementById('p2pRemoteVideo').style.display = 'none';
    document.getElementById('p2pLocalVideo').style.display = 'none';
    document.getElementById('p2pCallTimer').style.display = 'none';
    p2pCallMuted = false;
    document.getElementById('p2pMuteBtn').innerHTML = '&#128264;';
    document.getElementById('p2pMuteBtn').style.background = 'rgba(255,255,255,0.1)';

    // Notify other user
    if (!silent && activeConvoId) {
      sendSignal(activeConvoId, { type: 'call_end' });
    }
  }

  function toggleP2PMute() {
    if (!p2pCallStream) return;
    p2pCallMuted = !p2pCallMuted;
    p2pCallStream.getAudioTracks().forEach(function(t) { t.enabled = !p2pCallMuted; });
    document.getElementById('p2pMuteBtn').innerHTML = p2pCallMuted ? '&#128263;' : '&#128264;';
    document.getElementById('p2pMuteBtn').style.background = p2pCallMuted ? '#ef4444' : 'rgba(255,255,255,0.1)';
  }

  // ── Call timer ──
  function startCallTimer() {
    stopCallTimer();
    p2pCallStart = Date.now();
    document.getElementById('p2pCallTimer').style.display = '';
    p2pCallTimerInt = setInterval(function() {
      var s = Math.floor((Date.now() - p2pCallStart) / 1000);
      var mm = Math.floor(s / 60);
      var ss = s % 60;
      document.getElementById('p2pCallTimer').textContent = mm + ':' + String(ss).padStart(2, '0');
    }, 1000);
  }
  function stopCallTimer() {
    if (p2pCallTimerInt) { clearInterval(p2pCallTimerInt); p2pCallTimerInt = null; }
  }

  // ── Send signal helper ──
  async function sendSignal(convoId, data) {
    try {
      await api('POST', '/v1/chat/conversations/' + convoId + '/messages', {
        content: JSON.stringify(data),
        contentType: 'signal',
      });
    } catch(e) {}
  }

  // ── Clean up and navigation hooks ──
  const origNav = nav;
  nav = function(id) {
    // Clean up call/signal polling when leaving P2P page
    if (id !== 'p2p') {
      stopP2PPolling();
      stopSignalPolling();
      if (p2pCallActive) endP2PCall();
      hideIncomingCall();
    }
    origNav(id);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ AI AGENT CALL CENTER ═════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  var agentCallSession = null;        // { id, agentId, agentName, ... }
  var agentCallTimer = null;
  var agentCallStart = 0;
  var agentCallMuted = false;
  var agentCallSpeaker = true;
  var agentCallRecognition = null;    // Web Speech API instance
  var agentCallListening = false;
  var agentCallProcessing = false;    // waiting for LLM + TTS
  var agentCallAudio = null;          // Audio element for TTS playback
  var agentCallAnalyser = null;       // Audio analyser for waveform
  var agentCallMicStream = null;
  var agentCallLang = 'en-US';       // Dynamic STT language (updates on detection)
  var agentAdminPollTimer = null;

  function loadAgentPage() {
    loadAgentGrid();
    loadAgentHistory();
    // Restore saved settings from localStorage
    loadAgentSettings();
    // Initialize provider toggle
    updateAgentModelList();
    // Show admin panel if admin
    var isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    var adminPanel = document.getElementById('agentAdminPanel');
    if (adminPanel) adminPanel.style.display = isAdmin ? '' : 'none';
    if (isAdmin) {
      loadAdminActiveCalls();
      if (agentAdminPollTimer) clearInterval(agentAdminPollTimer);
      agentAdminPollTimer = setInterval(loadAdminActiveCalls, 10000);
    }
  }

  async function loadAgentGrid() {
    try {
      var d = await api('GET', '/v1/agent-calls/agents');
      var grid = document.getElementById('agentGrid');
      grid.innerHTML = (d.agents || []).map(function(a) {
        return '<div class="agent-card" style="background:linear-gradient(145deg,' + a.color1 + ' 0%,' + a.color2 + ' 100%);">' +
          '<div class="agent-avatar">' + a.avatar + '</div>' +
          '<h3>' + esc(a.name) + '</h3>' +
          '<div class="agent-specialty">' + esc(a.specialty) + '</div>' +
          '<div class="agent-desc">' + esc(a.description) + '</div>' +
          '<div class="agent-card-footer">' +
            '<span class="agent-voice">' + esc(a.voiceName) + '</span>' +
            '<button class="agent-call-btn" onclick="startAgentCall(\\'' + a.id + '\\')">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>' +
              'Call' +
            '</button>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e) { toast('Failed to load agents: ' + e.message, 'err'); }
  }

  async function loadAgentHistory() {
    try {
      var d = await api('GET', '/v1/agent-calls/history');
      var list = document.getElementById('agentHistoryList');
      var sessions = d.sessions || [];
      if (sessions.length === 0) {
        list.innerHTML = '<p style="color:var(--text3);font-size:13px;">No calls yet. Try calling an agent above!</p>';
        return;
      }
      list.innerHTML = sessions.slice(0, 20).map(function(s) {
        var dur = s.endedAt ? Math.floor((new Date(s.endedAt) - new Date(s.startedAt)) / 1000) : 0;
        var durStr = dur > 0 ? Math.floor(dur/60) + ':' + String(dur%60).padStart(2,'0') : 'Active';
        var badge = s.status === 'escalated' ? '<span class="call-history-badge escalated">Escalated</span>' : '<span class="call-history-badge ended">' + s.status + '</span>';
        var srcBadge = s.source === 'phone' ? ' <span style="background:rgba(99,102,241,0.12);color:var(--accent);font-size:8px;padding:1px 4px;border-radius:3px;">PHONE</span>' : '';
        return '<div class="call-history-item">' +
          '<div class="call-history-avatar">' + (s.agentAvatar || '?') + '</div>' +
          '<div class="call-history-info">' +
            '<div class="call-history-name">' + esc(s.agentName) + srcBadge + '</div>' +
            '<div class="call-history-meta">' + new Date(s.startedAt).toLocaleDateString() + ' · ' + durStr + (s.summary ? ' · ' + esc(s.summary.substring(0,60)) : '') + '</div>' +
          '</div>' + badge +
        '</div>';
      }).join('');
    } catch(e) {}
  }

  async function loadAdminActiveCalls() {
    try {
      var d = await api('GET', '/v1/agent-calls/admin/active');
      var list = document.getElementById('adminActiveCallsList');
      var calls = d.activeCalls || [];
      if (calls.length === 0) {
        list.innerHTML = '<p style="color:var(--text3);font-size:13px;">No active calls right now.</p>';
        return;
      }
      list.innerHTML = calls.map(function(c) {
        var durMin = Math.floor(c.durationSec / 60);
        var durSec = c.durationSec % 60;
        var lastNote = c.supervisorNotes && c.supervisorNotes.length > 0 ? c.supervisorNotes[c.supervisorNotes.length-1] : null;
        var sevColor = lastNote ? (lastNote.severity === 'high' ? '#ef4444' : lastNote.severity === 'medium' ? '#f59e0b' : '#22c55e') : '#22c55e';
        var sourceIcon = c.source === 'phone' ? '&#128222; ' : '&#128187; ';
        var sourceLabel = c.source === 'phone' ? '<span style="background:rgba(99,102,241,0.15);color:var(--accent);font-size:9px;padding:1px 5px;border-radius:4px;margin-left:4px;">PHONE</span>' : '';
        return '<div class="admin-call-row">' +
          '<div class="live-dot" style="background:' + sevColor + ';"></div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:600;color:var(--text);">' + sourceIcon + esc(c.userName) + ' → ' + esc(c.agentName) + sourceLabel + '</div>' +
            '<div style="font-size:11px;color:var(--text3);">' + durMin + ':' + String(durSec).padStart(2,'0') + ' · ' + c.messageCount + ' msgs' +
              (c.callerPhone ? ' · ' + esc(c.callerPhone) : '') +
              (lastNote ? ' · Sentiment: ' + lastNote.sentiment : '') +
              (lastNote && lastNote.flags.length > 0 ? ' · Flags: ' + lastNote.flags.join(', ') : '') +
            '</div>' +
          '</div>' +
          '<span class="call-history-badge ' + c.status + '" style="text-transform:capitalize;">' + c.status + '</span>' +
        '</div>';
      }).join('');
    } catch(e) {}
  }

  // ── Start Agent Call ──
  async function startAgentCall(agentId) {
    // Get config
    var provider = document.getElementById('agentLLMProvider').value;
    var apiKey = document.getElementById('agentLLMKey').value.trim();
    var kaggleUrl = document.getElementById('agentKaggleUrl').value.trim();
    var model = document.getElementById('agentLLMModel').value.trim();
    var elevenLabsKey = document.getElementById('agentElevenLabsKey').value.trim();

    if (provider === 'kaggle') {
      if (!kaggleUrl) {
        toast('Please enter your Kaggle ngrok URL in the settings above', 'err');
        return;
      }
    } else {
      if (!apiKey) {
        toast('Please enter an AI provider API key in the settings above', 'err');
        return;
      }
    }

    try {
      var providerConfig = {
        provider: provider,
        apiKey: provider === 'kaggle' ? 'ollama' : apiKey,
        model: model || undefined,
      };
      if (provider === 'kaggle') {
        providerConfig.baseUrl = kaggleUrl;
      }
      var d = await api('POST', '/v1/agent-calls/start', {
        agentId: agentId,
        provider: providerConfig,
        elevenLabsKey: elevenLabsKey || undefined,
      });

      agentCallSession = {
        id: d.sessionId,
        agentId: d.agent.id,
        agentName: d.agent.name,
        agentSpecialty: d.agent.specialty,
        agentAvatar: d.agent.avatar,
        agentColor1: d.agent.color1,
        agentColor2: d.agent.color2,
      };

      // Show call overlay
      var overlay = document.getElementById('agentCallOverlay');
      overlay.style.display = 'flex';
      document.getElementById('callAgentAvatar').textContent = d.agent.avatar;
      document.getElementById('callAgentAvatar').style.background = 'linear-gradient(135deg,' + d.agent.color1 + ',' + d.agent.color2 + ')';
      document.getElementById('callAgentName').textContent = d.agent.name;
      document.getElementById('callAgentSpecialty').textContent = d.agent.specialty;
      document.getElementById('callStatus').textContent = 'Connected';
      document.getElementById('callTimer').textContent = '0:00';

      // Start timer
      agentCallStart = Date.now();
      agentCallTimer = setInterval(function() {
        var s = Math.floor((Date.now() - agentCallStart) / 1000);
        document.getElementById('callTimer').textContent = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
      }, 1000);

      // Show greeting in transcript
      var transcript = document.getElementById('callTranscript');
      transcript.innerHTML = '';
      appendCallMessage('agent', d.greeting);

      // Play greeting audio
      if (d.greetingAudio) {
        document.getElementById('callStatus').textContent = 'Speaking (ElevenLabs)...';
        document.getElementById('callAgentAvatar').classList.add('speaking');
        playAgentAudio(d.greetingAudio, function() {
          document.getElementById('callAgentAvatar').classList.remove('speaking');
          document.getElementById('callStatus').textContent = 'Listening...';
          startAgentListening();
        });
      } else {
        // No ElevenLabs — use Web Speech
        document.getElementById('callStatus').textContent = 'Speaking...';
        document.getElementById('callAgentAvatar').classList.add('speaking');
        speakWithWebSpeech(d.greeting, function() {
          document.getElementById('callAgentAvatar').classList.remove('speaking');
          document.getElementById('callStatus').textContent = 'Listening...';
          startAgentListening();
        });
      }

    } catch(e) {
      toast('Failed to start call: ' + e.message, 'err');
    }
  }

  function appendCallMessage(role, text) {
    var transcript = document.getElementById('callTranscript');
    var time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var cls = role === 'user' ? 'user' : role === 'system' ? 'system' : 'agent';
    transcript.innerHTML += '<div class="call-msg ' + cls + '">' +
      '<div><div class="call-bubble">' + esc(text) + '</div>' +
      '<div class="call-time">' + time + '</div></div></div>';
    transcript.scrollTop = transcript.scrollHeight;
  }

  // ── Web Speech API Listening ──
  function startAgentListening() {
    if (!agentCallSession || agentCallProcessing || agentCallMuted) return;

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      document.getElementById('callStatus').textContent = 'Speech not supported — type below';
      return;
    }

    agentCallRecognition = new SpeechRecognition();
    agentCallRecognition.continuous = false;
    agentCallRecognition.interimResults = true;
    agentCallRecognition.lang = agentCallLang;

    agentCallListening = true;
    document.getElementById('callStatus').textContent = 'Listening...';
    document.getElementById('callAgentAvatar').classList.remove('speaking');
    animateWaveform(true);

    var finalTranscript = '';
    var interimDiv = null;

    agentCallRecognition.onresult = function(event) {
      var interim = '';
      finalTranscript = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // Show interim results
      if (interim && !interimDiv) {
        interimDiv = document.createElement('div');
        interimDiv.className = 'call-msg user';
        interimDiv.innerHTML = '<div><div class="call-bubble" style="opacity:0.6;">' + esc(interim) + '</div></div>';
        document.getElementById('callTranscript').appendChild(interimDiv);
        document.getElementById('callTranscript').scrollTop = document.getElementById('callTranscript').scrollHeight;
      } else if (interim && interimDiv) {
        interimDiv.querySelector('.call-bubble').textContent = interim;
      }
    };

    agentCallRecognition.onend = function() {
      agentCallListening = false;
      animateWaveform(false);

      // Remove interim div
      if (interimDiv && interimDiv.parentNode) {
        interimDiv.parentNode.removeChild(interimDiv);
        interimDiv = null;
      }

      if (finalTranscript.trim()) {
        sendAgentMessage(finalTranscript.trim());
      } else if (agentCallSession && agentCallSession.id && !agentCallProcessing) {
        // No speech detected — restart listening
        setTimeout(startAgentListening, 500);
      }
    };

    agentCallRecognition.onerror = function(event) {
      agentCallListening = false;
      animateWaveform(false);
      if (interimDiv && interimDiv.parentNode) {
        interimDiv.parentNode.removeChild(interimDiv);
        interimDiv = null;
      }
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Restart listening
        if (agentCallSession && !agentCallProcessing) {
          setTimeout(startAgentListening, 500);
        }
      }
    };

    try {
      agentCallRecognition.start();
    } catch(e) {
      // Already started
    }
  }

  function stopAgentListening() {
    agentCallListening = false;
    if (agentCallRecognition) {
      try { agentCallRecognition.abort(); } catch(e) {}
      agentCallRecognition = null;
    }
    animateWaveform(false);
  }

  // ── Send message to agent ──
  async function sendAgentMessage(text) {
    if (!agentCallSession || agentCallProcessing) return;

    agentCallProcessing = true;
    stopAgentListening();

    appendCallMessage('user', text);
    document.getElementById('callStatus').textContent = 'Thinking...';
    document.getElementById('callAgentAvatar').classList.remove('speaking');

    try {
      var d = await api('POST', '/v1/agent-calls/' + agentCallSession.id + '/message', { text: text });

      // Update STT language if server detected a different language
      if (d.detectedLanguage && d.detectedLanguage !== agentCallLang) {
        agentCallLang = d.detectedLanguage;
        console.log('STT language switched to:', agentCallLang);
      }

      appendCallMessage('agent', d.text);

      // Check if auto-escalated by supervisor
      if (d.autoEscalated) {
        appendCallMessage('system', d.autoEscalationMessage || 'A real person has been contacted to help you. They will reach out shortly.');
        document.getElementById('callStatus').textContent = 'Connecting to human support...';
        // Speak the escalation message then stop listening
        var escalationText = d.autoEscalationMessage || 'I have connected you with a real person. They are being notified now.';
        if (d.audioBase64) {
          playAgentAudio(d.audioBase64, function() {
            agentCallProcessing = false;
            document.getElementById('callAgentAvatar').classList.remove('speaking');
            speakWithWebSpeech(escalationText, function() {});
          });
        } else {
          speakWithWebSpeech(d.text, function() {
            agentCallProcessing = false;
            document.getElementById('callAgentAvatar').classList.remove('speaking');
            speakWithWebSpeech(escalationText, function() {});
          });
        }
        return;
      }

      // Check supervisor alert (suggestion, not auto-escalated)
      if (d.supervisorAlert) {
        if (d.supervisorAlert.escalationNeeded) {
          appendCallMessage('system', 'The supervisor suggests connecting you with a real person: ' + (d.supervisorAlert.reason || ''));
        }
      }

      // Play audio response
      if (d.audioBase64) {
        document.getElementById('callStatus').textContent = 'Speaking...';
        document.getElementById('callAgentAvatar').classList.add('speaking');
        playAgentAudio(d.audioBase64, function() {
          agentCallProcessing = false;
          document.getElementById('callAgentAvatar').classList.remove('speaking');
          startAgentListening();
        });
      } else {
        // No TTS — use Web Speech Synthesis
        document.getElementById('callStatus').textContent = 'Speaking...';
        document.getElementById('callAgentAvatar').classList.add('speaking');
        speakWithWebSpeech(d.text, function() {
          agentCallProcessing = false;
          document.getElementById('callAgentAvatar').classList.remove('speaking');
          startAgentListening();
        });
      }

    } catch(e) {
      toast('Agent error: ' + e.message, 'err');
      agentCallProcessing = false;
      startAgentListening();
    }
  }

  // ── Play ElevenLabs audio ──
  function playAgentAudio(base64, onEnd) {
    try {
      var audioBlob = base64ToBlob(base64, 'audio/mpeg');
      var audioUrl = URL.createObjectURL(audioBlob);
      agentCallAudio = new Audio(audioUrl);
      agentCallAudio.volume = agentCallSpeaker ? 1.0 : 0.0;
      agentCallAudio.onended = function() {
        URL.revokeObjectURL(audioUrl);
        if (onEnd) onEnd();
      };
      agentCallAudio.onerror = function() {
        URL.revokeObjectURL(audioUrl);
        if (onEnd) onEnd();
      };
      agentCallAudio.play().catch(function() { if (onEnd) onEnd(); });
    } catch(e) {
      if (onEnd) onEnd();
    }
  }

  function base64ToBlob(base64, mimeType) {
    var bytes = atob(base64);
    var arr = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  }

  // ── Web Speech Synthesis fallback with smart voice selection ──
  var _bestVoiceCache = null;

  function getBestVoice(gender) {
    // gender: 'female' or 'male'
    if (_bestVoiceCache && _bestVoiceCache[gender]) return _bestVoiceCache[gender];

    var voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (!voices.length) return null;

    _bestVoiceCache = _bestVoiceCache || {};

    // Premium voice names to prioritize (these sound much more natural)
    var femalePreferred = ['Samantha', 'Karen', 'Zoe', 'Moira', 'Tessa', 'Google UK English Female', 'Microsoft Zira', 'Fiona', 'Victoria'];
    var malePreferred = ['Daniel', 'Alex', 'Oliver', 'James', 'Google UK English Male', 'Microsoft David', 'Tom', 'Aaron'];
    var preferred = gender === 'male' ? malePreferred : femalePreferred;

    // Try to find a premium English voice first
    for (var i = 0; i < preferred.length; i++) {
      var match = voices.find(function(v) { return v.name.indexOf(preferred[i]) !== -1 && v.lang.indexOf('en') === 0; });
      if (match) { _bestVoiceCache[gender] = match; return match; }
    }

    // Fallback: any English voice
    var english = voices.filter(function(v) { return v.lang.indexOf('en') === 0; });
    if (english.length) { _bestVoiceCache[gender] = english[0]; return english[0]; }

    return voices[0] || null;
  }

  function speakWithWebSpeech(text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }

    // Cancel anything currently speaking
    window.speechSynthesis.cancel();

    var utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;   // slightly slower for clarity
    utt.pitch = 1.05;  // slightly higher for warmth

    // Pick a nice voice based on the current agent
    var gender = 'female';
    if (agentCallSession) {
      // Atlas and Sage are male agents
      if (agentCallSession.agentId === 'atlas' || agentCallSession.agentId === 'sage') gender = 'male';
    }
    var voice = getBestVoice(gender);
    if (voice) utt.voice = voice;

    utt.onend = function() { if (onEnd) onEnd(); };
    utt.onerror = function() { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utt);
  }

  // Pre-load voices (some browsers lazy-load them)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = function() { _bestVoiceCache = null; };
    }
  }

  // ── Waveform animation ──
  var waveAnimFrame = null;
  function animateWaveform(active) {
    var bars = document.querySelectorAll('#callWaveform .wbar');
    if (!active) {
      if (waveAnimFrame) cancelAnimationFrame(waveAnimFrame);
      waveAnimFrame = null;
      bars.forEach(function(b) { b.style.height = '4px'; });
      return;
    }
    function frame() {
      bars.forEach(function(b) {
        b.style.height = (4 + Math.random() * 24) + 'px';
      });
      waveAnimFrame = requestAnimationFrame(function() {
        setTimeout(frame, 80);
      });
    }
    frame();
  }

  // ── Controls ──
  function toggleAgentCallMute() {
    agentCallMuted = !agentCallMuted;
    var btn = document.getElementById('callMuteBtn');
    btn.classList.toggle('active', agentCallMuted);
    if (agentCallMuted) {
      stopAgentListening();
      document.getElementById('callStatus').textContent = 'Muted';
    } else {
      if (!agentCallProcessing) startAgentListening();
    }
  }

  function toggleAgentSpeaker() {
    agentCallSpeaker = !agentCallSpeaker;
    var btn = document.getElementById('callSpeakerBtn');
    btn.style.opacity = agentCallSpeaker ? '1' : '0.4';
    if (agentCallAudio) agentCallAudio.volume = agentCallSpeaker ? 1.0 : 0.0;
  }

  async function escalateAgentCall() {
    if (!agentCallSession) return;
    try {
      document.getElementById('callStatus').textContent = 'Escalating to human...';
      var d = await api('POST', '/v1/agent-calls/' + agentCallSession.id + '/escalate');
      appendCallMessage('system', d.message);
      if (d.method === 'twilio_call_placed') {
        toast('Phone call placed to admin! They will receive a call shortly.', 'ok');
        document.getElementById('callStatus').textContent = 'Admin notified via phone';
      } else if (d.method === 'twilio_failed_notification_sent') {
        toast('Phone call failed — admin has been notified via the system. Make sure your phone number is verified in Twilio.', 'err');
        document.getElementById('callStatus').textContent = 'Escalated (phone failed)';
      } else {
        toast(d.message, 'ok');
        document.getElementById('callStatus').textContent = 'Escalated';
      }
    } catch(e) {
      toast('Escalation failed: ' + e.message, 'err');
      document.getElementById('callStatus').textContent = 'Escalation failed';
    }
  }

  async function endAgentCall() {
    if (!agentCallSession) return;

    stopAgentListening();
    if (agentCallTimer) { clearInterval(agentCallTimer); agentCallTimer = null; }
    if (agentCallAudio) { agentCallAudio.pause(); agentCallAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    animateWaveform(false);

    var sessionId = agentCallSession.id;
    var agentName = agentCallSession.agentName;
    var agentAvatar = agentCallSession.agentAvatar || '?';
    agentCallProcessing = false;

    document.getElementById('callStatus').textContent = 'Ending call...';

    // End on server
    var summary = '';
    var duration = 0;
    var msgCount = 0;
    try {
      var d = await api('POST', '/v1/agent-calls/' + sessionId + '/end');
      summary = d.summary || '';
      duration = d.duration || 0;
      msgCount = d.messageCount || 0;
    } catch(e) {}

    // Hide call overlay
    document.getElementById('agentCallOverlay').style.display = 'none';
    agentCallSession = null;
    agentCallMuted = false;
    agentCallSpeaker = true;

    // Show call summary card
    var durStr = Math.floor(duration/60) + ':' + String(duration%60).padStart(2,'0');
    showCallSummary(agentAvatar, agentName, durStr, msgCount, summary);

    // Refresh history
    loadAgentHistory();
  }

  function showCallSummary(avatar, name, duration, msgCount, summary) {
    // Remove any existing summary
    var existing = document.getElementById('callSummaryCard');
    if (existing) existing.remove();

    var card = document.createElement('div');
    card.id = 'callSummaryCard';
    card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9600;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:420px;width:90%;box-shadow:0 24px 60px rgba(0,0,0,0.5);animation:pageIn 0.25s ease;';

    card.innerHTML = '' +
      '<div style="text-align:center;margin-bottom:16px;">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 10px;">' + avatar + '</div>' +
        '<div style="font-size:16px;font-weight:700;color:var(--text);">Call with ' + esc(name) + '</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px;">Call ended</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;justify-content:center;margin-bottom:16px;">' +
        '<div style="text-align:center;"><div style="font-size:20px;font-weight:700;color:var(--accent);">' + duration + '</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Duration</div></div>' +
        '<div style="text-align:center;"><div style="font-size:20px;font-weight:700;color:var(--accent);">' + msgCount + '</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Messages</div></div>' +
      '</div>' +
      (summary ? '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;margin-bottom:4px;">Summary</div><div style="font-size:13px;color:var(--text);line-height:1.5;">' + esc(summary) + '</div></div>' : '') +
      '<button id="callSummaryDoneBtn" style="width:100%;padding:10px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">Done</button>';

    var bg = document.createElement('div');
    bg.id = 'callSummaryBg';
    bg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9599;background:rgba(0,0,0,0.5);';
    bg.onclick = function() { card.remove(); bg.remove(); };

    document.body.appendChild(bg);
    document.body.appendChild(card);
    var doneBtn = document.getElementById('callSummaryDoneBtn');
    if (doneBtn) doneBtn.onclick = function() { card.remove(); bg.remove(); };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Call Logs Page ──
  // ══════════════════════════════════════════════════════════════════════════
  var _callLogsData = [];
  var _callLogsFilter = 'all';

  async function loadCallLogs() {
    var list = document.getElementById('callLogsList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px;">Loading call logs...</p>';

    try {
      var d = await api('GET', '/v1/agent-calls/admin/call-logs');
      _callLogsData = d.logs || [];

      // Update stats
      document.getElementById('clStatTotal').textContent = _callLogsData.length;
      document.getElementById('clStatPhone').textContent = _callLogsData.filter(function(c) { return c.source === 'phone'; }).length;
      document.getElementById('clStatBrowser').textContent = _callLogsData.filter(function(c) { return c.source === 'browser'; }).length;
      document.getElementById('clStatEscalated').textContent = _callLogsData.filter(function(c) { return c.status === 'escalated'; }).length;
      document.getElementById('clStatActive').textContent = _callLogsData.filter(function(c) { return c.status === 'active'; }).length;

      renderCallLogs();
    } catch (e) {
      list.innerHTML = '<p style="text-align:center;color:var(--red);padding:20px;">Failed to load call logs: ' + esc(e.message) + '</p>';
    }
  }

  function filterCallLogs(filter) {
    if (filter) _callLogsFilter = filter;
    // Update active button style
    document.querySelectorAll('.calllog-filter').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === _callLogsFilter);
    });
    renderCallLogs();
  }

  function renderCallLogs() {
    var list = document.getElementById('callLogsList');
    var search = (document.getElementById('callLogSearch')?.value || '').toLowerCase();
    var filtered = _callLogsData.filter(function(c) {
      // Filter by type
      if (_callLogsFilter === 'phone' && c.source !== 'phone') return false;
      if (_callLogsFilter === 'browser' && c.source !== 'browser') return false;
      if (_callLogsFilter === 'escalated' && c.status !== 'escalated') return false;
      if (_callLogsFilter === 'active' && c.status !== 'active') return false;
      // Search
      if (search) {
        var hay = (c.agentName + ' ' + c.userName + ' ' + c.callerPhone + ' ' + c.summary + ' ' + c.source).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text3);padding:30px;">No calls match this filter.</p>';
      return;
    }

    list.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--border);text-align:left;">' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">Agent</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">User / Phone</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">Source</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">Status</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">Duration</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">Messages</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;">Date</th>' +
        '<th style="padding:8px 10px;font-size:11px;color:var(--text3);font-weight:600;"></th>' +
      '</tr></thead><tbody>' +
      filtered.map(function(c, idx) {
        var dur = c.durationSec >= 60 ? Math.floor(c.durationSec/60) + 'm ' + (c.durationSec%60) + 's' : c.durationSec + 's';
        var statusColors = { active: '#22c55e', ended: '#6b7280', escalated: '#ef4444' };
        var statusColor = statusColors[c.status] || '#6b7280';
        var srcBg = c.source === 'phone' ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.12)';
        var srcColor = c.source === 'phone' ? '#8b5cf6' : '#3b82f6';
        var srcLabel = c.source === 'phone' ? 'PHONE' : 'BROWSER';
        var userLabel = c.source === 'phone' && c.callerPhone ? c.callerPhone : esc(c.userName || 'Unknown');

        return '<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\\'var(--surface2)\\'" onmouseout="this.style.background=\\'transparent\\'" onclick="viewCallDetail(' + idx + ')">' +
          '<td style="padding:10px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="font-size:18px;">' + (c.agentAvatar || '?') + '</span>' +
              '<div><div style="font-weight:600;">' + esc(c.agentName) + '</div><div style="font-size:10px;color:var(--text3);">' + esc(c.agentSpecialty || '') + '</div></div>' +
            '</div>' +
          '</td>' +
          '<td style="padding:10px;font-size:12px;">' + userLabel + '</td>' +
          '<td style="padding:10px;"><span style="font-size:9px;padding:2px 8px;border-radius:8px;font-weight:700;background:' + srcBg + ';color:' + srcColor + ';">' + srcLabel + '</span></td>' +
          '<td style="padding:10px;"><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:' + statusColor + ';">' +
            (c.status === 'active' ? '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;animation:livePulse 1.5s infinite;"></span>' : '') +
            c.status + '</span></td>' +
          '<td style="padding:10px;font-size:12px;color:var(--text2);">' + dur + '</td>' +
          '<td style="padding:10px;font-size:12px;color:var(--text2);">' + c.messageCount + '</td>' +
          '<td style="padding:10px;font-size:11px;color:var(--text3);">' + new Date(c.startedAt).toLocaleString() + '</td>' +
          '<td style="padding:10px;display:flex;gap:4px;">' +
            '<button class="btn-small" style="font-size:10px;padding:3px 10px;" onclick="event.stopPropagation();viewCallDetail(' + idx + ')">View</button>' +
            (c.status === 'active' ? '<button class="btn-small" style="font-size:10px;padding:3px 10px;background:var(--red);color:#fff;" onclick="event.stopPropagation();forceEndCall(\\'' + esc(c.id) + '\\')">End</button>' : '') +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function viewCallDetail(idx) {
    var filtered = _callLogsData.filter(function(c) {
      var search = (document.getElementById('callLogSearch')?.value || '').toLowerCase();
      if (_callLogsFilter === 'phone' && c.source !== 'phone') return false;
      if (_callLogsFilter === 'browser' && c.source !== 'browser') return false;
      if (_callLogsFilter === 'escalated' && c.status !== 'escalated') return false;
      if (_callLogsFilter === 'active' && c.status !== 'active') return false;
      if (search) {
        var hay = (c.agentName + ' ' + c.userName + ' ' + c.callerPhone + ' ' + c.summary + ' ' + c.source).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });
    var c = filtered[idx];
    if (!c) return;

    var dur = c.durationSec >= 60 ? Math.floor(c.durationSec/60) + 'm ' + (c.durationSec%60) + 's' : c.durationSec + 's';
    var srcBadge = c.source === 'phone'
      ? '<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:rgba(139,92,246,0.12);color:#8b5cf6;">PHONE</span>'
      : '<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:rgba(59,130,246,0.12);color:#3b82f6;">BROWSER</span>';
    var statusColors = { active: '#22c55e', ended: '#6b7280', escalated: '#ef4444' };

    // Header
    document.getElementById('callDetailHeader').innerHTML =
      '<div style="display:flex;align-items:center;gap:14px;">' +
        '<div style="font-size:36px;">' + (c.agentAvatar || '?') + '</div>' +
        '<div style="flex:1;">' +
          '<h3 style="font-size:18px;font-weight:700;margin:0;">' + esc(c.agentName) + ' <span style="font-size:13px;font-weight:400;color:var(--text3);">' + esc(c.agentSpecialty || '') + '</span></h3>' +
          '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">' +
            srcBadge +
            '<span style="font-size:11px;font-weight:600;color:' + (statusColors[c.status] || '#6b7280') + ';">' + c.status.toUpperCase() + '</span>' +
            '<span style="font-size:11px;color:var(--text3);">' + dur + ' &middot; ' + c.messageCount + ' messages</span>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:4px;">' +
            'User: ' + esc(c.userName || 'Unknown') +
            (c.callerPhone ? ' &middot; Phone: ' + esc(c.callerPhone) : '') +
            ' &middot; Started: ' + new Date(c.startedAt).toLocaleString() +
            (c.endedAt ? ' &middot; Ended: ' + new Date(c.endedAt).toLocaleString() : '') +
          '</div>' +
        '</div>' +
        (c.status === 'active' ? '<button onclick="forceEndCall(\\'' + esc(c.id) + '\\')" style="margin-left:auto;padding:8px 18px;border-radius:8px;border:none;background:var(--red);color:#fff;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;">Force End Call</button>' : '') +
      '</div>';

    // Summary
    var summaryEl = document.getElementById('callDetailSummary');
    if (c.summary) {
      summaryEl.style.display = '';
      summaryEl.innerHTML =
        '<h4 style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Summary</h4>' +
        '<p style="font-size:13px;color:var(--text);line-height:1.6;margin:0;">' + esc(c.summary) + '</p>';
    } else {
      summaryEl.style.display = '';
      summaryEl.innerHTML = '<p style="font-size:12px;color:var(--text3);margin:0;">No summary available' + (c.status === 'active' ? ' (call still active)' : '') + '</p>';
    }

    // Transcript
    var transcriptEl = document.getElementById('callDetailTranscript');
    var msgs = (c.transcript || []);
    if (msgs.length === 0) {
      transcriptEl.innerHTML = '<p style="color:var(--text3);font-size:12px;">No transcript available.</p>';
    } else {
      transcriptEl.innerHTML = msgs.map(function(m) {
        var isUser = m.role === 'user';
        var isSystem = m.role === 'system';
        var bgColor = isSystem ? 'rgba(239,68,68,0.08)' : (isUser ? 'rgba(99,102,241,0.08)' : 'var(--surface)');
        var borderColor = isSystem ? 'rgba(239,68,68,0.2)' : (isUser ? 'rgba(99,102,241,0.2)' : 'var(--border)');
        var label = isSystem ? 'SYSTEM' : (isUser ? (c.source === 'phone' ? 'CALLER' : 'USER') : c.agentName);
        var labelColor = isSystem ? '#ef4444' : (isUser ? 'var(--accent)' : '#22c55e');
        var time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';

        return '<div style="padding:10px 14px;margin-bottom:6px;border-radius:10px;background:' + bgColor + ';border:1px solid ' + borderColor + ';">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
            '<span style="font-size:10px;font-weight:700;color:' + labelColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + esc(label) + '</span>' +
            '<span style="font-size:9px;color:var(--text3);">' + time + '</span>' +
          '</div>' +
          '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + esc(m.text) + '</div>' +
        '</div>';
      }).join('');
    }

    // Supervisor Notes
    var supEl = document.getElementById('callDetailSupervisor');
    if (c.supervisorNotes && c.supervisorNotes.length > 0) {
      supEl.style.display = '';
      supEl.innerHTML =
        '<h4 style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Supervisor Analysis</h4>' +
        c.supervisorNotes.map(function(n) {
          var sevColors = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
          return '<div style="padding:8px 12px;margin-bottom:4px;border-radius:8px;background:var(--surface);border:1px solid var(--border);font-size:12px;">' +
            '<div style="display:flex;gap:6px;align-items:center;margin-bottom:2px;">' +
              '<span style="font-weight:700;color:' + (sevColors[n.severity] || '#6b7280') + ';">' + (n.severity || 'unknown').toUpperCase() + '</span>' +
              (n.escalationNeeded ? '<span style="color:#ef4444;font-weight:600;">ESCALATION NEEDED</span>' : '') +
            '</div>' +
            '<div style="color:var(--text2);">' + esc(n.reason || '') + '</div>' +
          '</div>';
        }).join('');
    } else {
      supEl.style.display = 'none';
    }

    document.getElementById('callDetailOverlay').style.display = '';
  }

  async function forceEndCall(sessionId) {
    if (!confirm('Force end this call? The user will be disconnected.')) return;
    try {
      await api('POST', '/v1/agent-calls/admin/force-end/' + sessionId);
      toast('Call force-ended successfully', 'ok');
      // Close detail overlay if open
      document.getElementById('callDetailOverlay').style.display = 'none';
      // Refresh call logs
      loadCallLogs();
    } catch (e) {
      toast('Failed to end call: ' + (e.error || e.message), 'err');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ BLUEPRINT PAGE JS ═════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  var _blueprintData = null;

  async function loadBlueprint() {
    try {
      var res = await api('GET', '/v1/agent-calls/blueprint/roadmap');
      if (res && res.phases) {
        _blueprintData = res;
        renderBlueprintTimeline(res.phases);
        renderBlueprintModules(res.modules);
        renderBlueprintMilestones(res.milestones);
      }
    } catch(e) {
      console.error('Blueprint load error:', e);
    }
  }

  function renderBlueprintTimeline(phases) {
    var el = document.getElementById('blueprintTimeline');
    if (!el) return;
    el.innerHTML = phases.map(function(p) {
      var cls = 'bp-phase ' + (p.status || 'planned');
      var badgeText = p.status === 'current' ? 'CURRENT' : 'PLANNED';
      return '<div class="' + cls + '">' +
        '<span class="bp-phase-badge">' + badgeText + '</span>' +
        '<h4>' + esc(p.title) + '</h4>' +
        '<p class="bp-phase-sub">' + esc(p.subtitle) + '</p>' +
        '<ul>' + p.items.map(function(item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>' +
      '</div>';
    }).join('');
  }

  function renderBlueprintModules(modules) {
    var el = document.getElementById('blueprintModuleBody');
    if (!el) return;
    el.innerHTML = modules.map(function(m) {
      return '<tr>' +
        '<td style="font-weight:600;">' + esc(m.name) + '</td>' +
        '<td>' + (m.standalone ? '<span style="color:#22c55e;font-weight:600;">Yes</span>' : '<span style="color:var(--text2);">No (core)</span>') + '</td>' +
        '<td><span class="bp-status-badge bp-status-' + m.status + '">' + m.status.toUpperCase() + '</span></td>' +
        '<td>' + esc(m.priority) + '</td>' +
        '<td style="color:var(--text2);font-size:0.8rem;">' + esc(m.description) + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderBlueprintMilestones(milestones) {
    var el = document.getElementById('blueprintMilestones');
    if (!el) return;
    var isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    var statusIcons = { planned: '⬜', in_progress: '🔶', done: '✅', shipped: '🚀' };
    el.innerHTML = milestones.map(function(ms, idx) {
      var icon = statusIcons[ms.status] || '⬜';
      var selectHtml = '';
      if (isAdmin) {
        selectHtml = '<select class="bp-ms-select" onchange="updateMilestone(\\''+ms.id+'\\', this.value)">' +
          ['planned','in_progress','done','shipped'].map(function(s) {
            return '<option value="'+s+'"'+(ms.status===s?' selected':'')+'>'+s.replace('_',' ').toUpperCase()+'</option>';
          }).join('') +
        '</select>';
      } else {
        selectHtml = '<span class="bp-status-badge bp-status-' + ms.status + '">' + ms.status.replace('_',' ').toUpperCase() + '</span>';
      }
      return '<div class="bp-ms-card">' +
        '<div class="bp-ms-icon">' + icon + '</div>' +
        '<div class="bp-ms-info">' +
          '<div class="bp-ms-title">' + esc(ms.title) + '</div>' +
          '<div class="bp-ms-cat">' + esc(ms.category) + '</div>' +
        '</div>' +
        selectHtml +
      '</div>';
    }).join('');
  }

  async function updateMilestone(id, status) {
    try {
      await api('PUT', '/v1/agent-calls/blueprint/milestone/' + id, { status: status });
      showToast('Milestone updated!');
      loadBlueprint();
    } catch(e) {
      showToast('Failed to update milestone');
      console.error('Milestone update error:', e);
    }
  }

  // ── Agent settings persistence ──
  function saveAgentSettings() {
    try {
      localStorage.setItem('cfl_agent_settings', JSON.stringify({
        provider: document.getElementById('agentLLMProvider').value,
        apiKey: document.getElementById('agentLLMKey').value,
        kaggleUrl: document.getElementById('agentKaggleUrl').value,
        model: document.getElementById('agentLLMModel').value,
        elevenLabsKey: document.getElementById('agentElevenLabsKey').value,
      }));
    } catch(e) {}
  }

  function loadAgentSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem('cfl_agent_settings') || '{}');
      if (saved.provider) document.getElementById('agentLLMProvider').value = saved.provider;
      if (saved.apiKey) document.getElementById('agentLLMKey').value = saved.apiKey;
      if (saved.kaggleUrl) document.getElementById('agentKaggleUrl').value = saved.kaggleUrl;
      if (saved.model) document.getElementById('agentLLMModel').value = saved.model;
      if (saved.elevenLabsKey) document.getElementById('agentElevenLabsKey').value = saved.elevenLabsKey;
    } catch(e) {}
  }

  // Auto-save on input change
  ['agentLLMProvider','agentLLMKey','agentKaggleUrl','agentLLMModel','agentElevenLabsKey'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', saveAgentSettings);
      el.addEventListener('change', saveAgentSettings);
    }
  });

  function toggleAgentSettings() {
    var panel = document.getElementById('agentConfigPanel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
    if (panel.style.display !== 'none') {
      updateAgentModelList();
    }
  }

  function updateAgentModelList() {
    var provider = document.getElementById('agentLLMProvider').value;
    var isKaggle = provider === 'kaggle';

    // Toggle fields visibility
    document.getElementById('agentKeyField').style.display = isKaggle ? 'none' : '';
    document.getElementById('agentKaggleUrlField').style.display = isKaggle ? '' : 'none';
    document.getElementById('agentKaggleHelp').style.display = isKaggle ? '' : 'none';
    document.getElementById('agentNonKaggleHelp').style.display = isKaggle ? 'none' : '';

    // Set default model hint
    if (isKaggle) {
      document.getElementById('agentLLMModel').placeholder = 'llama3.2:3b (or mistral:7b, phi3:mini)';
    } else {
      document.getElementById('agentLLMModel').placeholder = 'Default model';
      document.getElementById('agentLLMModel').value = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ END AI AGENT CALL CENTER ═════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══ GLOBAL INCOMING CALL POLLING ═══════════════════════════════════════
  // This runs across ALL pages so the user always receives call notifications
  var globalCallPollTimer = null;
  var globalLastCallId = null;

  function startGlobalCallPolling() {
    if (globalCallPollTimer) return;
    globalCallPollTimer = setInterval(pollGlobalIncomingCalls, 3000);
    pollGlobalIncomingCalls(); // run once immediately
  }
  function stopGlobalCallPolling() {
    if (globalCallPollTimer) { clearInterval(globalCallPollTimer); globalCallPollTimer = null; }
  }

  async function pollGlobalIncomingCalls() {
    if (!token || p2pCallActive || p2pIncomingSignal) return;
    try {
      var d = await api('GET', '/v1/chat/incoming-calls');
      var calls = d.incomingCalls || [];
      if (calls.length > 0) {
        var call = calls[calls.length - 1];
        var callKey = call.conversationId + '_' + call.createdAt;
        if (globalLastCallId === callKey) return;
        globalLastCallId = callKey;

        p2pIncomingSignal = call.signal;
        p2pIncomingConvoId = call.conversationId;
        p2pIncomingCallerName = call.senderName || 'Unknown';
        showGlobalIncomingCall(p2pIncomingCallerName, call.signal.video);
      }
    } catch(e) {}
  }

  function showGlobalIncomingCall(callerName, isVideo) {
    var overlay = document.getElementById('globalIncomingCallOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('globalIncomingAvatar').textContent = callerName.charAt(0).toUpperCase();
    document.getElementById('globalIncomingName').textContent = callerName;
    document.getElementById('globalIncomingType').textContent = (isVideo ? 'Incoming video call...' : 'Incoming voice call...');
    document.getElementById('globalIncomingRingTimer').textContent = '';

    p2pRingStart = Date.now();
    if (p2pRingTimer) clearInterval(p2pRingTimer);
    p2pRingTimer = setInterval(function() {
      var elapsed = Math.floor((Date.now() - p2pRingStart) / 1000);
      var el = document.getElementById('globalIncomingRingTimer');
      if (el) el.textContent = elapsed + 's';
      if (elapsed >= 30) {
        declineGlobalCall();
        toast('Missed call from ' + callerName, 'err');
      }
    }, 1000);

    // Ring tone
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function ringBeep() {
        if (!p2pIncomingSignal) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 440; gain.gain.value = 0.2;
        osc.start(); osc.stop(ctx.currentTime + 0.2);
        setTimeout(function() {
          if (!p2pIncomingSignal) return;
          var o2 = ctx.createOscillator();
          var g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 554; g2.gain.value = 0.2;
          o2.start(); o2.stop(ctx.currentTime + 0.2);
          setTimeout(function() { if (p2pIncomingSignal) ringBeep(); }, 2000);
        }, 300);
      }
      ringBeep();
    } catch(e) {}
  }

  function hideGlobalIncomingCall() {
    var overlay = document.getElementById('globalIncomingCallOverlay');
    if (overlay) overlay.style.display = 'none';
    if (p2pRingTimer) { clearInterval(p2pRingTimer); p2pRingTimer = null; }
    p2pIncomingSignal = null;
  }

  async function acceptGlobalCall() {
    if (!p2pIncomingSignal || !p2pIncomingConvoId) return;
    var sig = p2pIncomingSignal;
    var convoId = p2pIncomingConvoId;
    var callerName = p2pIncomingCallerName;
    hideGlobalIncomingCall();

    // Navigate to P2P page
    nav('p2p');

    // Short delay for page render
    setTimeout(async function() {
      activeConvoId = convoId;
      activeConvoOther = convoDataMap[convoId] || { displayName: callerName };

      startSignalPolling();

      p2pCallActive = true;
      p2pCallWithVideo = !!sig.video;

      try {
        p2pCallStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!sig.video });
      } catch(e) {
        toast('Camera/mic access denied: ' + e.message, 'err');
        p2pCallActive = false;
        sendSignal(convoId, { type: 'call_decline' });
        return;
      }

      // Show the P2P call overlay
      var overlay = document.getElementById('p2pCallOverlay');
      if (overlay) overlay.style.display = 'flex';
      var avatarEl = document.getElementById('callAvatarBig');
      if (avatarEl) avatarEl.textContent = callerName.charAt(0).toUpperCase();
      var nameEl = document.getElementById('p2pCallName');
      if (nameEl) nameEl.textContent = callerName;
      var statusEl = document.getElementById('p2pCallStatus');
      if (statusEl) statusEl.textContent = 'Connecting...';
      var timerEl = document.getElementById('p2pCallTimer');
      if (timerEl) timerEl.style.display = 'none';

      if (sig.video) {
        var lv = document.getElementById('p2pLocalVideo');
        if (lv) { lv.srcObject = p2pCallStream; lv.style.display = ''; }
      }

      p2pCallPeer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      p2pCallStream.getTracks().forEach(function(track) { p2pCallPeer.addTrack(track, p2pCallStream); });

      p2pCallPeer.ontrack = function(event) {
        var rv = document.getElementById('p2pRemoteVideo');
        if (rv) { rv.srcObject = event.streams[0]; rv.style.display = ''; }
        var st = document.getElementById('p2pCallStatus');
        if (st) st.textContent = 'Connected';
        startCallTimer();
      };

      p2pCallPeer.onicecandidate = function(event) {
        if (event.candidate) {
          sendSignal(convoId, { type: 'ice', candidate: event.candidate });
        }
      };

      p2pCallPeer.onconnectionstatechange = function() {
        if (p2pCallPeer && (p2pCallPeer.connectionState === 'disconnected' || p2pCallPeer.connectionState === 'failed')) {
          toast('Call disconnected', 'err');
          endP2PCall();
        }
      };

      // Set remote description (the offer) and create answer
      try {
        await p2pCallPeer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sig.sdp }));
        var answer = await p2pCallPeer.createAnswer();
        await p2pCallPeer.setLocalDescription(answer);
        await sendSignal(convoId, { type: 'call_answer', sdp: answer.sdp });
      } catch(e) {
        toast('Failed to accept call: ' + e.message, 'err');
        endP2PCall();
      }

      loadConversations();
    }, 400);
  }

  function declineGlobalCall() {
    if (p2pIncomingConvoId) {
      sendSignal(p2pIncomingConvoId, { type: 'call_decline' });
    }
    hideGlobalIncomingCall();
    globalLastCallId = null;
  }

</script>

<!-- ═══ GLOBAL INCOMING CALL OVERLAY (visible across all pages) ═══ -->
<div id="globalIncomingCallOverlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:linear-gradient(180deg,#0f0f23 0%,#1a1a3e 100%);flex-direction:column;align-items:center;justify-content:center;gap:0;">
  <style>
    @keyframes globalCallPulse { 0%,100% { transform:scale(1); box-shadow:0 0 0 0 rgba(99,102,241,0.4); } 50% { transform:scale(1.06); box-shadow:0 0 0 18px rgba(99,102,241,0); } }
    @keyframes globalCallRipple { 0% { width:120px;height:120px;opacity:0.6; } 100% { width:260px;height:260px;opacity:0; } }
  </style>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);width:120px;height:120px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);animation:globalCallRipple 2s ease-out infinite;"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);width:120px;height:120px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);animation:globalCallRipple 2s ease-out 0.5s infinite;"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);width:120px;height:120px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);animation:globalCallRipple 2s ease-out 1s infinite;"></div>
  </div>
  <div id="globalIncomingAvatar" style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;color:#fff;margin-bottom:20px;border:3px solid rgba(255,255,255,0.2);z-index:1;animation:globalCallPulse 1.5s ease-in-out infinite;">?</div>
  <div id="globalIncomingName" style="color:#fff;font-size:24px;font-weight:700;margin-bottom:6px;z-index:1;"></div>
  <div id="globalIncomingType" style="color:rgba(255,255,255,0.6);font-size:15px;margin-bottom:8px;z-index:1;">Incoming voice call...</div>
  <div id="globalIncomingRingTimer" style="color:rgba(255,255,255,0.4);font-size:13px;margin-bottom:40px;z-index:1;"></div>
  <div style="display:flex;gap:50px;z-index:1;">
    <div style="text-align:center;">
      <button onclick="declineGlobalCall()" style="background:#ef4444;border:none;border-radius:50%;width:70px;height:70px;cursor:pointer;color:#fff;transition:all 0.2s;box-shadow:0 4px 24px rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg></button>
      <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:10px;font-weight:500;">Decline</div>
    </div>
    <div style="text-align:center;">
      <button onclick="acceptGlobalCall()" style="background:#22c55e;border:none;border-radius:50%;width:70px;height:70px;cursor:pointer;color:#fff;transition:all 0.2s;box-shadow:0 4px 24px rgba(34,197,94,0.4);display:flex;align-items:center;justify-content:center;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
      <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:10px;font-weight:500;">Accept</div>
    </div>
  </div>
</div>

</body>
</html>`;
