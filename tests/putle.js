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
    logEvents: [{
        timestamp: 1490967543000,
        message: "test msg .."
    }],
    logGroupName: 'testlogging',
    /* required */
    logStreamName: dblogs.process_log["mysql"].log,
    /* required */
    sequenceToken: '49571730435052240034044658677546420209152801053696069410'
};


cloudwatchlogs.putLogEvents(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
        //successfully placed log data..    
        console.log('data placed: ' + JSON.stringify(data)); // successful response

    }
});