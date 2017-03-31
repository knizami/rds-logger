"use strict";


var AWS = require('aws-sdk');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var dbInstance = 'testlogging';
var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var dLGparams = {
    limit: 10,
    logGroupNamePrefix: 'RDSOSMetrics',
    //nextToken: 'STRING_VALUE'
};


//check to see if log group exists for db instance first
cloudwatchlogs.describeLogGroups(dLGparams, function (err, data) {
    if (!err) {
        console.log('found group: ' + JSON.stringify(data));
    }
});