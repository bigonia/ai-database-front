<template>
  <div class="app-container sdui-overview">
    <!-- Row 1: Device Stats + Health Summary -->
    <el-row :gutter="16">
      <el-col :xs="24" :sm="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ overview.totalDevices }}</div>
            <div class="stat-label">设备总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card shadow="hover">
          <div class="stat-card online">
            <div class="stat-value">{{ overview.onlineDevices }}</div>
            <div class="stat-label">在线设备</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card shadow="hover">
          <div class="stat-card offline">
            <div class="stat-value">{{ overview.offlineDevices }}</div>
            <div class="stat-label">离线设备</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 2: Health Summary -->
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-card healthy">
            <div class="stat-value">{{ overview.healthSummary?.healthy || 0 }}</div>
            <div class="stat-label">
              <span class="health-dot" style="background: #22c55e" />
              健康
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-card warning">
            <div class="stat-value">{{ overview.healthSummary?.warning || 0 }}</div>
            <div class="stat-label">
              <span class="health-dot" style="background: #eab308" />
              告警
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-card critical">
            <div class="stat-value">{{ overview.healthSummary?.critical || 0 }}</div>
            <div class="stat-label">
              <span class="health-dot" style="background: #ef4444" />
              严重
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-card unknown">
            <div class="stat-value">{{ overview.healthSummary?.unknown || 0 }}</div>
            <div class="stat-label">
              <span class="health-dot" style="background: #9ca3af" />
              未知
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 3: Average Health Score + Board Distribution -->
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="24" :sm="12">
        <el-card shadow="never">
          <div class="section-header">
            <span>平均健康评分</span>
            <span class="avg-score" :style="{ color: avgHealthColor }">
              {{ overview.avgHealthScore != null ? overview.avgHealthScore.toFixed(1) : '—' }}
            </span>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-card shadow="never">
          <template #header>
            <span class="section-title">板卡分布</span>
          </template>
          <div v-if="boardEntries.length" class="board-list">
            <div v-for="[name, count] in boardEntries" :key="name" class="board-item">
              <span class="board-name">{{ name }}</span>
              <el-tag size="small" type="info">{{ count }}</el-tag>
            </div>
          </div>
          <el-empty v-else description="暂无数据" :image-size="40" />
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 4: Devices Needing Attention -->
    <el-row v-if="attentionDevices.length" :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span class="section-title" style="color: #e6a23c">
                <el-icon style="vertical-align: middle"><WarningFilled /></el-icon>
                需关注设备 ({{ attentionDevices.length }})
              </span>
            </div>
          </template>
          <div class="attention-list">
            <div
              v-for="device in attentionDevices"
              :key="device.deviceId"
              class="attention-card"
              @click="goToDevice(device.deviceId)"
            >
              <div class="attention-header">
                <span class="attention-name">{{ device.name || device.deviceId }}</span>
                <el-tag :type="healthTagType(device.healthLevel)" size="small" effect="dark">
                  {{ device.healthLevel }}
                </el-tag>
              </div>
              <div class="attention-body">
                <span class="attention-score">
                  健康分: <strong :style="{ color: healthColor(device.healthLevel) }">{{ device.healthScore ?? '—' }}</strong>
                </span>
                <span class="attention-status">
                  <el-tag :type="device.status === 'ONLINE' ? 'success' : 'info'" size="small" effect="plain">
                    {{ device.status === 'ONLINE' ? '在线' : '离线' }}
                  </el-tag>
                </span>
              </div>
              <div v-if="device.warnings?.length" class="attention-warnings">
                <el-tag
                  v-for="w in device.warnings"
                  :key="w"
                  size="small"
                  type="warning"
                  effect="plain"
                  style="margin-right: 4px"
                >{{ w }}</el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 5: Command Stats -->
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>指令统计</span>
              <div class="header-right">
                <span v-if="overview.commandSummary?.overallSuccessRate != null" class="success-rate">
                  总成功率:
                  <strong :style="{ color: successRateColor }">
                    {{ overview.commandSummary.overallSuccessRate.toFixed(1) }}%
                  </strong>
                </span>
                <el-button text @click="refresh">刷新</el-button>
              </div>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :xs="12" :sm="4">
              <div class="cmd-stat">
                <div class="cmd-value">{{ overview.sentCommands }}</div>
                <div class="cmd-label">已发送</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="4">
              <div class="cmd-stat acked">
                <div class="cmd-value">{{ overview.ackedCommands }}</div>
                <div class="cmd-label">已确认</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="4">
              <div class="cmd-stat failed">
                <div class="cmd-value">{{ overview.failedCommands }}</div>
                <div class="cmd-label">发送失败</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="4">
              <div class="cmd-stat rejected">
                <div class="cmd-value">{{ overview.rejectedCommands }}</div>
                <div class="cmd-label">已拒绝</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="4">
              <div class="cmd-stat error">
                <div class="cmd-value">{{ overview.errorCommands }}</div>
                <div class="cmd-label">执行出错</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="4">
              <div class="cmd-stat timeout">
                <div class="cmd-value">{{ overview.timeoutCommands }}</div>
                <div class="cmd-label">超时</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { getOpsOverview } from '@/api/sdui';
import { HEALTH_LEVEL_COLORS, HEALTH_LEVEL_TAG_TYPES } from '@/utils/sdui-normalize';

export default {
  name: 'SduiOverview',
  data() {
    return {
      loading: false,
      overview: {
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        claimedDevices: 0,
        unclaimedDevices: 0,
        sentCommands: 0,
        failedCommands: 0,
        ackedCommands: 0,
        rejectedCommands: 0,
        errorCommands: 0,
        timeoutCommands: 0,
        healthSummary: { healthy: 0, warning: 0, critical: 0, unknown: 0 },
        commandSummary: { overallSuccessRate: 0 },
        boardDistribution: {},
        avgHealthScore: 0,
        devicesNeedingAttention: []
      },
      timer: null
    };
  },
  computed: {
    attentionDevices() {
      return this.overview.devicesNeedingAttention || [];
    },
    boardEntries() {
      const dist = this.overview.boardDistribution || {};
      return Object.entries(dist).sort((a, b) => b[1] - a[1]);
    },
    avgHealthColor() {
      const s = this.overview.avgHealthScore;
      if (s == null) return '#9ca3af';
      if (s >= 80) return '#22c55e';
      if (s >= 50) return '#eab308';
      return '#ef4444';
    },
    successRateColor() {
      const r = this.overview.commandSummary?.overallSuccessRate;
      if (r == null) return '#9ca3af';
      if (r >= 95) return '#22c55e';
      if (r >= 80) return '#eab308';
      return '#ef4444';
    }
  },
  created() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 30000);
  },
  beforeUnmount() {
    clearInterval(this.timer);
  },
  activated() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 30000);
  },
  deactivated() {
    clearInterval(this.timer);
  },
  methods: {
    async refresh() {
      try {
        const res = await getOpsOverview();
        if (res?.data) {
          // 深度合并以保留默认值结构
          Object.assign(this.overview, res.data);
        }
      } catch {
        ElMessage.error('加载运维概览失败');
      }
    },
    healthColor(level) {
      return HEALTH_LEVEL_COLORS[level] || '#9ca3af';
    },
    healthTagType(level) {
      return HEALTH_LEVEL_TAG_TYPES[level] || 'info';
    },
    goToDevice(deviceId) {
      this.$router.push({ path: '/sdui/devices', query: { deviceId }});
    }
  }
};
</script>

<style scoped>
.sdui-overview {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.stat-card {
  text-align: center;
  padding: 8px 0;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.stat-card.online .stat-value   { color: #2f8f54; }
.stat-card.offline .stat-value  { color: #909399; }
.stat-card.healthy .stat-value  { color: #22c55e; }
.stat-card.warning .stat-value  { color: #eab308; }
.stat-card.critical .stat-value { color: #ef4444; }
.stat-card.unknown .stat-value  { color: #9ca3af; }

.health-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
  margin-right: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.section-title {
  font-weight: 600;
  font-size: 15px;
}

.avg-score {
  font-size: 32px;
  font-weight: 700;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.success-rate {
  font-size: 14px;
  color: #606266;
}

/* Board Distribution */
.board-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.board-item:last-child {
  border-bottom: none;
}

.board-name {
  font-family: monospace;
  font-size: 13px;
  color: #303133;
}

/* Devices Needing Attention */
.attention-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.attention-card {
  padding: 14px 16px;
  border: 1px solid #e4e7ed;
  border-left: 4px solid #e6a23c;
  border-radius: 6px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.attention-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.attention-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.attention-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.attention-body {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #606266;
}

.attention-score strong {
  font-size: 15px;
}

.attention-warnings {
  margin-top: 8px;
}

/* Command Stats */
.cmd-stat {
  text-align: center;
  padding: 12px 8px;
}

.cmd-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.cmd-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.cmd-stat.acked .cmd-value   { color: #2f8f54; }
.cmd-stat.failed .cmd-value   { color: #e6a23c; }
.cmd-stat.rejected .cmd-value { color: #f56c6c; }
.cmd-stat.error .cmd-value    { color: #f56c6c; }
.cmd-stat.timeout .cmd-value  { color: #909399; }
</style>
