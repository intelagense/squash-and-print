// list-usb.js to list all USB devices because we need to know the VID and PID of the printer to print.
// This is annoying btw but my printer didnt have MacOS drivers handy.
// You can pipe it to a couple of files and read a diff to see what changed after unplugging and plugging it back in.
import usb from 'usb';

function hex(n) {
  return '0x' + n.toString(16).padStart(4, '0');
}

for (const dev of usb.getDeviceList()) {
  const { idVendor, idProduct } = dev.deviceDescriptor;
  console.log({ vid: hex(idVendor), pid: hex(idProduct) });
}
