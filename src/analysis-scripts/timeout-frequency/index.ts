import fs from 'fs/promises';
import path from 'path';
import { TimeoutAnalysisResult } from '../../types';
import { processTimeoutData } from './data-processor';
import { generateHtmlTemplate } from './template-generator';

async function generateTimeoutFrequencyGraph(): Promise<void> {
    try {
        // Read the timeout analysis data
        const analysisPath = path.join(process.cwd(), 'outputs', 'analysis', 'timedout.json');
        const data = await fs.readFile(analysisPath, 'utf-8');
        const timeoutData: TimeoutAnalysisResult = JSON.parse(data);

        // Process the data
        const processedData = processTimeoutData(timeoutData);

        // Generate HTML content
        const htmlContent = generateHtmlTemplate(processedData);

        // Create the output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'outputs', 'analysis');
        await fs.mkdir(outputDir, { recursive: true });

        // Write the HTML file
        const htmlPath = path.join(outputDir, 'timeout-frequency.html');
        await fs.writeFile(htmlPath, htmlContent);

        // Log results
        console.log('Timeout frequency graph generated:');
        console.log(`- ${htmlPath}`);
        console.log(`Total timeouts analyzed: ${processedData.stats.totalTimeouts}`);
        console.log(`Date range: ${processedData.stats.startDate.toLocaleDateString()} to ${processedData.stats.endDate.toLocaleDateString()} (${processedData.stats.daysCovered} days)`);
        console.log(`Average timeouts per day: ${processedData.stats.averagePerDay.toFixed(2)}`);
        console.log(`Maximum timeouts in a day: ${processedData.stats.maxPerDay}`);

    } catch (error) {
        console.error('Failed to generate timeout frequency graph:', error);
        process.exit(1);
    }
}

// Execute the analysis
generateTimeoutFrequencyGraph();
