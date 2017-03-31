var AWS = require('aws-sdk');

//NOTE:  each region may support different database engines and database versions
var rds = new AWS.RDS({
    region: 'us-west-2'
});

//no way to pull db type log filenames dynamically for each db instance type / version
//NOTE:  Its possible that filenames would change from version to version of DB
//TODO:  validation code that log files for a given db type / version are correct

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
            var retData = {};
            retData.cwLogLastLine = (data.events[0]) ? data.events[0] : null;
            cb(null, retData);
        }
    });

}

var getCWLogStream = function getCWLogStream(instanceId, logStreamName, cb) {
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
        //logstream already exists..
        if (!err) {
            //since describe only matches prefixes, need to find exact match...
            let logStream = null;
            let retData = {};
            for (let s = 0; s < data.logStreams.length; s++) {
                if (data.logStreams[s].logStreamName === logFilename) {
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
                if ((dbData.DescribeDBLogFiles[m].LogFileName === logFilename)) {
                    var retData = {};
                    retData.dbLog = dbData.DescribeDBLogFiles[m];
                    return cb(null, retData);
                }
            }
        }

    });
}

const process_log = {
    "mysql": {
        log: "error/mysql-error.log",
        runningLog: "error/mysql-error-running.log",
        checkLog: function (instanceId, logStream, cb) {
            //get the log file date..
            getLatestCWEvent(instanceId, logStream, function (err, data) {
                if (!err) {
                    let retData = {};
                    retData.cwTimestamp = (data) ? data.timestamp : 0;
                    getRDSLogFile(instanceId, logStream, function (err, data) {
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
        parser: function (instanceId, logStreamName, data, cb) {
            //TODO:  add case for currentRunTime >  currentTime % (5 * 60 * 1000) < intervalCheck 
            //log has been updated..
            //console.log("data is: " + JSON.stringify(data));

            let cwTimestamp = data.cwLogLastLine;
            let dbTimestamp = data.dbLog.LastWritten;
            console.log("logstream timestamp " + cwTimestamp + ", db timestamp: " + dbTimestamp);
            //if database log file is newer than the last cloudwatch event in log, continue to download database file..
            if (dbTimestamp > cwTimestamp) {
                downloadRDSLogFile(instanceId, logStreamName, function (err, data) {
                    if (!err) {
                        var loglines = data.LogFileData.split(/\r?\n/);
                        var logeventslist = [];
                        console.log('Log by lines length is: ' + loglines.length); // successful response
                        for (let ll = 0; ll < loglines.length; ll++) {
                            if (loglines[ll].length === 0 || loglines[ll].startsWith('Version:'))
                                continue;
                            //TODO:  change split to another method to pull timestamp out.
                            var timestampstr = loglines[ll].substring(0, 20);
                            var logstr = loglines[ll].substring(22);
                            var regexp = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/g;
                            var validatedtimestamp = timestampstr.match(regexp);
                            if (!validatedtimestamp)
                                throw new Error('error parsing log data in log: ' + log);

                            //timestampstr = timestampstr.concat(dblogs.GMT_OFFSET["us-west-2"]);
                            var epoch = Date.parse(timestampstr + 'GMT');
                            console.log('Epoch is: ' + epoch + " and lastEventTimestamp is " + JSON.stringify(lastEventTimestamp));
                            console.log('Log line of ' + ll + ' string is: ' + logstr + '\n');
                            if (epoch > lastEventTimestamp) {
                                logeventslist.push({
                                    timestamp: epoch,
                                    message: logstr
                                });
                            }
                        }
                    } else {
                        cb(err, null);
                    }
                    console.log("events to push are: " + JSON.stringify(logeventslist));
                });
            }
        }
    },
    "oracle-ee": {
        log: "trace/alert_TESTORCL.log",
        parser: function (data) {
            return null;
        }
    },
    "postgres": {
        log: "error/postgres.log",
        parser: function (data) {
            return null;
        }
    }
}

module.exports = {
    process_log,
    getRDSLogFile,
    getCWLogStream,
    getLatestCWEvent,
    downloadRDSLogFile
};