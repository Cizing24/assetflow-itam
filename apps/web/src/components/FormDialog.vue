<script lang="ts">
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "date"
    | "number"
    | "textarea"
    | "select"
    | "asset"
    | "employee";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: string | number;
  max?: string | number;
  minLength?: number;
  hint?: string;
}
export interface DialogConfig {
  title: string;
  description?: string;
  fields?: Field[];
  initial?: Record<string, string>;
  submitLabel?: string;
  danger?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}
</script>
<script setup lang="ts">
import { ref, reactive, nextTick } from "vue";
import SearchSelect from "./SearchSelect.vue";
const dialog = ref<HTMLDialogElement>(),
  config = ref<DialogConfig | null>(null),
  values = reactive<Record<string, string>>({}),
  busy = ref(false),
  error = ref("");
let previousFocus: HTMLElement | null = null;
async function open(input: DialogConfig) {
  previousFocus = document.activeElement as HTMLElement;
  config.value = input;
  Object.keys(values).forEach((k) => delete values[k]);
  for (const f of input.fields ?? [])
    values[f.key] = input.initial?.[f.key] ?? "";
  error.value = "";
  await nextTick();
  dialog.value?.showModal();
  await nextTick();
  dialog.value
    ?.querySelector<HTMLInputElement>("input,select,textarea,button")
    ?.focus();
}
function close() {
  if (busy.value) return;
  dialog.value?.close();
  previousFocus?.focus();
}
async function submit() {
  if (busy.value || !config.value) return;
  busy.value = true;
  error.value = "";
  try {
    await config.value.onSubmit({ ...values });
    busy.value = false;
    close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "操作失敗";
  } finally {
    busy.value = false;
  }
}
defineExpose({ open });
</script>
<template>
  <dialog
    ref="dialog"
    class="form-dialog"
    aria-labelledby="dialog-title"
    @cancel.prevent="close"
  >
    <form v-if="config" @submit.prevent="submit">
      <header>
        <div>
          <span class="eyebrow">ASSETFLOW WORKSPACE</span>
          <h2 id="dialog-title">{{ config.title }}</h2>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="關閉視窗"
          :disabled="busy"
          @click="close"
        >
          ×
        </button>
      </header>
      <p v-if="config.description" class="muted">{{ config.description }}</p>
      <div class="form-grid">
        <div
          v-for="field in config.fields"
          :key="field.key"
          class="field"
          :class="{
            wide:
              field.type === 'textarea' ||
              field.type === 'asset' ||
              field.type === 'employee',
          }"
        >
          <label :for="`field-${field.key}`"
            >{{ field.label
            }}<span v-if="field.required" class="required" aria-hidden="true">
              *</span
            ></label
          ><SearchSelect
            v-if="field.type === 'asset' || field.type === 'employee'"
            :id="`field-${field.key}`"
            v-model="values[field.key]!"
            :kind="field.type"
            :required="field.required"
          /><select
            v-else-if="field.type === 'select'"
            :id="`field-${field.key}`"
            v-model="values[field.key]"
            :required="field.required"
          >
            <option value="">請選擇</option>
            <option
              v-for="option in field.options"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option></select
          ><textarea
            v-else-if="field.type === 'textarea'"
            :id="`field-${field.key}`"
            v-model="values[field.key]"
            :required="field.required"
            maxlength="2000"
            rows="3"
          /><input
            v-else
            :id="`field-${field.key}`"
            v-model="values[field.key]"
            :type="field.type ?? 'text'"
            :required="field.required"
            :min="field.min"
            :max="field.max"
            :minlength="field.minLength"
            :maxlength="field.type === 'password' ? 128 : 200"
            :step="field.type === 'number' ? '0.01' : undefined"
            :autocomplete="field.type === 'password' ? 'new-password' : 'off'"
          /><small v-if="field.hint">{{ field.hint }}</small>
        </div>
      </div>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <footer>
        <button
          class="btn secondary"
          type="button"
          :disabled="busy"
          @click="close"
        >
          取消</button
        ><button
          class="btn"
          :class="{ danger: config.danger }"
          :disabled="busy"
          type="submit"
        >
          {{ busy ? "正在儲存…" : (config.submitLabel ?? "儲存變更") }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
