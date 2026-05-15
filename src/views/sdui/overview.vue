<template>
  <div class="app-container sdui-overview">
    <!-- Device Stats -->
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

    <!-- Command Stats -->
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>指令统计</span>
              <el-button text @click="refresh">刷新</el-button>
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
import { getOpsOverview } from '@/api/sdui';

export default {
  name: 'SduiOverview',
  data() {
    return {
      loading: false,
      overview: {
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        sentCommands: 0,
        failedCommands: 0,
        ackedCommands: 0,
        rejectedCommands: 0,
        errorCommands: 0,
        timeoutCommands: 0
      },
      timer: null
    };
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
          this.overview = res.data;
        }
      } catch {
        // silent
      }
    }
  }
};
</script>

<style scoped>
.sdui-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.stat-card.online .stat-value { color: #2f8f54; }
.stat-card.offline .stat-value { color: #909399; }

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

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

.cmd-stat.acked .cmd-value  { color: #2f8f54; }
.cmd-stat.failed .cmd-value  { color: #e6a23c; }
.cmd-stat.rejected .cmd-value { color: #f56c6c; }
.cmd-stat.error .cmd-value    { color: #f56c6c; }
.cmd-stat.timeout .cmd-value  { color: #909399; }
</style>
