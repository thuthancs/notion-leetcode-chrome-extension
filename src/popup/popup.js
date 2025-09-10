// Input fields
const problemNameField = document.getElementById("problem-name");
const difficultyField = document.getElementById("difficulty");
const topicField = document.getElementById("topic");
const timerField = document.getElementById("timer");

// All button fields
const startBtn = document.getElementById("start-btn");
const doneEarlyBtn = document.getElementById("done-early-btn");
const solvedBtn = document.getElementById("solved-btn");
const extendBtn = document.getElementById("extend-btn");

// Countdown field is displayed when the start button is clicked
// Solve status field is displayed when the done early button is clicked or when the time is up
const countdownDisplay = document.getElementById("countdown-display");
const solveStatus = document.getElementById("solve-status")

// Timer setup logic - set the timer based on the level of difficulty
const setTimer = (difficulty) => {
    let minutes = 0;
    if (difficulty === "Hard") minutes = 30;
    else if (difficulty === "Medium") minutes = 20;
    else if (difficulty === "Easy") minutes = 10;

    timerField.value = `${minutes}:00`;

    // Need to return the value here so that we can use this function elsewhere
    return minutes
};

// Variables that will be updated
let countdownInterval = null;
let totalTime = 0;
let timeRemaining = 0;

// Format time into 00:00 (minutes:seconds)
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Start countdown
function startCountdown(durationMinutes) {
    /* The total time is converted into seconds and initially, 
    the remaining time is equal to the total time */
    totalTime = durationMinutes * 60;
    timeRemaining = totalTime

    // If the countdownInterval is already set, we stop it from being executed repeatedly
    if (countdownInterval) clearInterval(countdownInterval);

    // Update the countdownDisplay text content to be the newly formated 00:00 one
    countdownDisplay.textContent = formatTime(timeRemaining);

    // Now, set the countdown interval by keep decrementing the timeRemaining by 1 second
    countdownInterval = setInterval(() => {
        timeRemaining--;
        
        // If the time remaining is less than or equal to 0, reset the interval to be 00:00
        if (timeRemaining <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.textContent = "00:00";

            // Show solved/extend buttons
            document.getElementById("solved-btn").style.display = "inline-block";
            document.getElementById("extend-btn").style.display = "inline-block";
        } else {
            countdownDisplay.textContent = formatTime(timeRemaining);
        }
    }, 1000);
}

// When the start button is clicked, the timer starts to count down
startBtn.addEventListener("click", () => {
    let minutes = setTimer(difficultyField.value)

    startCountdown(minutes);

    document.querySelector(".container").style.display = "none";
    document.querySelector(".timer-container").style.display = "block";
});

// Done Early button logic
doneEarlyBtn.addEventListener("click", () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // Freeze the timer where it stopped
    const timeSpent = totalTime - timeRemaining;
    countdownDisplay.textContent = formatTime(timeRemaining)

    // Show solved/extend options
    solvedBtn.style.display = "inline-block";
    extendBtn.style.display = "inline-block";
    solveStatus.style.display = "inline-block";

    // Store timeSpent in chrome.storage so we can later send to Notion
});

// Solved button logic
solvedBtn.addEventListener("click", () => {
    solveStatus.style.display = "inline-block";
})

// Extend button logic
extendBtn.addEventListener("click", () => {
    // Reset the timer to be back to the original input

})

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
        /* Ask Chrome to query a list of tabs that are active AND in the current browser
        and we set the active tab to be the first tab in the list
        */
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
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