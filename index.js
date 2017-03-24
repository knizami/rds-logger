var AWS = require('aws-sdk');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var dbInstance = 'testlogging'

var params = {
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


rds.describeDBLogFiles(params, function (err, data) {
    if (err)
        console.log(err, err.stack); // an error occurred
    else {
        console.log('Listing Log Files:');
        for (var x = 0; x < data.DescribeDBLogFiles.length; x++) {
            console.log('Log file ' + x + ": " + data.DescribeDBLogFiles[x].LogFileName)
        }
        //get logs from RDS instance
        var params = {
            DBInstanceIdentifier: dbInstance,
            /* required */
            LogFileName: 'error/mysql-error-running.log.17',
            /* required */
            Marker: '18:224',
            NumberOfLines: 3
        };
        rds.downloadDBLogFilePortion(params, function (err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
                console.log('Log data is: ' + data.LogFileData + ' and the marker is ' + data.Marker); // successful response
                logline = data.LogFileData.split(" ");
                epoch = Date.parse(logline[0] + " " + logline[1]);
                console.log('Epoch is: ' + epoch);

                var params = {
                    limit: 0,
                    logGroupNamePrefix: 'STRING_VALUE',
                    nextToken: 'STRING_VALUE'
                };
                cloudwatchlogs.describeLogGroups(params, function (err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else console.log(data); // successful response
                });
            }
        });
    }
});