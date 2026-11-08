#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PY=python3
command -v $PY >/dev/null 2>&1 || {
    echo "[X] 未找到 python3，请先安装：sudo apt install python3"
    exit 1
}

if ! $PY -c "import flask" >/dev/null 2>&1; then
    echo "首次运行：安装 Flask ..."
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y python3-flask
    elif $PY -m pip --version >/dev/null 2>&1; then
        $PY -m pip install --user flask --quiet --disable-pip-version-check 2>/dev/null \
            || $PY -m pip install --user --break-system-packages flask --quiet --disable-pip-version-check
    else
        echo "[X] 无法自动安装 Flask，请手动执行：sudo apt install python3-flask"
        exit 1
    fi
fi

exec $PY app.py
