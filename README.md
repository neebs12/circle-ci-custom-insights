# CircleCI Insights

This tool fetches and analyzes CircleCI pipeline data with support for pagination and date-based filtering.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export API_TOKEN="your-circle-ci-token"
export ORG_SLUG="your-org/repo"
export PROJECT_NAME="your-project"
```

## Usage

Run the tool:
```bash
npm run start:dev
```

The default configuration will:
- Fetch pipelines from the last 7 days
- Limit to 100 items maximum
- Display basic statistics about pipeline states

## Customization

You can modify the following parameters in `src/index.ts`:

1. Date Range:
```typescript
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7); // Change -7 to desired number of days
```

2. Maximum Items:
```typescript
const options: FetchOptions = {
  startDate,
  endDate,
  maxItems: 100 // Change to desired limit
};
```

## Features

- Paginated API calls to handle large datasets
- Date range filtering
- Maximum item limit
- Automatic pagination handling
- Type-safe implementation with TypeScript
- Basic error handling and logging
- Pipeline state statistics

## Output

The tool will output:
1. Total number of pipelines found in the specified date range
2. Breakdown of pipelines by state (e.g., success, failed, canceled)
