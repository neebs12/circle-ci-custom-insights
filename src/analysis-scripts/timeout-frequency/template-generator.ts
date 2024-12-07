import { ProcessedData } from './data-processor';

export function generateHtmlTemplate(data: ProcessedData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Timeout Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/moment"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-moment"></script>
    <style>
        .container {
            width: 90%;
            margin: 20px auto;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-container {
            margin-bottom: 40px;
        }
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        h1, h2 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .stats {
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        .stats p {
            margin: 5px 0;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Timeout Analysis</h1>
        <div class="stats">
            <p>Total Timeouts: ${data.stats.totalTimeouts}</p>
            <p>Date Range: ${data.stats.startDate.toLocaleDateString()} to ${data.stats.endDate.toLocaleDateString()}</p>
            <p>Days Covered: ${data.stats.daysCovered}</p>
            <p>Average Timeouts per Day: ${data.stats.averagePerDay.toFixed(2)}</p>
            <p>Maximum Timeouts in a Day: ${data.stats.maxPerDay}</p>
        </div>

        <div class="chart-container">
            <h2>Cumulative Timeouts Over Time</h2>
            <canvas id="cumulativeChart"></canvas>
        </div>

        <div class="chart-container">
            <h2>Daily Timeout Frequency</h2>
            <canvas id="frequencyChart"></canvas>
        </div>
    </div>
    <script>
        // Cumulative Chart
        const ctxCumulative = document.getElementById('cumulativeChart').getContext('2d');
        new Chart(ctxCumulative, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Cumulative Timeouts',
                    data: ${JSON.stringify(data.cumulativePoints)},
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM D, YYYY'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Total Timeouts'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return \`Total Timeouts: \${context.parsed.y}\`;
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        });

        // Frequency Chart
        const ctxFrequency = document.getElementById('frequencyChart').getContext('2d');
        new Chart(ctxFrequency, {
            type: 'bar',
            data: {
                datasets: [{
                    label: 'Daily Timeouts',
                    data: ${JSON.stringify(data.frequencyPoints)},
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM D, YYYY'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Timeouts'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return \`Timeouts: \${context.parsed.y}\`;
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    </script>
</body>
</html>`;
}
