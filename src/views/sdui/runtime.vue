<template>
  <div class="app-container sdui-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>运行时监控</span>
          <el-button plain @click="refreshData">刷新</el-button>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col :span="6"><el-card shadow="never">总设备: {{ overview.totalDevices ?? '-' }}</el-card></el-col>
        <el-col :span="6"><el-card shadow="never">在线设备: {{ overview.onlineDevices ?? '-' }}</el-card></el-col>
        <el-col :span="6"><el-card shadow="never">ACK 指令: {{ overview.ackedCommands ?? '-' }}</el-card></el-col>
        <el-col :span="6"><el-card shadow="never">超时指令: {{ overview.timeoutCommands ?? '-' }}</el-card></el-col>
      </el-row>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header"><span>Worker 状态</span></div>
      </template>
      <el-table v-loading="loading.workers" :data="workers">
        <el-table-column prop="workerId" label="Worker ID" min-width="200" show-overflow-tooltip />
        <el-table-column prop="state" label="状态" width="120" />
        <el-table-column label="健康" width="80">
          <template #default="{ row }">{{ row.healthy ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="handledRequests" label="处理数" width="120" />
        <el-table-column prop="lastError" label="最近错误" min-width="240" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { getOpsOverview, getRuntimeWorkers } from '@/api/sdui';

export default {
  name: 'SduiRuntime',
  data() {
    return {
      loading: {
        workers: false
      },
      overview: {},
      workers: []
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
    async refreshData() {
      this.loading.workers = true;
      const [workersRes, overviewRes] = await Promise.allSettled([getRuntimeWorkers(), getOpsOverview()]);
      if (workersRes.status === 'fulfilled') {
        this.workers = this.normalizeArray(workersRes.value.data);
      } else {
        ElMessage.error(`加载 Worker 状态失败: ${workersRes.reason?.message || 'unknown error'}`);
      }
      if (overviewRes.status === 'fulfilled') {
        this.overview = overviewRes.value.data || {};
      } else {
        ElMessage.error(`加载运维概览失败: ${overviewRes.reason?.message || 'unknown error'}`);
      }
      this.loading.workers = false;
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
</style>
