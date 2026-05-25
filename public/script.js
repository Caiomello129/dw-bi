/* ═══════════════════════════════════════════════════════════════════
   DataWare · Sales Intelligence
   script.js — ETL + MYSQL API VERSION

   ARQUITETURA:
   MySQL → Node.js API → Dashboard Front-End

   ETL:
   1. EXTRACT   → API/MySQL
   2. TRANSFORM → Processamento analítico
   3. LOAD      → Dashboard/UI
═══════════════════════════════════════════════════════════════════ */


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONFIGURAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const API_URL = '/api/vendas';

const CATEGORIAS = [
  'Lanche',
  'Bebida',
  'Sobremesa'
];


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ① EXTRACT — MYSQL/API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * extractData()
 * Busca dados diretamente da API Node.js
 * conectada ao MySQL.
 */
async function extractData() {

  console.log(
    '%c[EXTRACT] Buscando dados do MySQL...',
    'color:#00e5a0'
  );

  try {

    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    console.log(
      `%c[EXTRACT] ${data.length} registros carregados.`,
      'color:#00e5a0'
    );

    return data;

  } catch (error) {

    console.error('[EXTRACT] Erro:', error);

    alert(
      'Erro ao carregar dados da API/MySQL.\n\n' +
      'Verifique se o servidor Node.js está rodando.'
    );

    return [];
  }
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ② TRANSFORM — PROCESSAMENTO ANALÍTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function transformData(registros) {

  console.log(
    '%c[TRANSFORM] Processando dados...',
    'color:#7c6bff'
  );

  if (!registros.length) {
    return {
      kpis: {},
      charts: {},
      tabela: []
    };
  }

  /* KPIs */

  const faturamentoTotal = registros.reduce(
    (acc, r) => acc + Number(r.valor),
    0
  );

  const totalVendas = registros.length;

  const ticketMedio = faturamentoTotal / totalVendas;


  /* PRODUTOS */

  const porProduto = {};

  registros.forEach(r => {

    if (!porProduto[r.produto]) {
      porProduto[r.produto] = {
        quantidade: 0,
        faturamento: 0,
        categoria: r.categoria
      };
    }

    porProduto[r.produto].quantidade += Number(r.quantidade);

    porProduto[r.produto].faturamento += Number(r.valor);
  });

  const top5 = Object.entries(porProduto)
    .map(([nome, d]) => ({
      nome,
      ...d
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  const produtoMaisVendido = top5[0];


  /* CATEGORIAS */

  const porCategoria = {};

  CATEGORIAS.forEach(cat => {
    porCategoria[cat] = {
      faturamento: 0,
      quantidade: 0
    };
  });

  registros.forEach(r => {

    if (!porCategoria[r.categoria]) {
      porCategoria[r.categoria] = {
        faturamento: 0,
        quantidade: 0
      };
    }

    porCategoria[r.categoria].faturamento += Number(r.valor);

    porCategoria[r.categoria].quantidade += Number(r.quantidade);
  });


  /* FATURAMENTO POR DIA */

  const porDia = {};

  registros.forEach(r => {

    if (!porDia[r.data]) {
      porDia[r.data] = 0;
    }

    porDia[r.data] += Number(r.valor);
  });

  const diasOrdenados = Object.keys(porDia).sort();

  const vendasPorDia = diasOrdenados.map(d => ({
    data: d,
    label: formatarDataCurta(d),
    faturamento: Number(porDia[d].toFixed(2))
  }));


  /* MELHOR DIA */

  const melhorDia = vendasPorDia.reduce(
    (a, b) => a.faturamento > b.faturamento ? a : b,
    vendasPorDia[0]
  );

  console.log(
    '%c[TRANSFORM] Dados processados.',
    'color:#7c6bff'
  );

  return {

    kpis: {
      faturamentoTotal,
      totalVendas,
      ticketMedio,
      produtoMaisVendido,
      melhorDia
    },

    charts: {
      vendasPorDia,
      porCategoria,
      top5
    },

    tabela: registros
  };
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ③ LOAD — DASHBOARD/UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

let chartLine;
let chartDoughnut;
let chartBar;

let tabelaOffset = 0;

const TABELA_PAGE_SIZE = 15;

let dadosTabela = [];


function loadDashboard(mart) {

  console.log(
    '%c[LOAD] Renderizando dashboard...',
    'color:#ff6b6b'
  );

  renderKPIs(mart.kpis);

  renderLineChart(mart.charts.vendasPorDia);

  renderDoughnutChart(mart.charts.porCategoria);

  renderBarChart(mart.charts.top5);

  renderCategoryBars(
    mart.charts.porCategoria,
    mart.kpis.faturamentoTotal
  );

  dadosTabela = mart.tabela;

  tabelaOffset = 0;

  renderTabela(true);

  document.getElementById('totalRecords').textContent =
    `${mart.tabela.length} registros`;

  const now = new Date();

  document.getElementById('lastUpdated').textContent =
    `Atualizado às ${now.toLocaleTimeString('pt-BR')}`;

  console.log(
    '%c[LOAD] Dashboard renderizado.',
    'color:#ff6b6b'
  );
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   KPI CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderKPIs(kpis) {

  const container = document.getElementById('kpiCards');

  const cards = [

    {
      label: 'Faturamento Total',
      value: formatCurrency(kpis.faturamentoTotal),
      sub: `${kpis.totalVendas} transações`,
      icon: '💰',
      color: 'green'
    },

    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      sub: 'por venda',
      icon: '🎯',
      color: 'blue'
    },

    {
      label: 'Produto Mais Vendido',
      value: kpis.produtoMaisVendido?.nome || '—',
      sub: `${kpis.produtoMaisVendido?.quantidade || 0} unidades`,
      icon: '🏆',
      color: 'orange'
    },

    {
      label: 'Melhor Dia',
      value: kpis.melhorDia?.label || '—',
      sub: formatCurrency(kpis.melhorDia?.faturamento || 0),
      icon: '📅',
      color: 'purple'
    },

    {
      label: 'Total de Registros',
      value: String(kpis.totalVendas),
      sub: 'vendas processadas',
      icon: '📊',
      color: 'red'
    }
  ];

  container.innerHTML = cards.map(c => `
    <div class="kpi-card ${c.color}">
      <div class="kpi-icon">${c.icon}</div>

      <p class="kpi-label">${c.label}</p>

      <p class="kpi-value">
        ${c.value}
      </p>

      <p class="kpi-sub">
        ${c.sub}
      </p>
    </div>
  `).join('');
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GRÁFICO LINHA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderLineChart(vendasPorDia) {

  if (chartLine) {
    chartLine.destroy();
  }

  const ctx =
    document.getElementById('lineChart').getContext('2d');

  chartLine = new Chart(ctx, {

    type: 'line',

    data: {

      labels: vendasPorDia.map(d => d.label),

      datasets: [{
        label: 'Faturamento',
        data: vendasPorDia.map(d => d.faturamento),
        borderColor: '#00e5a0',
        backgroundColor: 'rgba(0,229,160,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      }]
    },

    options: {

      responsive: true,

      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GRÁFICO ROSCA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderDoughnutChart(porCategoria) {

  if (chartDoughnut) {
    chartDoughnut.destroy();
  }

  const ctx =
    document.getElementById('doughnutChart').getContext('2d');

  const labels = Object.keys(porCategoria);

  const valores = labels.map(
    c => porCategoria[c].faturamento
  );

  chartDoughnut = new Chart(ctx, {

    type: 'doughnut',

    data: {

      labels,

      datasets: [{

        data: valores,

        backgroundColor: [
          '#00e5a0',
          '#7c6bff',
          '#ff6b6b'
        ]
      }]
    }
  });
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GRÁFICO BARRAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderBarChart(top5) {

  if (chartBar) {
    chartBar.destroy();
  }

  const ctx =
    document.getElementById('barChart').getContext('2d');

  chartBar = new Chart(ctx, {

    type: 'bar',

    data: {

      labels: top5.map(p => p.nome),

      datasets: [{

        label: 'Quantidade',

        data: top5.map(p => p.quantidade),

        backgroundColor: [
          '#00e5a0',
          '#7c6bff',
          '#ff6b6b',
          '#ffb86b',
          '#6bc5ff'
        ]
      }]
    }
  });
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BARRAS CUSTOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderCategoryBars(
  porCategoria,
  totalFaturamento
) {

  const container =
    document.getElementById('categoryBars');

  const cores = {
    Lanche: '#00e5a0',
    Bebida: '#7c6bff',
    Sobremesa: '#ff6b6b'
  };

  container.innerHTML = Object.keys(porCategoria).map(cat => {

    const pct =
      (
        porCategoria[cat].faturamento /
        totalFaturamento
      ) * 100;

    return `
      <div class="cat-bar-wrap">

        <div class="cat-bar-info">

          <span>
            ${cat}
          </span>

          <span>
            ${formatCurrency(porCategoria[cat].faturamento)}
          </span>

        </div>

        <div class="cat-bar-track">

          <div
            class="cat-bar-fill"
            style="
              width:${pct}%;
              background:${cores[cat]}
            ">
          </div>

        </div>

      </div>
    `;
  }).join('');
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TABELA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function renderTabela(reset = false) {

  const tbody =
    document.getElementById('tableBody');

  if (reset) {
    tbody.innerHTML = '';
  }

  const slice = dadosTabela.slice(
    tabelaOffset,
    tabelaOffset + TABELA_PAGE_SIZE
  );

  tabelaOffset += slice.length;

  slice.forEach(r => {

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${formatarDataCurta(r.data)}</td>

      <td>${r.produto}</td>

      <td>${r.categoria}</td>

      <td>${r.quantidade}</td>

      <td>${formatCurrency(Number(r.valor))}</td>
    `;

    tbody.appendChild(tr);
  });

  const btn =
    document.getElementById('loadMoreBtn');

  btn.style.display =
    tabelaOffset >= dadosTabela.length
      ? 'none'
      : 'block';
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function formatCurrency(v) {

  return Number(v).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL'
    }
  );
}

function formatarDataCurta(iso) {

  const date = new Date(iso);

  return date.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: 'short'
    }
  );
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FILTROS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

let rawData = [];

function aplicarFiltros() {

  const categoria =
    document.getElementById('filterCategoria').value;

  const periodo =
    document.getElementById('filterPeriodo').value;

  let filtrado = [...rawData];

  if (categoria) {

    filtrado = filtrado.filter(
      r => r.categoria === categoria
    );
  }

  if (periodo !== 'todos') {

    const dias = Number(periodo);

    const limite = new Date();

    limite.setDate(
      limite.getDate() - dias
    );

    filtrado = filtrado.filter(
      r => new Date(r.data) >= limite
    );
  }

  const mart = transformData(filtrado);

  loadDashboard(mart);
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function init() {

  console.group(
    '%c⚡ DataWare ETL',
    'font-weight:bold;color:#00e5a0'
  );

  rawData = await extractData();

  const mart = transformData(rawData);

  loadDashboard(mart);

  console.groupEnd();
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EVENTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    init();

    document
      .getElementById('applyFilter')
      .addEventListener(
        'click',
        aplicarFiltros
      );

    document
      .getElementById('loadMoreBtn')
      .addEventListener(
        'click',
        () => renderTabela(false)
      );

    document
      .getElementById('refreshBtn')
      .addEventListener(
        'click',
        init
      );
  }
);