"use strict";

class TestMorphWorker {
   constructor() {
      this.rowDataSize = 0;
      onmessage = this.HandleMessage;
   }

   HandleMessage = (e) => {
      postMessage({
         workerId: 86
      });
   }
}

new TestMorphWorker();