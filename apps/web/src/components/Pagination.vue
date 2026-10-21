<script setup lang="ts">
defineProps<{ page: number; total: number; pageSize?: number }>();
defineEmits<{ 'update:page': [value: number] }>();
</script>
<template><div class="pagination"><span>共 {{ total }} 筆 · 第 {{ page }} / {{ Math.max(1, Math.ceil(total / (pageSize ?? 20))) }} 頁</span><div><button class="btn secondary small" :disabled="page <= 1" aria-label="上一頁" @click="$emit('update:page', page - 1)">← 上一頁</button><button class="btn secondary small" :disabled="page * (pageSize ?? 20) >= total" aria-label="下一頁" @click="$emit('update:page', page + 1)">下一頁 →</button></div></div></template>
