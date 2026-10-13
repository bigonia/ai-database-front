# 运行期参数类型绑定 — 后端升级建议

## 为什么改

当前前端让用户拼接 `$nodes.xxx.artifact.yyy` 字符串，存在三个问题：

1. **无类型约束**：`audio/recording` 产物可能被错误引用到 `bool` 参数，编辑期发现不了
2. **前端硬编码**：预设了一套 `$event` / `$nodes` / `$slots` / `$artifacts` / `$run` 引用路径规则，新增节点类型或产物字段时前端必须同步改代码
3. **用户看到后端概念**：`$nodes` / `$artifacts` / `$slots` 这些运行时结构泄露到编辑器

**新方案不再需要这套预设的引用路径规则和字符串拼接逻辑，改为类型驱动的自动匹配。**

核心思路：**利用已有的 `type` 字段，让参数输入类型和产物输出类型打通，后端按类型自动匹配，前端只需展示"哪个上游节点的产物兼容当前参数"。**

---

## 改什么

### 1. 统一 type 字段：参数和产物用同一套类型体系

当前 `type` 字段在参数和产物中各自为政（`string` / `number` / `boolean`），无法区分业务含义。改为使用**业务类型名**，前后端共用一套：

**参数示例：**

```json
// audio.play 的 artifact_id —— 当前
{ "name": "artifact_id", "type": "string" }
// 改为
{ "name": "artifact_id", "type": "audio/recording" }

// ui.update 的 value —— 当前
{ "name": "value", "type": "string" }
// 改为（可接受任意 string 来源 + 静态文本）
{ "name": "value", "type": "string" }

// rgb.effect 的颜色 —— 不可绑定
{ "name": "r", "type": "number" }
```

**产物示例：**

```json
// audio.record 节点 —— 当前
{ "name": "recording", "type": "audio/recording", "schema": {} }
// 改为：type 不变，已经是业务类型

// button 节点 —— 当前
{ "name": "toggleState", "type": "boolean" }
// 改为（标记为开关状态，不可与其他 boolean 混淆）
{ "name": "toggleState", "type": "button/state" }
```

**类型命名规范**：`<域>/<含义>`，如 `audio/recording`、`motion`、`stt/transcript`、`button/state`。纯基础类型（`string`、`number`）保留，表示可接受任意同基础类型的来源。

### 2. 参数绑定格式：字符串改结构化

当前：
```json
{ "params": { "artifact_id": "$nodes.rec_A.artifact.artifactId" } }
```

改为：
```json
{ "params": { "artifact_id": { "$ref": "rec_A" } } }
```

- `"$ref": "<nodeId>"` — 引用指定节点的产物/输出。后端根据参数 `type` 自动从该节点的产物中匹配对应类型的字段（如参数 type=`audio/recording`，后端从 nodeId 的产物列表中找 `type=audio/recording` 的那个）
- 纯字符串值视为静态值，向后兼容

### 3. 类型匹配规则

后端校验时检查：

| 参数 type | 可绑定的来源 |
|---|---|
| `string` | 任意 string 类型产物、事件 string 字段、静态字符串 |
| `number` | 任意 number 类型产物、事件 ts |
| `motion` | 只能是 `motion` 类型产物的节点 |
| `audio/recording` | 只能是 `audio.record` 节点的 `audio/recording` 产物 |
| `button/state` | 只能是 `button` 类型产物的节点 |

校验项：
1. `$ref` 中的 nodeId 存在于当前工作流
2. nodeId 在当前节点的上游（DAG 拓扑可达）
3. nodeId 产出的产物列表中，存在与参数 `type` 匹配的项
4. 不填 `$ref` 的静态值，校验值是否符合参数 `type` 约束

### 4. 枚举型产物使用业务类型名，不与通用 enum 混淆

当前 motion 事件枚举混在 `source.events` 里，产物侧没有对应类型：

```json
// 当前 trigger 节点 source 中的事件定义
{ "eventName": "shake", "eventId": "input:motion.shake", "displayName": "摇晃" },
{ "eventName": "flip",  "eventId": "input:motion.flip",  "displayName": "翻转" }
```

改为在产物中声明一个 `type=motion` 的产物，表示其输出值为枚举型、可选值限定：

```json
{
  "name": "motionEvent",
  "type": "motion",
  "displayName": "运动事件",
  "allowedValues": ["shake", "flip", "wrist_raise"]
}
```

这样 `motion` 就是独立业务类型，不会和其他枚举（如 LED 模式 `blink/breathe/static`）混淆。下游节点参数若 `type=motion`，只能绑定 motion 产物。

### 5. 清理无意义产物

当前一些节点产出了不必要的 artifact，如 button 节点：
```json
// 当前 —— 两个产物
"artifacts": [
  { "name": "event",        "type": "string",  "displayName": "触发事件" },
  { "name": "toggleState",  "type": "boolean", "displayName": "开关状态" }
]
// 改为 —— 只保留有绑定价值的
"artifacts": [
  { "name": "toggleState", "type": "button/state", "displayName": "开关状态" }
]
```

`event` 是每次运行都有的，不需要作为产物暴露。

---

## 改动范围

| 改动 | 说明 |
|------|------|
| 所有节点定义中参数和产物的 `type` 统一 | 用业务类型名替代泛型 `string`/`boolean`/`number`（基础类型保留） |
| 枚举值产物独立类型 | 如 `motion`、`rgb/mode`，附带 `allowedValues` |
| 接受 `$ref` 对象 | `NodeWorkflowParameterResolver` 解析时支持 `{ "$ref": "nodeId" }` |
| 校验增强 | 类型匹配、DAG 可达性 |
| 清理产物 | 删除不产生绑定价值的 artifact |
| **移除旧引用规则** | 废弃 `$event.xxx` / `$nodes.xxx.xxx` / `$run.xxx` / `$slots.xxx` / `$artifacts.xxx` 路径语法和字符串拼接解析逻辑 |
