"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shellHtml = shellHtml;
exports.loginHtml = loginHtml;
/** Safe to embed inside a <script> element. */
const LINE_SEPARATORS = new RegExp(String.fromCharCode(0x2028) + "|" + String.fromCharCode(0x2029), "g");
const inlineJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, "");
/** The page served at the edit URL: the site in an iframe, with the editor UI around it. */
function shellHtml(config) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Editing</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #fff; }
  body { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  [hidden] { display: none !important; }
  #site { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; }
  #hover {
    position: fixed; pointer-events: none; border-radius: 4px;
    outline: 1.5px dashed #6366f1; background: rgba(99, 102, 241, 0.08);
  }
  /* Text the editor cannot place in the source: grey, so it reads as "not this one". */
  #hover.blocked { outline: 1.5px dotted #a1a1aa; background: rgba(161, 161, 170, 0.14); }
  .panel {
    position: fixed; color: #fafafa; background: #18181b; border: 1px solid #3f3f46;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }
  #bar {
    left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; align-items: center;
    gap: 6px; padding: 6px; border-radius: 999px; white-space: nowrap; max-width: calc(100vw - 24px);
  }
  #count { padding: 0 10px 0 12px; color: #a1a1aa; font-variant-numeric: tabular-nums; }
  #count.dirty { color: #fafafa; }
  #count.dirty::before {
    content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 8px;
    border-radius: 50%; background: #f59e0b; vertical-align: 1px;
  }
  button {
    font: inherit; color: inherit; height: 32px; padding: 0 14px; border-radius: 999px;
    border: 1px solid transparent; background: transparent; cursor: pointer;
  }
  button:hover:not(:disabled) { background: #27272a; }
  button:focus-visible, input:focus-visible { outline: 2px solid #818cf8; outline-offset: 1px; }
  button:disabled { opacity: 0.4; cursor: default; }
  #save { background: #6366f1; font-weight: 600; }
  #save:hover:not(:disabled) { background: #4f46e5; }
  #browse[aria-pressed="true"] { background: #fafafa; color: #18181b; }
  .divider { width: 1px; height: 18px; background: #3f3f46; }
  @media (max-width: 520px) {
    #bar { gap: 2px; padding: 4px; font-size: 13px; }
    #bar button { height: 40px; padding: 0 10px; }
    #count { padding: 0 6px 0 10px; overflow: hidden; text-overflow: ellipsis; }
    #bar .divider, #undo { display: none; }
    #toast { bottom: 68px; }
  }
  #popover { width: min(360px, calc(100vw - 16px)); box-sizing: border-box; padding: 12px; border-radius: 12px; }
  #popover label { display: block; margin-bottom: 6px; font-size: 12px; color: #a1a1aa; }
  #popover .row { display: flex; gap: 6px; }
  #url {
    flex: 1; min-width: 0; height: 32px; padding: 0 10px; font: inherit; color: inherit;
    background: #27272a; border: 1px solid #3f3f46; border-radius: 8px;
  }
  #open { border-color: #3f3f46; border-radius: 8px; }
  #url-hint { margin-top: 6px; font-size: 12px; color: #fca5a5; }
  #url-hint:empty { display: none; }
  #toast {
    left: 50%; bottom: 72px; transform: translateX(-50%); padding: 8px 14px; border-radius: 10px;
    max-width: min(520px, calc(100vw - 24px)); text-align: center;
  }
</style>
</head>
<body>
<iframe id="site" title="Site being edited"></iframe>
<div id="hover" hidden></div>
<div id="popover" class="panel" hidden>
  <label for="url">Link URL</label>
  <div class="row">
    <input id="url" type="text" spellcheck="false" autocomplete="off">
    <button id="open" type="button">Open link</button>
  </div>
  <div id="url-hint"></div>
</div>
<div id="toast" class="panel" role="status" hidden></div>
<div id="bar" class="panel" role="toolbar" aria-label="Editor">
  <span id="count">No changes</span>
  <button id="browse" type="button" aria-pressed="false" title="Let clicks through to the site, for menus and navigation">Browse</button>
  <span class="divider"></span>
  <button id="undo" type="button" title="Undo the last change (Ctrl+Z)">Undo</button>
  <button id="discard" type="button">Discard</button>
  <button id="save" type="button">Save</button>
  <button id="exit" type="button">Exit</button>
</div>
<script>window.__cmsConfig = ${inlineJson(config)};</script>
<script src="${config.api}/editor.js"></script>
</body>
</html>`;
}
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** The password prompt shown at the edit URL when nobody is signed in. */
function loginHtml(options) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sign in to edit</title>
<style>
  :root { color-scheme: light dark; --bg: #fafafa; --card: #fff; --line: #e4e4e7; --text: #18181b; --muted: #71717a; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #09090b; --card: #18181b; --line: #3f3f46; --text: #fafafa; --muted: #a1a1aa; }
  }
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; padding: 16px; box-sizing: border-box;
    background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  form {
    width: min(360px, 100%); box-sizing: border-box; padding: 28px; background: var(--card);
    border: 1px solid var(--line); border-radius: 16px;
  }
  h1 { margin: 0 0 4px; font-size: 18px; }
  p { margin: 0 0 20px; color: var(--muted); }
  label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; }
  input {
    width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px; font: inherit; color: inherit;
    background: transparent; border: 1px solid var(--line); border-radius: 10px;
  }
  button {
    width: 100%; height: 40px; margin-top: 16px; font: inherit; font-weight: 600; color: #fff;
    background: #6366f1; border: 0; border-radius: 10px; cursor: pointer;
  }
  button:hover { background: #4f46e5; }
  input:focus-visible, button:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }
  .error { margin: 12px 0 0; color: #dc2626; font-size: 13px; }
</style>
</head>
<body>
<form method="post" action="${escapeHtml(options.action)}">
  <h1>Sign in to edit</h1>
  <p>Enter the editor password for this site.</p>
  <input type="hidden" name="next" value="${escapeHtml(options.next)}">
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
  ${options.error ? `<div class="error" role="alert">${escapeHtml(options.error)}</div>` : ''}
  <button type="submit">Sign in</button>
</form>
</body>
</html>`;
}
