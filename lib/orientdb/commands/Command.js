var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.result.records = [];
        this.result.cache = {};
        this.readHeader(readPayloadStatus);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.COMMAND;

command.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback immediately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));

    // mode
    socket.write(parser.writeByte(data.mode.charCodeAt(), true));

    // serialized command
    var buffers = [];

    // TODO query class name
    var klass = 'com.orientechnologies.orient.core.sql.OCommandSQL';
    if (data.mode == 'a' )
        klass = 'com.orientechnologies.orient.core.sql.query.OSQLAsynchQuery';
    // todo: 'com.orientechnologies.orient.core.sql.query.OSQLSynchQuery'
    buffers.push(parser.writeString(klass));

    // query text
    buffers.push(parser.writeString(data.query_text));

    // non text limit
    buffers.push(parser.writeInt(data.non_text_limit || -1));

    // fetchplan
    buffers.push(parser.writeString(data.fetchPlan || ""));

    // TODO serialized params
    //buffers.push(parser.writeInt(data.serialized_params));
    buffers.push(parser.writeInt(0));

    // append all buffers into one
    var length = buffers.length;
    for (var i = 0, size = 0; i < length; i++) {
        size += buffers[i].length;
    }
    var buffer = new Buffer(size);
    for (var i = 0, size = 0; i < length; i++) {
        size += buffers[i].copy(buffer, size);
    }

    // serialized command
    socket.write(parser.writeBytes(buffer));
};

function readPayloadCollection() {
    this.readCollection(function(records) {
        var result = this.result;
        result.records = records;
    });
}

function readPayloadRecord() {
    this.readRecord(function(record) {
        var result = this.result;
        result.records.push(record);
    });
}

function readPayloadStatus() {
    this.readByte(function(status) {
        var result = this.result;

        switch (status) {
            case 0:
            case 110: // 'n'
                // nothing to do
                break;
            case 1:
                this.readRecord( function(record) {
                    result.records.push(record);
                    readPayloadStatus.call(this);
                });
                break;
            case 2:
                this.readRecord( function(record) {
                    result.cache[record['@rid']] = record;
                    readPayloadStatus.call(this);
                });
                break;
            case 97: // 'a'
                readPayloadString.call(this);
                break;
            case 108: // 'l'
                readPayloadCollection.call(this);
                break;
            case 114: // 'r'
                readPayloadRecord.call(this);
                break;
            default:
                console.log("Unknown status " + status);
        }
    });
}


function readPayloadString() {
    this.readString(function(str) {
        var result = this.result;
        var record = {
            "@type": "f",
            data: str
        };
        result.records.push(record);
    });
}
