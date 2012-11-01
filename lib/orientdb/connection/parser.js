"use strict";

var BYTES_LONG = 8;
var BYTES_INT = 4;
var BYTES_SHORT = 2;
var BYTES_BYTE = 1;
var REGEXP_RID = /#[\d]+:[\d]+/;

/*------------------------------------------------------------------------------
 (public) readByte

 + buf
 + offset
 - number

 Read a byte as unsigned integer from the buffer at the given offset.
 ------------------------------------------------------------------------------*/
var readByte = function(buf, offset) {
    return buf.readUInt8(offset);
};

/*------------------------------------------------------------------------------
 (public) readShort

 + buf
 - number

 Read a 2-byte signed integer from the buffer at the given offset.
 ------------------------------------------------------------------------------*/
var readShort = function(buf, offset) {
    return buf.readInt16BE(offset);
};

/*------------------------------------------------------------------------------
 (public) readInt

 + buf
 - number

 Read a 4-byte signed integer from the buffer at the given offset.
 ------------------------------------------------------------------------------*/
var readInt = function(buf, offset) {
    return buf.readInt32BE(offset);
};

/*------------------------------------------------------------------------------
 (public) readLong

 + buf
 - number

 Read a 8-byte signed integer from the buffer at the given offset.
 ------------------------------------------------------------------------------*/
var readLong = function(buf, offset) {
    return buf.readInt32BE(offset) * 4294967296 + buf.readUInt32BE(offset + BYTES_INT);
};

var typeOfVar = function(value) {
    var type = toString.call(value).substr(8);
    return type.substr(0, type.length - 1).toLowerCase();
};


var TYPE_UNDEFINED = typeOfVar(undefined);
var TYPE_NULL = typeOfVar(null);
var TYPE_FUNCTION = typeOfVar(function() {});
var TYPE_STRING = typeOfVar("");
var TYPE_NUMBER = typeOfVar(0);
var TYPE_OBJECT = typeOfVar({});
var TYPE_BOOLEAN = typeOfVar(true);
var TYPE_ARRAY = typeOfVar([]);
var TYPE_DATE = typeOfVar(new Date());


var isNullOrUndefined = function(value) {
    var type = typeOfVar(value);
    return type === TYPE_NULL || type === TYPE_UNDEFINED;
};


var isUndefined = function(value) {
    return typeOfVar(value) === TYPE_UNDEFINED;
};


var isFunction = function(value) {
    return typeOfVar(value) === TYPE_FUNCTION;
};


var isString = function(value) {
    return typeOfVar(value) === TYPE_STRING;
};


var isNumber = function(value) {
    return typeOfVar(value) === TYPE_NUMBER;
};


var isObject = function(value) {
    return typeOfVar(value) === TYPE_OBJECT;
};


var isBoolean = function(value) {
    return typeOfVar(value) === TYPE_BOOLEAN;
};


var isArray = function(value) {
    return typeOfVar(value) === TYPE_ARRAY;
};


var isDate = function(value) {
    return typeOfVar(value) === TYPE_DATE;
};


var serializeFieldValue = function(type, value) {
    var result = "";
    if (type === TYPE_STRING) {
        if (REGEXP_RID.test(value)) {
            result = result.concat(value);
        } else {
            result = result.concat("\"", value.replace(/\\/, "\\\\").replace(/"/g, "\\\""), "\"");
        }
    } else if (type === TYPE_NUMBER) {
        result = result.concat(value);
        if (value.toString().indexOf(".") !== -1) {
            result = result.concat("f");
        }
    } else if (type === TYPE_BOOLEAN) {
        result = result.concat(value);
    } else if (type === TYPE_DATE) {
        result = result.concat(Math.floor(value.getTime() / 1000.0), "t");
    } else if (type === TYPE_OBJECT) {
        result = serializedObject(value);
    } else if (type === TYPE_ARRAY) {
        result = result.concat("[");
        for (var i in value) {
            var innerType = typeOfVar(value[i]);
            if (innerType === TYPE_OBJECT) {
                result = result.concat(serializedObject(value[i]));
            } else {
                result = result.concat(serializeFieldValue(innerType, value[i]));
            }
            if (i < value.length - 1) {
                result = result.concat(",");
            }
        }
        result = result.concat("]");
    }
    return result;
};

var serializedObject = function(value) {
    if (value["@type"] === "d") {
        return "".concat("(", serializeDocument(value, false), ")");
    }
    return "".concat("{", serializeDocument(value, true), "}");
};


var serializeDocument = function(document, isMap) {
    isMap = isMap || false;
    var result = "";
    var clazz = "";
    for (var field in document) {
        if (field === "@version" || field === "@rid" || field === "@type") {
            continue;
        }
        var value = document[field];
        var type = typeOfVar(value);
        if (field === "@class") {
            clazz = value;
        } else {
            var fieldWrap = "";
            if (isMap) {
                fieldWrap = "\"";
            }
            result = result.concat(fieldWrap, field, fieldWrap, ":", serializeFieldValue(type, value), ",")
        }
    }

    if (clazz !== "") {
        result = clazz + "@" + result;
    }

    if (result[result.length - 1] === ",") {
        result = result.substr(0, result.length - 1);
    }

    return result;
};


var deserializeDocument = function(serialized, document, isMap) {

    serialized = serialized.trim();

    document = document || {};

    isMap = isMap || false;

    var classIndex = serialized.indexOf("@");

    var indexOfColon = serialized.indexOf(":");
    if (classIndex !== -1 && (indexOfColon > classIndex || indexOfColon === -1)) {
        document["@class"] = serialized.substr(0, classIndex);
        serialized = serialized.substr(classIndex + 1);
    }

    if (!isMap) {
        document["@type"] = "d";
    }

    var fieldIndex;

    while ((fieldIndex = serialized.indexOf(":")) !== -1) {
        var field = serialized.substr(0, fieldIndex);
        serialized = serialized.substr(fieldIndex + 1);
        if (field[0] === "\"" && field[field.length - 1] === "\"") {
            field = field.substring(1, field.length - 1);
        }
        var commaIndex = lookForCommaIndex(serialized);
        var value = serialized.substr(0, commaIndex);
        serialized = serialized.substr(commaIndex + 1);
        value = deserializeFieldValue(value, document);
        document[field] = value;
    }

    return document;
};


var deserializeFieldValue = function(value) {
    if (value === "") {
        return null;
    }
    if (value === "true" || value === "false") {
        return value === "true";
    }

    var firstChar = value[0];
    var lastChar = value[value.length - 1];

    if ("\"" === firstChar) {
        return value.substr(1, value.length - 2).replace(/\\"/g, "\"").replace(/\\\\/, "\\");
    }
    if ("t" === lastChar || "a" === lastChar) {
        return new Date(parseInt(value.substr(0, value.length - 1)) * 1000);
    }
    if ("(" === firstChar) {
        return deserializeDocument(value.substr(1, value.length - 2));
    }
    if ("{" === firstChar) {
        return deserializeDocument(value.substr(1, value.length - 2), {}, true);
    }
    if ("[" === firstChar) {
        var values = splitValuesFrom(value.substr(1, value.length - 2));
        for (var i in values) {
            values[i] = deserializeFieldValue(values[i]);
        }
        return values;
    }
    if ("b" === lastChar) {
        return String.fromCharCode(parseInt(value.substr(0, value.length - 1)));
    }
    if ("l" === lastChar || "s" === lastChar || "c" === lastChar) {
        return parseInt(value.substr(0, value.length - 1));
    }
    if ("f" === lastChar || "d" === lastChar) {
        return parseFloat(value.substr(0, value.length - 1));
    }
    if (parseInt(value).toString() === value) {
        return parseInt(value);
    }
    return value;
};


var splitValuesFrom = function(value) {
    var result = [];
    while (value.length > 0) {
        var commaAt = lookForCommaIndex(value);
        result.push(value.substr(0, commaAt));
        value = value.substr(commaAt + 1);
    }
    return result;
};


var lookForCommaIndex = function(serialized) {
    var delimiters = [];
    for (var i = 0; i < serialized.length; i++) {
        var current = serialized[i];
        if (current === "," && delimiters.length === 0) {
            return i;
        } else if ((current === "(" || current === "[" || current === "{") && delimiters[delimiters.length - 1] !== "\"") {
            delimiters.push(current);
        } else if ((current === ")" || current === "]" || current === "}") && delimiters[delimiters.length - 1] !== "\"" && current === oppositeDelimiterOf(delimiters[delimiters.length - 1])) {
            delimiters.pop();
        } else if (current === "\"" && delimiters[delimiters.length - 1] === "\"" && i > 0 && serialized[i - 1] !== "\\") {
            delimiters.pop();
        } else if (current === "\"" && delimiters[delimiters.length - 1] !== "\"") {
            delimiters.push(current);
        }
    }
    return serialized.length;
};

var oppositeDelimiterOf = function(c) {
    if (c === "[") {
        return "]";
    } else if (c === "{") {
        return "}";
    } else if (c === "(") {
        return ")";
    }
    return "\"";
};


var deserializeORID = function(ORID) {
    if (ORID["@type"] !== "b") {
        throw new Error("Expected a BINARY document");
    }

    var buf = ORID.data;
    var offset = 0;

    var treeSize = readInt(buf, offset);
    offset += BYTES_INT;
    var nodeSize = readInt(buf, offset);
    offset += BYTES_INT;

    offset += BYTES_BYTE + (BYTES_SHORT + BYTES_LONG); //ignoring color and parent rid

    var leftRidClusterId = readShort(buf, offset);
    offset += BYTES_SHORT;
    var leftRidClusterPosition = readLong(buf, offset);
    offset += BYTES_LONG;
    var leftRid;
    if (leftRidClusterId !== -1 && leftRidClusterPosition !== -1) {
        leftRid = toRid(leftRidClusterId, leftRidClusterPosition);
    }

    var rightRidClusterId = readShort(buf, offset);
    offset += BYTES_SHORT;
    var rightRidClusterPosition = readLong(buf, offset);
    offset += BYTES_LONG;
    var rightRid;
    if (rightRidClusterId !== -1 && rightRidClusterPosition !== -1) {
        rightRid = toRid(rightRidClusterId, rightRidClusterPosition)
    }

    var clusterId = -1;
    var clusterPosition = -1;
    var rids = [];
    for (var i = 0; i < nodeSize; i++) {
        clusterId = readShort(buf, offset);
        offset += BYTES_SHORT;
        clusterPosition = readLong(buf, offset);
        offset += BYTES_LONG;
        rids.push(toRid(clusterId, clusterPosition));
    }

    return {
        treeSize: treeSize,
        leftRid: leftRid,
        rightRid: rightRid,
        rids: rids
    };
};


var pushArray = function(targetArray, dataArray) {
    targetArray.push.apply(targetArray, dataArray);
};

/*------------------------------------------------------------------------------
 (public) writeByte

 + data
 + useBuffer (optional) - when returned value should be a buffer
 - bytes or buffer

 Parse data to 4 bytes which represents integer value.
 ------------------------------------------------------------------------------*/
var writeByte = function(data, useBuffer) {
    var aByte = [data];

    if (useBuffer) {
        return new Buffer(aByte);
    } else {
        return aByte;
    }
};

/*------------------------------------------------------------------------------
 (public) writeInt

 + data
 - bytes or buffer

 Parse data to 4 bytes which represents integer value.
 ------------------------------------------------------------------------------*/
var writeInt = function(data) {
    var buf = new Buffer(BYTES_INT);
    buf.writeInt32BE(data, 0);
    return buf;
};

/*------------------------------------------------------------------------------
 (public) writeLong

 + data
 - bytes or buffer

 Parse data to 4 bytes which represents integer value.
 ------------------------------------------------------------------------------*/
var writeLong = function(data) {
    var buf = new Buffer(BYTES_LONG);
    buf.fill(0);

    var high = data / 4294967296;
    high = high > 0 ? Math.floor(high) : Math.ceil(high);
    var low = data % 4294967296;
    buf.writeInt32BE(high, 0);
    buf.writeInt32BE(low, BYTES_INT);
    return buf;
};

/*------------------------------------------------------------------------------
 (public) writeShort

 + data
 - bytes or buffer

 Parse data to 2 bytes which represents short value.
 ------------------------------------------------------------------------------*/
var writeShort = function(data) {
    var buf = new Buffer(BYTES_SHORT);
    buf.writeInt16BE(data, 0);
    return buf;
};

/*------------------------------------------------------------------------------
 (public) writeBytes

 + data
 - buffer

 Write byte data to buffer.
 ------------------------------------------------------------------------------*/
var writeBytes = function(data) {
    var length = data.length;
    var buf = new Buffer(BYTES_INT + length);
    buf.writeInt32BE(length, 0);
    data.copy(buf, BYTES_INT);
    return buf;
};

/*------------------------------------------------------------------------------
 (public) writeString

 + data
 - buffer

 Parse string data to buffer with UTF-8 encoding.
 ------------------------------------------------------------------------------*/
var writeString = function(data) {
    if (data === null) {
        return writeInt(-1);
    }

    var stringBuf = stringToBuffer(data);
    var length = stringBuf.length;
    var buf = new Buffer(BYTES_INT + length);
    buf.writeInt32BE(length, 0);
    stringBuf.copy(buf, BYTES_INT, 0, stringBuf.length);
    return buf;
};


/*------------------------------------------------------------------------------
 (public) stringToBytes

 + data
 - buffer

 Converts a string to a buffer, without the length
 ------------------------------------------------------------------------------*/
var stringToBuffer = function(data) {
    return new Buffer(data);
};


// See OStorageConfiguration.fromStream(byte[]) method in the java implementation
var parseConfiguration = function(configString) {
    var values = configString.split("|");

    var read = function(value) {
        if (value === " ") {
            return null;
        }
        return value;
    };

    var phySegmentFromStream = function(config, version, values, index) {
        var fileTemplate = { };
        if (version > 2) {
            fileTemplate.location = read(values[index++]);
        } else {
            fileTemplate.location = null;
        }
        fileTemplate.maxSize = read(values[index++]);
        fileTemplate.fileType = read(values[index++]);
        fileTemplate.fileStartSize = read(values[index++]);
        fileTemplate.fileMaxSize = read(values[index++]);
        fileTemplate.fileIncrementSize = read(values[index++]);
        fileTemplate.defrag = read(values[index++]);

        fileTemplate.infoFiles = [];
        var size = parseInt(read(values[index++]));
        for (var i = 0; i < size; i++) {
            var fileName = read(values[index++]);

            if (fileName.indexOf("$") === -1) {
                // @COMPATIBILITY 0.9.25
                var pos = fileName.indexOf("/databases");
                if (pos > -1) {
                    fileName = "${ORIENTDB_HOME}" + fileName.substring(pos);
                }
            }

            var infoFile = { };
            infoFile.path = fileName;
            infoFile.type = read(values[index++]);
            infoFile.maxSize = read(values[index++]);
            infoFile.incrementSize = fileTemplate.fileIncrementSize;
            fileTemplate.infoFiles.push(infoFile);
        }

        config.fileTemplate = fileTemplate;

        return index;
    };

    var clustersFromStream = function(config, version, values, index) {
        config.clusters = [];
        var size = parseInt(read(values[index++]));
        for (var i = 0; i < size; i++) {
            var clusterId = parseInt(read(values[index++]));
            if (clusterId === -1) {
                continue;
            }

            var cluster = { };
            cluster.clusterId = clusterId;
            cluster.clusterName = read(values[index++]);
            cluster.dataSegmentId = version >= 3 ? parseInt(read(values[index++])) : 0;
            cluster.clusterType = read(values[index++]);
            if (cluster.clusterType === "p") {
                index = phySegmentFromStream(cluster, version, values, index);

                cluster.holeFile = {};
                cluster.holeFile.path = read(values[index++]);
                cluster.holeFile.type = read(values[index++]);
                cluster.holeFile.maxSize = read(values[index++]);
            } else if (cluster.clusterType === "m") {
                //nothing
            } else {
                throw new Error("Unknown cluster type: " + cluster.clusterType);
            }

            config.clusters.push(cluster);
        }
        return index;
    };

    var dataSegmentsFromStream = function(config, version, values, index) {
        config.dataSegments = [];
        var size = parseInt(read(values[index++]));
        for (var i = 0; i < size; i++) {
            var dataSegment = { };
            dataSegment.dataId = parseInt(read(values[index++]));
            dataSegment.dataName = read(values[index++]);
            index = phySegmentFromStream(dataSegment, version, values, index);
            dataSegment.holeFile = {};
            dataSegment.holeFile.path = read(values[index++]);
            dataSegment.holeFile.type = read(values[index++]);
            dataSegment.holeFile.maxSize = read(values[index++]);
            config.dataSegments.push(dataSegment);
        }
        return index;
    };

    var propertiesFromStream = function(config, values, index) {
        config.properties = [];
        var size = parseInt(read(values[index++]));
        for (var i = 0; i < size; i++) {
            var property = { };
            property.name = read(values[index++]);
            property.value = read(values[index++]);
            config.properties.push(property);
        }
        return index;
    };

    var index = 0;
    var config = { };
    config.version = parseInt(read(values[index++]));
    config.name = read(values[index++]);
    config.schemaRecordId = read(values[index++]);
    config.dictionaryRecordId = read(values[index++]);
    if (config.version > 0) {
        config.indexMgrRecordId = read(values[index++]);
    } else {
        config.indexMgrRecordId = null;
    }
    config.localeLanguage = read(values[index++]);
    config.localeCountry = read(values[index++]);
    config.dateFormat = read(values[index++]);
    config.dateTimeFormat = read(values[index++]);
    if (config.version > 1) {
        index = phySegmentFromStream(config, config.version, values, index);
    }
    index = clustersFromStream(config, config.version, values, index);
    index = dataSegmentsFromStream(config, config.version, values, index);
    config.txSegment = { };
    config.txSegment.path = read(values[index++]);
    config.txSegment.type = read(values[index++]);
    config.txSegment.maxSize = read(values[index++]);
    config.txSegment.synchRecord = read(values[index++]) === "true";
    config.txSegment.synchTx = read(values[index++]) === "true";
    index = propertiesFromStream(config, values, index);

    return config;
};

var canParseRid = function(rid) {
    return isString(rid) && REGEXP_RID.test(rid);
};

var parseRid = function(rid) {

    var splits = rid.substr(1).split(":");
    return {
        clusterId: parseInt(splits[0]),
        clusterPosition: parseInt(splits[1])
    };
};

var toRid = function(clusterId, clusterPosition) {
    return "#" + clusterId + ":" + clusterPosition;
};

var mergeHashes = function(destination, source) {
    for (var property in source) {
        if (source.hasOwnProperty(property)) {
            destination[property] = source[property];
        }
    }
    return destination;
};

var isEmptyObject = function(obj) {
    var name;
    for (name in obj) {
        return false;
    }
    return true;
};


var hashToSQLSets = function(hash) {
    if (isEmptyObject(hash)) {
        return {
            sqlsets: "",
            remainingHash: {}
        };
    }

    var remainingHash = {};
    var sql = "SET ";
    for (var field in hash) {
        var value = hash[field];
        if (isBoolean(value) || isNumber(value) || isString(value) || isDate(value)) {
            if (isString(value)) {
                value = "\"".concat(value.replace(/"/g, "\\\""), "\"");
            } else if (isDate(value)) {
                value = value.getTime();
            }
            sql = sql.concat(field, " = ", value, ", ")
        } else {
            remainingHash[field] = value;
        }
    }
    sql = sql.substring(0, sql.length - 2);

    return {
        sqlsets: sql,
        remainingHash: remainingHash
    };
};

exports.BYTES_BYTE = BYTES_BYTE;
exports.BYTES_INT = BYTES_INT;
exports.BYTES_LONG = BYTES_LONG;
exports.BYTES_SHORT = BYTES_SHORT;

exports.isNullOrUndefined = isNullOrUndefined;
exports.isUndefined = isUndefined;
exports.isFunction = isFunction;
exports.isString = isString;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.isBoolean = isBoolean;
exports.isArray = isArray;
exports.isDate = isDate;
exports.isEmptyObject = isEmptyObject;

exports.readByte = readByte;
exports.readShort = readShort;
exports.readInt = readInt;
exports.readLong = readLong;

exports.serializeFieldValue = serializeFieldValue;
exports.serializeDocument = serializeDocument;
exports.deserializeDocument = deserializeDocument;
exports.deserializeFieldValue = deserializeFieldValue;
exports.deserializeORID = deserializeORID;
exports.writeByte = writeByte;
exports.writeInt = writeInt;
exports.writeLong = writeLong;
exports.writeShort = writeShort;
exports.writeBytes = writeBytes;
exports.writeString = writeString;
exports.stringToBuffer = stringToBuffer;
exports.parseConfiguration = parseConfiguration;
exports.parseRid = parseRid;
exports.canParseRid = canParseRid;
exports.mergeHashes = mergeHashes;
exports.pushArray = pushArray;
exports.hashToSQLSets = hashToSQLSets;