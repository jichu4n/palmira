import 'reflect-metadata';

/** Common options to Serializable.parseFrom(). */
export interface ParseOptions {
  /** Text encoding.
   *
   * Available list of encodings:
   * https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
   */
  encoding?: string;
}

/** Common options to Serializable.serialize(). */
export interface SerializeOptions {
  /** Text encoding.
   *
   * Available list of encodings:
   * https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
   */
  encoding?: string;
}

/** A value that can be serialized / deserialized. */
export interface Serializable {
  /** Deserializes a buffer into this value.
   *
   * Returns number of bytes read.
   */
  parseFrom(buffer: Buffer, opts?: ParseOptions): number;
  /** Serializes this value into a buffer. */
  serialize(opts?: SerializeOptions): Buffer;
  /** Computes the serialized length of this value. */
  getSerializedLength(opts?: SerializeOptions): number;
}

/** No-op Serializable implementation that serializes to / from Buffers. */
export class SerializableBuffer implements Serializable {
  data: Buffer = Buffer.alloc(0);

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    this.data = Buffer.alloc(buffer.length);
    buffer.copy(this.data);
    return this.data.length;
  }

  serialize(opts?: SerializeOptions) {
    return this.data;
  }

  getSerializedLength(opts?: SerializeOptions) {
    return this.data.length;
  }
}

/** Interface for Serializable wrapper objects. */
export interface SerializableWrapper<ValueT> extends Serializable {
  value: ValueT;
}

/** Factory for Serializable wrappers for basic data types. */
export function createSerializableScalarWrapperClass<ValueT>({
  readFn,
  writeFn,
  serializedLength,
  defaultValue,
}: {
  readFn: () => ValueT;
  writeFn: (value: ValueT) => number;
  serializedLength: number;
  defaultValue: ValueT;
}) {
  const SerializableScalarWrapperClass = class
    implements SerializableWrapper<ValueT>
  {
    value: ValueT = defaultValue;

    parseFrom(buffer: Buffer) {
      this.value = readFn.call(buffer);
      return serializedLength;
    }

    serialize() {
      const buffer = Buffer.alloc(serializedLength);
      writeFn.call(buffer, this.value);
      return buffer;
    }

    getSerializedLength() {
      return serializedLength;
    }
  };
  return SerializableScalarWrapperClass;
}

/** Serializable wrapper for an unsigned 8-bit integer. */
export const UInt8 = createSerializableScalarWrapperClass({
  readFn: Buffer.prototype.readUInt8,
  writeFn: Buffer.prototype.writeUInt8,
  serializedLength: 1,
  defaultValue: 0,
});

/** Serializable wrapper for an unsigned 16-bit integer with big endian encoding. */
export const UInt16BE = createSerializableScalarWrapperClass({
  readFn: Buffer.prototype.readUInt16BE,
  writeFn: Buffer.prototype.writeUInt16BE,
  serializedLength: 2,
  defaultValue: 0,
});

/** Serializable wrapper for an unsigned 32-bit integer with big endian encoding. */
export const UInt32BE = createSerializableScalarWrapperClass({
  readFn: Buffer.prototype.readUInt32BE,
  writeFn: Buffer.prototype.writeUInt32BE,
  serializedLength: 4,
  defaultValue: 0,
});

/** Key for storing property information on a SerializableObject. */
const SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY = Symbol(
  'serializablePropertySpecs'
);

/** Serializable object property information. */
interface SerializablePropertySpec<ValueT = any> {
  /** The name of the property. */
  propertyKey: string | symbol;
  /** The underlying wrapper, if created with serializeWithWrapper. */
  wrapper?: SerializableWrapper<ValueT>;
}

/** Base class for Serializable object structures. */
export class SerializableObject implements Serializable {
  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
    let readOffset = 0;
    for (const propertySpec of this.serializablePropertySpecs) {
      readOffset += this.getPropertyOrWrapper(propertySpec).parseFrom(
        buffer.slice(readOffset),
        opts
      );
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return Buffer.concat(
      this.serializablePropertySpecs.map((propertySpec) =>
        this.getPropertyOrWrapper(propertySpec).serialize(opts)
      )
    );
  }

  getSerializedLength(opts?: SerializeOptions): number {
    let length = 0;
    for (const propertySpec of this.serializablePropertySpecs) {
      length +=
        this.getPropertyOrWrapper(propertySpec).getSerializedLength(opts);
    }
    return length;
  }

  private get serializablePropertySpecs() {
    return Reflect.getMetadata(
      SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY,
      Object.getPrototypeOf(this)
    ) as Array<SerializablePropertySpec>;
  }

  private getPropertyOrWrapper({
    propertyKey,
    wrapper,
  }: SerializablePropertySpec): Serializable {
    return wrapper ?? ((this as any)[propertyKey] as Serializable);
  }
}

/** Decorator for Serializable properties. */
export function serialize<ValueT>(
  target: any,
  propertyKey: string | symbol,
  // Used by serializeWithWrapper
  wrapper?: SerializableWrapper<ValueT>
) {
  const serializablePropertySpecs = Reflect.getMetadata(
    SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY,
    target
  );
  const propertySpec = {propertyKey, wrapper};
  if (serializablePropertySpecs) {
    serializablePropertySpecs.push(propertySpec);
  } else {
    Reflect.defineMetadata(
      SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY,
      [propertySpec],
      target
    );
  }
}

/** Decorator for Serializable properties that should use a wrapper class. */
export function serializeWithWrapper<ValueT>(
  serializableWrapperClass: new () => SerializableWrapper<ValueT>
): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const wrapper = new serializableWrapperClass();
    Object.defineProperty(target, propertyKey, {
      get() {
        return wrapper.value;
      },
      set(v: ValueT) {
        wrapper.value = v;
      },
    });
    serialize(target, propertyKey, wrapper);
  };
}
