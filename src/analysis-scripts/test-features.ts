import { JobDetail, TestFeatureAnalysis } from '../types';

export function getBaseFilename(filename: string): string {
  // Remove the job number prefix (everything before and including the first hyphen)
  return filename.replace(/^\d+-/, '');
}

export function updateTestFeatureAnalysis(
  analysis: TestFeatureAnalysis,
  jobFileName: string,
  jobDetail: JobDetail
): void {
  if (jobFileName.match(/.*test_features\.json$/)) {
    const baseFilename = getBaseFilename(jobFileName);
    if (!analysis[baseFilename]) {
      analysis[baseFilename] = { total: 0 };
    }
    analysis[baseFilename].total++;
    
    const status = jobDetail.status;
    if (!analysis[baseFilename][status]) {
      analysis[baseFilename][status] = 0;
    }
    analysis[baseFilename][status]++;
  }
}

export function logTestFeatureAnalysis(analysis: TestFeatureAnalysis): void {
  console.log('\nAnalysis of test_features jobs:');
  Object.entries(analysis).forEach(([filename, counts]) => {
    console.log(`- ${filename}`);
    console.log(`  - Total: ${counts.total}`);
    Object.entries(counts).forEach(([status, count]) => {
      if (status !== 'total') {
        console.log(`  - ${status}: ${count}`);
      }
    });
  });
}
