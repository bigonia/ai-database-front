<template>
  <div class="app-container sdui-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>应用管理</span>
          <el-button plain @click="refreshData">刷新</el-button>
        </div>
      </template>

      <el-alert
        title="推荐流程：先输入场景，再选择资源集合（可多选），最后生成应用。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 12px"
      />

      <el-form label-width="92px" @submit.prevent>
        <el-form-item label="生成需求">
          <el-input
            v-model="generateForm.requirement"
            style="width: 100%"
            placeholder="例如：生成一个音乐卡片，显示封面、标题和播放按钮"
          />
        </el-form-item>

        <el-form-item label="场景标签">
          <el-input
            v-model="generateForm.sceneTagsText"
            style="width: 100%"
            placeholder="可选，逗号分隔，例如 音乐,首页,推荐"
          />
        </el-form-item>

        <el-form-item label="资源集合" v-if="assetSetFeatureSupported">
          <el-select
            v-model="generateForm.assetSetIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            style="width: 100%"
            placeholder="建议选择 1~3 个集合"
          >
            <el-option
              v-for="set in assetSets"
              :key="set.id"
              :label="assetSetOptionLabel(set)"
              :value="set.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-else label="资源集合">
          <el-alert
            title="当前后端未启用 Asset Set（/asset-sets 返回 404），将按旧流程生成。"
            type="warning"
            :closable="false"
            show-icon
          />
        </el-form-item>

        <el-form-item label="目标设备">
          <el-select v-model="generateForm.deviceId" clearable filterable style="width: 320px" placeholder="可选">
            <el-option v-for="d in devices" :key="d.deviceId" :label="d.deviceId" :value="d.deviceId" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading.generate" @click="handleGenerate">生成应用</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-if="lastGenerateResult">
      <template #header>
        <div class="card-header"><span>最近一次生成结果</span></div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="App ID">{{ lastGenerateResult.appId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Version ID">{{ lastGenerateResult.versionId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="版本号">{{ lastGenerateResult.versionNo ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="模板">{{ lastGenerateResult.templateName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="模板描述" :span="2">{{ lastGenerateResult.templateDescription || '-' }}</el-descriptions-item>
        <el-descriptions-item label="已选资源集合" :span="2">
          {{ (lastGenerateResult.selectedAssetSetIds || []).join(', ') || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="校验结果" :span="2">
          {{ lastGenerateResult.validationReport || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>应用列表</span>
          <span class="hint">已选择: {{ selectedAppId || '未选择' }}</span>
        </div>
      </template>

      <el-table v-loading="loading.apps" :data="apps" @row-click="pickApp">
        <el-table-column prop="id" label="App ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column label="场景标签" min-width="180">
          <template #default="{ row }">{{ (row.sceneTags || []).join(', ') || '-' }}</template>
        </el-table-column>
        <el-table-column label="资源集合" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ (row.selectedAssetSetIds || []).join(', ') || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openVersions(row)">版本</el-button>
            <el-button link type="warning" @click.stop="openRevise(row)">修订</el-button>
            <el-button link type="success" @click.stop="openPublish(row)">发布</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogs.versions" title="应用版本" width="60%">
      <el-table :data="versions" height="340">
        <el-table-column prop="id" label="Version ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="versionNo" label="版本号" width="100" />
        <el-table-column prop="published" label="已发布" width="100">
          <template #default="{ row }">{{ row.published ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="validationReport" label="校验结果" min-width="180" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <el-dialog v-model="dialogs.revise" title="修订应用" width="560px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="App ID">
          <el-input :model-value="reviseForm.appId" disabled />
        </el-form-item>
        <el-form-item label="修订指令">
          <el-input
            v-model="reviseForm.instruction"
            type="textarea"
            :rows="4"
            placeholder="例如：将主色改为蓝色，标题字号增加 2px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.revise = false">取消</el-button>
        <el-button type="primary" :loading="loading.revise" @click="handleRevise">确认修订</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogs.publish" title="发布应用" width="560px">
      <el-alert
        title="当前发布内容已包含来自所选资源集合的运行时绑定。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="资源集合">
          <el-input :model-value="publishContextAssetSetIds.join(', ') || '-'" disabled />
        </el-form-item>
        <el-form-item label="目标版本">
          <el-select v-model="publishForm.versionId" clearable style="width: 100%" placeholder="默认最新版本">
            <el-option
              v-for="v in versions"
              :key="v.id"
              :label="`v${v.versionNo}${v.published ? ' (已发布)' : ''}`"
              :value="v.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标设备">
          <el-select v-model="publishForm.deviceId" filterable style="width: 100%" placeholder="请选择设备">
            <el-option
              v-for="d in devices"
              :key="d.deviceId"
              :label="`${d.deviceId} (${d.status || 'UNKNOWN'})`"
              :value="d.deviceId"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.publish = false">取消</el-button>
        <el-button type="primary" @click="handlePublish">确认发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import { generateApp, getAppList, getAppVersions, getAssetSetList, getDeviceList, publishApp, reviseApp } from '@/api/sdui';

export default {
  name: 'SduiApps',
  data() {
    return {
      loading: {
        apps: false,
        generate: false,
        revise: false,
        assetSets: false
      },
      generateForm: {
        requirement: '生成一个音乐卡片，显示封面、标题和播放按钮',
        sceneTagsText: '',
        assetSetIds: [],
        deviceId: ''
      },
      reviseForm: {
        appId: '',
        instruction: ''
      },
      publishForm: {
        appId: '',
        versionId: '',
        deviceId: ''
      },
      apps: [],
      devices: [],
      versions: [],
      assetSets: [],
      selectedAppId: '',
      assetSetFeatureSupported: true,
      publishContextAssetSetIds: [],
      lastGenerateResult: null,
      dialogs: {
        versions: false,
        revise: false,
        publish: false
      }
    };
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
    assetSetOptionLabel(item) {
      const name = item.name || item.id;
      return `${name} (${item.id})`;
    },
    async refreshData() {
      this.loading.apps = true;
      this.loading.assetSets = true;
      const [appsRes, devicesRes, assetSetsRes] = await Promise.allSettled([
        getAppList(),
        getDeviceList(),
        this.assetSetFeatureSupported ? getAssetSetList() : Promise.resolve({ data: [] })
      ]);
      if (appsRes.status === 'fulfilled') {
        this.apps = this.normalizeArray(appsRes.value.data);
      } else {
        ElMessage.error(`加载应用列表失败: ${appsRes.reason?.message || 'unknown error'}`);
      }
      if (devicesRes.status === 'fulfilled') {
        this.devices = this.normalizeArray(devicesRes.value.data);
      } else {
        ElMessage.error(`加载设备列表失败: ${devicesRes.reason?.message || 'unknown error'}`);
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
      this.loading.apps = false;
      this.loading.assetSets = false;
    },
    pickApp(row) {
      this.selectedAppId = row.id;
    },
    async confirmGenerateWithoutAssetSet() {
      try {
        await ElMessageBox.confirm(
          '未选择资源集合，AI 将按无资源上下文生成。是否继续？',
          '提示',
          {
            confirmButtonText: '继续生成',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
        return true;
      } catch {
        return false;
      }
    },
    async handleGenerate() {
      if (!this.generateForm.requirement.trim()) {
        ElMessage.warning('请先输入生成需求');
        return;
      }

      if (this.assetSetFeatureSupported && this.generateForm.assetSetIds.length === 0) {
        const confirmed = await this.confirmGenerateWithoutAssetSet();
        if (!confirmed) return;
      }

      this.loading.generate = true;
      try {
        const payload = {
          requirement: this.generateForm.requirement.trim(),
          sceneTags: this.parseCsv(this.generateForm.sceneTagsText),
          assetSetIds: this.generateForm.assetSetIds.length > 0 ? this.generateForm.assetSetIds : undefined,
          targetDeviceIds: this.generateForm.deviceId ? [this.generateForm.deviceId] : undefined
        };
        const res = await generateApp(payload);
        const data = res.data || {};
        this.lastGenerateResult = data;
        this.selectedAppId = data.appId || this.selectedAppId;
        const selectedIds = data.selectedAssetSetIds || [];
        ElMessage.success(`应用生成成功: ${data.appId || 'unknown'}，资源集合: ${selectedIds.join(', ') || '未选择'}`);
        await this.refreshData();
      } finally {
        this.loading.generate = false;
      }
    },
    async openVersions(row) {
      const res = await getAppVersions(row.id);
      this.versions = this.normalizeArray(res.data);
      this.dialogs.versions = true;
    },
    openRevise(row) {
      this.reviseForm.appId = row.id;
      this.reviseForm.instruction = '';
      this.dialogs.revise = true;
    },
    async handleRevise() {
      if (!this.reviseForm.appId || !this.reviseForm.instruction.trim()) {
        ElMessage.warning('请填写修订指令');
        return;
      }
      this.loading.revise = true;
      try {
        const res = await reviseApp(this.reviseForm.appId, {
          instruction: this.reviseForm.instruction.trim()
        });
        const data = res.data || {};
        ElMessage.success(`修订完成: v${data.versionNo ?? '-'}`);
        this.dialogs.revise = false;
        await this.refreshData();
      } finally {
        this.loading.revise = false;
      }
    },
    async openPublish(row) {
      this.publishForm.appId = row.id;
      this.publishForm.versionId = '';
      this.publishForm.deviceId = this.generateForm.deviceId || this.devices[0]?.deviceId || '';
      this.publishContextAssetSetIds = row.selectedAssetSetIds || [];
      const res = await getAppVersions(row.id);
      this.versions = this.normalizeArray(res.data);
      this.dialogs.publish = true;
    },
    async handlePublish() {
      if (!this.publishForm.appId || !this.publishForm.deviceId) {
        ElMessage.warning('请先选择应用和设备');
        return;
      }
      const res = await publishApp(this.publishForm.appId, {
        versionId: this.publishForm.versionId || undefined,
        deviceIds: [this.publishForm.deviceId]
      });
      const data = res.data || {};
      ElMessage.success(`发布完成: ${data.sent ?? 0}/${data.requested ?? 0}`);
      this.dialogs.publish = false;
      await this.refreshData();
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

.hint {
  color: #909399;
  font-size: 12px;
}
</style>
