require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(express.json()); // Middleware to parse JSON
app.use(cors()); // Enable CORS for Chrome extension

const notion = new Client({ auth: process.env.NOTION_KEY });

// Start timer endpoint (when the Start Timer button is clicked)
app.post('/pages/start-timer', async function(request, response) {
    const { problemName, difficulty, topic } = request.body;
    const dbID = process.env.NOTION_DATASOURCE_ID; // This is now your data source ID

    console.log('Received start-timer request:', { problemName, difficulty, topic });
    console.log('Using data source ID:', dbID);

    // Validate required fields
    if (!problemName || !difficulty || !topic) {
        return response.status(400).json({
            success: false,
            error: 'Missing required fields: problemName, difficulty, or topic'
        });
    }

    try {
        // 1. Query for pages that contain the problem name (broader match)
        const search = await notion.dataSources.query({
            data_source_id: dbID,
            filter: {
                property: "Problem Name",
                title: {
                    contains: problemName.trim()
                }
            }
        });

        // 2. Manually check for exact match (case-insensitive, trimmed)
        const normalizedInput = problemName.trim().toLowerCase();
        const existingPage = search.results.find(page => {
            const titleArr = page.properties["Problem Name"].title;
            const pageTitle = titleArr.map(t => t.plain_text).join("").trim().toLowerCase();
            return pageTitle === normalizedInput;
        });

        if (existingPage) {
            // Page exists, return its ID
            return response.status(200).json({
                success: true,
                pageId: existingPage.id,
                message: "Existing page found"
            });
        }

        // 3. If not found, create a new page (update parent type for data source)
        const newPage = await notion.pages.create({
            parent: { type: "data_source_id", data_source_id: dbID },
            properties: {
                "Problem Name": { title: [{ type: "text", text: { content: problemName } }] },
                "Topic": { multi_select: [{ name: topic }] },
                "Difficulty": { select: { name: difficulty } },
                "Source": { select: { name: "LeetCode" } }
            }
        });

        response.status(200).json({
            success: true,
            pageId: newPage.id,
            message: "Timer started successfully"
        });

    } catch (error) {
        console.error("Error in /pages/start-timer:", error);
        response.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update page endpoint (when the Solved button is clicked)
app.post('/pages/solved', async function(request, response) {
    console.log("🚀 /pages/solved endpoint hit, body:", request.body);
    const { pageId, solveStatus, timeSpent, date, emoji, code } = request.body;
    
    console.log('Received solved request:', { pageId, solveStatus, timeSpent, date, emoji });
    
    // Validate required fields
    if (!pageId || !solveStatus || timeSpent === undefined || !date) {
        return response.status(400).json({
            success: false,
            error: 'Missing required fields: pageId, solveStatus, timeSpent, or date'
        });
    }
    
    try {
        // First, retrieve the current page to check existing values
        const currentPage = await notion.pages.retrieve({ page_id: pageId });
        const properties = currentPage.properties;
        
        // Check current repetition and duration states
        const currentRepetitions = properties.Repetitions?.number || 0;
        const duration1 = properties["Duration 1"]?.number;
        const duration2 = properties["Duration 2"]?.number;
        const duration3 = properties["Duration 3"]?.number;
        
        console.log('Current state:', { currentRepetitions, duration1, duration2, duration3 });
        
        // Prepare update properties
        let updateProperties = {
            "Status": {
                type: "select",
                select: {
                    name: solveStatus
                }
            },
            "Repetitions": {
                type: "number",
                number: currentRepetitions + 1
            }
        };
        
        // Update duration and review date based on current state
        if (!duration1) {
            // First attempt
            updateProperties["Duration 1"] = {
                type: "number",
                number: timeSpent
            };
            updateProperties["Review Date 1"] = {
                type: "date",
                date: {
                    start: date
                }
            };
            console.log('Updating first attempt');
        } else if (!duration2) {
            // Second attempt
            updateProperties["Duration 2"] = {
                type: "number",
                number: timeSpent
            };
            updateProperties["Review Date 2"] = {
                type: "date",
                date: {
                    start: date
                }
            };
            console.log('Updating second attempt');
        } else if (!duration3) {
            // Third attempt
            updateProperties["Duration 3"] = {
                type: "number",
                number: timeSpent
            };
            updateProperties["Review Date 3"] = {
                type: "date",
                date: {
                    start: date
                }
            };
            console.log('Updating third attempt');
        } else {
            // All three attempts completed
            console.log('All attempts completed');
            return response.status(400).json({
                success: false,
                message: "Maximum review attempts (3) already completed"
            });
        }
        
        // Update the page properties
        const updatedPage = await notion.pages.update({
            page_id: pageId,
            properties: updateProperties
        });

        // Determine emoji for icon
        let iconEmoji = emoji || "✅";
        // If all durations are filled after this update, set to ⭐
        const allReviewed = (
            (updateProperties["Duration 1"] || duration1) &&
            (updateProperties["Duration 2"] || duration2) &&
            (updateProperties["Duration 3"] || duration3)
        );
        if (allReviewed) iconEmoji = "⭐";
        // Update the page icon
        await notion.pages.update({
            page_id: pageId,
            icon: {
                type: "emoji",
                emoji: iconEmoji
            }
        });

        // If code is present, append it as a code block to the page
        if (code && code.trim().length > 0) {
            // Notion API limit: 2000 chars per code block, so split if needed
            const codeBlocks = [];
            for (let i = 0; i < code.length; i += 2000) {
                codeBlocks.push(code.slice(i, i + 2000));
            }
            const children = codeBlocks.map(block => ({
                object: "block",
                type: "code",
                code: {
                    rich_text: [
                        {
                            type: "text",
                            text: {
                                content: block
                            }
                        }
                    ],
                    language: "python",
                    caption: []
                }
            }));
            await notion.blocks.children.append({
                block_id: pageId,
                children
            });
        }

        console.log('Page updated successfully');

        response.status(200).json({
            success: true,
            message: "Problem marked as solved successfully",
            attempt: !duration1 ? 1 : !duration2 ? 2 : 3
        });
        
    } catch (error) {
        console.error("Error updating page:", error);
        response.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        notionConfigured: !!process.env.NOTION_KEY && !!process.env.NOTION_DATABASE_ID
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Notion API Key configured: ${!!process.env.NOTION_KEY}`);
    console.log(`Notion Database ID configured: ${!!process.env.NOTION_DATABASE_ID}`);
});