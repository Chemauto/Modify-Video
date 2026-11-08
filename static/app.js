/* Modify Video 前端逻辑 */
"use strict";

const $ = (s) => document.querySelector(s);
const el = {
  envBadge: $("#envBadge"),
  empty: $("#empty"), player: $("#player"),
  btnPick: $("#btnPick"), btnLoad: $("#btnLoad"), pathInput: $("#pathInput"),
  video: $("#video"), meta: $("#meta"),
  tl: $("#tl"), sel: $("#sel"), dimL: $("#dimL"), dimR: $("#dimR"),
  hA: $("#hA"), hB: $("#hB"), ph: $("#ph"), ruler: $("#ruler"), film: $("#film"),
  tA: $("#tA"), tB: $("#tB"), tCur: $("#tCur"), selLabel: $("#selLabel"),
  btnPlay: $("#btnPlay"), icPlay: $("#icPlay"), icPause: $("#icPause"), playLabel: $("#playLabel"),
  btnSetIn: $("#btnSetIn"), btnSetOut: $("#btnSetOut"), btnReset: $("#btnReset"),
  chkLoop: $("#chkLoop"), btnChange: $("#btnChange"),
  fmtSeg: $("#fmtSeg"), fmtNote: $("#fmtNote"),
  gifOpts: $("#gifOpts"), gifFps: $("#gifFps"), gifFpsVal: $("#gifFpsVal"), gifWidth: $("#gifWidth"),
  speed: $("#speed"), speedVal: $("#speedVal"), speedChips: $("#speedChips"),
  btnExport: $("#btnExport"),
  prog: $("#prog"), progBar: $("#progBar"), progText: $("#progText"), btnCancel: $("#btnCancel"),
  result: $("#result"), okLineText: $("#okLineText"), outPath: $("#outPath"),
  btnReveal: $("#btnReveal"), btnPreviewOut: $("#btnPreviewOut"), btnBackEdit: $("#btnBackEdit"),
  btnUpdate: $("#btnUpdate"), updatePanel: $("#updatePanel"),
  dropOverlay: $("#dropOverlay"), toast: $("#toast"),
};

const state = {
  path: null,
  info: null,
  duration: 0,
  selA: 0,
  selB: 0,
  format: "mp4",
  speed: 1,
  exporting: false,
  outputPath: null,
  pollTimer: null,
  prevPath: null,
  previewPending: false,
};

/* ---------------- 工具函数 ---------------- */
function fmtTime(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}
function fmtSize(n) {
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
  return (n / 1024).toFixed(0) + " KB";
}
let toastTimer = null;
function toast(msg, isErr = false) {
  el.toast.textContent = msg;
  el.toast.className = isErr ? "err show" : "show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.className = ""; }, isErr ? 5000 : 2600);
}
async function postJSON(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `请求失败 (${r.status})`);
  return j;
}

/* ---------------- 环境检查 ---------------- */
(async () => {
  try {
    const j = await (await fetch("/api/env")).json();
    if (j.ffmpeg) {
      el.envBadge.textContent = "FFmpeg 已就绪";
      el.envBadge.className = "env ok";
    } else {
      el.envBadge.textContent = "未找到 FFmpeg，无法导出";
      el.envBadge.className = "env bad";
    }
  } catch {
    el.envBadge.textContent = "后端连接失败";
    el.envBadge.className = "env bad";
  }
})();

/* ---------------- 文件载入 ---------------- */
function setFile(path, info, fromPreview = false) {
  state.path = path;
  state.info = info;
  state.outputPath = null;
  el.empty.hidden = true;
  el.player.hidden = false;
  el.btnExport.disabled = false;

  el.video.src = "/media?path=" + encodeURIComponent(path);
  if (info.thumb) {
    el.film.style.backgroundImage = `url("${info.thumb}")`;
    el.film.classList.remove("no-thumb");
  } else {
    el.film.style.backgroundImage = "";
    el.film.classList.add("no-thumb");
  }
  el.meta.textContent =
    `${info.name} · ${info.width || "?"}×${info.height || "?"} · ${fmtSize(info.size)}` +
    (info.hasAudio ? "" : " · 无音轨");

  if (fromPreview) {
    el.result.hidden = false;
    el.okLineText.textContent = "正在预览导出结果";
    el.outPath.textContent = path;
    el.btnBackEdit.hidden = !state.prevPath;
  } else {
    el.result.hidden = true;
    state.prevPath = null;
    el.btnBackEdit.hidden = true;
  }
}

async function loadPath(path, fromPreview = false) {
  if (!path) return;
  try {
    const j = await postJSON("/api/load", { path });
    setFile(j.path, j.info, fromPreview);
  } catch (e) {
    toast(e.message, true);
  }
}

el.btnPick.addEventListener("click", async () => {
  try {
    const r = await fetch("/api/pick", { method: "POST" });
    const j = await r.json();
    if (j.error) {
      toast(j.error, true);
      el.pathInput.focus();
      return;
    }
    if (j.path) setFile(j.path, j.info);
  } catch (e) {
    toast(e.message, true);
  }
});
el.btnLoad.addEventListener("click", () => loadPath(el.pathInput.value.trim()));
el.pathInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loadPath(el.pathInput.value.trim()); });
el.btnChange.addEventListener("click", () => {
  el.video.pause();
  el.video.removeAttribute("src");
  el.video.load();
  state.path = null;
  el.player.hidden = true;
  el.empty.hidden = false;
});

/* 拖放上传 */
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
  dragDepth++;
  el.dropOverlay.hidden = false;
});
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) el.dropOverlay.hidden = true;
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  el.dropOverlay.hidden = true;
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  uploadFile(f);
});

function uploadFile(f) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  el.prog.hidden = false;
  el.progText.textContent = "正在载入文件…";
  el.btnExport.disabled = true;
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const p = Math.round((e.loaded / e.total) * 100);
      el.progBar.style.width = p + "%";
      el.progText.textContent = `正在载入文件 ${p}%`;
    }
  };
  xhr.onload = () => {
    el.prog.hidden = true;
    el.progBar.style.width = "0%";
    el.btnExport.disabled = false;
    try {
      const j = JSON.parse(xhr.responseText);
      if (xhr.status >= 400 || j.error) return toast(j.error || "上传失败", true);
      setFile(j.path, j.info);
    } catch { toast("上传失败", true); }
  };
  xhr.onerror = () => {
    el.prog.hidden = true;
    el.btnExport.disabled = false;
    toast("上传失败", true);
  };
  const fd = new FormData();
  fd.append("file", f);
  xhr.send(fd);
}

/* ---------------- 预览与时间轴 ---------------- */
el.video.addEventListener("loadedmetadata", () => {
  const d = isFinite(el.video.duration) && el.video.duration > 0 ? el.video.duration : (state.info?.duration || 0);
  state.duration = d;
  state.selA = 0;
  state.selB = d;
  el.video.playbackRate = state.speed;
  renderTL();
  renderRuler();
  updateSelLabel();
  if (state.previewPending) {
    state.previewPending = false;
    el.video.currentTime = state.selA;
    const p = el.video.play();
    if (p && p.catch) p.catch(() => {});
    el.okLineText.textContent = "正在预览导出结果（播放中，可拖动时间轴检查）";
  }
});
el.video.addEventListener("timeupdate", () => {
  el.tCur.textContent = fmtTime(el.video.currentTime);
  el.ph.style.left = pct(el.video.currentTime) + "%";
  if (!el.video.paused && el.video.currentTime >= state.selB - 0.02) {
    if (el.chkLoop.checked && state.selB - state.selA > 0.1) {
      el.video.currentTime = state.selA;
    } else {
      el.video.pause();
    }
  }
});
el.video.addEventListener("play", () => setPlayIcon(true));
el.video.addEventListener("pause", () => setPlayIcon(false));
el.video.addEventListener("ended", () => {
  if (el.chkLoop.checked && state.selB - state.selA > 0.1) {
    el.video.currentTime = state.selA;
    const p = el.video.play();
    if (p && p.catch) p.catch(() => {});
  }
});

function setPlayIcon(playing) {
  el.icPlay.style.display = playing ? "none" : "";
  el.icPause.style.display = playing ? "" : "none";
  el.playLabel.textContent = playing ? "暂停" : "播放";
}

function pct(t) { return state.duration ? (t / state.duration) * 100 : 0; }

function fmtRuler(t) {
  t = Math.round(t * 10) / 10;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  if (m > 0) return `${m}:${String(Math.round(s)).padStart(2, "0")}`;
  return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
}

function renderRuler() {
  el.ruler.innerHTML = "";
  const dur = state.duration;
  if (!dur) return;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
  const step = steps.find((s) => dur / s <= 8) || 3600;
  for (let t = 0; t <= dur + 1e-6; t += step) {
    const pos = pct(t);
    const tick = document.createElement("div");
    tick.className = "tl-tick";
    tick.style.left = pos + "%";
    const lab = document.createElement("span");
    lab.className = "tl-tick-label";
    lab.textContent = fmtRuler(t);
    if (pos < 2) lab.style.transform = "translateX(0)";
    else if (pos > 98) lab.style.transform = "translateX(-100%)";
    tick.appendChild(lab);
    el.ruler.appendChild(tick);
  }
}

function renderTL() {
  const a = pct(state.selA), b = pct(state.selB);
  el.sel.style.left = a + "%";
  el.sel.style.width = (b - a) + "%";
  el.dimL.style.left = "0%";
  el.dimL.style.width = a + "%";
  el.dimR.style.left = b + "%";
  el.dimR.style.width = (100 - b) + "%";
  el.hA.style.left = a + "%";
  el.hB.style.left = b + "%";
  el.tA.textContent = fmtTime(state.selA);
  el.tB.textContent = fmtTime(state.selB);
  updateSelLabel();
}
function updateSelLabel() {
  el.selLabel.textContent = `已选 ${fmtTime(state.selA)} – ${fmtTime(state.selB)}（${(state.selB - state.selA).toFixed(1)} 秒）`;
}
function clampSel() {
  state.selA = Math.max(0, Math.min(state.selA, state.selB - 0.05));
  state.selB = Math.min(state.duration, Math.max(state.selB, state.selA + 0.05));
}

el.btnPlay.addEventListener("click", () => {
  if (el.video.paused) {
    if (el.video.currentTime >= state.selB - 0.05 || el.video.currentTime < state.selA) {
      el.video.currentTime = state.selA;
    }
    el.video.play();
  } else {
    el.video.pause();
  }
});
el.btnSetIn.addEventListener("click", () => {
  state.selA = Math.min(el.video.currentTime, state.selB - 0.05);
  clampSel(); renderTL();
});
el.btnSetOut.addEventListener("click", () => {
  state.selB = Math.max(el.video.currentTime, state.selA + 0.05);
  clampSel(); renderTL();
});
el.btnReset.addEventListener("click", () => {
  state.selA = 0;
  state.selB = state.duration;
  renderTL();
});

/* 时间轴拖拽 */
function tlPos(e) {
  const rect = el.tl.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  return ratio * state.duration;
}
function scrubTo(t) {
  el.video.currentTime = t;
  el.tCur.textContent = fmtTime(t);
  el.ph.style.left = pct(t) + "%";
}
el.hA.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  el.hA.classList.add("dragging");
  el.hA.setPointerCapture(e.pointerId);
  const move = (ev) => {
    state.selA = Math.min(tlPos(ev), state.selB - 0.05);
    clampSel(); renderTL(); scrubTo(state.selA);
  };
  const up = () => {
    el.hA.classList.remove("dragging");
    el.hA.removeEventListener("pointermove", move);
    el.hA.removeEventListener("pointerup", up);
  };
  el.hA.addEventListener("pointermove", move);
  el.hA.addEventListener("pointerup", up);
});
el.hB.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  el.hB.classList.add("dragging");
  el.hB.setPointerCapture(e.pointerId);
  const move = (ev) => {
    state.selB = Math.max(tlPos(ev), state.selA + 0.05);
    clampSel(); renderTL(); scrubTo(state.selB);
  };
  const up = () => {
    el.hB.classList.remove("dragging");
    el.hB.removeEventListener("pointermove", move);
    el.hB.removeEventListener("pointerup", up);
  };
  el.hB.addEventListener("pointermove", move);
  el.hB.addEventListener("pointerup", up);
});
el.tl.addEventListener("pointerdown", (e) => {
  scrubTo(tlPos(e));
  const move = (ev) => scrubTo(tlPos(ev));
  const up = () => {
    el.tl.removeEventListener("pointermove", move);
    el.tl.removeEventListener("pointerup", up);
  };
  el.tl.addEventListener("pointermove", move);
  el.tl.addEventListener("pointerup", up);
});

/* ---------------- 导出设置 ---------------- */
const FORMAT_NOTES = {
  mp4: "画质与原片一致时将直接流复制，速度极快",
  webm: "VP9 编码，体积小、网页友好",
  gif: "动图导出，自动生成优化调色板",
  mkv: "Matroska 容器，兼容多种编码",
  avi: "传统格式，兼容老设备",
  mov: "QuickTime 容器，适合苹果生态",
};
el.fmtSeg.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-fmt]");
  if (!btn) return;
  el.fmtSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  state.format = btn.dataset.fmt;
  el.fmtNote.textContent = FORMAT_NOTES[state.format] || "";
  el.gifOpts.hidden = state.format !== "gif";
});
el.gifFps.addEventListener("input", () => { el.gifFpsVal.textContent = el.gifFps.value; });

function setSpeed(v) {
  state.speed = Math.min(4, Math.max(0.25, v));
  el.speed.value = state.speed;
  el.speedVal.textContent = state.speed.toFixed(2) + "×";
  el.video.playbackRate = state.speed;
  el.speedChips.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", Math.abs(parseFloat(b.dataset.speed) - state.speed) < 0.001));
  paintRange(el.speed);
}
el.speed.addEventListener("input", () => setSpeed(parseFloat(el.speed.value)));
el.speedChips.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-speed]");
  if (btn) setSpeed(parseFloat(btn.dataset.speed));
});
function paintRange(input) {
  const min = parseFloat(input.min), max = parseFloat(input.max);
  input.style.setProperty("--fill", ((input.value - min) / (max - min)) * 100 + "%");
}
paintRange(el.speed);
paintRange(el.gifFps);
el.gifFps.addEventListener("input", () => paintRange(el.gifFps));

/* ---------------- 导出流程 ---------------- */
el.btnExport.addEventListener("click", async () => {
  if (!state.path || state.exporting) return;
  if (state.selB - state.selA < 0.05) return toast("所选时间范围太短", true);
  state.exporting = true;
  el.btnExport.disabled = true;
  el.result.hidden = true;
  el.prog.hidden = false;
  el.progBar.style.width = "0%";
  el.progText.textContent = "正在处理…";
  try {
    await postJSON("/api/export", {
      path: state.path,
      start: state.selA,
      end: state.selB,
      speed: state.speed,
      format: state.format,
      gifFps: parseInt(el.gifFps.value, 10),
      gifWidth: parseInt(el.gifWidth.value, 10),
    });
    pollStatus();
  } catch (e) {
    state.exporting = false;
    el.btnExport.disabled = false;
    el.prog.hidden = true;
    toast(e.message, true);
  }
});

function pollStatus() {
  clearTimeout(state.pollTimer);
  state.pollTimer = setTimeout(async () => {
    try {
      const j = await (await fetch("/api/status")).json();
      if (j.running) {
        el.progBar.style.width = (j.progress || 0) + "%";
        el.progText.textContent = `正在处理 ${j.progress || 0}%`;
        pollStatus();
        return;
      }
      el.prog.hidden = true;
      el.progBar.style.width = "0%";
      state.exporting = false;
      el.btnExport.disabled = false;
      if (j.output) {
        state.outputPath = j.output;
        el.outPath.textContent = j.output;
        el.result.hidden = false;
        toast("导出完成 🎉");
      } else if (j.error) {
        toast(`导出失败：${j.error}`, true);
      }
    } catch {
      pollStatus();
    }
  }, 400);
}

el.btnCancel.addEventListener("click", async () => {
  try { await postJSON("/api/cancel"); } catch {}
  el.prog.hidden = true;
  state.exporting = false;
  el.btnExport.disabled = false;
  toast("已取消导出");
});

el.btnReveal.addEventListener("click", async () => {
  if (!state.outputPath) return;
  try { await postJSON("/api/reveal", { path: state.outputPath }); } catch (e) { toast(e.message, true); }
});

el.btnPreviewOut.addEventListener("click", () => {
  if (!state.outputPath) return;
  state.prevPath = state.path;
  state.previewPending = true;
  toast("正在载入导出结果…");
  loadPath(state.outputPath, true);
});

el.btnBackEdit.addEventListener("click", () => {
  if (!state.prevPath) return;
  loadPath(state.prevPath);
});

/* ---------------- 检查更新 ---------------- */
const UP = { open: false, data: null, busy: false };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cleanNotes = (s) => String(s || "")
  .replace(/\r/g, "").replace(/^#+\s*/gm, "").replace(/\*\*/g, "").replace(/`/g, "").trim();
const pickAsset = (assets, re) => (assets || []).find((a) => re.test(a.name));
const fmtMB = (n) => (n / 1048576).toFixed(0) + " MB";

el.btnUpdate.addEventListener("click", () => {
  UP.open = !UP.open;
  el.updatePanel.hidden = !UP.open;
  if (UP.open) {
    if (!UP.data && !UP.busy) runCheck();
    else renderUpdate();
  }
});

document.addEventListener("click", (e) => {
  if (!UP.open) return;
  if (el.updatePanel.contains(e.target) || el.btnUpdate.contains(e.target)) return;
  UP.open = false;
  el.updatePanel.hidden = true;
});

function runCheck() {
  UP.busy = true;
  renderUpdate({ phase: "checking" });
  fetch("/api/update/check")
    .then((r) => r.json())
    .then((j) => { UP.busy = false; UP.data = j; renderUpdate(); })
    .catch((e) => { UP.busy = false; renderUpdate({ phase: "error", message: e.message }); });
}

function updateHead(title) {
  return `<div class="update-head"><span>${title}</span>
    <button class="update-close" id="updClose" title="关闭">✕</button></div>`;
}

function renderUpdate(o = {}) {
  const p = el.updatePanel;
  if (o.phase === "checking") {
    p.innerHTML = updateHead("检查更新") + `<div class="update-ver">正在连接 GitHub…</div>`;
  } else if (o.phase === "error" || (UP.data && UP.data.error)) {
    const msg = esc(o.message || (UP.data && UP.data.error) || "未知错误");
    p.innerHTML = updateHead("检查更新") +
      `<div class="update-ver">检查失败：${msg}</div>
       <div class="update-actions"><button id="updRetry" class="btn">重试</button></div>`;
  } else {
    const d = UP.data;
    const verLine = d.updateAvailable
      ? `发现新版本 <b>${esc(d.latest)}</b>（当前 v${esc(d.current)}）`
      : `已是最新版本 v${esc(d.current)}`;
    let html = updateHead(d.updateAvailable ? "发现更新" : "检查更新") +
      `<div class="update-ver">${verLine}</div>`;
    if (d.updateAvailable && d.notes) {
      html += `<div class="update-notes">${esc(cleanNotes(d.notes))}</div>`;
    }
    const acts = [];
    if (d.updateAvailable) {
      if (d.mode === "exe") {
        const a = pickAsset(d.assets, /-setup\.exe$/);
        if (a) acts.push(`<button id="updDl" class="btn primary" data-url="${esc(a.url)}" data-size="${a.size}">下载并运行安装程序${a.size ? `（${fmtMB(a.size)}）` : ""}</button>`);
      } else if (d.mode === "system") {
        const a = pickAsset(d.assets, /_all\.deb$/);
        if (a) acts.push(`<button id="updDl" class="btn primary" data-url="${esc(a.url)}" data-size="${a.size}">下载 deb 安装包${a.size ? `（${fmtMB(a.size)}）` : ""}</button>`);
      } else if (d.mode === "source") {
        acts.push(`<button id="updGit" class="btn primary">通过 git 同步更新</button>`);
      }
    } else if (d.mode === "source") {
      acts.push(`<button id="updGit" class="btn">同步代码（git pull）</button>`);
    }
    if (d.url) acts.push(`<button id="updPage" class="btn ghost">打开发布页</button>`);
    html += `<div class="update-actions">${acts.join("")}</div><div id="updMsg"></div>`;
    p.innerHTML = html;
  }

  const q = (s) => p.querySelector(s);
  const close = q("#updClose");
  if (close) close.addEventListener("click", () => { UP.open = false; el.updatePanel.hidden = true; });
  const retry = q("#updRetry");
  if (retry) retry.addEventListener("click", runCheck);

  const dl = q("#updDl");
  if (dl) dl.addEventListener("click", async () => {
    if (UP.busy) return;
    UP.busy = true;
    dl.disabled = true;
    const size = dl.dataset.size;
    dl.textContent = `正在下载…（${fmtMB(size)}，请稍候）`;
    const msg = q("#updMsg");
    try {
      const j = await postJSON("/api/update/download", { url: dl.dataset.url });
      UP.busy = false;
      if (j.launched) {
        toast("安装程序已启动，请按提示完成更新（应用会自动重启）");
        UP.open = false;
        el.updatePanel.hidden = true;
      } else {
        msg.innerHTML = `<div class="update-cmd"><span>sudo apt install -y &quot;${esc(j.path)}&quot;</span>
          <button id="updCopy" class="btn">复制命令</button></div>
          <p class="hint">安装包已下载，执行上方命令完成升级</p>`;
        const cp = q("#updCopy");
        if (cp) cp.addEventListener("click", () => {
          navigator.clipboard.writeText(`sudo apt install -y "${j.path}"`).then(() => toast("已复制"));
        });
      }
    } catch (e) {
      UP.busy = false;
      dl.disabled = false;
      msg.innerHTML = `<p class="hint">${esc(e.message)}</p>`;
    }
  });

  const git = q("#updGit");
  if (git) git.addEventListener("click", async () => {
    if (UP.busy) return;
    UP.busy = true;
    git.disabled = true;
    git.textContent = "正在同步…";
    const msg = q("#updMsg");
    try {
      const j = await postJSON("/api/update/gitpull");
      UP.busy = false;
      msg.innerHTML = `<p class="hint">${esc(j.output || (j.ok ? "已同步到最新代码" : "同步失败"))}${j.ok ? "，请重启应用生效" : ""}</p>`;
      if (j.ok) toast("代码已同步，重启应用后生效");
    } catch (e) {
      UP.busy = false;
      msg.innerHTML = `<p class="hint">${esc(e.message)}</p>`;
      git.disabled = false;
      git.textContent = "通过 git 同步更新";
    }
  });

  const page = q("#updPage");
  if (page) page.addEventListener("click", () => {
    const d = UP.data;
    if (d && d.url) window.open(d.url, "_blank");
  });
}
