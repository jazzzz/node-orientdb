var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readNumber);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.DATACLUSTER_ADD;

function readNumber() {
    this.readShort(function(number) {
        this.result.number = number;
    });
}

command.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback imidiately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));

    // cluster type
    socket.write(parser.writeString(data.type));

    // cluster  name
    socket.write(parser.writeString(data.name));

    // filename and size
    if (data.type === "PHYSICAL") {
        socket.write(parser.writeString(data.file_name));
        socket.write(parser.writeString(data.dataSegmentName));
    } else {
        socket.write(parser.writeString(null));
        socket.write(parser.writeString(null));
    }
};

