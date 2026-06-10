<template>
  <div class="app-container management-page">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="能力目录" name="catalog" />
      <el-tab-pane label="调试中心" name="debug" />
    </el-tabs>
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'SduiManagement',
  data() {
    return {
      activeTab: 'catalog'
    };
  },
  created() {
    // Sync tab with current route
    const path = this.$route.path;
    if (path.includes('/management/debug')) {
      this.activeTab = 'debug';
    } else {
      this.activeTab = 'catalog';
    }
  },
  methods: {
    onTabChange(tab) {
      this.$router.push(`/sdui/management/${tab}`);
    }
  }
};
</script>

<style scoped>
.management-page {
  display: flex;
  flex-direction: column;
}
</style>
