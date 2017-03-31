"use strict";

var AWS = require('aws-sdk');
var dblogs = require('../utils/dblogfiles');


var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});


var dLSParams = {
    logGroupName: 'testlogging',
    /* required */
    //descending: true || false,
    //limit: 0,
    logStreamNamePrefix: dblogs.process_log["mysql"].log
    //nextToken: 'STRING_VALUE',
    //orderBy: 'LogStreamName | LastEventTime'
};

cloudwatchlogs.describeLogStreams(dLSParams, function (err, data) {
    //need to create stream and log group first...
    if (!err) {
        //since describe only matches prefixes, need to find exact match...
        for (let s = 0; s < data.logStreams.length; s++) {

            if (data.logStreams[s].logStreamName === dblogs.process_log["mysql"].log) {
                console.log(data.logStreams[s].logStreamName + "  timestamp: " + data.logStreams[s].lastEventTimestamp + ", sequenceToken " + data.logStreams[s].uploadSequenceToken);
            }

        }
    }
});