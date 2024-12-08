import { ProcessedData } from './data-processor';
import { styles } from './styles';
import { generateColors, truncateText } from './utils';
import { baseChartOptions } from './chart-config';

export function generateHtmlTemplate(data: ProcessedData): string {
    const colors = generateColors(data.typeFrequencyPoints.length);

    const typeBreakdownHtml = Object.entries(data.stats.typeBreakdown)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => `
            <p>${truncateText(type)}: ${count} (${((count / data.stats.totalTimeouts) * 100).toFixed(1)}%)</p>
        `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Timeout Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/moment"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-moment"></script>
    <style>${styles}</style>
</head>
<body>
    <div class="container">
        <h1>Timeout Analysis</h1>
        <div class="stats-grid">
            <div class="stats">
                <h3>General Statistics</h3>
                <p>Total Timeouts: ${data.stats.totalTimeouts}</p>
                <p>Date Range: ${data.stats.startDate.toLocaleDateString()} to ${data.stats.endDate.toLocaleDateString()}</p>
                <p>Days Covered: ${data.stats.daysCovered}</p>
                <p>Average Timeouts per Day: ${data.stats.averagePerDay.toFixed(2)}</p>
                <p>Maximum Timeouts in a Day: ${data.stats.maxPerDay}</p>
            </div>
            <div class="stats type-breakdown">
                <h3>Timeout Type Breakdown</h3>
                ${typeBreakdownHtml}
            </div>
        </div>

        <div class="timeframe-selector">
            <select id="timeframeSelector" onchange="updateTimeframe()">
                <option value="all">All Time</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="9m">Last 9 Months</option>
                <option value="1y">Last Year</option>
            </select>
        </div>

        <div class="chart-container">
            <h2>Cumulative Timeouts Over Time</h2>
            <canvas id="cumulativeChart"></canvas>
        </div>

        <div class="chart-container">
            <h2>Daily Timeout Frequency</h2>
            <canvas id="frequencyChart"></canvas>
        </div>

        <div class="chart-container">
            <h2>Daily Timeout Frequency by Type</h2>
            <canvas id="typeFrequencyChart"></canvas>
        </div>
    </div>
    <script>
        let cumulativeChart, frequencyChart, typeFrequencyChart;
        const allData = {
            cumulative: ${JSON.stringify(data.cumulativePoints)},
            frequency: ${JSON.stringify(data.frequencyPoints)},
            typeFrequency: ${JSON.stringify(data.typeFrequencyPoints.map((typeData, index) => ({
                label: truncateText(typeData.type),
                data: typeData.data,
                backgroundColor: colors[index],
                borderColor: colors[index],
                borderWidth: 1
            })))}
        };

        function filterDataByTimeframe(data, timeframe) {
            const now = new Date();
            let cutoffDate;

            switch(timeframe) {
                case '3m':
                    cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
                    break;
                case '6m':
                    cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
                    break;
                case '9m':
                    cutoffDate = new Date(now.setMonth(now.getMonth() - 9));
                    break;
                case '1y':
                    cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    return data;
            }

            return data.filter(point => new Date(point.x) >= cutoffDate);
        }

        function updateTimeframe() {
            const timeframe = document.getElementById('timeframeSelector').value;

            // Update cumulative chart
            const filteredCumulative = filterDataByTimeframe(allData.cumulative, timeframe);
            cumulativeChart.data.datasets[0].data = filteredCumulative;
            cumulativeChart.update();

            // Update frequency chart
            const filteredFrequency = filterDataByTimeframe(allData.frequency, timeframe);
            frequencyChart.data.datasets[0].data = filteredFrequency;
            frequencyChart.update();

            // Update type frequency chart
            typeFrequencyChart.data.datasets = allData.typeFrequency.map(dataset => ({
                ...dataset,
                data: filterDataByTimeframe(dataset.data, timeframe)
            }));
            typeFrequencyChart.update();
        }

        // Base chart options
        const baseOptions = ${JSON.stringify(baseChartOptions)};

        // Initialize Charts
        const ctxCumulative = document.getElementById('cumulativeChart').getContext('2d');
        cumulativeChart = new Chart(ctxCumulative, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Cumulative Timeouts',
                    data: allData.cumulative,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return \`Total Timeouts: \${context.parsed.y}\`;
                            }
                        }
                    }
                }
            }
        });

        const ctxFrequency = document.getElementById('frequencyChart').getContext('2d');
        frequencyChart = new Chart(ctxFrequency, {
            type: 'bar',
            data: {
                datasets: [{
                    label: 'Daily Timeouts',
                    data: allData.frequency,
                    backgroundColor: 'rgb(255, 99, 132)',
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1
                }]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return \`Timeouts: \${context.parsed.y}\`;
                            }
                        }
                    }
                }
            }
        });

        const ctxTypeFrequency = document.getElementById('typeFrequencyChart').getContext('2d');
        typeFrequencyChart = new Chart(ctxTypeFrequency, {
            type: 'bar',
            data: {
                datasets: allData.typeFrequency
            },
            options: {
                ...baseOptions,
                scales: {
                    ...baseOptions.scales,
                    x: {
                        ...baseOptions.scales.x,
                        stacked: true
                    },
                    y: {
                        ...baseOptions.scales.y,
                        stacked: true
                    }
                },
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return \`\${context.dataset.label}: \${context.parsed.y}\`;
                            }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
}
