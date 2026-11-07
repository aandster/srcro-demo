// QR code of the public page for the visitor page, so a phone camera pointed at the stand's screen
// opens the demo (Jordan, 2026-11-01). Drawn from vendor/qrcode.js (Kazuhiko Arase, MIT) so it
// works offline, and the address is fixed to the public site, not the address this copy is served from.
(function () {
  "use strict";
  var PAGE = "https://srcro.aandster.me/";
  var box = document.getElementById("qr");
  if (!box) return;
  if (window.qrcode) {
    var qr = window.qrcode(0, "M");
    qr.addData(PAGE);
    qr.make();
    // White ground and a wide quiet zone, so a phone camera reads it on the dark page.
    box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
  } else {
    box.textContent = PAGE;
  }
})();
