# SDUI 前端更新说明（资产集合与生成流程升级）

本文面向前端开发，说明本次后端升级后，前端需要做的改造。

适用范围：`/api/v1/sdui` 管理端界面（应用生成、资源管理、发布流程）。

## 1. 背景变化

本次后端从“单资源注入”升级为“资源集合（Asset Set）注入”，并将应用生成改为：

1. 用户先准备资源（assets）。
2. 用户选择资源集合（asset sets）。
3. 生成应用时显式传 `assetSetIds`。

目标：避免 AI 上下文爆炸，并让生成结果更贴合用户指定资源域。

## 2. 接口变更总览

## 2.1 变更：`POST /apps/generate`

请求新增字段：

```json
{
  "requirement": "string",
  "sceneTags": ["string"],
  "assetSetIds": ["string"],
  "targetDeviceIds": ["string"]
}
```

说明：

1. `assetSetIds` 推荐由前端强引导选择，不建议默认传空。
2. 可多选，后端会按所选集合做上下文注入。

响应新增字段：

```json
{
  "appId": "string",
  "versionId": "string",
  "versionNo": 1,
  "templateName": "string",
  "templateDescription": "string",
  "selectedAssetSetIds": ["string"],
  "previewLayoutJson": "string",
  "validationReport": "string"
}
```

前端用途：

1. 在“生成结果”区域展示 `selectedAssetSetIds`。
2. 作为“再次修订/重新生成”的默认上下文提示。

## 2.2 新增：Asset Set 管理 API

1. 创建集合：`POST /asset-sets`

```json
{
  "name": "音乐库A",
  "description": "用于播放器场景",
  "tags": ["music", "cover"]
}
```

2. 查询集合：`GET /asset-sets?keyword=...`
3. 向集合添加资源：`POST /asset-sets/{assetSetId}/items`

```json
{
  "assetIds": ["asset-id-1", "asset-id-2"]
}
```

4. 查询集合资源：`GET /asset-sets/{assetSetId}/items`
5. 删除集合资源项：`DELETE /asset-sets/{assetSetId}/items/{itemId}`

## 3. 前端页面改造建议

## 3.1 资源页（Assets）

保留原有能力：

1. 资源注册（`POST /assets`）
2. 资源列表（`GET /assets`）
3. 源文件选择（`GET /assets/source-files`）

新增一个“资源集合管理”区域：

1. 集合列表 + 搜索。
2. 新建集合弹窗（name/description/tags）。
3. 集合详情抽屉：
- 左侧全部资源列表。
- 右侧集合内资源项列表。
- 支持批量添加/删除。

## 3.2 应用生成页（Apps Generate）

新增一个必经步骤：

1. 场景输入（requirement/sceneTags）。
2. 选择资源集合（多选 `assetSetIds`）。
3. 发起生成。

交互建议：

1. 若未选择 `assetSetIds`，给出确认提示：
- “未选择资源集合，AI 将按无资源上下文生成。是否继续？”
2. 展示生成响应中的 `selectedAssetSetIds`，让用户确认上下文一致。

## 3.3 发布页（Publish）

发布接口不变，但建议新增可视化提示：

1. 展示应用绑定的资源集合 ID（来自 app 信息里的 `selectedAssetSetIds`）。
2. 提示“当前发布内容已包含来自所选资源集合的运行时绑定”。

## 4. 推荐联调流程（前端可直接按此走）

1. 上传并注册多个资源（assets）。
2. 创建资源集合（asset set）。
3. 把目标资源加入该集合。
4. 进入应用生成页，选择该集合后调用 `/apps/generate`。
5. 查看 `validationReport` 和 `selectedAssetSetIds`。
6. 发布到测试设备，验证页面与交互。

## 5. 前端数据模型调整

## 5.1 生成请求 DTO（前端）

新增字段：

1. `assetSetIds?: string[]`

## 5.2 生成响应 DTO（前端）

新增字段：

1. `selectedAssetSetIds?: string[]`

## 5.3 新增类型

```ts
type SduiAssetSet = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

type SduiAssetSetItem = {
  id: string;
  assetSet: SduiAssetSet;
  asset: SduiAsset;
  itemOrder: number;
  createdAt?: string;
};
```

## 6. 兼容与回退策略

1. 兼容旧后端（未升级）
- 若调用 `/asset-sets` 返回 404，则隐藏“资源集合”功能区。
- `apps/generate` 请求中可不传 `assetSetIds`。

2. 兼容新后端
- 优先启用 asset set 流程。
- 在页面显式标注“推荐：先选资源集合再生成”。

## 7. 验收清单（前端）

1. 可以创建/查询/编辑（增删项）资源集合。
2. 生成页可以选择集合并正确传 `assetSetIds`。
3. 生成结果能显示 `selectedAssetSetIds`。
4. 未选集合时有清晰提示与确认。
5. 旧流程仍可兜底（不阻塞基础生成）。

## 8. 常见问题

1. 为什么生成结果没用到我想要的资源？
- 检查是否把资源加入了所选集合。
- 检查生成时实际传出的 `assetSetIds`。

2. 为什么集合里有资源但运行页面没表现？
- 检查资源 `processedStatus` 是否 `READY`。
- 检查应用逻辑是否通过 `ctx.assets/cap.asset_search` 正确读取。
