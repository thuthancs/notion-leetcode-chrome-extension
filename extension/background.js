// Use an onUpdated listener to control when the side panel icon is visible.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    // This check ensures we only act when a tab is fully loaded and has a URL.
    if (info.status !== 'complete' || !tab.url) {
        return;
    }

    const leetCodeProblemPattern = 'https://leetcode.com/problems/';
    const isLeetCodeProblemPage = tab.url.startsWith(leetCodeProblemPattern);

    // Conditionally enable the side panel icon for LeetCode problem pages.
    await chrome.sidePanel.setOptions({
        tabId,
        enabled: isLeetCodeProblemPage
    });
});

// Use an onClicked listener to open the side panel when the user clicks the extension icon.
chrome.action.onClicked.addListener(async (tab) => {
    // This will open the side panel for the active tab.
    await chrome.sidePanel.open({ tabId: tab.id });
});
