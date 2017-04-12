/**
 * Author:    Khurram Nizami (nizamik@amazon.com)
 * Created:   2017.04.03
 * Description:
 *   Iterate through all RDS instances and parse each error log, putting each into an existing / new log group with the RDS instance name.
 *   Additionally, a logstream with the same name as the log file is created in the log group.  
 *   By using Cloudwatch Logs you can maintain long living error logs, search, and view logs by date range...
 * 
 **/
"use strict";

var AWS = require('aws-sdk');
var dblogs = require('./utils/dblogfiles');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});


var dbparams = {};


rds.describeDBInstances(dbparams, function (err, data) {
    //db instance exists..
    if (!err) {
        //try to create log group, or use existing one in exception..
        //iterate through all db instances
        for (let n = 0; n < data.DBInstances.length; n++) {
            let dbtype = data.DBInstances[n].Engine;
            //console.log('db type is: ' + dbtype);
            let logFilename = dblogs.log[dbtype].log();
            let instanceId = data.DBInstances[n].DBInstanceIdentifier;
            dblogs.getCWLogStream(instanceId, dbtype, function (err, CWLogStreamData) {
                if (CWLogStreamData.exists) {
                    //console.log("dbtype is: " + dbtype);
                    dblogs.log.checkLogs(dbtype, instanceId, function (err, data) {
                        if (!err && data) {
                            dblogs.putCWLogEvents(instanceId, data, CWLogStreamData.logStream, function (err, data) {
                                if (!err) {
                                    console.log("finished processing & placing events for: " + instanceId);
                                } else {
                                    console.log("error placing events for: " + instanceId);
                                }
                            });
                        } else if (!data) {
                            console.log("no data to process for: " + instanceId);
                        } else {
                            console.log("error checking log: " + err, err.stack); // an error occurred
                        }
                    });
                } else {
                    dblogs.instrumentLogging(instanceId, dbtype, function (err, data) {
                        dblogs.log.checkLogs(dbtype, instanceId, function (err, data) {
                            if (!err && data) {
                                dblogs.putCWLogEvents(instanceId, data, CWLogStreamData.logStream, function (err, data) {
                                    if (!err) {
                                        console.log("finished processing & placing events for: " + instanceId);
                                    } else {
                                        console.log("error placing events for: " + instanceId);
                                    }
                                });
                            } else if (!data) {
                                console.log("no data to process for: " + instanceId);
                            } else {
                                console.log("error checking log: " + err, err.stack); // an error occurred
                            }
                        });
                    });
                }
            });
        }
    } else {
        console.log('Error retrieving db instances: ' + err, err.stack); // an error occurred
    }
});



//==================================