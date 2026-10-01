const { askAgent } =
    require("./services/azureAgent");

const express = require("express");
const axios = require("axios");
const session = require("express-session");

const app = express();
app.use(express.json());

// =================================
// Session configuration
// =================================
app.use(
    session({
        secret: "my-super-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // true when using HTTPS
            httpOnly: true,
            maxAge: 60 * 60 * 1000 // 1 hour
        }
    })
);
// =================================
// Login Endpoint
// =================================
app.post("/login", async (req, res) => {

    const { username, password } = req.body;

    try {

        const authHeader =
            "Basic " +
            Buffer.from(
                `${username}:${password}`
            ).toString("base64");

        await axios.get(
            `${ODATA_URL}$metadata`,
            {
                headers: {
                    Authorization: authHeader,
                    "sap-client": "800"
                }
            }
        );

        req.session.sapAuth = authHeader;

        res.json({
            success: true
        });

    } catch (err) {

        res.status(401).json({
            success: false
        });
    }
});

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});
// =================================
// CONFIG
// =================================
const ODATA_URL =
    "https://vhbnubsdci.rise.brother.com:44300/sap/opu/odata/sap/ZB_WARRANTY_SB/";
// =================================
// Parse SAP Date
// Handles /Date(...)/ format
// =================================

function parseSAPDate(sapDate) {
    if (!sapDate) return null;

    const timestamp = sapDate.match(/\d+/);

    if (!timestamp) return null;

    return new Date(Number(timestamp[0]));
}    
// =================================
//Helper function for invalid AI answers
// =================================
function getSafeAnswer(aiAnswer, fallbackAnswer) {

    if (!aiAnswer) {
        return fallbackAnswer;
    }

    const invalidPatterns = [
        "SEARCH:",
        "created_at_h",
        "bpnumber",
        "country=",
        "serial=",
        "equnr=",
        "object_id=",
        "model=",
        "zz1_contracttype_srh=",
        "country:",
        "serial:",
        "bpnumber:",
        "equnr:",
        "object_id:"
    ];

    const containsInternalCommand =
        invalidPatterns.some(pattern =>
            aiAnswer
                .toUpperCase()
                .includes(pattern.toUpperCase())
        );

    return containsInternalCommand
        ? fallbackAnswer
        : aiAnswer;
}
// =================================
// Building SAP OData
// =================================
function buildODataFilter(filters) {

    const conditions = [];

    Object.entries(filters).forEach(
        ([field, value]) => {

            switch (field) {

                case "serial":
                    conditions.push(
                        `serial eq '${value}'`
                    );
                    break;

                case "bpnumber":
                    conditions.push(
                        `bpnumber eq '${value}'`
                    );
                    break;

                case "equnr":
                    conditions.push(
                        `equnr eq '${value}'`
                    );
                    break;

                case "country":
                    conditions.push(
                        `country eq '${value}'`
                    );
                    break;

                case "model":
                    conditions.push(
                        `model eq '${value}'`
                    );
                    break;

                case "object_id":
                    conditions.push(
                        `object_id eq '${value}'`
                    );
                    break;

                case "zz1_contracttype_srh":
                    conditions.push(
                        `zz1_contracttype_srh eq '${value}'`
                    );
                    break;

                case "created_at_h":

                    if (
                        typeof value === "object"
                    ) {

                        if (value.gte) {

                            conditions.push(
                                `created_at_h ge datetime'${value.gte}T00:00:00'`
                            );
                        }

                        if (value.lte) {

                            conditions.push(
                                `created_at_h le datetime'${value.lte}T23:59:59'`
                            );
                        }

                        if (value.gt) {

                            conditions.push(
                                `created_at_h gt datetime'${value.gt}T00:00:00'`
                            );
                        }

                        if (value.lt) {

                            conditions.push(
                                `created_at_h lt datetime'${value.lt}T23:59:59'`
                            );
                        }

                    }
                    else {

                        conditions.push(
                            `created_at_h eq datetime'${value}T00:00:00'`
                        );
                    }

                    break;
            }
        }
    );

    return conditions.join(
        " and "
    );
}
// =================================
//Helper function for Contract Created Dates
// =================================
function getRelativeDateRange(value) {

    if (!value) return null;

    const text =
        value.toLowerCase().trim();

    const today = new Date();

    const formatDate = date =>
        date.toISOString().split("T")[0];

    // TODAY
    if (text === "today") {
        return {
            gte: formatDate(today),
            lte: formatDate(today)
        };
    }

    // YESTERDAY
    if (text === "yesterday") {
        const start = new Date(today);
        start.setDate(start.getDate() - 1);
        return {
            gte: formatDate(start),
            lte: formatDate(start)
        };
    }

    // THIS WEEK
    if (text === "this week") {
        const start = new Date(today);
        const day =
            start.getDay();
        start.setDate(
            start.getDate() -
            day
        );
        return {
            gte: formatDate(start),
            lte: formatDate(today)
        };
    }

    // LAST WEEK / PREVIOUS WEEK
    if (
        text === "last week" ||
        text === "previous week"
    ) {
        const end = new Date(today);
        const day =
            end.getDay();
        end.setDate(
            end.getDate() -
            day -
            1
        );
        const start =
            new Date(end);
        start.setDate(
            end.getDate() - 6
        );
        return {
            gte: formatDate(start),
            lte: formatDate(end)
        };
    }

    // LAST MONTH / PREVIOUS MONTH
    if (
        text === "last month" ||
        text === "previous month"
    ) {
        const start =
            new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                1
            );
        const end =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                0
            );
        return {
            gte: formatDate(start),
            lte: formatDate(end)
        };
    }

    // LAST YEAR / PREVIOUS YEAR
    if (text === "last year" ||
        text === "previous year"
    ) {
        const start =
            new Date(
                today.getFullYear() - 1,
                0,
                1
            );
        const end =
            new Date(
                today.getFullYear() - 1,
                11,
                31
            );
        return {
            gte: formatDate(start),
            lte: formatDate(end)
        };
    }

    // LAST FEW DAYS / PAST FEW DAYS
    if (
        text === "last few days" ||
        text === "past few days"
    ) {
        const start =
            new Date(today);
        start.setDate(
            start.getDate() - 7
        );
        return {
            gte: formatDate(start),
            lte: formatDate(today)
        };
    }

    // PAST N DAYS / LAST N DAYS
    const match =
        text.match(
            /(?:past|last)\s+(\d+)\s+days?/i
        );
    if (match) {
        const days =
            Number(match[1]);
        const start =
            new Date(today);
        start.setDate(
            start.getDate() - days
        );
        return {
            gte: formatDate(start),
            lte: formatDate(today)
        };
    }
    return null;
}
function isYesterdaySapDate(sapDate) {

    if (!sapDate) return false;

    const match = sapDate.match(/\d+/);

    if (!match) return false;

    const recordDate =
        new Date(parseInt(match[0]));

    const yesterday =
        new Date();

    yesterday.setDate(
        yesterday.getDate() - 1
    );

    return (
        recordDate.getFullYear() === yesterday.getFullYear() &&
        recordDate.getMonth() === yesterday.getMonth() &&
        recordDate.getDate() === yesterday.getDate()
    );
}
async function fetchAllRecords(
    authHeader,
    odataFilter
) {

    let allResults = [];

    let nextUrl =
        `${ODATA_URL}ZB_WARRANTY_CV?$format=json`;

    if (odataFilter) {

        nextUrl +=
            `&$filter=${encodeURIComponent(
                odataFilter
            )}`;
    }

    while (nextUrl) {

        const response =
            await axios.get(
                nextUrl,
                {
                    headers: {
                        Authorization:
                            authHeader,
                        "sap-client": "800"
                    }
                }
            );

        const data =
            response.data.d;

        allResults.push(
            ...(data.results || [])
        );

        console.log(
            "Fetched:",
            allResults.length
        );

        nextUrl =
            data.__next || null;
    }

    return allResults;
}
// =================================
// Dashboard
// =================================
app.get("/api/dashboard", async (req, res) => {

    try {

        const authHeader =
            req.session.sapAuth;

        if (!authHeader) {

            return res
                .status(401)
                .json({
                    message:
                        "Please login first"
                });
        }

        const records =
            await fetchAllRecords(
                authHeader,
                ""
            );

        console.log(
            "Dashboard Records:",
            records.length
        );

        const yesterdayRecords =
            records.filter(r =>
                isYesterdaySapDate(
                    r.created_at_h
                )
            );

        const stats = {

            totalActive:
                records.length,

            totalStandard:
                records.filter(
                    r =>
                        r.zz1_contracttype_srh === "S"
                ).length,

            totalExtended:
                records.filter(
                    r =>
                        r.zz1_contracttype_srh === "X"
                ).length,

            totalBrotherPlus:
                records.filter(
                    r =>
                        r.zz1_contracttype_srh === "L"
                ).length,

            totalBrotherCare:
                records.filter(
                    r =>
                        r.zz1_contracttype_srh === "B"
                ).length,

            totalCountryUS:
                records.filter(
                    r =>
                        r.country === "US"
                ).length,

            totalCountryCA:
                records.filter(
                    r =>
                        r.country === "CA"
                ).length,

            yesterdayTotalActive:
                yesterdayRecords.length,

            yesterdayTotalStandard:
                yesterdayRecords.filter(
                    r =>
                        r.zz1_contracttype_srh === "S"
                ).length,

            yesterdayTotalExtended:
                yesterdayRecords.filter(
                    r =>
                        r.zz1_contracttype_srh === "X"
                ).length,

            yesterdayTotalBrotherPlus:
                yesterdayRecords.filter(
                    r =>
                        r.zz1_contracttype_srh === "L"
                ).length,

            yesterdayTotalBrotherCare:
                yesterdayRecords.filter(
                    r =>
                        r.zz1_contracttype_srh === "B"
                ).length,

            yesterdayTotalCountryUS:
                yesterdayRecords.filter(
                    r =>
                        r.country === "US"
                ).length,

            yesterdayTotalCountryCA:
                yesterdayRecords.filter(
                    r =>
                        r.country === "CA"
                ).length
        };

        res.json(stats);

    } catch (err) {

        console.error(
            "Dashboard Error:",
            err
        );

        res.status(500).json({
            message:
                "Dashboard load failed"
        });
    }
});
// =================================
// Warranty report
// =================================
app.get("/api/warranty-report", async (req, res) => {

    try {

        const authHeader =
            req.session.sapAuth;

        if (!authHeader) {

            return res.status(401).json({
                message: "Please login first"
            });
        }

        const filters = {};

        [
            "bpnumber",
            "equnr",
            "model",
            "serial",
            "object_id",
            "zz1_contracttype_srh",
            "country",
            "created_at_h"
        ]
            .forEach(field => {

                if (req.query[field]) {

                    filters[field] =
                        req.query[field];
                }
            });

        const odataFilter =
            buildODataFilter(filters);

        const records =
            await fetchAllRecords(
                authHeader,
                odataFilter
            );

        res.json(records);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Report failed"
        });
    }
});
// =================================
// AI Chat Assistant
// =================================
app.post("/chat", async (req, res) => {

    try {

        const question =
            req.body.question || "";

        const agentResponse =
            await askAgent(question);

        console.log(
            "AGENT RESPONSE:",
            agentResponse
        );

        const authHeader = req.session.sapAuth;

        if (!authHeader) {
            return res.status(401).json({
                answer: "Please login first."
            });
        }

        if (
            agentResponse.startsWith("SEARCH:")
        ) {

            console.log(
                "Agent wants search:",
                agentResponse
            );
        }

        // =================================
        // AI Understand Question
        // =================================

        let search = null;

        if (
            agentResponse.startsWith("SEARCH:")
        ) {

            const searchText =
                agentResponse
                    .replace("SEARCH:", "")
                    .trim();

            const filters = {};

            const normalizedSearchText =
                searchText
                    .replace(/&gt;/g, ">")
                    .replace(/&lt;/g, "<")
                    .replace(/<br\s*\/?>/gi, "")
                    .replace(/\\confidence\{\d+\}/gi, "")
                    .trim();

            normalizedSearchText
                .split("&")
                .forEach(part => {

                    const match =
                        part.match(/^(.+?)(>=|<=|>|<|=)(.+)$/);

                    if (!match) {
                        return;
                    }

                    const field = match[1].trim();
                    const operator = match[2].trim();

                    const value =
                        match[3]
                            .replace(/\\confidence\{\d+\}/g, "")
                            .trim();

                    if (field === "created_at_h") {

                        const relativeRange =
                            getRelativeDateRange(value);
                        if (relativeRange) {
                            filters.created_at_h =
                                relativeRange;
                            return;
                        }

                        if (!filters.created_at_h) {
                            filters.created_at_h = {};
                        }

                        switch (operator) {

                            case ">=":
                                filters.created_at_h.gte = value;
                                break;

                            case "<=":
                                filters.created_at_h.lte = value;
                                break;

                            case ">":
                                filters.created_at_h.gt = value;
                                break;

                            case "<":
                                filters.created_at_h.lt = value;
                                break;

                            case "=":
                                filters.created_at_h = value;
                                break;
                        }

                    } else {

                        filters[field] = value;
                    }
                });
            // Convert selected filters to uppercase
            ["serial", "country", "model"].forEach(field => {
                if (typeof filters[field] === "string") {
                    filters[field] = filters[field].toUpperCase();
                }
            });

            search = { filters };

        }

        // =================================
        // Fallback to Old Logic
        // =================================

        if (!search) {

            return res.json({
                answer: agentResponse
            });
        }

        const filters =
            search.filters;

        // =================================
        // SAP ODATA CALL
        // =================================
        const odataFilter =
            buildODataFilter(filters);

        const results =
            await fetchAllRecords(
                authHeader,
                odataFilter
            );

        console.log(
            "SAP results:",
            results.length
        );

        const totalRecords =
            results.length;

        if (results.length > 1) {
            const sapRecords =
                results.slice(0, 20).map(r => ({

                    BPNumber: r.bpnumber,

                    Equipment: r.equnr,

                    Serial: r.serial,

                    Model: r.model,

                    Country: r.country,

                    WarrantyId: r.object_id,

                    WarrantyType:
                        r.zz1_contracttype_srh,

                    WarrantyDescription:
                        r.code,

                    PurchaseDate:
                        parseSAPDate(r.purchasedate)
                            ?.toLocaleDateString("en-US") || "",

                    ContractStartDate:
                        parseSAPDate(r.contstart)
                            ?.toLocaleDateString("en-US") || "",

                    ContractEndDate:
                        parseSAPDate(r.contend)
                            ?.toLocaleDateString("en-US") || "",

                    ContractCreatedDate:
                        parseSAPDate(r.created_at_h)
                            ?.toLocaleDateString("en-US") || ""

                }));

            const aiContext = {
                totalRecords,
                records: sapRecords
            };

            const aiAnswer =
                await askAgent(
                    question,
                    JSON.stringify(
                        aiContext,
                        null,
                        2
                    )
                );

            const finalAnswer =
                getSafeAnswer(
                    aiAnswer,
                    `Found ${totalRecords} warranty record(s).`
                );

            return res.json({

                answer: finalAnswer,

                totalRecords,

                details: results.map(r => ({

                    BPNumber: r.bpnumber,

                    Equipment: r.equnr,

                    Serial: r.serial,

                    Model: r.model,

                    Country: r.country,

                    WarrantyId: r.object_id,

                    WarrantyType:
                        r.zz1_contracttype_srh,

                    WarrantyDisc:
                        r.code,

                    PurchaseDate:
                        parseSAPDate(r.purchasedate)
                            ?.toLocaleDateString("en-US") || "",

                    ContStartDate:
                        parseSAPDate(r.contstart)
                            ?.toLocaleDateString("en-US") || "",

                    ContEndDate:
                        parseSAPDate(r.contend)
                            ?.toLocaleDateString("en-US") || "",

                    ContCreatedDate:
                        parseSAPDate(r.created_at_h)
                            ?.toLocaleDateString("en-US") || ""

                }))
            });
        }

        if (!results.length) {

            return res.json({
                answer:
                    `No records found.`
            });
        }

        const data =
            results[0];

        // =================================
        // DATE CONVERSION
        // =================================

        const purchaseDate =
            parseSAPDate(data.purchasedate);

        const contStartDate =
            parseSAPDate(data.contstart);

        const contEndDate =
            parseSAPDate(data.contend);

        const contCreatedDate =
            parseSAPDate(data.created_at_h);

        const today =
            new Date();

        const purchaseText =
            purchaseDate
                ? purchaseDate.toLocaleDateString("en-US")
                : "N/A";

        const contStartText =
            contStartDate
                ? contStartDate.toLocaleDateString("en-US")
                : "N/A";

        const contEndText =
            contEndDate
                ? contEndDate.toLocaleDateString("en-US")
                : "N/A";

        const isActive =
            contEndDate &&
            contEndDate >= today;

        const contCreatedText =
            contCreatedDate
                ? contCreatedDate.toLocaleDateString("en-US")
                : "N/A";

        // =================================
        // AI GENERATED ANSWER
        // =================================

        const sapRecord = {
            BPNumber: data.bpnumber,
            Equipment: data.equnr,
            Serial: data.serial,
            Model: data.model,
            Country: data.country,
            WarrantyId: data.object_id,
            WarrantyType: data.zz1_contracttype_srh,
            WarrantyDescription: data.code,
            PurchaseDate: purchaseText,
            ContractStartDate: contStartText,
            ContractEndDate: contEndText,
            ContractCreatedDate: contCreatedText,
            WarrantyStatus:
                isActive
                    ? "ACTIVE"
                    : "EXPIRED"
        };

        const aiAnswer =
            await askAgent(
                question,
                JSON.stringify(
                    sapRecord,
                    null,
                    2
                )
            );

        const finalAnswer =
            getSafeAnswer(
                aiAnswer,
                `Warranty record found. Status: ${isActive
                    ? "ACTIVE"
                    : "EXPIRED"
                }.`
            );

        // =================================
        // RETURN TO CHAT UI
        // =================================

        return res.json({
            answer: finalAnswer,
            details: {
                BPNumber:
                    data.bpnumber,
                Equipment:
                    data.equnr,
                Serial:
                    data.serial,
                Model:
                    data.model,
                Country:
                    data.country,
                WarrantyId:
                    data.object_id,
                WarrantyType:
                    data.zz1_contracttype_srh,
                WarrantyDisc:
                    data.code,
                PurchaseDate:
                    purchaseText,
                ContStartDate:
                    contStartText,
                ContEndDate:
                    contEndText,
                ContCreatedDate:
                    contCreatedText,
            }
        });

    } catch (err) {
        console.error("FULL ERROR");
        console.error("Status:",
            err.response?.status);
        console.error("Headers:",
            err.response?.headers);
        console.error("Data:",
            err.response?.data);
        console.error("Message:",
            err.message);
        return res.status(500).json({
            answer:
                "⚠️ Unable to fetch warranty data from SAP."
        });
    }
});
// =================================
// START SERVER
// =================================
app.listen(3000, () => {
    console.log(
        "✅ AI Warranty Assistant running on http://localhost:3000"
    );
});