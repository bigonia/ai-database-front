# SDUI 物理交互终端系统（ESP32-S3）开发指南

## 一、项目简介与目标
本项目构建了一个基于 Thin Client（瘦终端）架构的端云协同交互系统。ESP32-S3 负责物理 I/O、实时渲染与本地事件处理，业务编排与复杂状态同步由云端（使用 Python、Java 等任意服务端代码）完成。

核心特性：
- **Server-Driven UI (SDUI)**：通过统一的 JSON 报文，服务端可动态下发布局与视图组件。
- **配置即渲染**：丰富的内置样式（Theme, Scene, Preset）让后端/AI智能体能用极简 JSON 画出美观页面，保证 UI 可控与美观。
- **跨后端解耦**：所有通信基于 WebSocket，设备与服务端只需按规范使用 JSON Topic 交互，彻底解除终端与某一种后端语言的绑定。

---

## 二、文档导航 (Documentation Index)
为了方便不同角色快速开展工作，我们将系统的核心知识浓缩为三管齐下的专业指南（位于 `docs/` 目录下）：

1. **[服务端与场景开发指南 (BACKEND_DEV_GUIDE.md)](./docs/BACKEND_DEV_GUIDE.md)**
   > **读者：服务端研发、全栈工程师、甚至是生成代码的 AI 智能体**
   > 说明终端接入过程、语言无关的上下行交互协议（Topic 定义）、如何配置高可用高美观的 UI，以及如何快速开发一个场景。

2. **[终端架构与开发指南 (TERMINAL_GUIDE.md)](./docs/TERMINAL_GUIDE.md)**
   > **读者：嵌入式 C/C++ 研发**
   > 说明终端 C 端架构、主要系统内部设计、内部数据分发流，并提供一个如何在 LVGL 和 parser 层级拓展新组件的引导。

3. **[历史演进与排障手册 (HISTORY_AND_FAQ.md)](./docs/HISTORY_AND_FAQ.md)**
   > **读者：排查疑难杂症的开发者、关注架构演进的技术主管**
   > 项目重要问题修复史、重大阶段改版记录、以及典型的内存 OOM 和 WebSocket 断连排查。

---

## 三、快速上手部署 (Quick Start)

### 3.1 环境准备
1. 安装并激活 **ESP-IDF v5.x**（推荐 5.2+）作为主要的 C 语言编译环境。
2. 安装 Node.js 并全局安装字体工具（仅需调整内置字体库时需要）：`npm install -g lv_font_conv`
3. 确保你的电脑里有 Python 或其他可以运行 `scripts/servers` 下样例测试脚本的环境。

### 3.2 编译与烧录终端固件
在代码根目录下打开终端，依次执行：
```bash
# 全局清理（如修改了核心 sdkconfig 或遭遇顽固编译缓存报错）
idf.py fullclean

# 构建、烧录并直接打开终端串口监视器
idf.py build flash monitor
```

### 3.3 设备配网连接流程
烧录完毕或终端所处网络变化时，系统采取“双态自适应”设计：
1. **Provisioning 态（配网门禁）**：若是首次烧录，设备会开启 SoftAP（形如 `SDUI-Setup`），手机连接后浏览器跳转配网页面（默认IP 192.168.4.1），可配置 SSID、Password 和服务端的 WebSocket 地址。
2. **Cloud 态（云端就绪）**：连接成功并成功保存后重启，终端将通过 `websocket_manager` 自动静默连向后端下发配置和上行设备流。
