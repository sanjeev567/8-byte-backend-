import express from "express";
import { config } from "dotenv";

config();
const app = express();

import cors from "cors";

import axios from "axios";
import yahooFinance from "yahoo-finance2";
import cheerio from "cheerio";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://8-byte-frontend.vercel.app",
      "https://8-byte-backend-gq6ypepsl-sanjeev-singhs-projects-9411e7d3.vercel.app",
    ],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

// GET /api/yahoo-cmp?symbol=XYZ
app.get("/api/yahoo-cmp", async (req, res) => {
  const symbol = req.query.symbol as string;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });
  try {
    const quote = await yahooFinance.quote(symbol);
    console.log("Yahoo Finance response:", quote); // Debug log

    // Handle different possible property names with proper type checking
    const cmp =
      quote.regularMarketPrice ||
      (quote as any).price ||
      (quote as any).currentPrice ||
      quote.ask ||
      quote.bid;
    const currency = quote.currency || quote.financialCurrency;
    const exchange = quote.exchange || quote.fullExchangeName;
    const name =
      quote.shortName || quote.longName || (quote as any).displayName;

    res.json({
      symbol,
      cmp: cmp,
      currency: currency,
      exchange: exchange,
      name: name,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch CMP", details: err?.toString() });
  }
});

// GET /api/google-finance?symbol=XYZ
app.get("/api/google-finance", async (req, res) => {
  const symbol = req.query.symbol as string;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });
  try {
    // Try multiple approaches to get the data
    let peRatio = null;
    let latestEarnings = null;

    // Approach 1: Try Google Finance
    try {
      const url = `https://www.google.com/finance/quote/${symbol}:NSE`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });
      const html = response.data;
      const $ = cheerio.load(html);

      // Look for P/E ratio in various possible locations
      $("*").each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes("P/E ratio") && !peRatio) {
          const parent = $(el).parent();
          const siblings = parent.siblings();
          siblings.each((_, sibling) => {
            const siblingText = $(sibling).text().trim();
            if (/^\d+(\.\d+)?$/.test(siblingText)) {
              peRatio = siblingText;
              return false;
            }
          });
        }
        if (text.includes("Earnings per share") && !latestEarnings) {
          const parent = $(el).parent();
          const siblings = parent.siblings();
          siblings.each((_, sibling) => {
            const siblingText = $(sibling).text().trim();
            if (/^[\d.-]+$/.test(siblingText)) {
              latestEarnings = siblingText;
              return false;
            }
          });
        }
      });
    } catch (googleError) {
      console.log("Google Finance failed:", googleError.message);
    }

    // Approach 2: Fallback to Yahoo Finance for P/E ratio
    if (!peRatio) {
      try {
        const quote = await yahooFinance.quoteSummary(symbol + ".NS", {
          modules: ["defaultKeyStatistics", "earnings"],
        });
        if (quote.defaultKeyStatistics?.forwardPE) {
          peRatio = quote.defaultKeyStatistics.forwardPE.toString();
        } else if (quote.defaultKeyStatistics?.trailingEps) {
          peRatio = quote.defaultKeyStatistics.trailingEps.toString();
        }
        if (quote.earnings?.earningsChart?.quarterly?.length > 0) {
          const latestQuarter =
            quote.earnings.earningsChart.quarterly[
              quote.earnings.earningsChart.quarterly.length - 1
            ];
          if (latestQuarter.actual) {
            latestEarnings = latestQuarter.actual.toString();
          }
        }
      } catch (yahooError) {
        console.log("Yahoo Finance fallback failed:", yahooError.message);
      }
    }

    res.json({
      symbol,
      peRatio,
      latestEarnings,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch Google Finance data",
      details: err?.toString(),
    });
  }
});

// Sample portfolio data structure
const portfolioData = {
  "Financial Sector": [
    {
      name: "HDFC Bank",
      symbol: "HDFCBANK.NS",
      purchasePrice: 1490,
      quantity: 50,
      exchange: "NSE",
    },
    {
      name: "Bajaj Finance",
      symbol: "BAJFINANCE.NS",
      purchasePrice: 6466,
      quantity: 15,
      exchange: "NSE",
    },
    {
      name: "ICICI Bank",
      symbol: "ICICIBANK.NS",
      purchasePrice: 780,
      quantity: 84,
      exchange: "NSE",
    },
    {
      name: "Bajaj Housing",
      symbol: "BAJAJHFL.NS",
      purchasePrice: 130,
      quantity: 504,
      exchange: "NSE",
    },
    {
      name: "Savani Financials",
      symbol: "SAVANI.NS",
      purchasePrice: 24,
      quantity: 1080,
      exchange: "NSE",
    },
  ],
  "Technology Sector": [
    {
      name: "Affle India",
      symbol: "AFFLE.NS",
      purchasePrice: 1151,
      quantity: 50,
      exchange: "NSE",
    },
    {
      name: "LTI Mindtree",
      symbol: "LTIM.NS",
      purchasePrice: 4775,
      quantity: 16,
      exchange: "NSE",
    },
    {
      name: "KPIT Tech",
      symbol: "KPIT.NS",
      purchasePrice: 672,
      quantity: 61,
      exchange: "NSE",
    },
  ],
  "Healthcare Sector": [
    {
      name: "Sun Pharma",
      symbol: "SUNPHARMA.NS",
      purchasePrice: 900,
      quantity: 12,
      exchange: "NSE",
    },
    {
      name: "Dr Reddy's",
      symbol: "DRREDDY.NS",
      purchasePrice: 4500,
      quantity: 6,
      exchange: "NSE",
    },
  ],
};

// Helper function to get stock data
async function getStockData(symbol: string) {
  try {
    // Get CMP from Yahoo Finance
    const quote = await yahooFinance.quote(symbol);
    const cmp =
      quote.regularMarketPrice || (quote as any).price || quote.ask || 0;

    // Get P/E and earnings data
    let peRatio = null;
    let latestEarnings = null;

    try {
      const quoteSummary = await yahooFinance.quoteSummary(symbol, {
        modules: ["defaultKeyStatistics", "earnings"],
      });

      if (quoteSummary.defaultKeyStatistics?.forwardPE) {
        peRatio = quoteSummary.defaultKeyStatistics.forwardPE;
      } else if (quoteSummary.defaultKeyStatistics?.pegRatio) {
        peRatio = quoteSummary.defaultKeyStatistics.pegRatio;
      }

      if (quoteSummary.defaultKeyStatistics?.trailingEps) {
        latestEarnings = quoteSummary.defaultKeyStatistics.trailingEps;
      }
    } catch (err) {
      console.log(`Failed to get detailed data for ${symbol}:`, err.message);
    }

    return { cmp, peRatio, latestEarnings };
  } catch (err) {
    console.log(`Failed to get stock data for ${symbol}:`, err.message);
    return { cmp: 0, peRatio: null, latestEarnings: null };
  }
}

// GET /api/portfolio - Returns complete portfolio with all calculations
app.get("/api/portfolio", async (req, res) => {
  try {
    const result = {};
    let totalPortfolioValue = 0;
    let totalInvestment = 0;

    // First pass: calculate total investment for portfolio percentage
    for (const [sector, stocks] of Object.entries(portfolioData)) {
      for (const stock of stocks) {
        totalInvestment += stock.purchasePrice * stock.quantity;
      }
    }

    // Second pass: get live data and calculate all fields
    for (const [sector, stocks] of Object.entries(portfolioData)) {
      const sectorData = [];
      let sectorInvestment = 0;
      let sectorPresentValue = 0;

      for (const stock of stocks) {
        const { cmp, peRatio, latestEarnings } = await getStockData(
          stock.symbol
        );

        const investment = stock.purchasePrice * stock.quantity;
        const presentValue = cmp * stock.quantity;
        const gainLoss = presentValue - investment;
        const portfolioPercentage = (
          (investment / totalInvestment) *
          100
        ).toFixed(2);

        sectorInvestment += investment;
        sectorPresentValue += presentValue;

        sectorData.push({
          particulars: stock.name,
          symbol: stock.symbol,
          purchasePrice: stock.purchasePrice,
          quantity: stock.quantity,
          investment: investment,
          portfolioPercentage: portfolioPercentage + "%",
          exchange: stock.exchange,
          cmp: cmp,
          presentValue: presentValue,
          gainLoss: gainLoss,
          gainLossColor: gainLoss >= 0 ? "green" : "red",
          peRatio: peRatio,
          latestEarnings: latestEarnings,
          rand: Math.random().toString(36).substring(7), // Unique identifier
        });
      }

      const sectorGainLoss = sectorPresentValue - sectorInvestment;

      result[sector] = {
        stocks: sectorData,
        summary: {
          totalInvestment: sectorInvestment,
          totalPresentValue: sectorPresentValue,
          totalGainLoss: sectorGainLoss,
          gainLossColor: sectorGainLoss >= 0 ? "green" : "red",
        },
      };

      totalPortfolioValue += sectorPresentValue;
    }

    // Add overall portfolio summary
    const overallGainLoss = totalPortfolioValue - totalInvestment;
    result["portfolioSummary"] = {
      totalInvestment,
      totalPresentValue: totalPortfolioValue,
      totalGainLoss: overallGainLoss,
      gainLossColor: overallGainLoss >= 0 ? "green" : "red",
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch portfolio data",
      details: err?.toString(),
    });
  }
});

// GET /api/portfolio/:sector - Returns data for a specific sector
app.get("/api/portfolio/:sector", async (req, res) => {
  const sectorName = req.params.sector;
  const sector = Object.keys(portfolioData).find(
    (key) =>
      key.toLowerCase().replace(/\s+/g, "") ===
      sectorName.toLowerCase().replace(/\s+/g, "")
  );

  if (!sector || !portfolioData[sector]) {
    return res.status(404).json({ error: "Sector not found" });
  }

  try {
    const stocks = portfolioData[sector];
    const result = [];
    let sectorInvestment = 0;
    let sectorPresentValue = 0;

    // Calculate total investment for portfolio percentages
    let totalInvestment = 0;
    for (const [_, sectorStocks] of Object.entries(portfolioData)) {
      for (const stock of sectorStocks) {
        totalInvestment += stock.purchasePrice * stock.quantity;
      }
    }

    for (const stock of stocks) {
      const { cmp, peRatio, latestEarnings } = await getStockData(stock.symbol);

      const investment = stock.purchasePrice * stock.quantity;
      const presentValue = cmp * stock.quantity;
      const gainLoss = presentValue - investment;
      const portfolioPercentage = (
        (investment / totalInvestment) *
        100
      ).toFixed(2);

      sectorInvestment += investment;
      sectorPresentValue += presentValue;

      result.push({
        particulars: stock.name,
        symbol: stock.symbol,
        purchasePrice: stock.purchasePrice,
        quantity: stock.quantity,
        investment: investment,
        portfolioPercentage: portfolioPercentage + "%",
        exchange: stock.exchange,
        cmp: cmp,
        presentValue: presentValue,
        gainLoss: gainLoss,
        gainLossColor: gainLoss >= 0 ? "green" : "red",
        peRatio: peRatio,
        latestEarnings: latestEarnings,
      });
    }

    const sectorGainLoss = sectorPresentValue - sectorInvestment;

    res.json({
      sector: sector,
      stocks: result,
      summary: {
        totalInvestment: sectorInvestment,
        totalPresentValue: sectorPresentValue,
        totalGainLoss: sectorGainLoss,
        gainLossColor: sectorGainLoss >= 0 ? "green" : "red",
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch sector data",
      details: err?.toString(),
    });
  }
});

const port = process.env.PORT || 8000;
app.get("/", (req, res) => {
  res.send(
    "Portfolio Dashboard Backend API - Available endpoints: /api/portfolio, /api/portfolio/:sector, /api/yahoo-cmp, /api/google-finance"
  );
});

app.listen(port, () => console.log("backend running at port " + port));
