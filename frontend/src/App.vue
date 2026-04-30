<template>
  <main class="app-shell">
    <nav class="top-bar" aria-label="主要導覽">
      <strong>個人記帳系統</strong>
      <div class="nav-links">
        <button type="button" :class="{ active: currentView === 'home' }" @click="showHome">首頁</button>
        <button type="button" :class="{ active: currentView === 'history' }" @click="showHistory">歷史查看</button>
        <span class="user-pill">dev-user</span>
      </div>
    </nav>

    <section v-if="currentView === 'home'" class="workspace" aria-label="首頁">
      <section class="entry-panel" aria-label="批次新增區">
        <h1>批次新增區</h1>

        <div class="entry-list">
          <div v-for="(row, index) in rows" :key="row.id" class="entry-card">
            <select v-model="row.type" aria-label="收入或支出" @change="resetCategoryForType(row)">
              <option value="">未選擇</option>
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
            </select>
            <div class="date-field">
              <input
                v-model="row.transactionDate"
                type="date"
                :max="today"
                :class="{ empty: !row.transactionDate }"
                aria-label="日期"
                @blur="focusedDateRowId = null"
                @focus="focusedDateRowId = row.id"
                @input="handleDateInput(row)"
              />
              <span v-if="!row.transactionDate && focusedDateRowId !== row.id" class="date-placeholder">未選擇</span>
            </div>
            <input
              v-model.trim="row.amount"
              type="text"
              inputmode="decimal"
              pattern="[0-9]*\\.?[0-9]*"
              placeholder="金額"
              aria-label="金額"
              @input="normalizeAmount(row)"
            />
            <div class="category-field">
              <select v-model="row.categoryName" aria-label="類別" @change="resetCustomCategory(row)">
                <option value="">未選擇</option>
                <option v-for="category in categoriesByType(row.type)" :key="category" :value="category">
                  {{ category }}
                </option>
                <option v-if="row.type" :value="CUSTOM_CATEGORY_VALUE">自訂類別</option>
              </select>
              <input
                v-if="row.categoryName === CUSTOM_CATEGORY_VALUE"
                v-model.trim="row.customCategoryName"
                type="text"
                maxlength="64"
                placeholder="輸入自訂類別"
                aria-label="自訂類別"
              />
            </div>
            <input
              v-model.trim="row.note"
              type="text"
              maxlength="255"
              placeholder="備註"
              aria-label="備註"
            />

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
              <button
                type="button"
                :class="{ active: summaryType === 'EXPENSE' }"
                @click="setSummaryType('EXPENSE')"
              >
                支出類別
              </button>
              <button
                type="button"
                :class="{ active: summaryType === 'INCOME' }"
                @click="setSummaryType('INCOME')"
              >
                收入類別
              </button>
            </div>
          </div>
          <div class="donut-chart" :class="{ empty: categorySummaries.length === 0 }" aria-label="類別占比圖">
            <template v-if="categorySummaries.length > 0">
              <svg viewBox="0 0 120 120" role="img" aria-label="近 30 天類別占比">
                <circle class="donut-bg" cx="60" cy="60" r="42" />
                <circle
                  v-for="segment in donutSegments"
                  :key="segment.categoryName"
                  class="donut-segment"
                  cx="60"
                  cy="60"
                  r="42"
                  :stroke="segment.color"
                  :stroke-dasharray="`${segment.length} ${donutCircumference - segment.length}`"
                  :stroke-dashoffset="segment.offset"
                >
                  <title>
                    {{ typeLabel(summaryType) }} {{ segment.categoryName }} {{ formatAmount(segment.amount) }}
                    {{ formatPercentage(segment.percentage) }}
                  </title>
                </circle>
              </svg>
              <div class="donut-center">
                <span>{{ typeLabel(summaryType) }}</span>
                <strong>{{ formatAmount(summaryTotal) }}</strong>
              </div>
            </template>
            <span v-else>近 30 天沒有資料</span>
          </div>
          <table class="summary-table">
            <thead>
              <tr>
                <th>類別</th>
                <th>金額</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoadingSummary">
                <td colspan="3">載入中</td>
              </tr>
              <tr v-else-if="categorySummaries.length === 0">
                <td colspan="3">近 30 天沒有資料</td>
              </tr>
              <tr v-for="summary in categorySummaries" v-else :key="summary.categoryName">
                <td>{{ summary.categoryName }}</td>
                <td>{{ formatAmount(summary.amount) }}</td>
                <td>{{ formatPercentage(summary.percentage) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="details-panel">
          <div class="panel-header">
            <h2>最近明細</h2>
            <select v-model.number="recentLimit" aria-label="每頁筆數" @change="loadRecent()">
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
          <button type="button" @click="showHistory">查看更多</button>
        </section>
      </section>
    </section>

    <section v-else class="history-workspace" aria-label="歷史查看">
      <section class="history-panel">
        <div class="panel-header history-header">
          <h1>歷史查看</h1>
          <div class="history-controls">
            <select v-model="historyType" aria-label="收入或支出" @change="resetHistoryPageAndLoad">
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
            </select>
            <input v-model="historyStartDate" type="date" :max="today" aria-label="開始日期" @change="resetHistoryPageAndLoad" />
            <input v-model="historyEndDate" type="date" :max="today" aria-label="結束日期" @change="resetHistoryPageAndLoad" />
            <select v-model.number="historySize" aria-label="每頁筆數" @change="resetHistoryPageAndLoad">
              <option :value="10">10 筆</option>
              <option :value="15">15 筆</option>
              <option :value="20">20 筆</option>
            </select>
          </div>
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
            <tr v-if="isLoadingHistory">
              <td colspan="6">載入中</td>
            </tr>
            <tr v-else-if="historyTransactions.length === 0">
              <td colspan="6">此區間沒有資料</td>
            </tr>
            <tr v-for="transaction in historyTransactions" v-else :key="transaction.id">
              <td>{{ transaction.transactionDate }}</td>
              <td>{{ typeLabel(transaction.type) }}</td>
              <td>{{ transaction.categoryName }}</td>
              <td>{{ formatAmount(transaction.amount) }}</td>
              <td class="truncate">{{ truncateNote(transaction.note) }}</td>
              <td>{{ formatDateTime(transaction.createdAt) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="pager">
          <button type="button" :disabled="historyPage === 0 || isLoadingHistory" @click="previousHistoryPage">上一頁</button>
          <span>第 {{ historyPage + 1 }} 頁</span>
          <button type="button" :disabled="!historyHasNext || isLoadingHistory" @click="nextHistoryPage">下一頁</button>
        </div>
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
  type: TransactionType | '';
  transactionDate: string;
  amount: string;
  categoryName: string;
  customCategoryName: string;
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

interface CategorySummaryResponse {
  categoryName: string;
  amount: number;
  percentage: number;
}

interface HistoryTransactionsResponse {
  transactions: TransactionResponse[];
  page: number;
  size: number;
  hasNext: boolean;
}

interface DonutSegment {
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
  length: number;
  offset: number;
}

const expenseCategories = ['飲食', '交通', '投資', '繳費', '自我成長', '社交', '治裝費', '運動'];
const incomeCategories = ['投資', '薪資'];
const CUSTOM_CATEGORY_VALUE = '__CUSTOM__';
const DONUT_RADIUS = 42;
const donutCircumference = 2 * Math.PI * DONUT_RADIUS;
const chartColors = ['#3273dc', '#1f9d55', '#d97706', '#8b5cf6', '#dc2626', '#0891b2', '#4b5563', '#be185d'];

const today = new Date().toISOString().slice(0, 10);
const defaultHistoryStartDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
let rowId = 1;
const rows = ref<EntryRow[]>([createRow()]);
const currentView = ref<'home' | 'history'>('home');
const recentTransactions = ref<TransactionResponse[]>([]);
const historyTransactions = ref<TransactionResponse[]>([]);
const categorySummaries = ref<CategorySummaryResponse[]>([]);
const recentLimit = ref(5);
const historyType = ref<TransactionType>('EXPENSE');
const historyStartDate = ref(defaultHistoryStartDate);
const historyEndDate = ref(today);
const historyPage = ref(0);
const historySize = ref(10);
const historyHasNext = ref(false);
const summaryType = ref<TransactionType>('EXPENSE');
const isSubmitting = ref(false);
const isLoadingRecent = ref(false);
const isLoadingHistory = ref(false);
const isLoadingSummary = ref(false);
const message = ref('');
const focusedDateRowId = ref<number | null>(null);

const canSubmit = computed(() => rows.value.every((row) => {
  const amount = Number(row.amount);
  return row.type && row.transactionDate && amount > 0 && getCategoryName(row);
}));

const summaryTotal = computed(() => categorySummaries.value.reduce((total, summary) => total + summary.amount, 0));

const donutSegments = computed<DonutSegment[]>(() => {
  let usedLength = 0;
  return categorySummaries.value.map((summary, index) => {
    const length = donutCircumference * (summary.percentage / 100);
    const segment = {
      categoryName: summary.categoryName,
      amount: summary.amount,
      percentage: summary.percentage,
      color: chartColors[index % chartColors.length],
      length,
      offset: -usedLength
    };
    usedLength += length;
    return segment;
  });
});

onMounted(() => {
  void loadRecent();
  void loadCategorySummary();
});

function createRow(): EntryRow {
  return {
    id: rowId++,
    type: '',
    transactionDate: '',
    amount: '',
    categoryName: '',
    customCategoryName: '',
    note: ''
  };
}

function addRow() {
  rows.value.push(createRow());
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
}

function categoriesByType(type: TransactionType | '') {
  if (!type) {
    return [];
  }
  return type === 'EXPENSE' ? expenseCategories : incomeCategories;
}

function resetCategoryForType(row: EntryRow) {
  row.categoryName = '';
  row.customCategoryName = '';
}

function handleDateInput(row: EntryRow) {
  if (!row.transactionDate) {
    focusedDateRowId.value = null;
  }
}

function getCategoryName(row: EntryRow) {
  if (row.categoryName === CUSTOM_CATEGORY_VALUE) {
    return row.customCategoryName.trim();
  }
  return row.categoryName.trim();
}

function resetCustomCategory(row: EntryRow) {
  if (row.categoryName !== CUSTOM_CATEGORY_VALUE) {
    row.customCategoryName = '';
  }
}

function normalizeAmount(row: EntryRow) {
  row.amount = row.amount.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
}

async function submitBatch() {
  if (isSubmitting.value) {
    return;
  }

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
          type: row.type as TransactionType,
          transactionDate: row.transactionDate,
          amount: Number(row.amount),
          categoryName: getCategoryName(row),
          note: row.note.trim() || null
        }))
      })
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '新增失敗，請確認欄位內容後再試一次'));
    }

    rows.value = [createRow()];
    const [recentLoaded, summaryLoaded] = await Promise.all([
      loadRecent(false),
      loadCategorySummary(false)
    ]);
    showMessage(recentLoaded && summaryLoaded ? '新增成功，明細已更新' : '新增成功，但資料重新整理失敗，請重新整理頁面');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '新增失敗');
  } finally {
    isSubmitting.value = false;
  }
}

function setSummaryType(type: TransactionType) {
  summaryType.value = type;
  void loadCategorySummary();
}

function showHome() {
  currentView.value = 'home';
}

function showHistory() {
  currentView.value = 'history';
  void loadHistory();
}

async function loadRecent(showError = true) {
  isLoadingRecent.value = true;
  try {
    const response = await fetch(`/api/transactions/recent?limit=${recentLimit.value}`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '最近明細載入失敗，請稍後再試'));
    }
    recentTransactions.value = await response.json() as TransactionResponse[];
    return true;
  } catch (error) {
    if (showError) {
      showMessage(error instanceof Error ? error.message : '最近明細載入失敗');
    }
    return false;
  } finally {
    isLoadingRecent.value = false;
  }
}

async function resetHistoryPageAndLoad() {
  historyPage.value = 0;
  await loadHistory();
}

async function previousHistoryPage() {
  if (historyPage.value === 0) {
    return;
  }
  historyPage.value -= 1;
  await loadHistory();
}

async function nextHistoryPage() {
  if (!historyHasNext.value) {
    return;
  }
  historyPage.value += 1;
  await loadHistory();
}

async function loadHistory() {
  if (historyStartDate.value > historyEndDate.value) {
    showMessage('開始日期不可晚於結束日期');
    return;
  }

  isLoadingHistory.value = true;
  try {
    const params = new URLSearchParams({
      type: historyType.value,
      startDate: historyStartDate.value,
      endDate: historyEndDate.value,
      page: String(historyPage.value),
      size: String(historySize.value)
    });
    const response = await fetch(`/api/transactions/history?${params.toString()}`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '歷史明細載入失敗，請稍後再試'));
    }
    const data = await response.json() as HistoryTransactionsResponse;
    historyTransactions.value = data.transactions;
    historyPage.value = data.page;
    historySize.value = data.size;
    historyHasNext.value = data.hasNext;
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '歷史明細載入失敗');
  } finally {
    isLoadingHistory.value = false;
  }
}

async function loadCategorySummary(showError = true) {
  isLoadingSummary.value = true;
  try {
    const response = await fetch(`/api/transactions/category-summary?type=${summaryType.value}`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '類別摘要載入失敗，請稍後再試'));
    }
    categorySummaries.value = await response.json() as CategorySummaryResponse[];
    return true;
  } catch (error) {
    if (showError) {
      showMessage(error instanceof Error ? error.message : '類別摘要載入失敗');
    }
    return false;
  } finally {
    isLoadingSummary.value = false;
  }
}

async function getErrorMessage(response: Response, fallbackMessage: string) {
  const text = await response.text();
  if (response.status >= 400 && response.status < 500) {
    return fallbackMessage;
  }
  return text || fallbackMessage;
}

function typeLabel(type: TransactionType) {
  return type === 'EXPENSE' ? '支出' : '收入';
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('zh-TW').format(amount);
}

function formatPercentage(percentage: number) {
  return `${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(percentage)}%`;
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

function showMessage(value: string) {
  message.value = value;
  window.setTimeout(() => {
    if (message.value === value) {
      message.value = '';
    }
  }, 2500);
}
</script>
