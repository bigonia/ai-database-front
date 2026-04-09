<template>
  <div class="app-container sdui-page">
    <el-card shadow="never" class="toolbar-card">
      <template #header>
        <div class="card-header">
          <span>SDUI 联调工作台</span>
          <el-button type="primary" plain @click="refreshAll">刷新全部</el-button>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col :span="16">
          <el-form label-width="96px" @submit.prevent>
            <el-form-item label="生成需求">
              <el-input
                v-model="generateForm.requirement"
                placeholder="例如：生成一个音乐卡片，显示封面、标题和播放按钮"
              />
            </el-form-item>
            <el-form-item label="目标设备">
              <el-input v-model="generateForm.deviceId" placeholder="设备 ID（可选）" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="loading.generate" @click="handleGenerate">生成应用</el-button>
              <el-button :disabled="!selectedAppId" @click="handlePublish">发布到设备</el-button>
              <el-button :disabled="!selectedDeviceId" @click="openTelemetry">查看遥测</el-button>
            </el-form-item>
          </el-form>
        </el-col>

        <el-col :span="8">
          <el-form label-width="88px" @submit.prevent>
            <el-form-item label="控制设备">
              <el-select v-model="controlForm.command" style="width: 120px">
                <el-option label="亮度" value="brightness" />
                <el-option label="音量" value="volume" />
              </el-select>
              <el-input-number v-model="controlForm.value" :min="0" :max="100" style="margin-left: 8px" />
            </el-form-item>
            <el-form-item>
              <el-button :disabled="!selectedDeviceId" @click="handleControl">发送控制</el-button>
            </el-form-item>

            <el-divider />

            <el-form-item label="File ID">
              <el-input-number v-model="assetForm.fileId" :min="1" style="width: 100%" />
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
            <el-form-item>
              <el-button :loading="loading.asset" @click="handleRegisterAsset">注册资产</el-button>
              <el-button :disabled="!selectedAppId || !selectedAssetId" @click="handleBindAsset">绑定到应用</el-button>
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="16" class="summary-row">
      <el-col :span="6">
        <el-card shadow="never"><div>在线设备: {{ overview.onlineDevices ?? '-' }}</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never"><div>离线设备: {{ overview.offlineDevices ?? '-' }}</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never"><div>ACK 指令: {{ overview.ackedCommands ?? '-' }}</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never"><div>健康 Worker: {{ overview.healthyWorkerCount ?? '-' }}</div></el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never" class="table-card">
          <template #header>
            <div class="card-header"><span>应用列表</span></div>
          </template>
          <el-table v-loading="loading.apps" :data="apps" height="300" @row-click="pickApp">
            <el-table-column prop="id" label="App ID" min-width="160" show-overflow-tooltip />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button link type="primary" @click.stop="openVersions(row)">版本</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="hint">当前选择 App: {{ selectedAppId || '未选择' }}</div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" class="table-card">
          <template #header>
            <div class="card-header"><span>设备列表</span></div>
          </template>
          <el-table v-loading="loading.devices" :data="devices" height="300" @row-click="pickDevice">
            <el-table-column prop="deviceId" label="Device ID" min-width="170" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="currentPageId" label="页面" min-width="120" />
          </el-table>
          <div class="hint">当前选择设备: {{ selectedDeviceId || '未选择' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt16">
      <el-col :span="12">
        <el-card shadow="never" class="table-card">
          <template #header>
            <div class="card-header"><span>资产列表</span></div>
          </template>
          <el-table v-loading="loading.assets" :data="assets" height="260" @row-click="pickAsset">
            <el-table-column prop="id" label="Asset ID" min-width="160" show-overflow-tooltip />
            <el-table-column prop="assetType" label="类型" width="130" />
            <el-table-column prop="processedStatus" label="处理状态" width="120" />
          </el-table>
          <div class="hint">当前选择资产: {{ selectedAssetId || '未选择' }}</div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" class="table-card">
          <template #header>
            <div class="card-header"><span>Worker 状态</span></div>
          </template>
          <el-table v-loading="loading.workers" :data="workers" height="260">
            <el-table-column prop="workerId" label="Worker ID" min-width="150" show-overflow-tooltip />
            <el-table-column prop="state" label="状态" width="120" />
            <el-table-column label="健康" width="80">
              <template #default="{ row }">{{ row.healthy ? '是' : '否' }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="dialogs.versions" title="应用版本" width="55%">
      <el-table :data="appVersions" height="320">
        <el-table-column prop="id" label="Version ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="versionNo" label="版本号" width="100" />
        <el-table-column prop="published" label="已发布" width="100">
          <template #default="{ row }">{{ row.published ? '是' : '否' }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="dialogs.telemetry" title="设备遥测" width="55%">
      <el-table :data="telemetry" height="320">
        <el-table-column prop="createdAt" label="时间" min-width="180" />
        <el-table-column prop="wifiRssi" label="RSSI" width="90" />
        <el-table-column prop="temperature" label="温度" width="90" />
        <el-table-column prop="uptimeS" label="Uptime(s)" width="110" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import {
  bindAppAsset,
  controlDevice,
  generateApp,
  getAppList,
  getAppVersions,
  getAssetList,
  getDeviceList,
  getDeviceTelemetry,
  getOpsOverview,
  getRuntimeWorkers,
  publishApp,
  registerAsset
} from '@/api/sdui';

export default {
  name: 'SduiConsole',
  data() {
    return {
      loading: {
        generate: false,
        asset: false,
        apps: false,
        devices: false,
        assets: false,
        workers: false
      },
      generateForm: {
        requirement: '生成一个音乐卡片，显示封面、标题和播放按钮',
        deviceId: ''
      },
      controlForm: {
        command: 'brightness',
        value: 70
      },
      assetForm: {
        fileId: 1,
        assetType: 'IMAGE_COVER',
        name: '默认封面'
      },
      apps: [],
      devices: [],
      assets: [],
      workers: [],
      overview: {},
      appVersions: [],
      telemetry: [],
      selectedAppId: '',
      selectedDeviceId: '',
      selectedAssetId: '',
      dialogs: {
        versions: false,
        telemetry: false
      }
    };
  },
  created() {
    this.refreshAll();
  },
  methods: {
    normalizeArray(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    },
    async refreshAll() {
      this.loading.apps = true;
      this.loading.devices = true;
      this.loading.assets = true;
      this.loading.workers = true;
      const [appsRes, deviceRes, assetRes, workerRes, overviewRes] = await Promise.allSettled([
        getAppList(),
        getDeviceList(),
        getAssetList(),
        getRuntimeWorkers(),
        getOpsOverview()
      ]);

      if (appsRes.status === 'fulfilled') {
        this.apps = this.normalizeArray(appsRes.value.data);
      }
      if (deviceRes.status === 'fulfilled') {
        this.devices = this.normalizeArray(deviceRes.value.data);
      }
      if (assetRes.status === 'fulfilled') {
        this.assets = this.normalizeArray(assetRes.value.data);
      }
      if (workerRes.status === 'fulfilled') {
        this.workers = this.normalizeArray(workerRes.value.data);
      }
      if (overviewRes.status === 'fulfilled') {
        this.overview = overviewRes.value.data || {};
      }

      this.loading.apps = false;
      this.loading.devices = false;
      this.loading.assets = false;
      this.loading.workers = false;
    },
    pickApp(row) {
      this.selectedAppId = row.id;
    },
    pickDevice(row) {
      this.selectedDeviceId = row.deviceId;
      if (!this.generateForm.deviceId) {
        this.generateForm.deviceId = row.deviceId;
      }
    },
    pickAsset(row) {
      this.selectedAssetId = row.id;
    },
    async handleGenerate() {
      if (!this.generateForm.requirement.trim()) {
        ElMessage.warning('请先输入生成需求');
        return;
      }
      this.loading.generate = true;
      try {
        const payload = {
          requirement: this.generateForm.requirement.trim(),
          targetDeviceIds: this.generateForm.deviceId ? [this.generateForm.deviceId] : undefined
        };
        const res = await generateApp(payload);
        const data = res.data || {};
        this.selectedAppId = data.appId || this.selectedAppId;
        ElMessage.success(`应用生成成功，appId: ${data.appId || 'unknown'}`);
        await this.refreshAll();
      } finally {
        this.loading.generate = false;
      }
    },
    async handlePublish() {
      if (!this.selectedAppId) {
        ElMessage.warning('请先选择应用');
        return;
      }
      if (!this.selectedDeviceId && !this.generateForm.deviceId) {
        ElMessage.warning('请先选择设备');
        return;
      }
      const deviceId = this.selectedDeviceId || this.generateForm.deviceId;
      const res = await publishApp(this.selectedAppId, { deviceIds: [deviceId] });
      const data = res.data || {};
      ElMessage.success(`发布完成: ${data.sent ?? 0}/${data.requested ?? 0}`);
      await this.refreshAll();
    },
    async handleControl() {
      if (!this.selectedDeviceId) {
        ElMessage.warning('请先选择设备');
        return;
      }
      const res = await controlDevice(this.selectedDeviceId, {
        command: this.controlForm.command,
        value: this.controlForm.value
      });
      const data = res.data || {};
      ElMessage.success(`控制已发送: cmdId=${data.cmdId || 'unknown'}`);
      await this.refreshAll();
    },
    async handleRegisterAsset() {
      if (!this.assetForm.fileId || !this.assetForm.name.trim()) {
        ElMessage.warning('请填写 fileId 和资产名称');
        return;
      }
      this.loading.asset = true;
      try {
        const res = await registerAsset({
          fileId: this.assetForm.fileId,
          assetType: this.assetForm.assetType,
          name: this.assetForm.name.trim()
        });
        const data = res.data || {};
        this.selectedAssetId = data.id || '';
        ElMessage.success(`资产注册成功: ${data.id || 'unknown'}`);
        await this.refreshAll();
      } finally {
        this.loading.asset = false;
      }
    },
    async handleBindAsset() {
      if (!this.selectedAppId || !this.selectedAssetId) {
        ElMessage.warning('请先选择应用和资产');
        return;
      }
      await bindAppAsset(this.selectedAppId, {
        assetId: this.selectedAssetId,
        usageType: 'cover'
      });
      ElMessage.success('资产绑定成功');
    },
    async openVersions(row) {
      const appId = row.id;
      const res = await getAppVersions(appId);
      this.appVersions = this.normalizeArray(res.data);
      this.dialogs.versions = true;
    },
    async openTelemetry() {
      if (!this.selectedDeviceId) {
        ElMessage.warning('请先选择设备');
        return;
      }
      const res = await getDeviceTelemetry(this.selectedDeviceId);
      this.telemetry = this.normalizeArray(res.data);
      this.dialogs.telemetry = true;
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

.toolbar-card,
.table-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-row {
  margin-top: -4px;
}

.mt16 {
  margin-top: 0;
}

.hint {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
}
</style>
