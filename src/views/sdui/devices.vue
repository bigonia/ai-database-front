<template>
  <div class="app-container sdui-page">
    <el-card shadow="never" class="toolbar-card">
      <template #header>
        <div class="card-header">
          <span>设备管理看板</span>
          <el-button plain @click="refreshAll">刷新</el-button>
        </div>
      </template>
      <div class="toolbar-metrics">
        <div class="metric-pill online">在线 {{ onlineCount }}</div>
        <div class="metric-pill offline">离线 {{ offlineCount }}</div>
        <div class="metric-pill total">总数 {{ devices.length }}</div>
        <div class="metric-pill unclaimed">待认领 {{ unclaimedDevices.length }}</div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>待认领设备</span>
          <span class="hint">两阶段接入：先认领，再发布应用</span>
        </div>
      </template>
      <el-table v-loading="loading.unclaimed" :data="unclaimedDevices">
        <el-table-column prop="deviceId" label="Device ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="claimCode" label="Claim Code" width="140" />
        <el-table-column prop="name" label="设备名" min-width="160" />
        <el-table-column prop="lastSeenAt" label="最近在线" min-width="180">
          <template #default="{ row }">{{ formatTime(row.lastSeenAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="openClaimDialog(row)">认领</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading.unclaimed && unclaimedDevices.length === 0" description="暂无待认领设备" />
    </el-card>

    <el-row v-loading="loading.devices" :gutter="16">
      <el-col v-for="device in devices" :key="device.deviceId" :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="device-card">
          <template #header>
            <div class="device-head">
              <div class="device-title-wrap">
                <span class="status-dot" :class="device.status === 'ONLINE' ? 'dot-online' : 'dot-offline'" />
                <div>
                  <div class="device-title">{{ device.name || '未命名设备' }}</div>
                  <div class="device-id">{{ device.deviceId }}</div>
                </div>
              </div>
              <el-tag :type="device.status === 'ONLINE' ? 'success' : 'info'" effect="plain">
                {{ device.status || 'UNKNOWN' }}
              </el-tag>
            </div>
          </template>

          <div class="gauge-row">
            <div class="gauge-item">
              <div class="gauge-label">亮度</div>
              <el-progress type="dashboard" :percentage="getGaugeValue(device.deviceId, 'brightness')" :stroke-width="8" />
              <div class="gauge-actions">
                <el-button size="small" @click="adjustGauge(device.deviceId, 'brightness', -10)">-10</el-button>
                <el-button size="small" type="primary" @click="adjustGauge(device.deviceId, 'brightness', 10)">+10</el-button>
              </div>
            </div>

            <div class="gauge-item">
              <div class="gauge-label">音量</div>
              <el-progress type="dashboard" :percentage="getGaugeValue(device.deviceId, 'volume')" :stroke-width="8" status="success" />
              <div class="gauge-actions">
                <el-button size="small" @click="adjustGauge(device.deviceId, 'volume', -10)">-10</el-button>
                <el-button size="small" type="success" @click="adjustGauge(device.deviceId, 'volume', 10)">+10</el-button>
              </div>
            </div>
          </div>

          <div class="device-actions">
            <el-button size="small" @click="applyControl(device.deviceId, 'brightness')">发送亮度</el-button>
            <el-button size="small" @click="applyControl(device.deviceId, 'volume')">发送音量</el-button>
            <el-button size="small" type="primary" @click="openTelemetry(device.deviceId)">遥测</el-button>
          </div>

          <el-collapse>
            <el-collapse-item title="高级信息">
              <div class="meta-line">当前应用: {{ device.currentAppId || '-' }}</div>
              <div class="meta-line">当前页面: {{ device.currentPageId || '-' }}</div>
              <div class="meta-line">最近在线: {{ formatTime(device.lastSeenAt) }}</div>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!loading.devices && devices.length === 0" description="暂无设备" />

    <el-dialog v-model="dialogs.telemetry" :title="`设备遥测: ${activeDeviceId}`" width="64%">
      <el-table :data="telemetry" height="360">
        <el-table-column prop="createdAt" label="时间" min-width="180" />
        <el-table-column prop="wifiRssi" label="RSSI" width="100" />
        <el-table-column prop="temperature" label="温度" width="100" />
        <el-table-column prop="freeHeapInternal" label="内部堆" width="120" />
        <el-table-column prop="freeHeapTotal" label="总堆" width="120" />
        <el-table-column prop="uptimeS" label="Uptime(s)" width="110" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="dialogs.claim" title="认领设备" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="Device ID">
          <el-input :model-value="claimForm.deviceId" disabled />
        </el-form-item>
        <el-form-item label="Claim Code">
          <el-input v-model="claimForm.claimCode" maxlength="12" placeholder="请输入设备上显示的 claimCode" />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="claimForm.deviceName" maxlength="100" placeholder="可选，便于管理端识别" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.claim = false">取消</el-button>
        <el-button type="primary" :loading="loading.claim" @click="handleClaim">确认认领</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { claimDevice, controlDevice, getDeviceList, getDeviceTelemetry, getUnclaimedDeviceList } from '@/api/sdui';

const DEFAULT_GAUGE = {
  brightness: 70,
  volume: 60
};

export default {
  name: 'SduiDevices',
  data() {
    return {
      loading: {
        devices: false,
        unclaimed: false,
        claim: false
      },
      devices: [],
      unclaimedDevices: [],
      telemetry: [],
      activeDeviceId: '',
      claimForm: {
        deviceId: '',
        claimCode: '',
        deviceName: ''
      },
      gaugeByDevice: {},
      dialogs: {
        telemetry: false,
        claim: false
      }
    };
  },
  computed: {
    onlineCount() {
      return this.devices.filter(item => item.status === 'ONLINE').length;
    },
    offlineCount() {
      return this.devices.filter(item => item.status !== 'ONLINE').length;
    }
  },
  created() {
    this.refreshAll();
  },
  activated() {
    this.refreshAll();
  },
  methods: {
    normalizeArray(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    },
    ensureDeviceGauge(deviceId) {
      if (!this.gaugeByDevice[deviceId]) {
        this.gaugeByDevice[deviceId] = { ...DEFAULT_GAUGE };
      }
      return this.gaugeByDevice[deviceId];
    },
    getGaugeValue(deviceId, key) {
      return this.ensureDeviceGauge(deviceId)[key];
    },
    setGaugeValue(deviceId, key, value) {
      const next = Math.max(0, Math.min(100, value));
      this.ensureDeviceGauge(deviceId)[key] = next;
    },
    adjustGauge(deviceId, key, delta) {
      const current = this.getGaugeValue(deviceId, key);
      this.setGaugeValue(deviceId, key, current + delta);
    },
    formatTime(value) {
      if (!value) return '-';
      return new Date(value).toLocaleString('zh-CN', { hour12: false });
    },
    async refreshAll() {
      await Promise.allSettled([this.refreshDevices(), this.refreshUnclaimed()]);
    },
    async refreshDevices() {
      this.loading.devices = true;
      try {
        const res = await getDeviceList();
        this.devices = this.normalizeArray(res.data);
        this.devices.forEach(item => {
          this.ensureDeviceGauge(item.deviceId);
        });
      } catch (error) {
        ElMessage.error(`加载设备列表失败: ${error?.message || 'unknown error'}`);
      } finally {
        this.loading.devices = false;
      }
    },
    async refreshUnclaimed() {
      this.loading.unclaimed = true;
      try {
        const res = await getUnclaimedDeviceList();
        this.unclaimedDevices = this.normalizeArray(res.data);
      } catch (error) {
        ElMessage.error(`加载待认领设备失败: ${error?.message || 'unknown error'}`);
      } finally {
        this.loading.unclaimed = false;
      }
    },
    openClaimDialog(row) {
      this.claimForm.deviceId = row.deviceId || '';
      this.claimForm.claimCode = row.claimCode || '';
      this.claimForm.deviceName = row.name || '';
      this.dialogs.claim = true;
    },
    async handleClaim() {
      if (!this.claimForm.deviceId) {
        ElMessage.warning('缺少设备 ID');
        return;
      }
      const claimCode = this.claimForm.claimCode.trim();
      if (claimCode.length < 4 || claimCode.length > 12) {
        ElMessage.warning('claimCode 长度需在 4~12 位');
        return;
      }
      this.loading.claim = true;
      try {
        await claimDevice(this.claimForm.deviceId, {
          claimCode,
          deviceName: this.claimForm.deviceName.trim() || undefined
        });
        ElMessage.success('设备认领成功');
        this.dialogs.claim = false;
        await this.refreshAll();
      } finally {
        this.loading.claim = false;
      }
    },
    async applyControl(deviceId, command) {
      const value = this.getGaugeValue(deviceId, command);
      const res = await controlDevice(deviceId, {
        command,
        value
      });
      const data = res.data || {};
      ElMessage.success(`已发送 ${command}: ${value} (cmdId=${data.cmdId || 'unknown'})`);
    },
    async openTelemetry(deviceId) {
      this.activeDeviceId = deviceId;
      const res = await getDeviceTelemetry(deviceId);
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

.toolbar-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-metrics {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.metric-pill {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
}

.metric-pill.online {
  background: #eaf7ef;
  color: #2f8f54;
}

.metric-pill.offline {
  background: #f3f4f6;
  color: #636d7c;
}

.metric-pill.total {
  background: #eef4ff;
  color: #3b67b1;
}

.metric-pill.unclaimed {
  background: #fff6e8;
  color: #b26f1f;
}

.device-card {
  border-radius: 14px;
  margin-bottom: 16px;
}

.device-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.device-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-title {
  font-weight: 700;
  color: #1f2937;
}

.device-id {
  color: #6b7280;
  font-size: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.dot-online {
  background: #16a34a;
}

.dot-offline {
  background: #9ca3af;
}

.gauge-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.gauge-item {
  flex: 1;
  text-align: center;
}

.gauge-label {
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 4px;
}

.gauge-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.device-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 10px 0;
}

.meta-line {
  color: #4b5563;
  font-size: 12px;
  margin: 2px 0;
}

.hint {
  color: #909399;
  font-size: 12px;
}

@media (max-width: 768px) {
  .gauge-row {
    flex-direction: column;
  }
}
</style>
