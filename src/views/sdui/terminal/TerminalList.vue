<template>
  <div class="app-container terminal-list-page">
    <!-- Hero -->
    <section class="hero">
      <div>
        <span class="hero-kicker">SDUI</span>
        <h1>终端管理</h1>
        <p>查看所有已认领和未认领的终端设备，监控在线状态和遥测数据。</p>
      </div>
      <div class="hero-actions">
        <el-button plain :loading="loading.types" @click="fetchDeviceTypes">刷新机型</el-button>
        <el-button type="primary" :loading="loading.claimed || loading.unclaimed" @click="refreshAll">刷新列表</el-button>
      </div>
    </section>

    <el-tabs v-model="activeTab">
      <!-- ═══ 已认领设备 ═══ -->
      <el-tab-pane label="已认领设备" name="claimed">
        <!-- Summary -->
        <div class="summary-bar">
          <span>总计 <strong>{{ pagination.total }}</strong></span>
          <span class="online">在线 <strong>{{ onlineCount(claimedDevices) }}</strong></span>
          <span class="offline">离线 <strong>{{ offlineCount(claimedDevices) }}</strong></span>
          <span>机型 <strong>{{ deviceTypes.length }}</strong></span>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          <el-select
            :model-value="filters.status"
            clearable
            placeholder="在线状态"
            style="width: 130px"
            @change="onFilterChange('status', $event)"
          >
            <el-option label="在线" value="ONLINE" />
            <el-option label="离线" value="OFFLINE" />
          </el-select>

          <el-select
            :model-value="filters.board"
            clearable
            filterable
            placeholder="硬件型号"
            style="width: 220px"
            @change="onFilterChange('board', $event)"
          >
            <el-option
              v-for="dt in deviceTypes"
              :key="dt.board"
              :label="`${dt.label || dt.board} (${dt.deviceCount || 0})`"
              :value="dt.board"
            />
          </el-select>

          <el-input
            :model-value="filters.search"
            clearable
            placeholder="搜索设备名称或 ID"
            style="width: 240px"
            @clear="onSearchClear"
            @keyup.enter="onSearchEnter"
            @update:model-value="onSearchInput"
          />

          <el-select
            :model-value="filters.sortBy"
            style="width: 140px"
            @change="onSortByChange"
          >
            <el-option label="最近在线" value="lastSeenAt" />
            <el-option label="名称" value="name" />
            <el-option label="状态" value="status" />
          </el-select>

          <el-radio-group
            :model-value="filters.sortDir"
            @change="onSortDirChange"
          >
            <el-radio-button value="DESC">降序</el-radio-button>
            <el-radio-button value="ASC">升序</el-radio-button>
          </el-radio-group>
        </div>

        <!-- Device grid -->
        <el-card shadow="never" v-loading="loading.claimed" class="list-shell">
          <div v-if="claimedDevices.length" class="device-grid">
            <DeviceCard
              v-for="device in claimedDevices"
              :key="device.deviceId"
              :device="device"
              @click="goToDetail"
              @delete="removeDevice"
            />
          </div>
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

      <!-- ═══ 未认领设备 ═══ -->
      <el-tab-pane label="未认领设备" name="unclaimed">
        <div class="summary-bar">
          <span>待认领 <strong>{{ unclaimedDevices.length }}</strong></span>
          <span class="online">在线 <strong>{{ onlineCount(unclaimedDevices) }}</strong></span>
          <span class="offline">离线 <strong>{{ offlineCount(unclaimedDevices) }}</strong></span>
        </div>

        <el-card shadow="never" v-loading="loading.unclaimed" class="list-shell">
          <div v-if="unclaimedDevices.length" class="device-grid">
            <div
              v-for="device in unclaimedDevices"
              :key="device.deviceId"
              class="unclaimed-card"
            >
              <div class="uc-top">
                <div>
                  <div class="uc-name">{{ device.name || '待命名终端' }}</div>
                  <div class="uc-id">{{ device.deviceId }}</div>
                </div>
                <el-tag
                  :type="device.status === 'ONLINE' ? 'success' : 'info'"
                  effect="plain"
                  round
                  size="small"
                >
                  {{ device.status === 'ONLINE' ? '在线' : '离线' }}
                </el-tag>
              </div>

              <div class="uc-meta">
                <span>{{ device.board || '-' }}</span>
                <span>·</span>
                <span>{{ device.registrationStatus || 'UNCLAIMED' }}</span>
              </div>

              <div class="uc-bottom">
                <span class="uc-seen">
                  上次在线: {{ formatTime(device.lastSeenAt) }}
                </span>
                <el-button type="primary" plain round size="small" @click="openClaim(device)">
                  认领设备
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="当前没有待认领终端" :image-size="80" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- Claim Dialog -->
    <ClaimDialog
      :visible="claimDialogVisible"
      :device-id="claimTargetId"
      :submitting="loading.claim"
      @update:visible="claimDialogVisible = $event"
      @confirm="handleClaim"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Pagination from '@/components/Pagination/index.vue';
import DeviceCard from './components/DeviceCard.vue';
import ClaimDialog from './components/ClaimDialog.vue';
import { useDeviceList } from './composables/useDeviceList';

const router = useRouter();

const {
  claimedDevices,
  unclaimedDevices,
  deviceTypes,
  loading,
  filters,
  pagination,
  onlineCount,
  offlineCount,
  fetchClaimedDevices,
  fetchUnclaimedDevices,
  fetchDeviceTypes,
  refreshAll,
  resetAndFetch,
  handlePagination: listHandlePagination,
  submitClaim,
  removeDevice
} = useDeviceList();

const activeTab = ref('claimed');
const claimDialogVisible = ref(false);
const claimTargetId = ref('');

// ── Filter handlers ────────────────────────────────────
function onFilterChange(key: string, value: string | undefined) {
  ;(filters as Record<string, unknown>)[key] = value || '';
  resetAndFetch();
}

function onSortByChange(value: string) {
  filters.sortBy = value;
  fetchClaimedDevices();
}

function onSortDirChange(value: string) {
  filters.sortDir = value as 'DESC' | 'ASC';
  fetchClaimedDevices();
}

const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null);
function onSearchInput(value: string) {
  if (searchTimer.value) clearTimeout(searchTimer.value);
  searchTimer.value = setTimeout(() => {
    filters.search = value;
    resetAndFetch();
  }, 400);
}

function onSearchEnter(e: Event) {
  if (searchTimer.value) clearTimeout(searchTimer.value);
  filters.search = (e.target as HTMLInputElement).value;
  resetAndFetch();
}

function onSearchClear() {
  if (searchTimer.value) clearTimeout(searchTimer.value);
  filters.search = '';
  resetAndFetch();
}

// ── Actions ────────────────────────────────────────────
function goToDetail(device: SduiDevice) {
  router.push({ name: 'SduiTerminalDetail', params: { deviceId: device.deviceId }});
}

function openClaim(device: SduiDevice) {
  claimTargetId.value = device.deviceId;
  claimDialogVisible.value = true;
}

async function handleClaim(deviceId: string, claimCode: string, deviceName: string) {
  const ok = await submitClaim(deviceId, claimCode, deviceName);
  if (ok) {
    claimDialogVisible.value = false;
    activeTab.value = 'claimed';
  }
}

function handlePagination({ page, limit }: { page: number; limit: number }) {
  listHandlePagination(page, limit);
}

// ── Init ───────────────────────────────────────────────
onMounted(() => {
  refreshAll();
  fetchDeviceTypes();
});

// ── Formatters ─────────────────────────────────────────
function formatTime(val: string | null | undefined): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.terminal-list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Hero ──────────────────────────────── */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 24px;
  border-radius: 20px;
  background: linear-gradient(135deg, #f8fafc, #eef6ff 45%, #f0fdf4);
}
.hero h1 { margin: 4px 0 6px; }
.hero-kicker {
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.hero-actions { display: flex; gap: 10px; }

/* ── Summary ───────────────────────────── */
.summary-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 8px 0 14px;
  color: #4b5563;
  font-size: 14px;
}
.summary-bar .online strong { color: #15803d; }
.summary-bar .offline strong { color: #6b7280; }

/* ── Filter bar ─────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

/* ── Device grid ─────────────────────────── */
.list-shell { border-radius: 18px; }
.list-shell :deep(.el-card__body) { padding: 20px; }

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* ── Unclaimed cards ─────────────────────── */
.unclaimed-card {
  padding: 18px;
  border-radius: 14px;
  background: linear-gradient(180deg, #fffdf7, #fff7ed);
  border: 1px solid #fde68a;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.uc-top, .uc-bottom, .uc-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.uc-name { font-size: 15px; font-weight: 700; color: #111827; }
.uc-id {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #6b7280;
}
.uc-meta { font-size: 12px; color: #6b7280; }
.uc-seen { font-size: 12px; color: #94a3b8; }
</style>
