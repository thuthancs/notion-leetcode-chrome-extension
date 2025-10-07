// Function to format description content preserving structure
function formatDescriptionContent(element) {
    let formattedText = '';
    
    // Process each child node
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            // Text node - add as is
            formattedText += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();
            const text = child.textContent.trim();
            
            if (!text) continue; // Skip empty elements
            
            switch (tagName) {
                case 'p':
                    // Paragraph - add with line breaks
                    formattedText += text + '\n\n';
                    break;
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    // Headers - add with bold formatting and line breaks
                    formattedText += `**${text}**\n\n`;
                    break;
                case 'pre':
                    // Code blocks - preserve formatting
                    formattedText += '```\n' + text + '\n```\n\n';
                    break;
                case 'code':
                    // Inline code - add backticks
                    formattedText += `\`${text}\``;
                    break;
                case 'strong':
                case 'b':
                    // Bold text
                    formattedText += `**${text}**`;
                    break;
                case 'em':
                case 'i':
                    // Italic text
                    formattedText += `*${text}*`;
                    break;
                case 'ul':
                    // Unordered list
                    const listItems = child.querySelectorAll('li');
                    for (const li of listItems) {
                        formattedText += `• ${li.textContent.trim()}\n`;
                    }
                    formattedText += '\n';
                    break;
                case 'ol':
                    // Ordered list
                    const orderedItems = child.querySelectorAll('li');
                    for (let i = 0; i < orderedItems.length; i++) {
                        formattedText += `${i + 1}. ${orderedItems[i].textContent.trim()}\n`;
                    }
                    formattedText += '\n';
                    break;
                case 'li':
                    // List item - handled by parent ul/ol
                    formattedText += `• ${text}\n`;
                    break;
                case 'br':
                    // Line break
                    formattedText += '\n';
                    break;
                case 'img':
                    // Image - add alt text or placeholder
                    const alt = child.alt || 'Image';
                    formattedText += `[${alt}]\n\n`;
                    break;
                default:
                    // Other elements - just add the text
                    formattedText += text + '\n';
            }
        }
    }
    
    // Clean up extra whitespace and line breaks
    return formattedText
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
        .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
        .trim();
}

// Function that helps scrape data from a LeetCode problem webpage
function scrapeProblem() {
    try {
        /* Extract the problem name with the class that includes "text-title-large"
        The problem name is in the <a></a> element right under this div
        */
        const problemNameElement = document.querySelector("div[class*='text-title-large'] a");
        const problemName = problemNameElement ? problemNameElement.innerText.trim() : "Unknown";

        //Extract the difficulty level with the class that includes "text-difficulty-"
        const difficultyElement = document.querySelector("div[class*='text-difficulty-']");
        const difficulty = difficultyElement ? difficultyElement.innerText.trim() : "Unknown";

        // Extract the problem description - try multiple approaches
        let description = "No description available";
        
        // Primary selector from the screenshot
        let descriptionElement = document.querySelector('div[data-track-load="description_content"]');
        
        // If not found, try alternative selectors
        if (!descriptionElement) {
            const altSelectors = [
                'div[data-track-load="description_content"]',
                'div[class*="description"]',
                'div[class*="content"]',
                '.content__u3I1',
                '.question-content',
                '[data-track-load*="description"]',
                'div.elfjS', // From the screenshot class name
                'div[class*="elfjS"]'
            ];
            
            for (const selector of altSelectors) {
                descriptionElement = document.querySelector(selector);
                if (descriptionElement && descriptionElement.innerText.trim().length > 50) {
                    console.log('Found description with selector:', selector);
                    break;
                }
            }
        }
        
        if (descriptionElement) {
            // Get formatted content preserving structure
            description = formatDescriptionContent(descriptionElement);
            
            // Debug logging
            console.log('Description element found:', descriptionElement);
            console.log('Description length:', description.length);
            console.log('Description preview:', description.substring(0, 200));
            console.log('Description ending:', description.substring(description.length - 200));
            
            // If description is too long, truncate it (Notion has limits)
            if (description.length > 10000) {
                description = description.substring(0, 10000) + "...";
            }
        } else {
            console.log('No description element found with any selector');
            // Try to find any div that might contain the problem description
            const allDivs = document.querySelectorAll('div');
            for (const div of allDivs) {
                const text = div.innerText.trim();
                if (text.length > 100 && 
                    (text.includes('You are given') || 
                     text.includes('Given') || 
                     text.includes('Return') ||
                     text.includes('Example'))) {
                    console.log('Found potential description div:', div);
                    description = text;
                    if (description.length > 10000) {
                        description = description.substring(0, 10000) + "...";
                    }
                    break;
                }
            }
        }

        return { problemName, difficulty, description };

    } catch (error) {
        console.error('Error scraping problem:', error);
        return { problemName: "Error", difficulty: "Error", description: "Error" };
    }
}

function showTimeupModalOnPage() {
    // Prevent duplicate modals
    if (document.getElementById('leetcode-timeup-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'leetcode-timeup-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.2s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    `;
    
    modal.innerHTML = `
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px) scale(0.95);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            #leetcode-timeup-content {
                animation: slideUp 0.3s ease-out;
            }
            #close-leetcode-timeup-modal {
                transition: all 0.2s;
            }
            #close-leetcode-timeup-modal:hover {
                background: #2563eb;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            #close-leetcode-timeup-modal:active {
                transform: translateY(0);
            }
        </style>
        <div id="leetcode-timeup-content" style="
            background: white;
            padding: 48px 40px;
            border-radius: 12px;
            text-align: center;
            min-width: 320px;
            max-width: 400px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        ">
            <div style="
                font-size: 64px;
                margin-bottom: 16px;
                line-height: 1;
            ">⏰</div>
            <h2 style="
                font-size: 24px;
                font-weight: 600;
                color: #1a1a1a;
                margin-bottom: 12px;
            ">Time's Up!</h2>
            <p style="
                font-size: 15px;
                color: #6b7280;
                margin-bottom: 32px;
                line-height: 1.5;
            ">Your allocated time has ended. Check the side panel to log your progress.</p>
            <button id="close-leetcode-timeup-modal" style="
                width: 100%;
                padding: 12px 24px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                font-family: inherit;
            ">Got it</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('close-leetcode-timeup-modal').onclick = () => {
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => modal.remove(), 200);
    };
    
    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => modal.remove(), 200);
        }
    };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PING") {
        sendResponse({ status: "ready" });
        return;
    }

    if (msg.type === "SCRAPE_PROBLEM") {
        const data = scrapeProblem();
        sendResponse(data);
    }

    if (msg.type === "SHOW_TIMEUP_MODAL") {
        showTimeupModalOnPage();
    }

    if (msg.type === "SCRAPE_CODE") {
        // Scrape code from Monaco editor
        const codeDiv = document.querySelector('.view-lines.monaco-mouse-cursor-text');
        let code = '';
        if (codeDiv) {
            code = Array.from(codeDiv.querySelectorAll('.view-line'))
                .map(line => line.innerText)
                .join('\n');
        }
        sendResponse({ code });
    }
});