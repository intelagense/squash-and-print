// print.js
import usb from 'usb';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import sharp from 'sharp';
import { setTimeout as sleep } from 'timers/promises';

// USB device IDs for my printer. You can determine these by running `node helper/list-usb.js`.
const VID = 0x0483;
const PID = 0x5720;

/**
 * Print this thing with name, message, and image
 * @param {number} jobId - Job ID to print on receipt
 * @param {Object} payload - The print job data
 * @param {string} payload.name - Name (max 30 chars)
 * @param {string} payload.email - Email (not printed, kept for future DB storage)
 * @param {string} payload.message - Message (max 256 chars)
 * @param {Buffer} payload.imageBuffer - Image buffer (JPEG/WebP)
 * @returns {Promise<void>}
 */
export async function printThis(jobId, { name, email, message, imageBuffer }) {
  // Find and open the printer device
  const device = usb.findByIds(VID, PID);
  if (!device) throw new Error('Printer not found');

  device.open();
  await sleep(200);

  // Set config 1 if needed
  if (device.configDescriptor?.bConfigurationValue !== 1) {
    await new Promise((resolve, reject) => 
      device.setConfiguration(1, err => err ? reject(err) : resolve())
    );
  }

  const iface = device.interfaces[0];
  if (!iface) throw new Error('Well, we couldn\'t find interface 0. So that sucks.');

  // Claim the interface
  try {
    if (iface.isKernelDriverActive?.()) { 
      try { 
        iface.detachKernelDriver(); 
        await sleep(200); // Time to release the driver
      } catch {} 
    }
    iface.claim();
  } catch (e) {
    console.error('Claim failed:', e);
    if (e.errno === -3) {
      throw new Error('USB device access denied. Make sure no other program is using the printer, and try unplugging/replugging the USB cable.');
    }
    throw e;
  }

  // Find OUT endpoint
  const out = iface.endpoints.find(e => 
    e.direction === 'out' && e.descriptor.bEndpointAddress === 0x01
  ) ?? iface.endpoints.find(e => e.direction === 'out');
  
  if (!out) throw new Error('No OUT endpoint on interface 0');

  try {
    // Process the image to make sure they didnt bypass the client-side processing
    // @TODO: This can be cleaned up by checking if the image is already fully processed.
    const resized = await sharp(imageBuffer)
      .ensureAlpha()
      .resize({ 
        width: 384, 
        height: 384,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // This whole section is GPT math btw. Was trying to fix a contrast issue. 
    // @TODO: Make this better.
    const minBrightness = 100;
    const pixelData = resized.data;
    const channels = resized.info.channels;
    
    for (let i = 0; i < pixelData.length; i += channels) {
      // Convert to greyscale (average RGB)
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const gray = Math.round((r + g + b) / 3);
      
      // Remap: 0-255 → minBrightness-255, then clamp to ensure no value below minBrightness
      const remapped = Math.round(minBrightness + (gray / 255) * (255 - minBrightness));
      const finalValue = Math.max(minBrightness, remapped); // Extra safety clamp
      
      // Set all channels to the same greyscale value
      pixelData[i] = finalValue;
      pixelData[i + 1] = finalValue;
      pixelData[i + 2] = finalValue;
    }

    const processedImage = {
      data: pixelData,
      info: resized.info
    };

    // Initialize encoder
    const encoder = new ReceiptPrinterEncoder({
      language: 'esc-pos',
      columns: 32,
      feedBeforeCut: 4,
      imageMode: 'raster'
    });

    // Build the output data for the printer
    const data = encoder
      .initialize()
      .codepage('cp850') // Latin-1: supports international characters (é, ñ, ü, etc.)
      .text(`#${jobId}`) // Print ID on top left
      .newline()
      .line(name)
      .newline()
      .text(message)
      .image(processedImage, processedImage.info.width, processedImage.info.height, 'bayer')
      .rule()
      .cut()
      .encode();

    // Transfer to printer
    await new Promise((resolve, reject) => 
      out.transfer(data, err => err ? reject(err) : resolve())
    );
    console.log(`Printed: ${name}`);

  } finally {
    // Release and close
    await new Promise(resolve => 
      iface.release(true, () => { 
        device.close(); 
        resolve(); 
      })
    );
  }
}
