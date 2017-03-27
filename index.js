use strict;

var AWS = require('aws-sdk');
var dblogs = require('./utils/dblogfiles');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var dbInstance = 'testlogging';
var cloudwatchlogs = new AWS.CloudWatchLogs({
    region: 'us-west-2'
});

var rdstolog = process.argv[2];


var dLGparams = {
    limit: 10
        //logGroupNamePrefix: 'STRING_VALUE',
        //nextToken: 'STRING_VALUE'
};


//check to see if log group exists for db instance first
cloudwatchlogs.describeLogGroups(dLGparams, function (err, data) {
    if (err)
        console.log(err, err.stack); // an error occurred
    else {
        for (let lgnum = 0; lgnum < data.logGroups.length; lgnum++) {
            console.log('The log group is: ' + data.logGroups[lgnum].logGroupName); // successful response
            //existing instance log group found
            if (rdstolog.toLowerCase() === data.logGroups[lgnum].logGroupName) {
                console.log("found existing log group");
            }
            //log group doesn't exist, create it
            else {
                console.log("log group " + rdstolog.toLowerCase() + " doesn't exist, creating..");
                var cLGParams = {
                    logGroupName: rdstolog.toLowerCase()
                        // required */
                        /*
                        tags: {
                            Logs: 'STRING_VALUE'
                            // anotherKey: ... 
                        }                                    
                        */
                };
                cloudwatchlogs.createLogGroup(cLGParams, function (err, data) {
                        if (err)
                            console.log(err, err.stack); // an error occurred                                    
                        else {
                            cloudwatchlogs.createLogStream(cLSparams, function (err, data) {
                                if (err)
                                    console.log(err, err.stack); // an error occurred
                                else {
                                    console.log(data); // successful response
                                }


                                //get log files for instance
                                var dDBLFParams = {
                                    DBInstanceIdentifier: dbInstance /* required */
                                        //  FileLastWritten: 0,
                                        //  FileSize: 0,
                                        //  FilenameContains: 'STRING_VALUE',
                                        //  Filters: [
                                        //    {
                                        //      Name: 'STRING_VALUE', /* required */
                                        //      Values: [ /* required */
                                        //        'STRING_VALUE',
                                        /* more items */
                                        //      ]
                                        //    },
                                        /* more items */
                                        //  ],
                                        //  Marker: 'STRING_VALUE',
                                        //  MaxRecords: 0
                                };

                                rds.describeDBLogFiles(dDBLFParams, function (err, data) {
                                    if (err)
                                        console.log(err, err.stack); // an error occurred
                                    else {
                                        console.log('Listing Log Files:');
                                        for (let lfnum = 0; lfnum < data.DescribeDBLogFiles.length; lfnum++) {

                                            console.log('Log file ' + lfnum + ": " + data.DescribeDBLogFiles[lfnum].LogFileName)

                                            var dDLFPParams = {
                                                DBInstanceIdentifier: dbInstance,
                                                /* required */
                                                LogFileName: dblogs.error_logs['mysql']
                                                    /* required */
                                                    //Marker: '18:224',
                                                    //NumberOfLines: 3
                                            };

                                            var currentLogFile = data.DescribeDBLogFiles[ln].LogFileName;
                                            //TODO:  Check timestamp of log and compare to last timestamp, only process if newer..
                                            rds.downloadDBLogFilePortion(dDLFPParams, function (err, data) {
                                                if (err)
                                                    console.log(err, err.stack); // an error occurred
                                                else {
                                                    console.log('Log data is: ' + data.LogFileData + ' and the marker is ' + data.Marker); // successful response
                                                    loglines = data.LogFileData.split("\\n");
                                                    for (let ll = 0; ll < loglines.length; ll++) {
                                                        //TODO:  change split to another method to pull timestamp out.
                                                        timestampstr = loglines[ll].substring(0, 20);
                                                        logstr = loglines[ll].substring(22);
                                                        regexp = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/U
                                                        validatedtimeestamp = timestampstr.match(regexp);
                                                        if (!validatedtimestamp)
                                                            throw new Error('error parsing log data');
                                                        epoch = Date.parse(timestampstr);
                                                        console.log('Epoch is: ' + epoch);

                                                        var cLSparams = {
                                                            logGroupName: cLGparams.logGroupName,
                                                            /* required */
                                                            logStreamName: currentLogFile /* required */
                                                        };
                                                    }
                                                }
                                            });
                                            console.log(data); // successful response

                                        }
                                        //get logs from RDS instance
                                    }
                                });
                            }); //end create log stream
                        }

                    }
                }
            });
    }
});