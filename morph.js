//
// morph.js
//
// This loads an image into a canvas and lets you drag pixels around using 
// the mouse (click-drag). 
// This also demonstrates:
//    loading an initial image
//    loading an image from a file input
//    a simple undo/redo design pattern
//
// todo: implement alternate drag algorithms
//
// Craig Fitzgerald 2022
 
class MorphTester {
   constructor() {
      this.$fileInput = $("#fileInput");
      this.$canvas    = $("#canvas");
      this.canvas     = this.$canvas.get(0);
      this.fileReader = new FileReader();
      this.img        = new Image();
      this.ctx        = this.canvas.getContext("2d");
      this.isInside   = false;
      this.isDragging = false;
      this.debugMode  = false;
      this.history = {head:0, tail:0, curr:0, idx:0};
      this.ratio_CZ_C = 4;
      this.ratio_C_D  = 3;

      this.$canvas
         .mousemove((e) => this.MouseMove(e))
         .mousedown((e) => this.MouseDown(e))
         .mouseup  ((e) => this.MouseUp(e));
      this.$fileInput         .on("change", (e) => this.FileChange(e));
      $(this.fileReader      ).on("load",   (e) => this.FileLoaded(e));
      $(this.img             ).on("load",   (e) => this.ImageLoaded(e));
      $("input[type='range']").on("change", (e) => this.SliderChange(e));
      $(".debugmode"         ).on("change", (e) => this.SetDebugMode(e));
      $(window               ).on("keydown",(e) => this.KeyDown(e));

      this.LoadImage();
   }

   //------------------handlers----------------------------

   MouseMove(event) {
      this.current = this.MousePoint(event);
      $("#loc").text(`${this.current.x},${this.current.y}`);

      if (this.isDragging) {
         this.CalcMetrics();
         this.Draw();
         if (this.debugMode) this.DrawMetrics();
         return;
      }
      if (this.debugMode) {
         this.CalcDragPixel(this.current);         
         this.Draw();
         this.DrawMetrics();
         this.DrawTest();
         this.LogTest();
      }
   }

   MouseDown(event) {
      this.isDragging = true;
      this.pointC = this.pointZ = this.MousePoint(event);
      this.CalcMetrics();
      this.Draw();
   }

   MouseUp(event) {
      this.isDragging = false;
      this.UpdateRefData();
      if (this.debugMode) this.Draw();
   }

   KeyDown(event) {
      var e = event.originalEvent;
      if (e.isComposing || e.keyCode === 229) return;

      //console.log(`code:${e.code}, key:${e.key}, which:${e.which}, shiftKey:${e.shiftKey}, ctrlKey:${e.ctrlKey}, altKey:${e.altKey}`);
      if (e.code == 'KeyZ' && e.ctrlKey && !e.shiftKey || e.code == 'Backspace' && e.altKey)
         this.RollBack();
      if (e.code == 'KeyZ' && e.ctrlKey && e.shiftKey || e.code == 'KeyY' && e.ctrlKey)
         this.RollForward();
   }

   FileChange() {
      this.LoadImageFile();
   }

   FileLoaded() {
      this.img.src = this.fileReader.result;
   }

   ImageLoaded() {
      this.ctx.width  = this.canvas.width  = this.img.width;
      this.ctx.height = this.canvas.height = this.img.height;
      this.ctx.drawImage(this.img, 0, 0);
      this.refData = this.ctx.getImageData(0, 0, this.img.width, this.img.height);
   }

   SliderChange(event) {
      let rC = $("#radiusC").val();
      $("#radiusC").closest("div").find("span").text(`[${rC}]`);

      let rD = $("#radiusD").val();
      $("#radiusD").closest("div").find("span").text(`[${rD}]`);

      this.ratio_CZ_C = 100 / rC;
      this.ratio_C_D  = 100 / rD;
   }

   SetDebugMode(event) {
      this.debugMode = $(event.currentTarget).is(":checked");
      console.log("debug mode is: ", this.debugMode)
      this.DrawImage();
   }

   //------------------calc----------------------------

   CalcMetrics() {
      let pZ = this.pointZ = this.current;
      let pC = this.pointC;
      this.lenCZ = this.Distance(pC, pZ);
      let radC = this.radC = this.lenCZ == 0 ? 1 : this.lenCZ/this.ratio_CZ_C;
      this.theta1 = Math.atan2(pC.y - pZ.y, pZ.x - pC.x);
      let theta2  = this.theta2 = Math.PI/2 - this.theta1;
      this.pointA = this.Point(pC.x - radC * Math.cos(theta2), pC.y - radC * Math.sin(theta2));
      this.pointB = this.Point(pC.x + radC * Math.cos(theta2), pC.y + radC * Math.sin(theta2));
      this.theta3   = this.Angle(pZ, pC, this.pointA);

      let radD = this.radD = radC/this.ratio_C_D;
      this.pointD = this.Move(this.pointZ, -this.theta1+Math.PI, this.lenCZ/this.ratio_C_D);
      this.pointE = this.Point(this.pointD.x - radD * Math.cos(theta2), this.pointD.y - radD * Math.sin(theta2));
      this.pointF = this.Point(this.pointD.x + radD * Math.cos(theta2), this.pointD.y + radD * Math.sin(theta2));
      this.lenDZ  = this.Distance(this.pointD, pZ);

      this.LogMetrics();
   }

   CalcDragPixel(pP) {
      this.isInside = this.IsInside(pP);
      if (!this.isInside)
         return $("#log2").text("Not Inside");

      let pZ = this.pointZ;
      let pA = this.pointA;
      let pB = this.pointB;
      this.pointQ = this.Intersection(pP, -this.theta1, this.pointC, this.theta2);

      let pTmp = this.Distance(pP, pA) < this.Distance(pP, pB) ? pA : pB;
      let thetaZ = Math.atan2(pTmp.y - pZ.y, pTmp.x - pZ.x);
      let lCQ = this.Distance(this.pointC, this.pointQ);
      
      if (lCQ < this.radD) {
         this.pointT = this.Intersection(pP, -this.theta1, this.pointD, this.theta2);
         let lDT = this.Distance(this.pointD, this.pointT);
         let lTU = lDT >= this.radD ? 0 : Math.sqrt(this.radD*this.radD - lDT*lDT);
         this.pointU = this.Move(this.pointT, -this.theta1, lTU);
      } else {
         this.pointU = this.Intersection(pP, -this.theta1, this.pointZ, thetaZ);
      }
      let lQR = lCQ >= this.radC ? 0 : Math.sqrt(this.radC*this.radC - lCQ*lCQ);
      this.pointR = this.Move(this.pointQ, -this.theta1 + Math.PI, lQR);
      let lRU = this.Distance(this.pointR, this.pointU);
      let lPR = this.Distance(this.pointR, pP);
      let lQR2 = this.Distance(this.pointR, this.pointQ);
      this.pointS = this.Move(this.pointQ, -this.theta1 + Math.PI, lQR - lPR * lQR2 / lRU);

      return this.pointS;
   }

   IsInside(pP, checkBoundingBox = false) {
      if (!this.pointC) return false;
      let pZ = this.pointZ;
      let pC = this.pointC;
      let pD = this.pointD;
      let radC = this.radC;
      let radD = this.radD;
      let t = this.Angle(pZ, pC, pP);
      if (Math.abs(t) > Math.abs(this.theta3)) return false;
      if (checkBoundingBox && pP.x < Math.min(pC.x - radC, pZ.x)) return false;
      if (checkBoundingBox && pP.x > Math.max(pC.x + radC, pZ.x)) return false;
      if (checkBoundingBox && pP.y < Math.min(pC.y - radC, pZ.y)) return false;
      if (checkBoundingBox && pP.y > Math.max(pC.y + radC, pZ.y)) return false;

      let lPZ = this.Distance(pP, pZ);
      if (lPZ > this.lenCZ)
         return (this.Distance(pP, pC) <= this.radC);
      if (lPZ < this.lenDZ)
         return (this.Distance(pP, pD) <= this.radD);
      return true;
   }

   BoundingBox() {
      let pZ  = this.pointZ;
      let pC  = this.pointC;
      let radC = this.radC;
      let l = Math.round(Math.min(pC.x - radC, pZ.x));
      let r = Math.round(Math.max(pC.x + radC, pZ.x));
      let t = Math.round(Math.min(pC.y - radC, pZ.y));
      let b = Math.round(Math.max(pC.y + radC, pZ.y));
      let w = r - l + 1;
      let h = b - t + 1;
      return {l, r, t, b, w, h};
   }

   //------------------draw----------------------------

   Draw() {
      this.DrawImage();
      if (this.isDragging) 
         this.DragPixels();
   }

   DragPixels() {
      let iw = this.img.width;
      let ih = this.img.height;
      let bb = this.BoundingBox();
      if (bb.w<1 || bb.h<1) return;
      let targetData = this.ctx.getImageData(0, 0, this.img.width, this.img.height);

      for (let y=bb.t; y<=bb.b; y++) {
         for (let x=bb.l; x<=bb.r; x++) {
            let tp = {x,y};
            if (this.IsInside(tp)) {
               let sp = this.CalcDragPixel(tp);
               let targetOffset = Math.round(y   *this.img.width*4 + x   *4);
               let sourceOffset = Math.round(sp.y*this.img.width*4 + sp.x*4);
               for (let i=0; i<4; i++) {
                  targetData.data[targetOffset+i] = this.refData.data[sourceOffset+i];
               }
            }
         }
      }
      this.ctx.putImageData(targetData, 0, 0);
   }

   DrawImage() {
      this.ctx.putImageData(this.refData, 0, 0);
   }                     

   UpdateRefData() {
      let bb = this.BoundingBox();

      let clip = this.ctx.getImageData(bb.l, bb.t, bb.w, bb.h);

      let oldData = new Uint8ClampedArray(bb.w * bb.h * 4);

      for (let y=0; y<bb.h; y++) {
         for (let x=0; x<bb.w; x++) {
            for (let i=0; i<4; i++) {
               let sourceOffset = Math.round(y*bb.w*4 + x*4 + i);
               let targetOffset = Math.round((y+bb.t)*this.img.width*4 + (x+bb.l)*4 + i);
               oldData[sourceOffset] = this.refData.data[targetOffset] 
               this.refData.data[targetOffset] = clip.data[sourceOffset];
            }
         }
      }
      this.ctx.putImageData(this.refData, 0, 0);
      this.PushHistory(oldData,clip.data,bb);
   }

   DrawClip(node, isNew) {
      let bb = node.bb;
      let data = isNew ? node.newData : node.oldData;
      for (let y=0; y<bb.h; y++) {
         for (let x=0; x<bb.w; x++) {
            for (let i=0; i<4; i++) {
               let sourceOffset = Math.round(y*bb.w*4 + x*4 + i);
               let targetOffset = Math.round((y+bb.t)*this.img.width*4 + (x+bb.l)*4 + i);
               this.refData.data[targetOffset] = data[sourceOffset];
            }
         }
      }
      this.ctx.putImageData(this.refData, 0, 0);
   }

   DrawMetrics() {
      if (!this.pointC) return;

      this.DrawPoint(this.pointZ, "blue");
      this.DrawPoint(this.pointC, "blue");
      this.DrawPoint(this.pointA, "lightblue");
      this.DrawPoint(this.pointB, "lightblue");
      this.DrawLine(this.pointC, this.pointZ, 1, "blue");
      this.DrawLine(this.pointC, this.pointA, 1, "lightblue");
      this.DrawLine(this.pointC, this.pointB, 1, "lightblue");
      this.DrawLine(this.pointZ, this.pointA, 1, "lightblue");
      this.DrawLine(this.pointZ, this.pointB, 1, "lightblue");
      this.DrawCircle(this.pointC, 1, this.radC, "lightblue");

      this.DrawPoint(this.pointD, "blue");
      this.DrawPoint(this.pointE, "lightblue");
      this.DrawPoint(this.pointF, "lightblue");
      this.DrawCircle(this.pointD, 1, this.radD, "lightblue");
   }

   DrawTest() {
      if (!this.isInside) return;
      this.DrawLine(this.pointU, this.pointQ, 1, "red");
      this.DrawLine(this.pointR, this.pointQ, 1, "lightred");
      this.DrawPoint(this.pointQ, "red");
      this.DrawPoint(this.pointU, "red");
      this.DrawPoint(this.pointR, "red");
      this.DrawPoint(this.pointT, "red");
      this.DrawPoint(this.pointS, "lightgreen");
   }

   DrawPoint(point, color) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);
      this.ctx.fillStyle = color;
      this.ctx.fill();
   }

   DrawCircle(point, lineWidth, radius, color) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
      this.ctx.lineWidth = lineWidth;
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
   }

   DrawLine = function(p1, p2, lineWidth, color) {
      this.ctx.beginPath();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth;
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
   }

   //------------------ undo/redo ----------------------------

   PushHistory(oldData,newData,bb) {
      let node = {oldData, newData, bb, next:0, prev:this.history.curr, idx:`[${this.history.idx++}]`};
      if (!this.history.curr) {
         this.history.head = this.history.tail = this.history.curr = node;
         this.LogHistory();
         return;
      }
      if (this.history.curr.next) {
         let p1 = 0;
         console.log("history clearout");
         for (let p0 = this.history.curr.next; p0; p0 = p1) {
            p1 = p0.next;
            p0.prev = p0.next = 0;
            this.history.head = this.history.curr;
         }
      }
      this.history.curr.next = node;
      this.history.head = this.history.curr = node;

      this.LogHistory();
   }

   RollBack() {
      if (this.history.curr) {
         this.DrawClip(this.history.curr, 0);
         this.history.curr = this.history.curr.prev;
      }
      this.LogHistory();
   }

   RollForward() {
      if (this.history.curr.next) {
         this.DrawClip(this.history.curr.next, 1);
         this.history.curr = this.history.curr.next;
      }
      if (!this.history.curr && this.history.head) {
         this.history.curr = this.history.tail;
         this.DrawClip(this.history.curr, 1);
      }
      this.LogHistory();
   }

   LogHistory() {
      if (!this.debugMode) return;

      let str = "";
      for (let p = this.history.tail; p; p = p.next) {
         if (str != "") str += " --> ";
         str += p.idx;
         if (p === this.history.curr) str += "(c)";
      }
   }

   //------------------util----------------------------

   LoadImage() {
      this.img.crossOrigin = 'anonymous';
      this.img.src = "ovalface.jpg";
   }

   LoadImageFile() {
      var file = this.$fileInput.get(0).files[0];
      if (!file) return;
      this.fileReader.readAsDataURL(file);
   }

   MousePoint(event) {
      var e = event.originalEvent;
      return {x: e.x-this.canvas.offsetLeft, y: e.y-this.canvas.offsetTop};
   }

   Distance(point1, point2) {
      let dx = point1.x - point2.x;
      let dy = point1.y - point2.y;
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

   PointStr(p) {
      let x = Math.round(p.x * 100) / 100.0;
      let y = Math.round(p.y * 100) / 100.0;
      return `${x},${y}`;
   }

   NumStr(l) {
      let ls = Math.round(l * 1000) / 1000.0;
      return `${ls}`;
   }

   Point(x,y) {
      return {x, y};
   }

   Message(message) {
      $("#message").text(message);
   }

   //------------------log----------------------------

   LogMetrics() {
      let msg = 
         `lenCZ:  ${this.NumStr (this.lenCZ)  }\n` +
         `pointA: ${this.PointStr(this.pointA)}\n` +
         `pointB: ${this.PointStr(this.pointB)}\n` +
         `pointC: ${this.PointStr(this.pointC)}\n` +
         `pointD: ${this.PointStr(this.pointD)}\n` +
         `pointE: ${this.PointStr(this.pointE)}\n` +
         `pointF: ${this.PointStr(this.pointF)}\n` +
         `pointZ: ${this.PointStr(this.pointZ)}\n` +
         `radC:   ${this.NumStr (this.radC)   }\n` +
         `radD:   ${this.NumStr (this.radC)   }\n` +
         `theta1: ${this.NumStr (this.theta1) }\n` +
         `theta2: ${this.NumStr (this.theta2) }\n` +
         `theta3:${this.NumStr (this.theta3)  }\n` ;
      $("#log").text(msg);
   }

   LogTest() {
      if (!this.pointU) return;
      let msg = 
         `pointU: ${this.PointStr(this.pointU)}\n` +
         `pointQ: ${this.PointStr(this.pointQ)}\n` +
         `pointR: ${this.PointStr(this.pointR)}\n` +
         `pointS: ${this.PointStr(this.pointS)}\n` +
         `theta3:  ${this.NumStr (this.theta3)}\n` ;
      $("#log2").text(msg);
   }
}

$(function() {
   let p = new MorphTester({});
});

