#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PY=python3
command -v $PY >/dev/null 2>&1 || {
    echo "[X] 未找到 python3，请先安装：sudo apt install python3 python3-pip"
    exit 1
}

$PY -c "import flask" >/dev/null 2>&1 || {
    echo "首次运行：安装 Flask ..."
    $PY -m pip install --user flask --quiet --disable-pip-version-check 2>/dev/null \
        || $PY -m pip install --user --break-system-packages flask --quiet --disable-pip-version-check \
        || { echo "[X] Flask 安装失败，请手动执行：pip3 install --user flask"; exit 1; }
}

exec $PY app.py
