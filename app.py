# -*- coding: utf-8 -*-
"""Modify Video —— 本地视频剪辑工具（FFmpeg 后端）"""
import base64
import json
import os
import platform as platform_mod
import re
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import urllib.request
import webbrowser
import zipfile

from flask import Flask, jsonify, request, send_file, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
BIN_DIR = os.path.join(BASE_DIR, "bin")
os.makedirs(UPLOAD_DIR, exist_ok=True)

VIDEO_EXTS = {
    ".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi", ".flv",
    ".ts", ".wmv", ".mpg", ".mpeg", ".3gp", ".gif",
}
EXPORT_FORMATS = {"mp4", "webm", "gif", "mkv", "avi", "mov"}

MIMETYPES = {
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
    ".mov": "video/quicktime", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
    ".gif": "image/gif", ".flv": "video/x-flv", ".ts": "video/mp2t",
    ".wmv": "video/x-ms-wmv", ".mpg": "video/mpeg", ".mpeg": "video/mpeg",
    ".3gp": "video/3gpp",
}

# 输出格式 -> ffprobe format_name 的成员，用于判断能否流复制（免转码快速导出）
CONTAINER_KEYS = {
    "mp4": {"mp4", "m4a", "m4v", "3gp", "3g2", "mj2"},
    "mov": {"mov", "mp4", "m4a", "3gp", "3g2", "mj2"},
    "webm": {"webm"},
    "mkv": {"matroska"},
    "avi": {"avi"},
    "gif": {"gif"},
}


# FFmpeg 自动下载：优先使用本项目 Releases 中的资源包，失败时回退到官方上游构建
RELEASE_BASE = "https://github.com/Chemauto/Modify-Video/releases/download/v1.0.0/"
PLATFORM_ASSETS = {
    ("windows", "amd64"): ("ffmpeg-win64.zip",
                           "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"),
    ("linux", "amd64"): ("ffmpeg-linux64.tar.xz",
                         "https://www.johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"),
}


def find_tool(name):
    found = shutil.which(name)
    if found:
        return found
    exe = name + (".exe" if os.name == "nt" else "")
    local = os.path.join(BIN_DIR, exe)
    return local if os.path.isfile(local) else None


FFMPEG = find_tool("ffmpeg")
FFPROBE = find_tool("ffprobe")
CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def platform_key():
    system = sys.platform
    machine = (platform_mod.machine() or "").lower()
    if system.startswith("win") and machine in ("amd64", "x86_64"):
        return ("windows", "amd64")
    if system.startswith("linux") and machine in ("amd64", "x86_64"):
        return ("linux", "amd64")
    return None


def download_with_progress(url, dest):
    print(f"正在下载 FFmpeg：{url}")
    req = urllib.request.Request(url, headers={"User-Agent": "ModifyVideo/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = r.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r下载进度 {done * 100 // total}% ({done // 1048576}/{total // 1048576} MB)", end="", flush=True)
    print()


def extract_tools(archive, dest_dir):
    """从 zip / tar 包中提取 ffmpeg 与 ffprobe 到 dest_dir，兼容包内任意层级"""
    names = {"ffmpeg", "ffprobe"}
    suffix = ".exe" if os.name == "nt" else ""
    found = {}
    with open(archive, "rb") as f:
        is_zip = f.read(2) == b"PK"
    opener = zipfile.ZipFile(archive) if is_zip else tarfile.open(archive)
    with opener:
        members = (opener.infolist() if hasattr(opener, "infolist") else opener.getmembers())
        for m in members:
            base = os.path.basename(m.filename if hasattr(m, "filename") else m.name)
            stem, ext = os.path.splitext(base)
            if stem in names and ext.lower() in ("", ".exe") and stem not in found:
                is_file = m.file_size > 0 if hasattr(m, "file_size") else m.isfile()
                if not is_file:
                    continue
                target = os.path.join(dest_dir, stem + suffix)
                if is_zip:
                    src = opener.open(m)
                else:
                    src = opener.extractfile(m)
                with src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
                if suffix == "":
                    os.chmod(target, 0o755)
                found[stem] = target
    return found


def ensure_tools():
    """定位 ffmpeg/ffprobe；缺失时从 Releases 下载到 bin/ 目录"""
    global FFMPEG, FFPROBE
    FFMPEG, FFPROBE = find_tool("ffmpeg"), find_tool("ffprobe")
    if FFMPEG and FFPROBE:
        return True
    key = platform_key()
    if key is None:
        print(f"[X] 暂不支持的平台：{sys.platform} / {platform_mod.machine()}")
        return False
    asset, upstream = PLATFORM_ASSETS[key]
    os.makedirs(BIN_DIR, exist_ok=True)
    tmp = os.path.join(BIN_DIR, "_ffmpeg_download.tmp")
    for url in (RELEASE_BASE + asset, upstream):
        try:
            download_with_progress(url, tmp)
            found = extract_tools(tmp, BIN_DIR)
            if os.path.exists(tmp):
                os.remove(tmp)
            if "ffmpeg" in found and "ffprobe" in found:
                FFMPEG, FFPROBE = find_tool("ffmpeg"), find_tool("ffprobe")
                if FFMPEG and FFPROBE:
                    return True
        except Exception as e:
            print(f"下载失败：{e}")
    return False

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 ** 3
try:
    app.json.ensure_ascii = False
except Exception:
    app.config["JSON_AS_ASCII"] = False

job = {"running": False, "progress": 0.0, "message": "", "output": "", "error": "", "cancel": False, "proc": None}
job_lock = threading.Lock()
last_dir = {"path": os.path.expanduser("~")}

_encoder_cache = {}


def has_encoder(name):
    if name not in _encoder_cache:
        r = subprocess.run([FFMPEG, "-hide_banner", "-encoders"], capture_output=True,
                           encoding="utf-8", errors="replace", creationflags=CREATE_NO_WINDOW)
        _encoder_cache[name] = name in (r.stdout or "")
    return _encoder_cache[name]


def probe(path):
    cmd = [FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]
    r = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace",
                       creationflags=CREATE_NO_WINDOW)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or "ffprobe 解析失败").strip()[-300:])
    data = json.loads(r.stdout)
    fmt = data.get("format", {})
    width = height = 0
    has_audio = False
    for s in data.get("streams", []):
        if s.get("codec_type") == "video" and not width:
            width = s.get("width") or 0
            height = s.get("height") or 0
        elif s.get("codec_type") == "audio":
            has_audio = True
    return {
        "path": path,
        "name": os.path.basename(path),
        "dir": os.path.dirname(path),
        "size": os.path.getsize(path),
        "duration": float(fmt.get("duration") or 0),
        "width": width,
        "height": height,
        "hasAudio": has_audio,
        "formatName": fmt.get("format_name", ""),
    }


def make_thumb(path, duration):
    """抽取 12 帧拼成胶片条，返回 data URL；失败返回 None"""
    if not duration:
        return None
    n = 12
    fd, tmp = tempfile.mkstemp(suffix=".jpg")
    os.close(fd)
    try:
        cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", path,
               "-vf", f"fps={n}/{duration:.3f},scale=160:-2,tile={n}x1",
               "-frames:v", "1", "-q:v", "5", tmp]
        subprocess.run(cmd, capture_output=True, creationflags=CREATE_NO_WINDOW, timeout=60)
        if os.path.isfile(tmp) and os.path.getsize(tmp) > 0:
            with open(tmp, "rb") as f:
                return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
    except Exception:
        pass
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    return None


def media_info(path, with_thumb=False):
    if not path or not os.path.isfile(path):
        return None
    if os.path.splitext(path)[1].lower() not in VIDEO_EXTS:
        return None
    try:
        info = probe(path)
    except Exception:
        return None
    if with_thumb:
        info["thumb"] = make_thumb(path, info["duration"])
    return info


def atempo_chain(speed):
    """atempo 单级只支持 0.5~2.0，超出范围时级联多级"""
    parts = []
    x = float(speed)
    while x > 2.0:
        parts.append(2.0)
        x /= 2.0
    while x < 0.5:
        parts.append(0.5)
        x *= 2.0
    parts.append(round(x, 4))
    return ",".join(f"atempo={p:g}" for p in parts)


def video_codec_args(fmt):
    if fmt in ("mp4", "mov", "mkv"):
        args = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"]
        if fmt == "mp4":
            args += ["-movflags", "+faststart"]
        return args
    if fmt == "webm":
        audio = "libopus" if has_encoder("libopus") else "libvorbis"
        return ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0",
                "-deadline", "good", "-cpu-used", "4", "-c:a", audio, "-b:a", "128k"]
    if fmt == "avi":
        audio = "libmp3lame" if has_encoder("libmp3lame") else "aac"
        return ["-c:v", "mpeg4", "-qscale:v", "5", "-c:a", audio, "-b:a", "160k"]
    return []


def unique_output_path(src, fmt):
    stem = os.path.splitext(os.path.basename(src))[0]
    directory = os.path.dirname(src)
    candidate = os.path.join(directory, f"{stem}_edited.{fmt}")
    n = 2
    while os.path.exists(candidate):
        candidate = os.path.join(directory, f"{stem}_edited_{n}.{fmt}")
        n += 1
    return candidate


def build_command(cfg):
    src, fmt, out = cfg["path"], cfg["format"], cfg["output"]
    start, speed, mute = cfg["start"], cfg["speed"], cfg["mute"]
    end = cfg.get("end")

    # -ss/-t 必须位于 -i 之前（输入端裁剪）；FFmpeg 7+ 输出端 -t 会在滤镜前截断，
    # 导致 setpts 变速后时长不正确
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1"]
    if start > 0:
        cmd += ["-ss", f"{start:.3f}"]
    if end is not None:
        cmd += ["-t", f"{max(0.05, end - start):.3f}"]
    cmd += ["-i", src]

    if fmt == "gif":
        fps = max(1, int(cfg.get("gifFps") or 12))
        width = int(cfg.get("gifWidth") or 0)
        chain = []
        if speed != 1:
            chain.append(f"setpts=PTS/{speed:g}")
        chain.append(f"fps={fps}")
        if width > 0:
            chain.append(f"scale={width}:-2:flags=lanczos")
        fc = f"[0:v]{','.join(chain)},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"
        cmd += ["-filter_complex", fc, "-an", out]
        return cmd

    src_keys = set((cfg.get("srcFormat") or "").split(","))
    same_container = bool(CONTAINER_KEYS.get(fmt, set()) & src_keys)
    if speed == 1 and not mute and same_container:
        if end is not None:
            cmd += ["-t", f"{max(0.05, end - start):.3f}"]
        cmd += ["-c", "copy", out]
        return cmd

    vf, af = [], []
    if speed != 1:
        vf.append(f"setpts=PTS/{speed:g}")
        af.append(atempo_chain(speed))
    if vf:
        cmd += ["-vf", ",".join(vf)]
    if mute:
        cmd += ["-an"]
    elif af:
        cmd += ["-af", ",".join(af)]
    cmd += video_codec_args(fmt) + [out]
    return cmd


def run_export(cfg):
    proc = None
    try:
        proc = subprocess.Popen(build_command(cfg), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, encoding="utf-8", errors="replace",
                                creationflags=CREATE_NO_WINDOW)
        with job_lock:
            job["proc"] = proc
        total = max(0.01, cfg["total"])
        for line in proc.stdout:
            line = line.strip()
            if line.startswith("out_time_us=") or line.startswith("out_time_ms="):
                try:
                    us = float(line.split("=", 1)[1])
                except ValueError:
                    continue
                with job_lock:
                    job["progress"] = min(99.0, us / 1e6 / total * 100.0)
        err = (proc.stderr.read() or "").strip()
        code = proc.wait()
        with job_lock:
            job["proc"] = None
            job["running"] = False
            if job["cancel"]:
                job["message"] = "已取消"
            elif code == 0 and os.path.isfile(cfg["output"]):
                job["progress"] = 100.0
                job["message"] = "完成"
                job["output"] = cfg["output"]
            else:
                job["error"] = (err.splitlines()[-1][:400] if err else f"ffmpeg 退出码 {code}")
    except Exception as e:
        with job_lock:
            job.update(running=False, proc=None, error=str(e))


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/env")
def api_env():
    ok = bool(FFMPEG and os.path.isfile(FFMPEG))
    version = ""
    if ok:
        r = subprocess.run([FFMPEG, "-version"], capture_output=True, encoding="utf-8",
                           errors="replace", creationflags=CREATE_NO_WINDOW)
        version = (r.stdout or "").splitlines()[0] if r.stdout else ""
    return jsonify({"ffmpeg": ok, "version": version})


@app.post("/api/pick")
def api_pick():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(
            title="选择视频文件",
            initialdir=last_dir["path"],
            filetypes=[("视频文件", "*.mp4 *.m4v *.webm *.mov *.mkv *.avi *.flv *.ts *.wmv *.mpg *.mpeg *.3gp *.gif"),
                       ("所有文件", "*.*")],
        )
        root.destroy()
    except Exception as e:
        return jsonify({"error": f"无法打开文件对话框：{e}"}), 500
    if not path:
        return jsonify({"path": None})
    info = media_info(path, with_thumb=True)
    if not info:
        return jsonify({"error": "请选择支持的视频文件"}), 400
    last_dir["path"] = info["dir"]
    return jsonify({"path": path, "info": info})


@app.post("/api/load")
def api_load():
    body = request.get_json(silent=True) or {}
    path = (body.get("path") or "").strip().strip('"')
    info = media_info(path, with_thumb=True)
    if not info:
        return jsonify({"error": "文件不存在或格式不支持"}), 400
    last_dir["path"] = info["dir"]
    return jsonify({"path": path, "info": info})


@app.post("/api/upload")
def api_upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "未收到文件"}), 400
    name = os.path.basename(f.filename.replace("\\", "/"))
    stem, ext = os.path.splitext(name)
    stem = re.sub(r'[\\/:*?"<>|]', "_", stem) or "video"
    ext = ext.lower()
    if ext not in VIDEO_EXTS:
        return jsonify({"error": f"不支持的格式：{ext or '未知'}"}), 400
    dest = os.path.join(UPLOAD_DIR, stem + ext)
    n = 2
    while os.path.exists(dest):
        dest = os.path.join(UPLOAD_DIR, f"{stem}_{n}{ext}")
        n += 1
    f.save(dest)
    try:
        info = probe(dest)
        info["thumb"] = make_thumb(dest, info["duration"])
    except Exception as e:
        try:
            os.remove(dest)
        except OSError:
            pass
        return jsonify({"error": f"无法解析该文件：{e}"}), 400
    return jsonify({"path": dest, "info": info})


@app.get("/media")
def media():
    path = request.args.get("path", "")
    ext = os.path.splitext(path)[1].lower()
    if not os.path.isfile(path) or ext not in VIDEO_EXTS:
        return "not found", 404
    resp = send_file(path, mimetype=MIMETYPES.get(ext, "application/octet-stream"), conditional=True)
    resp.headers["Accept-Ranges"] = "bytes"
    return resp


@app.post("/api/export")
def api_export():
    with job_lock:
        if job["running"]:
            return jsonify({"error": "已有导出任务正在进行，请先等待完成或取消"}), 409
    body = request.get_json(silent=True) or {}
    path = (body.get("path") or "").strip()
    info = media_info(path)
    if not info:
        return jsonify({"error": "源文件无效"}), 400
    fmt = body.get("format") or "mp4"
    if fmt not in EXPORT_FORMATS:
        return jsonify({"error": f"不支持的输出格式：{fmt}"}), 400
    try:
        start = max(0.0, float(body.get("start") or 0))
        speed = float(body.get("speed") or 1)
        end = body.get("end")
        end = None if end in (None, "") else float(end)
    except (TypeError, ValueError):
        return jsonify({"error": "参数错误"}), 400
    if speed <= 0:
        return jsonify({"error": "速度必须大于 0"}), 400
    duration = info["duration"] or 0
    if duration and end is not None:
        end = min(end, duration)
    if end is not None and end - start < 0.05:
        return jsonify({"error": "所选时间范围太短"}), 400

    total_span = (end - start) if end is not None else max(0.05, duration - start)
    cfg = {
        "path": path, "start": start, "end": end, "speed": speed, "format": fmt,
        "mute": bool(body.get("mute")),
        "gifFps": body.get("gifFps"), "gifWidth": body.get("gifWidth"),
        "srcFormat": info["formatName"],
        "output": unique_output_path(path, fmt),
        "total": max(0.01, total_span / speed),
    }
    with job_lock:
        job.update(running=True, progress=0.0, message="正在处理…", output="", error="", cancel=False)
    threading.Thread(target=run_export, args=(cfg,), daemon=True).start()
    return jsonify({"ok": True, "output": cfg["output"]})


@app.get("/api/status")
def api_status():
    with job_lock:
        return jsonify({
            "running": job["running"],
            "progress": round(job["progress"], 1),
            "message": job["message"],
            "output": job["output"],
            "error": job["error"],
        })


@app.post("/api/cancel")
def api_cancel():
    with job_lock:
        job["cancel"] = True
        proc = job.get("proc")
    if proc:
        try:
            proc.terminate()
        except Exception:
            pass
    return jsonify({"ok": True})


@app.post("/api/reveal")
def api_reveal():
    path = (request.get_json(silent=True) or {}).get("path", "")
    if not os.path.isfile(path):
        return jsonify({"error": "文件不存在"}), 404
    if os.name == "nt":
        subprocess.Popen(["explorer", "/select,", os.path.normpath(path)])
    else:
        subprocess.Popen(["xdg-open", os.path.dirname(path)])
    return jsonify({"ok": True})


def find_free_port(preferred=8765):
    for p in (preferred, 0):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            return s.getsockname()[1]
        except OSError:
            continue
        finally:
            s.close()
    return preferred


if __name__ == "__main__":
    if not ensure_tools():
        print("[X] FFmpeg 未找到且自动下载失败，请手动安装后重新运行：")
        print("    Windows: winget install Gyan.FFmpeg")
        print("    Ubuntu:  sudo apt install ffmpeg")
        print("    或将 ffmpeg / ffprobe 可执行文件放到 bin\\ 目录下。")
        if os.name == "nt":
            input("按回车键退出…")
        sys.exit(1)

    port = find_free_port()
    url = f"http://127.0.0.1:{port}"
    print(f"Modify Video 运行中：{url}（关闭本窗口即退出）")
    if not os.environ.get("VIDEOCHANGE_NO_BROWSER"):
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
