<script setup lang="ts">
import { ref } from "vue";
import { Plus, Search, Wrench } from "@lucide/vue";
import { useCollection } from "../composables/data";
import { useAuth } from "../stores/auth";
import { api } from "../api/client";
import { type Maintenance, dateLabel } from "../types";
import AsyncState from "../components/AsyncState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import Pagination from "../components/Pagination.vue";
import FormDialog from "../components/FormDialog.vue";
const { data, loading, error, page, filters, reload } =
    useCollection<Maintenance>("/maintenance", { active: "true" }),
  auth = useAuth(),
  dialog = ref<InstanceType<typeof FormDialog>>(),
  success = ref("");
function create() {
  void dialog.value?.open({
    title: "建立維修",
    description: "領用中的設備請先以故障歸還，系統會自動建立維修。",
    fields: [
      { key: "assetId", label: "送修設備", type: "asset", required: true },
      {
        key: "description",
        label: "故障描述",
        type: "textarea",
        required: true,
      },
      { key: "notes", label: "備註", type: "textarea" },
    ],
    submitLabel: "建立維修",
    onSubmit: async (v) => {
      await api("/maintenance", { method: "POST", body: v });
      success.value = "維修已建立，設備已停止借出。";
      await reload();
    },
  });
}
function update(m: Maintenance) {
  void dialog.value?.open({
    title: "更新維修進度",
    description: m.asset.name,
    fields: [
      { key: "progress", label: "維修進度", required: true },
      { key: "notes", label: "維修備註", type: "textarea" },
    ],
    initial: { progress: m.progress, notes: m.notes ?? "" },
    onSubmit: async (v) => {
      await api(`/maintenance/${m.id}`, { method: "PATCH", body: v });
      success.value = "維修進度已更新。";
      await reload();
    },
  });
}
function complete(m: Maintenance) {
  void dialog.value?.open({
    title: "完成維修",
    description: `請依 ${m.asset.name} 實際狀況選擇處理方式。除役後無法再借出。`,
    fields: [
      {
        key: "outcome",
        label: "設備處理結果",
        type: "select",
        required: true,
        options: [
          { value: "AVAILABLE", label: "已修復 · 可借出" },
          { value: "RETIRED", label: "無法修復 · 除役" },
        ],
      },
      { key: "notes", label: "結案備註", type: "textarea" },
    ],
    initial: { outcome: "AVAILABLE", notes: m.notes ?? "" },
    submitLabel: "確認結案",
    onSubmit: async (v) => {
      await api(`/maintenance/${m.id}/complete`, { method: "POST", body: v });
      success.value = "維修已結案，設備狀態已更新。";
      await reload();
    },
  });
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">MAINTENANCE WORKSPACE</span>
      <h1>維修工作台<span class="heading-dot">.</span></h1>
      <p>持續追蹤故障與修復進度，讓設備回到最佳狀態。</p>
    </div>
    <button v-if="auth.canWrite" class="btn" @click="create">
      <Plus :size="17" />建立維修
    </button>
  </div>
  <p v-if="success" class="notice" role="status">{{ success }}</p>
  <section class="panel">
    <div class="list-toolbar">
      <div class="search-input">
        <Search :size="18" /><input
          v-model="filters.search"
          type="search"
          aria-label="搜尋維修"
          placeholder="搜尋設備名稱…"
        />
      </div>
      <select v-model="filters.active" aria-label="維修狀態">
        <option value="true">處理中</option>
        <option value="false">已結案</option>
        <option value="">所有維修</option>
      </select>
    </div>
    <AsyncState
      :loading="loading"
      :error="error"
      :empty="!data?.items.length"
      @retry="reload"
    >
      <div class="maintenance-grid">
        <article v-for="m in data?.items" :key="m.id" class="maintenance-card">
          <div class="card-top">
            <span class="device-icon"><Wrench :size="20" /></span
            ><StatusBadge :status="m.completedAt ? 'COMPLETED' : 'OPEN'" />
          </div>
          <RouterLink :to="`/assets/${m.asset.id}`">
            <span class="eyebrow mono">{{ m.asset.assetTag }}</span>
            <h3>{{ m.asset.name }}</h3>
          </RouterLink>
          <p>{{ m.description }}</p>
          <dl>
            <div>
              <dt>目前進度</dt>
              <dd>{{ m.progress }}</dd>
            </div>
            <div>
              <dt>開始日期</dt>
              <dd>{{ dateLabel(m.startedAt) }}</dd>
            </div>
            <div v-if="m.completedAt">
              <dt>結案日期</dt>
              <dd>{{ dateLabel(m.completedAt) }}</dd>
            </div>
          </dl>
          <p v-if="m.notes" class="record-note">{{ m.notes }}</p>
          <StatusBadge v-if="m.outcome" :status="m.outcome" />
          <div v-if="!m.completedAt && auth.canWrite" class="button-row">
            <button class="btn secondary small" @click="update(m)">
              更新進度</button
            ><button class="btn small" @click="complete(m)">完成維修</button>
          </div>
        </article>
      </div> </AsyncState
    ><Pagination v-if="data" v-model:page="page" :total="data.total" />
  </section>
  <FormDialog ref="dialog" />
</template>
