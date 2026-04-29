<template>
  <main class="app-shell">
    <nav class="top-bar" aria-label="主要導覽">
      <strong>個人記帳系統</strong>
      <div class="nav-links">
        <button type="button">首頁</button>
        <button type="button" @click="showLoginRequired">歷史查看</button>
        <button type="button" @click="showLoginRequired">登入</button>
      </div>
    </nav>

    <section class="workspace" aria-label="首頁">
      <section class="entry-panel" aria-label="批次新增區">
        <h1>批次新增區</h1>
        <div class="entry-row">
          <select disabled>
            <option>支出</option>
          </select>
          <input type="date" disabled />
          <input type="number" placeholder="金額" disabled />
          <select disabled>
            <option>飲食</option>
          </select>
          <input type="text" placeholder="備註" disabled />
        </div>
        <div class="actions">
          <button type="button" @click="showLoginRequired">繼續新增下一筆</button>
          <button type="button" @click="showLoginRequired">送出</button>
        </div>
      </section>

      <section class="summary-panel" aria-label="近期資料">
        <section class="chart-panel">
          <div class="panel-header">
            <h2>類別摘要</h2>
            <div class="segmented">
              <button type="button" @click="showLoginRequired">支出類別</button>
              <button type="button" @click="showLoginRequired">收入類別</button>
            </div>
          </div>
          <div class="empty-chart">未登入時不顯示真實資料</div>
        </section>

        <section class="details-panel">
          <h2>最近明細</h2>
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
              <tr>
                <td colspan="6">請先登入</td>
              </tr>
            </tbody>
          </table>
          <button type="button" @click="showLoginRequired">查看更多</button>
        </section>
      </section>
    </section>

    <p v-if="message" class="message" role="status">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const message = ref('');

function showLoginRequired() {
  message.value = '請先登入';
}
</script>
