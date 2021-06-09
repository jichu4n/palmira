import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import {decodeString, encodeString} from './database-encoding';
import {ParseOptions, Serializable, SerializeOptions} from './serializable';

/** Information about a category. */
export interface Category {
  /** Name of the category (max 15 bytes). */
  label: string;
  /** ID of the category (1 byte long).
   *
   * Unique IDs generated by the device are between 0 and 127. Unique IDs
   * generated by the desktop computer are between 128 and 255.
   */
  uniqId: number;
  /** Whether this category has been renamed.
   *
   * Usually cleared by a conduit.
   */
  isRenamed: boolean;
}

/** Length of standard category data. */
export const STANDARD_APP_INFO_LENGTH = 276;

/** AppInfo block for standard category data, a.k.a AppInfoType. */
export class CategoryInfo implements Serializable {
  /** Array of category information (max 16 elements). */
  categories: Array<Category> = [];
  /** The last unique category ID assigned. */
  lastUniqId: number = 0;

  /** Finds the category with the given unique ID. */
  getCategoryByUniqId(uniqId: number): Category | null {
    return _.find(this.categories, ['categoryUniqId', uniqId]) ?? null;
  }

  /** Finds the category with the given label. */
  getCategoryByLabel(label: string): Category | null {
    return _.find(this.categories, ['categoryLabel', label]) ?? null;
  }

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    const renamedCategories = reader.readUInt16BE();
    const categoryLabels: Array<string> = [];
    for (let i = 0; i < 16; ++i) {
      const initialReadOffset = reader.readOffset;
      categoryLabels.push(decodeString(reader.readBufferNT(), opts));
      reader.readOffset = initialReadOffset + 16;
    }
    const categoryUniqIds = [];
    for (let i = 0; i < 16; ++i) {
      categoryUniqIds.push(reader.readUInt8());
    }
    this.lastUniqId = reader.readUInt8();

    reader.readUInt8(0); // Padding byte.

    // Denormalize from {renamedCategories, categoryLabels, categoryUniqIds}.
    this.categories.length = 0;
    for (let i = 0; i < 16; ++i) {
      if (!categoryLabels[i]) {
        break;
      }
      this.categories.push({
        label: categoryLabels[i],
        uniqId: categoryUniqIds[i],
        isRenamed: !!(renamedCategories & (1 << i)),
      });
    }

    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const writer = new SmartBuffer();

    let renamedCategories = 0;
    for (let i = 0; i < this.categories.length; ++i) {
      if (this.categories[i].isRenamed) {
        renamedCategories |= 1 << i;
      }
    }
    writer.writeUInt16BE(renamedCategories);

    let offset = writer.writeOffset;
    for (const {label: categoryLabel} of this.categories) {
      if (categoryLabel.length > 15) {
        throw new Error(`Category label length exceeds 15: "${categoryLabel}"`);
      }
      writer.writeBufferNT(encodeString(categoryLabel, opts), offset);
      offset += 16;
    }
    for (let i = this.categories.length; i < 16; ++i) {
      writer.writeUInt8(0, offset);
      offset += 16;
    }

    for (const {uniqId: categoryUniqId} of this.categories) {
      if (categoryUniqId < 0 || categoryUniqId > 255) {
        throw new Error(`Invalid category unique ID: ${categoryUniqId}`);
      }
      writer.writeUInt8(categoryUniqId, offset++);
    }
    for (let i = this.categories.length; i < 16; ++i) {
      writer.writeUInt8(0, offset++);
    }

    writer.writeUInt8(this.lastUniqId);
    writer.writeUInt8(0); // Padding byte.

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return STANDARD_APP_INFO_LENGTH;
  }
}
