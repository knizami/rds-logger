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
    //Tag: {
    //    Name: "repo-element-uid"
    //},
    region: "us-west-2"


};

var local = false;

exports.handler = (event, context, callback) => {
    console.time("rdsLog");
    rdslogs.processLogs(dbparams, function (err, data) {
        if (!err) {
            if (data.length) {
                console.log("Finished: " + JSON.stringify(data));
                console.timeEnd("rdsLog");

                if (!local)
                    callback(null, data);
            } else {
                console.log("No log data ingested...");
                if (!local)
                    callback(null, null);
            }
        } else {
            console.log("ERROR: " + err);
            if (!local)
                callback(err);
        }
    });

};


if (process.argv[2] === "local") {
    local = true;
    exports.handler();
}




//==================================