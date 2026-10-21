<script setup lang="ts">
import { statusLabels, type AssetStatus } from "@assetflow/shared";
import { employmentLabels } from "../types";
defineProps<{ status: string }>();
function label(status: string) {
  return (
    statusLabels[status as AssetStatus] ??
    employmentLabels[status as keyof typeof employmentLabels] ??
    { OPEN: "處理中", COMPLETED: "已完成" }[status] ??
    status
  );
}
</script>
<template>
  <span class="badge" :class="status.toLowerCase()"
    ><i />{{ label(status) }}</span
  >
</template>
