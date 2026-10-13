<template>
  <div class="app-container">
    <el-card shadow="never">
      <template #header>个人中心</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户名">{{ name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ rolesText }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="agent-token-card" shadow="never">
      <template #header>Agent 接入</template>
      <p>导出包含服务地址、MCP 配置、HTTP 调用信息和使用说明的完整接入包。</p>
      <el-button type="primary" @click="$router.push('/sdui/agent-access')">前往 Agent 接入</el-button>
    </el-card>
  </div>
</template>

<script>
import { mapState } from 'pinia';
import { defineComponent } from 'vue';
import store from '@/store';

export default defineComponent({
  name: 'Profile',
  computed: {
    ...mapState(store.user, ['name', 'roles', 'token']),
    rolesText() {
      if (!this.roles || this.roles.length === 0) {
        return '-';
      }
      return this.roles.join(' | ');
    }
  }
});
</script>

<style scoped>
.agent-token-card { margin-top: 20px; }
.agent-token-card p { margin: 0 0 16px; color: #606266; }
.export-button { margin-top: 18px; }
</style>
