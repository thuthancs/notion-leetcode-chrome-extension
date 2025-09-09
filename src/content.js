// Function that helps scrape data from a LeetCode problem webpage
function scrapeProblem() {
    try {
        /* Extract the problem name with the class that includes "text-title-large"
        The problem name is in the <a></a> element right under this div
        */
        const problemNameElement = document.querySelector("div[class*='text-title-large'] a");
        const problemName = problemNameElement ? problemNameElement.innerText.trim() : "Unknown";

        /* Extract the difficulty level by first identifying the div with the class name "flex gap-1"
        The difficulty level is in the <div></div> element right under this div
        */
        const difficultyElement = document.querySelector("div.flex.gap-1 div");
        const difficulty = difficultyElement ? difficultyElement.innerText.trim() : "Unknown";

        /* Extract the topic of the problem by first identifying the div with the class name "mt-6 flex flex-col gap-3"
        Then, inside this div, find the 4th child div
        Then, inside this 4th div, get the first div right under it with the class name "class="flex flex-col"
        Then, inside this div, find the 2nd child div
        Then, inside this 2nd child div, find the first div right under it
        Then, extract the topic which is inside the first <a></a> element
        */
        let topic = "Unknown";
        const mainDiv = document.querySelector("div.mt-6.flex.flex-col.gap-3");
        if (mainDiv && mainDiv.children[3]) { // 4th child
            const fourthDiv = mainDiv.children[3];
            const innerFlexDiv = fourthDiv.querySelector("div.flex.flex-col");
            if (innerFlexDiv && innerFlexDiv.children[1]) { // 2nd child div
                const secondChildDiv = innerFlexDiv.children[1];
                const firstInnerDiv = secondChildDiv.querySelector("div");
                const topicAnchor = firstInnerDiv ? firstInnerDiv.querySelector("a") : null;
                topic = topicAnchor ? topicAnchor.innerText.trim() : "Unknown";
            }
        }

        return { problemName, difficulty, topic };
    } catch (error) {
        console.error('Error scraping problem:', error);
        return { problemName: "Error", difficulty: "Error", topic: "Error" };
    }
}

// Wait until elements exist
function waitForProblemData(callback) {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const interval = setInterval(() => {
        attempts++;
        const data = scrapeProblem();
        
        if (data.problemName !== "Unknown" && data.difficulty !== "Unknown") {
            clearInterval(interval);
            callback(data);
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            callback(data); // Return whatever we have
        }
    }, 100); // check every 100ms
}

// Listen for popup requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PING") {
        sendResponse({ status: "ready" });
        return;
    }
    
    if (msg.type === "SCRAPE_PROBLEM") {
        waitForProblemData((data) => {
            sendResponse(data);
        });
        return true; // keeps the message channel open for async response
    }
});

// Log that content script is loaded
console.log('LeetCode content script loaded');