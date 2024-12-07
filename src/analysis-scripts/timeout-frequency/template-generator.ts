import { ProcessedData } from './data-processor';

// Generate a color for each type
function generateColors(count: number): string[] {
    const colors = [
        'rgb(255, 99, 132)',   // red
        'rgb(54, 162, 235)',   // blue
        'rgb(255, 206, 86)',   // yellow
        'rgb(75, 192, 192)',   // teal
        'rgb(153, 102, 255)',  // purple
        'rgb(255, 159, 64)',   // orange
        'rgb(199, 199, 199)'   // gray
    ];

    // If we need more colors than available, generate them
    while (colors.length < count) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        colors.push(`rgb(${r}, ${g}, ${b})`);
    }

    return colors;
}

export function generateHtmlTemplate(data: ProcessedData): string {
    const colors = generateColors(data.typeFrequencyPoints.length);
    const typeBreakdownHtml = Object.entries(data.stats.typeBreakdown)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .map(([type, count]) => `
            <p>${type}: ${count} (${((count / data.stats.totalTimeouts) * 100).toFixed(1)}%)</p>
        `).join('');

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
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .type-breakdown {
            background-color: #fff;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
        }
    </style>
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

        // Type Frequency Chart
        const ctxTypeFrequency = document.getElementById('typeFrequencyChart').getContext('2d');
        new Chart(ctxTypeFrequency, {
            type: 'bar',
            data: {
                datasets: ${JSON.stringify(data.typeFrequencyPoints.map((typeData, index) => ({
                    label: typeData.type,
                    data: typeData.data,
                    backgroundColor: colors[index] + '80',  // Add transparency
                    borderColor: colors[index],
                    borderWidth: 1
                })))}
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
                        },
                        stacked: true
                    },
                    y: {
                        beginAtZero: true,
                        stacked: true,
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
                                return \`\${context.dataset.label}: \${context.parsed.y}\`;
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
