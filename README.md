# Modify Video — 本地视频剪辑工具

基于 FFmpeg 的桌面视频编辑工具，内置精美的网页操作界面，双击即可启动。支持 Windows 与 Linux（Ubuntu）。

## 功能

- **视频剪辑**：可视化时间轴拖动选段，精确到 0.1 秒裁剪任意片段
- **播放变速**：0.25× – 4× 变速，预览即时生效，导出同步处理（含声音）
- **格式转换**：MP4 / WebM / MKV / AVI / MOV 互转，相同格式自动流复制秒出
- **转换 GIF**：可调帧率与宽度，自动生成调色板保证画质
- **多格式支持**：MP4、WebM、MOV、MKV、AVI、FLV、TS、WMV、MPG、GIF 等均可载入

## 快速开始

只需安装 [Python 3.8+](https://www.python.org)（Windows 安装时勾选 **Add python.exe to PATH**），FFmpeg 首次运行时会自动从本项目 [Releases](https://github.com/Chemauto/Modify-Video/releases) 下载对应平台的版本到 `bin\` 目录；若系统已安装 FFmpeg 则直接使用，不重复下载。

- **Windows**：双击 **一键启动.bat**
- **Ubuntu / Debian**：终端执行 `./一键启动.sh`（首次运行自动安装 Flask；若想使用文件选择对话框需 `sudo apt install python3-tk`，拖拽与粘贴路径不受影响）

启动后自动打开浏览器界面，关闭命令行窗口即退出。

也可手动安装 FFmpeg 后运行：Windows 执行 `winget install Gyan.FFmpeg`，Ubuntu 执行 `sudo apt install ffmpeg`。

## 使用说明

1. 点击「选择视频文件」、拖拽文件进窗口、或粘贴完整路径载入视频
2. 在时间轴上拖动两个白色手柄选择保留片段，可随时点击「设为起点 / 终点」微调
3. 右侧设置输出格式、变速倍数（GIF 可调帧率与宽度）
4. 点击「开始导出」，完成后可直接打开所在文件夹或预览结果

导出文件保存在原视频同目录下，命名为 `原文件名_edited.格式`，不会覆盖原文件。

## 技术说明

- 后端：Python + Flask，通过子进程调用 FFmpeg / FFprobe
- 界面：原生 HTML / CSS / JS，暗色玻璃拟态风格
- 仅监听 127.0.0.1，所有处理均在本机完成，不会上传任何数据
- `bin\` 存放自动下载的 FFmpeg，`uploads\` 仅存放拖拽载入的文件副本，均可随时清空
