# CircleCI Insights

A tool for analyzing CircleCI pipeline timeouts.

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd cci-insights
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the template:
```bash
cp .env.sample .env
```

4. Configure your environment variables in `.env`:
```
API_TOKEN=your-circle-ci-token
ORG_SLUG=your-org/repo
PROJECT_NAME=your-project
```

Required variables:
- `API_TOKEN`: Your CircleCI API token (generate at CircleCI Dashboard > User Settings > Personal API Tokens)
- `ORG_SLUG`: Your organization/repository slug (e.g., "myorg/myrepo")
- `PROJECT_NAME`: Your CircleCI project name

## Usage

The analysis is performed through a sequence of commands that represent an ETL pipeline:

### 1. Extract Raw Data

```bash
npm run start:clear
```

This command:
- Clears previous output data
- Extracts raw job details from CircleCI for the timeframe specified in your `.env`
- Stores the raw data for further analysis

### 2. Transform: Timeout Analysis

```bash
npm run start:analysis:timedout
```

This command:
- Analyzes the extracted data specifically for timeouts
- Generates:
  - `outputs/analysis/timedout.json`: Detailed timeout data
  - `outputs/analysis/timedout-tree.yaml`: Hierarchical view of timeout classifications

### 3. Load: Generate Visualizations

```bash
npm run start:analysis:timeout-frequency
```

This command:
- Takes the timeout analysis and generates interactive visualizations
- Creates `outputs/analysis/timeout-frequency.html` with:
  - Cumulative timeout trends
  - Daily timeout frequency
  - Type-based timeout breakdown
  - Time range filtering (3, 6, 9 months, 1 year)

### End-to-End Analysis

To run the complete ETL pipeline, execute the commands sequentially:

```bash
npm run start:clear && npm run start:analysis:timedout && npm run start:analysis:timeout-frequency
```

## Output Files

The analysis generates several files in `outputs/analysis/`:

- `timedout.json`: Raw timeout analysis data
- `timedout-tree.yaml`: Hierarchical classification of timeouts
- `timeout-frequency.html`: Interactive timeout visualizations
- `analysis.log`: Error logging during analysis execution

## Development

The project is organized into modules:

- `src/analysis-scripts/`: Analysis implementations
- `src/services/`: CircleCI API service integrations
- `src/types.ts`: TypeScript type definitions
- `src/index.ts`: Main data extraction
- `src/analysis-timedout.ts`: Timeout analysis
- `src/clear-outputs.ts`: Output directory management

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
