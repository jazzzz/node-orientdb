var util = require("util"),
    debug = require("../connection/debug"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readSessionId);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.DB_OPEN;

function readSessionId() {
    this.readInt(function(sessionId) {
        this.result.sessionId = sessionId;
        this.readClusters.call(this, readClusterConfig);
    });
}

function readClusterConfig() {
    this.readBytes(function(clusterConfig){
        //todo
    });
}

command.write = function(socket, sessionId, data, callback) {

    debug.log("Writing on the socket operation " + command.operation + " on session " + sessionId);

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback immediately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId, true));

    // driver name
    socket.write(parser.writeString("OrientDB Node.js driver"));
    // driver version
    socket.write(parser.writeString("0.8.0"));
    // protocol version
    socket.write(parser.writeShort(12));
    // client id
    socket.write(parser.writeString(""));
    // database name
    socket.write(parser.writeString(data.database_name));
    // database type
    socket.write(parser.writeString(data.database_type));
    // user name
    socket.write(parser.writeString(data.user_name));
    // user password
    socket.write(parser.writeString(data.user_password));
};

