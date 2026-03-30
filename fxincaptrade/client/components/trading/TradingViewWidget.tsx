import React, { useMemo } from "react";

// Maps internal symbols to TradingView symbol format
const TV_SYMBOL: Record<string, string> = {
    EURUSD: "FX:EURUSD",
    GBPUSD: "FX:GBPUSD",
    USDJPY: "FX:USDJPY",
    AUDUSD: "FX:AUDUSD",
    USDCAD: "FX:USDCAD",
    USDCHF: "FX:USDCHF",
    NZDUSD: "FX:NZDUSD",
    EURGBP: "FX:EURGBP",
    XAUUSD: "TVC:GOLD",
    XAGUSD: "TVC:SILVER",
    BTCUSDT: "BINANCE:BTCUSDT",
    ETHUSDT: "BINANCE:ETHUSDT",
};

type TradingViewWidgetProps = {
    symbol: string;
    theme?: "dark" | "light";
  interval?: string;
};

/**
 * Renders TradingView Advanced Chart inside an iframe so the embed script
 * is fully isolated from React's DOM lifecycle. This avoids the
 * "Cannot read properties of null (reading 'querySelector')" error that
 * occurs when React StrictMode unmounts/remounts while the async script
 * is still initialising.
 */
export default function TradingViewWidget({ symbol, theme = "dark", interval = "60" }: TradingViewWidgetProps) {
    const tvSymbol = TV_SYMBOL[symbol.toUpperCase()] ?? `FX:${symbol}`;

    const config = JSON.stringify({
        autosize: true,
        symbol: tvSymbol,
        interval,
        timezone: "Etc/UTC",
        theme,
        style: "1",
        locale: "en",
        backgroundColor: "rgba(0,0,0,1)",
        gridColor: "rgba(255,255,255,0.06)",
        allow_symbol_change: false,
        calendar: false,
        support_host: "https://www.tradingview.com",
    });

    const srcDoc = useMemo(
        () => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
  .tradingview-widget-container{width:100%;height:100%}
  .tradingview-widget-container__widget{width:100%;height:calc(100% - 32px)}
</style>
</head>
<body>
<div class="tradingview-widget-container">
  <div class="tradingview-widget-container__widget"></div>
  <div class="tradingview-widget-copyright">
    <a href="https://www.tradingview.com/" rel="noopener noreferrer nofollow" target="_blank">
      <span style="color:#2962ff;font-size:11px">Track all markets on TradingView</span>
    </a>
  </div>
  <script type="text/javascript"
    src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    async>${config}</script>
</div>
</body>
</html>`,
        [config]
    );

    return (
        <iframe
          key={`${tvSymbol}-${interval}`}
            srcDoc={srcDoc}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title={`Chart ${symbol}`}
        />
    );
}
