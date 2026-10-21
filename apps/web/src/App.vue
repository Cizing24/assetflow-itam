<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { router } from "./router";
const route = useRoute();
const error = ref("");
router.onError((e) => {
  error.value = e instanceof Error ? e.message : "無法開啟工作空間";
});
router.afterEach(() => {
  error.value = "";
});
function retry() {
  window.location.reload();
}
</script>
<template>
  <div v-if="error" class="state error-state" role="alert">
    <h1>暫時無法開啟工作空間</h1>
    <p>{{ error }}</p>
    <button class="btn" @click="retry">重新連線</button>
  </div>
  <div v-else-if="!route.matched.length" class="state" role="status">
    <span class="spinner" />正在開啟工作空間…
  </div>
  <RouterView v-else />
</template>
