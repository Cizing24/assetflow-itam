<script setup lang="ts">
defineProps<{
  loading: boolean;
  error?: string;
  empty?: boolean;
  emptyTitle?: string;
}>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="state" role="status">
    <span class="spinner" />正在同步資料…
  </div>
  <div v-else-if="error" class="state error-state" role="alert">
    <strong>資料載入失敗</strong>
    <p>{{ error }}</p>
    <button class="btn secondary" @click="$emit('retry')">重新載入</button>
  </div>
  <div v-else-if="empty" class="state">
    <span class="empty-mark">□</span
    ><strong>{{ emptyTitle ?? "目前沒有符合條件的資料" }}</strong>
    <p>試試調整搜尋或篩選條件。</p>
  </div>
  <slot v-else />
</template>
