<template>
  <main class="app-shell">
    <nav class="top-bar" aria-label="主要導覽">
      <strong>個人記帳系統</strong>
      <div class="nav-links">
        <button type="button">首頁</button>
        <button type="button" @click="showUnavailable">歷史查看</button>
        <span class="user-pill">dev-user</span>
      </div>
    </nav>

    <section class="workspace" aria-label="首頁">
      <section class="entry-panel" aria-label="批次新增區">
        <h1>批次新增區</h1>

        <div class="entry-table">
          <div class="entry-row entry-head" aria-hidden="true">
            <span>收入/支出</span>
            <span>日期</span>
            <span>金額</span>
            <span>類別</span>
            <span>備註</span>
          </div>

          <div v-for="(row, index) in rows" :key="row.id" class="entry-row">
            <select v-model="row.type" aria-label="收入或支出">
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
            </select>
            <input v-model="row.transactionDate" type="date" :max="today" aria-label="日期" />
            <input v-model="row.amount" type="number" min="1" step="1" placeholder="金額" aria-label="金額" />
            <input
              v-model.trim="row.categoryName"
              :list="`categories-${row.id}`"
              placeholder="類別"
              aria-label="類別"
            />
            <datalist :id="`categories-${row.id}`">
              <option v-for="category in categoriesByType(row.type)" :key="category" :value="category" />
            </datalist>
            <input v-model.trim="row.note" type="text" maxlength="255" placeholder="備註" aria-label="備註" />

            <button
              v-if="rows.length > 1"
              type="button"
              class="icon-button"
              aria-label="移除此列"
              @click="removeRow(index)"
            >
              ×
            </button>
          </div>
        </div>

        <div class="actions">
          <button type="button" @click="addRow">繼續新增下一筆</button>
          <button type="button" :disabled="!canSubmit || isSubmitting" @click="submitBatch">
            {{ isSubmitting ? '送出中' : '送出' }}
          </button>
        </div>
      </section>

      <section class="summary-panel" aria-label="近期資料">
        <section class="chart-panel">
          <div class="panel-header">
            <h2>類別摘要</h2>
            <div class="segmented">
              <button type="button" @click="showUnavailable">支出類別</button>
              <button type="button" @click="showUnavailable">收入類別</button>
            </div>
          </div>
          <div class="empty-chart">尚未建立圖表資料</div>
        </section>

        <section class="details-panel">
          <div class="panel-header">
            <h2>最近明細</h2>
            <select v-model.number="recentLimit" aria-label="每頁筆數" @change="loadRecent">
              <option :value="5">5 筆</option>
              <option :value="10">10 筆</option>
              <option :value="15">15 筆</option>
            </select>
          </div>

          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>收支</th>
                <th>類別</th>
                <th>金額</th>
                <th>備註</th>
                <th>建立日期</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoadingRecent">
                <td colspan="6">載入中</td>
              </tr>
              <tr v-else-if="recentTransactions.length === 0">
                <td colspan="6">目前沒有資料</td>
              </tr>
              <tr v-for="transaction in recentTransactions" v-else :key="transaction.id">
                <td>{{ transaction.transactionDate }}</td>
                <td>{{ typeLabel(transaction.type) }}</td>
                <td>{{ transaction.categoryName }}</td>
                <td>{{ formatAmount(transaction.amount) }}</td>
                <td class="truncate">{{ truncateNote(transaction.note) }}</td>
                <td>{{ formatDateTime(transaction.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <button type="button" @click="showUnavailable">查看更多</button>
        </section>
      </section>
    </section>

    <p v-if="message" class="message" role="status">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type TransactionType = 'INCOME' | 'EXPENSE';

interface EntryRow {
  id: number;
  type: TransactionType;
  transactionDate: string;
  amount: string;
  categoryName: string;
  note: string;
}

interface TransactionResponse {
  id: string;
  type: TransactionType;
  transactionDate: string;
  amount: number;
  categoryName: string;
  note: string | null;
  createdAt: string;
}

const expenseCategories = ['飲食', '交通', '投資', '繳費', '自我成長', '社交', '治裝費', '運動'];
const incomeCategories = ['投資', '薪資'];

const today = new Date().toISOString().slice(0, 10);
let rowId = 1;
const rows = ref<EntryRow[]>([createRow()]);
const recentTransactions = ref<TransactionResponse[]>([]);
const recentLimit = ref(5);
const isSubmitting = ref(false);
const isLoadingRecent = ref(false);
const message = ref('');

const canSubmit = computed(() => rows.value.every((row) => {
  const amount = Number(row.amount);
  return row.type && row.transactionDate && amount > 0 && row.categoryName.trim();
}));

onMounted(() => {
  void loadRecent();
});

function createRow(): EntryRow {
  return {
    id: rowId++,
    type: 'EXPENSE',
    transactionDate: today,
    amount: '',
    categoryName: '飲食',
    note: ''
  };
}

function addRow() {
  rows.value.push(createRow());
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
}

function categoriesByType(type: TransactionType) {
  return type === 'EXPENSE' ? expenseCategories : incomeCategories;
}

async function submitBatch() {
  if (!canSubmit.value) {
    showMessage('請完成所有必填欄位');
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await fetch('/api/transactions/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transactions: rows.value.map((row) => ({
          type: row.type,
          transactionDate: row.transactionDate,
          amount: Number(row.amount),
          categoryName: row.categoryName.trim(),
          note: row.note.trim() || null
        }))
      })
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    rows.value = [createRow()];
    showMessage('新增成功');
    await loadRecent();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '新增失敗');
  } finally {
    isSubmitting.value = false;
  }
}

async function loadRecent() {
  isLoadingRecent.value = true;
  try {
    const response = await fetch(`/api/transactions/recent?limit=${recentLimit.value}`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    recentTransactions.value = await response.json() as TransactionResponse[];
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '最近明細載入失敗');
  } finally {
    isLoadingRecent.value = false;
  }
}

async function getErrorMessage(response: Response) {
  const text = await response.text();
  return text || `HTTP ${response.status}`;
}

function typeLabel(type: TransactionType) {
  return type === 'EXPENSE' ? '支出' : '收入';
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('zh-TW').format(amount);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function truncateNote(note: string | null) {
  if (!note) {
    return '';
  }
  return note.length > 20 ? `${note.slice(0, 20)}...` : note;
}

function showUnavailable() {
  showMessage('此功能尚未完成');
}

function showMessage(value: string) {
  message.value = value;
  window.setTimeout(() => {
    if (message.value === value) {
      message.value = '';
    }
  }, 2500);
}
</script>
