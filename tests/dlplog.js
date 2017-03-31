var AWS = require('aws-sdk');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var dblogs = require('../utils/dblogfiles');


var downloadLogParams = {
    DBInstanceIdentifier: 'testlogging',
    /* required */
    LogFileName: 'error/mysql-error-running.log.15'
    /* required */
    //Marker: 'STRING_VALUE',
    //NumberOfLines: 0
};

rds.downloadDBLogFilePortion(downloadLogParams, function (err, data) {
    if (err)
        console.log(err, err.stack); // an error occurred
    else {
        JSON.stringify(data);
    }
});