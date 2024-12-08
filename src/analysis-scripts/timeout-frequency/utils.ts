export function generateColors(count: number): string[] {
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

export function truncateText(text: string, maxLength: number = 50): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

export function filterDataByTimeframe(data: any[], timeframe: string): any[] {
    const now = new Date();
    let cutoffDate;

    switch(timeframe) {
        case '3m':
            cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
        case '6m':
            cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
        case '1y':
            cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            return data;
    }

    return data.filter(point => new Date(point.x) >= cutoffDate);
}

export function generateChartScript(data: any, colors: string[]): string {
    return `
        let cumulativeChart, frequencyChart, typeFrequencyChart;
        const allData = {
            cumulative: ${JSON.stringify(data.cumulativePoints)},
            frequency: ${JSON.stringify(data.frequencyPoints)},
            typeFrequency: ${JSON.stringify(data.typeFrequencyPoints.map((typeData: any, index: number) => ({
                label: truncateText(typeData.type),
                data: typeData.data,
                backgroundColor: colors[index],
                borderColor: colors[index],
                borderWidth: 1
            })))}
        };

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
                case '1y':
                    cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    return data;
            }

            return data.filter(point => new Date(point.x) >= cutoffDate);
        }
    `;
}
