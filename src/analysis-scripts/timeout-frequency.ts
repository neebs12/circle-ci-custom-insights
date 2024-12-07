import fs from 'fs/promises';
import path from 'path';
import { TimeoutAnalysisResult } from '../types';

async function generateTimeoutFrequencyGraph(): Promise<void> {
    try {
        // Read the timeout analysis data
        const analysisPath = path.join(process.cwd(), 'outputs', 'analysis', 'timedout.json');
        const data = await fs.readFile(analysisPath, 'utf-8');
        const timeoutData: TimeoutAnalysisResult = JSON.parse(data);

        // Sort entries by start_time
        const sortedEntries = timeoutData.entries.sort((a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        // Generate cumulative data points
        const cumulativePoints = sortedEntries.map((entry, index) => ({
            x: entry.start_time,
            y: index + 1
        }));

        // Generate daily frequency data
        const dailyFrequency: { [key: string]: number } = {};
        sortedEntries.forEach(entry => {
            const date = new Date(entry.start_time).toISOString().split('T')[0];
            dailyFrequency[date] = (dailyFrequency[date] || 0) + 1;
        });

        const frequencyPoints = Object.entries(dailyFrequency).map(([date, count]) => ({
            x: date,
            y: count
        }));

        // Create the HTML content with Chart.js
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Timeout Frequency Analysis</title>
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
            <p>Total Timeouts: ${timeoutData.entries.length}</p>
            ${timeoutData.entries.length > 0 ? `
                <p>Date Range: ${new Date(sortedEntries[0].start_time).toLocaleDateString()} to ${new Date(sortedEntries[sortedEntries.length - 1].start_time).toLocaleDateString()}</p>
                <p>Days Covered: ${Math.round((new Date(sortedEntries[sortedEntries.length - 1].start_time).getTime() - new Date(sortedEntries[0].start_time).getTime()) / (1000 * 60 * 60 * 24))}</p>
                <p>Average Timeouts per Day: ${(timeoutData.entries.length / Math.round((new Date(sortedEntries[sortedEntries.length - 1].start_time).getTime() - new Date(sortedEntries[0].start_time).getTime()) / (1000 * 60 * 60 * 24))).toFixed(2)}</p>
                <p>Maximum Timeouts in a Day: ${Math.max(...Object.values(dailyFrequency))}</p>
            ` : ''}
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
                    data: ${JSON.stringify(cumulativePoints)},
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
                    data: ${JSON.stringify(frequencyPoints)},
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

        // Create the output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'outputs', 'analysis');
        await fs.mkdir(outputDir, { recursive: true });

        // Write the HTML file
        const htmlPath = path.join(outputDir, 'timeout-frequency.html');
        await fs.writeFile(htmlPath, htmlContent);

        console.log('Timeout frequency graph generated:');
        console.log(`- ${htmlPath}`);
        console.log(`Total timeouts analyzed: ${timeoutData.entries.length}`);

        if (timeoutData.entries.length > 0) {
            const firstDate = new Date(sortedEntries[0].start_time);
            const lastDate = new Date(sortedEntries[sortedEntries.length - 1].start_time);
            const daysDiff = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

            console.log(`Date range: ${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()} (${daysDiff} days)`);
            console.log(`Average timeouts per day: ${(timeoutData.entries.length / daysDiff).toFixed(2)}`);
            console.log(`Maximum timeouts in a day: ${Math.max(...Object.values(dailyFrequency))}`);
        }

    } catch (error) {
        console.error('Failed to generate timeout frequency graph:', error);
        process.exit(1);
    }
}

// Execute the analysis
generateTimeoutFrequencyGraph();
