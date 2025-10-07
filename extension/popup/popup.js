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
    else if (difficulty === "Easy") minutes = 1;

    timerField.value = `${minutes}:00`;

    // Need to return the value here so that we can use this function elsewhere
    return minutes
};

// Variables that will be updated
let countdownInterval = null;
let totalTime = 0;
let timeRemaining = 0;
let timeSpent = 0; // track total time spent solving a problem
let wasExtended = false; // track if user extended
let wasDoneEarly = false; // track if user finished early

// Format time into 00:00 (minutes:seconds)
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Start countdown
function startCountdown(durationMinutes) {
    // Convert duration to seconds and initialize remaining time
    totalTime = durationMinutes * 60;
    timeRemaining = totalTime;
    
    // Only reset timeSpent if this is the very first countdown (not an extension)
    if (timeSpent === 0) {
        timeSpent = 0;
    }
    
    // Clear any existing countdown to prevent multiple timers
    if (countdownInterval) clearInterval(countdownInterval);
    
    // Display initial formatted time
    countdownDisplay.textContent = formatTime(timeRemaining);
    
    // Start countdown timer that decrements every second
    countdownInterval = setInterval(() => {
        timeRemaining--;
        timeSpent++;
        
        // Handle countdown completion
        if (timeRemaining <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.textContent = formatTime(0);

            // Send message to content script to show time up modal in main page
            chrome.tabs && chrome.tabs.query && chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_TIMEUP_MODAL" });
                }
            });

            // Hide Done Early button
            doneEarlyBtn.style.display = "none";

            // Display solved and extend buttons, and show solve status when timer completes
            solvedBtn.style.display = "block";
            extendBtn.style.display = "block";
            solveStatus.style.display = "block";
        } else {
            countdownDisplay.textContent = formatTime(timeRemaining);
        }
    }, 1000);
}

// When the start button is clicked, the timer starts to count down
startBtn.addEventListener("click", async () => {
    let minutes = setTimer(difficultyField.value);
    startCountdown(minutes);

    document.querySelector(".container").style.display = "none";
    document.querySelector(".timer-container").style.display = "block";

    // Get stored description
    const description = await new Promise((resolve) => {
        chrome.storage.local.get("problemDescription", (result) => {
            resolve(result.problemDescription || "");
        });
    });

    // Tell server to create a new Notion page
    fetch("http://localhost:3000/pages/start-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            problemName: problemNameField.value,
            difficulty: difficultyField.value,
            topic: topicField.value,
            description: description
        })
    }).then(res => res.json())
      .then(data => {
          console.log("Notion page created:", data);
          if (data.pageId) {
              chrome.storage.local.set({ notionPageId: data.pageId });
          }
      })
      .catch(err => console.error("Error creating Notion page:", err));
});

// Done Early button logic
doneEarlyBtn.addEventListener("click", () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // Calculate time spent
    timeSpent = totalTime - timeRemaining;
    countdownDisplay.textContent = formatTime(timeRemaining);

    // Show solved/extend options
    doneEarlyBtn.style.display = "none";
    solvedBtn.style.display = "block";
    solveStatus.style.display = "block";

    // Set done early state
    wasDoneEarly = true;

    console.log("Timer stopped early. Time spent:", timeSpent);
});

// Solved button logic
solvedBtn.addEventListener('click', async () => {
    clearInterval(countdownInterval); // Stop the timer

    // Get Notion page ID
    const notionPageId = await new Promise((resolve) => {
        chrome.storage.local.get("notionPageId", (result) => {
            resolve(result.notionPageId);
        });
    });

    const solveStatusValue = solveStatus.value;
    const timeSpentMinutes = Math.ceil(timeSpent / 60);
    const date = new Date().toISOString();

    // Determine emoji
    let emoji = "✅";
    if (wasExtended) emoji = "🚨";
    if (wasDoneEarly) emoji = "❇️";
    if (solveStatusValue === "Read Solution") emoji = "⭕";

    if (!notionPageId) {
        console.error("No Notion page ID available. Cannot update.");
        return;
    }

    // Scrape code from the active tab
    let code = "";
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        code = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(activeTab.id, { type: "SCRAPE_CODE" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response && response.code ? response.code : "");
                }
            });
        });
    } catch (err) {
        console.error("Failed to scrape code:", err);
    }

    try {
        const response = await fetch('http://127.0.0.1:3000/pages/solved', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pageId: notionPageId,
                solveStatus: solveStatusValue,
                timeSpent: timeSpentMinutes,
                date: date,
                emoji: emoji,
                code: code // <-- send code to server
            }),
        });

        const data = await response.json();
        if (data.success) {
            document.querySelector('.container').style.display = 'none';
            document.querySelector('.timer-container').style.display = 'none';
            const congratsDiv = document.getElementById('congrats-message');
            if (congratsDiv) congratsDiv.style.display = 'block';
            console.log("Notion page updated successfully!");
        } else {
            console.error("Error updating Notion page:", data.error);
            alert(`Error updating Notion page: ${data.error}`);
        }
    } catch (error) {
        console.error('Failed to communicate with the server:', error);
        alert('Failed to communicate with the server.');
    }
});

// Extend button logic
extendBtn.addEventListener("click", () => {
    // Reset timer to the original difficulty-based duration
    const minutes = setTimer(difficultyField.value);

    // Clear the current interval (if running)
    if (countdownInterval) clearInterval(countdownInterval);

    // Start countdown fresh
    startCountdown(minutes);

    // Set extended state
    wasExtended = true;

    console.log(`Timer reset to ${minutes} minutes for difficulty: ${difficultyField.value}`);
});

// Modal for time is up notification
let timeupModal = document.getElementById("timeup-modal");
if (!timeupModal) {
    timeupModal = document.createElement("div");
    timeupModal.id = "timeup-modal";
    timeupModal.style.display = "none";
    timeupModal.style.position = "fixed";
    timeupModal.style.top = "0";
    timeupModal.style.left = "0";
    timeupModal.style.width = "100vw";
    timeupModal.style.height = "100vh";
    timeupModal.style.background = "rgba(0,0,0,0.5)";
    timeupModal.style.zIndex = "9999";
    timeupModal.style.justifyContent = "center";
    timeupModal.style.alignItems = "center";
    timeupModal.style.display = "flex";
    timeupModal.innerHTML = `
      <div style="background:white; padding:32px 24px; border-radius:8px; text-align:center; font-size:1.3em; min-width:200px;">
        ⏰ Time is up!<br><br>
        <button id="close-timeup-modal" style="margin-top:16px;">OK</button>
      </div>
    `;
    timeupModal.style.display = "none";
    document.body.appendChild(timeupModal);
}
function showTimeupModal() {
    timeupModal.style.display = "flex";
    const closeBtn = document.getElementById("close-timeup-modal");
    if (closeBtn) {
        closeBtn.onclick = () => {
            timeupModal.style.display = "none";
        };
    }
}

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
                files: ['content.js']
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
            
            // Debug logging for description
            console.log('Received response:', response);
            console.log('Description received:', response.description);
            console.log('Description length:', response.description ? response.description.length : 0);
            
            // Store description for later use when creating Notion page
            if (response.description) {
                chrome.storage.local.set({ problemDescription: response.description });
                console.log('Description stored in Chrome storage');
            } else {
                console.log('No description to store');
            }
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
