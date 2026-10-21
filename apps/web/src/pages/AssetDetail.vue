<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import {
  ArrowLeft,
  Pencil,
  ArrowLeftRight,
  Wrench,
  Archive,
} from "@lucide/vue";
import { useResource } from "../composables/data";
import { useAuth } from "../stores/auth";
import { api } from "../api/client";
import {
  assetFields,
  assetInitial,
  assetPayload,
  checkinFields,
  checkinPayload,
} from "../composables/forms";
import {
  type Asset,
  type Lookups,
  dateLabel,
  dateTimeLabel,
  actionLabels,
} from "../types";
import type { AuditLog } from "../types";
import type { Page } from "@assetflow/shared";
import AsyncState from "../components/AsyncState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import FormDialog from "../components/FormDialog.vue";
const route = useRoute(),
  auth = useAuth(),
  dialog = ref<InstanceType<typeof FormDialog>>(),
  success = ref("");
const { data, loading, error, reload } = useResource<Asset>(
  () => `/assets/${String(route.params.id)}`,
);
const history = useResource<Page<AuditLog>>(
  () => `/audit-logs?targetId=${String(route.params.id)}&pageSize=100`,
);
const current = computed(() =>
  data.value?.assignments.find((a) => !a.returnedAt),
);
async function after(message: string) {
  success.value = message;
  await Promise.all([reload(), history.reload()]);
}
async function edit() {
  try {
    const lookups = await api<Lookups>("/lookups");
    if (!data.value) return;
    void dialog.value?.open({
      title: "編輯資產",
      fields: assetFields(lookups),
      initial: assetInitial(data.value),
      onSubmit: async (v) => {
        await api(`/assets/${data.value!.id}`, {
          method: "PUT",
          body: assetPayload(v),
        });
        await after("資產資料已更新。");
      },
    });
  } catch (e) {
    success.value = "";
    error.value = e instanceof Error ? e.message : "選項載入失敗";
  }
}
function checkout() {
  void dialog.value?.open({
    title: "設備領用",
    description: `${data.value?.assetTag} · ${data.value?.name}`,
    fields: [
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
      { key: "notes", label: "領用備註", type: "textarea" },
    ],
    submitLabel: "確認領用",
    onSubmit: async (v) => {
      await api("/assignments", {
        method: "POST",
        body: {
          ...v,
          assetId: data.value!.id,
          expectedReturnAt: v.expectedReturnAt || undefined,
        },
      });
      await after("設備已成功指派。");
    },
  });
}
function checkin() {
  void dialog.value?.open({
    title: "設備歸還",
    description: `確認從 ${current.value?.employee.name} 收回 ${data.value?.assetTag}。`,
    fields: checkinFields,
    initial: { condition: "GOOD" },
    submitLabel: "確認歸還",
    onSubmit: async (v) => {
      await api(`/assignments/${current.value!.id}/checkin`, {
        method: "POST",
        body: checkinPayload(v),
      });
      await after("設備已歸還並更新狀態。");
    },
  });
}
function maintain() {
  void dialog.value?.open({
    title: "建立維修",
    description: "設備將立即進入維修狀態並停止借出。",
    fields: [
      {
        key: "description",
        label: "故障描述",
        type: "textarea",
        required: true,
      },
      { key: "notes", label: "備註", type: "textarea" },
    ],
    submitLabel: "確認送修",
    onSubmit: async (v) => {
      await api("/maintenance", {
        method: "POST",
        body: { ...v, assetId: data.value!.id },
      });
      await after("維修紀錄已建立。");
    },
  });
}
function retire() {
  void dialog.value?.open({
    title: "確認設備除役",
    description: "除役後無法再領用。歷史與稽核紀錄會完整保留。",
    danger: true,
    fields: [
      { key: "reason", label: "除役原因", type: "textarea", required: true },
    ],
    submitLabel: "確認除役",
    onSubmit: async (v) => {
      await api(`/assets/${data.value!.id}/retire`, {
        method: "POST",
        body: v,
      });
      await after("設備已除役。");
    },
  });
}
</script>
<template>
  <RouterLink to="/assets" class="back-link"
    >
<ArrowLeft :size="16" />返回資產管理
</RouterLink
  ><AsyncState :loading="loading" :error="error" @retry="reload"
    >
<template v-if="data"
      >
<div class="page-heading">
        <div>
          <span class="eyebrow mono">{{ data.assetTag }}</span>
          <h1>{{ data.name }}</h1>
          <p>{{ data.brand }} / {{ data.model }}</p>
        </div>
        <div class="button-row">
          <StatusBadge :status="data.status" /><button
            v-if="auth.canWrite"
            class="btn secondary"
            @click="edit"
          >
            <Pencil :size="16" />編輯資料
</button
          ><button
            v-if="auth.canWrite && data.status === 'AVAILABLE'"
            class="btn"
            @click="checkout"
          >
            <ArrowLeftRight :size="16" />領用設備
</button
          ><button v-if="auth.canWrite && current" class="btn" @click="checkin">
            歸還設備
          </button>
        </div>
      </div>
      <p v-if="success" class="notice" role="status">{{ success }}</p>
      <div class="detail-grid">
        <section class="panel">
          <div class="panel-heading"><h2>設備基本資料</h2></div>
          <dl class="detail-facts">
            <div>
              <dt>分類</dt>
              <dd>{{ data.category.name }}</dd>
            </div>
            <div>
              <dt>序號</dt>
              <dd class="mono">{{ data.serialNumber ?? "未設定" }}</dd>
            </div>
            <div>
              <dt>購買日期</dt>
              <dd>{{ dateLabel(data.purchasedAt) }}</dd>
            </div>
            <div>
              <dt>購買價格</dt>
              <dd>
                {{
                  data.purchasePrice !== null
                    ? `NT$ ${Number(data.purchasePrice).toLocaleString()}`
                    : "未設定"
                }}
              </dd>
            </div>
            <div>
              <dt>保固到期</dt>
              <dd>{{ dateLabel(data.warrantyUntil) }}</dd>
            </div>
            <div>
              <dt>存放位置</dt>
              <dd>{{ data.location }}</dd>
            </div>
            <div>
              <dt>目前保管人</dt>
              <dd>
                <RouterLink
                  v-if="current"
                  :to="`/employees/${current.employeeId}`"
                  class="text-link"
                  >
{{ current.employee.name }} ↗
</RouterLink
                ><span v-else>未指派</span>
              </dd>
            </div>
            <div>
              <dt>建立時間</dt>
              <dd>{{ dateTimeLabel(data.createdAt) }}</dd>
            </div>
          </dl>
          <div
            v-if="auth.canWrite && data.status === 'AVAILABLE'"
            class="panel-actions"
          >
            <button class="btn secondary" @click="maintain">
              <Wrench :size="16" />建立維修
</button
            ><button class="btn subtle-danger" @click="retire">
              <Archive :size="16" />設備除役
            </button>
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>操作時間軸</h2></div>
          <AsyncState
            :loading="history.loading.value"
            :error="history.error.value"
            :empty="!history.data.value?.items.length"
            @retry="history.reload"
            >
<ol class="activity-list">
              <li v-for="a in history.data.value?.items" :key="a.id">
                <span class="timeline-dot" />
                <div>
                  <strong>{{ actionLabels[a.action] ?? a.action }}</strong
                  ><small
                    >{{ a.actor.name }} ·
                    {{ dateTimeLabel(a.createdAt) }}</small
                  >
                </div>
              </li>
            </ol>
</AsyncState
          >
        </section>
      </div>
      <section class="panel section-gap">
        <div class="panel-heading">
          <h2>領用與歸還歷史</h2>
          <span class="subtle-tag">{{ data.assignments.length }} 筆</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>領用員工</th>
                <th>領用日期 / 操作人</th>
                <th>歸還日期 / 操作人</th>
                <th>狀況 / 備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in data.assignments" :key="a.id">
                <td>{{ a.employee.name }}</td>
                <td>
                  {{ dateLabel(a.checkedOutAt)
                  }}<small class="block muted">{{ a.checkoutBy.name }}</small>
                </td>
                <td>
                  {{ dateLabel(a.returnedAt)
                  }}<small class="block muted">{{
                    a.checkinBy?.name ?? "尚未歸還"
                  }}</small>
                </td>
                <td>
                  {{
                    a.condition === "DAMAGED"
                      ? "故障送修"
                      : a.condition === "GOOD"
                        ? "正常"
                        : "領用中"
                  }}<small class="block muted">{{
                    a.checkinNotes ?? a.checkoutNotes
                  }}</small>
                </td>
              </tr>
              <tr v-if="!data.assignments.length">
                <td colspan="4" class="empty-cell">尚無領用紀錄。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel section-gap">
        <div class="panel-heading"><h2>維修歷史</h2></div>
        <div v-for="m in data.maintenance" :key="m.id" class="record-row">
          <div>
            <strong>{{ m.description }}</strong
            ><small
              >{{ dateLabel(m.startedAt) }} · {{ m.progress }} ·
              {{ m.notes }}</small
            >
          </div>
          <StatusBadge :status="m.completedAt ? 'COMPLETED' : 'OPEN'" />
        </div>
        <p v-if="!data.maintenance?.length" class="empty-cell">
          尚無維修紀錄。
        </p>
      </section>
</template
    >
</AsyncState
  ><FormDialog ref="dialog" />
</template>
