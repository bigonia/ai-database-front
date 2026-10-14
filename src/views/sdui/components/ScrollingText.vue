<template><span ref="viewport" class="scrolling-text" :class="{scrolling: distance > 0}" :style="{'--scroll-distance': `${-distance}px`, '--scroll-duration': `${Math.max(3, distance / 18)}s`}"><span ref="content">{{ text }}</span></span></template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps<{text: string}>();
const viewport = ref<HTMLElement>(); const content = ref<HTMLElement>(); const distance = ref(0);
const measure = () => { distance.value = Math.max(0, (content.value?.scrollWidth || 0) - (viewport.value?.clientWidth || 0)); };
let observer: ResizeObserver | undefined;
onMounted(() => { observer = new ResizeObserver(measure); if (viewport.value)observer.observe(viewport.value); if (content.value)observer.observe(content.value); measure(); });
watch(() => props.text, async () => { await nextTick(); measure(); });
onBeforeUnmount(() => observer?.disconnect());
</script>
<style scoped>.scrolling-text{display:block;min-width:0;overflow:hidden;white-space:nowrap}.scrolling-text>span{display:inline-block;white-space:nowrap}.scrolling>span{animation:scroll-text var(--scroll-duration) linear infinite alternate}@keyframes scroll-text{0%,15%{transform:translateX(0)}85%,100%{transform:translateX(var(--scroll-distance))}}</style>
