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

function showTimeupModalOnPage() {
    // Prevent duplicate modals
    if (document.getElementById('leetcode-timeup-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'leetcode-timeup-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '999999';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.innerHTML = `
      <div style="background:white; padding:32px 24px; border-radius:8px; text-align:center; font-size:1.3em; min-width:200px;">
        ⏰ Time is up!<br><br>
        <button id="close-leetcode-timeup-modal" style="margin-top:16px;">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-leetcode-timeup-modal').onclick = () => {
        modal.remove();
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