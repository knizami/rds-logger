"use strict";

var AWS = require('aws-sdk');
var dblogs = require('../utils/dblogfiles');

var rds = new AWS.RDS({
    region: 'us-west-2'
});

var params = {
    //    DBInstanceIdentifier: 'testlogging'
};

rds.describeDBInstances(params, function (err, data) {
    if (err) console.log('error thrown: ' + err, err.stack); // an error occurred
    else {
        //console.log(JSON.stringify(data)); // successful response
        for (let n = 0; n < data.DBInstances.length; n++) {
            var dbtype = data.DBInstances[n].Engine;
            var logFilename = dblogs.process_log[dbtype].log;
            console.log('db type is: ' + JSON.stringify(dbtype) + ' logfile: ' + JSON.stringify(logFilename));
        }
    }
});