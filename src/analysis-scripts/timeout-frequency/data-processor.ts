import { TimeoutAnalysisResult } from '../../types';

export interface DataPoint {
    x: string;
    y: number;
}

export interface ProcessedData {
    cumulativePoints: DataPoint[];
    frequencyPoints: DataPoint[];
    stats: {
        totalTimeouts: number;
        startDate: Date;
        endDate: Date;
        daysCovered: number;
        averagePerDay: number;
        maxPerDay: number;
    };
}

export function processTimeoutData(timeoutData: TimeoutAnalysisResult): ProcessedData {
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

    // Calculate statistics
    const startDate = new Date(sortedEntries[0].start_time);
    const endDate = new Date(sortedEntries[sortedEntries.length - 1].start_time);
    const daysCovered = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
        cumulativePoints,
        frequencyPoints,
        stats: {
            totalTimeouts: timeoutData.entries.length,
            startDate,
            endDate,
            daysCovered,
            averagePerDay: timeoutData.entries.length / daysCovered,
            maxPerDay: Math.max(...Object.values(dailyFrequency))
        }
    };
}
