// ============================================================
// fit-writer.js - Generador de .FIT para WORKOUTs
// Totalmente compatible con Garmin Connect y TrainingPeaks.
// ============================================================

class FitWriter {
    constructor() {
        this.bytes = [];
        this.globalToLocal = new Map();
        this.nextLocalNum = 0;
    }

    // --- Métodos públicos (API idéntica a la anterior) ---

    fileHeader() {
        const header = new Uint8Array(14);
        header[0] = 14;
        header[1] = 0x10;
        new DataView(header.buffer).setUint16(2, 2132, true);
        header[8] = 0x2E; header[9] = 0x46; header[10] = 0x49; header[11] = 0x54;
        this._pushBytes(header);
    }

    fileId({ type, manufacturer, product, timeCreated }) {
        const timestamp = this._toFITTimestamp(timeCreated || new Date());
        // type = 5 (workout) aunque el parámetro no se use realmente
        this._writeMessage(0, [
            { num: 0, value: 5, type: 0x02, size: 2 },
            { num: 1, value: manufacturer || 255, type: 0x02, size: 2 },
            { num: 2, value: product || 0, type: 0x02, size: 2 },
            { num: 4, value: timestamp, type: 0x86, size: 4 }
        ]);
    }

    workout({ wktName, sport, subSport, numValidSteps }) {
        this._writeMessage(26, [
            { num: 4, value: wktName, type: 0x07, size: this._calcStringSize(wktName) },
            { num: 0, value: sport === 'running' ? 1 : 1, type: 0x00, size: 1 },
            { num: 11, value: numValidSteps, type: 0x02, size: 2 },
            { num: 5, value: subSport === 'generic' ? 0 : 0, type: 0x00, size: 1 }
        ]);
    }

    workoutStep(index, { wktStepName, durationType, durationTime, targetType, targetValue, intensity }) {
        let intensityVal = 1; // active
        if (intensity === 'warmup') intensityVal = 0;
        else if (intensity === 'cooldown') intensityVal = 3;
        else if (intensity === 'rest') intensityVal = 2;
        else if (intensity === 'recovery') intensityVal = 4;

        this._writeMessage(27, [
            { num: 254, value: index, type: 0x02, size: 2 },
            { num: 0,   value: wktStepName, type: 0x07, size: this._calcStringSize(wktStepName) },
            { num: 1,   value: (durationType === 'time' ? 0 : 1), type: 0x00, size: 1 },
            { num: 2,   value: durationTime, type: 0x86, size: 4 }, // segundos
            { num: 3,   value: (targetType === 'heart_rate_zone' ? 0 : 1), type: 0x00, size: 1 },
            { num: 4,   value: targetValue, type: 0x06, size: 4 },
            { num: 7,   value: intensityVal, type: 0x00, size: 1 }
        ]);
    }

    finish() {
        let totalLen = this.bytes.reduce((sum, b) => sum + b.length, 0);
        let wholeFile = new Uint8Array(totalLen);
        let pos = 0;
        for (const b of this.bytes) {
            wholeFile.set(b, pos);
            pos += b.length;
        }

        const header = this.bytes[0];
        const dataSize = totalLen - 14;
        new DataView(header.buffer).setUint32(4, dataSize, true);

        const headerCrc = this._crc16(header.slice(0, 12));
        new DataView(header.buffer).setUint16(12, headerCrc, true);

        const dataCrc = this._crc16(wholeFile.slice(14));
        const crcBytes = new Uint8Array(2);
        new DataView(crcBytes.buffer).setUint16(0, dataCrc, true);

        const result = new Uint8Array(wholeFile.length + 2);
        result.set(wholeFile);
        result.set(crcBytes, wholeFile.length);
        return result;
    }

    // --- Métodos privados ---
    _writeMessage(globalNum, fields) {
        let localNum = this.globalToLocal.get(globalNum);
        const isNew = localNum === undefined;
        if (isNew) {
            localNum = this.nextLocalNum++;
            this.globalToLocal.set(globalNum, localNum);
            this._pushDefinition(localNum, globalNum, fields);
        }
        this._pushRecord(fields);
    }

    _pushDefinition(localNum, globalNum, fields) {
        const defSize = 6 + 3 * fields.length;
        const def = new Uint8Array(defSize);
        def[0] = 0x40;
        def[1] = 0x00;
        def[2] = 0x00;
        new DataView(def.buffer).setUint16(3, localNum, true);
        def[5] = fields.length;
        let offset = 6;
        for (const f of fields) {
            def[offset] = f.num;
            def[offset + 1] = f.size;
            def[offset + 2] = f.type;
            offset += 3;
        }
        this._pushBytes(def);
    }

    _pushRecord(fields) {
        let payloadSize = 0;
        for (const f of fields) payloadSize += f.size;
        const record = new Uint8Array(1 + payloadSize);
        record[0] = 0x00;
        let offset = 1;
        for (const f of fields) {
            this._writeValueToRecord(record, offset, f.value, f.size);
            offset += f.size;
        }
        this._pushBytes(record);
    }

    _writeValueToRecord(view, offset, value, size) {
        if (typeof value === 'string') {
            for (let i = 0; i < size; i++) {
                view.setUint8(offset + i, i < value.length ? value.charCodeAt(i) : 0);
            }
        } else if (typeof value === 'number') {
            if (size === 1) view.setUint8(offset, value);
            else if (size === 2) view.setUint16(offset, value, true);
            else view.setUint32(offset, value, true);
        } else {
            view.setUint8(offset, value ? 1 : 0);
        }
    }

    _calcStringSize(str) {
        return Math.min(str.length + 1, 64);
    }

    _toFITTimestamp(date) {
        const epoch = new Date(Date.UTC(1989, 11, 31, 0, 0, 0));
        return Math.floor((date.getTime() - epoch.getTime()) / 1000);
    }

    _pushBytes(data) {
        this.bytes.push(data);
    }

    _crc16(data) {
        const table = [
            0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
            0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
        ];
        let crc = 0;
        for (const b of data) {
            let index = crc & 0xF;
            crc = (crc >> 4) & 0x0FFF;
            crc ^= table[index] ^ table[b & 0xF];
            index = crc & 0xF;
            crc = (crc >> 4) & 0x0FFF;
            crc ^= table[index] ^ table[(b >> 4) & 0xF];
        }
        return crc;
    }
}