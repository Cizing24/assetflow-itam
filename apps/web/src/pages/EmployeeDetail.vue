<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Pencil, ClipboardCheck } from "@lucide/vue";
import { useResource } from "../composables/data";
import { useAuth } from "../stores/auth";
import { api } from "../api/client";
import {
  employeeFields,
  employeeInitial,
  checkinFields,
  checkinPayload,
} from "../composables/forms";
import {
  type Employee,
  type Lookups,
  type Assignment,
  dateLabel,
} from "../types";
import AsyncState from "../components/AsyncState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import FormDialog from "../components/FormDialog.vue";
const route = useRoute(),
  auth = useAuth(),
  dialog = ref<InstanceType<typeof FormDialog>>(),
  success = ref("");
const { data, loading, error, reload } = useResource<Employee>(
  () => `/employees/${String(route.params.id)}`,
);
const current = computed(
  () => data.value?.assignments?.filter((a) => !a.returnedAt) ?? [],
);
async function edit() {
  try {
    const lookups = await api<Lookups>("/lookups");
    if (!data.value) return;
    void dialog.value?.open({
      title: "編輯員工",
      fields: employeeFields(lookups),
      initial: employeeInitial(data.value),
      onSubmit: async (v) => {
        await api(`/employees/${data.value!.id}`, { method: "PUT", body: v });
        success.value = "員工資料已更新。";
        await reload();
      },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "選項載入失敗";
  }
}
function offboard() {
  void dialog.value?.open({
    title: "啟動離職交接",
    description: `目前持有 ${current.value.length} 項設備。啟動後將停止新增領用，直到所有設備歸還才可結案。`,
    fields: [
      {
        key: "plannedLeaveAt",
        label: "預計離職日期",
        type: "date",
        required: true,
        min: data.value?.joinedAt.slice(0, 10),
      },
      { key: "notes", label: "交接備註", type: "textarea" },
    ],
    submitLabel: "啟動交接",
    onSubmit: async (v) => {
      await api("/offboardings", {
        method: "POST",
        body: { ...v, employeeId: data.value!.id },
      });
      success.value = "交接已啟動，可至離職交接頁逐項確認。";
      await reload();
    },
  });
}
function checkin(a: Assignment) {
  void dialog.value?.open({
    title: "設備歸還",
    description: `${a.asset.assetTag} · ${a.asset.name}`,
    fields: checkinFields,
    initial: { condition: "GOOD" },
    submitLabel: "確認歸還",
    onSubmit: async (v) => {
      await api(`/assignments/${a.id}/checkin`, {
        method: "POST",
        body: checkinPayload(v),
      });
      success.value = "設備已歸還。";
      await reload();
    },
  });
}
</script>
<template>
  <RouterLink to="/employees" class="back-link"
    >
<ArrowLeft :size="16" />返回員工目錄
</RouterLink
  ><AsyncState :loading="loading" :error="error" @retry="reload"
    >
<template v-if="data"
      >
<div class="page-heading">
        <div>
          <span class="eyebrow mono">{{ data.employeeNumber }}</span>
          <h1>{{ data.name }}</h1>
          <p>{{ data.department.name }} · {{ data.title ?? "未設定職稱" }}</p>
        </div>
        <div class="button-row">
          <StatusBadge :status="data.status" /><button
            v-if="auth.canWrite"
            class="btn secondary"
            @click="edit"
          >
            <Pencil :size="16" />編輯員工
</button
          ><button
            v-if="auth.canWrite && data.status === 'ACTIVE'"
            class="btn"
            @click="offboard"
          >
            <ClipboardCheck :size="16" />啟動離職交接
          </button>
        </div>
      </div>
      <p v-if="success" class="notice" role="status">{{ success }}</p>
      <section class="panel">
        <div class="panel-heading">
          <h2>員工資料</h2>
          <span class="subtle-tag">員工與系統帳號獨立管理</span>
        </div>
        <dl class="detail-facts">
          <div>
            <dt>電子郵件</dt>
            <dd>{{ data.email }}</dd>
          </div>
          <div>
            <dt>到職日期</dt>
            <dd>{{ dateLabel(data.joinedAt) }}</dd>
          </div>
          <div>
            <dt>離職日期</dt>
            <dd>{{ dateLabel(data.leftAt) }}</dd>
          </div>
          <div>
            <dt>目前持有</dt>
            <dd>{{ current.length }} 項設備</dd>
          </div>
        </dl>
      </section>
      <section class="panel section-gap">
        <div class="panel-heading">
          <h2>目前持有設備</h2>
          <span class="count-pill">{{ current.length }} 項</span>
        </div>
        <div v-for="a in current" :key="a.id" class="record-row">
          <RouterLink :to="`/assets/${a.assetId}`"
            >
<strong>{{ a.asset.name }}</strong
            ><small
              >{{ a.asset.assetTag }} · 領用日期
              {{ dateLabel(a.checkedOutAt) }}</small
            >
</RouterLink
          ><button
            v-if="auth.canWrite"
            class="btn secondary small"
            @click="checkin(a)"
          >
            歸還設備
          </button>
        </div>
        <p v-if="!current.length" class="empty-cell">目前沒有未歸還設備。</p>
      </section>
      <section class="panel section-gap">
        <div class="panel-heading"><h2>完整領還歷史</h2></div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>設備</th>
                <th>領用日期 / 操作人</th>
                <th>預計歸還</th>
                <th>歸還日期 / 操作人</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in data.assignments" :key="a.id">
                <td>
                  <RouterLink :to="`/assets/${a.assetId}`"
                    >
{{ a.asset.name
                    }}<small class="block mono muted">{{
                      a.asset.assetTag
                    }}</small>
</RouterLink
                  >
                </td>
                <td>
                  {{ dateLabel(a.checkedOutAt)
                  }}<small class="block muted">{{ a.checkoutBy.name }}</small>
                </td>
                <td>{{ dateLabel(a.expectedReturnAt) }}</td>
                <td>
                  {{ dateLabel(a.returnedAt)
                  }}<small class="block muted">{{
                    a.checkinBy?.name ?? "領用中"
                  }}</small>
                </td>
                <td>{{ a.checkinNotes ?? a.checkoutNotes ?? "—" }}</td>
              </tr>
              <tr v-if="!data.assignments?.length">
                <td colspan="5" class="empty-cell">尚無領用歷史。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
</template
    >
</AsyncState
  ><FormDialog ref="dialog" />
</template>
