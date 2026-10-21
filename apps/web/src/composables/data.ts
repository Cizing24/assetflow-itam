import { ref, reactive, watch, onUnmounted, type Ref } from 'vue';
import type { Page } from '@assetflow/shared';
import { api, query } from '../api/client';
export function useCollection<T>(endpoint: string, initial: Record<string, string> = {}) {
  const data = ref<Page<T> | null>(null) as Ref<Page<T> | null>, loading = ref(true), error = ref(''), page = ref(1);
  const filters = reactive({ search: '', status: '', categoryId: '', departmentId: '', active: '', sort: 'createdAt', order: 'desc', ...initial });
  let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout>;
  async function reload() {
    controller?.abort(); controller = new AbortController(); const current = controller;
    loading.value = true; error.value = '';
    try { const result = await api<Page<T>>(`${endpoint}?${query({ ...filters, page: page.value, pageSize: 20 })}`, { signal: current.signal }); if (!current.signal.aborted) data.value = result; }
    catch (e) { if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '載入失敗'; }
    finally { if (!current.signal.aborted) loading.value = false; }
  }
  watch(filters, () => { clearTimeout(timer); page.value = 1; timer = setTimeout(() => void reload(), 200); });
  watch(page, () => void reload());
  void reload(); onUnmounted(() => { clearTimeout(timer); controller?.abort(); });
  return { data, loading, error, page, filters, reload };
}
export function useResource<T>(path: () => string) {
  const data = ref<T | null>(null) as Ref<T | null>, loading = ref(true), error = ref('');
  let controller: AbortController | undefined;
  async function reload() { controller?.abort(); controller = new AbortController(); const current = controller; loading.value = true; error.value = ''; try { const result = await api<T>(path(), { signal: current.signal }); if (!current.signal.aborted) data.value = result; } catch (e) { if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '載入失敗'; } finally { if (!current.signal.aborted) loading.value = false; } }
  watch(path, () => { data.value = null; void reload(); }, { immediate: true });
  onUnmounted(() => controller?.abort()); return { data, loading, error, reload };
}
