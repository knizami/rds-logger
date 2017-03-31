"use strict";

var AWS = require('aws-sdk');
var dblogs = require('../utils/dblogfiles');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});


var params = {
    logGroupName: 'testlogging',
    /* required */
    logStreamName: dblogs.process_log["mysql"].log,
    /* required */
    //  endTime: 0,
    limit: 1
    //  nextToken: 'STRING_VALUE',
    //  startFromHead: true || false,
    //  startTime: 0
};
cloudwatchlogs.getLogEvents(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
        console.log('events returned: ' + JSON.stringify(data)); // successful response
    }
});