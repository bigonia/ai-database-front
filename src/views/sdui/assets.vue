<template>
  <div class="app-container sdui-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>资源管理</span>
          <el-button plain @click="refreshData">刷新</el-button>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form label-width="100px" @submit.prevent>
            <el-form-item label="源文件">
              <el-select
                v-model="assetForm.fileId"
                filterable
                clearable
                style="width: 100%"
                placeholder="请选择已上传文件"
                @visible-change="handleSourceFileVisibleChange"
              >
                <el-option
                  v-for="file in sourceFiles"
                  :key="file.fileId"
                  :label="fileLabel(file)"
                  :value="file.fileId"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="资产类型">
              <el-select v-model="assetForm.assetType" style="width: 100%">
                <el-option label="IMAGE_COVER" value="IMAGE_COVER" />
                <el-option label="AUDIO_CLIP" value="AUDIO_CLIP" />
              </el-select>
            </el-form-item>
            <el-form-item label="资产名称">
              <el-input v-model="assetForm.name" />
            </el-form-item>
            <el-form-item label="资产标签">
              <el-input v-model="assetForm.tagsText" placeholder="可选，逗号分隔，例如 home,cover" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="loading.register" @click="handleRegister">注册资产</el-button>
            </el-form-item>
          </el-form>
        </el-col>

        <el-col :span="12">
          <el-form label-width="100px" @submit.prevent>
            <el-form-item label="应用">
              <el-select v-model="bindForm.appId" filterable style="width: 100%" placeholder="选择应用">
                <el-option v-for="app in apps" :key="app.id" :label="app.name || app.id" :value="app.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="资产">
              <el-select v-model="bindForm.assetId" filterable style="width: 100%" placeholder="选择资产">
                <el-option v-for="asset in assets" :key="asset.id" :label="assetLabel(asset)" :value="asset.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="用途">
              <el-select v-model="bindForm.usageType" style="width: 100%" placeholder="请选择用途">
                <el-option label="cover" value="cover" />
                <el-option label="icon" value="icon" />
                <el-option label="sound" value="sound" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button :disabled="!bindForm.appId || !bindForm.assetId" @click="handleBind">绑定资源</el-button>
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>资源列表</span>
          <div class="filter-row">
            <el-input v-model="assetKeyword" placeholder="按名称关键词过滤" clearable style="width: 220px" />
            <el-button @click="refreshAssets">查询</el-button>
          </div>
        </div>
      </template>
      <el-table v-loading="loading.assets" :data="assets" @row-click="pickAsset">
        <el-table-column prop="id" label="Asset ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="assetType" label="类型" width="140" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="processedStatus" label="处理状态" width="120" />
        <el-table-column prop="processedPayload" label="处理信息" min-width="180" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header"><span>应用资源绑定</span></div>
      </template>
      <el-empty v-if="!bindForm.appId" description="请先在上方选择应用" />
      <el-table v-else v-loading="loading.bindings" :data="bindings">
        <el-table-column prop="id" label="Binding ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="assetId" label="Asset ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="usageType" label="用途" width="120" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="danger" @click="handleUnbind(row)">解绑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="assetSetFeatureSupported" shadow="never">
      <template #header>
        <div class="card-header">
          <span>资源集合管理</span>
          <div class="filter-row">
            <el-input v-model="assetSetKeyword" placeholder="按集合名称搜索" clearable style="width: 220px" />
            <el-button @click="refreshAssetSets">查询</el-button>
            <el-button type="primary" plain @click="openCreateAssetSetDialog">新建集合</el-button>
          </div>
        </div>
      </template>

      <el-alert
        title="推荐：先创建资源集合并维护集合资源，再到应用页选择集合进行生成。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 12px"
      />

      <el-table v-loading="loading.assetSets" :data="assetSets" @row-dblclick="openAssetSetDrawer">
        <el-table-column prop="id" label="Asset Set ID" min-width="220" show-overflow-tooltip />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="标签" min-width="180">
          <template #default="{ row }">{{ (row.tags || []).join(', ') || '-' }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="openAssetSetDrawer(row)">管理资源</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-else shadow="never">
      <el-alert
        title="当前后端未启用 Asset Set（/asset-sets 返回 404），已自动隐藏集合管理功能。"
        type="warning"
        show-icon
        :closable="false"
      />
    </el-card>

    <el-dialog v-model="dialogs.createAssetSet" title="新建资源集合" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="名称">
          <el-input v-model="assetSetForm.name" maxlength="120" placeholder="例如：音乐库A" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="assetSetForm.description" type="textarea" :rows="3" maxlength="300" placeholder="例如：用于播放器场景" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="assetSetForm.tagsText" placeholder="可选，逗号分隔，例如 music,cover" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.createAssetSet = false">取消</el-button>
        <el-button type="primary" :loading="loading.createAssetSet" @click="handleCreateAssetSet">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="dialogs.assetSetDrawer" :title="assetSetDrawerTitle" size="78%" destroy-on-close>
      <el-row :gutter="16">
        <el-col :span="12">
          <div class="drawer-title">全部资源</div>
          <el-table
            v-loading="loading.assets"
            :data="assets"
            height="440"
            @selection-change="handleAssetSelectionChange"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column prop="id" label="Asset ID" min-width="180" show-overflow-tooltip />
            <el-table-column prop="name" label="名称" min-width="130" show-overflow-tooltip />
            <el-table-column prop="assetType" label="类型" width="120" />
            <el-table-column prop="processedStatus" label="状态" width="110" />
          </el-table>
          <div class="drawer-actions">
            <el-button
              type="primary"
              :disabled="selectedAssetIds.length === 0 || loading.mutateAssetSetItems"
              :loading="loading.mutateAssetSetItems"
              @click="handleBatchAddAssetSetItems"
            >
              批量加入集合 ({{ selectedAssetIds.length }})
            </el-button>
          </div>
        </el-col>

        <el-col :span="12">
          <div class="drawer-title">集合内资源项</div>
          <el-table
            v-loading="loading.assetSetItems"
            :data="assetSetItems"
            height="440"
            @selection-change="handleAssetSetItemSelectionChange"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column prop="id" label="Item ID" min-width="160" show-overflow-tooltip />
            <el-table-column label="Asset ID" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.asset?.id || row.assetId || '-' }}</template>
            </el-table-column>
            <el-table-column label="资产名称" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">{{ row.asset?.name || '-' }}</template>
            </el-table-column>
            <el-table-column prop="itemOrder" label="顺序" width="80" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">{{ row.asset?.processedStatus || '-' }}</template>
            </el-table-column>
          </el-table>
          <div class="drawer-actions">
            <el-button
              type="danger"
              plain
              :disabled="selectedAssetSetItemIds.length === 0 || loading.mutateAssetSetItems"
              :loading="loading.mutateAssetSetItems"
              @click="handleBatchRemoveAssetSetItems"
            >
              批量移除 ({{ selectedAssetSetItemIds.length }})
            </el-button>
          </div>
        </el-col>
      </el-row>
    </el-drawer>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  addAssetSetItems,
  bindAppAsset,
  createAssetSet,
  getAppAssets,
  getAppList,
  getAssetList,
  getAssetSetItems,
  getAssetSetList,
  getAssetSourceFiles,
  registerAsset,
  removeAssetSetItem,
  unbindAppAsset
} from '@/api/sdui';

export default {
  name: 'SduiAssets',
  data() {
    return {
      loading: {
        assets: false,
        register: false,
        sourceFiles: false,
        bindings: false,
        assetSets: false,
        createAssetSet: false,
        assetSetItems: false,
        mutateAssetSetItems: false
      },
      apps: [],
      assets: [],
      sourceFiles: [],
      bindings: [],
      assetSets: [],
      assetSetItems: [],
      selectedAssetIds: [],
      selectedAssetSetItemIds: [],
      activeAssetSet: null,
      assetSetFeatureSupported: true,
      assetKeyword: '',
      assetSetKeyword: '',
      assetForm: {
        fileId: null,
        assetType: 'IMAGE_COVER',
        name: '默认封面',
        tagsText: ''
      },
      bindForm: {
        appId: '',
        assetId: '',
        usageType: 'cover'
      },
      assetSetForm: {
        name: '',
        description: '',
        tagsText: ''
      },
      dialogs: {
        createAssetSet: false,
        assetSetDrawer: false
      }
    };
  },
  computed: {
    assetSetDrawerTitle() {
      if (!this.activeAssetSet) return '集合资源管理';
      return `集合资源管理 - ${this.activeAssetSet.name || this.activeAssetSet.id}`;
    }
  },
  created() {
    this.refreshData();
  },
  activated() {
    this.refreshData();
  },
  methods: {
    normalizeArray(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    },
    parseCsv(raw) {
      if (!raw) return undefined;
      const items = raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      return items.length > 0 ? items : undefined;
    },
    getStatusCode(error) {
      return error?.response?.status || error?.status || error?.code;
    },
    fileLabel(file) {
      const name = file.originalFilename || `file-${file.fileId}`;
      return `${name} (#${file.fileId})`;
    },
    assetLabel(asset) {
      return `${asset.name || asset.id} [${asset.processedStatus || 'UNKNOWN'}]`;
    },
    pickAsset(row) {
      this.bindForm.assetId = row.id;
    },
    handleAssetSelectionChange(rows) {
      this.selectedAssetIds = rows.map(item => item.id).filter(Boolean);
    },
    handleAssetSetItemSelectionChange(rows) {
      this.selectedAssetSetItemIds = rows.map(item => item.id).filter(Boolean);
    },
    async handleSourceFileVisibleChange(visible) {
      if (visible && this.sourceFiles.length === 0) {
        await this.refreshSourceFiles();
      }
    },
    async refreshData() {
      this.loading.assets = true;
      const [appsRes, assetsRes, filesRes, assetSetsRes] = await Promise.allSettled([
        getAppList(),
        getAssetList({ keyword: this.assetKeyword || undefined }),
        getAssetSourceFiles(),
        this.assetSetFeatureSupported ? getAssetSetList({ keyword: this.assetSetKeyword || undefined }) : Promise.resolve({ data: [] })
      ]);

      if (appsRes.status === 'fulfilled') {
        this.apps = this.normalizeArray(appsRes.value.data);
      } else {
        ElMessage.error(`加载应用列表失败: ${appsRes.reason?.message || 'unknown error'}`);
      }
      if (assetsRes.status === 'fulfilled') {
        this.assets = this.normalizeArray(assetsRes.value.data);
      } else {
        ElMessage.error(`加载资产列表失败: ${assetsRes.reason?.message || 'unknown error'}`);
      }
      if (filesRes.status === 'fulfilled') {
        this.sourceFiles = this.normalizeArray(filesRes.value.data);
      } else {
        ElMessage.error(`加载源文件列表失败: ${filesRes.reason?.message || 'unknown error'}`);
      }

      if (assetSetsRes.status === 'fulfilled') {
        this.assetSets = this.normalizeArray(assetSetsRes.value.data);
      } else {
        const statusCode = this.getStatusCode(assetSetsRes.reason);
        if (statusCode === 404) {
          this.assetSetFeatureSupported = false;
          this.assetSets = [];
        } else {
          ElMessage.error(`加载资源集合失败: ${assetSetsRes.reason?.message || 'unknown error'}`);
        }
      }

      this.loading.assets = false;
      if (this.bindForm.appId) {
        await this.refreshBindings();
      }
    },
    async refreshAssets() {
      this.loading.assets = true;
      try {
        const res = await getAssetList({ keyword: this.assetKeyword || undefined });
        this.assets = this.normalizeArray(res.data);
      } catch (error) {
        ElMessage.error(`加载资产列表失败: ${error?.message || 'unknown error'}`);
      } finally {
        this.loading.assets = false;
      }
    },
    async refreshSourceFiles() {
      this.loading.sourceFiles = true;
      try {
        const res = await getAssetSourceFiles();
        this.sourceFiles = this.normalizeArray(res.data);
      } catch (error) {
        ElMessage.error(`加载源文件列表失败: ${error?.message || 'unknown error'}`);
      } finally {
        this.loading.sourceFiles = false;
      }
    },
    async refreshAssetSets() {
      if (!this.assetSetFeatureSupported) return;
      this.loading.assetSets = true;
      try {
        const res = await getAssetSetList({ keyword: this.assetSetKeyword || undefined });
        this.assetSets = this.normalizeArray(res.data);
      } catch (error) {
        const statusCode = this.getStatusCode(error);
        if (statusCode === 404) {
          this.assetSetFeatureSupported = false;
          this.assetSets = [];
          ElMessage.warning('当前后端未启用资源集合，已隐藏该功能区');
        } else {
          ElMessage.error(`加载资源集合失败: ${error?.message || 'unknown error'}`);
        }
      } finally {
        this.loading.assetSets = false;
      }
    },
    async refreshAssetSetItems() {
      if (!this.activeAssetSet?.id) {
        this.assetSetItems = [];
        return;
      }
      this.loading.assetSetItems = true;
      try {
        const res = await getAssetSetItems(this.activeAssetSet.id);
        this.assetSetItems = this.normalizeArray(res.data);
      } catch (error) {
        ElMessage.error(`加载集合资源失败: ${error?.message || 'unknown error'}`);
      } finally {
        this.loading.assetSetItems = false;
      }
    },
    openCreateAssetSetDialog() {
      this.assetSetForm.name = '';
      this.assetSetForm.description = '';
      this.assetSetForm.tagsText = '';
      this.dialogs.createAssetSet = true;
    },
    async handleCreateAssetSet() {
      const name = this.assetSetForm.name.trim();
      if (!name) {
        ElMessage.warning('请先填写集合名称');
        return;
      }
      this.loading.createAssetSet = true;
      try {
        await createAssetSet({
          name,
          description: this.assetSetForm.description.trim() || undefined,
          tags: this.parseCsv(this.assetSetForm.tagsText)
        });
        ElMessage.success('资源集合创建成功');
        this.dialogs.createAssetSet = false;
        await this.refreshAssetSets();
      } finally {
        this.loading.createAssetSet = false;
      }
    },
    async openAssetSetDrawer(row) {
      this.activeAssetSet = row;
      this.selectedAssetIds = [];
      this.selectedAssetSetItemIds = [];
      this.dialogs.assetSetDrawer = true;
      await Promise.allSettled([this.refreshAssets(), this.refreshAssetSetItems()]);
    },
    async handleBatchAddAssetSetItems() {
      if (!this.activeAssetSet?.id || this.selectedAssetIds.length === 0) {
        ElMessage.warning('请先选择资源集合和待加入资源');
        return;
      }

      this.loading.mutateAssetSetItems = true;
      try {
        await addAssetSetItems(this.activeAssetSet.id, { assetIds: this.selectedAssetIds });
        ElMessage.success(`已加入 ${this.selectedAssetIds.length} 个资源到集合`);
        this.selectedAssetIds = [];
        await this.refreshAssetSetItems();
      } finally {
        this.loading.mutateAssetSetItems = false;
      }
    },
    async handleBatchRemoveAssetSetItems() {
      if (!this.activeAssetSet?.id || this.selectedAssetSetItemIds.length === 0) {
        ElMessage.warning('请先选择要移除的集合资源项');
        return;
      }

      await ElMessageBox.confirm(
        `确定从集合中移除 ${this.selectedAssetSetItemIds.length} 条资源项吗？`,
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );

      this.loading.mutateAssetSetItems = true;
      try {
        await Promise.all(this.selectedAssetSetItemIds.map(itemId => removeAssetSetItem(this.activeAssetSet.id, itemId)));
        ElMessage.success(`已移除 ${this.selectedAssetSetItemIds.length} 条资源项`);
        this.selectedAssetSetItemIds = [];
        await this.refreshAssetSetItems();
      } finally {
        this.loading.mutateAssetSetItems = false;
      }
    },
    async refreshBindings() {
      if (!this.bindForm.appId) {
        this.bindings = [];
        return;
      }
      this.loading.bindings = true;
      try {
        const res = await getAppAssets(this.bindForm.appId);
        this.bindings = this.normalizeArray(res.data);
      } catch (error) {
        ElMessage.error(`加载资源绑定失败: ${error?.message || 'unknown error'}`);
      } finally {
        this.loading.bindings = false;
      }
    },
    async handleRegister() {
      if (!this.assetForm.fileId || !this.assetForm.name.trim()) {
        ElMessage.warning('请填写 fileId 和资产名称');
        return;
      }
      this.loading.register = true;
      try {
        const res = await registerAsset({
          fileId: this.assetForm.fileId,
          assetType: this.assetForm.assetType,
          name: this.assetForm.name.trim(),
          tags: this.parseCsv(this.assetForm.tagsText)
        });
        const data = res.data || {};
        this.bindForm.assetId = data.id || this.bindForm.assetId;
        ElMessage.success('资产注册成功');
        await this.refreshData();
      } finally {
        this.loading.register = false;
      }
    },
    async handleBind() {
      await bindAppAsset(this.bindForm.appId, {
        assetId: this.bindForm.assetId,
        usageType: this.bindForm.usageType || 'cover'
      });
      ElMessage.success('资源绑定成功');
      await this.refreshBindings();
    },
    async handleUnbind(row) {
      const bindingId = row.id || row.bindingId;
      if (!bindingId || !this.bindForm.appId) {
        ElMessage.warning('缺少 bindingId 或 appId');
        return;
      }
      await unbindAppAsset(this.bindForm.appId, bindingId);
      ElMessage.success('资源解绑成功');
      await this.refreshBindings();
    }
  },
  watch: {
    'bindForm.appId': {
      immediate: false,
      async handler() {
        await this.refreshBindings();
      }
    }
  }
};
</script>

<style scoped>
.sdui-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-row {
  display: flex;
  gap: 8px;
}

.drawer-title {
  margin-bottom: 8px;
  font-weight: 600;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
