var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.result.records = [];
        this.result.cache = {};
        this.forEachRecord = null;
        this.readHeader(readPayloadStatus);
        this.on("error", function(err) {
            if (this.forEachRecord)
                this.forEachRecord(err);
        });
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.COMMAND;

command.prototype.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback immediately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));

    var mode = "s";
    var clazz;
    if (data.mode == "selectAsync" || data.mode == "a") {
        clazz = "com.orientechnologies.orient.core.sql.query.OSQLAsynchQuery";
        mode = "a";
    } else if (data.mode == 'selectSync' || data.mode == 's') {
        clazz = 'com.orientechnologies.orient.core.sql.query.OSQLSynchQuery';
    } else {
        clazz = 'com.orientechnologies.orient.core.sql.OCommandSQL';
    }

    // mode
    socket.write(parser.writeByte(mode.charCodeAt(), true));

    // serialized command
    var buffers = [];

    buffers.push(parser.writeString(clazz));

    // query text
    buffers.push(parser.writeString(data.query_text));

    // non text limit
    buffers.push(parser.writeInt(data.non_text_limit || -1));

    // fetchplan
    buffers.push(parser.writeString(data.fetchPlan || ""));

    var params = data.params;
    if (params) {
        if (Array.isArray(params)) {
            params = {};
            for (var i = 0; i < data.params.length; i++) {
                params[i] = data.params[i];
            }
        }
        var paramsDoc = {
            params: params
        };
        var paramsStr = parser.serializeDocument(paramsDoc);
        buffers.push(parser.writeString(paramsStr));
    } else {
        buffers.push(parser.writeInt(0));
    }

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
                if( this.forEachRecord )
                    this.forEachRecord(null, null);
                break;
            case 1:
                this.readRecord( function(record) {
                    result.records.push(record);
                    readPayloadStatus.call(this);
                    if( this.forEachRecord )
                        this.forEachRecord(null, record);
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
                this.emit("error", new Error("Unknown status " + status));
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

command.prototype.forEach = function(callback) {
    this.forEachRecord = callback;
};
