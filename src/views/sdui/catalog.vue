<template>
  <div class="app-container catalog-page">
    <section class="catalog-topbar">
      <div class="topbar-title">
        <span class="topbar-kicker">SDUI Catalog</span>
        <h1>能力目录</h1>
        <p>按模块、分组、能力、明细四层浏览，默认折叠详细项，减少视觉噪音。</p>
      </div>
      <el-button @click="refreshAll">刷新</el-button>
    </section>

    <section class="stats-grid">
      <article class="stat-tile">
        <span class="stat-label">设备数</span>
        <strong class="stat-value">{{ stats.devicesTracked || 0 }}</strong>
      </article>
      <article class="stat-tile">
        <span class="stat-label">事件数</span>
        <strong class="stat-value">{{ stats.knownEvents || 0 }}</strong>
      </article>
      <article class="stat-tile">
        <span class="stat-label">命令数</span>
        <strong class="stat-value">{{ stats.knownCommands || 0 }}</strong>
      </article>
      <article class="stat-tile">
        <span class="stat-label">Section 类型</span>
        <strong class="stat-value">{{ stats.knownSectionTypes || 0 }}</strong>
      </article>
      <article class="stat-tile">
        <span class="stat-label">设备类型</span>
        <strong class="stat-value">{{ stats.deviceTypes || 0 }}</strong>
      </article>
    </section>

    <el-card shadow="never" v-loading="loading.catalog" class="catalog-shell">
      <template #header>
        <div class="shell-header">
          <div>
            <div class="shell-title">模块视图</div>
            <div class="shell-subtitle">{{ moduleSummary }}</div>
          </div>
          <span class="shell-badge">{{ activeModuleBadge }}</span>
        </div>
      </template>

      <template v-if="modules.length">
        <div class="module-switcher">
          <button
            v-for="module in modules"
            :key="module.module"
            type="button"
            class="module-chip"
            :class="{ active: activeModule === module.module }"
            @click="activeModule = module.module"
          >
            <span class="module-chip-kicker">{{ moduleLabel(module.module) }}</span>
            <strong>{{ module.label || module.module }}</strong>
            <span>{{ capabilityCount(module) }} 项能力</span>
          </button>
        </div>

        <section v-if="activeModuleData" class="module-stage" :class="`stage-${activeModuleData.module}`">
          <header class="module-hero">
            <div class="module-hero-copy">
              <span class="module-pill">{{ moduleLabel(activeModuleData.module) }}</span>
              <h2>{{ activeModuleData.label || activeModuleData.module }}</h2>
              <p>{{ activeModuleData.description || '暂无描述' }}</p>
            </div>
            <div class="module-hero-metrics">
              <article class="metric-box">
                <span>分组</span>
                <strong>{{ activeModuleData.groups?.length || 0 }}</strong>
              </article>
              <article class="metric-box">
                <span>能力</span>
                <strong>{{ capabilityCount(activeModuleData) }}</strong>
              </article>
              <article class="metric-box">
                <span>明细</span>
                <strong>{{ detailCount(activeModuleData) }}</strong>
              </article>
            </div>
          </header>

          <el-collapse v-model="openGroups" class="group-collapse">
            <el-collapse-item
              v-for="group in activeModuleData.groups || []"
              :key="group.category"
              :name="group.category"
              class="group-collapse-item"
            >
              <template #title>
                <div class="group-row">
                  <div class="group-row-main">
                    <strong>{{ group.label || group.category }}</strong>
                    <span>{{ group.category }}</span>
                  </div>
                  <div class="group-row-side">
                    <span>{{ group.capabilities?.length || 0 }} 项能力</span>
                    <span>{{ groupDetailCount(group, activeModuleData) }} 条明细</span>
                  </div>
                </div>
              </template>

              <el-collapse v-model="openCapabilities" class="capability-collapse">
                <el-collapse-item
                  v-for="capability in group.capabilities"
                  :key="capability.capability"
                  :name="capabilityKey(activeModuleData, group, capability)"
                  class="capability-collapse-item"
                >
                  <template #title>
                    <div class="capability-row">
                      <div class="capability-row-main">
                        <strong>{{ capability.label || capability.capability }}</strong>
                        <span>{{ capability.capability }}</span>
                      </div>
                      <span class="capability-row-count">
                        {{ moduleLeafItems(capability, activeModuleData).length }} 条
                      </span>
                    </div>
                  </template>

                  <div class="detail-stack">
                    <article
                      v-for="detail in moduleLeafItems(capability, activeModuleData)"
                      :key="detail.key"
                      class="detail-card"
                    >
                      <div class="detail-card-head">
                        <el-tag :type="detail.tagType" size="small" effect="dark" round>{{ detail.kind }}</el-tag>
                        <strong>{{ detail.title }}</strong>
                      </div>
                      <p v-if="detail.description" class="detail-card-desc">{{ detail.description }}</p>
                      <div v-if="detail.meta?.length" class="detail-card-meta">
                        <span v-for="meta in detail.meta" :key="meta" class="meta-token">{{ meta }}</span>
                      </div>
                    </article>
                    <el-empty
                      v-if="!moduleLeafItems(capability, activeModuleData).length"
                      description="暂无明细"
                      :image-size="36"
                    />
                  </div>
                </el-collapse-item>
              </el-collapse>
            </el-collapse-item>
          </el-collapse>
        </section>
      </template>

      <el-empty v-else description="暂无目录数据" :image-size="48" />
    </el-card>
  </div>
</template>

<script>
import { getCapabilityCatalog } from '@/api/sdui';

export default {
  name: 'SduiCatalog',
  data() {
    return {
      activeModule: '',
      openGroups: [],
      openCapabilities: [],
      stats: {},
      modules: [],
      loading: { catalog: false }
    };
  },
  computed: {
    moduleSummary() {
      return this.modules.length ? `${this.modules.length} 个模块` : '未加载';
    },
    activeModuleData() {
      return this.modules.find((item) => item.module === this.activeModule) || null;
    },
    activeModuleBadge() {
      if (!this.activeModuleData) return '等待数据';
      return `${this.activeModuleData.label || this.activeModuleData.module} · ${this.detailCount(this.activeModuleData)} 条明细`;
    }
  },
  watch: {
    activeModule() {
      this.resetExpansion();
    }
  },
  created() {
    this.refreshAll();
  },
  activated() {
    this.refreshAll();
  },
  methods: {
    async refreshAll() {
      this.loading.catalog = true;
      try {
        const res = await getCapabilityCatalog();
        const data = res?.data || {};
        this.stats = data.stats || {};
        this.modules = Array.isArray(data.modules) ? data.modules : [];
        if (!this.modules.find((item) => item.module === this.activeModule)) {
          this.activeModule = this.modules[0]?.module || '';
        }
        this.resetExpansion();
      } catch {
        this.modules = [];
        this.openGroups = [];
        this.openCapabilities = [];
      } finally {
        this.loading.catalog = false;
      }
    },

    resetExpansion() {
      const module = this.activeModuleData;
      const firstGroup = module?.groups?.[0];
      const firstCapability = firstGroup?.capabilities?.[0];
      this.openGroups = firstGroup ? [firstGroup.category] : [];
      this.openCapabilities = firstCapability ? [this.capabilityKey(module, firstGroup, firstCapability)] : [];
    },

    moduleLeafItems(capability, module) {
      if (module?.module === 'inputs') {
        return (capability.events || []).map((item) => ({
          key: item.eventId,
          kind: '事件',
          title: item.displayName || item.eventId,
          description: item.description || '',
          meta: [item.eventId, item.transport, item.sourceCapability].filter(Boolean),
          tagType: 'success'
        }));
      }
      if (module?.module === 'outputs') {
        return (capability.commands || []).map((item) => ({
          key: item.eventId || item.commandId,
          kind: '命令',
          title: item.displayName || item.eventId || item.commandId,
          description: item.description || '',
          meta: [item.eventId || item.commandId, item.transport, item.sourceCapability].filter(Boolean),
          tagType: 'warning'
        }));
      }
      const sectionItems = (capability.sections || []).map((item) => ({
        key: item.type,
        kind: 'Section',
        title: item.displayName || item.type,
        description: item.interactive ? '支持交互事件' : '展示型 Section',
        meta: [item.type, ...(item.interactionEvents || [])].filter(Boolean),
        tagType: item.interactive ? 'danger' : 'info'
      }));
      const layoutItems = (capability.layouts || []).map((item) => ({
        key: item.name,
        kind: '布局',
        title: item.name,
        description: item.description || '',
        meta: [item.name].filter(Boolean),
        tagType: 'primary'
      }));
      return [...sectionItems, ...layoutItems];
    },

    moduleLabel(module) {
      const map = {
        inputs: 'Inputs',
        outputs: 'Outputs',
        sections: 'Sections'
      };
      return map[module] || 'Module';
    },

    capabilityCount(module) {
      return (module?.groups || []).reduce((total, group) => total + (group.capabilities?.length || 0), 0);
    },

    detailCount(module) {
      return (module?.groups || []).reduce((total, group) => total + this.groupDetailCount(group, module), 0);
    },

    groupDetailCount(group, module) {
      return (group?.capabilities || []).reduce((total, capability) => {
        return total + this.moduleLeafItems(capability, module).length;
      }, 0);
    },

    capabilityKey(module, group, capability) {
      return `${module?.module || 'module'}:${group?.category || 'group'}:${capability?.capability || 'capability'}`;
    }
  }
};
</script>

<style scoped>
.catalog-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}

.catalog-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border: 1px solid #dbe6e8;
  border-radius: 20px;
  background: linear-gradient(180deg, #fcfdfd 0%, #f5f9fa 100%);
}

.topbar-kicker {
  display: inline-block;
  margin-bottom: 6px;
  color: #5d7b81;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.topbar-title h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.1;
  color: #16373d;
}

.topbar-title p {
  margin: 8px 0 0;
  max-width: 680px;
  color: #6f858a;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.stat-tile {
  padding: 16px 18px;
  border: 1px solid #e2ebed;
  border-radius: 18px;
  background: #fff;
}

.stat-label {
  display: block;
  color: #74898e;
  font-size: 12px;
}

.stat-value {
  display: block;
  margin-top: 8px;
  color: #17383e;
  font-size: 28px;
}

.catalog-shell {
  border: none;
  background: #f8fbfb;
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shell-title {
  font-size: 20px;
  font-weight: 700;
  color: #18393f;
}

.shell-subtitle {
  margin-top: 4px;
  color: #778d92;
  font-size: 13px;
}

.shell-badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: #ebf3f4;
  color: #2d5961;
  font-size: 12px;
  font-weight: 600;
}

.module-switcher {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.module-chip {
  padding: 16px;
  border: 1px solid #dbe7e9;
  border-radius: 18px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.module-chip:hover {
  border-color: #b9cfd3;
  transform: translateY(-1px);
}

.module-chip.active {
  border-color: #17383e;
  background: linear-gradient(180deg, #fff 0%, #eef6f7 100%);
  box-shadow: 0 12px 24px rgba(23, 56, 62, 0.08);
}

.module-chip-kicker,
.module-chip span {
  display: block;
  color: #73888d;
  font-size: 12px;
}

.module-chip strong {
  display: block;
  margin: 6px 0 8px;
  color: #17383e;
  font-size: 17px;
}

.module-stage {
  padding: 18px;
  border: 1px solid #dfeaec;
  border-radius: 22px;
  background: #fff;
}

.module-hero {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, #fbfdfd 0%, #f3f8f9 100%);
}

.module-pill {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 999px;
  background: #e8f1f3;
  color: #325d64;
  font-size: 12px;
}

.module-hero-copy h2 {
  margin: 10px 0 6px;
  color: #16383e;
  font-size: 26px;
}

.module-hero-copy p {
  margin: 0;
  color: #6c8287;
  line-height: 1.6;
}

.module-hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(88px, 1fr));
  gap: 12px;
  min-width: 300px;
}

.metric-box {
  padding: 14px;
  border: 1px solid #e1eaec;
  border-radius: 16px;
  background: #fff;
}

.metric-box span {
  display: block;
  color: #798e93;
  font-size: 12px;
}

.metric-box strong {
  display: block;
  margin-top: 8px;
  color: #17383e;
  font-size: 22px;
}

.group-collapse,
.capability-collapse {
  border-top: none;
  border-bottom: none;
}

.group-collapse :deep(.el-collapse-item),
.capability-collapse :deep(.el-collapse-item) {
  margin-bottom: 12px;
  border: none;
}

.group-collapse :deep(.el-collapse-item__header),
.capability-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 68px;
  padding: 0 18px;
  border: 1px solid #dfeaec;
  border-radius: 18px;
  background: #fff;
  line-height: 1.4;
}

.group-collapse :deep(.el-collapse-item__wrap),
.capability-collapse :deep(.el-collapse-item__wrap) {
  margin-top: 8px;
  border: none;
  background: transparent;
}

.group-collapse :deep(.el-collapse-item__content),
.capability-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 0;
}

.group-row,
.capability-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding-right: 12px;
}

.group-row-main strong,
.capability-row-main strong {
  display: block;
  color: #17383e;
  font-size: 15px;
}

.group-row-main span,
.capability-row-main span {
  display: block;
  margin-top: 4px;
  color: #82969b;
  font-size: 12px;
  font-family: monospace;
}

.group-row-side {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.group-row-side span,
.capability-row-count {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef4f5;
  color: #4e6b71;
  font-size: 12px;
  white-space: nowrap;
}

.capability-collapse {
  margin-top: 2px;
  padding-left: 12px;
}

.detail-stack {
  display: grid;
  gap: 10px;
  padding: 0 0 4px 10px;
}

.detail-card {
  padding: 14px 16px;
  border: 1px solid #e4ecee;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfdfd 0%, #f4f8f9 100%);
}

.detail-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1a3b40;
}

.detail-card-desc {
  margin: 8px 0 0;
  color: #677d82;
  line-height: 1.6;
}

.detail-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.meta-token {
  padding: 5px 9px;
  border: 1px solid #dbe6e8;
  border-radius: 999px;
  background: #fff;
  color: #587177;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .stats-grid,
  .module-switcher {
    grid-template-columns: 1fr 1fr;
  }

  .module-hero {
    flex-direction: column;
  }

  .module-hero-metrics {
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .catalog-topbar,
  .shell-header,
  .group-row,
  .capability-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-grid,
  .module-switcher,
  .module-hero-metrics {
    grid-template-columns: 1fr;
  }

  .group-row-side {
    justify-content: flex-start;
  }
}
</style>
