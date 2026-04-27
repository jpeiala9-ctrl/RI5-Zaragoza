// ==================== fit-writer.js - Generador FIT binario (funcional para Garmin/TP) ====================
class FitWriter {
  constructor() {
    this.data = [];
    this.localMesgNum = 0;
    this.messages = [];
    this.header = null;
  }

  fileHeader() {
    const header = new Uint8Array(14);
    header[0] = 14;
    header[1] = 0x10;
    new DataView(header.buffer).setUint16(2, 2132, true);
    header[8] = 0x2E;
    header[9] = 0x46;
    header[10] = 0x49;
    header[11] = 0x54;
    this.header = header;
  }

  fileId({ type, manufacturer, product, timeCreated }) {
    const mesgNum = 0;
    const fields = [
      { num: 0, value: this._enumType(type),                 type: 0x00 },
      { num: 1, value: this._enumManufacturer(manufacturer), type: 0x02 },
      { num: 2, value: product,                              type: 0x02 },
      { num: 4, value: this._timestamp(timeCreated),         type: 0x86 }
    ];
    this._writeMessage(mesgNum, fields);
  }

  workout({ wktName, sport, subSport, numValidSteps }) {
    const mesgNum = 26;
    const fields = [
      { num: 0, value: this._enumSport(sport),               type: 0x00 },
      { num: 3, value: numValidSteps,                        type: 0x02 },
      { num: 4, value: wktName,                              type: 7 },
      { num: 5, value: this._enumSubSport(subSport),         type: 0x00 }
    ];
    this._writeMessage(mesgNum, fields);
  }

  workoutStep(index, { wktStepName, durationType, durationTime, targetType, targetValue, intensity }) {
    const mesgNum = 27;
    const fields = [
      { num: 254, value: index,                              type: 0x02 },
      { num: 0,   value: wktStepName,                        type: 7 },
      { num: 1,   value: this._enumDurationType(durationType), type: 0x00 },
      { num: 2,   value: durationTime,                       type: 0x86 }, // ✅ segundos (NO multiplicar por 1000)
      { num: 3,   value: this._enumTargetType(targetType),   type: 0x00 },
      { num: 4,   value: targetValue,                        type: 0x86 },
      { num: 7,   value: this._enumIntensity(intensity),     type: 0x00 }
    ];
    this._writeMessage(mesgNum, fields);
  }

  finish() {
    let dataBuffer = new Uint8Array(0);
    this.messages.forEach(msg => {
      const def = msg.definition;
      const record = msg.record;
      const combined = new Uint8Array(def.length + record.length);
      combined.set(def);
      combined.set(record, def.length);
      const tmp = new Uint8Array(dataBuffer.length + combined.length);
      tmp.set(dataBuffer);
      tmp.set(combined, dataBuffer.length);
      dataBuffer = tmp;
    });

    const headerWithSize = new Uint8Array(this.header);
    new DataView(headerWithSize.buffer).setUint32(4, dataBuffer.length, true);
    const hdrCrc = this._crc16(headerWithSize.slice(0, 12));
    new DataView(headerWithSize.buffer).setUint16(12, hdrCrc, true);

    const dataCrc = this._crc16(dataBuffer);
    const crcBytes = new Uint8Array(2);
    new DataView(crcBytes.buffer).setUint16(0, dataCrc, true);

    const result = new Uint8Array(headerWithSize.length + dataBuffer.length + 2);
    result.set(headerWithSize);
    result.set(dataBuffer, headerWithSize.length);
    result.set(crcBytes, headerWithSize.length + dataBuffer.length);
    return result;
  }

  _crc16(data) {
    const t = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400];
    let crc = 0;
    for (const b of data) {
      let tmp = t[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc ^= tmp ^ t[b & 0xF];
      tmp = t[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc ^= tmp ^ t[(b >> 4) & 0xF];
    }
    return crc;
  }

  _writeMessage(mesgNum, fields) {
    const fieldDefs = fields.map(f => ({
      num: f.num,
      size: this._fieldSize(f.value, f.type),
      type: f.type
    }));
    const defSize = 6 + (3 * fieldDefs.length);
    const def = new Uint8Array(defSize);
    def[0] = 0x40;
    def[1] = 0;
    def[2] = 0x00;
    new DataView(def.buffer).setUint16(3, mesgNum, true);
    def[5] = fieldDefs.length;

    let offset = 6;
    fieldDefs.forEach(fd => {
      def[offset] = fd.num;
      def[offset + 1] = fd.size;
      def[offset + 2] = fd.type;
      offset += 3;
    });

    let payloadSize = 0;
    fieldDefs.forEach(fd => payloadSize += fd.size);
    const record = new Uint8Array(1 + payloadSize);
    record[0] = 0x00;

    const view = new DataView(record.buffer);
    let payloadOffset = 1;
    fields.forEach(f => {
      const fd = fieldDefs.find(d => d.num === f.num);
      this._writeValue(view, payloadOffset, f.value, fd.size);
      payloadOffset += fd.size;
    });

    this.messages.push({ definition: def, record: record });
  }

  _fieldSize(value, type) {
    if (type === 7) return Math.min(String(value).length + 1, 64);
    if (type === 0x00 || type === 0x01) return 1;
    if (type === 0x02) return 2;
    return 4;
  }

  _writeValue(view, offset, value, size) {
    if (typeof value === 'string') {
      for (let i = 0; i < size; i++) {
        view.setUint8(offset + i, i < value.length ? value.charCodeAt(i) : 0);
      }
    } else {
      if (size === 1) view.setUint8(offset, value);
      else if (size === 2) view.setUint16(offset, value, true);
      else view.setUint32(offset, value, true);
    }
  }

  _timestamp(date) {
    const epoch = new Date(Date.UTC(1989, 11, 31, 0, 0, 0));
    return Math.floor((date.getTime() - epoch.getTime()) / 1000);
  }

  _enumType(type)         { return type === 'workout' ? 5 : 4; }
  _enumManufacturer(m)    { return 255; }
  _enumSport(sport)       { return sport === 'running' ? 1 : 0; }
  _enumSubSport(sub)      { return 0; }
  _enumDurationType(d)    { return d === 'time' ? 0 : 0; }
  // ✅ target_type 0 = heart rate (corregido)
  _enumTargetType(t)      { return t === 'heart_rate_zone' ? 0 : 2; }
  _enumIntensity(i) {
    const map = { warmup: 0, active: 1, cooldown: 3, rest: 2, recovery: 4 };
    return map[i] ?? 1;
  }
}