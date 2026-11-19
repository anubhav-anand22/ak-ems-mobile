/**
 * HTML document loaded in the hidden off-screen WebView.
 * Runs PDF.js to extract text items sequentially without rendering any canvas or images.
 */
export const PDF_WORKER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- Standalone PDF.js library from cdnjs -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  </script>
</head>
<body>
  <script>
    function sendToRN(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (err) {
        // Fallback
      }
    }

    function base64ToUint8Array(base64) {
      var raw = atob(base64);
      var uint8Array = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) {
        uint8Array[i] = raw.charCodeAt(i);
      }
      return uint8Array;
    }

    async function parsePdf(requestId, base64Data) {
      try {
        if (!window.pdfjsLib) {
          throw new Error('PDF.js library is not available in WebView');
        }

        var data = base64ToUint8Array(base64Data);
        var loadingTask = window.pdfjsLib.getDocument({
          data: data,
          isEvalSupported: false,
          useSystemFonts: true,
          disableRange: true,
          disableStream: true
        });

        var pdfDoc = await loadingTask.promise;
        var numPages = pdfDoc.numPages;
        var pages = [];

        // Sequential page processing (1 to numPages) to strictly preserve document order
        for (var pageNum = 1; pageNum <= numPages; pageNum++) {
          var page = await pdfDoc.getPage(pageNum);
          // page.getTextContent() extracts positioned text and ignores all canvas/images (zero image overhead)
          var textContent = await page.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false
          });

          var items = [];
          for (var j = 0; j < textContent.items.length; j++) {
            var item = textContent.items[j];
            if (item && typeof item.str === 'string' && item.str.trim().length > 0) {
              var transform = item.transform || [1, 0, 0, 1, 0, 0];
              items.push({
                str: item.str,
                x: transform[4],
                y: transform[5],
                width: item.width || 0,
                height: Math.abs(transform[3]) || item.height || 10,
                fontName: item.fontName || '',
                hasEOL: !!item.hasEOL
              });
            }
          }

          pages.push({
            pageNumber: pageNum,
            items: items
          });
        }

        var metadata = { numPages: numPages };
        try {
          var metaDataObj = await pdfDoc.getMetadata();
          if (metaDataObj && metaDataObj.info) {
            metadata.info = metaDataObj.info;
          }
        } catch (mErr) {
          // ignore metadata failure
        }

        sendToRN({
          type: 'PARSE_SUCCESS',
          requestId: requestId,
          metadata: metadata,
          pages: pages
        });
      } catch (err) {
        sendToRN({
          type: 'PARSE_ERROR',
          requestId: requestId,
          error: err && err.message ? err.message : String(err)
        });
      }
    }

    // Expose directly on window for injected invocation if needed
    window.parsePdfFromRN = parsePdf;

    function handleIncomingMessage(event) {
      try {
        var rawData = event.data;
        if (typeof rawData === 'string') {
          var msg = JSON.parse(rawData);
          if (msg && msg.type === 'PARSE_PDF') {
            parsePdf(msg.requestId, msg.base64);
          }
        }
      } catch (e) {
        sendToRN({
          type: 'PARSE_ERROR',
          error: 'Failed to process message from React Native'
        });
      }
    }

    window.addEventListener('message', handleIncomingMessage);
    document.addEventListener('message', handleIncomingMessage);

    // Notify React Native that WebView is ready
    sendToRN({ type: 'READY' });
  </script>
</body>
</html>
`;
