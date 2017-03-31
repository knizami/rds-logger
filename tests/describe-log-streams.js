"use strict";

var AWS = require('aws-sdk');


var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var dLSParams = {
    logGroupName: 'testloggingbad',
    /* required */
    //descending: true || false,
    //limit: 0,
    logStreamNamePrefix: 'doesntexists'
    //nextToken: 'STRING_VALUE',
    //orderBy: 'LogStreamName | LastEventTime'
};

cloudwatchlogs.describeLogStreams(dLSParams, function (err, data) {
    if (err) {
        console.log(err, err.stack); // an error occurred
    } else {
        console.log(data); // successful response
    }
});