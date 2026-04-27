// ============================================================
// fit-writer.js - Generador de archivos FIT para WORKOUTs
// Basado en la documentación oficial de Garmin FIT SDK
// Compatible con Garmin Connect (copia a NewFiles) y TrainingPeaks
// ============================================================

class FitWriter {
  constructor() {
    this.chunks = [];        // array de Uint8Array
    this.defMap = new Map(); // globalMsgNum -> { localNum, fieldsDef }
    this.nextLocal = 0;
  }

  // ------------------------------------------------------------
  // 1. Cabecera del archivo (14 bytes fijos)
  // ------------------------------------------------------------
  fileHeader() {
    const header = new Uint8Array(14);
    header[0] = 14;                  // tamaño cabecera
    header[1] = 0x10;                // versión protocolo 1.0
    new DataView(header.buffer).setUint16(2, 2132, true); // versión perfil 21.32
    header[8] = 0x2E;                // '.'
    header[9] = 0x46;                // 'F'
    header[10] = 0x49;               // 'I'
    header[11] = 0x54;               // 'T'
    // bytes 12-13 se rellenarán en finish()
    this.chunks.push(header);
  }

  // ------------------------------------------------------------
  // 2. Mensaje FILE_ID (global 0) – tipo = workout (5)
  // ------------------------------------------------------------
  fileId({ timeCreated }) {
    const timestamp = this._toFitTimestamp(timeCreated || new Date());
    this._writeMessage(0, [
      { num: 0, value: 5,        type: 0x02, size: 2 }, // tipo workout
      { num: 4, value: timestamp, type: 0x86, size: 4 }
    ]);
  }

  // ------------------------------------------------------------
  // 3. Mensaje WORKOUT (global 26)
  // ------------------------------------------------------------
  workout({ wktName, numValidSteps }) {
    this._writeMessage(26, [
      { num: 4, value: wktName,        type: 0x07, size: this._strLen(wktName) },
      { num: 0, value: 1,              type: 0x00, size: 1 }, // sport = running
      { num: 11, value: numValidSteps, type: 0x02, size: 2 },
      { num: 5, value: 0,              type: 0x00, size: 1 }  // sub_sport = generic
    ]);
  }

  // ------------------------------------------------------------
  // 4. Mensaje WORKOUT_STEP (global 27)
  // ------------------------------------------------------------
  workoutStep(index, { wktStepName, durationTime, targetZone, intensity }) {
    // Mapeo de intensidad: warmup=0, active=1, cooldown=3
    let intensityVal = 1;
    if (intensity === 'warmup') intensityVal = 0;
    else if (intensity === 'cooldown') intensityVal = 3;

    this._writeMessage(27, [
      { num: 254, value: index,                type: 0x02, size: 2 }, // step_index
      { num: 0,   value: wktStepName,          type: 0x07, size: this._strLen(wktStepName) },
      { num: 1,   value: 0,                    type: 0x00, size: 1 }, // duration_type = time
      { num: 2,   value: durationTime,         type: 0x86, size: 4 }, // segundos
      { num: 3,   value: 0,                    type: 0x00, size: 1 }, // target_type = heart rate zone
      { num: 4,   value: targetZone,           type: 0x06, size: 4 }, // zona 1..5
      { num: 7,   value: intensityVal,         type: 0x00, size: 1 }
    ]);
  }

  // ------------------------------------------------------------
  // 5. Finalizar y obtener el ArrayBuffer del archivo .FIT
  // ------------------------------------------------------------
  finish() {
    // Concatenar todos los chunks
    let totalLen = this.chunks.reduce((s, arr) => s + arr.length, 0);
    let full = new Uint8Array(totalLen);
    let pos = 0;
    for (const arr of this.chunks) {
      full.set(arr, pos);
      pos += arr.length;
    }

    // Actualizar la cabecera: tamaño de datos y CRC
    const header = this.chunks[0];
    const dataLen = totalLen - 14;
    new DataView(header.buffer).setUint32(4, dataLen, true);

    // CRC de la cabecera (primeros 12 bytes)
    const hdrCrc = this._crc16(header.slice(0, 12));
    new DataView(header.buffer).setUint16(12, hdrCrc, true);

    // CRC de los datos (todo después de la cabecera)
    const dataCrc = this._crc16(full.slice(14));
    const crcBytes = new Uint8Array(2);
    new DataView(crcBytes.buffer).setUint16(0, dataCrc, true);

    const result = new Uint8Array(full.length + 2);
    result.set(full);
    result.set(crcBytes, full.length);
    return result;
  }

  // ------------------------------------------------------------
  // PRIVADOS
  // ------------------------------------------------------------
  _writeMessage(globalNum, fields) {
    // Obtener o crear número local y definición
    let localInfo = this.defMap.get(globalNum);
    if (!localInfo) {
      const localNum = this.nextLocal++;
      this.defMap.set(globalNum, { localNum, fields });
      this._writeDefinition(localNum, globalNum, fields);
    } else {
      localInfo = this.defMap.get(globalNum);
    }
    this._writeRecord(fields);
  }

  _writeDefinition(localNum, globalNum, fields) {
    const defSize = 6 + 3 * fields.length;
    const def = new Uint8Array(defSize);
    def[0] = 0x40;                // definition message
    def[1] = 0x00;                // reserved
    def[2] = 0x00;                // little endian
    new DataView(def.buffer).setUint16(3, localNum, true);
    def[5] = fields.length;

    let off = 6;
    for (const f of fields) {
      def[off] = f.num;
      def[off + 1] = f.size;
      def[off + 2] = f.type;
      off += 3;
    }
    this.chunks.push(def);
  }

  _writeRecord(fields) {
    let payloadSize = 0;
    for (const f of fields) payloadSize += f.size;
    const record = new Uint8Array(1 + payloadSize);
    record[0] = 0x00; // normal record

    let off = 1;
    for (const f of fields) {
      this._writeValue(record, off, f.value, f.size);
      off += f.size;
    }
    this.chunks.push(record);
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

  _strLen(str) {
    return Math.min(str.length + 1, 64);
  }

  _toFitTimestamp(date) {
    const epoch = new Date(Date.UTC(1989, 11, 31, 0, 0, 0));
    return Math.floor((date.getTime() - epoch.getTime()) / 1000);
  }

  _crc16(data) {
    const table = [
      0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
      0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
    ];
    let crc = 0;
    for (const b of data) {
      let idx = crc & 0xF;
      crc = (crc >> 4) & 0x0FFF;
      crc ^= table[idx] ^ table[b & 0xF];
      idx = crc & 0xF;
      crc = (crc >> 4) & 0x0FFF;
      crc ^= table[idx] ^ table[(b >> 4) & 0xF];
    }
    return crc;
  }
}