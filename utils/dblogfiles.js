var AWS = require('aws-sdk');

//NOTE:  each region may support different database engines and database versions
var rds = new AWS.RDS({
    region: 'us-west-2'
});

//no way to pull db type log filenames dynamically for each db instance type / version
//NOTE:  Its possible that filenames would change from version to version of DB
//TODO:  validation code that log files for a given db type / version are correct

var error_logs = {
    mysql: 'error/mysql-error.log'
}