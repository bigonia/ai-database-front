<template>
  <button type="button" class="sample-card" :class="`sample-${type.type}`" @click="emit('add', type.type)">
    <div class="sample-canvas">
      <template v-if="type.type === 'hero_section'">
        <span class="preview-label">{{ sample.label }}</span>
        <strong class="hero-value">{{ sample.value }}</strong>
        <span class="preview-muted">{{ sample.subtitle }}</span>
        <span class="progress-track"><i :style="{ width: `${toProgress(sample.progress)}%` }" /></span>
      </template>

      <template v-else-if="type.type === 'metric_section'">
        <div v-for="(item, index) in asArray(sample.metrics).slice(0, 2)" :key="index" class="metric">
          <span>{{ asRecord(item).label }}</span>
          <strong>{{ asRecord(item).value }}</strong>
        </div>
      </template>

      <template v-else-if="type.type === 'chart_section'">
        <span class="preview-label">{{ sample.title }}</span>
        <div class="bars">
          <i v-for="(point, index) in normalizedPoints(sample.points)" :key="index" :style="{ height: `${point}%` }" />
        </div>
      </template>

      <template v-else-if="type.type === 'progress_section'">
        <span class="preview-label">{{ sample.title }}</span>
        <div class="progress-value"><strong>{{ sample.progressText }}</strong><span>完成</span></div>
        <span class="progress-track"><i :style="{ width: `${toProgress(sample.progress)}%` }" /></span>
      </template>

      <template v-else-if="type.type === 'text_section'">
        <span class="text-line text-line-title" />
        <span class="text-line" />
        <span class="text-line text-line-short" />
      </template>

      <template v-else-if="type.type === 'timer_section'">
        <span class="preview-label">{{ sample.title }}</span>
        <div class="timer-row"><strong>12:34</strong><span class="status-dot">计时中</span></div>
      </template>

      <template v-else-if="type.type === 'image_section'">
        <span class="large-icon">{{ resolveIcon(sample.iconSrc) }}</span>
        <span class="image-lines"><i /><i /></span>
      </template>

      <template v-else-if="type.type === 'overlay_section'">
        <span class="notice-badge">2</span>
        <span class="overlay-mark">!</span>
        <span class="text-line" />
        <span class="text-line text-line-short" />
      </template>

      <template v-else-if="type.type === 'action_section'">
        <span v-for="(item, index) in asArray(sample.actions).slice(0, 2)" :key="index" class="fake-button" :class="{ secondary: index > 0 }">
          {{ asRecord(item).label }}
        </span>
      </template>

      <template v-else-if="type.type === 'toggle_section'">
        <div v-for="(item, index) in asArray(sample.options).slice(0, 2)" :key="index" class="toggle-preview">
          <span>{{ asRecord(item).label }}</span><i :class="{ active: asRecord(item).active }" />
        </div>
      </template>

      <template v-else-if="type.type === 'list_section'">
        <div v-for="(item, index) in asArray(sample.items).slice(0, 2)" :key="index" class="list-preview">
          <span class="list-icon">{{ index + 1 }}</span>
          <span><strong>{{ asRecord(item).title }}</strong><small>{{ asRecord(item).subtitle }}</small></span>
        </div>
      </template>

      <template v-else-if="type.type === 'nav_section'">
        <span v-for="(item, index) in asArray(sample.tabs).slice(0, 3)" :key="index" class="nav-preview" :class="{ active: index === 0 }">
          {{ asRecord(item).label }}
        </span>
      </template>

      <template v-else>
        <span class="large-icon">◇</span>
        <strong>{{ semantic.title }}</strong>
      </template>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getSectionSampleFields } from '../sectionSamples';
import type { DebugSectionType } from '../types';

const props = defineProps<{ type: DebugSectionType }>();
const emit = defineEmits<{(event: 'add', type: string): void;}>();
const sample = computed(() => getSectionSampleFields(props.type));

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function toProgress(value: unknown) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function normalizedPoints(value: unknown) {
  const values = asArray(value).map(Number);
  const max = Math.max(...values, 1);
  return values.map((point) => Math.max(14, point / max * 100));
}

function resolveIcon(value: unknown) {
  return ({ start: '▶', mail: '✉', chat: '●', file: '▤', love: '♥' } as Record<string, string>)[String(value || '')] || '◆';
}
</script>

<style scoped>
.sample-card {
  width: 148px;
  height: auto;
  min-height: 0;
  box-sizing: border-box;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  display: block;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
}

.sample-card:hover {
  border-color: #8eb2f8;
  box-shadow: 0 7px 18px rgba(37, 99, 235, .1);
  transform: translateY(-2px);
}

.sample-canvas {
  position: relative;
  width: 148px;
  height: 148px;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  min-height: 0;
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: center;
  gap: 7px;
  background: #fff;
}

.sample-hero_section .sample-canvas,
.sample-progress_section .sample-canvas,
.sample-chart_section .sample-canvas,
.sample-text_section .sample-canvas {
  flex-direction: column;
  align-items: flex-start;
  flex-wrap: nowrap;
}

.sample-image_section .sample-canvas {
  flex-direction: column;
  justify-content: center;
  flex-wrap: nowrap;
}

.sample-metric_section .sample-canvas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: center;
}

.sample-action_section .sample-canvas,
.sample-nav_section .sample-canvas {
  justify-content: center;
}

.preview-label,
.preview-muted,
.metric span,
.image-copy small,
.list-preview small {
  color: #7b8799;
  font-size: 9px;
}

.hero-value {
  font-size: 18px;
  line-height: 1;
}

.progress-track {
  width: 100%;
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: #e2e8f0;
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #4f86ed;
}

.metric {
  min-width: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #edf1f6;
  border-radius: 9px;
  background: #fff;
}

.metric strong {
  font-size: 13px;
}

.bars {
  width: 100%;
  height: min(44px, 43%);
  display: flex;
  align-items: flex-end;
  gap: 5px;
}

.bars i {
  flex: 1;
  min-width: 5px;
  border-radius: 4px 4px 1px 1px;
  background: #74a4f5;
}

.progress-value {
  width: 100%;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.progress-value strong {
  font-size: 18px;
}

.progress-value span {
  color: #94a3b8;
  font-size: 9px;
}

.text-line {
  width: 100%;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #dfe7f1;
}

.text-line-title {
  width: 48%;
  height: 8px;
  margin-bottom: 5px;
  background: #8fa9ce;
}

.text-line-short {
  width: 68%;
}

.timer-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timer-row strong {
  font-size: 18px;
}

.status-dot {
  color: #16a36a;
  font-size: 10px;
}

.status-dot::before {
  content: '';
  width: 6px;
  height: 6px;
  margin-right: 5px;
  display: inline-block;
  border-radius: 50%;
  background: #22c55e;
}

.large-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: #e8f0ff;
  color: #356fd2;
  font-size: 15px;
}

.image-lines {
  width: 62%;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.image-lines i {
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: #dfe7f1;
}

.image-lines i:last-child {
  width: 65%;
}

.notice-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: #f59e0b;
  color: #fff;
  font-size: 9px;
}

.fake-button {
  padding: 7px 9px;
  border-radius: 7px;
  background: #356fd2;
  color: #fff;
  font-size: 10px;
}

.fake-button.secondary {
  background: #e8edf5;
  color: #536176;
}

.toggle-preview {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
}

.toggle-preview i {
  width: 28px;
  height: 16px;
  position: relative;
  border-radius: 9px;
  background: #cbd5e1;
}

.toggle-preview i::after {
  content: '';
  width: 12px;
  height: 12px;
  position: absolute;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: #fff;
  transition: left .16s ease;
}

.toggle-preview i.active {
  background: #4f86ed;
}

.toggle-preview i.active::after {
  left: 14px;
}

.list-preview {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
}

.overlay-mark {
  width: 30px;
  height: 30px;
  margin-bottom: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff1cf;
  color: #c47b00;
  font-size: 15px;
  font-weight: 800;
}

.list-preview > span:last-child {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.list-icon {
  width: 23px;
  height: 23px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: #e8f0ff;
  color: #356fd2;
  font-size: 9px;
}

.nav-preview {
  padding: 6px 8px;
  border-radius: 7px;
  color: #64748b;
  font-size: 9px;
}

.nav-preview.active {
  background: #356fd2;
  color: #fff;
}
</style>
