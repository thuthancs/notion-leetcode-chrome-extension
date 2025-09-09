const problemNameField = document.getElementById("problem-name");
const difficultyField = document.getElementById("difficulty");
const topicField = document.getElementById("topic");
const timerField = document.getElementById("timer");
const startBtn = document.getElementById("start-btn");

// Timer logic
const setTimer = (difficulty) => {
    let minutes = 0;
    if (difficulty === "Hard") minutes = 30;
    else if (difficulty === "Medium") minutes = 20;
    else if (difficulty === "Easy") minutes = 10;

    timerField.value = `${minutes}:00`; // Simple representation
};

// Check if we're on a LeetCode page and inject content script if needed
async function ensureContentScript(tabId) {
    try {
        // Try to ping the content script first
        const response = await chrome.tabs.sendMessage(tabId, { type: "PING" });
        return true;
    } catch (error) {
        // Content script not loaded, try to inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['src/content.js']
            });
            return true;
        } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
            return false;
        }
    }
}

// Ask the active tab for scraped problem data
async function populateFields() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        // Check if we're on a LeetCode problem page
        if (!activeTab.url.includes('leetcode.com/problems/')) {
            problemNameField.value = "Please navigate to a LeetCode problem page";
            difficultyField.value = "";
            topicField.value = "";
            return;
        }

        // Ensure content script is loaded
        const scriptReady = await ensureContentScript(activeTab.id);
        if (!scriptReady) {
            problemNameField.value = "Failed to load content script";
            return;
        }

        // Send message with timeout
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, 5000);

            chrome.tabs.sendMessage(activeTab.id, { type: "SCRAPE_PROBLEM" }, (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response) {
            problemNameField.value = response.problemName || "Unknown";
            difficultyField.value = response.difficulty || "Unknown";
            topicField.value = response.topic || "Unknown";
            setTimer(response.difficulty);
        } else {
            problemNameField.value = "Could not scrape problem data";
            difficultyField.value = "";
            topicField.value = "";
        }

    } catch (error) {
        console.error('Error populating fields:', error);
        problemNameField.value = `Error: ${error.message}`;
        difficultyField.value = "";
        topicField.value = "";
    }
}

// Populate fields when popup opens
document.addEventListener("DOMContentLoaded", populateFields);