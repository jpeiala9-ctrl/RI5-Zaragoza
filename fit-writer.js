// ==================== fit-writer.js - Generador WORKOUT FIT (compatible Garmin/TP) ====================
class FitWriter {
  constructor() {
    this.bytes = [];
    this.definitions = new Map();
    this.localMessageCount = 0;
  }

  // Añade un mensaje de definición (si no existe) y luego el registro de datos
  _writeMessage(globalMsgNum, fields) {
    let localMsgNum = this.definitions.get(globalMsgNum);
    if (localMsgNum === undefined) {
      localMsgNum = this.localMessageCount++;
      this.definitions.set(globalMsgNum, localMsgNum);

      // --- Definition Message ---
      const fieldDefs = fields.map(f => ({
        num: f.num,
        size: this._fieldSize(f.value, f.type),
        type: f.type
      }));
      const defSize = 6 + (3 * fieldDefs.length);
      const def = new Uint8Array(defSize);
      def[0] = 0x40;                 // header: definition message
      def[1] = 0x00;
      def[2] = 0x00;                 // little endian
      new DataView(def.buffer).setUint16(3, localMsgNum, true);
      def[5] = fieldDefs.length;

      let offset = 6;
      fieldDefs.forEach(fd => {
        def[offset] = fd.num;
        def[offset + 1] = fd.size;
        def[offset + 2] = fd.type;
        offset += 3;
      });
      this.bytes.push(def);
    }

    // --- Data Record ---
    let payloadSize = 0;
    fields.forEach(f => {
      payloadSize += this._fieldSize(f.value, f.type);
    });
    const record = new Uint8Array(1 + payloadSize);
    record[0] = 0x00; // normal record

    let offset = 1;
    fields.forEach(f => {
      const size = this._fieldSize(f.value, f.type);
      this._writeValue(record, offset, f.value, size);
      offset += size;
    });
    this.bytes.push(record);
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
    } else if (typeof value === 'number') {
      if (size === 1) view.setUint8(offset, value);
      else if (size === 2) view.setUint16(offset, value, true);
      else view.setUint32(offset, value, true);
    } else {
      view.setUint8(offset, value ? 1 : 0);
    }
  }

  // ========== MÉTODOS PÚBLICOS ==========
  fileHeader() {
    const header = new Uint8Array(14);
    header[0] = 14;
    header[1] = 0x10;
    new DataView(header.buffer).setUint16(2, 2132, true);
    header[8] = 0x2E;
    header[9] = 0x46;
    header[10] = 0x49;
    header[11] = 0x54;
    this.bytes.push(header);
  }

  fileId({ type, manufacturer, product, timeCreated }) {
    const now = timeCreated || new Date();
    const epoch = new Date(Date.UTC(1989, 11, 31, 0, 0, 0));
    const timestamp = Math.floor((now.getTime() - epoch.getTime()) / 1000);

    this._writeMessage(0, [
      { num: 0, value: 5,              type: 0x02 }, // type = workout
      { num: 1, value: 255,            type: 0x02 }, // manufacturer (development)
      { num: 2, value: 0,              type: 0x02 }, // product
      { num: 4, value: timestamp,      type: 0x86 }
    ]);
  }

  workout({ wktName, sport, subSport, numValidSteps }) {
    this._writeMessage(26, [
      { num: 0, value: 1,              type: 0x00 }, // sport = running
      { num: 4, value: wktName,        type: 7    }, // wkt_name
      { num: 11, value: numValidSteps, type: 0x02 }, // num_valid_steps
      { num: 5, value: 0,              type: 0x00 }  // sub_sport = generic
    ]);
  }

  workoutStep(index, { wktStepName, durationType, durationTime, targetType, targetValue, intensity }) {
    // Mapeo de intensidad
    let intensityVal = 1; // active
    if (intensity === 'warmup') intensityVal = 0;
    else if (intensity === 'cooldown') intensityVal = 3;
    else if (intensity === 'rest') intensityVal = 2;
    else if (intensity === 'recovery') intensityVal = 4;

    this._writeMessage(27, [
      { num: 254, value: index,               type: 0x02 }, // step_index
      { num: 0,   value: wktStepName,         type: 7    }, // wkt_step_name
      { num: 1,   value: 0,                   type: 0x00 }, // duration_type = time
      { num: 2,   value: durationTime,        type: 0x86 }, // duration_value (segundos, NO milisegundos)
      { num: 3,   value: 0,                   type: 0x00 }, // target_type = heart rate zone (0)
      { num: 4,   value: targetValue,         type: 0x86 }, // target_value (zona 1..5)
      { num: 7,   value: intensityVal,        type: 0x00 }  // intensity
    ]);
  }

  finish() {
    // Concatenar todos los bytes
    let totalLen = this.bytes.reduce((sum, arr) => sum + arr.length, 0);
    let full = new Uint8Array(totalLen);
    let pos = 0;
    for (const arr of this.bytes) {
      full.set(arr, pos);
      pos += arr.length;
    }

    // Actualizar cabecera (primeros 14 bytes) con el tamaño de datos y CRC
    const header = this.bytes[0];
    const dataLen = totalLen - 14;
    new DataView(header.buffer).setUint32(4, dataLen, true);

    const hdrCrc = this._crc16(header.slice(0, 12));
    new DataView(header.buffer).setUint16(12, hdrCrc, true);

    const dataCrc = this._crc16(full.slice(14));
    const crcBytes = new Uint8Array(2);
    new DataView(crcBytes.buffer).setUint16(0, dataCrc, true);

    const result = new Uint8Array(full.length + 2);
    result.set(full);
    result.set(crcBytes, full.length);
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
}