"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const cheerio_1 = __importDefault(require("cheerio"));
// Configure CORS to allow requests from your frontend
const corsOptions = {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Explicit preflight handler for all routes
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.sendStatus(200);
});
// GET /api/yahoo-cmp?symbol=XYZ
app.get("/api/yahoo-cmp", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const symbol = req.query.symbol;
    if (!symbol)
        return res.status(400).json({ error: "Missing symbol" });
    try {
        const quote = yield yahoo_finance2_1.default.quote(symbol);
        console.log("Yahoo Finance response:", quote); // Debug log
        // Handle different possible property names with proper type checking
        const cmp = quote.regularMarketPrice ||
            quote.price ||
            quote.currentPrice ||
            quote.ask ||
            quote.bid;
        const currency = quote.currency || quote.financialCurrency;
        const exchange = quote.exchange || quote.fullExchangeName;
        const name = quote.shortName || quote.longName || quote.displayName;
        res.json({
            symbol,
            cmp: cmp,
            currency: currency,
            exchange: exchange,
            name: name,
        });
    }
    catch (err) {
        res
            .status(500)
            .json({ error: "Failed to fetch CMP", details: err === null || err === void 0 ? void 0 : err.toString() });
    }
}));
// GET /api/google-finance?symbol=XYZ
app.get("/api/google-finance", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const symbol = req.query.symbol;
    if (!symbol)
        return res.status(400).json({ error: "Missing symbol" });
    try {
        // Try multiple approaches to get the data
        let peRatio = null;
        let latestEarnings = null;
        // Approach 1: Try Google Finance
        try {
            const url = `https://www.google.com/finance/quote/${symbol}:NSE`;
            const response = yield axios_1.default.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            });
            const html = response.data;
            const $ = cheerio_1.default.load(html);
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
        }
        catch (googleError) {
            console.log("Google Finance failed:", googleError.message);
        }
        // Approach 2: Fallback to Yahoo Finance for P/E ratio
        if (!peRatio) {
            try {
                const quote = yield yahoo_finance2_1.default.quoteSummary(symbol + ".NS", {
                    modules: ["defaultKeyStatistics", "earnings"],
                });
                if ((_a = quote.defaultKeyStatistics) === null || _a === void 0 ? void 0 : _a.forwardPE) {
                    peRatio = quote.defaultKeyStatistics.forwardPE.toString();
                }
                else if ((_b = quote.defaultKeyStatistics) === null || _b === void 0 ? void 0 : _b.trailingEps) {
                    peRatio = quote.defaultKeyStatistics.trailingEps.toString();
                }
                if (((_e = (_d = (_c = quote.earnings) === null || _c === void 0 ? void 0 : _c.earningsChart) === null || _d === void 0 ? void 0 : _d.quarterly) === null || _e === void 0 ? void 0 : _e.length) > 0) {
                    const latestQuarter = quote.earnings.earningsChart.quarterly[quote.earnings.earningsChart.quarterly.length - 1];
                    if (latestQuarter.actual) {
                        latestEarnings = latestQuarter.actual.toString();
                    }
                }
            }
            catch (yahooError) {
                console.log("Yahoo Finance fallback failed:", yahooError.message);
            }
        }
        res.json({
            symbol,
            peRatio,
            latestEarnings,
        });
    }
    catch (err) {
        res.status(500).json({
            error: "Failed to fetch Google Finance data",
            details: err === null || err === void 0 ? void 0 : err.toString(),
        });
    }
}));
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
function getStockData(symbol) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            // Get CMP from Yahoo Finance
            const quote = yield yahoo_finance2_1.default.quote(symbol);
            const cmp = quote.regularMarketPrice || quote.price || quote.ask || 0;
            // Get P/E and earnings data
            let peRatio = null;
            let latestEarnings = null;
            try {
                const quoteSummary = yield yahoo_finance2_1.default.quoteSummary(symbol, {
                    modules: ["defaultKeyStatistics", "earnings"],
                });
                if ((_a = quoteSummary.defaultKeyStatistics) === null || _a === void 0 ? void 0 : _a.forwardPE) {
                    peRatio = quoteSummary.defaultKeyStatistics.forwardPE;
                }
                else if ((_b = quoteSummary.defaultKeyStatistics) === null || _b === void 0 ? void 0 : _b.pegRatio) {
                    peRatio = quoteSummary.defaultKeyStatistics.pegRatio;
                }
                if ((_c = quoteSummary.defaultKeyStatistics) === null || _c === void 0 ? void 0 : _c.trailingEps) {
                    latestEarnings = quoteSummary.defaultKeyStatistics.trailingEps;
                }
            }
            catch (err) {
                console.log(`Failed to get detailed data for ${symbol}:`, err.message);
            }
            return { cmp, peRatio, latestEarnings };
        }
        catch (err) {
            console.log(`Failed to get stock data for ${symbol}:`, err.message);
            return { cmp: 0, peRatio: null, latestEarnings: null };
        }
    });
}
// GET /api/portfolio - Returns complete portfolio with all calculations
app.get("/api/portfolio", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
                const { cmp, peRatio, latestEarnings } = yield getStockData(stock.symbol);
                const investment = stock.purchasePrice * stock.quantity;
                const presentValue = cmp * stock.quantity;
                const gainLoss = presentValue - investment;
                const portfolioPercentage = ((investment / totalInvestment) *
                    100).toFixed(2);
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
    }
    catch (err) {
        res.status(500).json({
            error: "Failed to fetch portfolio data",
            details: err === null || err === void 0 ? void 0 : err.toString(),
        });
    }
}));
// GET /api/portfolio/:sector - Returns data for a specific sector
app.get("/api/portfolio/:sector", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sectorName = req.params.sector;
    const sector = Object.keys(portfolioData).find((key) => key.toLowerCase().replace(/\s+/g, "") ===
        sectorName.toLowerCase().replace(/\s+/g, ""));
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
            const { cmp, peRatio, latestEarnings } = yield getStockData(stock.symbol);
            const investment = stock.purchasePrice * stock.quantity;
            const presentValue = cmp * stock.quantity;
            const gainLoss = presentValue - investment;
            const portfolioPercentage = ((investment / totalInvestment) *
                100).toFixed(2);
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
    }
    catch (err) {
        res.status(500).json({
            error: "Failed to fetch sector data",
            details: err === null || err === void 0 ? void 0 : err.toString(),
        });
    }
}));
const port = process.env.PORT || 8000;
app.get("/", (req, res) => {
    res.send("Portfolio Dashboard Backend API - Available endpoints: /api/portfolio, /api/portfolio/:sector, /api/yahoo-cmp, /api/google-finance");
});
app.listen(port, () => console.log("backend running at port " + port));
