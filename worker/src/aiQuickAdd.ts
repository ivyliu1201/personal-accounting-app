import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedUser, WorkerEnv } from './auth';
import { listCategoryOptions } from './categories';

export type DateSource = 'default_today' | 'relative_date' | 'explicit_date';
export type TransactionType = 'EXPENSE' | 'INCOME';
export type CategoryMappingSource = 'user_mapping' | 'global_mapping' | 'exact_match' | 'suggested_custom_category';

export interface ParsedTransactionDate {
  transactionDate: string;
  dateSource: DateSource;
  remainingText: string;
}

export interface CategoryMappingRow {
  modelLabel: string;
  type: TransactionType;
  categoryName: string;
}

export interface ResolveMappedCategoryRequest {
  modelLabel: string;
  modelType: TransactionType;
  modelCategory: string;
  visibleCategories: string[];
  userMappings: CategoryMappingRow[];
  globalMappings: CategoryMappingRow[];
}

export interface ResolvedMappedCategory {
  type: TransactionType;
  categoryName: string;
  customCategoryName: string | null;
  mappingSource: CategoryMappingSource;
}

export interface QuickAddParseRequestBody {
  text?: unknown;
}

export interface AiCategoryServiceItem {
  sourceText: string;
  itemText: string;
  amount: number;
  modelType: TransactionType;
  modelCategory: string;
  modelLabel: string;
  confidence: number;
  needsReview: boolean;
}

export interface AiCategoryServiceResponse {
  items: AiCategoryServiceItem[];
  unparsedItems: string[];
}

export interface PersonalQuickAddRule {
  itemText: string | null;
  sourceText: string | null;
  type: TransactionType;
  categoryName: string;
  source: 'feedback' | 'transaction' | 'bootstrap';
}

export interface QuickAddSuggestion {
  suggestionId: string;
  sourceText: string;
  itemText: string;
  type: TransactionType;
  transactionDate: string;
  amount: number;
  categoryName: string;
  customCategoryName: string | null;
  needsReview: boolean;
  confidence: number;
  modelLabel: string;
  modelType: TransactionType;
  modelCategory: string;
  mappedType: TransactionType;
  mappedCategoryName: string;
  suggestedTransactionDate: string;
  suggestedAmount: number;
  suggestedNote: string | null;
  mappingSource: CategoryMappingSource;
  dateSource: DateSource;
}

export interface QuickAddParseResponse {
  suggestions: QuickAddSuggestion[];
  unparsedItems: string[];
}

export interface BuildQuickAddParseResponseRequest {
  aiResponse: AiCategoryServiceResponse;
  today: string;
  visibleCategoriesByType: Record<TransactionType, string[]>;
  userMappings: CategoryMappingRow[];
  globalMappings: CategoryMappingRow[];
  personalRules?: PersonalQuickAddRule[];
  createSuggestionId?: () => string;
}

export interface ParseQuickAddRequestDependencies {
  env: Pick<WorkerEnv, 'AI_CATEGORY_SERVICE_TOKEN' | 'AI_CATEGORY_SERVICE_URL'>;
  user: AuthenticatedUser;
  body: unknown;
  today: string;
  supabase?: SupabaseClient;
  listVisibleCategoryNames?: (type: TransactionType) => Promise<string[]>;
  loadPersonalRules?: () => Promise<PersonalQuickAddRule[]>;
  callAiService?: (serviceUrl: string, serviceToken: string | undefined, text: string) => Promise<AiCategoryServiceResponse>;
  createSuggestionId?: () => string;
}

export type Fetcher = typeof fetch;
export const AI_CATEGORY_SERVICE_LOADING_MESSAGE = '服務載入中，請再試一次!';

export class AiCategoryServiceLoadingError extends Error {
  constructor() {
    super(AI_CATEGORY_SERVICE_LOADING_MESSAGE);
    this.name = 'AiCategoryServiceLoadingError';
  }
}

const AI_CATEGORY_SERVICE_TIMEOUT_MILLIS = 5_000;
const AI_CATEGORY_SERVICE_MAX_ATTEMPTS = 2;

export const CUSTOM_CATEGORY_VALUE = '__CUSTOM__';

const RELATIVE_DATE_PATTERNS: Array<{ pattern: RegExp; offsetDays: number }> = [
  { pattern: /今天/g, offsetDays: 0 },
  { pattern: /昨天/g, offsetDays: -1 },
  { pattern: /前天/g, offsetDays: -2 },
  { pattern: /明天/g, offsetDays: 1 }
];

const DEFAULT_GLOBAL_MAPPINGS: CategoryMappingRow[] = [
  { modelLabel: 'expense::學習', type: 'EXPENSE', categoryName: '自我成長' },
  { modelLabel: 'income::投資收入', type: 'INCOME', categoryName: '投資' }
];

const BOOTSTRAP_PERSONAL_RULES: PersonalQuickAddRule[] = [
  { itemText: '吃飯', sourceText: '吃飯', type: 'EXPENSE', categoryName: '飲食', source: 'bootstrap' },
  { itemText: '搭車', sourceText: '搭車', type: 'EXPENSE', categoryName: '交通', source: 'bootstrap' }
];

/**
 * 從快速新增文字擷取日期，並回傳移除日期詞後的交易描述。
 */
export function parseTransactionDateFromText(text: string, today: string): ParsedTransactionDate {
  const normalizedText = text.trim();

  for (const item of RELATIVE_DATE_PATTERNS) {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(normalizedText)) {
      item.pattern.lastIndex = 0;
      return {
        transactionDate: addDays(today, item.offsetDays),
        dateSource: 'relative_date',
        remainingText: normalizeSpacing(normalizedText.replace(item.pattern, ''))
      };
    }
  }

  const explicitDateMatch = normalizedText.match(/(?:(\d{4})[-/])?(\d{1,2})[-/](\d{1,2})/);
  if (explicitDateMatch) {
    const year = explicitDateMatch[1] ?? today.slice(0, 4);
    const month = explicitDateMatch[2].padStart(2, '0');
    const day = explicitDateMatch[3].padStart(2, '0');
    return {
      transactionDate: `${year}-${month}-${day}`,
      dateSource: 'explicit_date',
      remainingText: normalizeSpacing(normalizedText.replace(explicitDateMatch[0], ''))
    };
  }

  return {
    transactionDate: today,
    dateSource: 'default_today',
    remainingText: normalizedText
  };
}

/**
 * 驗證快速新增解析 request，回傳清理後文字。
 */
export function validateQuickAddParseRequest(body: unknown): string {
  if (!isRecord(body) || typeof body.text !== 'string') {
    throw new RangeError('Quick add text is required');
  }

  const text = body.text.trim();
  if (text === '') {
    throw new RangeError('Quick add text is required');
  }
  if (text.length > 1000) {
    throw new RangeError('Quick add text is too long');
  }

  return text;
}

/**
 * 呼叫獨立 AI 分類服務，取得自然語句解析結果。
 */
export async function callAiCategoryService(
  serviceUrl: string,
  serviceToken: string | undefined,
  text: string,
  fetcher: Fetcher = fetch
): Promise<AiCategoryServiceResponse> {
  const url = `${serviceUrl.replace(/\/$/, '')}/parse`;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {})
    },
    body: JSON.stringify({ text })
  };

  for (let attempt = 1; attempt <= AI_CATEGORY_SERVICE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, requestInit, fetcher);
    } catch (error) {
      if (attempt >= AI_CATEGORY_SERVICE_MAX_ATTEMPTS) {
        throw new AiCategoryServiceLoadingError();
      }
      continue;
    }

    if (response.ok) {
      return response.json() as Promise<AiCategoryServiceResponse>;
    }
    if (!isRetryableAiServiceStatus(response.status)) {
      throw new Error('AI service request failed');
    }
    if (attempt >= AI_CATEGORY_SERVICE_MAX_ATTEMPTS) {
      throw new AiCategoryServiceLoadingError();
    }
  }

  throw new AiCategoryServiceLoadingError();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  fetcher: Fetcher
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CATEGORY_SERVICE_TIMEOUT_MILLIS);
  try {
    return await fetcher(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetryableAiServiceStatus(status: number): boolean {
  return status >= 500;
}

/**
 * 處理快速新增解析 request，組合 AI 結果、日期解析與類別對應。
 */
export async function parseQuickAddRequest(dependencies: ParseQuickAddRequestDependencies): Promise<QuickAddParseResponse> {
  const serviceUrl = dependencies.env.AI_CATEGORY_SERVICE_URL?.trim();
  if (!serviceUrl) {
    throw new Error('AI category service is not configured');
  }

  const text = validateQuickAddParseRequest(dependencies.body);
  const listVisibleCategoryNames = dependencies.listVisibleCategoryNames
    ?? ((type: TransactionType) => listVisibleCategoryNamesFromSupabase(dependencies, type));
  const aiResponse = await (dependencies.callAiService ?? callAiCategoryService)(
    serviceUrl,
    dependencies.env.AI_CATEGORY_SERVICE_TOKEN?.trim() || undefined,
    text
  );
  const visibleCategoriesByType = {
    EXPENSE: await listVisibleCategoryNames('EXPENSE'),
    INCOME: await listVisibleCategoryNames('INCOME')
  };
  const loadedPersonalRules = await (dependencies.loadPersonalRules
    ?? (() => loadPersonalRulesFromSupabase(dependencies)))();

  return buildQuickAddParseResponse({
    aiResponse,
    today: dependencies.today,
    visibleCategoriesByType,
    userMappings: [],
    globalMappings: DEFAULT_GLOBAL_MAPPINGS,
    personalRules: filterAvailablePersonalRules(
      [...BOOTSTRAP_PERSONAL_RULES, ...loadedPersonalRules],
      visibleCategoriesByType
    ),
    createSuggestionId: dependencies.createSuggestionId
  });
}

/**
 * 依應用時區格式化今日日期，供快速新增沒有日期時使用。
 */
export function formatQuickAddAppDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

/**
 * 將模型標籤轉成目前使用者可用的記帳類別。
 */
export function resolveMappedCategory(request: ResolveMappedCategoryRequest): ResolvedMappedCategory {
  const userMapping = request.userMappings.find((mapping) => mapping.modelLabel === request.modelLabel);
  if (userMapping) {
    return toResolvedMapping(userMapping, 'user_mapping');
  }

  const globalMapping = request.globalMappings.find((mapping) => mapping.modelLabel === request.modelLabel);
  if (globalMapping) {
    return toResolvedMapping(globalMapping, 'global_mapping');
  }

  if (request.visibleCategories.includes(request.modelCategory)) {
    return {
      type: request.modelType,
      categoryName: request.modelCategory,
      customCategoryName: null,
      mappingSource: 'exact_match'
    };
  }

  return {
    type: request.modelType,
    categoryName: CUSTOM_CATEGORY_VALUE,
    customCategoryName: request.modelCategory,
    mappingSource: 'suggested_custom_category'
  };
}

/**
 * 將 AI 服務回應轉成前端快速新增 modal 可預覽與代入的資料。
 */
export function buildQuickAddParseResponse(request: BuildQuickAddParseResponseRequest): QuickAddParseResponse {
  const createSuggestionId = request.createSuggestionId ?? (() => crypto.randomUUID());
  const suggestions = request.aiResponse.items.map((item) => {
    const parsedDate = parseTransactionDateFromText(item.sourceText, request.today);
    const mappedCategory = resolveMappedCategory({
      modelLabel: item.modelLabel,
      modelType: item.modelType,
      modelCategory: item.modelCategory,
      visibleCategories: request.visibleCategoriesByType[item.modelType],
      userMappings: request.userMappings,
      globalMappings: request.globalMappings
    });
    const suggestedItemText = buildSuggestedItemText(item, parsedDate);
    const personalRule = findPersonalRule(item, suggestedItemText, request.personalRules ?? []);
    const categoryKeywordMapping = findCategoryKeywordMapping(
      item,
      suggestedItemText,
      request.visibleCategoriesByType
    );
    const shouldApplyPersonalRule = personalRule
      && (personalRule.source !== 'transaction'
        || item.needsReview
        || mappedCategory.mappingSource === 'suggested_custom_category');
    const finalMapping = shouldApplyPersonalRule
      ? {
          type: personalRule.type,
          categoryName: personalRule.categoryName,
          customCategoryName: null,
          mappingSource: 'user_mapping' as const
        }
      : categoryKeywordMapping
        ? categoryKeywordMapping
      : mappedCategory;

    return {
      suggestionId: createSuggestionId(),
      sourceText: item.sourceText,
      itemText: suggestedItemText,
      type: finalMapping.type,
      transactionDate: parsedDate.transactionDate,
      amount: item.amount,
      categoryName: finalMapping.categoryName,
      customCategoryName: finalMapping.customCategoryName,
      needsReview: shouldApplyPersonalRule || categoryKeywordMapping ? false : item.needsReview,
      confidence: item.confidence,
      modelLabel: item.modelLabel,
      modelType: item.modelType,
      modelCategory: item.modelCategory,
      mappedType: finalMapping.type,
      mappedCategoryName: finalMapping.customCategoryName ?? finalMapping.categoryName,
      suggestedTransactionDate: parsedDate.transactionDate,
      suggestedAmount: item.amount,
      suggestedNote: suggestedItemText || null,
      mappingSource: finalMapping.mappingSource,
      dateSource: parsedDate.dateSource
    };
  });

  return {
    suggestions,
    unparsedItems: request.aiResponse.unparsedItems
  };
}

function addDays(dateValue: string, offsetDays: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function listVisibleCategoryNamesFromSupabase(
  dependencies: ParseQuickAddRequestDependencies,
  type: TransactionType
): Promise<string[]> {
  if (!dependencies.supabase) {
    throw new Error('Supabase is not configured');
  }

  const categories = await listCategoryOptions(dependencies.supabase, dependencies.user, type);
  return categories.map((category) => category.name);
}

async function loadPersonalRulesFromSupabase(
  dependencies: ParseQuickAddRequestDependencies
): Promise<PersonalQuickAddRule[]> {
  if (!dependencies.supabase) {
    return [];
  }

  const { data, error } = await dependencies.supabase
    .from('ai_quick_add_feedback')
    .select('item_text, source_text, final_type, final_category')
    .eq('user_id', dependencies.user.userId)
    .eq('feedback_type', 'corrected')
    .order('created_at', { ascending: false })
    .limit(50);
  const feedbackRules = error || !Array.isArray(data)
    ? []
    : data
    .map((row) => toPersonalRule(row))
    .filter((rule): rule is PersonalQuickAddRule => rule !== null);
  const transactionRules = await loadSuccessfulTransactionRulesFromSupabase(dependencies);
  return [...feedbackRules, ...transactionRules];
}

async function loadSuccessfulTransactionRulesFromSupabase(
  dependencies: ParseQuickAddRequestDependencies
): Promise<PersonalQuickAddRule[]> {
  if (!dependencies.supabase) {
    return [];
  }

  const { data, error } = await dependencies.supabase
    .from('accounting_transactions')
    .select('note,type,categories(name)')
    .eq('user_id', dependencies.user.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => toTransactionPersonalRule(row))
    .filter((rule): rule is PersonalQuickAddRule => rule !== null);
}

function toPersonalRule(row: unknown): PersonalQuickAddRule | null {
  if (!isRecord(row)) {
    return null;
  }
  const type = row.final_type;
  const categoryName = row.final_category;
  if ((type !== 'INCOME' && type !== 'EXPENSE') || typeof categoryName !== 'string' || categoryName.trim() === '') {
    return null;
  }
  const itemText = typeof row.item_text === 'string' && row.item_text.trim() !== ''
    ? row.item_text.trim()
    : null;
  const sourceText = typeof row.source_text === 'string' && row.source_text.trim() !== ''
    ? row.source_text.trim()
    : null;
  if (!itemText && !sourceText) {
    return null;
  }
  return {
    itemText,
    sourceText,
    type,
    categoryName: categoryName.trim(),
    source: 'feedback'
  };
}

function toTransactionPersonalRule(row: unknown): PersonalQuickAddRule | null {
  if (!isRecord(row)) {
    return null;
  }
  const type = row.type;
  const note = row.note;
  const categories = row.categories;
  const categoryName = isRecord(categories) ? categories.name : null;
  if ((type !== 'INCOME' && type !== 'EXPENSE')
    || typeof note !== 'string'
    || note.trim() === ''
    || typeof categoryName !== 'string'
    || categoryName.trim() === '') {
    return null;
  }
  return {
    itemText: note.trim(),
    sourceText: note.trim(),
    type,
    categoryName: categoryName.trim(),
    source: 'transaction'
  };
}

function filterAvailablePersonalRules(
  rules: PersonalQuickAddRule[],
  visibleCategoriesByType: Record<TransactionType, string[]>
): PersonalQuickAddRule[] {
  return rules.filter((rule) => visibleCategoriesByType[rule.type].includes(rule.categoryName));
}

function findPersonalRule(
  item: AiCategoryServiceItem,
  suggestedItemText: string,
  rules: PersonalQuickAddRule[]
): PersonalQuickAddRule | null {
  const itemTexts = new Set([
    normalizeRuleText(suggestedItemText),
    normalizeRuleText(item.itemText),
    normalizeRuleText(item.sourceText)
  ].filter((text) => text !== ''));

  return rules.find((rule) => {
    const ruleTexts = [
      normalizeRuleText(rule.itemText),
      normalizeRuleText(rule.sourceText)
    ].filter((text) => text !== '');
    return ruleTexts.some((text) => [...itemTexts].some((itemText) => itemText === text
      || itemText.includes(text)
      || text.includes(itemText)));
  }) ?? null;
}

function findCategoryKeywordMapping(
  item: AiCategoryServiceItem,
  suggestedItemText: string,
  visibleCategoriesByType: Record<TransactionType, string[]>
): ResolvedMappedCategory | null {
  const itemTexts = [
    normalizeRuleText(item.sourceText),
    normalizeRuleText(item.itemText),
    normalizeRuleText(suggestedItemText)
  ].filter((text) => text !== '');
  const matches = (['EXPENSE', 'INCOME'] as const).flatMap((type) => visibleCategoriesByType[type]
    .filter((categoryName) => {
      const normalizedCategory = normalizeRuleText(categoryName);
      return normalizedCategory !== '' && itemTexts.some((text) => text.includes(normalizedCategory));
    })
    .map((categoryName) => ({ type, categoryName })));
  const modelTypeMatch = matches.find((match) => match.type === item.modelType);
  if (modelTypeMatch) {
    return {
      type: modelTypeMatch.type,
      categoryName: modelTypeMatch.categoryName,
      customCategoryName: null,
      mappingSource: 'exact_match'
    };
  }

  if (matches.length !== 1) {
    return null;
  }
  return {
    type: matches[0].type,
    categoryName: matches[0].categoryName,
    customCategoryName: null,
    mappingSource: 'exact_match'
  };
}

function normalizeSpacing(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildSuggestedItemText(item: AiCategoryServiceItem, parsedDate: ParsedTransactionDate): string {
  const textFromSource = cleanSuggestedItemText(parsedDate.remainingText);
  if (textFromSource) {
    return textFromSource;
  }

  return cleanSuggestedItemText(item.itemText) || item.itemText.trim();
}

function cleanSuggestedItemText(text: string): string {
  return normalizeSpacing(text)
    .replace(/(?:(?:\d{4})[-/])?\d{1,2}[-/]\d{1,2}/g, '')
    .replace(/今天|昨天|前天|明天/g, '')
    .replace(/[$＄]?\s*\d[\d,]*(?:\.\d+)?\s*(?:元|塊|台幣|NTD|TWD)?/gi, '')
    .replace(/^(?:我|我們|在|去|於|到|買了|吃了|喝了|付了|花了|消費|支出|收入|收到)+/g, '')
    .replace(/(?:花了|買了|吃了|喝了|付了|消費|支出|收入|收到|花|買|吃|喝|付)+$/g, '')
    .replace(/[，,。.\s]+$/g, '')
    .trim();
}

function normalizeRuleText(text: string | null | undefined): string {
  if (!text) {
    return '';
  }
  return cleanSuggestedItemText(text).toLocaleLowerCase('zh-Hant');
}

function toResolvedMapping(mapping: CategoryMappingRow, mappingSource: CategoryMappingSource): ResolvedMappedCategory {
  return {
    type: mapping.type,
    categoryName: mapping.categoryName,
    customCategoryName: null,
    mappingSource
  };
}
