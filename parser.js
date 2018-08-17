var logs = [];
var config = {};

function makeLoading(show){
  $('#loadingBar').show();
  if( show == true ){
    $('#loadingDiv').show();
    $("#submit").attr('disabled', show);
  }else{
    $('#loadingDiv').hide();
    enableSubmitButton();
  }
  return true;
}

function enableSubmitButton() {
  $("#submit").attr('disabled', false);
}

$(document).ajaxStart(makeLoading.bind(null, true));
$(document).ajaxStop(makeLoading.bind(null, false));

String.prototype.limit = function (limit) {
    return this.length > limit ? this.substr(0, limit) + '...' : this;
}

String.prototype.toHHMMSS = function () {
    // don't forget the second param
    var secNum = parseInt(this, 10);
    var hours = Math.floor(secNum / 3600);
    var minutes = Math.floor((secNum - (hours * 3600)) / 60);
    var seconds = secNum - (hours * 3600) - (minutes * 60);

    if (hours < 10) {
        hours = '0' + hours;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    var time = hours + 'h ' + minutes + 'm ' + seconds + 's';
    return time;
}

String.prototype.toHHMM = function () {
    // don't forget the second param
    var secNum = parseInt(this, 10);
    var hours = Math.floor(secNum / 3600);
    var minutes = Math.floor((secNum - (hours * 3600)) / 60);

    if (hours < 10) {
        hours = '0' + hours;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    var time = hours + 'h ' + minutes + 'm';
    return time;
}
String.prototype.toHH_MM = function () {
    // don't forget the second param
    var secNum = parseInt(this, 10);
    var hours = Math.floor(secNum / 3600);
    var minutes = Math.floor((secNum - (hours * 3600)) / 60);

    if (hours < 10) {
        hours = '0' + hours;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    var time = hours + ':' + minutes;
    return time;
}
String.prototype.toDDMM = function () {
    // don't forget the second param
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var d = new Date(this);
    return monthNames[d.getMonth()] + ' ' + d.getDate();
    // return d.getDate() + '.' + (d.getMonth() + 1) + '.';
}


$(document).ready(function () {

    chrome.storage.sync.get({
        url: 'https://objectedge.atlassian.net',
        comment: '',
        merge: false,
        jumpToToday: false
    }, function(items) {
        config = items;
        console.log('Fetching toggl entries for today.', 'Jira url: ', config.url, config);

        $.ajaxSetup({
            contentType: 'application/json',
            headers: {
                'forgeme': 'true',
                'X-Atlassian-Token': 'nocheck',
                'Access-Control-Allow-Origin': '*'
            },
            xhrFields: {
                withCredentials: true
            }
        });

        var startString = localStorage.getItem('toggl-to-jira.last-date');
        var startDate   = !startString ? new Date() : new Date(startString);
        document.getElementById('start-picker').valueAsDate = startDate;

        var endString = localStorage.getItem('toggl-to-jira.last-end-date');
        var endDate = config.jumpToToday || !endString ? new Date(Date.now() + (3600 * 24 * 1000)) : new Date(endString);
        document.getElementById('end-picker').valueAsDate = endDate;

        $('#start-picker').on('change', fetchEntries);
        $('#end-picker').on('change', fetchEntries);
        $('#submit').on('click', submitEntries);

        fetchEntries();
    });
});

function submitEntries() {
  //var loggedSometing = false;
    // log time for each jira ticket
    logs.forEach(function (log) {
        if (!log.submit) return;

        var body = JSON.stringify({
            timeSpent: log.timeSpent,
            comment: log.comment,
            started: log.started
        });

        var jiraRequest = $.ajax({
            url: config.url + '/rest/api/latest/issue/' + log.issue + '/worklog',
            method: 'POST',
            data: body,
            crossDomain: true,
            headers: {
                "X-Atlassian-Token": "nocheck",
            }
        });

        jiraRequest.done(function (response) {
            console.log('success', response);
            $('#result-' + log.id).text('LOGGED').addClass('success');
            $('#result-' + log.id).removeClass('warning');
            $('#result-' + log.id).removeClass('danger');
            $('#input-' + log.id).removeAttr('checked');
            //$('#input-' + log.id).addClass('hide');
            //loggedSometing = true;
        })

        jiraRequest.fail(function (error, message) {
            console.log(error, message);
            var e = error.responseText || JSON.stringify(error);
            console.log(e);
            $('p#error').text(e + "\n" + message).addClass('error');
        })
    });
    if( loggedSometing == false ){
      //$('p#error').text("Nothing to send to Jira").addClass('error');
    }
  }

// log entry checkbox toggled
function selectEntry() {
    var id = this.id.split('input-')[1];

    logs.forEach(function (log) {
        if (log.id === id) {
            log.submit = this.checked;
        }
    }.bind(this));
}

function fetchEntries() {
    var startDate = document.getElementById('start-picker').valueAsDate.toISOString();
    var endDate   = document.getElementById('end-picker').valueAsDate.toISOString();
    localStorage.setItem('toggl-to-jira.last-date', startDate);
    localStorage.setItem('toggl-to-jira.last-end-date', endDate);
    $('p#error').text("").removeClass('error');
    //Make the query into Toggl;
    var dateQuery = '?start_date=' + startDate + '&end_date=' + endDate;
    $.get('https://www.toggl.com/api/v8/time_entries' + dateQuery, function (entries) {
        console.log('entries', entries);
        logs = [];
        entries.reverse();
        //Read each entry;
        entries.forEach(function (entry) {
            entry.description = entry.description || 'no-description';
            var issue = entry.description.split(' ')[0];
            var togglTime = entry.duration;
            console.log(togglTime);
            var dateString = toJiraWhateverDateTime(entry.start);
            var log = _.find(logs, function (log) {
                return log.issue === issue;
            });
            //Merge toggl entries by ticket?
            if (log && config.merge) {
                log.timeSpentInt = log.timeSpentInt + togglTime;
                log.timeSpent = log.timeSpentInt > 0 ? log.timeSpentInt.toString().toHHMM() : 'Running';
            } else {
                log = {
                    id: entry.id.toString(),
                    issue: issue,
                    description: entry.description.substr(issue.length),
                    submit: (togglTime > 0),
                    timeSpentInt: togglTime,
                    timeSpent: togglTime > 0 ? togglTime.toString().toHHMM() : 'Running',
                    comment: config.comment != '' ? entry.description.substr(issue.length) + ' - ' + config.comment : entry.description.substr(issue.length),
                    started: dateString
                };
                logs.push(log);
            }
        });
        renderList();
    });
}

function toJiraWhateverDateTime(date) {
    // TOGGL:          at: "2016-03-14T11:02:55+00:00"
    // JIRA:    "started": "2012-02-15T17:34:37.937-0600"

    // toggl time should look like jira time (otherwise 500 Server Error is raised)

    var parsedDate = Date.parse(date);
    var jiraDate = Date.now();

    if (parsedDate) {
        jiraDate = new Date(parsedDate);
    }

    var dateString = jiraDate.toISOString();

    // timezone is something fucked up with minus and in minutes
    // thatswhy divide it by -60 to get a positive value in numbers
    // example -60 -> +1 (to convert it to GMT+0100)
    var timeZone = jiraDate.getTimezoneOffset() / (-60);
    var absTimeZone = Math.abs(timeZone);
    var timeZoneString;
    var sign = timeZone > 0 ? '+' : '-';

    // take absolute because it can also be minus
    if (absTimeZone < 10) {
        timeZoneString = sign + '0' + absTimeZone + '00'
    } else {
        timeZoneString = sign + absTimeZone + '00'
    }

    dateString = dateString.replace('Z', timeZoneString);

    return dateString;
}

function renderList() {
    var list = $('#toggle-entries');
    list.children().remove();
    var totalTime = 0;

    logs.forEach(function (log) {
        var url = config.url + '/browse/' + log.issue;
        var dom = '<tr><td>';
        var date = new Date(log.timeSpentInt * 1000);

        // checkbox
        if (log.timeSpentInt > 0) dom += '<input id="input-' + log.id + '"  type="checkbox" checked/>';

        dom += '</td>';

        // link to jira ticket
        dom += '<td><a href="' + url + '" target="_blank">' + log.issue + '</a></td>';

        dom += '<td>' + log.comment.limit(35) + '</td>';
        dom += '<td>' + log.started.toDDMM() + '</td>';
        dom += '<td>' + (log.timeSpentInt > 0 ? log.timeSpentInt.toString().toHH_MM() : 'Running') + '</td>';
        dom += '<td  id="result-' + log.id + '" class="' + (log.timeSpentInt > 0 ? 'warning' : 'danger') + '">' + (log.timeSpentInt > 0 ? 'NEW' : 'Running') + '</td>';
        dom += '</tr>';

        totalTime += (log.timeSpentInt > 0 && log.timeSpentInt) || 0;

        list.append(dom);

        if (log.timeSpentInt > 0) {
            $('#input-' + log.id).on('click', selectEntry);
        }

    })
    // total time for displayed tickets
    list.append('<tr><td></td><td></td><td></td><td><b>TOTAL</b></td><td><b><i>'  + totalTime.toString().toHHMM() + '</b></i></td></tr>');

    // check if entry was already logged
    logs.forEach(function (log) {
        $.get(config.url + '/rest/api/latest/issue/' + log.issue + '/worklog',
            function success(response) {
                var worklogs = response.worklogs;

                worklogs.forEach(function (worklog) {
                    var diff = Math.floor(worklog.timeSpentSeconds / 60) - Math.floor(log.timeSpentInt / 60);
                    if (
                        // if date and month matches
                        worklog.started.toDDMM() === log.started.toDDMM() &&
                        // if duration is within 4 minutes because JIRA is rounding worklog minutes :facepalm:
                        diff < 4 && diff > -4
                    ) {
                        $('#result-' + log.id).text('LOGGED').addClass('success');
                        $('#result-' + log.id).removeClass('warning');
                        $('#result-' + log.id).removeClass('danger');
                        $('#input-' + log.id).removeAttr('checked');
                        //$('#input-' + log.id).addClass('hide');
                        log.submit = false;
                    }
                })
            });
    });
    
}
