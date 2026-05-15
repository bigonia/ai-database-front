<template>
  <div class="app-container sdui-devices">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- Tab: Claimed Devices -->
      <el-tab-pane label="已认领设备" name="claimed">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>已认领设备</span>
              <div class="header-actions">
                <span class="stat online">在线 {{ claimedOnlineCount }}</span>
                <span class="stat offline">离线 {{ claimedOfflineCount }}</span>
                <el-button plain @click="fetchClaimedDevices">刷新</el-button>
              </div>
            </div>
          </template>

          <el-table v-loading="loading.claimed" :data="claimedDevices" @row-click="openDetail">
            <el-table-column prop="deviceId" label="Device ID" min-width="170" show-overflow-tooltip />
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ONLINE' ? 'success' : 'info'" effect="plain">
                  {{ row.status || 'UNKNOWN' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="currentPageId" label="当前页面" min-width="120" show-overflow-tooltip />
            <el-table-column prop="lastSeenAt" label="最近在线" min-width="170" />
            <el-table-column prop="claimedAt" label="认领时间" min-width="170" />
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- Tab: Unclaimed Devices -->
      <el-tab-pane label="未认领设备" name="unclaimed">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>未认领设备</span>
              <el-button plain @click="fetchUnclaimedDevices">刷新</el-button>
            </div>
          </template>

          <el-table v-loading="loading.unclaimed" :data="unclaimedDevices">
            <el-table-column prop="deviceId" label="Device ID" min-width="170" show-overflow-tooltip />
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ONLINE' ? 'success' : 'info'" effect="plain">
                  {{ row.status || 'UNKNOWN' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="lastSeenAt" label="最近在线" min-width="170" />
            <el-table-column prop="createdAt" label="首次上线" min-width="170" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openClaimDialog(row)">认领</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- Claim Dialog -->
    <el-dialog v-model="dialogs.claim" title="认领设备" width="460px" destroy-on-close @closed="resetClaimForm">
      <el-form ref="claimFormRef" :model="claimForm" :rules="claimRules" label-width="80px">
        <el-form-item label="Device ID">
          <el-input :model-value="claimTarget?.deviceId" disabled />
        </el-form-item>
        <el-form-item label="认领码" prop="claimCode">
          <el-input v-model="claimForm.claimCode" placeholder="设备屏幕上显示的6位认领码" maxlength="12" />
        </el-form-item>
        <el-form-item label="设备名称" prop="deviceName">
          <el-input v-model="claimForm.deviceName" placeholder="给设备起个名字（选填）" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogs.claim = false">取消</el-button>
        <el-button type="primary" :loading="loading.claim" @click="handleClaim">确认认领</el-button>
      </template>
    </el-dialog>

    <!-- Device Detail Drawer -->
    <el-drawer v-model="dialogs.detail" :title="detailDrawerTitle" size="680px" destroy-on-close @closed="onDetailClosed">
      <el-tabs v-model="detailTab">
        <el-tab-pane label="基本信息" name="info">
          <el-descriptions v-loading="loading.detail" border :column="2">
            <el-descriptions-item label="Device ID" :span="2">{{ detail.deviceId }}</el-descriptions-item>
            <el-descriptions-item label="名称">{{ detail.name }}</el-descriptions-item>
            <el-descriptions-item label="注册状态">
              <el-tag :type="detail.registrationStatus === 'CLAIMED' ? 'success' : 'warning'" effect="plain">
                {{ detail.registrationStatus }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="连接状态">
              <el-tag :type="detail.status === 'ONLINE' ? 'success' : 'info'" effect="plain">
                {{ detail.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="硬件型号">{{ detail.board || '-' }}</el-descriptions-item>
            <el-descriptions-item label="屏幕形状">{{ detail.screenShape || '-' }}</el-descriptions-item>
            <el-descriptions-item label="分辨率">{{ detail.screenWidth || '-' }} x {{ detail.screenHeight || '-' }}</el-descriptions-item>
            <el-descriptions-item label="输入方式">{{ detail.inputMode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="当前页面">{{ detail.currentPageId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="认领时间">{{ detail.claimedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="最近在线" :span="2">{{ detail.lastSeenAt }}</el-descriptions-item>
            <el-descriptions-item label="可用指令" :span="2">
              <template v-if="detail.availableCommands?.length">
                <el-tag
                  v-for="cmd in detail.availableCommands"
                  :key="cmd"
                  size="small"
                  style="margin: 2px"
                >{{ cmd }}</el-tag>
              </template>
              <span v-else class="text-muted">-</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="遥测数据" name="telemetry">
          <div class="telemetry-actions">
            <el-button plain size="small" :loading="loading.telemetry" @click="fetchTelemetry">刷新</el-button>
          </div>
          <el-table v-loading="loading.telemetry" :data="telemetryData" size="small">
            <el-table-column prop="createdAt" label="时间" min-width="170" />
            <el-table-column prop="wifiRssi" label="WiFi RSSI (dBm)" width="140" />
            <el-table-column prop="temperature" label="温度 (°C)" width="120" />
            <el-table-column prop="freeHeapInternal" label="内部堆 (bytes)" width="140" />
            <el-table-column prop="freeHeapTotal" label="总堆 (bytes)" width="130" />
            <el-table-column prop="uptimeS" label="运行时长 (s)" width="130" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="设备控制" name="control">
          <template v-if="detail.availableCommands?.length">
            <div class="control-grid">
              <div
                v-for="cmd in controlCommands"
                :key="cmd.command"
                class="control-item"
              >
                <span class="control-name" :title="cmd.command">{{ cmd.label }}</span>
                <template v-if="cmd.needsValue">
                  <el-slider
                    v-model="cmd.currentValue"
                    :min="0"
                    :max="100"
                    show-input
                    style="flex:1; margin: 0 12px"
                  />
                  <span class="control-unit">%</span>
                </template>
                <el-button
                  :type="cmd.needsValue ? 'warning' : 'primary'"
                  size="small"
                  :loading="cmd.sending"
                  @click="handleControl(cmd)"
                >
                  执行
                </el-button>
              </div>
            </div>
          </template>
          <el-empty v-else description="该设备无可用的控制指令" />
        </el-tab-pane>

        <el-tab-pane label="调试" name="debug">
          <div class="debug-section">
            <div class="section-title">工作流调试</div>
            <div class="debug-row">
              <el-select
                v-model="debugForm.definitionId"
                filterable
                clearable
                placeholder="选择工作流"
                style="width: 200px"
              >
                <el-option v-for="wf in workflowDefs" :key="wf.id" :label="`${wf.name} (${wf.id})`" :value="wf.id" />
              </el-select>
              <el-button :loading="loading.loadWf" @click="handleLoadWorkflow">加载</el-button>
              <el-button :loading="loading.unloadWf" @click="handleUnloadWorkflow">卸载</el-button>
            </div>
            <div class="debug-row" style="margin-top: 8px">
              <el-input v-model="debugForm.triggerId" placeholder="触发器 ID" style="width: 180px" />
              <el-button type="success" :loading="loading.triggerWf" @click="handleTriggerWorkflow">手动触发</el-button>
            </div>
            <div v-if="wfStatus" class="wf-status">
              <el-tag>{{ wfStatus.status }}</el-tag>
              <span>工作流: {{ wfStatus.workflowName || wfStatus.workflowId }}</span>
              <span>页面: {{ wfStatus.activePage }}</span>
            </div>

            <el-divider />
            <div class="section-title">Section 调试</div>
            <div class="debug-row">
              <el-select v-model="debugForm.preset" filterable placeholder="预设场景" style="width: 200px">
                <el-option v-for="p in presets" :key="p" :label="p" :value="p" />
              </el-select>
              <el-button :loading="loading.sendScene" @click="handleSendScene">发送场景</el-button>
              <el-input-number v-model="debugForm.intervalMs" :min="500" :step="500" style="width: 140px" />
              <el-button
                v-if="!autoRunning"
                type="warning"
                :loading="loading.startAuto"
                @click="handleStartAuto"
              >
                自动更新
              </el-button>
              <el-button v-else type="danger" :loading="loading.stopAuto" @click="handleStopAuto">停止</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import {
  getDeviceList,
  getUnclaimedDevices,
  getDeviceDetail,
  getDeviceTelemetry,
  claimDevice,
  sendDeviceControl,
  getSectionPresets,
  getWorkflowDefinitions,
  getWorkflowStatus,
  getAutoUpdateStatus,
  loadWorkflow,
  unloadWorkflow,
  triggerWorkflow,
  sendScene,
  startAutoUpdate,
  stopAutoUpdate
} from '@/api/sdui';

const COMMAND_LABELS = {
  'display.section.render': '触发 Section 渲染',
  'display.section.patch': '触发 Section 增量更新',
  'display.layout.render': '触发 Layout 渲染',
  'display.layout.patch': '触发 Layout 增量更新',
  'display.brightness.set': '屏幕亮度',
  'audio.prompt.play': '播放提示音',
  'audio.stream.play': '播放音频流',
  'audio.volume.set': '音量',
  'rgb.effect.set': 'RGB 灯效',
  'rgb.off': '关闭 RGB',
  'device.reboot': '重启设备'
};

const COMMANDS_NEEDING_VALUE = [
  'display.brightness.set',
  'audio.volume.set'
];

export default {
  name: 'SduiDevices',
  data() {
    return {
      activeTab: 'claimed',
      loading: {
        claimed: false,
        unclaimed: false,
        detail: false,
        telemetry: false,
        claim: false,
        loadWf: false,
        unloadWf: false,
        triggerWf: false,
        sendScene: false,
        startAuto: false,
        stopAuto: false
      },
      claimedDevices: [],
      unclaimedDevices: [],
      detail: {},
      telemetryData: [],
      presets: [],
      workflowDefs: [],
      wfStatus: null,
      autoRunning: false,
      activeDeviceId: '',

      // Claim
      claimTarget: null,
      claimForm: { claimCode: '', deviceName: '' },
      claimFormRef: null,
      claimRules: {
        claimCode: [
          { required: true, message: '请输入认领码', trigger: 'blur' },
          { min: 4, max: 12, message: '认领码长度为 4-12 个字符', trigger: 'blur' }
        ]
      },

      // Debug
      debugForm: { definitionId: '', triggerId: '', preset: 'full_dashboard', intervalMs: 3000 },

      dialogs: { claim: false, detail: false },
      detailTab: 'info',
      listTimer: null
    };
  },
  computed: {
    claimedOnlineCount() {
      return this.claimedDevices.filter(d => d.status === 'ONLINE').length;
    },
    claimedOfflineCount() {
      return this.claimedDevices.filter(d => d.status !== 'ONLINE').length;
    },
    detailDrawerTitle() {
      return this.detail.name
        ? `设备详情 - ${this.detail.name}`
        : '设备详情';
    },
    controlCommands() {
      return (this.detail.availableCommands || []).map(cmd => ({
        command: cmd,
        label: COMMAND_LABELS[cmd] || cmd,
        needsValue: COMMANDS_NEEDING_VALUE.includes(cmd),
        currentValue: 50,
        sending: false
      }));
    }
  },
  created() {
    this.fetchClaimedDevices();
    this.listTimer = setInterval(() => {
      if (this.activeTab === 'claimed') {
        this.fetchClaimedDevices();
      } else {
        this.fetchUnclaimedDevices();
      }
    }, 15000);
  },
  beforeUnmount() {
    clearInterval(this.listTimer);
  },
  activated() {
    this.onTabChange(this.activeTab);
    this.listTimer = setInterval(() => {
      if (this.activeTab === 'claimed') {
        this.fetchClaimedDevices();
      } else {
        this.fetchUnclaimedDevices();
      }
    }, 15000);
  },
  deactivated() {
    clearInterval(this.listTimer);
  },
  methods: {
    onTabChange(tabName) {
      if (tabName === 'claimed') {
        this.fetchClaimedDevices();
      } else {
        this.fetchUnclaimedDevices();
      }
    },

    async fetchClaimedDevices() {
      this.loading.claimed = true;
      try {
        const res = await getDeviceList();
        this.claimedDevices = Array.isArray(res?.data) ? res.data : [];
      } catch {
        ElMessage.error('加载设备列表失败');
      } finally {
        this.loading.claimed = false;
      }
    },

    async fetchUnclaimedDevices() {
      this.loading.unclaimed = true;
      try {
        const res = await getUnclaimedDevices();
        this.unclaimedDevices = Array.isArray(res?.data) ? res.data : [];
      } catch {
        ElMessage.error('加载未认领设备失败');
      } finally {
        this.loading.unclaimed = false;
      }
    },

    // ── Claim ──────────────────────────────────────────────

    openClaimDialog(row) {
      this.claimTarget = row;
      this.claimForm = { claimCode: '', deviceName: '' };
      this.dialogs.claim = true;
    },

    resetClaimForm() {
      this.claimTarget = null;
      this.claimForm = { claimCode: '', deviceName: '' };
    },

    async handleClaim() {
      if (!this.claimForm.claimCode.trim()) {
        ElMessage.warning('请输入认领码');
        return;
      }
      this.loading.claim = true;
      try {
        await claimDevice(this.claimTarget.deviceId, {
          claimCode: this.claimForm.claimCode.trim(),
          deviceName: this.claimForm.deviceName.trim() || undefined
        });
        ElMessage.success('设备认领成功');
        this.dialogs.claim = false;
        await this.fetchUnclaimedDevices();
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || '认领失败';
        ElMessage.error(msg);
      } finally {
        this.loading.claim = false;
      }
    },

    // ── Detail ─────────────────────────────────────────────

    async openDetail(row) {
      this.activeDeviceId = row.deviceId;
      this.dialogs.detail = true;
      this.detailTab = 'info';
      await Promise.all([this.loadDetailData(), this.loadDebugData()]);
    },

    async loadDetailData() {
      this.loading.detail = true;
      this.wfStatus = null;

      try {
        const res = await getDeviceDetail(this.activeDeviceId);
        this.detail = res?.data || {};
      } catch {
        ElMessage.error('加载设备详情失败');
      } finally {
        this.loading.detail = false;
      }
    },

    async fetchTelemetry() {
      this.loading.telemetry = true;
      try {
        const res = await getDeviceTelemetry(this.activeDeviceId);
        this.telemetryData = Array.isArray(res?.data) ? res.data : [];
      } catch {
        ElMessage.error('加载遥测数据失败');
      } finally {
        this.loading.telemetry = false;
      }
    },

    async onDetailClosed() {
      this.detail = {};
      this.telemetryData = [];
      this.wfStatus = null;
      this.activeDeviceId = '';
    },

    // ── Control ────────────────────────────────────────────

    async handleControl(cmd) {
      if (cmd.needsValue && (cmd.currentValue == null || cmd.currentValue < 0)) {
        ElMessage.warning('请设置有效的值');
        return;
      }
      cmd.sending = true;
      try {
        const payload = { command: cmd.command };
        if (cmd.needsValue) {
          payload.value = cmd.currentValue;
        }
        const res = await sendDeviceControl(this.activeDeviceId, payload);
        const status = res?.data?.status;
        if (status === 'SENT') {
          ElMessage.success(`指令 ${cmd.label} 已发送`);
        } else if (status === 'FAILED') {
          ElMessage.error('设备离线，发送失败');
        } else {
          ElMessage.info(`指令状态: ${status}`);
        }
      } catch {
        ElMessage.error('发送指令失败');
      } finally {
        cmd.sending = false;
      }
    },

    // ── Debug: Workflow ────────────────────────────────────

    async loadDebugData() {
      const [presetsRes, wfDefsRes, autoRes] = await Promise.allSettled([
        getSectionPresets(),
        getWorkflowDefinitions(),
        getAutoUpdateStatus()
      ]);
      if (presetsRes.status === 'fulfilled') {
        this.presets = presetsRes.value?.data?.presets || [];
      }
      if (wfDefsRes.status === 'fulfilled') {
        this.workflowDefs = Array.isArray(wfDefsRes.value?.data) ? wfDefsRes.value.data : [];
      }
      if (autoRes.status === 'fulfilled') {
        const tasks = autoRes.value?.data || [];
        this.autoRunning = Array.isArray(tasks)
          ? tasks.some(t => t.deviceId === this.activeDeviceId || t.running)
          : false;
      }
      try {
        const statusRes = await getWorkflowStatus(this.activeDeviceId);
        this.wfStatus = statusRes?.data || null;
      } catch {
        this.wfStatus = null;
      }
    },

    async handleLoadWorkflow() {
      if (!this.debugForm.definitionId) {
        ElMessage.warning('请先选择工作流');
        return;
      }
      this.loading.loadWf = true;
      try {
        await loadWorkflow(this.activeDeviceId, this.debugForm.definitionId);
        ElMessage.success('工作流已加载');
        const statusRes = await getWorkflowStatus(this.activeDeviceId);
        this.wfStatus = statusRes?.data || null;
      } catch {
        ElMessage.error('加载工作流失败');
      } finally {
        this.loading.loadWf = false;
      }
    },

    async handleUnloadWorkflow() {
      this.loading.unloadWf = true;
      try {
        await unloadWorkflow(this.activeDeviceId);
        ElMessage.success('工作流已卸载');
        this.wfStatus = null;
      } catch {
        ElMessage.error('卸载工作流失败');
      } finally {
        this.loading.unloadWf = false;
      }
    },

    async handleTriggerWorkflow() {
      if (!this.debugForm.triggerId.trim()) {
        ElMessage.warning('请输入触发器 ID');
        return;
      }
      this.loading.triggerWf = true;
      try {
        await triggerWorkflow(this.activeDeviceId, this.debugForm.triggerId.trim());
        ElMessage.success('触发已发送');
      } catch {
        ElMessage.error('触发失败');
      } finally {
        this.loading.triggerWf = false;
      }
    },

    async handleSendScene() {
      if (!this.debugForm.preset) {
        ElMessage.warning('请选择预设场景');
        return;
      }
      this.loading.sendScene = true;
      try {
        await sendScene(this.activeDeviceId, this.debugForm.preset);
        ElMessage.success('场景已发送');
      } catch {
        ElMessage.error('发送场景失败');
      } finally {
        this.loading.sendScene = false;
      }
    },

    async handleStartAuto() {
      this.loading.startAuto = true;
      try {
        await startAutoUpdate(this.activeDeviceId, this.debugForm.preset, this.debugForm.intervalMs);
        this.autoRunning = true;
        ElMessage.success('自动更新已启动');
      } catch {
        ElMessage.error('启动自动更新失败');
      } finally {
        this.loading.startAuto = false;
      }
    },

    async handleStopAuto() {
      this.loading.stopAuto = true;
      try {
        await stopAutoUpdate(this.activeDeviceId);
        this.autoRunning = false;
        ElMessage.success('自动更新已停止');
      } catch {
        ElMessage.error('停止自动更新失败');
      } finally {
        this.loading.stopAuto = false;
      }
    }
  }
};
</script>

<style scoped>
.sdui-devices {
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
}

.stat.online  { background: #eaf7ef; color: #2f8f54; }
.stat.offline { background: #f3f4f6; color: #636d7c; }

.text-muted { color: #909399; font-size: 13px; }

/* Telemetry */
.telemetry-actions {
  margin-bottom: 12px;
}

/* Control */
.control-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 8px;
  gap: 8px;
}

.control-name {
  min-width: 160px;
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.control-unit {
  font-size: 12px;
  color: #909399;
  min-width: 20px;
}

/* Debug */
.debug-section {
  padding: 8px 0;
}

.section-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.debug-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.wf-status {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #606266;
  font-size: 13px;
}
</style>
