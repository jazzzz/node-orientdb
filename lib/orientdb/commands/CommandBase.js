var util = require("util"),
    parser = require("../connection/parser"),
    events = require("events");

var command = function() {
    this.reader = null;

    this.result = {};
    this.error = null;
    this.on("error", function(err) {
        this.error = err;
    });
};
util.inherits(command, events.EventEmitter);

command.prototype.done = function() {
    return this.reader == null || this.error != null;
};

command.prototype.wait = function(bytes, callback) {
    this.reader = {
        bytes: bytes,
        callback: callback
    };
};

command.prototype.readByte = function(callback) {
    this.wait(1, function(buf,offset) {
        callback.call(this, parser.readByte(buf, offset));
    });
};

command.prototype.readChar = function(callback) {
    this.readByte(function(charAsByte) {
        callback.call(this, String.fromCharCode(charAsByte));
    });
};

command.prototype.readShort = function(callback) {
    this.wait(2, function(buf,offset) {
        callback.call(this, parser.readShort(buf, offset));
    });
};

command.prototype.readInt = function(callback) {
    this.wait(4, function(buf,offset) {
        callback.call(this, parser.readInt(buf, offset));
    });
};

command.prototype.readLong = function(callback) {
    this.wait(8, function(buf,offset) {
        callback.call(this, parser.readLong(buf, offset ));
    });
};

command.prototype.readString = function(callback) {
    this.readInt(function(length) {
        if (length>0) {
            this.wait(length, function(buf,offset) {
                callback.call(this, buf.toString("utf8", offset, offset + length));
            });
        } else {
            callback.call(this, '');
        }
    });
};

command.prototype.readBytes = function(callback) {
    this.readInt(function(length) {
        var bytes = new Buffer(length);
        if (length>0) {
            this.wait(length, function(buf,offset) {
                buf.copy(bytes, 0, offset, length + offset);
                callback.call(this, bytes);
            });
        } else {
            callback.call(this, bytes);
        }
    });
};

command.prototype.readHeader = function(callback) {
    this.readByte(function(status) {
        this.readInt(function(sessionId) {
            if (status)
                this.readError(sessionId);
            else if (callback)
                callback.call(this, status, sessionId);
        } );
    } );
};

command.prototype.readRid = function(callback) {
    this.readShort(function(clusterId) {
        this.readLong(function(clusterPosition) {
            var rid = null;
            if (clusterId !== -1)
                rid = "#" + clusterId + ":" + clusterPosition;
            callback.call(this, rid);
        });
    });
};

command.prototype.readRecord = function(callback) {
    var record = {};

    // record class
    this.readShort(function(clazz) {
        if (clazz === -2) {
            // no record
            callback.call(this, null);
        } else if (clazz === -3) {
            this.readRid(function(rid) {
                record["@type"] = "d";
                record["@rid"] = rid;
                callback.call(this, record);
            });
        } else if (clazz > -1) {
            // valid

            this.readChar(function(type) {
                // record type ('d' or 'b')
                this.readRid(function(rid) {
                    if (rid)
                        record["@rid"] = rid;
                    this.readInt(function(version) {
                        record["@version"] = version;
                        this.readString(function(content) {
                            this.processRecordContent(record, type, content);
                            callback.call(this, record);
                        });
                    });
                });
            });
        } else {
            this.emit("error", new Error("Unknown record class id: " + clazz));
        }
    });
};

command.prototype.readArray = function(count,reader,callback) {
    var ar = [];
    readRemaining.call(this);
    function readRemaining() {
        if (count-- > 0) {
            reader.call(this, function(el) {
                ar.push(el);
                readRemaining.call(this);
            });
        } else if (callback) {
            callback.call(this, ar);
        }
    }
};

command.prototype.readClusters = function(next) {
    this.readShort(function(clusterCount) {
        this.readArray(clusterCount, this.readCluster, function(clusters) {
            this.result.clusters = clusters;
            if (next)
                next.call(this);
        });
    });
};

command.prototype.readCluster = function(callback) {
    this.readString(function(clusterName) {
        this.readShort(function(clusterId) {
            this.readString(function(clusterType) {
                this.readShort(function(dataSegmentId) {
                    var cluster = {
                        name: clusterName,
                        id: clusterId,
                        type: clusterType,
                        dataSegmentId: dataSegmentId
                    };
                    callback.call(this, cluster);
                });
            });
        });
    });
};

command.prototype.read = function(buf) {
    var bytesRead = 0,
        bytesLingering = (this.lingeringBuffer && this.lingeringBuffer.length) || 0,
        totalBytesRead = bytesRead,
        localBuffer = new Buffer(buf.length + bytesLingering);

    if (bytesLingering) this.lingeringBuffer.copy(localBuffer);

    buf.copy(localBuffer, bytesLingering);

    while (!this.done() && totalBytesRead + this.reader.bytes <= localBuffer.length) {
        var reader = this.reader;
        this.reader = null;
        reader.callback.call(this, localBuffer, totalBytesRead);
        totalBytesRead += reader.bytes;
    }

    this.lingeringBuffer = new Buffer(localBuffer.length - totalBytesRead);

    localBuffer.copy(this.lingeringBuffer, 0, totalBytesRead);

    // Give back the remaining buffer to the caller
    return this.lingeringBuffer;
};

command.prototype.readError = function() {
    var errors = [];
    readNextError.call(this);

    function readNextError() {
        this.readByte(function(more) {
            if (more) {
                this.readString(function(errorClass) {
                    this.readString(function(errorMessage) {
                        errors.push({
                            "class": errorClass,
                            message: errorMessage
                        });
                        readNextError.call(this);
                    });
                });
            } else {
                this.emit("error", new Error(JSON.stringify(errors)));
            }
        });
    }
};

command.prototype.processRecordContent = function(record, type, content) {
    record["@type"] = type;
    switch (type) {

        case "b":
        case "f":
            record.data = content;
            break;

        case "d":
            if (null == content) {
                record = {};
            } else {
                parser.deserializeDocument(content.toString(), record);
            }
            break;

        default:
            this.emit("error", new Error("Invalid or not supported record type: " + type));
    }
};

module.exports = command;