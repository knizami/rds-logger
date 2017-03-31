var AWS = require('aws-sdk');

//NOTE:  each region may support different database engines and database versions
var rds = new AWS.RDS({
    region: 'us-west-2'
});

//no way to pull db type log filenames dynamically for each db instance type / version
//NOTE:  Its possible that filenames would change from version to version of DB
//TODO:  validation code that log files for a given db type / version are correct

const process_log = {
    "mysql": {
        log: "error/mysql-error.log",
        parser: function (data, lastEventTimestamp) {
            //TODO:  add case for currentRunTime >  currentTime % (5 * 60 * 1000) < intervalCheck 
            //log has been updated..
            //console.log("data is: " + JSON.stringify(data));
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

            console.log("events to push are: " + JSON.stringify(logeventslist));
            return logeventslist;
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
    process_log
};