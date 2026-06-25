<template>
  <aside class="catalog">
    <div class="catalog-head">
      <strong>组件库</strong>
      <span class="catalog-count">{{ types.length }}</span>
    </div>

    <div class="catalog-list">
      <div v-for="type in types" :key="type.type" class="catalog-item">
        <SectionSampleCard :type="type" @add="emit('add', type)" />
        <div class="catalog-item-name">{{ getSectionSemantic(type.type).title }}</div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { getSectionSemantic } from '../sectionSemantics';
import type { DebugSectionType } from '../types';
import SectionSampleCard from './SectionSampleCard.vue';

defineProps<{ types: DebugSectionType[] }>();
const emit = defineEmits<{(event: 'add', type: DebugSectionType): void;}>();
</script>

<style scoped>
.catalog {
  width: 220px;
  box-sizing: border-box;
  min-width: 0;
  padding: 14px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
}

.catalog-head {
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.catalog-head strong {
  color: #1e293b;
  font-size: 14px;
}

.catalog-count {
  min-width: 25px;
  height: 23px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dbe3ee;
  border-radius: 7px;
  background: #fff;
  color: #64748b !important;
  font-size: 10px !important;
  font-weight: 700;
}

.catalog-list {
  max-height: 610px;
  padding: 2px 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  overflow-y: auto;
}

.catalog-list > :deep(*) {
  width: 148px;
  min-height: 0;
  flex: 0 0 auto;
}

.catalog-item {
  width: 148px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.catalog-item-name {
  width: 100%;
  overflow: hidden;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
