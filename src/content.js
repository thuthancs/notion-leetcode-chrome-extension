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

        return { problemName, difficulty};

    } catch (error) {
        console.error('Error scraping problem:', error);
        return { problemName: "Error", difficulty: "Error", topic: "Error" };
    }
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
});