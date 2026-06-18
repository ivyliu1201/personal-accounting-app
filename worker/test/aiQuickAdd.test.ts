import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuickAddParseResponse,
  callAiCategoryService,
  parseTransactionDateFromText,
  parseQuickAddRequest,
  resolveMappedCategory,
  validateQuickAddParseRequest
} from '../src/aiQuickAdd';
import type { AuthenticatedUser } from '../src/auth';

test('parseTransactionDateFromText parses relative dates', () => {
  assert.deepEqual(parseTransactionDateFromText('昨天早餐100', '2026-06-17'), {
    transactionDate: '2026-06-16',
    dateSource: 'relative_date',
    remainingText: '早餐100'
  });

  assert.deepEqual(parseTransactionDateFromText('前天飲料60', '2026-06-17'), {
    transactionDate: '2026-06-15',
    dateSource: 'relative_date',
    remainingText: '飲料60'
  });

  assert.deepEqual(parseTransactionDateFromText('明天薪水50000', '2026-06-17'), {
    transactionDate: '2026-06-18',
    dateSource: 'relative_date',
    remainingText: '薪水50000'
  });
});

test('parseTransactionDateFromText parses explicit dates', () => {
  assert.deepEqual(parseTransactionDateFromText('6/18 捷運30', '2026-06-17'), {
    transactionDate: '2026-06-18',
    dateSource: 'explicit_date',
    remainingText: '捷運30'
  });

  assert.deepEqual(parseTransactionDateFromText('2026-06-18 晚餐260', '2026-06-17'), {
    transactionDate: '2026-06-18',
    dateSource: 'explicit_date',
    remainingText: '晚餐260'
  });
});

test('parseTransactionDateFromText defaults to today when text has no date', () => {
  assert.deepEqual(parseTransactionDateFromText('早餐100', '2026-06-17'), {
    transactionDate: '2026-06-17',
    dateSource: 'default_today',
    remainingText: '早餐100'
  });
});

test('resolveMappedCategory prefers user mapping before global mapping', () => {
  const result = resolveMappedCategory({
    modelLabel: 'expense::學習',
    modelType: 'EXPENSE',
    modelCategory: '學習',
    visibleCategories: ['自我成長', '投資'],
    userMappings: [
      { modelLabel: 'expense::學習', type: 'EXPENSE', categoryName: '投資' }
    ],
    globalMappings: [
      { modelLabel: 'expense::學習', type: 'EXPENSE', categoryName: '自我成長' }
    ]
  });

  assert.deepEqual(result, {
    type: 'EXPENSE',
    categoryName: '投資',
    customCategoryName: null,
    mappingSource: 'user_mapping'
  });
});

test('resolveMappedCategory uses global mapping before exact category match', () => {
  const result = resolveMappedCategory({
    modelLabel: 'expense::學習',
    modelType: 'EXPENSE',
    modelCategory: '學習',
    visibleCategories: ['學習', '自我成長'],
    userMappings: [],
    globalMappings: [
      { modelLabel: 'expense::學習', type: 'EXPENSE', categoryName: '自我成長' }
    ]
  });

  assert.deepEqual(result, {
    type: 'EXPENSE',
    categoryName: '自我成長',
    customCategoryName: null,
    mappingSource: 'global_mapping'
  });
});

test('resolveMappedCategory uses exact match when mapping is unavailable', () => {
  const result = resolveMappedCategory({
    modelLabel: 'expense::飲食',
    modelType: 'EXPENSE',
    modelCategory: '飲食',
    visibleCategories: ['飲食', '交通'],
    userMappings: [],
    globalMappings: []
  });

  assert.deepEqual(result, {
    type: 'EXPENSE',
    categoryName: '飲食',
    customCategoryName: null,
    mappingSource: 'exact_match'
  });
});

test('resolveMappedCategory suggests custom category when no category exists', () => {
  const result = resolveMappedCategory({
    modelLabel: 'expense::保險',
    modelType: 'EXPENSE',
    modelCategory: '保險',
    visibleCategories: ['飲食'],
    userMappings: [],
    globalMappings: []
  });

  assert.deepEqual(result, {
    type: 'EXPENSE',
    categoryName: '__CUSTOM__',
    customCategoryName: '保險',
    mappingSource: 'suggested_custom_category'
  });
});

test('validateQuickAddParseRequest returns trimmed text', () => {
  assert.equal(validateQuickAddParseRequest({ text: '  昨天早餐100  ' }), '昨天早餐100');
});

test('validateQuickAddParseRequest rejects missing text', () => {
  assert.throws(
    () => validateQuickAddParseRequest({ text: '' }),
    (error: unknown) => error instanceof RangeError && error.message === 'Quick add text is required'
  );
});

test('buildQuickAddParseResponse maps AI items to app suggestions', () => {
  const response = buildQuickAddParseResponse({
    aiResponse: {
      items: [
        {
          sourceText: '昨天早餐100',
          itemText: '早餐',
          amount: 100,
          modelType: 'EXPENSE',
          modelCategory: '飲食',
          modelLabel: 'expense::飲食',
          confidence: 0.91,
          needsReview: false
        },
        {
          sourceText: '6/18 線上課程1200',
          itemText: '線上課程',
          amount: 1200,
          modelType: 'EXPENSE',
          modelCategory: '學習',
          modelLabel: 'expense::學習',
          confidence: 0.76,
          needsReview: true
        }
      ],
      unparsedItems: ['沒有金額的備註']
    },
    today: '2026-06-17',
    visibleCategoriesByType: {
      EXPENSE: ['飲食', '自我成長'],
      INCOME: ['薪資']
    },
    userMappings: [],
    globalMappings: [
      { modelLabel: 'expense::學習', type: 'EXPENSE', categoryName: '自我成長' }
    ],
    createSuggestionId: () => 'suggestion-1'
  });

  assert.deepEqual(response, {
    suggestions: [
      {
        suggestionId: 'suggestion-1',
        sourceText: '昨天早餐100',
        itemText: '早餐',
        type: 'EXPENSE',
        transactionDate: '2026-06-16',
        amount: 100,
        categoryName: '飲食',
        customCategoryName: null,
        needsReview: false,
        confidence: 0.91,
        modelLabel: 'expense::飲食',
        modelType: 'EXPENSE',
        modelCategory: '飲食',
        mappedType: 'EXPENSE',
        mappedCategoryName: '飲食',
        suggestedTransactionDate: '2026-06-16',
        suggestedAmount: 100,
        suggestedNote: '早餐',
        mappingSource: 'exact_match',
        dateSource: 'relative_date'
      },
      {
        suggestionId: 'suggestion-1',
        sourceText: '6/18 線上課程1200',
        itemText: '線上課程',
        type: 'EXPENSE',
        transactionDate: '2026-06-18',
        amount: 1200,
        categoryName: '自我成長',
        customCategoryName: null,
        needsReview: true,
        confidence: 0.76,
        modelLabel: 'expense::學習',
        modelType: 'EXPENSE',
        modelCategory: '學習',
        mappedType: 'EXPENSE',
        mappedCategoryName: '自我成長',
        suggestedTransactionDate: '2026-06-18',
        suggestedAmount: 1200,
        suggestedNote: '線上課程',
        mappingSource: 'global_mapping',
        dateSource: 'explicit_date'
      }
    ],
    unparsedItems: ['沒有金額的備註']
  });
});

test('buildQuickAddParseResponse cleans date amount and filler words from suggested note', () => {
  const response = buildQuickAddParseResponse({
    aiResponse: {
      items: [{
        sourceText: '今天麥當勞花了100元',
        itemText: '今天麥當勞花了',
        amount: 100,
        modelType: 'EXPENSE',
        modelCategory: '飲食',
        modelLabel: 'expense::飲食',
        confidence: 0.82,
        needsReview: true
      }],
      unparsedItems: []
    },
    today: '2026-06-17',
    visibleCategoriesByType: {
      EXPENSE: ['飲食'],
      INCOME: ['薪資']
    },
    userMappings: [],
    globalMappings: [],
    createSuggestionId: () => 'suggestion-1'
  });

  assert.equal(response.suggestions[0].itemText, '麥當勞');
  assert.equal(response.suggestions[0].suggestedNote, '麥當勞');
  assert.equal(response.suggestions[0].transactionDate, '2026-06-17');
});

test('buildQuickAddParseResponse creates suggestion id without injected id factory', () => {
  const response = buildQuickAddParseResponse({
    aiResponse: {
      items: [{
        sourceText: '早餐100',
        itemText: '早餐',
        amount: 100,
        modelType: 'EXPENSE',
        modelCategory: '飲食',
        modelLabel: 'expense::飲食',
        confidence: 0.91,
        needsReview: false
      }],
      unparsedItems: []
    },
    today: '2026-06-17',
    visibleCategoriesByType: {
      EXPENSE: ['飲食'],
      INCOME: ['薪資']
    },
    userMappings: [],
    globalMappings: []
  });

  assert.equal(typeof response.suggestions[0].suggestionId, 'string');
  assert.ok(response.suggestions[0].suggestionId.length > 0);
});

test('callAiCategoryService sends text to configured service', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const response = await callAiCategoryService(
    'https://ai.example.test/',
    'secret-token',
    '早餐100',
    async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ items: [], unparsedItems: [] }), { status: 200 });
    }
  );

  assert.deepEqual(response, { items: [], unparsedItems: [] });
  assert.equal(calls[0].url, 'https://ai.example.test/parse');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer secret-token');
  assert.equal(calls[0].init.body, JSON.stringify({ text: '早餐100' }));
});

test('parseQuickAddRequest builds suggestions from AI service response', async () => {
  const user: AuthenticatedUser = {
    userId: 'firebase-user-1',
    email: 'user@example.test'
  };

  const response = await parseQuickAddRequest({
    env: {
      AI_CATEGORY_SERVICE_URL: 'https://ai.example.test'
    },
    user,
    body: { text: '昨天早餐100' },
    today: '2026-06-17',
    listVisibleCategoryNames: async (type) => type === 'EXPENSE' ? ['飲食'] : ['薪資'],
    callAiService: async () => ({
      items: [
        {
          sourceText: '昨天早餐100',
          itemText: '早餐',
          amount: 100,
          modelType: 'EXPENSE',
          modelCategory: '飲食',
          modelLabel: 'expense::飲食',
          confidence: 0.91,
          needsReview: false
        }
      ],
      unparsedItems: []
    }),
    createSuggestionId: () => 'suggestion-1'
  });

  assert.equal(user.userId, 'firebase-user-1');
  assert.deepEqual(response.suggestions, [
    {
      suggestionId: 'suggestion-1',
      sourceText: '昨天早餐100',
      itemText: '早餐',
      type: 'EXPENSE',
      transactionDate: '2026-06-16',
      amount: 100,
      categoryName: '飲食',
      customCategoryName: null,
      needsReview: false,
      confidence: 0.91,
      modelLabel: 'expense::飲食',
      modelType: 'EXPENSE',
      modelCategory: '飲食',
      mappedType: 'EXPENSE',
      mappedCategoryName: '飲食',
      suggestedTransactionDate: '2026-06-16',
      suggestedAmount: 100,
      suggestedNote: '早餐',
      mappingSource: 'exact_match',
      dateSource: 'relative_date'
    }
  ]);
});

test('parseQuickAddRequest applies personal corrected feedback rules before returning suggestions', async () => {
  const response = await parseQuickAddRequest({
    env: {
      AI_CATEGORY_SERVICE_URL: 'https://ai.example.test'
    },
    user: { userId: 'firebase-user-1', email: 'user@example.test' },
    body: { text: '中獎100' },
    today: '2026-06-17',
    listVisibleCategoryNames: async (type) => type === 'EXPENSE' ? ['飲食'] : ['投資', '薪資'],
    loadPersonalRules: async () => [
      {
        itemText: '中獎',
        sourceText: '中獎100',
        type: 'INCOME',
        categoryName: '投資'
      }
    ],
    callAiService: async () => ({
      items: [
        {
          sourceText: '中獎100',
          itemText: '中獎',
          amount: 100,
          modelType: 'EXPENSE',
          modelCategory: '飲食',
          modelLabel: 'expense::飲食',
          confidence: 0.7,
          needsReview: true
        }
      ],
      unparsedItems: []
    }),
    createSuggestionId: () => 'suggestion-1'
  });

  assert.deepEqual(response.suggestions[0], {
    suggestionId: 'suggestion-1',
    sourceText: '中獎100',
    itemText: '中獎',
    type: 'INCOME',
    transactionDate: '2026-06-17',
    amount: 100,
    categoryName: '投資',
    customCategoryName: null,
    needsReview: false,
    confidence: 0.7,
    modelLabel: 'expense::飲食',
    modelType: 'EXPENSE',
    modelCategory: '飲食',
    mappedType: 'INCOME',
    mappedCategoryName: '投資',
    suggestedTransactionDate: '2026-06-17',
    suggestedAmount: 100,
    suggestedNote: '中獎',
    mappingSource: 'user_mapping',
    dateSource: 'default_today'
  });
});

test('parseQuickAddRequest applies bootstrap text rules for common examples', async () => {
  const response = await parseQuickAddRequest({
    env: {
      AI_CATEGORY_SERVICE_URL: 'https://ai.example.test'
    },
    user: { userId: 'firebase-user-1', email: 'user@example.test' },
    body: { text: '吃飯100 搭車35' },
    today: '2026-06-17',
    listVisibleCategoryNames: async (type) => type === 'EXPENSE' ? ['飲食', '交通'] : ['薪資'],
    callAiService: async () => ({
      items: [
        {
          sourceText: '吃飯100',
          itemText: '吃飯',
          amount: 100,
          modelType: 'EXPENSE',
          modelCategory: '交通',
          modelLabel: 'expense::交通',
          confidence: 0.68,
          needsReview: true
        },
        {
          sourceText: '搭車35',
          itemText: '搭車',
          amount: 35,
          modelType: 'EXPENSE',
          modelCategory: '飲食',
          modelLabel: 'expense::飲食',
          confidence: 0.68,
          needsReview: true
        }
      ],
      unparsedItems: []
    }),
    createSuggestionId: () => 'suggestion-1'
  });

  assert.equal(response.suggestions[0].type, 'EXPENSE');
  assert.equal(response.suggestions[0].categoryName, '飲食');
  assert.equal(response.suggestions[0].mappedCategoryName, '飲食');
  assert.equal(response.suggestions[0].mappingSource, 'user_mapping');
  assert.equal(response.suggestions[0].needsReview, false);
  assert.equal(response.suggestions[1].type, 'EXPENSE');
  assert.equal(response.suggestions[1].categoryName, '交通');
  assert.equal(response.suggestions[1].mappedCategoryName, '交通');
  assert.equal(response.suggestions[1].mappingSource, 'user_mapping');
  assert.equal(response.suggestions[1].needsReview, false);
});

test('parseQuickAddRequest applies previous successful transaction notes when feedback is empty', async () => {
  const response = await parseQuickAddRequest({
    env: {
      AI_CATEGORY_SERVICE_URL: 'https://ai.example.test'
    },
    user: { userId: 'firebase-user-1', email: 'user@example.test' },
    body: { text: '中獎100' },
    today: '2026-06-18',
    supabase: new FakePersonalRuleSupabase() as never,
    listVisibleCategoryNames: async (type) => type === 'EXPENSE' ? ['飲食'] : ['中獎', '薪資'],
    callAiService: async () => ({
      items: [
        {
          sourceText: '中獎100',
          itemText: '中獎',
          amount: 100,
          modelType: 'EXPENSE',
          modelCategory: '飲食',
          modelLabel: 'expense::飲食',
          confidence: 0.7,
          needsReview: true
        }
      ],
      unparsedItems: []
    }),
    createSuggestionId: () => 'suggestion-1'
  });

  assert.equal(response.suggestions[0].type, 'INCOME');
  assert.equal(response.suggestions[0].categoryName, '中獎');
  assert.equal(response.suggestions[0].mappedCategoryName, '中獎');
  assert.equal(response.suggestions[0].mappingSource, 'user_mapping');
  assert.equal(response.suggestions[0].needsReview, false);
});

test('parseQuickAddRequest applies previous successful expense note correction for ball games', async () => {
  const response = await parseQuickAddRequest({
    env: {
      AI_CATEGORY_SERVICE_URL: 'https://ai.example.test'
    },
    user: { userId: 'firebase-user-1', email: 'user@example.test' },
    body: { text: '打球200' },
    today: '2026-06-18',
    supabase: new FakePersonalRuleSupabase() as never,
    listVisibleCategoryNames: async (type) => type === 'EXPENSE' ? ['治裝費', '運動'] : ['薪資'],
    callAiService: async () => ({
      items: [
        {
          sourceText: '打球200',
          itemText: '打球',
          amount: 200,
          modelType: 'EXPENSE',
          modelCategory: '治裝費',
          modelLabel: 'expense::治裝費',
          confidence: 0.7,
          needsReview: true
        }
      ],
      unparsedItems: []
    }),
    createSuggestionId: () => 'suggestion-1'
  });

  assert.equal(response.suggestions[0].type, 'EXPENSE');
  assert.equal(response.suggestions[0].categoryName, '運動');
  assert.equal(response.suggestions[0].mappedCategoryName, '運動');
  assert.equal(response.suggestions[0].mappingSource, 'user_mapping');
  assert.equal(response.suggestions[0].needsReview, false);
});

test('parseQuickAddRequest prefers visible category keyword in source text over wrong model category', async () => {
  const response = await parseQuickAddRequest({
    env: {
      AI_CATEGORY_SERVICE_URL: 'https://ai.example.test'
    },
    user: { userId: 'firebase-user-1', email: 'user@example.test' },
    body: { text: '昨天運動300' },
    today: '2026-06-18',
    listVisibleCategoryNames: async (type) => type === 'EXPENSE' ? ['治裝費', '運動'] : ['薪資'],
    callAiService: async () => ({
      items: [
        {
          sourceText: '昨天運動300',
          itemText: '運動',
          amount: 300,
          modelType: 'EXPENSE',
          modelCategory: '治裝費',
          modelLabel: 'expense::治裝費',
          confidence: 0.72,
          needsReview: true
        }
      ],
      unparsedItems: []
    }),
    createSuggestionId: () => 'suggestion-1'
  });

  assert.equal(response.suggestions[0].type, 'EXPENSE');
  assert.equal(response.suggestions[0].categoryName, '運動');
  assert.equal(response.suggestions[0].mappedCategoryName, '運動');
  assert.equal(response.suggestions[0].mappingSource, 'exact_match');
  assert.equal(response.suggestions[0].needsReview, false);
});

test('parseQuickAddRequest rejects missing AI service URL', async () => {
  await assert.rejects(
    () => parseQuickAddRequest({
      env: {},
      user: { userId: 'firebase-user-1', email: 'user@example.test' },
      body: { text: '早餐100' },
      today: '2026-06-17',
      listVisibleCategoryNames: async () => [],
      callAiService: async () => ({ items: [], unparsedItems: [] })
    }),
    (error: unknown) => error instanceof Error && error.message === 'AI category service is not configured'
  );
});

class FakePersonalRuleQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  constructor(private readonly tableName: string) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const data = this.tableName === 'ai_quick_add_feedback'
      ? []
      : [
          {
            note: '中獎',
            type: 'INCOME',
            categories: { name: '中獎' }
          },
          {
            note: '打球',
            type: 'EXPENSE',
            categories: { name: '運動' }
          }
        ];
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

class FakePersonalRuleSupabase {
  from(tableName: string) {
    return new FakePersonalRuleQuery(tableName);
  }
}
