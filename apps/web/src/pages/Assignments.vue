<script setup lang="ts">
import { ref } from "vue";
import { Plus, Search } from "@lucide/vue";
import { useCollection } from "../composables/data";
import { useAuth } from "../stores/auth";
import { api } from "../api/client";
import { checkinFields, checkinPayload } from "../composables/forms";
import { type Assignment, dateLabel } from "../types";
import AsyncState from "../components/AsyncState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import Pagination from "../components/Pagination.vue";
import FormDialog from "../components/FormDialog.vue";
const { data, loading, error, page, filters, reload } =
    useCollection<Assignment>("/assignments", { active: "true" }),
  auth = useAuth(),
  dialog = ref<InstanceType<typeof FormDialog>>(),
  success = ref("");
function checkout() {
  void dialog.value?.open({
    title: "設備領用",
    description: "僅顯示可借出的設備與有效在職員工。",
    fields: [
      { key: "assetId", label: "設備", type: "asset", required: true },
      {
        key: "employeeId",
        label: "領用員工",
        type: "employee",
        required: true,
      },
      {
        key: "expectedReturnAt",
        label: "預計歸還日期",
        type: "date",
        min: new Date().toISOString().slice(0, 10),
      },
      { key: "notes", label: "備註", type: "textarea" },
    ],
    submitLabel: "確認領用",
    onSubmit: async (v) => {
      await api("/assignments", {
        method: "POST",
        body: { ...v, expectedReturnAt: v.expectedReturnAt || undefined },
      });
      success.value = "領用成功，設備狀態與歷史已更新。";
      await reload();
    },
  });
}
function checkin(a: Assignment) {
  void dialog.value?.open({
    title: "設備歸還",
    description: `${a.asset.assetTag} · ${a.asset.name} / ${a.employee.name}`,
    fields: checkinFields,
    initial: { condition: "GOOD" },
    submitLabel: "確認歸還",
    onSubmit: async (v) => {
      await api(`/assignments/${a.id}/checkin`, {
        method: "POST",
        body: checkinPayload(v),
      });
      success.value = "歸還成功，設備狀態與歷史已更新。";
      await reload();
    },
  });
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">CHECKOUT & CHECKIN</span>
      <h1>領用與歸還<span class="heading-dot">.</span></h1>
      <p>每一次交付都有記錄，每一次歸還都有確認。</p>
    </div>
    <button v-if="auth.canWrite" class="btn" @click="checkout">
      <Plus :size="17" />設備領用
    </button>
  </div>
  <p v-if="success" class="notice" role="status">{{ success }}</p>
  <section class="panel">
    <div class="list-toolbar">
      <div class="search-input">
        <Search :size="18" /><input
          v-model="filters.search"
          type="search"
          aria-label="搜尋領用紀錄"
          placeholder="搜尋設備、編號或領用員工…"
        >
      </div>
      <select v-model="filters.active" aria-label="領用狀態">
        <option value="true">尚未歸還</option>
        <option value="false">已歸還</option>
        <option value="">所有紀錄</option>
      </select>
    </div>
    <AsyncState
      :loading="loading"
      :error="error"
      :empty="!data?.items.length"
      @retry="reload"
      >
<div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>設備</th>
              <th>領用員工</th>
              <th>領用日期</th>
              <th>預計歸還</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in data?.items" :key="a.id">
              <td>
                <RouterLink :to="`/assets/${a.assetId}`"
                  >
<strong>{{ a.asset.name }}</strong
                  ><small class="block mono muted">{{
                    a.asset.assetTag
                  }}</small>
</RouterLink
                >
              </td>
              <td>
                <RouterLink :to="`/employees/${a.employeeId}`">
{{
                  a.employee.name
                }}
</RouterLink>
              </td>
              <td>
                {{ dateLabel(a.checkedOutAt)
                }}<small class="block muted">{{ a.checkoutBy.name }}</small>
              </td>
              <td>{{ dateLabel(a.expectedReturnAt) }}</td>
              <td>
                <StatusBadge
                  :status="a.returnedAt ? 'COMPLETED' : 'ASSIGNED'"
                /><small v-if="a.returnedAt" class="block muted">{{
                  dateLabel(a.returnedAt)
                }}</small>
              </td>
              <td>
                <button
                  v-if="!a.returnedAt && auth.canWrite"
                  class="btn secondary small"
                  @click="checkin(a)"
                >
                  歸還設備
</button
                ><span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
</AsyncState
    ><Pagination v-if="data" v-model:page="page" :total="data.total" />
  </section>
  <FormDialog ref="dialog" />
</template>
