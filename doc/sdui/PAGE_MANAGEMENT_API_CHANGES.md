# Page 管理系统 — 前端 API 变更文档

> 版本：2026-06-26  
> 变更类型：新增 Page 实体，模板/调试/Section触发器 API 调整

---

## 1. 变更概览

| 端点 | 变更 | 说明 |
|------|------|------|
| `GET /capability-nodes/{deviceId}` | **行为变更** | 新增可选 `pageId`/`pageJson` 参数，自动附加 section.trigger 节点 |
| `GET /board-types/{board}/capability-nodes` | **行为变更** | 同上，新增可选 `pageId`/`pageJson` 参数 |
| `GET /capability-nodes/section-triggers` | **删除** | 合并到上述端点 |
| `GET /board-types/{board}/capability-nodes/section-triggers` | **删除** | 合并到上述端点 |
| `POST /capability-nodes/section-triggers` | **删除** | 不再接受前端手传 section 列表 |
| `POST /api/v1/sdui/ui-templates` | **行为变更** | 响应新增 `pageId` 和 `page` 字段 |
| `GET /api/v1/sdui/ui-templates/{id}` | **行为变更** | 同上，关联返回 page 详情 |
| `PUT /api/v1/sdui/ui-templates/{id}` | **行为变更** | 更新模板同时更新关联 PageEntity |
| `DELETE /api/v1/sdui/ui-templates/{id}` | **行为变更** | 级联删除关联 PageEntity |
| `POST /api/v1/sdui/ui-templates/{id}/preview` | **行为变更** | 响应新增 `pageId` |
| `GET /debug/{deviceId}/events/stream` (SSE) | **升级** | 统一 `event_catalog`（合并 input_catalog + page_event_catalog），连接时 + page 变更后自动推送 |
| Debug section 端点 | **行为变更** | pageId 改为系统管理 (`ws_{deviceId}`)，数据持久化 |

---

## 2. Section 触发器（合并到 capability-nodes 端点）

Section 触发器不再作为独立端点，而是通过现有 capability-nodes 端点的可选参数返回。

### `GET /api/v1/sdui/capability-nodes/{deviceId}?pageId={pageId}`

在设备能力节点基础上，附加 page 中的交互式 section 生成的 `section.trigger` 节点。

**请求（无 page 上下文 — 行为不变）：**
```
GET /api/v1/sdui/capability-nodes/dev-1
```
→ 仅返回设备能力节点（button.trigger, rgb.effect, audio.play 等）

**请求（通过 pageId 引用已持久化的 page）：**
```
GET /api/v1/sdui/capability-nodes/dev-1?pageId=page_abc12345
```
→ 设备能力节点 + section.trigger 节点（来自 PageEntity）

**请求（通过 pageJson 传入 ad-hoc sections，无需先保存）：**
```
GET /api/v1/sdui/capability-nodes/dev-1?pageJson=[{"sectionId":"action_1","sectionType":"action_section","fields":{...}}]
```
→ 设备能力节点 + section.trigger 节点（来自 JSON）

**响应（nodes 数组中混合返回）：**
```json
{
  "code": 20000,
  "data": {
    "deviceId": "dev-1",
    "online": true,
    "status": "ok",
    "nodes": [
      { "nodeType": "button.trigger", ... },
      { "nodeType": "rgb.effect", ... },
      {
        "nodeType": "section.trigger",
        "capabilityId": "action_section",
        "instanceId": "action_1",
        "displayName": "操作按钮 - action_1",
        "description": "Section 交互事件触发器: action_1 (操作按钮)",
        "runtimeMode": "TRIGGER",
        "inputPorts": [],
        "outputPorts": [
          {
            "name": "event",
            "direction": "output",
            "type": "event",
            "label": "触发事件",
            "required": true,
            "metadata": {
              "events": [
                {
                  "eventId": "action.click",
                  "eventName": "action.click",
                  "displayName": "按钮点击"
                }
              ]
            }
          }
        ],
        "parameters": [],
        "artifacts": [...],
        "source": {
          "kind": "section_interaction",
          "sectionType": "action_section",
          "sectionId": "action_1",
          "events": [...]
        },
        "constraints": { "triggerOnly": true }
      }
    ],
    "unresolvedNodes": []
  }
}
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `pageId` | 否 | 已持久化 PageEntity 的 pageId，加载其 sections 生成触发节点 |
| `pageJson` | 否 | JSON 数组 `[{sectionId, sectionType, fields}]`，适用于编辑中尚未保存的 page |

- 都不传 → 仅返回设备能力节点（向后兼容，现有前端代码无需改动）
- 同时传 → `pageId` 优先，找不到 page 时 fallback 到 `pageJson`
- 前端可按 `nodeType === "section.trigger"` 过滤以区分触发节点和设备节点

### `GET /api/v1/sdui/board-types/{board}/capability-nodes?pageId={pageId}&pageJson=...`

同上，按板卡类型维度查询，参数和响应语义一致。

**前端使用流程：**
```
1. 用户创建/编辑工作流，选择 UI 模板
2. 模板响应中获取 pageId
3. GET /capability-nodes/{deviceId}?pageId={pageId}  （同一端点，无需额外请求）
4. 响应 nodes 中同时包含设备节点和 section.trigger 节点
5. 用户连线时从 section.trigger 的 outputPort.events 中选择具体事件
6. 工作流定义中生成节点：
   { "nodeType": "section.trigger", "params": { "eventId": "action.click", "sectionId": "action_1" } }
```

**编辑未保存模板时的用法：**
```
1. 用户在模板编辑器中修改 sections，尚未保存
2. GET /capability-nodes/{deviceId}?pageJson=<JSON.stringify(sections)>
3. 即时看到 section.trigger 节点，无需先保存
```

---

## 3. UI 模板 API 响应变更

### `POST /api/v1/sdui/ui-templates` — 响应新增字段

**之前响应：**
```json
{
  "code": 20000,
  "data": {
    "templateId": "uuid",
    "templateKey": "my_template",
    "name": "按钮页面",
    "status": "active",
    "definition": {
      "templateKey": "my_template",
      "name": "按钮页面",
      "pageId": "main",
      "layout": "vertical_scroll",
      "sections": [...],
      "variables": [...],
      "mockData": {...}
    }
  }
}
```

**现在响应：**
```json
{
  "code": 20000,
  "data": {
    "templateId": "uuid",
    "templateKey": "my_template",
    "name": "按钮页面",
    "board": "ESP32-S3-LCD-0.85",         // ← 新增：关联板卡类型
    "status": "active",
    "pageId": "page_a1b2c3d4",          // ← 新增：关联的 pageId
    "definition": {
      "templateKey": "my_template",
      "name": "按钮页面",
      "board": "ESP32-S3-LCD-0.85",
      "variables": [...],               // sections/layout/pageId 已迁移到 page
      "mockData": {...},
      "requiredSectionTypes": [...]
    },
    "page": {                            // ← 新增：关联的 page 详情
      "pageId": "page_a1b2c3d4",
      "name": "按钮页面",
      "layout": "vertical_scroll",
      "autoScroll": false,
      "autoScrollMs": 0,
      "sections": [
        {
          "sectionId": "action_1",
          "sectionType": "action_section",
          "fields": { "actions": [...] }
        }
      ]
    }
  }
}
```

**前端适配要点：**
- `board` 新增字段，创建模板时传入板卡类型（如 `ESP32-S3-LCD-0.85`），用于按板卡筛选模板
- `pageId` 是 Section 触发器的入参，保存到工作流编辑器状态
- `page` 包含完整的 sections 数据，可直接渲染预览
- `definition.sections` 和 `definition.layout` 不再返回，改为从 `page` 读取
- `definition.variables` 和 `definition.mockData` 仍在模板自身

### `PUT /api/v1/sdui/ui-templates/{id}`

同 POST，更新模板会同步更新关联 PageEntity 的 sections/layout。

### `DELETE /api/v1/sdui/ui-templates/{id}`

删除模板会级联删除关联 PageEntity。

### `POST /api/v1/sdui/ui-templates/{id}/preview` — 响应新增字段

```json
{
  "code": 20000,
  "data": {
    "templateId": "uuid",
    "templateKey": "my_template",
    "pageId": "page_a1b2c3d4",       // ← 新增
    "variables": { "key": "value" },
    "scene": { ... },
    "sent": true
  }
}
```

---

## 4. Debug Section API 变更

### 4.1 持久化行为变更

| 端点 | 变更 |
|------|------|
| `POST /{deviceId}/section` | pageId 由系统管理，约定为 `ws_{deviceId}`，数据持久化到 DB |
| `POST /{deviceId}/section/patch` | patch 修改持久化到 PageEntity |
| `GET /{deviceId}/section/state` | 从 DB 读取，非内存 |
| `DELETE /{deviceId}/section/state` | 删除 DB 中的 PageEntity |

**影响：** 调试数据在服务重启后不会丢失。同一设备的多次调试共享持久化的 page 数据。

### 4.2 升级：统一事件目录（纯 SSE 驱动）

Debug 场景下，前端仅需订阅 SSE，平台在以下时机自动推送统一的 `event_catalog`：

| 触发时机 | 说明 |
|----------|------|
| SSE 连接建立 | 根据当前 debug page 状态立即推送 |
| `POST /section`（push） | 全量替换 page，重新计算统一 catalog 推送 |
| `POST /section/patch` | page sections 变更，重新计算统一 catalog 推送 |
| `DELETE /section/state`（clear） | page 已删除，推送空 sectionEvents `{pageId:"", sectionEvents:[]}` |

前端无需任何 REST 查询——全程由 SSE 事件驱动。

`input_catalog` 和 `page_event_catalog` 已合并为单一的 `event_catalog` 事件。

#### `GET /api/v1/sdui/debug/{deviceId}/events/stream` — **SSE 事件序列**

```
event:connected
data:{"deviceId":"dev-1","message":"Event stream connected"}

event:event_catalog
data:{
  "deviceId": "dev-1",
  "online": true,
  "board": "ESP32-S3-LCD-0.85",
  "pageId": "ws_dev-1",
  "physicalInputs": [
    {
      "inputName": "buttons.pwr",
      "displayName": "电源按钮",
      "events": [
        {"eventId": "input:buttons.pwr.short_press", "eventName": "short_press", "displayName": "短按"}
      ]
    }
  ],
  "mediaCapabilities": [...],
  "sectionEvents": [
    {
      "sectionId": "action_1",
      "sectionType": "action_section",
      "sectionDisplayName": "操作按钮",
      "eventId": "action.click",
      "displayName": "按钮点击",
      "description": "操作按钮 - 按钮点击"
    }
  ],
  "availableTriggers": [
    {"eventId": "input:buttons.pwr.short_press", "displayName": "电源按钮 · 短按", "category": "USER_INTERACTION", "source": "buttons.pwr"},
    {"eventId": "action.click", "displayName": "操作按钮 · 按钮点击", "category": "SECTION_INTERACTION", "source": "action_section"}
  ]
}
                                      ↑ sectionEvents 仅含当前 page 中实际存在的交互式 section
                                      ↑ 无 debug page 时 sectionEvents 为空数组
event:action.click
data:{"eventId":"action.click","deviceId":"dev-1","section":{...},...}
                                      ↑ 已有：终端实际触发的事件
```

**关键设计原则：** `sectionEvents` 只包含当前 UI 中实际存在的交互式 section 事件，不包含设备理论上支持但当前未使用的 section 类型。

**page 变更时 SSE 自动重推（无需重连）：**
```
POST /debug/dev-1/section  → 200 OK
                              ↓ (fire-and-forget)
                     SSE: event:event_catalog
                          data:{... 完整统一目录，sectionEvents 更新 ...}

POST /debug/dev-1/section/patch → 200 OK
                                    ↓
                           SSE: event:event_catalog ...

DELETE /debug/dev-1/section/state → 200 OK
                                      ↓
                             SSE: event:event_catalog
                                  data:{"pageId":"","sectionEvents":[], ...}
```

**前端验证流程（仅需 SSE）：**
```
1. 订阅 GET /debug/{deviceId}/events/stream  → SSE 连接
2. 收到 event_catalog → 渲染物理输入 + 预期 section 事件面板
3. POST /debug/{deviceId}/section → 推送 page
4. 收到 event_catalog → 面板自动更新（无需手动刷新）
5. 用户在终端操作 → SSE 收到 action.click
6. 匹配 eventId + sectionId → 勾选 ✓ → 验证通过
```

---

## 5. 前端编辑器完整交互流程

```
┌─ 步骤1：创建/选择 UI 模板 ──────────────────────────────┐
│ POST /ui-templates  (或 GET 已有模板)                   │
│ → { templateId, pageId, page: { sections: [...] } }    │
│   保存 pageId 到编辑器状态                              │
└───────────────────────────────────────────────────────┘
                          ↓
┌─ 步骤2：获取全部能力节点（一次请求）─────────────────────┐
│ GET /board-types/{board}/capability-nodes              │
│     ?pageId={pageId}                                   │
│ → nodes: [                                             │
│     button.trigger, rgb.effect, audio.play, ...,       │
│     section.trigger (action_1), section.trigger (...)   │
│   ]                                                     │
│   设备节点 + section 触发节点 合并返回                    │
└───────────────────────────────────────────────────────┘
                          ↓
┌─ 步骤3：用户连线编排 ──────────────────────────────────┐
│ action_1 (section.trigger)                             │
│   └─ event: action.click                               │
│        └─→ rgb.effect (mode=blink)                     │
│                                                         │
│ 生成工作流节点 JSON:                                     │
│ { "nodeType": "section.trigger",                        │
│   "params": { "eventId": "action.click",                │
│               "sectionId": "action_1" } }               │
└───────────────────────────────────────────────────────┘
                          ↓
┌─ 步骤4：部署 → 运行时触发 ──────────────────────────────┐
│ 设备点击 action_1 → eventId="action.click"              │
│ → EventInputHandler → NodeWorkflowRuntimeService        │
│ → triggerMatches(eventId="action.click",                │
│                   sectionId="action_1")                 │
│ → 执行 rgb.effect 节点                                  │
└───────────────────────────────────────────────────────┘
```

---

## 6. 需要注意的 Breaking Changes

| 变更点 | 影响 | 适配 |
|--------|------|------|
| Section 触发器合并到 capability-nodes 端点 | 旧 `GET /section-triggers?pageId=` 已删除 | 改为 `GET /{deviceId}?pageId=xxx` |
| 模板 definition 不再含 `sections`/`layout` | 之前直接从 definition 读 sections 的代码 | 改为从 `page.sections` 读取 |
| SSE 事件 `input_catalog` + `page_event_catalog` 合并为 `event_catalog` | 监听旧事件名的前端代码 | 改为监听 `event_catalog`，sectionEvents 仅含当前 page 的交互 section |
| Debug pageId 从随机 `debug_page_xxx` 改为 `ws_{deviceId}` | 依赖旧 pageId 格式的前端逻辑 | 使用约定格式或直接从响应读取 |
| 工作流验证依赖 section.trigger 节点 | 无 section trigger 的工作流也能通过验证 | 前端确保触发器节点在能力目录中 |

**新增能力：**
- `pageJson` 参数支持编辑中未保存的 sections 即时生成触发节点
- 前端按 `nodeType === "section.trigger"` 即可过滤/分组触发节点
