export const styles = `
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
    .timeframe-selector {
        text-align: center;
        margin-bottom: 20px;
    }
    .timeframe-selector select {
        padding: 8px 16px;
        font-size: 14px;
        border-radius: 4px;
        border: 1px solid #ddd;
        background-color: white;
        cursor: pointer;
    }
    .timeframe-selector select:focus {
        outline: none;
        border-color: #80bdff;
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
`;
