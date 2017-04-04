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

//NOTE:  each region may support different database engines and database versions
var rds = new AWS.RDS({
    region: 'us-west-2'
});


var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var interval = 1;
var intervalInMs = interval * 60 * 1000;


//no way to pull db type log filenames dynamically for each db instance type / version
//NOTE:  Its possible that filenames would change from version to version of DB
//TODO:  validation code that log files for a given db type / version are correct

var instrumentLogging = function instrumentLogging(dbInstance, dbType, cb) {
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
                logStreamName: log[dbType].log /* required */
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
            //error creating LogGroup
            console.log("error creating log group" + err, err.stack); // an error occurred
            cb(err, null);
        }
    });
}


var getLatestCWEvent = function getLatestCWEvent(instanceId, logStream, cb) {
    var params = {
        logGroupName: instanceId,
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

var getCWLogStream = function getCWLogStream(instanceId, dbType, cb) {

    //the log stream is named after the main log file type
    //TODO:  make configurable streams based on a provided interval...

    var logStreamName = log[dbType].log;

    var dLSParams = {
        logGroupName: instanceId,
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
            for (let s = 0; s < data.logStreams.length; s++) {
                if (data.logStreams[s].logStreamName === logStreamName) {
                    retData.exists = true;
                    retData.logStream = data.logStreams[s];
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

var downloadRDSLogFile = function downloadRDSLogFile(instanceId, logStreamName, cb) {
    var downloadLogParams = {
        DBInstanceIdentifier: instanceId,
        /* required */
        LogFileName: logStreamName
        /* required */
        //Marker: 'STRING_VALUE',
        //NumberOfLines: 0
    };

    console.log('downloading log data for instance: ' + instanceId + "with file: " + logStreamName);

    rds.downloadDBLogFilePortion(downloadLogParams, function (err, data) {
        if (err) {
            console.log('error downloading log: ' + err, err.stack); // an error occurred
            cb(err, null);
        } else {
            cb(null, data);
        }
    });
}


var putCWLogEvents = function (instanceId, logEvents, logStream, cb) {

    var params = {
        logEvents: logEvents,
        logGroupName: instanceId,
        /* required */
        logStreamName: logStream.logStreamName,
        /* required */
        //will be undefined for newly created stream..
        sequenceToken: logStream.uploadSequenceToken
    };
    console.log("uploading with sequence token: " + logStream.uploadSequenceToken);
    cloudwatchlogs.putLogEvents(params, function (err, data) {
        if (err) {
            console.log("error placing events: " + JSON.stringify(err));
            cb(err, null); // an error occurred                        
        } else {
            //successfully placed log data..    
            console.log("data placed data for : " + instanceId + " and file " + logStream.logStreamName); // successful response
            //tag logstream with next sequence #
            cb(null, data);
        }
    });
}

var getRDSLogFile = function getRDSLogFile(instanceId, logStream, cb) {
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


    rds.describeDBLogFiles(params, function (err, dbData) {
        if (err) {
            console.log("Error getting logfile info: " + err, err.stack); // an error occurred 
        } else {
            //console.log(data); // successful response
            for (let m = 0; m < dbData.DescribeDBLogFiles.length; m++) {
                //log file updated, process updates...
                if ((dbData.DescribeDBLogFiles[m].LogFileName === logStream)) {
                    var retData = {};
                    retData.dbLog = dbData.DescribeDBLogFiles[m];
                    return cb(null, retData);
                }
            }
        }

    });
}

const log = {
    "mysql": {
        log: "error/mysql-error.log",
        runningLog: "error/mysql-error-running.log",
        //this function gets the latest log event for parsing / processing of timestamp info...
        checkLog: function (instanceId, logStreamName, cb) {
            //get the log file date..
            getLatestCWEvent(instanceId, logStreamName, function (err, data) {
                if (!err) {
                    let retData = {};
                    retData.cwTimestamp = (data) ? data.timestamp : 0;
                    getRDSLogFile(instanceId, logStreamName, function (err, data) {
                        if (!err) {
                            retData.dbLog = data.dbLog;
                            cb(null, retData);
                        } else {
                            cb(err, null);
                        }
                    });
                }
            });
        },
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

                console.log('Epoch is: ' + epoch + " and lastEventTimestamp is " + cwTimestamp);
                console.log('Log line of ' + ll + ' string is: ' + logstr + '\n');
                if (epoch > cwTimestamp) {
                    logeventslist.push({
                        timestamp: epoch,
                        message: logstr
                    });
                }
            }
            return logeventslist;
        },
        processLog: function (dbType, instanceId, logStreamName, data, cb) {
            //hardcoded for now, not known if possible to retrieve cloudwatch event lambda interval...
            var mySqlRotationInterval = 5 * 60 * 1000;
            var mySqlHourlyRotationInterval = 60 * 60 * 1000;
            //log has been updated..
            console.log("data is: " + JSON.stringify(data));

            let cwTimestamp = data.cwTimestamp;
            let dbTimestamp = data.dbLog.LastWritten;
            console.log("logstream timestamp " + cwTimestamp + ", db timestamp: " + dbTimestamp);
            //if database log file is newer than the last cloudwatch event in log, continue to download database file..
            if ((dbTimestamp > cwTimestamp) && (data.dbLog.Size > 0)) {
                //currentRunTime >  currentTime % (5 * 60 * 1000) < intervalCheck                
                //mysql rotates logs every 5 mins and hourly, if the time is within time of file rotation, must check flushed log to see if any events happened in between interval checks and got flushed...
                var executionTime = Date().now();
                var appendRotationLogEvents = (executionTime % mySqlHourlyRotationInterval < intervalInMs) ? (log[dbType].runningLog + '.' + new Date(executionTime).getUTCHours()) : false;
                if (!appendRotationLogEvents)
                    appendRotationLogEvents = (executionTime % mySqlRotationInterval < intervalInMs) ? log[dbType].runningLog : false;

                if (appendRotationLogEvents) {
                    console.log("processing running log as well since execution time < last file rotation..");
                    downloadRDSLogFile(instanceId, appendRotationLogEvents, function (err, data) {
                        if (!err) {
                            var runningEventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                            downloadRDSLogFile(instanceId, logStreamName, function (err, data) {
                                if (!err) {
                                    var eventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                                    if (runningEventsList.length > 0)
                                        eventslist.concat(runningEventsList);
                                    console.log("events to push are: " + JSON.stringify(eventsList));
                                    cb(null, eventsList);
                                } else {
                                    cb(err, null);
                                }
                            });
                        }

                    });
                } else {
                    downloadRDSLogFile(instanceId, logStreamName, function (err, data) {
                        if (!err) {
                            var eventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                            console.log("events to push are: " + JSON.stringify(eventsList));
                            cb(null, eventsList);
                        } else {
                            cb(err, null);
                        }
                    });
                }


            } else {
                cb(null, null);
            }
        }
    },
    "oracle-ee": {
        log: "trace/alert_TESTORCL.log",
        checkLog: function (instanceId, logStreamName, cb) {
            //get the log file date..
            getLatestCWEvent(instanceId, logStreamName, function (err, data) {
                if (!err) {
                    let retData = {};
                    retData.cwTimestamp = (data) ? data.timestamp : 0;
                    var currDate = new Date(Date.now());
                    var currDateString = currDate.getUTCFullYear() + "-" + currDate.getUTCMonth() + "-" + currDate.getUTCDay();
                    var logFileName = logStreamName.concat(currDateString);
                    getRDSLogFile(instanceId, logFileName, function (err, data) {
                        if (!err) {
                            retData.dbLog = data.dbLog;
                            cb(null, retData);
                        } else {
                            cb(err, null);
                        }
                    });
                }
            });
        },
        parser: function (LogFileData, cwTimestamp) {
            var loglines = LogFileData.split(/\r?\n/);
            //String to parse is: Tue Mar 28 03:43:24 2017
            //convert to:  Tue, Mar 28 2017 00:00:00 GMT
            var regexp = /[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}/g;

            var logeventslist = [];
            console.log('Log by lines length is: ' + loglines.length); // successful response

            for (let ll = 0; ll < loglines.length; ll++) {
                if (loglines[ll].length === 24 && loglines[ll].match(regexp)) {
                    var timestampstr = loglines[ll].substring(0, 3) + "," + loglines[ll].substring(3, 12) + loglines[ll].substring(3, 12) + loglines[ll].substring(20, 4) + loglines[ll].substring(10, 8) + " GMT";
                    var epoch = Date.parse(timestampstr);
                    var logstr = "";
                    while (!loglines[(ll + 1)].match(regexp)) {
                        ll++;
                        logstr.concat(loglines[ll] + '\n');
                    }
                    if (epoch > cwTimestamp) {
                        logeventslist.push({
                            timestamp: epoch,
                            message: logstr
                        });
                    }
                    console.log('Epoch is: ' + epoch + " and string is " + logstr);
                }
                console.log('Log line of ' + ll + ' string is: ' + logstr + '\n');
            }
            return logeventslist;
        },
        processLog: function (dbType, instanceId, logStreamName, data, cb) {
            //hardcoded for now, not known if possible to retrieve cloudwatch event lambda interval...
            var rotationInterval = 24 * 60 * 60 * 1000;
            //log has been updated..
            console.log("data is: " + JSON.stringify(data));

            let cwTimestamp = data.cwTimestamp;
            let dbTimestamp = data.dbLog.LastWritten;
            console.log("logstream timestamp " + cwTimestamp + ", db timestamp: " + dbTimestamp);
            //if database log file is newer than the last cloudwatch event in log, continue to download database file..
            if ((dbTimestamp > cwTimestamp) && (data.dbLog.Size > 0)) {
                //currentRunTime >  currentTime % (5 * 60 * 1000) < intervalCheck                
                //oracle rotates logs daily.  If the executionTime is < intervalCheck on rotation time then need to check the previous days logs to make sure no events are missed...
                var executionTime = new Date(Date().now());
                //get the previous days logstream if within threshhold and check timestamp..
                var appendRotationLogEvents = (executionTime.getTime() % rotationInterval < intervalInMs) ? (log[dbType].log + '.' + new Date(executionTime - intervalInMs).toISOString().substr(0, 10)) : false;
                //TODO avoid processing by checking timestamp on log file to see if its updated within threshhold...
                if (appendRotationLogEvents) {
                    console.log("processing running log as well since execution time < last file rotation..");
                    downloadRDSLogFile(instanceId, appendRotationLogEvents, function (err, data) {
                        if (!err) {
                            var runningEventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                            downloadRDSLogFile(instanceId, logStreamName, function (err, data) {
                                if (!err) {
                                    var eventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                                    if (runningEventsList.length > 0)
                                        eventslist.concat(runningEventsList);
                                    console.log("events to push are: " + JSON.stringify(eventsList));
                                    cb(null, eventsList);
                                } else {
                                    cb(err, null);
                                }
                            });
                        }

                    });
                } else {
                    downloadRDSLogFile(instanceId, logStreamName, function (err, data) {
                        if (!err) {
                            var eventsList = log[dbType].parser(data.LogFileData, cwTimestamp);
                            console.log("events to push are: " + JSON.stringify(eventsList));
                            cb(null, eventsList);
                        } else {
                            cb(err, null);
                        }
                    });
                }
            } else {
                cb(null, null);
            }
        }
    },
    "postgres": {
        log: "error/postgres.log",
        checkLog: function (instanceId, logStreamName, cb) {
            //get the log file date..
            getLatestCWEvent(instanceId, logStreamName, function (err, data) {
                if (!err) {
                    let retData = {};
                    retData.cwTimestamp = (data) ? data.timestamp : 0;
                    var currDate = new Date(Date.now());
                    var currDateString = currDate.getUTCFullYear() + "-" + currDate.getUTCMonth() + "-" + currDate.getUTCDay() + "-" + currDate.getUTCHours();
                    var logFileName = logStreamName.concat(currDateString);
                    getRDSLogFile(instanceId, logFileName, function (err, data) {
                        if (!err) {
                            retData.dbLog = data.dbLog;
                            cb(null, retData);
                        } else {
                            cb(err, null);
                        }
                    });
                }
            });
        },
        parser: function (data) {
            return null;
        }
    }
}

module.exports = {
    log,
    getRDSLogFile,
    getCWLogStream,
    getLatestCWEvent,
    downloadRDSLogFile,
    putCWLogEvents,
    instrumentLogging
};