<script setup lang="ts">
import { Search } from "@lucide/vue";
import { useCollection } from "../composables/data";
import { type AuditLog, dateTimeLabel, actionLabels } from "../types";
import AsyncState from "../components/AsyncState.vue";
import Pagination from "../components/Pagination.vue";
const { data, loading, error, page, filters, reload } =
  useCollection<AuditLog>("/audit-logs");
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">ACCOUNTABILITY BY DESIGN</span>
      <h1>操作紀錄<span class="heading-dot">.</span></h1>
      <p>由伺服器產生的不可任意修改紀錄，完整保留每次重要操作。</p>
    </div>
    <span class="subtle-tag">唯讀稽核紀錄</span>
  </div>
  <section class="panel">
    <div class="list-toolbar">
      <div class="search-input">
        <Search :size="18" /><input
          v-model="filters.search"
          type="search"
          aria-label="搜尋操作紀錄"
          placeholder="搜尋操作代碼（如 CHECKOUT）或操作人員…"
        />
      </div>
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
              <th>操作時間</th>
              <th>操作內容</th>
              <th>操作人員</th>
              <th>對象</th>
              <th>結果</th>
              <th>變更內容</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in data?.items" :key="a.id">
              <td class="mono">{{ dateTimeLabel(a.createdAt) }}</td>
              <td>
                <strong>{{ actionLabels[a.action] ?? a.action }}</strong
                ><small class="block mono muted">{{ a.action }}</small>
              </td>
              <td>{{ a.actor.name }}</td>
              <td>
                <RouterLink
                  v-if="a.targetType === 'Asset' || a.targetType === 'Employee'"
                  :to="`/${a.targetType === 'Asset' ? 'assets' : 'employees'}/${a.targetId}`"
                  class="text-link"
                >
                  {{ a.targetType }} ↗ </RouterLink
                ><span v-else>{{ a.targetType }}</span
                ><small class="block mono muted">{{
                  a.targetId.slice(0, 8)
                }}</small>
              </td>
              <td>
                <span class="badge available"><i />{{ a.result }}</span>
              </td>
              <td>
                <details>
                  <summary>查看變更</summary>
                  <pre class="audit-json">{{
                    JSON.stringify(a.changes, null, 2)
                  }}</pre>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div> </AsyncState
    ><Pagination v-if="data" v-model:page="page" :total="data.total" />
  </section>
</template>
