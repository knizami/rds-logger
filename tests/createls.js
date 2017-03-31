"use strict";


var AWS = require('aws-sdk');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var dblogs = require('../utils/dblogfiles');

var dbInstance = 'testlogging';
var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var params = {
    logGroupName: dbInstance,
    /* required */
    logStreamName: dblogs.process_log["mysql"].log /* required */
};

instrumentLogging(dbInstance, dblogs.process_log["mysql"].log, function (err, data) {
    if (err) {
        console.log('Error creating log stream . group: ' + err, err.stack); // an error occurred

    } else {
        console.log("finished creating log stream and group..");
    }

});


function instrumentLogging(dbInstance, logStream, cb) {
    let cLGParams = {
        logGroupName: dbInstance
        // required */
        /*
        tags: {
            Logs: 'STRING_VALUE'
            // anotherKey: ... 
        }                                    
        */
    };

    cloudwatchlogs.createLogGroup(cLGParams, function (err, data) {
        if (!err) {
            var params = {
                logGroupName: dbInstance,
                /* required */
                logStreamName: logStream /* required */
            };
            //try to create log stream or reuse one in exception...
            cloudwatchlogs.createLogStream(params, function (err, data) {
                // new log stream created...
                if (!err) {
                    cb(null, data);
                } else {
                    //log group and log stream already exists..
                    cb(err, null);
                }
            });
        } else {
            //log group already exists...
            cb(err, null);
        }
    });
}