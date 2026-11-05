/**
 * Banking Transactions Analysis System
 * Frontend Controller, Chart.js Integration, and Financial Analytics Engine
 */

// Global Application State
const state = {
    summary: {},
    analytics: {},
    alerts: [],
    customers: [],
    accounts: [],
    transactions: [],
    filteredTransactions: [],
    selectedAccount: null,
    chartInstances: {},
    pendingDeleteAction: null
};

// ==========================================
// Initialization & Event Listeners
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupForms();
    setupFilters();
    setupAccountSelector();
    setupWithdrawValidation();
    setupModalListeners();

    // Initial Data Synchronization
    refreshAllData();

    // Global refresh button
    document.getElementById('btn-refresh-all')?.addEventListener('click', () => {
        refreshAllData(true);
    });

    // CSV Export button
    document.getElementById('btn-export-csv')?.addEventListener('click', exportTransactionsCSV);
});

// ==========================================
// Navigation & Tab Switching
// ==========================================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTab = link.getAttribute('data-tab');
            switchTab(targetTab);
            if (navMenu && navMenu.classList.contains('mobile-open')) {
                navMenu.classList.remove('mobile-open');
            }
        });
    });

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('mobile-open');
        });
    }
}

function switchTab(tabId) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-tab') === tabId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update active tab pane
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // If switching to dashboard or analytics, resize charts smoothly
    if (tabId === 'tab-dashboard' || tabId === 'tab-analytics') {
        setTimeout(() => {
            Object.values(state.chartInstances).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }, 150);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.switchTab = switchTab;

// ==========================================
// Comprehensive Data Refresh
// ==========================================

async function refreshAllData(showNotification = false) {
    const refreshBtn = document.getElementById('btn-refresh-all');
    if (refreshBtn) {
        refreshBtn.classList.add('fa-spin');
    }

    try {
        await Promise.all([
            fetchDashboard(),
            fetchAnalytics(),
            fetchAlerts(),
            fetchCustomers(),
            fetchAccounts(),
            fetchTransactions()
        ]);

        if (showNotification) {
            showToast('Synchronized', 'Live SQLite database records updated.', 'success');
        }
    } catch (err) {
        console.error('Data synchronization error:', err);
        showToast('Sync Error', 'Unable to retrieve latest database records.', 'error');
    } finally {
        if (refreshBtn) {
            refreshBtn.classList.remove('fa-spin');
        }
    }
}

// ==========================================
// 1. Dashboard Metrics & Stream
// ==========================================

async function fetchDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        if (data.success && data.summary) {
            state.summary = data.summary;
            renderDashboardStats(data.summary);
            renderRecentTransactions(data.recent_transactions || []);
        }
    } catch (err) {
        console.error('Error fetching dashboard summary:', err);
    }
}

function renderDashboardStats(summary) {
    document.getElementById('stat-total-balance').textContent = formatCurrency(summary.total_balance || 0);
    document.getElementById('stat-total-customers').textContent = (summary.total_customers || 0).toLocaleString('en-IN');
    document.getElementById('stat-total-accounts').textContent = (summary.total_accounts || 0).toLocaleString('en-IN');
    document.getElementById('stat-total-deposits').textContent = formatCurrency(summary.total_deposits || 0);
    document.getElementById('stat-deposit-count').textContent = `${(summary.total_deposit_count || 0)} transactions`;
    document.getElementById('stat-total-withdrawals').textContent = formatCurrency(summary.total_withdrawals || 0);
    document.getElementById('stat-withdrawal-count').textContent = `${(summary.total_withdrawal_count || 0)} transactions`;

    // Cashflow Distribution bar calculation
    const totalFlow = (summary.total_deposits || 0) + (summary.total_withdrawals || 0);
    let depositPct = 50;
    let withdrawPct = 50;

    if (totalFlow > 0) {
        depositPct = Math.round((summary.total_deposits / totalFlow) * 100);
        withdrawPct = 100 - depositPct;
    }

    const barDep = document.getElementById('bar-deposits');
    const barWth = document.getElementById('bar-withdrawals');
    if (barDep && barWth) {
        barDep.style.width = `${depositPct}%`;
        barWth.style.width = `${withdrawPct}%`;
    }

    document.getElementById('legend-deposit-val').textContent = formatCurrency(summary.total_deposits || 0);
    document.getElementById('legend-withdraw-val').textContent = formatCurrency(summary.total_withdrawals || 0);
}

function renderRecentTransactions(transactions) {
    const tbody = document.getElementById('recent-transactions-tbody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>No transactions recorded yet.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(txn => {
        const isDeposit = txn.transaction_type === 'Deposit';
        const badgeClass = isDeposit ? 'badge-deposit' : 'badge-withdrawal';
        const icon = isDeposit ? 'fa-arrow-down-long' : 'fa-arrow-up-long';
        const amountClass = isDeposit ? 'text-success' : 'text-danger';
        const prefix = isDeposit ? '+' : '-';

        return `
            <tr>
                <td>
                    <span class="badge ${badgeClass}">
                        <i class="fa-solid ${icon}"></i> ${escapeHtml(txn.transaction_type)}
                    </span>
                </td>
                <td><span class="account-badge">${escapeHtml(txn.account_number)}</span></td>
                <td><strong>${escapeHtml(txn.customer_name || 'N/A')}</strong></td>
                <td><strong class="${amountClass}">${prefix}${formatCurrency(txn.amount)}</strong></td>
                <td><small class="text-muted">${formatDate(txn.timestamp)}</small></td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// Chart.js Custom Percentage Data Labels Plugin
// ==========================================

const pieDatalabelsPlugin = {
    id: 'pieDatalabels',
    afterDatasetsDraw(chart) {
        if (chart.config.type !== 'doughnut' && chart.config.type !== 'pie') return;
        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            if (!meta || !meta.data) return;
            const total = dataset.data.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            if (total <= 0) return;

            meta.data.forEach((element, index) => {
                const val = parseFloat(dataset.data[index]) || 0;
                if (val <= 0) return;
                const ratio = val / total;
                // Only render text label if slice is at least 4.5% of total
                if (ratio < 0.045) return;

                const pct = (ratio * 100).toFixed(1) + '%';
                const pos = element.tooltipPosition();
                if (!pos || isNaN(pos.x) || isNaN(pos.y)) return;

                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
                ctx.fillText(pct, pos.x, pos.y);
                ctx.restore();
            });
        });
    }
};

if (typeof Chart !== 'undefined') {
    Chart.register(pieDatalabelsPlugin);
}

// ==========================================
// 2. Financial Analytics & Chart.js Engine
// ==========================================

async function fetchAnalytics(notify = false) {
    try {
        const response = await fetch('/api/analytics');
        const data = await response.json();

        if (data.success) {
            state.analytics = data;
            renderCharts(data);
            renderTopAccounts(data.top_accounts || []);
            renderKeyRatios(data);

            if (notify) {
                showToast('Analytics Updated', 'Rendered latest financial charts from SQLite records.', 'success');
            }
        }
    } catch (err) {
        console.error('Error fetching analytics feeds:', err);
    }
}

function renderCharts(data) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library not loaded.');
        return;
    }

    const monthly = data.monthly_comparison || { months: [], deposits: [], withdrawals: [], net_flow: [], deposit_counts: [], withdrawal_counts: [] };
    const dist = data.distribution || { deposit_total: 0, withdrawal_total: 0, deposit_count: 0, withdrawal_count: 0 };
    const accTypes = data.account_types || { labels: [], counts: [], balances: [] };

    // Format month labels (e.g. "2026-11" -> "Nov 2026")
    const formattedMonths = (monthly.months || []).map(m => {
        if (!m) return '';
        const parts = m.split('-');
        if (parts.length === 2) {
            const date = new Date(parts[0], parseInt(parts[1], 10) - 1, 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        return m;
    });

    // -------------------------------------------------------------
    // CHART 1: Colourful Doughnut Chart (Deposits vs. Withdrawals)
    // -------------------------------------------------------------
    const distTotal = (dist.deposit_total || 0) + (dist.withdrawal_total || 0);
    const hasDistData = distTotal > 0;

    const emptyDistEl = document.getElementById('empty-dist-doughnut');
    const wrapDistEl = document.getElementById('wrapper-dist-doughnut');
    const legDistEl = document.getElementById('legend-dist-doughnut');

    if (hasDistData) {
        if (emptyDistEl) emptyDistEl.classList.remove('active');
        if (wrapDistEl) wrapDistEl.style.display = 'block';
        if (legDistEl) legDistEl.style.display = 'flex';

        const depPct = ((dist.deposit_total / distTotal) * 100).toFixed(1);
        const withPct = ((dist.withdrawal_total / distTotal) * 100).toFixed(1);

        // Update breakdown legend pills
        const depAmtEl = document.getElementById('dash-legend-deposit-amount');
        const depPctEl = document.getElementById('dash-legend-deposit-pct');
        const withAmtEl = document.getElementById('dash-legend-withdraw-amount');
        const withPctEl = document.getElementById('dash-legend-withdraw-pct');

        if (depAmtEl) depAmtEl.textContent = formatCurrency(dist.deposit_total);
        if (depPctEl) depPctEl.textContent = `(${depPct}%)`;
        if (withAmtEl) withAmtEl.textContent = formatCurrency(dist.withdrawal_total);
        if (withPctEl) withPctEl.textContent = `(${withPct}%)`;

        const distCtx = document.getElementById('chart-distribution-doughnut')?.getContext('2d');
        if (distCtx) {
            if (state.chartInstances.distDoughnut) state.chartInstances.distDoughnut.destroy();
            state.chartInstances.distDoughnut = new Chart(distCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Total Deposits', 'Total Withdrawals'],
                    datasets: [{
                        data: [dist.deposit_total, dist.withdrawal_total],
                        backgroundColor: ['#10b981', '#ef4444'],
                        hoverBackgroundColor: ['#059669', '#dc2626'],
                        borderColor: '#ffffff',
                        borderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Plus Jakarta Sans', weight: '600', size: 12 },
                                color: '#0f172a',
                                padding: 14
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const val = ctx.raw || 0;
                                    const pct = distTotal > 0 ? ((val / distTotal) * 100).toFixed(1) : 0;
                                    const count = ctx.dataIndex === 0 ? (dist.deposit_count || 0) : (dist.withdrawal_count || 0);
                                    return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%) • ${count} txns`;
                                }
                            }
                        }
                    },
                    cutout: '62%'
                }
            });
        }
    } else {
        if (emptyDistEl) emptyDistEl.classList.add('active');
        if (wrapDistEl) wrapDistEl.style.display = 'none';
        if (legDistEl) legDistEl.style.display = 'none';
        if (state.chartInstances.distDoughnut) {
            state.chartInstances.distDoughnut.destroy();
            state.chartInstances.distDoughnut = null;
        }
    }

    // -------------------------------------------------------------
    // CHART 2: Grouped Bar Chart (Monthly Deposits & Withdrawals)
    // -------------------------------------------------------------
    const hasMonthlyData = monthly.months && monthly.months.length > 0;
    const emptyMonthlyEl = document.getElementById('empty-monthly-bar');
    const wrapMonthlyEl = document.getElementById('wrapper-monthly-bar');

    if (hasMonthlyData) {
        if (emptyMonthlyEl) emptyMonthlyEl.classList.remove('active');
        if (wrapMonthlyEl) wrapMonthlyEl.style.display = 'block';

        const barCtx = document.getElementById('chart-monthly-bar')?.getContext('2d');
        if (barCtx) {
            if (state.chartInstances.monthlyBar) state.chartInstances.monthlyBar.destroy();
            state.chartInstances.monthlyBar = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: formattedMonths,
                    datasets: [
                        {
                            label: 'Deposits (Inflow)',
                            data: monthly.deposits,
                            backgroundColor: 'rgba(16, 185, 129, 0.85)',
                            borderColor: '#059669',
                            borderWidth: 1.5,
                            borderRadius: 6
                        },
                        {
                            label: 'Withdrawals (Outflow)',
                            data: monthly.withdrawals,
                            backgroundColor: 'rgba(239, 68, 68, 0.85)',
                            borderColor: '#dc2626',
                            borderWidth: 1.5,
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Plus Jakarta Sans', weight: '600' },
                                color: '#0f172a'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const val = ctx.raw || 0;
                                    const isDep = ctx.datasetIndex === 0;
                                    const count = isDep ? (monthly.deposit_counts[ctx.dataIndex] || 0) : (monthly.withdrawal_counts[ctx.dataIndex] || 0);
                                    return ` ${ctx.dataset.label}: ${formatCurrency(val)} (${count} txns)`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => '₹' + Number(v).toLocaleString('en-IN'),
                                font: { family: 'Plus Jakarta Sans' }
                            },
                            grid: { color: 'rgba(226, 232, 240, 0.7)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Plus Jakarta Sans', weight: '600' } }
                        }
                    }
                }
            });
        }
    } else {
        if (emptyMonthlyEl) emptyMonthlyEl.classList.add('active');
        if (wrapMonthlyEl) wrapMonthlyEl.style.display = 'none';
        if (state.chartInstances.monthlyBar) {
            state.chartInstances.monthlyBar.destroy();
            state.chartInstances.monthlyBar = null;
        }
    }

    // -------------------------------------------------------------
    // CHART 3: Line Chart (Transaction Trends Over Time)
    // -------------------------------------------------------------
    const emptyTrendsEl = document.getElementById('empty-trends-line');
    const wrapTrendsEl = document.getElementById('wrapper-trends-line');

    if (hasMonthlyData) {
        if (emptyTrendsEl) emptyTrendsEl.classList.remove('active');
        if (wrapTrendsEl) wrapTrendsEl.style.display = 'block';

        const lineCtx = document.getElementById('chart-trends-line')?.getContext('2d');
        if (lineCtx) {
            if (state.chartInstances.trendsLine) state.chartInstances.trendsLine.destroy();
            state.chartInstances.trendsLine = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels: formattedMonths,
                    datasets: [
                        {
                            label: 'Deposits',
                            data: monthly.deposits,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: '#10b981'
                        },
                        {
                            label: 'Withdrawals',
                            data: monthly.withdrawals,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: '#ef4444'
                        },
                        {
                            label: 'Net Cash Flow',
                            data: monthly.net_flow,
                            borderColor: '#7c3aed',
                            backgroundColor: 'transparent',
                            borderDash: [6, 4],
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: '#7c3aed'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Plus Jakarta Sans', weight: '600' },
                                color: '#0f172a'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => '₹' + Number(v).toLocaleString('en-IN'),
                                font: { family: 'Plus Jakarta Sans' }
                            },
                            grid: { color: 'rgba(226, 232, 240, 0.7)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Plus Jakarta Sans', weight: '600' } }
                        }
                    }
                }
            });
        }
    } else {
        if (emptyTrendsEl) emptyTrendsEl.classList.add('active');
        if (wrapTrendsEl) wrapTrendsEl.style.display = 'none';
        if (state.chartInstances.trendsLine) {
            state.chartInstances.trendsLine.destroy();
            state.chartInstances.trendsLine = null;
        }
    }

    // -------------------------------------------------------------
    // CHART 4: Colourful Pie Chart (Account Type Distribution)
    // -------------------------------------------------------------
    const totalAccountsBal = (accTypes.balances || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    const hasAccData = accTypes.labels && accTypes.labels.length > 0 && totalAccountsBal > 0;

    const emptyAccEl = document.getElementById('empty-accounts-pie');
    const wrapAccEl = document.getElementById('wrapper-accounts-pie');
    const legAccEl = document.getElementById('legend-accounts-pie');

    // Distinct professional color palette
    const colorPalette = ['#7c3aed', '#0284c7', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6'];

    if (hasAccData) {
        if (emptyAccEl) emptyAccEl.classList.remove('active');
        if (wrapAccEl) wrapAccEl.style.display = 'block';
        if (legAccEl) legAccEl.style.display = 'flex';

        // Render dynamic legend pills
        if (legAccEl) {
            legAccEl.innerHTML = accTypes.labels.map((lbl, idx) => {
                const bal = accTypes.balances[idx] || 0;
                const count = accTypes.counts[idx] || 0;
                const pct = totalAccountsBal > 0 ? ((bal / totalAccountsBal) * 100).toFixed(1) : 0;
                const color = colorPalette[idx % colorPalette.length];

                return `
                    <div class="breakdown-pill">
                        <span class="pill-dot" style="background-color: ${color};"></span>
                        <span class="pill-title">${escapeHtml(lbl)}:</span>
                        <strong class="pill-amount">${formatCurrency(bal)}</strong>
                        <span class="pill-pct">(${pct}%)</span>
                        <small class="text-muted">(${count} acc)</small>
                    </div>
                `;
            }).join('');
        }

        const accPieCtx = document.getElementById('chart-accounts-pie')?.getContext('2d');
        if (accPieCtx) {
            if (state.chartInstances.accPie) state.chartInstances.accPie.destroy();
            state.chartInstances.accPie = new Chart(accPieCtx, {
                type: 'pie',
                data: {
                    labels: accTypes.labels,
                    datasets: [{
                        data: accTypes.balances,
                        backgroundColor: colorPalette.slice(0, accTypes.labels.length),
                        borderColor: '#ffffff',
                        borderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Plus Jakarta Sans', weight: '600', size: 12 },
                                color: '#0f172a',
                                padding: 12
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const val = ctx.raw || 0;
                                    const count = accTypes.counts[ctx.dataIndex] || 0;
                                    const pct = totalAccountsBal > 0 ? ((val / totalAccountsBal) * 100).toFixed(1) : 0;
                                    return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%) • ${count} accounts`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } else {
        if (emptyAccEl) emptyAccEl.classList.add('active');
        if (wrapAccEl) wrapAccEl.style.display = 'none';
        if (legAccEl) legAccEl.style.display = 'none';
        if (state.chartInstances.accPie) {
            state.chartInstances.accPie.destroy();
            state.chartInstances.accPie = null;
        }
    }
}

function renderTopAccounts(accounts) {
    const tbody = document.getElementById('top-accounts-tbody');
    if (!tbody) return;

    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fa-solid fa-wallet"></i>
                    <p>No accounts available.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = accounts.map(a => `
        <tr>
            <td><span class="account-badge">${escapeHtml(a.account_number)}</span></td>
            <td><strong>${escapeHtml(a.customer_name || 'N/A')}</strong></td>
            <td><span class="badge badge-purple">${escapeHtml(a.account_type)}</span></td>
            <td><strong class="text-success">${formatCurrency(a.balance)}</strong></td>
        </tr>
    `).join('');
}

function renderKeyRatios(data) {
    const summary = state.summary || {};
    const totalBal = summary.total_balance || 0;
    const totalAcc = summary.total_accounts || 1;
    const totalCust = summary.total_customers || 1;
    const totalDep = summary.total_deposits || 0;
    const totalWth = summary.total_withdrawals || 0;
    const totalTxns = (summary.total_deposit_count || 0) + (summary.total_withdrawal_count || 0);

    const avgAccBal = totalAcc > 0 ? (totalBal / totalAcc) : 0;
    const avgCustBal = totalCust > 0 ? (totalBal / totalCust) : 0;
    const ratioFlow = totalWth > 0 ? (totalDep / totalWth).toFixed(2) + 'x' : (totalDep > 0 ? 'Infinity' : '1.00x');

    const elemAvgAcc = document.getElementById('ratio-avg-account-bal');
    const elemAvgCust = document.getElementById('ratio-avg-customer-bal');
    const elemRatio = document.getElementById('ratio-inflow-outflow');
    const elemTotalTxns = document.getElementById('ratio-total-txns');

    if (elemAvgAcc) elemAvgAcc.textContent = formatCurrency(avgAccBal);
    if (elemAvgCust) elemAvgCust.textContent = formatCurrency(avgCustBal);
    if (elemRatio) elemRatio.textContent = ratioFlow;
    if (elemTotalTxns) elemTotalTxns.textContent = totalTxns.toLocaleString('en-IN');
}

// ==========================================
// 3. Unusual Transaction Risk Alerts
// ==========================================

async function fetchAlerts(notify = false) {
    try {
        const response = await fetch('/api/alerts');
        const data = await response.json();

        if (data.success) {
            state.alerts = data.alerts || [];
            renderAlertsTable(state.alerts);

            const badgeNav = document.getElementById('nav-alert-count');
            const badgeTotal = document.getElementById('badge-alert-total');

            if (badgeNav) badgeNav.textContent = state.alerts.length;
            if (badgeTotal) badgeTotal.textContent = `${state.alerts.length} alert${state.alerts.length === 1 ? '' : 's'} detected`;

            if (notify) {
                showToast('Audit Complete', `Scanned database: ${state.alerts.length} unusual activity items identified.`, 'info');
            }
        }
    } catch (err) {
        console.error('Error fetching alerts:', err);
    }
}

function renderAlertsTable(alerts) {
    const tbody = document.getElementById('alerts-tbody');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fa-solid fa-shield-check text-success"></i>
                    <p>No unusual transaction alerts detected. All transactions satisfy safety rules.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = alerts.map(alert => {
        let severityBadge = 'badge-medium';
        if (alert.severity === 'CRITICAL') severityBadge = 'badge-critical';
        else if (alert.severity === 'HIGH') severityBadge = 'badge-high';
        else if (alert.severity === 'WARNING') severityBadge = 'badge-warning';

        return `
            <tr>
                <td><strong>${escapeHtml(alert.id)}</strong></td>
                <td><span class="badge ${severityBadge}">${escapeHtml(alert.severity)}</span></td>
                <td><strong>${escapeHtml(alert.rule_name)}</strong></td>
                <td><span class="account-badge">${escapeHtml(alert.account_number)}</span></td>
                <td>${escapeHtml(alert.customer_name || 'N/A')}</td>
                <td><strong>${alert.amount ? formatCurrency(alert.amount) : '—'}</strong></td>
                <td><small>${escapeHtml(alert.details)}</small></td>
                <td><small class="text-muted">${formatDate(alert.timestamp)}</small></td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 4. Customer Management (CRUD)
// ==========================================

async function fetchCustomers() {
    try {
        const response = await fetch('/api/customers');
        const data = await response.json();

        if (data.success && Array.isArray(data.customers)) {
            state.customers = data.customers;
            renderCustomersTable(data.customers);
            populateCustomerSelect(data.customers);
        }
    } catch (err) {
        console.error('Error fetching customers:', err);
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById('customers-tbody');
    const badgeCount = document.getElementById('badge-customer-count');
    if (badgeCount) {
        badgeCount.textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'}`;
    }

    if (!tbody) return;

    if (!customers || customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-users-slash"></i>
                    <p>No customers registered yet. Use the form to register one.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = customers.map(c => `
        <tr>
            <td><strong>#${c.id}</strong></td>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${escapeHtml(c.email)}</td>
            <td>${escapeHtml(c.phone || '—')}</td>
            <td><span class="badge badge-purple">${c.account_count || 0} account(s)</span></td>
            <td><strong class="text-success">${formatCurrency(c.total_balance || 0)}</strong></td>
            <td>
                <div class="table-action-group">
                    <button class="btn btn-sm btn-secondary btn-table-icon" title="Edit Customer" onclick="openEditCustomerModal(${c.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-primary btn-table-icon" title="Open Account" onclick="openAccountForCustomer(${c.id})">
                        <i class="fa-solid fa-folder-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-table-icon" title="Delete Customer" onclick="confirmDeleteCustomer(${c.id}, '${escapeHtml(c.name)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function populateCustomerSelect(customers) {
    const select = document.getElementById('acc-customer-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose Customer --</option>' +
        customers.map(c => `
            <option value="${c.id}">#${c.id} - ${escapeHtml(c.name)} (${escapeHtml(c.email)})</option>
        `).join('');

    if (currentVal && customers.some(c => c.id == currentVal)) {
        select.value = currentVal;
    }
}

window.openAccountForCustomer = function(customerId) {
    switchTab('tab-accounts');
    const select = document.getElementById('acc-customer-select');
    if (select) {
        select.value = customerId;
        select.focus();
    }
};

window.openEditCustomerModal = function(customerId) {
    const cust = state.customers.find(c => c.id === customerId);
    if (!cust) return;

    document.getElementById('edit-cust-id').value = cust.id;
    document.getElementById('edit-cust-name').value = cust.name;
    document.getElementById('edit-cust-email').value = cust.email;
    document.getElementById('edit-cust-phone').value = cust.phone || '';

    openModal('modal-edit-customer');
};

window.confirmDeleteCustomer = function(customerId, customerName) {
    state.pendingDeleteAction = async () => {
        try {
            const response = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast('Deleted', result.message || 'Customer deleted.', 'success');
                refreshAllData();
            } else {
                showToast('Error', result.error || 'Failed to delete customer.', 'error');
            }
        } catch (err) {
            showToast('Network Error', 'Could not delete customer.', 'error');
        }
    };

    document.getElementById('confirm-modal-title').innerHTML = '<i class="fa-solid fa-user-xmark"></i> Delete Customer';
    document.getElementById('confirm-modal-message').textContent =
        `Are you sure you want to delete customer '${customerName}'? All linked accounts and transaction logs will be permanently deleted via SQLite cascade.`;

    openModal('modal-confirm-delete');
};

// ==========================================
// 5. Account Management (CRUD)
// ==========================================

async function fetchAccounts() {
    try {
        const response = await fetch('/api/accounts');
        const data = await response.json();

        if (data.success && Array.isArray(data.accounts)) {
            state.accounts = data.accounts;
            renderAccountsTable(data.accounts);
            populateAccountSelectors(data.accounts);
        }
    } catch (err) {
        console.error('Error fetching accounts:', err);
    }
}

function renderAccountsTable(accounts) {
    const tbody = document.getElementById('accounts-tbody');
    const badgeCount = document.getElementById('badge-account-count');
    if (badgeCount) {
        badgeCount.textContent = `${accounts.length} account${accounts.length === 1 ? '' : 's'}`;
    }

    if (!tbody) return;

    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-wallet"></i>
                    <p>No active accounts yet. Open one using the form.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = accounts.map(a => `
        <tr>
            <td><span class="account-badge">${escapeHtml(a.account_number)}</span></td>
            <td>
                <strong>${escapeHtml(a.customer_name || 'N/A')}</strong>
                <br><small class="text-muted">${escapeHtml(a.customer_email || '')}</small>
            </td>
            <td><span class="badge badge-purple">${escapeHtml(a.account_type)}</span></td>
            <td><strong class="text-success">${formatCurrency(a.balance)}</strong></td>
            <td><span class="badge badge-secondary">${a.transaction_count || 0}</span></td>
            <td><small class="text-muted">${formatDate(a.created_at)}</small></td>
            <td>
                <div class="table-action-group">
                    <button class="btn btn-sm btn-primary btn-table-icon" title="Deposit / Withdraw" onclick="selectAccountForOperation('${a.account_number}')">
                        <i class="fa-solid fa-money-bill-transfer"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary btn-table-icon" title="Modify Account" onclick="openEditAccountModal(${a.id}, '${a.account_number}', '${a.account_type}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-table-icon" title="Close Account" onclick="confirmDeleteAccount(${a.id}, '${a.account_number}', ${a.balance})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function populateAccountSelectors(accounts) {
    // 1. Global operations account selector
    const globalSelect = document.getElementById('global-account-select');
    if (globalSelect) {
        const currentVal = globalSelect.value;
        globalSelect.innerHTML = '<option value="">-- Choose Account to Transact --</option>' +
            accounts.map(a => `
                <option value="${a.account_number}">
                    ${a.account_number} — ${escapeHtml(a.customer_name || 'N/A')} (${formatCurrency(a.balance)})
                </option>
            `).join('');

        if (currentVal && accounts.some(a => a.account_number === currentVal)) {
            globalSelect.value = currentVal;
            updateSelectedAccountPreview(currentVal);
        } else if (accounts.length > 0 && !currentVal) {
            globalSelect.value = accounts[0].account_number;
            updateSelectedAccountPreview(accounts[0].account_number);
        } else {
            updateSelectedAccountPreview(null);
        }
    }

    // 2. Transaction filter account selector
    const filterSelect = document.getElementById('filter-account-select');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="ALL">All Accounts</option>' +
            accounts.map(a => `
                <option value="${a.account_number}">${a.account_number} (${escapeHtml(a.customer_name || '')})</option>
            `).join('');

        if (currentVal) {
            filterSelect.value = currentVal;
        }
    }
}

window.selectAccountForOperation = function(accountNumber) {
    switchTab('tab-operations');
    const globalSelect = document.getElementById('global-account-select');
    if (globalSelect) {
        globalSelect.value = accountNumber;
        updateSelectedAccountPreview(accountNumber);
    }
};

window.openEditAccountModal = function(accountId, accountNumber, accountType) {
    document.getElementById('edit-acc-id').value = accountId;
    document.getElementById('edit-acc-number').value = accountNumber;
    document.getElementById('edit-acc-type').value = accountType || 'Savings';

    openModal('modal-edit-account');
};

window.confirmDeleteAccount = function(accountId, accountNumber, balance) {
    state.pendingDeleteAction = async () => {
        try {
            const response = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast('Account Deleted', result.message || 'Account removed successfully.', 'success');
                refreshAllData();
            } else {
                showToast('Error', result.error || 'Failed to delete account.', 'error');
            }
        } catch (err) {
            showToast('Network Error', 'Could not delete account.', 'error');
        }
    };

    let msg = `Are you sure you want to close account ${accountNumber}?`;
    if (balance > 0) {
        msg += ` Note: This account holds active funds of ${formatCurrency(balance)}. Closing will purge linked transaction history.`;
    }

    document.getElementById('confirm-modal-title').innerHTML = '<i class="fa-solid fa-credit-card"></i> Close Bank Account';
    document.getElementById('confirm-modal-message').textContent = msg;

    openModal('modal-confirm-delete');
};

// ==========================================
// 6. Deposit & Withdrawal Operations
// ==========================================

function setupAccountSelector() {
    const globalSelect = document.getElementById('global-account-select');
    if (globalSelect) {
        globalSelect.addEventListener('change', (e) => {
            updateSelectedAccountPreview(e.target.value);
        });
    }
}

function updateSelectedAccountPreview(accountNumber) {
    const balanceElem = document.getElementById('preview-account-balance');
    const ownerElem = document.getElementById('preview-account-owner');
    const depositDisplay = document.getElementById('deposit-account-display');
    const depositInput = document.getElementById('deposit-account-number');
    const withdrawDisplay = document.getElementById('withdraw-account-display');
    const withdrawInput = document.getElementById('withdraw-account-number');

    if (!accountNumber) {
        state.selectedAccount = null;
        if (balanceElem) balanceElem.textContent = '₹0.00';
        if (ownerElem) ownerElem.textContent = 'No account selected';
        if (depositDisplay) depositDisplay.value = '';
        if (depositInput) depositInput.value = '';
        if (withdrawDisplay) withdrawDisplay.value = '';
        if (withdrawInput) withdrawInput.value = '';
        checkWithdrawalLimit();
        return;
    }

    const acc = state.accounts.find(a => a.account_number === accountNumber);
    if (acc) {
        state.selectedAccount = acc;
        if (balanceElem) balanceElem.textContent = formatCurrency(acc.balance);
        if (ownerElem) ownerElem.textContent = `Owner: ${acc.customer_name || 'N/A'} • ${acc.account_type}`;
        const displayLabel = `${acc.account_number} (${acc.customer_name || 'N/A'} - Bal: ${formatCurrency(acc.balance)})`;
        if (depositDisplay) depositDisplay.value = displayLabel;
        if (depositInput) depositInput.value = acc.account_number;
        if (withdrawDisplay) withdrawDisplay.value = displayLabel;
        if (withdrawInput) withdrawInput.value = acc.account_number;
    }
    checkWithdrawalLimit();
}

function setupWithdrawValidation() {
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    if (withdrawAmountInput) {
        withdrawAmountInput.addEventListener('input', checkWithdrawalLimit);
    }
}

function checkWithdrawalLimit() {
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    const warning = document.getElementById('withdraw-warning');
    if (!withdrawAmountInput || !warning) return;

    const amount = parseFloat(withdrawAmountInput.value) || 0;
    const currentBalance = state.selectedAccount ? parseFloat(state.selectedAccount.balance) : 0;

    if (amount > currentBalance && state.selectedAccount) {
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

window.setDepositAmount = function(val) {
    const input = document.getElementById('deposit-amount');
    if (input) {
        input.value = parseFloat(val).toFixed(2);
        input.focus();
    }
};

window.setWithdrawAmount = function(val) {
    const input = document.getElementById('withdraw-amount');
    if (input) {
        input.value = parseFloat(val).toFixed(2);
        checkWithdrawalLimit();
        input.focus();
    }
};

// ==========================================
// 7. Form Handlers & Modal Submitters
// ==========================================

function setupForms() {
    // A. Add Customer Form
    const formAddCustomer = document.getElementById('form-add-customer');
    if (formAddCustomer) {
        formAddCustomer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-customer');
            setButtonLoading(btn, true);

            const payload = {
                name: document.getElementById('cust-name').value.trim(),
                email: document.getElementById('cust-email').value.trim(),
                phone: document.getElementById('cust-phone').value.trim()
            };

            try {
                const response = await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    showToast('Customer Created', result.message || 'Customer registered successfully.', 'success');
                    formAddCustomer.reset();
                    await refreshAllData();
                } else {
                    showToast('Registration Failed', result.error || 'Failed to register customer.', 'error');
                }
            } catch (err) {
                showToast('Network Error', 'Could not reach server.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // B. Edit Customer Form
    const formEditCustomer = document.getElementById('form-edit-customer');
    if (formEditCustomer) {
        formEditCustomer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const custId = document.getElementById('edit-cust-id').value;
            const btn = document.getElementById('btn-save-customer');
            setButtonLoading(btn, true);

            const payload = {
                name: document.getElementById('edit-cust-name').value.trim(),
                email: document.getElementById('edit-cust-email').value.trim(),
                phone: document.getElementById('edit-cust-phone').value.trim()
            };

            try {
                const response = await fetch(`/api/customers/${custId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    showToast('Customer Updated', result.message || 'Customer details updated.', 'success');
                    closeModal('modal-edit-customer');
                    await refreshAllData();
                } else {
                    showToast('Update Failed', result.error || 'Failed to update customer.', 'error');
                }
            } catch (err) {
                showToast('Network Error', 'Could not reach server.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // C. Create Account Form
    const formCreateAccount = document.getElementById('form-create-account');
    if (formCreateAccount) {
        formCreateAccount.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-account');
            setButtonLoading(btn, true);

            const customerId = document.getElementById('acc-customer-select').value;
            const accountType = document.getElementById('acc-type').value;
            const accountNumber = document.getElementById('acc-number').value.trim();
            const initialDeposit = parseFloat(document.getElementById('acc-deposit').value) || 0.0;

            if (!customerId) {
                showToast('Required', 'Please select a customer.', 'error');
                setButtonLoading(btn, false);
                return;
            }

            const payload = {
                customer_id: customerId,
                account_type: accountType,
                account_number: accountNumber,
                initial_deposit: initialDeposit
            };

            try {
                const response = await fetch('/api/accounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    showToast('Account Opened', `Account ${result.account?.account_number || ''} opened successfully!`, 'success');
                    formCreateAccount.reset();
                    await refreshAllData();
                } else {
                    showToast('Account Error', result.error || 'Failed to create account.', 'error');
                }
            } catch (err) {
                showToast('Network Error', 'Could not reach server.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // D. Edit Account Form
    const formEditAccount = document.getElementById('form-edit-account');
    if (formEditAccount) {
        formEditAccount.addEventListener('submit', async (e) => {
            e.preventDefault();
            const accId = document.getElementById('edit-acc-id').value;
            const btn = document.getElementById('btn-save-account');
            setButtonLoading(btn, true);

            const payload = {
                account_type: document.getElementById('edit-acc-type').value
            };

            try {
                const response = await fetch(`/api/accounts/${accId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    showToast('Account Updated', result.message || 'Account updated.', 'success');
                    closeModal('modal-edit-account');
                    await refreshAllData();
                } else {
                    showToast('Update Failed', result.error || 'Failed to update account.', 'error');
                }
            } catch (err) {
                showToast('Network Error', 'Could not reach server.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // E. Deposit Form
    const formDeposit = document.getElementById('form-deposit');
    if (formDeposit) {
        formDeposit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-deposit');

            const accountNumber = document.getElementById('deposit-account-number').value;
            const amount = parseFloat(document.getElementById('deposit-amount').value);
            const description = document.getElementById('deposit-desc').value.trim();

            if (!accountNumber) {
                showToast('Required', 'Please select an account for the deposit.', 'error');
                return;
            }

            if (!amount || amount <= 0) {
                showToast('Invalid Amount', 'Deposit amount must be strictly greater than ₹0.00.', 'error');
                return;
            }

            setButtonLoading(btn, true);

            try {
                const response = await fetch('/api/deposit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        account_number: accountNumber,
                        amount: amount,
                        description: description || 'Cash deposit'
                    })
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    showToast('Deposit Complete', `Deposited ${formatCurrency(amount)}. New balance: ${formatCurrency(result.new_balance)}`, 'success');
                    document.getElementById('deposit-amount').value = '';
                    document.getElementById('deposit-desc').value = '';
                    await refreshAllData();
                    updateSelectedAccountPreview(accountNumber);
                } else {
                    showToast('Deposit Rejected', result.error || 'Deposit failed.', 'error');
                }
            } catch (err) {
                showToast('Network Error', 'Could not complete deposit.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // F. Withdraw Form
    const formWithdraw = document.getElementById('form-withdraw');
    if (formWithdraw) {
        formWithdraw.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-withdraw');

            const accountNumber = document.getElementById('withdraw-account-number').value;
            const amount = parseFloat(document.getElementById('withdraw-amount').value);
            const description = document.getElementById('withdraw-desc').value.trim();

            if (!accountNumber) {
                showToast('Required', 'Please select an account for the withdrawal.', 'error');
                return;
            }

            if (!amount || amount <= 0) {
                showToast('Invalid Amount', 'Withdrawal amount must be strictly greater than ₹0.00.', 'error');
                return;
            }

            // Quick client check
            if (state.selectedAccount && amount > state.selectedAccount.balance) {
                showToast('Insufficient Funds', `Available balance is ${formatCurrency(state.selectedAccount.balance)}, cannot withdraw ${formatCurrency(amount)}.`, 'error');
                return;
            }

            setButtonLoading(btn, true);

            try {
                const response = await fetch('/api/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        account_number: accountNumber,
                        amount: amount,
                        description: description || 'Cash withdrawal'
                    })
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    showToast('Withdrawal Success', `Withdrew ${formatCurrency(amount)}. New balance: ${formatCurrency(result.new_balance)}`, 'success');
                    document.getElementById('withdraw-amount').value = '';
                    document.getElementById('withdraw-desc').value = '';
                    checkWithdrawalLimit();
                    await refreshAllData();
                    updateSelectedAccountPreview(accountNumber);
                } else {
                    showToast('Withdrawal Rejected', result.error || 'Insufficient funds or withdrawal error.', 'error');
                }
            } catch (err) {
                showToast('Network Error', 'Could not complete withdrawal.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // G. Confirmation Modal Action Button
    document.getElementById('btn-confirm-delete-action')?.addEventListener('click', async () => {
        if (typeof state.pendingDeleteAction === 'function') {
            await state.pendingDeleteAction();
            state.pendingDeleteAction = null;
        }
        closeModal('modal-confirm-delete');
    });
}

// ==========================================
// 8. Transaction History & Filtering
// ==========================================

async function fetchTransactions() {
    try {
        const response = await fetch('/api/transactions?limit=250');
        const data = await response.json();

        if (data.success && Array.isArray(data.transactions)) {
            state.transactions = data.transactions;
            applyTransactionFilters();
        }
    } catch (err) {
        console.error('Error fetching transaction logs:', err);
    }
}

function setupFilters() {
    const searchInput = document.getElementById('filter-search-input');
    const typeSelect = document.getElementById('filter-type-select');
    const accountSelect = document.getElementById('filter-account-select');
    const startDateInput = document.getElementById('filter-start-date');
    const endDateInput = document.getElementById('filter-end-date');
    const resetBtn = document.getElementById('btn-reset-filters');

    if (searchInput) searchInput.addEventListener('input', debounce(applyTransactionFilters, 250));
    if (typeSelect) typeSelect.addEventListener('change', applyTransactionFilters);
    if (accountSelect) accountSelect.addEventListener('change', applyTransactionFilters);
    if (startDateInput) startDateInput.addEventListener('change', applyTransactionFilters);
    if (endDateInput) endDateInput.addEventListener('change', applyTransactionFilters);

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (typeSelect) typeSelect.value = 'ALL';
            if (accountSelect) accountSelect.value = 'ALL';
            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            applyTransactionFilters();
        });
    }
}

function applyTransactionFilters() {
    const searchQuery = (document.getElementById('filter-search-input')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('filter-type-select')?.value || 'ALL';
    const accountFilter = document.getElementById('filter-account-select')?.value || 'ALL';
    const startDate = document.getElementById('filter-start-date')?.value || '';
    const endDate = document.getElementById('filter-end-date')?.value || '';

    state.filteredTransactions = state.transactions.filter(txn => {
        // 1. Type Match
        if (typeFilter !== 'ALL' && txn.transaction_type !== typeFilter) {
            return false;
        }

        // 2. Account Match
        if (accountFilter !== 'ALL' && txn.account_number !== accountFilter) {
            return false;
        }

        // 3. Date Range Match
        if (startDate && txn.timestamp) {
            const txnDate = txn.timestamp.slice(0, 10);
            if (txnDate < startDate) return false;
        }
        if (endDate && txn.timestamp) {
            const txnDate = txn.timestamp.slice(0, 10);
            if (txnDate > endDate) return false;
        }

        // 4. Search Query Match
        if (searchQuery) {
            const customer = (txn.customer_name || '').toLowerCase();
            const account = (txn.account_number || '').toLowerCase();
            const desc = (txn.description || '').toLowerCase();
            if (!customer.includes(searchQuery) && !account.includes(searchQuery) && !desc.includes(searchQuery)) {
                return false;
            }
        }

        return true;
    });

    renderTransactionsTable(state.filteredTransactions);
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-tbody');
    const countElem = document.getElementById('filtered-transactions-count');
    if (countElem) {
        countElem.textContent = `Showing ${transactions.length} of ${state.transactions.length} transactions`;
    }

    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>No matching transactions found.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(txn => {
        const isDeposit = txn.transaction_type === 'Deposit';
        const badgeClass = isDeposit ? 'badge-deposit' : 'badge-withdrawal';
        const icon = isDeposit ? 'fa-arrow-down-long' : 'fa-arrow-up-long';
        const amountClass = isDeposit ? 'text-success' : 'text-danger';
        const prefix = isDeposit ? '+' : '-';

        return `
            <tr>
                <td><strong>#${txn.id}</strong></td>
                <td>
                    <span class="badge ${badgeClass}">
                        <i class="fa-solid ${icon}"></i> ${escapeHtml(txn.transaction_type)}
                    </span>
                </td>
                <td><span class="account-badge">${escapeHtml(txn.account_number)}</span></td>
                <td><strong>${escapeHtml(txn.customer_name || 'N/A')}</strong></td>
                <td><strong class="${amountClass}">${prefix}${formatCurrency(txn.amount)}</strong></td>
                <td>${escapeHtml(txn.description || '—')}</td>
                <td><small class="text-muted">${formatDate(txn.timestamp)}</small></td>
                <td>
                    <button class="btn btn-sm btn-danger btn-table-icon" title="Reverse Transaction" onclick="confirmDeleteTransaction(${txn.id}, '${escapeHtml(txn.transaction_type)}', ${txn.amount}, '${escapeHtml(txn.account_number)}')">
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.confirmDeleteTransaction = function(txnId, txnType, amount, accountNumber) {
    state.pendingDeleteAction = async () => {
        try {
            const response = await fetch(`/api/transactions/${txnId}`, { method: 'DELETE' });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast('Reversed', result.message || 'Transaction reversed.', 'success');
                refreshAllData();
            } else {
                showToast('Reversal Failed', result.error || 'Could not reverse transaction.', 'error');
            }
        } catch (err) {
            showToast('Network Error', 'Could not reverse transaction.', 'error');
        }
    };

    document.getElementById('confirm-modal-title').innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reverse Transaction';
    document.getElementById('confirm-modal-message').textContent =
        `Are you sure you want to reverse and delete transaction #${txnId} (${txnType} of ${formatCurrency(amount)} on ${accountNumber})? This will automatically recalculate the account balance in SQLite.`;

    openModal('modal-confirm-delete');
};

function exportTransactionsCSV() {
    const dataToExport = state.filteredTransactions.length > 0 ? state.filteredTransactions : state.transactions;
    if (!dataToExport || dataToExport.length === 0) {
        showToast('Export Notice', 'No transaction records available to export.', 'info');
        return;
    }

    const headers = ['Transaction ID', 'Type', 'Account Number', 'Customer Name', 'Amount (INR)', 'Description', 'Timestamp'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataToExport.forEach(t => {
        const row = [
            t.id,
            `"${t.transaction_type}"`,
            `"${t.account_number}"`,
            `"${(t.customer_name || '').replace(/"/g, '""')}"`,
            parseFloat(t.amount).toFixed(2),
            `"${(t.description || '').replace(/"/g, '""')}"`,
            `"${t.timestamp}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `banking_transactions_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Report Downloaded', `Exported ${dataToExport.length} transactions to CSV.`, 'success');
}

// ==========================================
// 9. Modals Controller
// ==========================================

function setupModalListeners() {
    window.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('modal-backdrop')) {
            e.target.classList.remove('active');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

window.openModal = openModal;
window.closeModal = closeModal;

// ==========================================
// 10. Toast Notification Engine
// ==========================================

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';

    toast.innerHTML = `
        <div class="toast-icon"><i class="${iconClass}"></i></div>
        <div class="toast-body">
            <h4 class="toast-title">${escapeHtml(title)}</h4>
            <p class="toast-message">${escapeHtml(message)}</p>
        </div>
        <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
        toast.classList.add('toast-leave');
        setTimeout(() => toast.remove(), 250);
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, 4500);
}

// ==========================================
// 11. Helper Utilities
// ==========================================

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function escapeHtml(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
