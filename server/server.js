require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(express.json()); // Middleware to parse JSON
app.use(cors()); // Enable CORS for Chrome extension

const notion = new Client({ auth: process.env.NOTION_KEY });

// Function to parse formatted description into Notion blocks
function parseDescriptionToNotionBlocks(description) {
    const lines = description.split('\n');
    const blocks = [];
    let currentParagraph = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    
    console.log('Parsing description lines:', lines.length);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Handle code blocks (only if line is exactly ``` or has language specifier)
        if (line === '```' || (line.startsWith('```') && line.length > 3)) {
            if (inCodeBlock) {
                // End of code block
                if (codeBlockContent.trim()) {
                    console.log('Creating code block with content:', codeBlockContent.trim());
                    blocks.push({
                        object: "block",
                        type: "code",
                        code: {
                            rich_text: [
                                {
                                    type: "text",
                                    text: {
                                        content: codeBlockContent.trim()
                                    }
                                }
                            ],
                            language: "plain text"
                        }
                    });
                } else {
                    console.log('Skipping empty code block');
                }
                codeBlockContent = '';
                inCodeBlock = false;
            } else {
                // Start of code block
                if (currentParagraph) {
                    blocks.push(createParagraphBlock(currentParagraph));
                    currentParagraph = '';
                }
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent += line + '\n';
            continue;
        }

        // Handle headers (lines that are all bold)
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            const headerText = line.slice(2, -2);
            blocks.push({
                object: "block",
                type: "heading_3",
                heading_3: {
                    rich_text: [
                        {
                            type: "text",
                            text: {
                                content: headerText
                            }
                        }
                    ]
                }
            });
            continue;
        }

        // Handle list items
        if (line.startsWith('• ') || line.match(/^\d+\. /)) {
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            const listText = line.replace(/^[•\d+\. ]/, '');
            blocks.push({
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [
                        {
                            type: "text",
                            text: {
                                content: listText
                            }
                        }
                    ]
                }
            });
            continue;
        }

        // Handle empty lines
        if (line === '') {
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            continue;
        }

        // Regular text - add to current paragraph
        if (currentParagraph) {
            currentParagraph += ' ' + line;
        } else {
            currentParagraph = line;
        }
    }

    // Add any remaining content
    if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
    }

    console.log('Created blocks:', blocks.length);
    console.log('Block types:', blocks.map(b => b.type));
    
    return blocks;
}

// Helper function to create a paragraph block with rich text formatting
function createParagraphBlock(text) {
    const richText = parseRichText(text);
    return {
        object: "block",
        type: "paragraph",
        paragraph: {
            rich_text: richText
        }
    };
}

// Helper function to parse markdown-like formatting into Notion rich text
function parseRichText(text) {
    const richText = [];
    let currentText = text;
    let position = 0;

    while (position < currentText.length) {
        // Look for bold text **text**
        const boldMatch = currentText.slice(position).match(/\*\*(.*?)\*\*/);
        if (boldMatch) {
            // Add text before bold
            if (boldMatch.index > 0) {
                richText.push({
                    type: "text",
                    text: {
                        content: currentText.slice(position, position + boldMatch.index)
                    }
                });
            }
            // Add bold text
            richText.push({
                type: "text",
                text: {
                    content: boldMatch[1]
                },
                annotations: {
                    bold: true
                }
            });
            position += boldMatch.index + boldMatch[0].length;
            continue;
        }

        // Look for italic text *text*
        const italicMatch = currentText.slice(position).match(/\*(.*?)\*/);
        if (italicMatch) {
            // Add text before italic
            if (italicMatch.index > 0) {
                richText.push({
                    type: "text",
                    text: {
                        content: currentText.slice(position, position + italicMatch.index)
                    }
                });
            }
            // Add italic text
            richText.push({
                type: "text",
                text: {
                    content: italicMatch[1]
                },
                annotations: {
                    italic: true
                }
            });
            position += italicMatch.index + italicMatch[0].length;
            continue;
        }

        // Look for inline code `text`
        const codeMatch = currentText.slice(position).match(/`(.*?)`/);
        if (codeMatch) {
            // Add text before code
            if (codeMatch.index > 0) {
                richText.push({
                    type: "text",
                    text: {
                        content: currentText.slice(position, position + codeMatch.index)
                    }
                });
            }
            // Add code text
            richText.push({
                type: "text",
                text: {
                    content: codeMatch[1]
                },
                annotations: {
                    code: true
                }
            });
            position += codeMatch.index + codeMatch[0].length;
            continue;
        }

        // No more formatting found, add the rest as plain text
        richText.push({
            type: "text",
            text: {
                content: currentText.slice(position)
            }
        });
        break;
    }

    return richText;
}

// Start timer endpoint (when the Start Timer button is clicked)
app.post('/pages/start-timer', async function(request, response) {
    const { problemName, difficulty, topic, description } = request.body;
    const dbID = process.env.NOTION_DATASOURCE_ID; // This is now your data source ID

    console.log('Received start-timer request:', { problemName, difficulty, topic, description: description ? 'Present' : 'Not provided' });
    console.log('Description length:', description ? description.length : 0);
    console.log('Description preview:', description ? description.substring(0, 200) : 'No description');
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

        // Add description as content to the page if provided
        if (description && description.trim().length > 0) {
            try {
                // Parse the formatted description into Notion blocks
                const blocks = parseDescriptionToNotionBlocks(description);

                // Add a header for the description
                const headerBlock = {
                    object: "block",
                    type: "heading_2",
                    heading_2: {
                        rich_text: [
                            {
                                type: "text",
                                text: {
                                    content: "Problem Description"
                                }
                            }
                        ]
                    }
                };

                // Combine header and description blocks
                const allBlocks = [headerBlock, ...blocks];

                // Debug: Log the blocks being sent to Notion
                console.log('Sending blocks to Notion:');
                allBlocks.forEach((block, index) => {
                    console.log(`Block ${index}:`, JSON.stringify(block, null, 2));
                });

                // Append blocks to the page
                await notion.blocks.children.append({
                    block_id: newPage.id,
                    children: allBlocks
                });

                console.log('Description added to Notion page');
            } catch (descError) {
                console.error('Error adding description to page:', descError);
                // Don't fail the entire request if description fails
            }
        }

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