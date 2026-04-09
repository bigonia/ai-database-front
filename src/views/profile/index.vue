<template>
  <div class="app-container">
    <el-card shadow="never">
      <template #header>个人中心</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户名">{{ name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ rolesText }}</el-descriptions-item>
      </el-descriptions>
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
    ...mapState(store.user, ['name', 'roles']),
    rolesText() {
      if (!this.roles || this.roles.length === 0) {
        return '-';
      }
      return this.roles.join(' | ');
    }
  }
});
</script>
