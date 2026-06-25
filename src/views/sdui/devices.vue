<template>
  <div class="app-container sdui-devices-page">
    <section class="hero">
      <div>
        <span class="hero-kicker">Device Console</span>
        <h1>终端列表</h1>
        <p>保留原本的卡片缩略信息展示和点击后的详情查看，同时把设备能力信息纳入详情面板。</p>
      </div>
      <div class="hero-actions">
        <el-button plain :loading="loading.deviceTypes" @click="fetchDeviceTypes">刷新机型</el-button>
        <el-button type="primary" :loading="loading.claimed || loading.unclaimed" @click="refreshAll">刷新列表</el-button>
      </div>
    </section>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="已认领设备" name="claimed">
        <section class="summary-bar">
          <span>总计 <strong>{{ pagination.total }}</strong></span>
          <span class="online">在线 <strong>{{ summary.online }}</strong></span>
          <span class="offline">离线 <strong>{{ summary.offline }}</strong></span>
          <span>机型 <strong>{{ deviceTypes.length }}</strong></span>
        </section>

        <section class="filter-bar">
          <el-select v-model="filters.status" clearable placeholder="在线状态" style="width: 140px" @change="resetAndFetch">
            <el-option label="在线" value="ONLINE" />
            <el-option label="离线" value="OFFLINE" />
          </el-select>
          <el-select v-model="filters.board" clearable filterable placeholder="硬件型号" style="width: 180px" @change="resetAndFetch">
            <el-option
              v-for="item in deviceTypes"
              :key="item.board"
              :label="`${item.label || item.board} (${item.deviceCount || 0})`"
              :value="item.board"
            />
          </el-select>
          <el-input v-model="filters.search" clearable placeholder="搜索设备名称或 ID" style="width: 240px" @clear="resetAndFetch" @keyup.enter="resetAndFetch" />
          <el-select v-model="filters.sortBy" style="width: 150px" @change="fetchClaimedDevices">
            <el-option label="最近在线" value="lastSeenAt" />
            <el-option label="名称" value="name" />
            <el-option label="状态" value="status" />
          </el-select>
          <el-radio-group v-model="filters.sortDir" @change="fetchClaimedDevices">
            <el-radio-button label="DESC" value="DESC">降序</el-radio-button>
            <el-radio-button label="ASC" value="ASC">升序</el-radio-button>
          </el-radio-group>
        </section>

        <el-card shadow="never" v-loading="loading.claimed" class="list-shell">
          <el-row v-if="claimedDevices.length" :gutter="16" class="device-grid">
            <el-col v-for="device in claimedDevices" :key="device.deviceId" :xs="24" :sm="12" :xl="8">
              <div class="device-card" @click="openDetail(device)">
                <div class="device-card-top">
                  <div>
                    <div class="device-name">{{ device.name || device.deviceName || device.deviceId }}</div>
                    <div class="device-id">{{ device.deviceId }}</div>
                  </div>
                  <el-tag :type="device.status === 'ONLINE' ? 'success' : 'info'" effect="dark" round>
                    {{ device.status === 'ONLINE' ? '在线' : '离线' }}
                  </el-tag>
                </div>

                <div class="device-preview" :class="device.status === 'ONLINE' ? 'online' : 'offline'">
                  <div class="preview-shell">
                    <div class="preview-screen">
                      <div class="screen-line wide" />
                      <div class="screen-line" />
                      <div class="screen-line short" />
                      <div class="screen-bars">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                    <div class="preview-buttons">
                      <span />
                      <span />
                    </div>
                  </div>
                  <div class="preview-meta">
                    <span>{{ formatBoard(device.board) }}</span>
                    <span>{{ device.inputMode || 'input' }}</span>
                  </div>
                </div>

                <div class="stats-row">
                  <div class="mini-stat">
                    <span>电量</span>
                    <strong>{{ batteryLabel(device) }}</strong>
                  </div>
                  <div class="mini-stat">
                    <span>WiFi</span>
                    <strong>{{ wifiLabel(device) }}</strong>
                  </div>
                  <div class="mini-stat">
                    <span>温度</span>
                    <strong>{{ tempLabel(device) }}</strong>
                  </div>
                </div>

                <div class="pill-row">
                  <span class="meta-pill">{{ device.registrationStatus || '-' }}</span>
                  <span class="meta-pill">{{ device.sizeClass || 'unknown' }}</span>
                  <span class="meta-pill">{{ device.currentAppId || '未绑定应用' }}</span>
                </div>

                <div class="device-card-bottom">
                  <div class="last-seen">
                    <span>上次在线</span>
                    <strong>{{ formatTime(device.lastSeenAt) }}</strong>
                  </div>
                  <div class="card-actions">
                    <el-button link type="primary" @click.stop="openDetail(device)">详情</el-button>
                    <el-button link type="danger" @click.stop="handleDelete(device)">删除</el-button>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>

          <el-empty v-else description="没有符合筛选条件的终端" :image-size="80" />

          <Pagination
            v-if="pagination.total > 0"
            :total="pagination.total"
            :page="pagination.page"
            :limit="pagination.size"
            @pagination="handlePagination"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="未认领设备" name="unclaimed">
        <section class="summary-bar">
          <span>待认领 <strong>{{ unclaimedDevices.length }}</strong></span>
          <span class="online">在线 <strong>{{ unclaimedOnline }}</strong></span>
          <span class="offline">离线 <strong>{{ unclaimedOffline }}</strong></span>
        </section>

        <el-card shadow="never" v-loading="loading.unclaimed" class="list-shell">
          <el-row v-if="unclaimedDevices.length" :gutter="16" class="device-grid">
            <el-col v-for="device in unclaimedDevices" :key="device.deviceId" :xs="24" :sm="12" :xl="8">
              <div class="device-card unclaimed">
                <div class="device-card-top">
                  <div>
                    <div class="device-name">{{ device.name || '待命名终端' }}</div>
                    <div class="device-id">{{ device.deviceId }}</div>
                  </div>
                  <el-tag :type="device.status === 'ONLINE' ? 'success' : 'info'" effect="plain" round>
                    {{ device.status === 'ONLINE' ? '在线' : '离线' }}
                  </el-tag>
                </div>

                <div class="device-preview waiting">
                  <div class="preview-shell">
                    <div class="preview-screen waiting-screen">WAITING</div>
                    <div class="preview-buttons">
                      <span />
                      <span />
                    </div>
                  </div>
                  <div class="preview-meta">
                    <span>{{ formatBoard(device.board) }}</span>
                    <span>{{ device.registrationStatus || 'UNCLAIMED' }}</span>
                  </div>
                </div>

                <div class="stats-row compact">
                  <div class="mini-stat">
                    <span>认领码</span>
                    <strong>{{ device.claimCode || '-' }}</strong>
                  </div>
                  <div class="mini-stat">
                    <span>上次在线</span>
                    <strong>{{ formatTime(device.lastSeenAt) }}</strong>
                  </div>
                </div>

                <div class="device-card-bottom">
                  <div class="last-seen">
                    <span>终端状态</span>
                    <strong>{{ device.status || '-' }}</strong>
                  </div>
                  <div class="card-actions">
                    <el-button type="primary" plain round @click.stop="openClaimDialog(device)">认领设备</el-button>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>

          <el-empty v-else description="当前没有待认领终端" :image-size="80" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialogs.claim" title="认领设备" width="460px" destroy-on-close>
      <el-form label-width="88px">
        <el-form-item label="Device ID">
          <el-input :model-value="claimForm.deviceId" disabled />
        </el-form-item>
        <el-form-item label="认领码">
          <el-input v-model="claimForm.claimCode" maxlength="12" placeholder="设备上显示的认领码" />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="claimForm.deviceName" maxlength="100" placeholder="可选，认领后显示名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.claim = false">取消</el-button>
        <el-button type="primary" :loading="loading.claim" @click="submitClaim">确认认领</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="dialogs.detail" :title="detailTitle" size="760px" @closed="onDetailClosed">
      <el-tabs v-model="detailTab">
        <el-tab-pane label="设备快照" name="overview">
          <div class="detail-pane">
            <el-descriptions v-loading="loading.detail" border :column="2">
              <el-descriptions-item label="Device ID">{{ detail.deviceId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="名称">{{ detail.name || detail.deviceName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ detail.status || '-' }}</el-descriptions-item>
              <el-descriptions-item label="注册状态">{{ detail.registrationStatus || '-' }}</el-descriptions-item>
              <el-descriptions-item label="板卡">{{ formatBoard(detail.board) }}</el-descriptions-item>
              <el-descriptions-item label="输入方式">{{ detail.inputMode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="当前应用">{{ detail.currentAppId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="当前页面">{{ detail.currentPageId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="连接时间">{{ formatTime(detail.connectedAt) }}</el-descriptions-item>
              <el-descriptions-item label="最近在线">{{ formatTime(detail.lastSeenAt) }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">{{ detail.notes || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>

        <el-tab-pane label="能力详情" name="capabilities">
          <div class="detail-pane">
            <el-card v-loading="loading.capabilities" shadow="never" class="detail-card">
              <template #header>
                <div class="detail-card-header">
                  <span>Resolved Contract</span>
                  <el-tag :type="capabilityStatusType(capabilities.status)">{{ capabilities.status || 'unknown' }}</el-tag>
                </div>
              </template>
              <pre class="json-panel">{{ prettyJson(capabilities) }}</pre>
            </el-card>

            <el-card shadow="never" class="detail-card">
              <template #header><span>Section 能力</span></template>
              <pre class="json-panel">{{ prettyJson(sections) }}</pre>
            </el-card>

            <el-card shadow="never" class="detail-card">
              <template #header><span>设备事件</span></template>
              <pre class="json-panel">{{ prettyJson(events) }}</pre>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="遥测记录" name="telemetry">
          <div class="detail-pane">
            <el-table v-loading="loading.telemetry" :data="telemetryRows" size="small">
              <el-table-column prop="createdAt" label="时间" min-width="180">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="RSSI" min-width="100">
                <template #default="{ row }">{{ row.wifi?.rssi ?? row.wifiRssi ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="温度" min-width="100">
                <template #default="{ row }">{{ row.temperature?.celsius ?? row.temperature ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="电量" min-width="100">
                <template #default="{ row }">{{ row.power?.batteryPct ?? row.batteryPct ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="运行时长(s)" min-width="120">
                <template #default="{ row }">{{ row.uptimeS ?? '-' }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-if="!telemetryRows.length && !loading.telemetry" description="暂无遥测数据" :image-size="60" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="连接日志" name="connection">
          <div class="detail-pane">
            <el-table v-loading="loading.connection" :data="connectionRows" size="small">
              <el-table-column prop="createdAt" label="时间" min-width="180">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column prop="event" label="事件" min-width="140" />
              <el-table-column prop="status" label="状态" min-width="120" />
              <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
            </el-table>
            <el-empty v-if="!connectionRows.length && !loading.connection" description="暂无连接日志" :image-size="60" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import Pagination from '@/components/Pagination/index.vue';
import {
  claimDevice,
  deleteDevice,
  getDeviceCapabilities,
  getDeviceCapabilityEvents,
  getDeviceConnectionLog,
  getDeviceDetail,
  getDeviceList,
  getDeviceSections,
  getDeviceTelemetry,
  getBoardTypes,
  getUnclaimedDevices
} from '@/api/sdui';

export default {
  name: 'SduiDevices',
  components: { Pagination },
  data() {
    return {
      activeTab: 'claimed',
      claimedDevices: [],
      unclaimedDevices: [],
      deviceTypes: [],
      telemetryRows: [],
      connectionRows: [],
      detail: {},
      capabilities: {},
      sections: {},
      events: [],
      claimForm: {
        deviceId: '',
        claimCode: '',
        deviceName: ''
      },
      filters: {
        status: '',
        board: '',
        search: '',
        sortBy: 'lastSeenAt',
        sortDir: 'DESC'
      },
      pagination: {
        page: 1,
        size: 12,
        total: 0
      },
      detailTab: 'overview',
      detailDrawerKey: 0,
      dialogs: {
        claim: false,
        detail: false
      },
      loading: {
        claimed: false,
        unclaimed: false,
        claim: false,
        detail: false,
        telemetry: false,
        connection: false,
        capabilities: false,
        deviceTypes: false
      }
    };
  },
  computed: {
    summary() {
      return {
        online: this.claimedDevices.filter((item) => item.status === 'ONLINE').length,
        offline: this.claimedDevices.filter((item) => item.status !== 'ONLINE').length
      };
    },
    unclaimedOnline() {
      return this.unclaimedDevices.filter((item) => item.status === 'ONLINE').length;
    },
    unclaimedOffline() {
      return this.unclaimedDevices.filter((item) => item.status !== 'ONLINE').length;
    },
    detailTitle() {
      return this.detail.name || this.detail.deviceName || this.detail.deviceId || '设备详情';
    }
  },
  created() {
    this.refreshAll();
    this.fetchDeviceTypes();
  },
  methods: {
    async refreshAll() {
      await Promise.all([this.fetchClaimedDevices(), this.fetchUnclaimedDevices()]);
    },
    async fetchClaimedDevices() {
      this.loading.claimed = true;
      try {
        const params = {
          page: this.pagination.page - 1,
          size: this.pagination.size,
          registrationStatus: 'CLAIMED',
          status: this.filters.status || undefined,
          board: this.filters.board || undefined,
          search: this.filters.search || undefined,
          sortBy: this.filters.sortBy,
          sortDir: this.filters.sortDir
        };
        const res = await getDeviceList(params);
        const data = res?.data || {};
        this.claimedDevices = data.items || [];
        this.pagination.total = data.total || this.claimedDevices.length;
      } catch {
        this.claimedDevices = [];
        ElMessage.error('加载终端列表失败');
      } finally {
        this.loading.claimed = false;
      }
    },
    async fetchUnclaimedDevices() {
      this.loading.unclaimed = true;
      try {
        const res = await getUnclaimedDevices();
        this.unclaimedDevices = res?.data || [];
      } catch {
        this.unclaimedDevices = [];
        ElMessage.error('加载未认领设备失败');
      } finally {
        this.loading.unclaimed = false;
      }
    },
    async fetchDeviceTypes() {
      this.loading.deviceTypes = true;
      try {
        const res = await getBoardTypes();
        this.deviceTypes = Array.isArray(res?.data) ? res.data : [];
      } finally {
        this.loading.deviceTypes = false;
      }
    },
    resetAndFetch() {
      this.pagination.page = 1;
      this.fetchClaimedDevices();
    },
    handlePagination({ page, limit }) {
      this.pagination.page = page;
      this.pagination.size = limit;
      this.fetchClaimedDevices();
    },
    openClaimDialog(device) {
      this.claimForm = {
        deviceId: device.deviceId || '',
        claimCode: device.claimCode || '',
        deviceName: device.name || ''
      };
      this.dialogs.claim = true;
    },
    async submitClaim() {
      if (!this.claimForm.deviceId || !this.claimForm.claimCode) {
        ElMessage.warning('请填写设备 ID 和认领码');
        return;
      }
      this.loading.claim = true;
      try {
        await claimDevice(this.claimForm.deviceId, {
          claimCode: this.claimForm.claimCode.trim(),
          deviceName: this.claimForm.deviceName.trim() || undefined
        });
        ElMessage.success('设备认领成功');
        this.dialogs.claim = false;
        this.activeTab = 'claimed';
        await this.refreshAll();
      } catch {
        ElMessage.error('设备认领失败');
      } finally {
        this.loading.claim = false;
      }
    },
    async handleDelete(device) {
      try {
        await ElMessageBox.confirm(`确认删除设备 ${device.name || device.deviceId}？`, '删除设备', {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        });
      } catch {
        return;
      }
      try {
        await deleteDevice(device.deviceId);
        ElMessage.success('设备已删除');
        this.fetchClaimedDevices();
      } catch {
        ElMessage.error('删除设备失败');
      }
    },
    async openDetail(device) {
      this.detailDrawerKey += 1;
      this.dialogs.detail = true;
      this.detailTab = 'overview';
      const deviceId = device.deviceId;
      this.loading.detail = true;
      this.loading.capabilities = true;
      this.loading.telemetry = true;
      this.loading.connection = true;
      try {
        const [detailRes, capabilityRes, sectionRes, eventRes, telemetryRes, connectionRes] = await Promise.all([
          getDeviceDetail(deviceId),
          getDeviceCapabilities(deviceId),
          getDeviceSections(deviceId),
          getDeviceCapabilityEvents(deviceId),
          getDeviceTelemetry(deviceId, { page: 0, size: 20 }),
          getDeviceConnectionLog(deviceId, { page: 0, size: 20 })
        ]);
        this.detail = detailRes?.data || {};
        this.capabilities = capabilityRes?.data || {};
        this.sections = sectionRes?.data || {};
        this.events = eventRes?.data?.events || [];
        this.telemetryRows = telemetryRes?.data?.items || telemetryRes?.data || [];
        this.connectionRows = connectionRes?.data?.items || connectionRes?.data || [];
      } catch {
        ElMessage.error('加载设备详情失败');
      } finally {
        this.loading.detail = false;
        this.loading.capabilities = false;
        this.loading.telemetry = false;
        this.loading.connection = false;
      }
    },
    onDetailClosed() {
      this.detail = {};
      this.capabilities = {};
      this.sections = {};
      this.events = [];
      this.telemetryRows = [];
      this.connectionRows = [];
    },
    batteryLabel(device) {
      const value = device?.lastTelemetry?.power?.batteryPct;
      return value == null ? '-' : `${value}%`;
    },
    wifiLabel(device) {
      const value = device?.lastTelemetry?.wifi?.rssi;
      return value == null ? '-' : `${value} dBm`;
    },
    tempLabel(device) {
      const value = device?.lastTelemetry?.temperature?.celsius;
      return value == null ? '-' : `${value}°C`;
    },
    formatTime(value) {
      if (!value) return '-';
      return new Date(value).toLocaleString('zh-CN', { hour12: false });
    },
    formatBoard(value) {
      return value || '-';
    },
    capabilityStatusType(status) {
      if (status === 'ok') return 'success';
      if (status === 'partial') return 'warning';
      return 'info';
    },
    prettyJson(value) {
      return JSON.stringify(value || {}, null, 2);
    }
  }
};
</script>

<style scoped>
.sdui-devices-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero,
.hero-actions,
.summary-bar,
.filter-bar,
.device-card-top,
.device-card-bottom,
.preview-meta,
.card-actions,
.detail-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hero {
  padding: 24px;
  border-radius: 20px;
  background: linear-gradient(135deg, #f8fafc, #eef6ff 45%, #f0fdf4);
}

.hero h1 {
  margin: 6px 0 8px;
}

.hero-kicker {
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.summary-bar {
  margin: 8px 0 14px;
  color: #4b5563;
  font-size: 14px;
}

.summary-bar .online strong {
  color: #15803d;
}

.summary-bar .offline strong {
  color: #6b7280;
}

.filter-bar {
  margin-bottom: 12px;
  justify-content: flex-start;
}

.list-shell {
  margin-top: 16px;
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
}

:deep(.list-shell .el-card__body) {
  padding: 20px;
}

.device-grid {
  width: 100%;
}

.device-card {
  height: 100%;
  padding: 18px;
  border: 1px solid #dbe7f3;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #f9fbff);
  cursor: pointer;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.device-card:hover {
  transform: translateY(-2px);
  border-color: #93c5fd;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
}

.device-card.unclaimed {
  background: linear-gradient(180deg, #fffdf7, #fff7ed);
}

.device-name {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.device-id,
.preview-meta,
.meta-pill,
.last-seen span {
  color: #6b7280;
}

.device-preview {
  margin: 16px 0;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
}

.device-preview.waiting {
  background: linear-gradient(135deg, #fff7ed, #fffbeb);
}

.preview-shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.preview-screen {
  width: 132px;
  height: 90px;
  padding: 12px;
  border-radius: 14px;
  background: #111827;
}

.waiting-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fbbf24;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.screen-line {
  height: 8px;
  border-radius: 999px;
  background: #38bdf8;
  margin-bottom: 8px;
}

.screen-line.wide {
  width: 80%;
}

.screen-line.short {
  width: 46%;
}

.screen-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 26px;
}

.screen-bars span {
  width: 10px;
  border-radius: 999px;
  background: #22c55e;
}

.screen-bars span:nth-child(1) {
  height: 10px;
}

.screen-bars span:nth-child(2) {
  height: 16px;
}

.screen-bars span:nth-child(3) {
  height: 22px;
}

.screen-bars span:nth-child(4) {
  height: 14px;
}

.preview-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-buttons span {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #cbd5e1;
}

.stats-row,
.pill-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.stats-row.compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mini-stat,
.meta-pill {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e5edf6;
  background: rgba(248, 250, 252, 0.92);
}

.mini-stat span {
  display: block;
  margin-bottom: 6px;
  color: #6b7280;
  font-size: 12px;
}

.mini-stat strong,
.last-seen strong {
  color: #111827;
}

.meta-pill {
  text-align: center;
  font-size: 12px;
}

.detail-pane {
  min-height: 320px;
}

.detail-card {
  margin-bottom: 16px;
}

.last-seen {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.json-panel {
  margin: 0;
  padding: 14px;
  border-radius: 12px;
  background: #0f172a;
  color: #dbeafe;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .stats-row,
  .pill-row {
    grid-template-columns: 1fr;
  }
}
</style>
