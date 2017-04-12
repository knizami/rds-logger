/**
 * Author:    Khurram Nizami (nizamik@amazon.com)
 * Created:   2017.04.03
 * Description:
 *   Library of functions to support log extraction and parsing from RDS to Cloudwatch Logs.
 *   By using Cloudwatch Logs you can maintain long living error logs, search, and view logs by date range...
 * 
 **/
"use strict";
var AWS = require('aws-sdk');
//var async = require('async');
//NOTE:  each region may support different database engines and database versions
var rds = new AWS.RDS({
    region: 'us-west-2'
});


var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var interval = 1;
var intervalInMs = interval * 60 * 1000;

const LOG_GROUP_PREFIX = "/aws/RDS/";


//NOTE:  Its possible that filenames would change from version to version of DB
//TODO:  validation code that log files for a given db type / version are correct


var log = {
    processLog: function (logs, instanceId, dbType, cwTimestamp, runningEvents, cb) {
        //console.log("events is: " + JSON.stringify(runningEvents));
        var totalEvents = (runningEvents) ? runningEvents : [];
        if (logs.length === 0) {
            return cb(null, totalEvents);
        }
        //grab a log
        var logFile = logs.pop();
        downloadRDSLogFile(instanceId, logFile, function (err, data) {
            if (!err) {
                var eventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                //console.log("parsed events are: " + JSON.stringify(eventsList));
                totalEvents = totalEvents.concat(eventsList);
                //console.log("events to push are: " + JSON.stringify(totalEvents));
                log.processLog(logs, instanceId, dbType, cwTimestamp, totalEvents, cb);
            } else {
                cb(err, null);
            }

        });

    },
    checkLogs: function (dbType, instanceId, cb) {
        //first get latest event in Cloudwatch for instance
        getLatestCWEvent(instanceId, log[dbType].stream, function (err, data) {
            if (!err) {
                var cwTimestamp = (data) ? data.timestamp : 0;
                //next get all error log files for instance
                getRDSLogFiles(instanceId, log[dbType].log(), function (err, data) {
                    if (!err) {
                        var dbLogs = data;
                        dbLogs.sort(function (a, b) {
                            return b.LastWritten - a.LastWritten;
                        });
                        var logsToProcess = [];
                        //console.log("processing logs, total: " + dbLogs.length + ": " + JSON.stringify(dbLogs));
                        for (let x = 0; x < dbLogs.length; x++) {
                            if (dbLogs[x].Size > 0 && dbLogs[x].LastWritten > cwTimestamp)
                                logsToProcess.push(dbLogs[x].LogFileName);
                        }
                        if (logsToProcess.length > 0) {
                            log.processLog(logsToProcess, instanceId, dbType, cwTimestamp, null, function (err, data) {
                                if (!err) {
                                    //console.log("new log process is: " + JSON.stringify(data));
                                    if (data.length > 0)
                                        cb(null, data);
                                    else
                                        cb(null, null);
                                } else {
                                    cb(err, null);
                                }
                            });
                        } else {
                            console.log("no logs to process...");
                            cb(null, null);
                        }
                    } else {
                        cb(err, null);
                    }
                });
            } else {
                console.log("Error retrieving latest event timestamp: " + err);
                console.log(err, null);
            }
        });

    },
    "mysql": {
        log: function () {
            return "error/mysql-error"
        },
        runningLog: "error/mysql-error-running.log",
        stream: "error/mysql-error.log",
        //this function gets the latest log event for parsing / processing of timestamp info...
        parser: function (LogFileData, cwTimestamp) {
            var loglines = LogFileData.split(/\r?\n/);
            var logeventslist = [];
            console.log('Log by lines length is: ' + loglines.length); // successful response
            for (let ll = 0; ll < loglines.length; ll++) {
                if (loglines[ll].length === 0 || loglines[ll].startsWith('Version:'))
                    continue;

                var timestampstr = loglines[ll].substring(0, 20);
                var logstr = loglines[ll].substring(22);
                var regexp = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/g;
                var validatedtimestamp = timestampstr.match(regexp);
                if (!validatedtimestamp)
                    throw new Error('error parsing log data in log: ' + log);

                //timestampstr = timestampstr.concat(dblogs.GMT_OFFSET["us-west-2"]);
                var epoch = Date.parse(timestampstr + 'GMT');

                //console.log('Epoch is: ' + epoch + " and lastEventTimestamp is " + cwTimestamp);
                //console.log('Log line of ' + ll + ' string is: ' + logstr + '\n');
                if (epoch > cwTimestamp) {
                    logeventslist.push({
                        timestamp: epoch,
                        message: logstr
                    });
                }
            }
            return logeventslist;
        }

    },
    "oracle-ee": {
        log: function () {
            return "trace/alert_TESTORCL.log";
        },
        runningLog: function (timeInMs) {
            if (!timeInMs)
                timeInMs = Date.now();
            var currDate = new Date(timeInMs);
            return "trace/alert_TESTORCL.log." + currDate.toISOString().substr(0, 10);
        },
        stream: "trace/alert_TESTORCL.log",
        parser: function (LogFileData, cwTimestamp) {
            var loglines = LogFileData.split(/\r?\n/);
            //String to parse is: Tue Mar 28 03:43:24 2017
            //convert to:  Tue, Mar 28 2017 00:00:00 GMT
            var regexp = /[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}/g;

            var logeventslist = [];
            //console.log('Log by lines length is: ' + loglines.length); // successful response

            for (let ll = 0; ll < loglines.length; ll++) {
                //console.log("loglines[ll].length: " + loglines[ll].length + ", string is: " + loglines[ll] + ", ");
                if (loglines[ll].length === 24 && loglines[ll].match(regexp)) {
                    var timestampstr = loglines[ll].substring(0, 3) + "," + loglines[ll].substring(3, 11) + loglines[ll].substring(20, 24) + loglines[ll].substring(10, 19) + " GMT";
                    //console.log("transformed string is: " + timestampstr);
                    var epoch = Date.parse(timestampstr);
                    var logstr = "";
                    while (!(typeof loglines[(ll + 1)] === "undefined") && !loglines[(ll + 1)].match(regexp)) {
                        ll++;
                        logstr = logstr.concat(loglines[ll] + '\n');
                    }
                    //console.log("parsed string is: " + logstr);
                    if (epoch > cwTimestamp) {
                        logeventslist.push({
                            timestamp: epoch,
                            message: logstr
                        });
                    }
                    //console.log('Epoch is: ' + epoch + " and string is " + logstr);
                }
                //console.log('Log line of ' + ll + ' string is: ' + logstr + '\n');
            }
            return logeventslist;
        }
    },
    //Sample Line:
    //2017-04-07 21:01:44 UTC::@:[3367]:LOG: checkpoint starting: time
    "postgres": {
        log: function (timeInMs) {
            if (!timeInMs)
                timeInMs = Date.now();
            var currDate = new Date(timeInMs);
            var currHour = (currDate.getUTCHours() < 10) ? "0" + currDate.getUTCHours() : currDate.getUTCHours();
            return "error/postgresql.log." + currDate.toISOString().substr(0, 10) + "-" + currHour;
        },
        stream: "error/postgresql.log",
        parser: function (LogFileData, cwTimestamp) {
            var loglines = LogFileData.split(/\r?\n/);
            var logeventslist = [];
            //console.log('Log by lines length is: ' + loglines.length); // successful response
            for (let ll = 0; ll < loglines.length; ll++) {
                if (loglines[ll].length === 0 || loglines[ll].startsWith('Version:'))
                    continue;

                var timestampstr = loglines[ll].substring(0, 20);
                var logstr = loglines[ll].substring(27);
                var regexp = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/g;
                var validatedtimestamp = timestampstr.match(regexp);
                if (!validatedtimestamp)
                    throw new Error('error parsing log data in log: ' + log);

                //timestampstr = timestampstr.concat(dblogs.GMT_OFFSET["us-west-2"]);
                var epoch = Date.parse(timestampstr + 'GMT');

                //console.log('Epoch is: ' + epoch + " and lastEventTimestamp is " + cwTimestamp);
                //console.log('Log line of ' + ll + ' string is: ' + logstr + '\n');
                if (epoch > cwTimestamp) {
                    logeventslist.push({
                        timestamp: epoch,
                        message: logstr
                    });
                }
            }
            return logeventslist;
        }
    },
    //Sample line:
    //2017-04-10 20:47:38.49 Server      UTC adjustment: 0:00
    "sqlserver-se": {
        log: function () {
            return "log/ERROR";
        },
        stream: "log/ERROR",
        //sql server parses same as postgres...
        parser: function (LogFileData, cwTimestamp) {
            var loglines = LogFileData.split(/\r?\n/);
            var logeventslist = [];
            //console.log('Log by lines length is: ' + loglines.length); // successful response
            loglines[0] = (loglines[0].startsWith('??')) ? loglines[0].substring(2) : loglines[0];
            for (let ll = 0; ll < loglines.length; ll++) {
                if (loglines[ll].length === 0)
                    continue;

                var timestampstr = loglines[ll].substring(0, 19);
                var regexp = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/g;
                var validatedtimestamp = timestampstr.match(regexp);
                if (validatedtimestamp) {
                    var logstr = loglines[ll].substring(23);
                    var epoch = Date.parse(timestampstr + ' GMT');
                    while (!(typeof loglines[(ll + 1)] === "undefined") && !loglines[(ll + 1)].match(regexp)) {
                        ll++;
                        logstr = logstr.concat('\n' + loglines[ll]);
                    }
                    //console.log("parsed string is: " + logstr);
                    if (epoch > cwTimestamp) {
                        logeventslist.push({
                            timestamp: epoch,
                            message: logstr
                        });
                    }
                    //console.log('Epoch is: ' + epoch + " and string is " + logstr);
                }
            }
            return logeventslist;
        }
    }
};
//sqlserver ex is the same as sql server se...
log["sqlserver-ex"] = log["sqlserver-se"];
//aurora is the same as mysql
log["aurora"] = log["mysql"];

//==========================

function instrumentLogging(dbInstance, dbType, cb) {
    let cLGParams = {
        logGroupName: LOG_GROUP_PREFIX + dbInstance
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
                logGroupName: LOG_GROUP_PREFIX + dbInstance,
                /* required */
                logStreamName: log[dbType].stream /* required */
            };
            //try to create log stream or reuse one in exception...
            cloudwatchlogs.createLogStream(params, function (err, data) {
                // new log stream created...
                if (!err) {
                    getCWLogStream(dbInstance, dbType, function (err, data) {
                        if (!err) {
                            //place first event in log...
                            var logEvents = [{
                                message: "new Cloudwatch Logs Stream and Group created for database instance: " + dbInstance,
                                timestamp: Date.now()
                            }];
                            putCWLogEvents(dbInstance, logEvents, data.logStream, function (err, data) {
                                if (!err) {
                                    console.log("Placed first event into new log group and stream for RDS instance: " + dbInstance);
                                    cb(null, data);
                                } else {
                                    console.log("Error placing first event into new log group and stream for RDS instance: " + dbInstance);
                                    cb(err, null);
                                }
                            });

                        } else {
                            console.log("Error retrieving log stream after creation: " + dbInstance);
                            cb(err, null);
                        }
                    });
                } else {
                    //log group and log stream already exists..
                    cb(err, null);
                }
            });
        } else {
            //error creating LogGroup
            console.log("error creating log group" + err, err.stack); // an error occurred
            cb(err, null);
        }
    });
}


function getLatestCWEvent(instanceId, logStream, cb) {
    var params = {
        logGroupName: LOG_GROUP_PREFIX + instanceId,
        /* required */
        logStreamName: logStream,
        /* required */
        //  endTime: 0,
        limit: 1
            //  nextToken: 'STRING_VALUE',
            //  startFromHead: true || false,
            //  startTime: 0
    };

    cloudwatchlogs.getLogEvents(params, function (err, data) {
        if (err) {
            cb(err, null); // an error occurred
        } else {

            var retData = (data.events[0]) ? data.events[0] : null;
            cb(null, retData);
        }
    });

}

function getCWLogStream(instanceId, dbType, cb) {
    //the log stream is named after the main log file type
    //TODO:  make configurable streams based on a provided interval...

    var logStreamName = log[dbType].stream;

    var dLSParams = {
        logGroupName: LOG_GROUP_PREFIX + instanceId,
        /* required */
        //descending: true || false,
        //limit: 0,
        logStreamNamePrefix: logStreamName
            //nextToken: 'STRING_VALUE',
            //orderBy: 'LogStreamName | LastEventTime'
    };

    cloudwatchlogs.describeLogStreams(dLSParams, function (err, data) {
        let retData = {};

        //logstream already exists..
        if (!err) {
            //since describe only matches prefixes, need to find exact match...
            let logStream = null;
            retData.totalLogStreams = data.logStreams.length;
            for (let s = 0; s < data.logStreams.length; s++) {
                if (data.logStreams[s].logStreamName === logStreamName) {
                    retData.exists = true;
                    retData.logStream = data.logStreams[s];
                    //console.log("found log stream: " + retData.logStream.logStreamName);
                    cb(null, retData);
                }
            }
        } else if (err && err.code === "ResourceNotFoundException") {
            retData.exists = false;
            retData.logStream = null;
            cb(null, retData);
        } else {
            cb(err, null);
        }
    });
}

function downloadRDSLogFile(instanceId, logStreamName, cb) {
    var downloadLogParams = {
        DBInstanceIdentifier: instanceId,
        /* required */
        LogFileName: logStreamName
            /* required */
            //Marker: 'STRING_VALUE',
            //NumberOfLines: 0
    };

    //console.log('downloading log data for instance: ' + instanceId + "with file: " + logStreamName);

    rds.downloadDBLogFilePortion(downloadLogParams, function (err, data) {
        if (err) {
            console.log("error downloading log for instance " + instanceId + ": " + err, err.stack); // an error occurred
            cb(err, null);
        } else {
            cb(null, data);
        }
    });
}


function putCWLogEvents(instanceId, logEvents, logStream, cb) {

    var params = {
        logEvents: logEvents,
        logGroupName: LOG_GROUP_PREFIX + instanceId,
        /* required */
        logStreamName: logStream.logStreamName,
        /* required */
        //will be undefined for newly created stream..
        sequenceToken: logStream.uploadSequenceToken
    };
    //console.log("uploading with sequence token: " + logStream.uploadSequenceToken);
    console.log("uploading events: " + JSON.stringify(logEvents));

    cloudwatchlogs.putLogEvents(params, function (err, data) {
        if (err) {
            console.log("ERROR:  error placing events for " + instanceId + ": " + JSON.stringify(err));
            cb(err, null); // an error occurred                        
        } else {
            //successfully placed log data..    
            console.log("data placed data for : " + instanceId + " and file " + logStream.logStreamName); // successful response
            //tag logstream with next sequence #
            cb(null, data);
        }
    });
}


function getRDSLogFiles(instanceId, logStream, cb) {
    var params = {
        DBInstanceIdentifier: instanceId,
        /* required */
        //FileLastWritten: 0,
        //FileSize: 0,
        FilenameContains: logStream

        //Filters: [{
        //        Name: 'STRING_VALUE',
        //        /* required */
        //        Values: [ /* required */
        //            'STRING_VALUE',
        /* more items */
        //        ]
        //    },
        //    /* more items */
        //],
        //Marker: 'STRING_VALUE',
        //MaxRecords: 0
    };

    //console.log("Looking for: " + logStream);

    rds.describeDBLogFiles(params, function (err, dbData) {
        if (err) {
            console.log("Error getting logfile info: " + err, err.stack); // an error occurred 
            cb(err, null);
        } else {
            return cb(null, dbData.DescribeDBLogFiles);
            //console.log(data); // successful 

        }

    });
}




module.exports = {
    log,
    getCWLogStream,
    putCWLogEvents,
    instrumentLogging
};