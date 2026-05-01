<template>
  <main class="app-shell">
    <nav class="top-bar" aria-label="主導覽">
      <strong>個人記帳</strong>
      <div class="nav-links">
        <button type="button" :class="{ active: currentView === 'home' }" @click="showHome">首頁</button>
        <button type="button" :class="{ active: currentView === 'history' }" @click="showHistory">歷史查看</button>
        <span class="user-pill">dev-user</span>
      </div>
    </nav>

    <section v-if="currentView === 'home'" class="workspace" aria-label="首頁">
      <section class="entry-panel" aria-label="批次新增">
        <h1>批次新增</h1>

        <div class="entry-list">
          <div v-for="(row, index) in rows" :key="row.id" class="entry-card">
            <select v-model="row.type" aria-label="收入或支出" @change="resetCategoryForType(row)">
              <option value="">類型</option>
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
              <span v-if="!row.transactionDate && focusedDateRowId !== row.id" class="date-placeholder">日期</span>
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
                <option value="">類別</option>
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
            <input v-model.trim="row.note" type="text" maxlength="255" placeholder="備註" aria-label="備註" />

            <button
              v-if="rows.length > 1"
              type="button"
              class="icon-button"
              aria-label="移除這筆"
              @click="removeRow(index)"
            >
              X
            </button>
          </div>
        </div>

        <div class="actions">
          <button type="button" @click="addRow">新增一列</button>
          <button type="button" :disabled="!canSubmit || isSubmitting" @click="submitBatch">
            {{ isSubmitting ? '送出中' : '送出' }}
          </button>
        </div>
      </section>

      <section class="summary-panel" aria-label="統計資訊">
        <section class="chart-panel">
          <div class="panel-header">
            <h2>{{ summaryChartTitle }}</h2>
            <div class="segmented">
              <button type="button" :class="{ active: summaryMode === 'EXPENSE' }" @click="setSummaryMode('EXPENSE')">
                {{ summaryModeButtonLabel('EXPENSE', summaryPeriodLabel) }}
              </button>
              <button type="button" :class="{ active: summaryMode === 'INCOME' }" @click="setSummaryMode('INCOME')">
                {{ summaryModeButtonLabel('INCOME', summaryPeriodLabel) }}
              </button>
              <button type="button" :class="{ active: summaryMode === 'CASH_FLOW' }" @click="setSummaryMode('CASH_FLOW')">
                {{ summaryModeButtonLabel('CASH_FLOW', summaryPeriodLabel) }}
              </button>
            </div>
          </div>
          <DonutBlock
            :segments="donutSegments"
            :total-label="summaryCenterLabel"
            :total-amount="summaryCenterAmount"
            :loading="isLoadingSummary"
            empty-label="本月沒有資料"
          />
          <SummaryTable :summaries="activeSummaryRows" :loading="isLoadingSummary" empty-label="本月沒有資料" />
        </section>

        <section class="details-panel">
          <div class="panel-header">
            <h2>最近紀錄</h2>
            <select v-model.number="recentLimit" aria-label="最近筆數" @change="loadRecent()">
              <option :value="5">5 筆</option>
              <option :value="10">10 筆</option>
              <option :value="15">15 筆</option>
            </select>
          </div>

          <TransactionsTable
            :transactions="recentTransactions"
            :loading="isLoadingRecent"
            empty-label="目前沒有資料"
          />
          <button type="button" @click="showHistory">查看全部</button>
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

        <TransactionsTable
          :transactions="historyTransactions"
          :loading="isLoadingHistory"
          empty-label="查詢區間沒有資料"
          :show-actions="true"
          @delete="openDeleteDialog"
          @edit="openEditDialog"
        />

        <div class="pager">
          <button type="button" :disabled="historyPage === 0 || isLoadingHistory" @click="previousHistoryPage">上一頁</button>
          <span>第 {{ historyPage + 1 }} 頁</span>
          <button type="button" :disabled="!historyHasNext || isLoadingHistory" @click="nextHistoryPage">下一頁</button>
        </div>
      </section>

      <aside class="history-side-panel">
        <section class="chart-panel history-summary-panel">
          <div class="panel-header chart-header">
            <h2>{{ historySummaryChartTitle }}</h2>
            <div class="segmented">
              <button
                type="button"
                :class="{ active: historySummaryMode === 'EXPENSE' }"
                @click="setHistorySummaryMode('EXPENSE')"
              >
                {{ summaryModeLabel('EXPENSE') }}
              </button>
              <button
                type="button"
                :class="{ active: historySummaryMode === 'INCOME' }"
                @click="setHistorySummaryMode('INCOME')"
              >
                {{ summaryModeLabel('INCOME') }}
              </button>
              <button
                type="button"
                :class="{ active: historySummaryMode === 'CASH_FLOW' }"
                @click="setHistorySummaryMode('CASH_FLOW')"
              >
                {{ summaryModeLabel('CASH_FLOW') }}
              </button>
            </div>
          </div>
          <DonutBlock
            :segments="historyDonutSegments"
            :total-label="historySummaryCenterLabel"
            :total-amount="historySummaryCenterAmount"
            :loading="isLoadingHistorySummary"
            empty-label="查詢區間沒有資料"
          />
          <SummaryTable
            :summaries="activeHistorySummaryRows"
            :loading="isLoadingHistorySummary"
            empty-label="查詢區間沒有資料"
          />
        </section>

        <section class="chart-panel history-trend-panel">
          <div class="panel-header trend-header">
            <div>
              <h2>現金流趨勢圖</h2>
              <p class="chart-title">{{ historyTrendLabel }}</p>
            </div>
          </div>

          <div v-if="isLoadingHistoryTrend" class="trend-chart empty">載入中</div>
          <div v-else-if="historyTrendPoints.length === 0" class="trend-chart empty">查詢年度沒有資料</div>
          <div v-else class="trend-chart" aria-label="年度每月總現金流與累積現金流">
            <div class="trend-legend" aria-hidden="true">
              <span><i class="legend-bar"></i>每月總現金流</span>
              <span><i class="legend-line"></i>累積總現金流</span>
            </div>
            <svg viewBox="0 0 380 240" role="img">
              <polyline class="trend-axis" :points="trendAxisPoints" />
              <g v-for="tick in trendYAxisTicks" :key="tick.value">
                <line class="trend-grid-line" :x1="TREND_CHART_LEFT" :x2="TREND_CHART_RIGHT" :y1="tick.y" :y2="tick.y" />
                <text class="trend-axis-tick trend-axis-tick-y" :x="TREND_CHART_LEFT - 8" :y="tick.y + 4" text-anchor="end">
                  {{ formatSignedCurrency(tick.value) }}
                </text>
              </g>
              <line
                class="trend-zero"
                :x1="TREND_CHART_LEFT"
                :x2="TREND_CHART_RIGHT"
                :y1="trendZeroY"
                :y2="trendZeroY"
              />
              <g v-for="bar in trendBarDetails" :key="bar.label" class="trend-bar-group">
                <rect
                  class="trend-bar"
                  :class="{ negative: bar.value < 0 }"
                  :x="bar.x"
                  :y="bar.y"
                  :width="bar.width"
                  :height="bar.height"
                >
                  <title>{{ bar.label }} 每月總現金流 {{ formatSignedCurrency(bar.value) }}</title>
                </rect>
                <line class="trend-guide" :x1="bar.centerX" :x2="bar.centerX" :y1="TREND_CHART_TOP" :y2="TREND_CHART_BOTTOM" />
                <text class="trend-axis-tick trend-axis-tick-x" :x="bar.centerX" :y="TREND_CHART_BOTTOM + 18" text-anchor="middle">
                  {{ bar.axisLabel }}
                </text>
                <text class="trend-bar-value" :x="bar.centerX" :y="bar.valueLabelY" text-anchor="middle">
                  {{ formatSignedCurrency(bar.value) }}
                </text>
              </g>
              <polyline class="trend-line-path" :points="cumulativeLinePoints" />
              <g v-for="point in cumulativeLinePointDetails" :key="point.label" class="trend-line-point">
                <circle class="trend-point" :cx="point.x" :cy="point.y" r="4">
                  <title>{{ point.label }} 累積總現金流 {{ formatSignedCurrency(point.value) }}</title>
                </circle>
                <text class="trend-point-value" :x="point.x" :y="point.valueLabelY" text-anchor="middle">
                  {{ formatSignedCurrency(point.value) }}
                </text>
              </g>
              <text class="trend-axis-corner trend-axis-corner-y" :x="TREND_CHART_LEFT - 38" :y="TREND_CHART_TOP - 8">金額</text>
              <text class="trend-axis-corner trend-axis-corner-x" :x="TREND_CHART_RIGHT" :y="TREND_CHART_BOTTOM + 38" text-anchor="end">
                月份
              </text>
            </svg>
          </div>
        </section>
      </aside>
    </section>

    <div v-if="editingTransaction" class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-label="編輯帳目">
        <h2>編輯帳目</h2>
        <div class="modal-form">
          <label>
            <span>收入 / 支出</span>
            <select v-model="editForm.type" @change="resetEditCategory">
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
            </select>
          </label>
          <label>
            <span>日期</span>
            <input v-model="editForm.transactionDate" type="date" :max="today" />
          </label>
          <label>
            <span>金額</span>
            <input
              v-model.trim="editForm.amount"
              type="text"
              inputmode="decimal"
              pattern="[0-9]*\\.?[0-9]*"
              @input="normalizeEditAmount"
            />
          </label>
          <label>
            <span>類別</span>
            <select v-model="editForm.categoryName" @change="resetEditCustomCategory">
              <option v-for="category in categoriesByType(editForm.type)" :key="category" :value="category">
                {{ category }}
              </option>
              <option :value="CUSTOM_CATEGORY_VALUE">自訂類別</option>
            </select>
          </label>
          <label v-if="editForm.categoryName === CUSTOM_CATEGORY_VALUE">
            <span>自訂類別</span>
            <input v-model.trim="editForm.customCategoryName" type="text" maxlength="64" />
          </label>
          <label>
            <span>備註</span>
            <input v-model.trim="editForm.note" type="text" maxlength="255" />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" @click="closeEditDialog">取消</button>
          <button type="button" :disabled="!canSubmitEdit || isSavingEdit" @click="submitEdit">
            {{ isSavingEdit ? '儲存中' : '確定' }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="deletingTransaction" class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-label="確認刪除">
        <h2>確認刪除</h2>
        <dl class="delete-summary">
          <div>
            <dt>日期</dt>
            <dd>{{ deletingTransaction.transactionDate }}</dd>
          </div>
          <div>
            <dt>類別</dt>
            <dd>{{ deletingTransaction.categoryName }}</dd>
          </div>
          <div>
            <dt>金額</dt>
            <dd>{{ formatAmount(deletingTransaction.amount) }}</dd>
          </div>
        </dl>
        <p class="delete-message">確定要刪除此筆資料嗎？</p>
        <div class="modal-actions">
          <button type="button" @click="closeDeleteDialog">取消</button>
          <button type="button" class="danger-button" :disabled="isDeleting" @click="confirmDelete">
            {{ isDeleting ? '刪除中' : '確認刪除' }}
          </button>
        </div>
      </section>
    </div>

    <p v-if="message" class="message" role="status">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue';
import { formatDateTime } from './dateFormat';

type TransactionType = 'INCOME' | 'EXPENSE';
// TODO: SPEC currently defines income/expense charts; cash-flow mode is implemented for this requested change.
type SummaryMode = TransactionType | 'CASH_FLOW';

interface EntryRow {
  id: number;
  type: TransactionType | '';
  transactionDate: string;
  amount: string;
  categoryName: string;
  customCategoryName: string;
  note: string;
}

interface EditForm {
  type: TransactionType;
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

interface CategoryOptionResponse {
  name: string;
}

interface HistoryTransactionsResponse {
  transactions: TransactionResponse[];
  page: number;
  size: number;
  hasNext: boolean;
}

interface DonutSegment extends CategorySummaryResponse {
  color: string;
  length: number;
  offset: number;
}

interface HistoryTrendPointResponse {
  label: string;
  amount: number;
  cumulativeAmount: number;
}

interface CumulativeLinePoint {
  label: string;
  axisLabel: string;
  value: number;
  x: number;
  y: number;
  valueLabelY: number;
}

interface TrendBar {
  label: string;
  axisLabel: string;
  value: number;
  x: number;
  y: number;
  centerX: number;
  width: number;
  height: number;
  valueLabelY: number;
}

interface AxisTick {
  value: number;
  y: number;
}

const defaultExpenseCategories = ['飲食', '交通', '投資', '繳費', '自我成長', '社交', '治裝費', '運動'];
const defaultIncomeCategories = ['投資', '薪資'];
const CUSTOM_CATEGORY_VALUE = '__CUSTOM__';
const DONUT_RADIUS = 42;
const donutCircumference = 2 * Math.PI * DONUT_RADIUS;
const chartColors = ['#3273dc', '#1f9d55', '#d97706', '#8b5cf6', '#dc2626', '#0891b2', '#4b5563', '#be185d'];
const TREND_CHART_LEFT = 70;
const TREND_CHART_RIGHT = 346;
const TREND_CHART_TOP = 26;
const TREND_CHART_BOTTOM = 170;
const TREND_TICK_STEP = 4000;
const trendAxisPoints = `${TREND_CHART_LEFT},${TREND_CHART_TOP} ${TREND_CHART_LEFT},${TREND_CHART_BOTTOM} ${TREND_CHART_RIGHT},${TREND_CHART_BOTTOM}`;

const todayDate = new Date();
const today = formatDateInputValue(todayDate);
const defaultMonthStartDate = formatDateInputValue(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
let rowId = 1;

const rows = ref<EntryRow[]>([createRow()]);
const currentView = ref<'home' | 'history'>('home');
const recentTransactions = ref<TransactionResponse[]>([]);
const historyTransactions = ref<TransactionResponse[]>([]);
const expenseCategorySummaries = ref<CategorySummaryResponse[]>([]);
const incomeCategorySummaries = ref<CategorySummaryResponse[]>([]);
const historyExpenseCategorySummaries = ref<CategorySummaryResponse[]>([]);
const historyIncomeCategorySummaries = ref<CategorySummaryResponse[]>([]);
const historyTrendPoints = ref<HistoryTrendPointResponse[]>([]);
const categoryOptions = ref<Record<TransactionType, string[]>>({
  EXPENSE: defaultExpenseCategories,
  INCOME: defaultIncomeCategories
});
const recentLimit = ref(5);
const historyType = ref<TransactionType>('EXPENSE');
const historyStartDate = ref(defaultMonthStartDate);
const historyEndDate = ref(today);
const historyPage = ref(0);
const historySize = ref(10);
const historyHasNext = ref(false);
const summaryMode = ref<SummaryMode>('EXPENSE');
const historySummaryMode = ref<SummaryMode>('EXPENSE');
const isSubmitting = ref(false);
const isLoadingRecent = ref(false);
const isLoadingHistory = ref(false);
const isLoadingSummary = ref(false);
const isLoadingHistorySummary = ref(false);
const isLoadingHistoryTrend = ref(false);
const message = ref('');
const focusedDateRowId = ref<number | null>(null);
const editingTransaction = ref<TransactionResponse | null>(null);
const deletingTransaction = ref<TransactionResponse | null>(null);
const editForm = ref<EditForm>(createEditForm());
const isSavingEdit = ref(false);
const isDeleting = ref(false);

const canSubmit = computed(() => rows.value.every((row) => {
  const amount = Number(row.amount);
  return row.type && row.transactionDate && amount > 0 && getCategoryName(row);
}));
const canSubmitEdit = computed(() => {
  const amount = Number(editForm.value.amount);
  return Boolean(editForm.value.type)
    && Boolean(editForm.value.transactionDate)
    && amount > 0
    && Boolean(getEditCategoryName());
});

const summaryIncomeTotal = computed(() => sumSummaries(incomeCategorySummaries.value));
const summaryExpenseTotal = computed(() => sumSummaries(expenseCategorySummaries.value));
const historyIncomeTotal = computed(() => sumSummaries(historyIncomeCategorySummaries.value));
const historyExpenseTotal = computed(() => sumSummaries(historyExpenseCategorySummaries.value));
const historyTrendYear = computed(() => Number(historyStartDate.value.slice(0, 4)));
const summaryPeriodLabel = computed(() => formatRangeLabel(defaultMonthStartDate, today));
const historyPeriodLabel = computed(() => formatRangeLabel(historyStartDate.value, historyEndDate.value));
const historyTrendLabel = computed(() => `${historyTrendYear.value} 年每月總現金流與累積總現金流`);

const activeSummaryRows = computed(() => getSummaryRows(
  summaryMode.value,
  expenseCategorySummaries.value,
  incomeCategorySummaries.value
));
const activeHistorySummaryRows = computed(() => getSummaryRows(
  historySummaryMode.value,
  historyExpenseCategorySummaries.value,
  historyIncomeCategorySummaries.value
));
const summaryCenterLabel = computed(() => summaryMode.value === 'CASH_FLOW' ? '現金流' : typeLabel(summaryMode.value));
const historySummaryCenterLabel = computed(() => historySummaryMode.value === 'CASH_FLOW' ? '現金流' : typeLabel(historySummaryMode.value));
const summaryCenterAmount = computed(() => getCenterAmount(summaryMode.value, summaryExpenseTotal.value, summaryIncomeTotal.value));
const historySummaryCenterAmount = computed(() => getCenterAmount(historySummaryMode.value, historyExpenseTotal.value, historyIncomeTotal.value));
const summaryChartTitle = computed(() => `${summaryPeriodLabel.value}${summaryModeLabel(summaryMode.value)}圓餅圖`);
const historySummaryChartTitle = computed(() => `${historyPeriodLabel.value}${summaryModeLabel(historySummaryMode.value)}圓餅圖`);
const donutSegments = computed(() => buildDonutSegments(activeSummaryRows.value));
const historyDonutSegments = computed(() => buildDonutSegments(activeHistorySummaryRows.value));
const trendValues = computed(() => historyTrendPoints.value.flatMap((point) => [
  point.amount,
  point.cumulativeAmount
]));
const trendRange = computed(() => getTrendRange(trendValues.value));
const trendZeroY = computed(() => scaleTrendValue(0));
const trendYAxisTicks = computed<AxisTick[]>(() => buildTrendYAxisTicks(trendRange.value));
const trendBarDetails = computed<TrendBar[]>(() => buildTrendBars(historyTrendPoints.value));
const cumulativeLinePointDetails = computed<CumulativeLinePoint[]>(() => buildCumulativeLinePoints(historyTrendPoints.value));
const cumulativeLinePoints = computed(() => cumulativeLinePointDetails.value
  .map((point) => `${point.x},${point.y}`)
  .join(' '));

const TransactionsTable = defineComponent({
  props: {
    transactions: { type: Array as PropType<TransactionResponse[]>, required: true },
    loading: { type: Boolean, required: true },
    emptyLabel: { type: String, required: true },
    showActions: { type: Boolean, default: false }
  },
  emits: {
    edit: (transaction: TransactionResponse) => Boolean(transaction),
    delete: (transaction: TransactionResponse) => Boolean(transaction)
  },
  setup(props, { emit }) {
    const columnCount = props.showActions ? 7 : 6;
    const headerCells = [
      h('th', '日期'),
      h('th', '類型'),
      h('th', '類別'),
      h('th', '金額'),
      h('th', '備註'),
      h('th', '建立時間')
    ];
    if (props.showActions) {
      headerCells.push(h('th', '操作'));
    }

    return () => h('table', [
      h('thead', h('tr', [
        ...headerCells
      ])),
      h('tbody', props.loading
        ? h('tr', h('td', { colspan: columnCount }, '載入中'))
        : props.transactions.length === 0
          ? h('tr', h('td', { colspan: columnCount }, props.emptyLabel))
          : props.transactions.map((transaction) => {
            const rowCells = [
            h('td', transaction.transactionDate),
            h('td', typeLabel(transaction.type)),
            h('td', transaction.categoryName),
            h('td', formatAmount(transaction.amount)),
            h('td', { class: 'truncate' }, truncateNote(transaction.note)),
            h('td', formatDateTime(transaction.createdAt))
            ];
            if (props.showActions) {
              rowCells.push(h('td', h('div', { class: 'row-actions' }, [
              h('button', {
                type: 'button',
                class: 'square-action edit-action',
                title: '編輯',
                'aria-label': '編輯',
                onClick: () => emit('edit', transaction)
              }, [renderPencilIcon()]),
              h('button', {
                type: 'button',
                class: 'square-action delete-action',
                title: '刪除',
                'aria-label': '刪除',
                onClick: () => emit('delete', transaction)
              }, [renderTrashIcon()])
              ])));
            }
            return h('tr', { key: transaction.id }, rowCells);
          })
      )
    ]);
  }
});

const SummaryTable = defineComponent({
  props: {
    summaries: { type: Array as PropType<CategorySummaryResponse[]>, required: true },
    loading: { type: Boolean, required: true },
    emptyLabel: { type: String, required: true }
  },
  setup(props) {
    return () => h('table', { class: 'summary-table' }, [
      h('thead', h('tr', [
        h('th', '項目'),
        h('th', '金額'),
        h('th', '比例')
      ])),
      h('tbody', props.loading
        ? h('tr', h('td', { colspan: 3 }, '載入中'))
        : props.summaries.length === 0
          ? h('tr', h('td', { colspan: 3 }, props.emptyLabel))
          : props.summaries.map((summary) => h('tr', { key: summary.categoryName }, [
            h('td', summary.categoryName),
            h('td', formatSignedCurrency(summary.amount)),
            h('td', formatPercentage(summary.percentage))
          ]))
      )
    ]);
  }
});

const DonutBlock = defineComponent({
  props: {
    segments: { type: Array as PropType<DonutSegment[]>, required: true },
    totalLabel: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    loading: { type: Boolean, required: true },
    emptyLabel: { type: String, required: true }
  },
  setup(props) {
    return () => h('div', {
      class: ['donut-chart', { empty: props.loading || props.segments.length === 0 }],
      'aria-label': '圓餅圖'
    }, props.loading
      ? '載入中'
      : props.segments.length === 0
        ? props.emptyLabel
        : [
          h('svg', { viewBox: '0 0 120 120', role: 'img' }, [
            h('circle', { class: 'donut-bg', cx: 60, cy: 60, r: DONUT_RADIUS }),
            props.segments.map((segment) => h('circle', {
              key: segment.categoryName,
              class: 'donut-segment',
              cx: 60,
              cy: 60,
              r: DONUT_RADIUS,
              stroke: segment.color,
              'stroke-dasharray': `${segment.length} ${donutCircumference - segment.length}`,
              'stroke-dashoffset': segment.offset
            }, [
              h('title', `${segment.categoryName} ${formatSignedCurrency(segment.amount)} ${formatPercentage(segment.percentage)}`)
            ]))
          ]),
          h('div', { class: 'donut-center' }, [
            h('span', props.totalLabel),
            h('strong', formatSignedCurrency(props.totalAmount))
          ])
        ]);
  }
});

onMounted(() => {
  void loadCategories();
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

function createEditForm(): EditForm {
  return {
    type: 'EXPENSE',
    transactionDate: '',
    amount: '',
    categoryName: '',
    customCategoryName: '',
    note: ''
  };
}

function renderPencilIcon() {
  return h('svg', {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true'
  }, [
    h('path', {
      d: 'M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25z'
    }),
    h('path', {
      d: 'M19.71 7.04a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.05 1.05 2.75 2.75 1.05-1.05z'
    })
  ]);
}

function renderTrashIcon() {
  return h('svg', {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true'
  }, [
    h('path', {
      d: 'M7 21c-1.1 0-2-.9-2-2V8h14v11c0 1.1-.9 2-2 2H7z'
    }),
    h('path', {
      d: 'M9 4h6l1 2h4v2H4V6h4l1-2z'
    })
  ]);
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
  return categoryOptions.value[type];
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
    showMessage('請完成每筆資料');
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
      throw new Error(await getErrorMessage(response, '新增失敗，請確認欄位內容'));
    }

    rows.value = [createRow()];
    const [recentLoaded, summaryLoaded, categoriesLoaded] = await Promise.all([
      loadRecent(false),
      loadCategorySummary(false),
      loadCategories(false)
    ]);
    showMessage(recentLoaded && summaryLoaded && categoriesLoaded ? '新增完成' : '新增完成，部分資料重新載入失敗');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '新增失敗');
  } finally {
    isSubmitting.value = false;
  }
}

function openEditDialog(transaction: TransactionResponse) {
  editingTransaction.value = transaction;
  editForm.value = {
    type: transaction.type,
    transactionDate: transaction.transactionDate,
    amount: String(transaction.amount),
    categoryName: getInitialEditCategoryName(transaction),
    customCategoryName: categoriesByType(transaction.type).includes(transaction.categoryName) ? '' : transaction.categoryName,
    note: transaction.note ?? ''
  };
}

function closeEditDialog() {
  if (isSavingEdit.value) {
    return;
  }
  editingTransaction.value = null;
  editForm.value = createEditForm();
}

function resetEditCategory() {
  editForm.value.categoryName = '';
  editForm.value.customCategoryName = '';
}

function resetEditCustomCategory() {
  if (editForm.value.categoryName !== CUSTOM_CATEGORY_VALUE) {
    editForm.value.customCategoryName = '';
  }
}

function normalizeEditAmount() {
  editForm.value.amount = editForm.value.amount.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
}

async function submitEdit() {
  if (!editingTransaction.value || isSavingEdit.value || !canSubmitEdit.value) {
    return;
  }

  isSavingEdit.value = true;
  try {
    const response = await fetch(`/api/transactions/${editingTransaction.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: editForm.value.type,
        transactionDate: editForm.value.transactionDate,
        amount: Number(editForm.value.amount),
        categoryName: getEditCategoryName(),
        note: editForm.value.note.trim() || null
      })
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '更新失敗，請確認欄位內容'));
    }

    editingTransaction.value = null;
    editForm.value = createEditForm();
    await refreshAfterMutation();
    showMessage('更新完成');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '更新失敗');
  } finally {
    isSavingEdit.value = false;
  }
}

function openDeleteDialog(transaction: TransactionResponse) {
  deletingTransaction.value = transaction;
}

function closeDeleteDialog() {
  if (isDeleting.value) {
    return;
  }
  deletingTransaction.value = null;
}

async function confirmDelete() {
  if (!deletingTransaction.value || isDeleting.value) {
    return;
  }

  const deletedFromHistoryLastRow = currentView.value === 'history'
    && historyTransactions.value.length === 1
    && historyPage.value > 0;

  isDeleting.value = true;
  try {
    const response = await fetch(`/api/transactions/${deletingTransaction.value.id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '刪除失敗，請稍後再試'));
    }

    deletingTransaction.value = null;
    if (deletedFromHistoryLastRow) {
      historyPage.value -= 1;
    }
    await refreshAfterMutation();
    showMessage('刪除完成');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '刪除失敗');
  } finally {
    isDeleting.value = false;
  }
}

function getInitialEditCategoryName(transaction: TransactionResponse) {
  return categoriesByType(transaction.type).includes(transaction.categoryName)
    ? transaction.categoryName
    : CUSTOM_CATEGORY_VALUE;
}

function getEditCategoryName() {
  if (editForm.value.categoryName === CUSTOM_CATEGORY_VALUE) {
    return editForm.value.customCategoryName.trim();
  }
  return editForm.value.categoryName.trim();
}

async function refreshAfterMutation() {
  if (currentView.value === 'history') {
    await Promise.all([
      loadHistory(),
      loadHistoryCategorySummary(),
      loadHistoryTrend(),
      loadRecent(false),
      loadCategorySummary(false),
      loadCategories(false)
    ]);
    return;
  }

  await Promise.all([
    loadRecent(false),
    loadCategorySummary(false),
    loadCategories(false)
  ]);
}

function setSummaryMode(mode: SummaryMode) {
  summaryMode.value = mode;
}

function setHistorySummaryMode(mode: SummaryMode) {
  historySummaryMode.value = mode;
}

function showHome() {
  currentView.value = 'home';
}

function showHistory() {
  currentView.value = 'history';
  void loadHistoryView();
}

async function loadCategories(showError = true) {
  try {
    const [expenseResponse, incomeResponse] = await Promise.all([
      fetch('/api/transactions/categories?type=EXPENSE'),
      fetch('/api/transactions/categories?type=INCOME')
    ]);
    if (!expenseResponse.ok || !incomeResponse.ok) {
      throw new Error('類別載入失敗');
    }

    const [expenseOptions, incomeOptions] = await Promise.all([
      expenseResponse.json() as Promise<CategoryOptionResponse[]>,
      incomeResponse.json() as Promise<CategoryOptionResponse[]>
    ]);
    categoryOptions.value = {
      EXPENSE: mergeCategories(defaultExpenseCategories, expenseOptions.map((category) => category.name)),
      INCOME: mergeCategories(defaultIncomeCategories, incomeOptions.map((category) => category.name))
    };
    return true;
  } catch (error) {
    if (showError) {
      showMessage(error instanceof Error ? error.message : '類別載入失敗');
    }
    return false;
  }
}

async function loadRecent(showError = true) {
  isLoadingRecent.value = true;
  try {
    const response = await fetch(`/api/transactions/recent?limit=${recentLimit.value}`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '最近紀錄載入失敗'));
    }
    recentTransactions.value = await response.json() as TransactionResponse[];
    return true;
  } catch (error) {
    if (showError) {
      showMessage(error instanceof Error ? error.message : '最近紀錄載入失敗');
    }
    return false;
  } finally {
    isLoadingRecent.value = false;
  }
}

async function resetHistoryPageAndLoad() {
  historyPage.value = 0;
  if (historySummaryMode.value !== 'CASH_FLOW') {
    historySummaryMode.value = historyType.value;
  }
  await loadHistoryView();
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

async function loadHistoryView() {
  await Promise.all([loadHistory(), loadHistoryCategorySummary(), loadHistoryTrend()]);
}

async function loadHistory() {
  if (historyStartDate.value > historyEndDate.value) {
    showMessage('開始日期不可晚於結束日期');
    return false;
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
      throw new Error(await getErrorMessage(response, '歷史紀錄載入失敗'));
    }
    const data = await response.json() as HistoryTransactionsResponse;
    historyTransactions.value = data.transactions;
    historyPage.value = data.page;
    historySize.value = data.size;
    historyHasNext.value = data.hasNext;
    return true;
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '歷史紀錄載入失敗');
    return false;
  } finally {
    isLoadingHistory.value = false;
  }
}

async function loadCategorySummary(showError = true) {
  isLoadingSummary.value = true;
  try {
    const [expenseSummaries, incomeSummaries] = await Promise.all([
      fetchCategorySummary('EXPENSE', defaultMonthStartDate, today),
      fetchCategorySummary('INCOME', defaultMonthStartDate, today)
    ]);
    expenseCategorySummaries.value = expenseSummaries;
    incomeCategorySummaries.value = incomeSummaries;
    return true;
  } catch (error) {
    if (showError) {
      showMessage(error instanceof Error ? error.message : '類別占比載入失敗');
    }
    return false;
  } finally {
    isLoadingSummary.value = false;
  }
}

async function loadHistoryCategorySummary() {
  if (historyStartDate.value > historyEndDate.value) {
    historyExpenseCategorySummaries.value = [];
    historyIncomeCategorySummaries.value = [];
    return false;
  }

  isLoadingHistorySummary.value = true;
  try {
    const [expenseSummaries, incomeSummaries] = await Promise.all([
      fetchCategorySummary('EXPENSE', historyStartDate.value, historyEndDate.value),
      fetchCategorySummary('INCOME', historyStartDate.value, historyEndDate.value)
    ]);
    historyExpenseCategorySummaries.value = expenseSummaries;
    historyIncomeCategorySummaries.value = incomeSummaries;
    return true;
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '歷史類別占比載入失敗');
    return false;
  } finally {
    isLoadingHistorySummary.value = false;
  }
}

async function loadHistoryTrend() {
  isLoadingHistoryTrend.value = true;
  try {
    const params = new URLSearchParams({
      year: String(historyTrendYear.value)
    });
    const response = await fetch(`/api/transactions/cash-flow-trend?${params.toString()}`);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '現金流折線圖載入失敗'));
    }
    historyTrendPoints.value = await response.json() as HistoryTrendPointResponse[];
    return true;
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '現金流折線圖載入失敗');
    return false;
  } finally {
    isLoadingHistoryTrend.value = false;
  }
}

async function fetchCategorySummary(type: TransactionType, startDate?: string, endDate?: string) {
  const params = new URLSearchParams({ type });
  if (startDate && endDate) {
    params.set('startDate', startDate);
    params.set('endDate', endDate);
  }
  const response = await fetch(`/api/transactions/category-summary?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, '類別占比載入失敗'));
  }
  return await response.json() as CategorySummaryResponse[];
}

async function getErrorMessage(response: Response, fallbackMessage: string) {
  const text = await response.text();
  if (response.status >= 400 && response.status < 500) {
    return fallbackMessage;
  }
  return text || fallbackMessage;
}

function mergeCategories(defaultCategories: string[], loadedCategories: string[]) {
  return Array.from(new Set([...defaultCategories, ...loadedCategories]));
}

function getSummaryRows(
  mode: SummaryMode,
  expenseSummaries: CategorySummaryResponse[],
  incomeSummaries: CategorySummaryResponse[]
) {
  if (mode === 'EXPENSE') {
    return expenseSummaries;
  }
  if (mode === 'INCOME') {
    return incomeSummaries;
  }
  return buildCashFlowRows(sumSummaries(incomeSummaries), sumSummaries(expenseSummaries));
}

function buildCashFlowRows(incomeTotal: number, expenseTotal: number): CategorySummaryResponse[] {
  const total = incomeTotal + expenseTotal;
  if (total <= 0) {
    return [];
  }
  return [
    {
      categoryName: '總收入',
      amount: incomeTotal,
      percentage: calculatePercentage(incomeTotal, total)
    },
    {
      categoryName: '總支出',
      amount: expenseTotal,
      percentage: calculatePercentage(expenseTotal, total)
    }
  ];
}

function getCenterAmount(mode: SummaryMode, expenseTotal: number, incomeTotal: number) {
  if (mode === 'EXPENSE') {
    return expenseTotal;
  }
  if (mode === 'INCOME') {
    return incomeTotal;
  }
  return incomeTotal - expenseTotal;
}

function buildDonutSegments(summaries: CategorySummaryResponse[]) {
  let usedLength = 0;
  return summaries.map((summary, index) => {
    const length = donutCircumference * (summary.percentage / 100);
    const segment = {
      ...summary,
      color: chartColors[index % chartColors.length],
      length,
      offset: -usedLength
    };
    usedLength += length;
    return segment;
  });
}

function sumSummaries(summaries: CategorySummaryResponse[]) {
  return summaries.reduce((total, summary) => total + summary.amount, 0);
}

function calculatePercentage(amount: number, total: number) {
  if (total === 0) {
    return 0;
  }
  return Number(((amount / total) * 100).toFixed(2));
}

function getTrendRange(values: number[]) {
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const min = Math.min(0, Math.floor(rawMin / TREND_TICK_STEP) * TREND_TICK_STEP);
  let max = Math.max(0, Math.ceil(rawMax / TREND_TICK_STEP) * TREND_TICK_STEP);

  if (max === min) {
    max = TREND_TICK_STEP;
  }

  return {
    min,
    max
  };
}

function scaleTrendValue(value: number) {
  const { min: minValue, max: maxValue } = trendRange.value;
  if (maxValue === minValue) {
    return TREND_CHART_BOTTOM;
  }
  const yRange = TREND_CHART_BOTTOM - TREND_CHART_TOP;
  return TREND_CHART_BOTTOM - ((value - minValue) / (maxValue - minValue) * yRange);
}

function buildTrendYAxisTicks(range: { min: number; max: number }) {
  const ticks: AxisTick[] = [];
  for (let value = range.min; value <= range.max; value += TREND_TICK_STEP) {
    ticks.push({
      value,
      y: scaleTrendValue(value)
    });
  }
  return ticks.reverse();
}

function buildTrendBars(points: HistoryTrendPointResponse[]) {
  const zeroY = trendZeroY.value;
  const slotWidth = (TREND_CHART_RIGHT - TREND_CHART_LEFT) / Math.max(points.length, 1);
  const barWidth = Math.min(18, Math.max(10, slotWidth * 0.46));

  return points.map((point, index) => {
    const centerX = TREND_CHART_LEFT + (slotWidth * index) + (slotWidth / 2);
    const valueY = scaleTrendValue(point.amount);
    const y = Math.min(valueY, zeroY);
    const height = Math.max(Math.abs(zeroY - valueY), 2);
    const valueLabelY = point.amount >= 0 ? Math.max(y - 7, TREND_CHART_TOP + 8) : y + height + 14;

    return {
      label: point.label,
      axisLabel: formatTrendMonth(point.label),
      value: point.amount,
      x: centerX - (barWidth / 2),
      y,
      centerX,
      width: barWidth,
      height,
      valueLabelY
    };
  });
}

function buildCumulativeLinePoints(points: HistoryTrendPointResponse[]) {
  const slotWidth = (TREND_CHART_RIGHT - TREND_CHART_LEFT) / Math.max(points.length, 1);

  return points.map((point, index) => {
    const value = point.cumulativeAmount;
    const x = TREND_CHART_LEFT + (slotWidth * index) + (slotWidth / 2);
    const y = scaleTrendValue(value);
    const valueLabelY = y < TREND_CHART_TOP + 18 ? y + 20 : y - 10;

    return {
      label: point.label,
      axisLabel: formatTrendMonth(point.label),
      value,
      x,
      y,
      valueLabelY
    };
  });
}

function formatTrendMonth(label: string) {
  const month = Number(label.slice(5, 7));
  return Number.isNaN(month) ? label : String(month);
}

function summaryModeLabel(mode: SummaryMode) {
  if (mode === 'EXPENSE') {
    return '總支出';
  }
  if (mode === 'INCOME') {
    return '總收入';
  }
  return '總現金流';
}

function summaryModeButtonLabel(mode: SummaryMode, periodLabel: string) {
  return `${periodLabel}${summaryModeLabel(mode)}`;
}

function formatRangeLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const startMonth = start.getMonth() + 1;
  const endMonth = end.getMonth() + 1;
  if (start.getFullYear() === end.getFullYear() && startMonth === endMonth) {
    return `${startMonth}月`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth}-${endMonth}月`;
  }
  return `${start.getFullYear()}/${startMonth}-${end.getFullYear()}/${endMonth}`;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function typeLabel(type: TransactionType) {
  return type === 'EXPENSE' ? '支出' : '收入';
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('zh-TW').format(amount);
}

function formatSignedCurrency(amount: number) {
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}$${formatAmount(Math.abs(amount))}`;
}

function formatPercentage(percentage: number) {
  return `${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(percentage)}%`;
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
