"use strict";

var AWS = require('aws-sdk');
var dblogs = require('./utils/dblogfiles');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});


//TODO:  read instances to log from some list or other source...
//TODO:  have switch to allow cloudwatch logging at <5 min user defined threshhold, 5 min intervals (running), or hourly (UTC hourly log capture)


//NOTE:  Timestamp in log will be relative to what timezone the instance is running in.  For cloudwatch logs, must determine timezone of instance and convert to UTC first.

//confirm DB instance exists and determine type...
var dbparams = {

}


rds.describeDBInstances(dbparams, function (err, data) {
    //db instance exists..
    if (!err) {
        //try to create log group, or use existing one in exception..
        //iterate through all db instances
        for (let n = 0; n < data.DBInstances.length; n++) {
            let dbtype = data.DBInstances[n].Engine;
            //console.log('db type is: ' + dbtype);
            let logFilename = dblogs.process_log[dbtype].log;
            let instanceId = data.DBInstances[n].DBInstanceIdentifier;

            var dLSParams = {
                logGroupName: instanceId,
                /* required */
                //descending: true || false,
                //limit: 0,
                logStreamNamePrefix: logFilename
                //nextToken: 'STRING_VALUE',
                //orderBy: 'LogStreamName | LastEventTime'
            };

            dblogs.getCWLogStream(instanceId, logFilename, function (err, data) {
                dblogs.process_log[dbtype].checkLog(instanceId, logFilename, function (err, data) {
                    if (!err) {
                        let cwTimestamp = (data.events[0]) ? data.events[0].timestamp : 0;
                        let dbTimestamp = dbData.DescribeDBLogFiles[m].LastWritten;
                        console.log("logstream timestamp " + cwTimestamp + ", db timestamp: " + dbTimestamp);
                        if (dbTimestamp > cwTimestamp) {
                            grabAndStash(instanceId, dbtype, logFilename, logStream, dbData.DescribeDBLogFiles[m], cwTimestamp, function (err, data) {
                                if (err) {
                                    console.log('Error putting new events in log stream: ' + err, err.stack); // an error occurred

                                } else {
                                    console.log("finished uploading log data for existing stream");
                                }
                            });
                        }


                        dblogs.process_log[dbtype].parser(data, function (err, data) {

                        });
                    } else {
                        console.log("error checking log" + err, err.stack); // an error occurred
                    }
                });
            });

            cloudwatchlogs.describeLogStreams(dLSParams, function (err, data) {
                //logstream already exists..
                if (!err) {
                    //since describe only matches prefixes, need to find exact match...
                    for (let s = 0; s < data.logStreams.length; s++) {

                        if (data.logStreams[s].logStreamName === logFilename) {

                            var params = {
                                DBInstanceIdentifier: instanceId,
                                /* required */
                                //FileLastWritten: 0,
                                //FileSize: 0,
                                FilenameContains: logFilename

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
                            let logStream = data.logStreams[s];
                            console.log(logStream.logStreamName + "  timestamp: " + logStream.lastEventTimestamp);


                            rds.describeDBLogFiles(params, function (err, dbData) {
                                if (err) {
                                    console.log("Error getting logfile info: " + err, err.stack); // an error occurred 
                                } else {
                                    //console.log(data); // successful response
                                    for (let m = 0; m < dbData.DescribeDBLogFiles.length; m++) {
                                        //log file updated, process updates...
                                        if ((dbData.DescribeDBLogFiles[m].LogFileName === logFilename)) {
                                            var params = {
                                                logGroupName: instanceId,
                                                /* required */
                                                logStreamName: logFilename,
                                                /* required */
                                                //  endTime: 0,
                                                limit: 1
                                                //  nextToken: 'STRING_VALUE',
                                                //  startFromHead: true || false,
                                                //  startTime: 0
                                            };

                                            cloudwatchlogs.getLogEvents(params, function (err, data) {
                                                if (err) {
                                                    console.log("error getting latest event" + err, err.stack); // an error occurred
                                                } else {
                                                    let cwTimestamp = (data.events[0]) ? data.events[0].timestamp : 0;
                                                    let dbTimestamp = dbData.DescribeDBLogFiles[m].LastWritten;
                                                    console.log("logstream timestamp " + cwTimestamp + ", db timestamp: " + dbTimestamp);
                                                    if (dbTimestamp > cwTimestamp) {
                                                        grabAndStash(instanceId, dbtype, logFilename, logStream, dbData.DescribeDBLogFiles[m], cwTimestamp, function (err, data) {
                                                            if (err) {
                                                                console.log('Error putting new events in log stream: ' + err, err.stack); // an error occurred

                                                            } else {
                                                                console.log("finished uploading log data for existing stream");
                                                            }
                                                        });
                                                    }

                                                }
                                            });
                                        } else if (dbData.DescribeDBLogFiles[m].LogFileName === logFilename) {
                                            console.log(instanceId + ": no update to log detected..");

                                        }


                                    }

                                }
                            });
                        }
                    }
                    //need to create stream and log group first...
                } else if (err && err.code === "ResourceNotFoundException") {
                    console.log("creating new log group and stream for: " + instanceId);

                    //log stream doesn't exist yet, create it first...
                    instrumentLogging(instanceId, logFilename, function (err, data) {
                        grabAndStash(instanceId, dbtype, logFilename, null, null, 0, function (err, data) {
                            if (err) {
                                console.log('Error putting new events in log stream: ' + err, err.stack); // an error occurred

                            } else {
                                console.log("finished uploading log data for new stream");
                            }
                        });

                    });
                    //console.log(err, err.stack); // an error occurred
                } else {
                    console.log('Error getting log stream: ' + err, err.stack); // an error occurred

                }
            }); //end snip
        }
    } else {
        console.log('Error retrieving db instances: ' + err, err.stack); // an error occurred

    }
});



function grabAndStash(logGroup, dbType, logStream, logFileData, dbFile, cwTimeStamp, cb) {
    var downloadLogParams = {
        DBInstanceIdentifier: logGroup,
        /* required */
        LogFileName: logStream
        /* required */
        //Marker: 'STRING_VALUE',
        //NumberOfLines: 0
    };

    let uploadSequenceToken = (logFileData) ? logFileData.uploadSequenceToken : undefined;


    console.log('processing log data for instance: ' + logGroup + "with lastEventTimestamp: " + cwTimeStamp);

    rds.downloadDBLogFilePortion(downloadLogParams, function (err, data) {
        if (err)
            console.log('error downloading log: ' + err, err.stack); // an error occurred
        else {
            let logeventslist = dblogs.process_log[dbType].parser(data, cwTimeStamp);

            if (logeventslist && logeventslist.length > 0) {
                let uploadToken = data.uploadToken;
                var params = {
                    logEvents: logeventslist,
                    logGroupName: logGroup,
                    /* required */
                    logStreamName: logStream,
                    /* required */
                    //will be undefined for newly created stream..
                    sequenceToken: uploadSequenceToken
                };
                console.log("uploading with sequence token: " + uploadSequenceToken);
                cloudwatchlogs.putLogEvents(params, function (err, data) {
                    if (err) {
                        console.log("error placing events: " + JSON.stringify(err));
                        cb(err, null); // an error occurred                        
                    } else {
                        //successfully placed log data..    
                        console.log('data placed: ' + JSON.stringify(data)); // successful response
                        //tag logstream with next sequence #
                        cb(null, data);
                    }
                });
            }
        }
    });

};

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



//==================================