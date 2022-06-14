"use strict";

// This file implements the MorphWorker class
// This is a web worker which calculates 1 horizontal 
// row of a pixel drag image clip
// The resulting array is row worth of source image offsets
//
// The message data passed in:
//    {
//    workerId : id of this worker (for bookkeeping)
//    imgWidth : width of source image
//    imgHeight: height of source image
//    rowIdx   : 0 based index of the row to calc (relative to the bounding box
//    bb       : The bounding box of the clip we are calculating
//    pointA   : Metrics
//    pointB   : Metrics
//    pointC   : Metrics
//    pointD   : Metrics
//    pointQ   : Metrics
//    pointZ   : Metrics
//    theta1   : Metrics
//    theta2   : Metrics
//    theta3   : Metrics
//    radC     : Metrics
//    radD     : Metrics
//    lenCZ    : Metrics
//    lenDZ    : Metrics
//    }
//
// The message data passed out:
//    {
//    rowData : the array of calculated indexes (0 = no index)
//    workerId: passed in
//    rowIdx  : passed in
//    bb      : passed in
//    }

class MorphWorker {
   constructor() {
      this.rowDataSize = 0;
      onmessage = this.HandleMessage;
   }

   HandleMessage = (e) => {
      let data = this.data = e.data;
      this.CheckArray();

      let y = data.bb.t + data.rowIdx;
      for (let i=0; i < data.bb.w; i++) {
         let x = data.bb.l + i;
         let dp = this.CalcDragPixel({x,y});
         this.rowData[i] = Math.round(dp.y * data.imgWidth * 4 + dp.x * 4);
      }

      postMessage({
         rowData  : this.rowData       ,   
         workerId : this.data.workerId ,
         rowIdx   : this.data.rowIdx   ,
         bb       : this.data.bb    
      });
   }

   CalcDragPixel(pP) {
      if (!this.IsInside(pP)) return {x:0,y:0};

      let data = this.data;
      let {pointZ: pZ, pointA: pA, pointB: pB, pointC: pC, pointD: pD} = data;

      let pQ = data.pointQ = this.Intersection(pP, -data.theta1, pC, data.theta2);
      let pTmp = this.Distance(pP, pA) < this.Distance(pP, pB) ? pA : pB;
      let thetaZ = Math.atan2(pTmp.y - pZ.y, pTmp.x - pZ.x);
      let lCQ = this.Distance(pC, pQ);
      
      if (lCQ < data.radD) {
         let pT = data.pointT = this.Intersection(pP, -data.theta1, pD, data.theta2);
         let lDT = this.Distance(pD, pT);
         let lTU = lDT >= data.radD ? 0 : Math.sqrt(data.radD*data.radD - lDT*lDT);
         data.pointU = this.Move(pT, -data.theta1, lTU);
      } else {
         data.pointU = this.Intersection(pP, -data.theta1, data.pointZ, thetaZ);
      }
      let lQR = lCQ >= data.radC ? 0 : Math.sqrt(data.radC*data.radC - lCQ*lCQ);
      let pR  = data.pointR = this.Move(pQ, -data.theta1 + Math.PI, lQR);
      let lRU = this.Distance(pR, data.pointU);
      let lPR = this.Distance(pR, pP);
      let lQR2 = this.Distance(pR, pQ);
      data.pointS = this.Move(pQ, -data.theta1 + Math.PI, lQR - lPR * lQR2 / lRU);

      return data.pointS;
   }

   IsInside(pP) {
      if (!this.data.pointC) return false;

      let data = this.data;
      let {pointZ: pZ, pointC: pC, pointD: pD, radC, radD} = data;
      let t = this.Angle(pZ, pC, pP);
      if (Math.abs(t) > Math.abs(data.theta3)) return false;

      let lPZ = this.Distance(pP, pZ);
      if (lPZ > data.lenCZ)
         return (this.Distance(pP, pC) <= data.radC);
      if (lPZ < data.lenDZ)
         return (this.Distance(pP, pD) <= data.radD);
      return true;
   }

   Distance(p1, p2) {
      let dx = p1.x - p2.x;
      let dy = p1.y - p2.y;
      return Math.sqrt(dx*dx + dy*dy);
   }

   // current, start, point
   Angle(p1, p2, p3) {
      let d12 = this.Distance(p1,p2);
      let d13 = this.Distance(p1,p3);
      let d23 = this.Distance(p2,p3);
      return Math.acos((d12*d12 + d13*d13 - d23*d23)/(2* d12 * d13));
   }

   Move(point, t, len) {
      return {x: Math.round(point.x + len * Math.cos(t)), y: Math.round(point.y + len * Math.sin(t))};
   }

   Intersection(p1, theta1, p2, theta2) {
      let pi = Math.PI;
      let hpi = pi/2;

      if (((theta1 % pi) + pi) % pi == hpi) { // vertical line at x = x0
         return {x: p1.x, y: Math.tan(theta2) * (p1.x-p2.x) + p2.y};
      }
      else if (((theta2 % pi) + pi) % pi == hpi) { // vertical line at x = p1.x
         return {x: p2.x, y: Math.tan(theta1) * (p2.x-p1.x) + p1.y};
      }
      let m0 = Math.tan(theta1); // Line 0: y = m0 (x - p1.x) + p1.y
      let m1 = Math.tan(theta2); // Line 1: y = m1 (x - p2.x) + p2.y
      let x = ((m0 * p1.x - m1 * p2.x) - (p1.y - p2.y)) / (m0 - m1);
      return {x, y: m0 * (x - p1.x) + p1.y};
   }

   CheckArray() {
      let needed = this.data.bb.w * 4;
      if (needed > this.rowDataSize) {
         this.rowData = new Uint32Array(needed);
         this.rowDataSize = needed;
      }
   }
}

new MorphWorker();