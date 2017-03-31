"use strict";


var AWS = require('aws-sdk');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var dbInstance = 'testlogging';
var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var params = {
    logGroupName: 'RDSOSMetrics',
    /* required */
};

cloudwatchlogs.createLogGroup(params, function (err, data) {
    if (err) console.log('error json: ' + JSON.stringify(err)); // an error occurred
    else console.log(data); // successful response
});