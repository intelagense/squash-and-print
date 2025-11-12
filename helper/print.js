// print.js
import usb from 'usb';
import { setTimeout as sleep } from 'timers/promises';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

// USB device IDs for my printer. You can determine these by running `node helper/list-usb.js`.
const VID = 0x0483;
const PID = 0x5720;

const device = usb.findByIds(VID, PID);
if (!device) throw new Error('Printer not even found.');

device.open();
await sleep(200);

// Set config 1 if needed, just in case.
if (device.configDescriptor?.bConfigurationValue !== 1) {
  await new Promise((res, rej) => device.setConfiguration(1, err => err ? rej(err) : res()));
}

const iface = device.interfaces[0];
if (!iface) throw new Error('Well, we couldn\'t find interface 0. So that sucks.');

// Claim the interface for our needs.
try {
  if (iface.isKernelDriverActive?.()) { try { iface.detachKernelDriver(); } catch {} }
  iface.claim();
} catch (e) {
  console.error('Claim failed:', e);
  throw e;
}

// Log endpoints for debugging.
console.log('Endpoints:', iface.endpoints.map(e => ({
  addr: '0x' + e.descriptor.bEndpointAddress.toString(16),
  dir: e.direction,
  type: e.transferType,
  mps: e.descriptor.wMaxPacketSize
})));

// Set the OUT endpoint for sending data to the printer.
let out = iface.endpoints.find(e => e.direction === 'out' && e.descriptor.bEndpointAddress === 0x01);
if (!out) out = iface.endpoints.find(e => e.direction === 'out');
if (!out) throw new Error('No OUT endpoint on interface 0');

// Build ESC/POS bytes for the printer.
const data = Buffer.from(
  new ReceiptPrinterEncoder()
    .initialize()
    .line('Hello world! testing testing?!?!')
    .line('12345678901234567890123456789012') // 32 characters max
    .newline(4) // 4 newlines gives us a margin of 1 newline above the cutter in this printer.
    .encode()
);

// Transfer
await new Promise((res, rej) => out.transfer(data, err => err ? rej(err) : res()));
console.log('Printed');

// Zero-length packet. Keeping this in case a random emergency replacement printer needs this workaround to flush.
// await new Promise(res => out.transfer(Buffer.alloc(0), () => res()));

await new Promise(res => iface.release(true, () => { device.close(); res(); }));
