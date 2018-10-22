// Saves options to chrome.storage
function saveOptions() {
    var url            = document.getElementById('jira-url').value;
    var togglApyKey    = document.getElementById('toggl-api-key').value;
    var comment        = document.getElementById('log-comment').value;
    var commentReplace = document.getElementById('log-comment-replace').value;
    var merge          = document.getElementById('merge-entries').checked;
    var jumpToToday    = document.getElementById('jump-to-today').checked;
    var showDayTotal   = document.getElementById('show-day-total').checked;
    chrome.storage.sync.set({
        url: url,
        togglApyKey: togglApyKey,
        comment: comment,
        commentReplace: commentReplace,
        merge: merge,
        jumpToToday: jumpToToday,
        showDayTotal: showDayTotal
    }, function() {
        // Update status to let user know options were saved.
        var status         = document.getElementById('status');
        status.style       = 'display: block';
        status.textContent = 'SETTINGS UPDATED';
        setTimeout(function() {
            status.style = 'display: none';
        }, 5000);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    // Use default values
    chrome.storage.sync.get({
        url: 'https://objectedge.atlassian.net',
        togglApyKey: '',
        comment: '',
        commentReplace: '',
        merge: false,
        jumpToToday: false,
        showDayTotal: true
    }, function(items) {
        document.getElementById('jira-url').value            = items.url;
        document.getElementById('toggl-api-key').value       = items.togglApyKey;
        document.getElementById('log-comment').value         = items.comment;
        document.getElementById('log-comment-replace').value = items.commentReplace;
        document.getElementById('merge-entries').checked     = items.merge;
        document.getElementById('jump-to-today').checked     = items.jumpToToday;
        document.getElementById('show-day-total').checked    = items.showDayTotal;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
