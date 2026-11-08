@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title Modify Video

where python >nul 2>nul
if errorlevel 1 (
    echo [X] Python not found. Please install Python 3.8+ from https://www.python.org
    echo     Check "Add python.exe to PATH" during installation.
    pause
    exit /b 1
)

python -c "import flask" >nul 2>nul
if errorlevel 1 (
    echo First run: installing Flask ...
    python -m pip install flask --quiet --disable-pip-version-check
    if errorlevel 1 (
        echo [X] Failed to install Flask. Check your network and run again.
        pause
        exit /b 1
    )
)

if not exist "bin\ffmpeg.exe" if not exist "bin\ffprobe.exe" (
    where ffmpeg >nul 2>nul
    if errorlevel 1 (
        echo [!] FFmpeg not found. Install it with: winget install Gyan.FFmpeg
        echo     Or put ffmpeg.exe / ffprobe.exe into the bin\ folder.
        pause
        exit /b 1
    )
)

python app.py
pause
