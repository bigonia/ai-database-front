# SDUI Section 调试 API

本文档定义 SDUI 调试模块中的 Section / Page 调试接口。

这组接口已经统一采用 `page-first` 模型，与工作流中的页面运行时保持同一套语义：

- 首次渲染以 `page` 为单位发送完整 `SectionScene`
- 增量更新以 `pageId + sectionId` 为目标发送 `SectionPatch`
- 当前页面状态以 `pageState` / `section state` 快照形式返回
- `section-editor` 返回的是 page-first 的协议辅助视图，而不是单纯 section 列表

调试主文档参阅 [`DEBUG_API.md`](DEBUG_API.md)。工作流 page-first 设计参阅 [`workflow.md`](workflow.md)。

---

## 1. 概览

### 1.1 Base Path

所有接口基于：

`/api/v1/sdui/debug`

### 1.2 与工作流的关系

Section 调试和工作流页面运行时复用同一套核心模型：

- `pageId`
- `layout`
- `sections[]`
- `sectionId`
- `sectionType`
- `fields`

调试接口的定位是：

- 直接对设备发送 page / patch
- 读取当前 page state
- 获取 page 构造辅助模型

它不是工作流接口，但和工作流使用同一套 page-first 数据语义。

---

## 2. 调试闭环

推荐调试顺序：

1. `GET /api/v1/sdui/debug/{deviceId}/section-editor`
2. `GET /api/v1/sdui/debug/{deviceId}/section/presets`
3. `POST /api/v1/sdui/debug/{deviceId}/section`
4. `POST /api/v1/sdui/debug/{deviceId}/section/patch`
5. `GET /api/v1/sdui/debug/{deviceId}/section/state`

含义：

1. 用 `section-editor` 拿到当前设备支持的 page / section 协议视图
3. 用 `section` 首次渲染一个完整页面
4. 用 `section/patch` 做增量更新
5. 用 `section/state` 回显当前后端维护的页面状态

---

## 3. API 明细

## 3.1 下发 Section 调试页面

- 方法：`POST`
- 路径：`/api/v1/sdui/debug/{deviceId}/section`

### custom page

```json
{
  "pageId": "custom_page",
  "layout": "vertical_scroll",
  "autoScroll": false,
  "autoScrollMs": 0,
  "sections": [
    {
      "sectionId": "hero_1",
      "sectionType": "hero_section",
      "fields": {
        "value": "85%",
        "label": "CPU Usage",
        "subtitle": "Running Normal",
        "tone": "primary",
        "progress": 85
      }
    }
  ]
}
```

### 成功响应示例

```json
{
  "code": 20000,
  "message": "Success",
  "data": {
    "deviceId": "esp32-A1B2C3",
    "sent": true,
    "pageId": "custom_page",
    "layout": "vertical_scroll",
    "sectionsBuilt": 1,
    "sectionsRequested": 1
  }
}
```

### 备注与限制

- `preset` 和 `sections` 是二选一语义
- 当前接口最终发送的是完整 `SectionScene`
- 不支持的 `sectionType` 会被跳过，不会中断整个请求

## 3.2 增量更新 Section

- 方法：`POST`
- 路径：`/api/v1/sdui/debug/{deviceId}/section/patch`

### 用途

对当前页面做增量更新，发送 `SectionPatch`。

### 请求示例

```json
{
  "pageId": "custom_page",
  "patches": [
    {
      "sectionId": "hero_1",
      "op": "update",
      "fields": {
        "value": "92%",
        "progress": 92
      }
    },
    {
      "sectionId": "tips_1",
      "op": "add",
      "sectionType": "text_section",
      "fields": {
        "title": "提示",
        "body": "新的动态内容"
      }
    }
  ]
}
```

### 成功响应示例

```json
{
  "code": 20000,
  "message": "Success",
  "data": {
    "deviceId": "esp32-A1B2C3",
    "sent": true,
    "pageId": "custom_page",
    "patchesBuilt": 2,
    "patchesRequested": 2
  }
}
```

### patch 语义

- `add`
  - 必须提供 `sectionType`
- `update`
  - 通过 `pageId + sectionId` 更新已有 section
  - 若当前状态中已存在该 section，后端会自动复用已有 `sectionType`
- `remove`
  - 仅需 `sectionId`

约束：

- patch 是 section 级更新，不支持 section 内数组子路径 patch
- section 内部字段变化本质上仍是整块 section data 更新

## 3.3 获取当前页面状态

- 方法：`GET`
- 路径：`/api/v1/sdui/debug/{deviceId}/section/state`

### 用途

返回后端当前维护的 page state 快照，用于：

- 前端回显当前页面
- patch 前先拿现状
- 调试时确认 scene / patch 是否按预期落到页面模型

### 成功响应示例

```json
{
  "code": 20000,
  "message": "Success",
  "data": {
    "deviceId": "esp32-A1B2C3",
    "activePageId": "custom_page",
    "pages": [
      {
        "pageId": "custom_page",
        "layout": "vertical_scroll",
        "autoScroll": false,
        "autoScrollMs": 0,
        "sections": [
          {
            "sectionId": "hero_1",
            "sectionType": "hero_section",
            "fields": {
              "value": "92%",
              "label": "CPU Usage",
              "subtitle": "Running Normal",
              "tone": "primary",
              "progress": 92
            },
            "updatedAt": 1774412030123
          }
        ],
        "updatedAt": 1774412030123
      }
    ],
    "online": true
  }
}
```

### 备注

- 这是后端维护的页面状态，不是设备反向上报的真实 UI DOM
- `fields` 返回的是编辑器友好的字段名

## 3.4 获取 Section 编辑器模型

- 方法：`GET`
- 路径：`/api/v1/sdui/debug/{deviceId}/section-editor`

### 用途

返回当前设备可用的 page-first Section 调试辅助模型。

### 成功响应示例

```json
{
  "code": 20000,
  "message": "Success",
  "data": {
    "deviceId": "esp32-A1B2C3",
    "renderMode": "rich",
    "sizeClass": "large",
    "layouts": [
      "vertical_scroll",
      "fixed_single"
    ],
    "sectionTypes": [
      {
        "type": "hero_section",
        "displayFields": [
          {
            "name": "value",
            "type": "string",
            "children": []
          }
        ],
        "events": [],
        "patchOps": [
          "add",
          "update",
          "remove"
        ]
      }
    ],
    "online": true
  }
}
```

### 顶层字段

- `deviceId`
- `renderMode`
- `sizeClass`
- `layouts`
- `sectionTypes`
- `online`

### 每个 `sectionTypes[]` 项字段

- `type`
- `displayFields`
- `events`
- `patchOps`

### 说明

- `section-editor` 不再返回展示型文案、默认值、约束说明等编辑器噪音字段
- 这里返回的是调试/工作流都可复用的 page-first 协议辅助模型

## 3.5 获取 Section 预置模板

- 方法：`GET`
- 路径：`/api/v1/sdui/debug/{deviceId}/section/presets`

### 用途

返回预置页面模板，并按设备 Section 能力标记兼容性。

### 成功响应示例

```json
{
  "code": 20000,
  "message": "Success",
  "data": {
    "deviceId": "esp32-A1B2C3",
    "presets": [
      {
        "name": "hero_dashboard",
        "label": "Hero 仪表盘",
        "description": "单 Hero 卡片展示 CPU 使用率",
        "layout": "vertical_scroll",
        "sectionCount": 1,
        "sectionTypes": [
          "hero_section"
        ]
      }
    ],
    "incompatiblePresets": [],
    "availableLayouts": [
      "vertical_scroll",
      "horizontal_pages",
      "fixed_single",
      "overlay"
    ]
  }
}
```

### 备注与限制

- 若设备没有上报 section types，当前兼容判断会偏宽松

---

## 4. 数据模型

### 4.1 Section 调试请求模型

字段：

- `preset`
- `pageId`
- `layout`
- `autoScroll`
- `autoScrollMs`
- `sections`

### 4.2 Section patch 请求模型

字段：

- `pageId`
- `patches`

每个 patch：

- `sectionId`
- `op`
- `sectionType`
- `fields`

### 4.3 Section 页面状态模型

顶层字段：

- `deviceId`
- `activePageId`
- `pages`
- `online`

每个 page：

- `pageId`
- `layout`
- `autoScroll`
- `autoScrollMs`
- `sections`
- `updatedAt`

每个 section：

- `sectionId`
- `sectionType`
- `fields`
- `updatedAt`

### 4.4 Section 编辑器模型

字段：

- `deviceId`
- `renderMode`
- `sizeClass`
- `layouts`
- `sectionTypes`
- `online`

每个 `sectionTypes[]` 项：

- `type`
- `displayFields`
- `events`
- `patchOps`

---

## 5. 前端约束

### 5.1 调试和工作流复用同一套 page-first 语义

不要在 debug 侧重新设计一套“只面向 section、不面向 page”的请求模型。

统一约束：

- 首次渲染用 page
- 后续更新用 `pageId + sectionId`
- 当前状态读 page state

### 5.2 `section-editor` 是协议辅助接口，不是能力事实主接口

如果需要一次性读取设备命令、Section、事件目录，应优先看：

- `GET /api/v1/sdui/capabilities/{deviceId}/protocol`

`section-editor` 只负责给 debug / workflow 编辑器提供 page-first 辅助视图。
