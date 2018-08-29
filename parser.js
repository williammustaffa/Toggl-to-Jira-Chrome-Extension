var logs   = [];
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

function addError(message){
  $('p#error').text( message ).addClass('error');
  setTimeout(function() {
      clearError();
  }, 5000);
}

function clearError(){
  $('p#error').text('').removeClass('error');
}

$(document).ready(function () {
  chrome.storage.sync.get({
    url: 'https://objectedge.atlassian.net',
    comment: '',
    commentReplace: '',
    merge: false,
    jumpToToday: false,
    showDayTotal: true
  }, function(items) {
    config = items;
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
    //Start date;
    var startString = localStorage.getItem('toggl-to-jira.last-date');
    var startDate   = !startString ? new Date() : new Date(startString);
    document.getElementById('start-picker').valueAsDate = startDate;
    $('#start-picker').on('change', fetchEntries);
    //End date;
    var endString = localStorage.getItem('toggl-to-jira.last-end-date');
    var endDate = config.jumpToToday || !endString ? new Date(Date.now() + (3600 * 24 * 1000)) : new Date(endString);
    document.getElementById('end-picker').valueAsDate = endDate;
    $('#end-picker').on('change', fetchEntries);
    //Bind submit button;
    $('#submit').on('click', submitEntries);
    //Bind the select all;
    $('#select-all-link').on('click', selectAll);
    fetchEntries();
  });
});

function submitEntries() {
  //Check if anything is checked;
  var hasChecked = false;
  $('.entry-checkbox').each(function(){
    if( $(this).is(':checked') ){
      hasChecked = true
    }
  });
  if( !hasChecked ){
    addError( 'No Toggl Entry Selected.' );
  }else{
    clearError();
    // log time for each jira ticket
    logs.forEach(function (log) {
      if ( !log.submit ){
        return false;
      }else{
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
          $('#result-' + log.id).text('LOGGED').addClass('success');
          $('#result-' + log.id).removeClass('warning');
          $('#result-' + log.id).removeClass('danger');
          $('#input-' + log.id).removeAttr('checked');
          $('#input-' + log.id).attr('data-log-submit', true);
          $('#tr-entry-' + log.id).addClass('already-logged');
        })
        jiraRequest.fail(function (error, message) {
          console.log(error, message);
          var e = error.responseText || JSON.stringify(error);
          e = JSON.parse( e );
          errorMessage = e.errorMessages[0];
          addError( errorMessage );
        })
      }
    });
  }
}

function selectEntry() {
  var id = this.id.split('input-')[1];
  logs.forEach(function (log) {
    if (log.id === id) {
      log.submit = this.checked;
    }
  }.bind(this));
}


function selectAll(){
  var hasChecked = false;
  $('.entry-checkbox[data-log-submit="false"]').each(function(){
    if( !$(this).is(':checked') ){
      $(this).click();
      hasChecked = true;
    }
  });
  if( !hasChecked ){
    addError( 'No Toggl Entry Selected.' );
  }
  return false;
}

function fetchEntries() {
  clearError();
  var startDate = document.getElementById('start-picker').valueAsDate.toISOString();
  var endDate   = document.getElementById('end-picker').valueAsDate.toISOString();
  localStorage.setItem('toggl-to-jira.last-date', startDate);
  localStorage.setItem('toggl-to-jira.last-end-date', endDate);
  //Make the query into Toggl;
  var dateQuery = '?start_date=' + startDate + '&end_date=' + endDate;
  $.get('https://www.toggl.com/api/v8/time_entries' + dateQuery, function (entries) {
    logs = [];
    entries.reverse();
    //Read each entry;
    entries.forEach(function (entry) {
      entry.description = entry.description || 'No description';
      var issue = entry.description.split(' ')[0];
      var togglTime = entry.duration;
      var dateString = toJiraWhateverDateTime(entry.start);
      var log = _.find(logs, function (log) {
        return log.issue === issue;
      });
      //Merge toggl entries by ticket?
      if (log && config.merge) {
        log.timeSpentInt = log.timeSpentInt + togglTime;
        log.timeSpent = log.timeSpentInt > 0 ? log.timeSpentInt.toString().toHHMM() : 'Running';
      } else {
        rawComment = entry.description.substr(issue.length);
        //Replace string if needed;
        if( config.commentReplace != '' ){
          rawComment = rawComment.replace(config.commentReplace, '');
        }
        //Trim string;
        rawComment = rawComment.trim();
        if( config.comment != '' ){
          if( rawComment != '' ){
            logComment = rawComment + ' - ' + config.comment;
          }else{
            logComment =  config.comment;
          }
        }else{
          if( rawComment != '' ){
            logComment = rawComment;
          }else{
            logComment = 'No description';
          }
        }
        log = {
          id: entry.id.toString(),
          issue: issue,
          description: entry.description.substr(issue.length),
          submit: (togglTime > 0),
          timeSpentInt: togglTime,
          timeSpent: togglTime > 0 ? togglTime.toString().toHHMM() : 'Running',
          comment: logComment,
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

function getMonthName(monthNumber){
  var monthNames = new Array();
  monthNames[0]  = 'Jan';
  monthNames[1]  = 'Feb';
  monthNames[2]  = 'Mar';
  monthNames[3]  = 'Apr';
  monthNames[4]  = 'May';
  monthNames[5]  = 'Jun';
  monthNames[6]  = 'Jul';
  monthNames[7]  = 'Aug';
  monthNames[8]  = 'Sep';
  monthNames[9]  = 'Oct';
  monthNames[10] = 'Nov';
  monthNames[11] = 'Dec';
  return monthNames[ monthNumber ];
}

function renderList() {
  //Get al entries;
  var list = $('#toggle-entries');
  list.children().remove();
  var totalTime       = 0;
  var totalTimeByDay  = 0;
  var currentDay      = '--';
  var todayDate       = new Date( Date.now() );
  var todayDateString = getMonthName( todayDate.getMonth() ) + ' ' + todayDate.getDate();
  //Render each entry;
  logs.forEach(function (log) {
    //Get some values;
    var url  = config.url + '/browse/' + log.issue;
    var date = new Date(log.timeSpentInt * 1000);
    //Check if this log is valid based on the issue key;
    regex = /[\w]-[\d]+/i;
    if( log.issue.match(regex) ){
      var validLog = true;
    }else{
      var validLog = false;
    }
    //Dom: Create the total time by day tr;
    if( currentDay != log.started.toDDMM() ){
      if( currentDay != '--' ){
        if( config.showDayTotal ){
          list.append('<tr class="table-total"><td></td><td></td><td class="text-right">Day Total&nbsp;</td><td><b>' + currentDay + '</b></td><td><b><i>'  + totalTimeByDay.toString().toHHMM() + '</b></i></td><td></td></tr>');
        }
      }
      currentDay     = log.started.toDDMM();
      totalTimeByDay = 0;
    }
    //Dom: Start the tr;
    if( validLog ){
      var dom = '<tr id="tr-entry-' + log.id + '">';
    }else{
      var dom = '<tr id="tr-entry-' + log.id + '" class="invalid-key">';
    }
    //Dom: Checkbox;
    if( validLog ){
      if (log.timeSpentInt > 0){
        dom += '<td><input id="input-' + log.id + '" class="entry-checkbox" type="checkbox" data-log-submit="false" data-log-date="' + log.started.toDDMM() + '" data-log-today="' + todayDateString + '" checked/></td>';
      }else{
        dom += '<td>&nbsp;</td>';
      }
    }else{
      dom += '<td>&nbsp;</td>';
    }
    //Dom: Issue Key and link;
    if( validLog ){
      dom += '<td><a href="' + url + '" target="_blank">' + log.issue + '</a></td>';
    }else{
      dom += '<td>' + log.issue + '</td>';
    }
    //Dom: Comment;
    dom += '<td>' + log.comment.limit(50) + '</td>';
    //Dom: Date;
    dom += '<td>' + log.started.toDDMM() + '</td>';
    //Duration;
    dom += '<td>' + (log.timeSpentInt > 0 ? log.timeSpentInt.toString().toHH_MM() : '--') + '</td>';
    //Dom: Status;
    if( validLog ){
      dom += '<td  id="result-' + log.id + '" class="' + (log.timeSpentInt > 0 ? 'warning' : 'danger') + '">' + (log.timeSpentInt > 0 ? 'NEW' : 'Running') + '</td>';
    }else{
      dom += '<td  id="result-' + log.id + '" class="danger">INVALID</td>';
    }
    //Close the tr element;
    dom += '</tr>';
    //Add to the total time;
    if( validLog ){
      totalTime      += (log.timeSpentInt > 0 && log.timeSpentInt) || 0;
      totalTimeByDay += (log.timeSpentInt > 0 && log.timeSpentInt) || 0;
    }
    //Append to html;
    list.append(dom);
    //Add the select entry js;
    if (log.timeSpentInt > 0) {
      $('#input-' + log.id).on('click', selectEntry);
    }
  })
  //Dom: Create the total time by day tr;
  if( config.showDayTotal ){
    list.append('<tr class="table-total"><td></td><td></td><td class="text-right">Day Total&nbsp;</td><td><b>' + currentDay + '</b></td><td><b><i>'  + totalTimeByDay.toString().toHHMM() + '</b></i></td><td></td></tr>');
  }
  //Dom: Create the total time tr;
  list.append('<tr class="table-footer"><td></td><td></td><td class="text-right"><b>TOTAL&nbsp;</b></td><td></td><td><b><i>'  + totalTime.toString().toHHMM() + '</b></i></td><td></td></tr>');
  //Uncheck todays checkboxes;
  $('.entry-checkbox').each(function(){
    if( $(this).is(':checked') && $(this).attr('data-log-today') == $(this).attr('data-log-date') ){
      $(this).click();
    }
  });
  //Check if entry was already logged;
  logs.forEach(function (log) {
    //Still need to add a fallback here;
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
          $('#input-' + log.id).attr('data-log-submit', true);
          $('#tr-entry-' + log.id).addClass('already-logged');
          log.submit = false;
        }
      })
    }).fail(function() {
      $('#result-' + log.id).text('ERROR').addClass('danger');
      $('#result-' + log.id).removeClass('warning');
      $('#result-' + log.id).removeClass('success');
      $('#input-' + log.id).removeAttr('checked');
      $('#input-' + log.id).attr('data-log-submit', false);
      addError( 'Error loading logs from jira, please try again later.' );
    });
  });
}