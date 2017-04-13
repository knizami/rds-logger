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
var rdslogs = require('./utils/dblogfiles');

var dbparams = {
    region: "us-west-2",

};

rdslogs.processLogs(dbparams, function (err, data) {
    if (!err) {
        if (data.length)
            console.log("Finished: " + JSON.stringify(data));
        else
            console.log("No log data ingested...");
    } else {
        console.log("ERROR: " + err);
    }
});




//==================================