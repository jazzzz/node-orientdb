var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);
        
        this.readHeader(readDocumentCount);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.COUNT;

function readDocumentCount() {
    this.readLong(function(count) {
        this.result.count = count;
    });
}

command.write = function(socket, sessionId, clusterName, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback imidiately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));

    // clusters list length
    socket.write(parser.writeString(clusterName));
};

