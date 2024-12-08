export const baseChartOptions = {
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
        legend: {
            position: 'top'
        }
    }
};

export const generateChartConfigs = (colors: string[]) => ({
    cumulative: {
        type: 'line',
        options: {
            ...baseChartOptions,
            plugins: {
                ...baseChartOptions.plugins,
                tooltip: {
                    callbacks: {
                        label: (context: any) => `Total Timeouts: ${context.parsed.y}`
                    }
                }
            }
        }
    },
    frequency: {
        type: 'bar',
        options: {
            ...baseChartOptions,
            plugins: {
                ...baseChartOptions.plugins,
                tooltip: {
                    callbacks: {
                        label: (context: any) => `Timeouts: ${context.parsed.y}`
                    }
                }
            }
        }
    },
    typeFrequency: {
        type: 'bar',
        options: {
            ...baseChartOptions,
            scales: {
                ...baseChartOptions.scales,
                x: {
                    ...baseChartOptions.scales.x,
                    stacked: true
                },
                y: {
                    ...baseChartOptions.scales.y,
                    stacked: true
                }
            },
            plugins: {
                ...baseChartOptions.plugins,
                tooltip: {
                    callbacks: {
                        label: (context: any) => `${context.dataset.label}: ${context.parsed.y}`
                    }
                }
            }
        }
    }
});
