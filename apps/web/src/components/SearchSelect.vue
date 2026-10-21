<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { api, query } from '../api/client';
import type { Page } from '@assetflow/shared';
const props = defineProps<{ modelValue: string; kind: 'asset' | 'employee'; id: string; required?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();
interface Option { id: string; name: string; assetTag?: string; employeeNumber?: string }
const term = ref(''), items = ref<Option[]>([]), loading = ref(false), error = ref('');
let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout>;
async function load() { controller?.abort(); controller = new AbortController(); const current = controller; loading.value = true; error.value = ''; try { const result = await api<Page<Option>>(`/${props.kind === 'asset' ? 'assets' : 'employees'}?${query({ status: props.kind === 'asset' ? 'AVAILABLE' : 'ACTIVE', search: term.value, pageSize: 100, sort: 'name', order: 'asc' })}`, { signal: current.signal }); if (!current.signal.aborted) items.value = result.items; } catch (e) { if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '選項載入失敗'; } finally { if (!current.signal.aborted) loading.value = false; } }
watch(term, () => { clearTimeout(timer); timer = setTimeout(() => void load(), 200); });
void load(); onUnmounted(() => { clearTimeout(timer); controller?.abort(); });
</script>
<template><div class="search-select"><input v-model="term" type="search" :aria-label="`搜尋${kind === 'asset' ? '可借出設備' : '在職員工'}選項`" placeholder="輸入名稱或編號搜尋選項…"><small v-if="loading" role="status">載入選項中…</small><p v-if="error" class="inline-error" role="alert">{{ error }} <button type="button" class="text-button" @click="load">重試</button></p><select :id="id" :value="modelValue" :required="required" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"><option value="">請選擇{{ kind === 'asset' ? '設備' : '員工' }}</option><option v-for="item in items" :key="item.id" :value="item.id">{{ item.assetTag ?? item.employeeNumber }} · {{ item.name }}</option></select><small>顯示最多 100 筆，輸入關鍵字可搜尋全部資料。</small></div></template>
