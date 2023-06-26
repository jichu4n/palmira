/** Script to generate udev rules for supported devices. */

import {program} from 'commander';
import {
  USB_DEVICE_CONFIGS,
  UsbDeviceConfig,
} from '../sync-servers/usb-device-configs';
import path from 'path';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
const packageJson = require('../../package.json');
import fs from 'fs-extra';

function generateRuleForDevice(deviceConfig: UsbDeviceConfig) {
  const vendorId = deviceConfig.vendorId.toString(16).padStart(4, '0');
  const productId = deviceConfig.productId.toString(16).padStart(4, '0');
  return [
    `# ${deviceConfig.label}`,
    [
      'SUBSYSTEMS=="usb"',
      'ACTION=="add"',
      `ATTRS{idVendor}=="${vendorId}"`,
      `ATTRS{idProduct}=="${productId}"`,
      'TAG+="uaccess"',
    ].join(', '),
  ].join('\n');
}

function generateUdevRules() {
  const rules = USB_DEVICE_CONFIGS.map(generateRuleForDevice).join('\n\n');
  return [
    '# ==================================================',
    '# udev rules for Palm OS device connected over USB, to be placed in /etc/udev/rules.d/',
    `# Generated by palm-sync (${packageJson.homepage})`,
    '# ==================================================',
    '',
    ...USB_DEVICE_CONFIGS.map(generateRuleForDevice),
  ].join('\n');
}

if (require.main === module) {
  (async () => {
    program
      .name('generate-udev-rules')
      .version(packageJson.version)
      .description(
        'Generate udev rules for supported Palm OS devices connected over USB'
      )
      .argument(
        '[output-file]',
        'Path to output file',
        path.join(__dirname, '..', '..', '60-palm-os-devices.rules')
      )
      .action(async (outputFile) => {
        await fs.writeFile(outputFile, generateUdevRules());
      });
    await program.parseAsync();
  })();
}
