# Modify Video — 本地视频剪辑工具

基于 FFmpeg 的桌面视频编辑工具，内置精美的网页操作界面。支持 Windows 与 Linux（Ubuntu），提供安装包，无需接触源码。

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Ubuntu-blue) ![python](https://img.shields.io/badge/python-3.8%2B-green)

## 功能

- **视频剪辑**：可视化时间轴拖动选段（带胶片条预览与时间刻度），精确到 0.1 秒裁剪任意片段
- **播放变速**：0.25× – 4× 变速，预览即时生效，导出同步处理（含声音）
- **格式转换**：MP4 / WebM / MKV / AVI / MOV 互转，相同格式自动流复制秒出
- **转换 GIF**：可调帧率与宽度，自动生成调色板保证画质
- **多格式支持**：MP4、WebM、MOV、MKV、AVI、FLV、TS、WMV、MPG、GIF 等均可载入

## 安装

从 [Releases](https://github.com/Chemauto/Modify-Video/releases) 下载对应安装包：

**Windows**
- 下载 `ModifyVideo-*-setup.exe` 双击安装，开始菜单（可选桌面）创建快捷方式
- 安装即用，**无需安装 Python**；FFmpeg 在首次导出时自动下载到安装目录

**Ubuntu / Debian**
- `sudo apt install ./modify-video_*_all.deb`
- apt 会自动装齐 `python3-flask`、`python3-tk` 与 `ffmpeg`，无需手动配置任何环境
- 安装后从应用菜单启动「Modify Video」，或终端执行 `modify-video`
- 注意：请使用 `apt install ./包名`；`dpkg -i` 不会自动安装依赖，若已用过 dpkg 安装，执行 `sudo apt-get install -f` 即可补齐依赖并完成配置
- WSL 中安装运行时，会自动调用 Windows 默认浏览器打开界面；粘贴 `D:\...` 这样的 Windows 路径会自动转换为 `/mnt/d/...`
- 文件选择对话框按 tkinter → zenity → kdialog 依次回退；无图形界面的环境请直接拖拽文件或粘贴路径

**源码方式**（开发者）
- Windows：双击 `一键启动.bat`
- Ubuntu：`./一键启动.sh`（自动通过 apt / pip 安装 Flask，自动下载 FFmpeg）

## 使用说明

1. 点击「选择视频文件」、拖拽文件进窗口、或粘贴完整路径载入视频
2. 在时间轴上拖动两个白色手柄选择保留片段，可随时点击「设为起点 / 终点」微调
3. 右侧设置输出格式、变速倍数（GIF 可调帧率与宽度）
4. 点击「开始导出」，完成后可直接打开所在文件夹或预览结果

导出文件保存在原视频同目录下，命名为 `原文件名_edited.格式`，不会覆盖原文件。

## 技术说明

- 后端：Python + Flask，通过子进程调用 FFmpeg / FFprobe；界面为原生 HTML / CSS / JS
- 服务仅监听 127.0.0.1，所有处理均在本机完成，不会上传任何数据
- deb 安装时数据写入 `~/.local/share/modify-video`；拖拽载入的文件副本存于 `uploads\`，可随时清空
- FFmpeg 运行时资源包随 Release 提供，源码方式首次运行自动下载；系统已装 FFmpeg 时直接使用
