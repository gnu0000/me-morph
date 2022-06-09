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

      this.$canvas
         .mousemove((e) => this.MouseMove(e))
         .mousedown((e) => this.MouseDown(e))
         .mouseup  ((e) => this.MouseUp(e));
      this.$fileInput    .on("change", (e) => this.FileChange(e));
      $(this.fileReader ).on("load",   (e) => this.FileLoaded(e));
      $(this.img        ).on("load",   (e) => this.ImageLoaded(e));
      $(".debugmode"    ).on("change", (e) => this.SetDebugMode(e));
      $(window          ).on("keydown",(e) => this.KeyDown(e));

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
      this.ptC = this.ptA = this.MousePoint(event);
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

   SetDebugMode(event){
      this.debugMode = $(event.currentTarget).is(":checked");
      console.log("debug mode is: ", this.debugMode)
      this.DrawImage();
   }

   //------------------calc----------------------------

   CalcMetrics() {
      let a = this.ptA = this.current;
      let c = this.ptC;
      this.l1 = this.Distance(c, a);
      this.l2 = this.l1 == 0 ? 1 : this.l1/4;
      let l2 = this.l2;
      this.t1 = Math.atan2(c.y - a.y, a.x - c.x);
      this.t2 = Math.PI/2 - this.t1;
      let t2 = this.t2;
      this.ptB = this.Pt(c.x - l2 * Math.sin(t2), c.y + l2 * Math.cos(t2));
      this.ptD = this.Pt(c.x - l2 * Math.cos(t2), c.y - l2 * Math.sin(t2));
      this.ptE = this.Pt(c.x + l2 * Math.cos(t2), c.y + l2 * Math.sin(t2));
      this.tMax = this.Angle(a, c, this.ptD);
      this.LogMetrics();
   }

   CalcDragPixel(z) {
      this.isInside = this.IsInside(z);
      if (!this.isInside)
         return $("#log2").text("Not Inside");

      let a = this.ptA;
      let d = this.ptD;
      let e = this.ptE;
      this.ptR = this.Intersection(z, -this.t1, this.ptC, this.t2);

      let ptZ = this.Distance(z, d) < this.Distance(z, e) ? d : e;
      this.t3  = Math.atan2(ptZ.y - a.y, ptZ.x - a.x);
      
      this.ptQ = this.Intersection(z, -this.t1, this.ptA, this.t3);

      let dr = this.Distance(this.ptC, this.ptR);
      let l3 = Math.sqrt(this.l2*this.l2 - dr*dr);
      this.ptS = this.Move(this.ptR, -this.t1 + Math.PI, l3);
      let sq = this.Distance(this.ptS, this.ptQ);
      let sz = this.Distance(this.ptS, z);
      let sr = this.Distance(this.ptS, this.ptR);
      this.ptT = this.Move(this.ptR, -this.t1 + Math.PI, sr - sz*sr/sq);

      //this.LogTest();
      return this.ptT;
   }

   IsInside(z, checkBoundingBox = false) {
      if (!this.ptC) return false;
      let a = this.ptA;
      let c = this.ptC;
      let l2 = this.l2;
      let t = this.Angle(a, c, z);
      if (Math.abs(t) > Math.abs(this.tMax)) return false;
      if (checkBoundingBox && z.x < Math.min(c.x - l2, a.x)) return false;
      if (checkBoundingBox && z.x > Math.max(c.x + l2, a.x)) return false;
      if (checkBoundingBox && z.y < Math.min(c.y - l2, a.y)) return false;
      if (checkBoundingBox && z.y > Math.max(c.y + l2, a.y)) return false;
      let lza = this.Distance(z, a);
      if (lza <= this.l1) return true;
      let lzc = this.Distance(z, c);
      return (lzc <= this.l2);
   }

   BoundingBox() {
      let a  = this.ptA;
      let c  = this.ptC;
      let l2 = this.l2;
      let l = Math.round(Math.min(c.x - l2, a.x));
      let r = Math.round(Math.max(c.x + l2, a.x));
      let t = Math.round(Math.min(c.y - l2, a.y));
      let b = Math.round(Math.max(c.y + l2, a.y));
      let w = r - l; //+1?
      let h = b - t; //+1?
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

      console.log("clip", clip);

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
      if (this.ptC) {
         this.DrawPoint(this.ptA, "blue");
         this.DrawPoint(this.ptC, "blue");
         this.DrawPoint(this.ptB, "lightblue");
         this.DrawPoint(this.ptD, "lightblue");
         this.DrawPoint(this.ptE, "lightblue");
         this.DrawLine(this.ptC, this.ptA, 1, "blue");
         this.DrawLine(this.ptC, this.ptB, 1, "lightblue");
         this.DrawLine(this.ptC, this.ptD, 1, "lightblue");
         this.DrawLine(this.ptC, this.ptE, 1, "lightblue");
         this.DrawLine(this.ptA, this.ptD, 1, "lightblue");
         this.DrawLine(this.ptA, this.ptE, 1, "lightblue");
         this.DrawCircle(this.ptC, 1, this.l2, "lightblue");
      }
   }

   DrawTest() {
      if (!this.isInside) return;
      //this.DrawLine(this.current, this.Move(this.current, -this.t1, 50), 1, "red");
      this.DrawLine(this.ptQ, this.ptR, 1, "red");
      this.DrawLine(this.ptS, this.ptR, 1, "lightred");
      this.DrawPoint(this.ptR, "red");
      this.DrawPoint(this.ptQ, "red");
      this.DrawPoint(this.ptS, "red");
      this.DrawPoint(this.ptT, "lightgreen");
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
      if (!this.history.head) {
         this.history.head = this.history.tail = this.history.curr = node;
         console.log("history start");
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
      console.log(`history h:${this.history.head.idx}, c:${this.history.curr.idx}`);
      
      let str = "";
      for (let p = this.history.tail; p; p = p.next) {
         if (str != "") str += " --> ";
         str += p.idx;
         if (p === this.history.curr) str += "(c)";
      }
      console.log("history", str);
   }

   //------------------util----------------------------

   LoadImage() {
      this.img.crossOrigin = 'anonymous';
      this.img.src = "volt.jpg";
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
      var dx = point1.x - point2.x;
      var dy = point1.y - point2.y;
      return Math.sqrt(dx*dx + dy*dy);
   }

   // current, start, point
   Angle(p1, p2, p3) {
      var d12 = this.Distance(p1,p2);
      var d13 = this.Distance(p1,p3);
      var d23 = this.Distance(p2,p3);
      return Math.acos((d12*d12 + d13*d13 - d23*d23)/(2* d12 * d13));
   }

   Move(point, t, len) {
      return {x: Math.round(point.x + len * Math.cos(t)), y: Math.round(point.y + len * Math.sin(t))};
   }

   Intersection(p1, t1, p2, t2) {
      let pi = Math.PI;
      let hpi = pi/2;

      if (((t1 % pi) + pi) % pi == hpi) { // vertical line at x = x0
         return [p1.x, Math.tan(t2) * (p1.x-p2.x) + p2.y];
      }
      else if (((t2 % pi) + pi) % pi == hpi) { // vertical line at x = p1.x
         return [p2.x, Math.tan(t1) * (p2.x-p1.x) + p1.y];
      }
      let m0 = Math.tan(t1); // Line 0: y = m0 (x - p1.x) + p1.y
      let m1 = Math.tan(t2); // Line 1: y = m1 (x - p2.x) + p2.y
      let x = ((m0 * p1.x - m1 * p2.x) - (p1.y - p2.y)) / (m0 - m1);
      return {x, y: m0 * (x - p1.x) + p1.y};
   }

   PtStr(p) {
      let x = Math.round(p.x * 100) / 100.0;
      let y = Math.round(p.y * 100) / 100.0;
      return `${x},${y}`;
   }

   NStr(l) {
      let ls = Math.round(l * 1000) / 1000.0;
      return `${ls}`;
   }

   Pt(x,y) {
      return {x, y};
   }

   Message(message) {
      $("#message").text(message);
   }

   //------------------log----------------------------

   LogMetrics() {
      let msg = 
         `ptC: ${this.PtStr(this.ptC) }\n` +
         `ptA: ${this.PtStr(this.ptA) }\n` +
         `l1:  ${this.NStr (this.l1)  }\n` +
         `l2:  ${this.NStr (this.l2)  }\n` +
         `t1:  ${this.NStr (this.t1)  }\n` +
         `t2:  ${this.NStr (this.t2)  }\n` +
         `ptB: ${this.PtStr(this.ptB) }\n` +
         `ptD: ${this.PtStr(this.ptD) }\n` +
         `ptE: ${this.PtStr(this.ptE) }\n` +
         `tMax:${this.NStr (this.tMax)}\n` ;

      $("#log").text(msg);
   }

   LogTest() {
      if (!this.ptQ) return;
      let msg = 
         `ptQ: ${this.PtStr(this.ptQ) }\n` +
         `ptR: ${this.PtStr(this.ptR) }\n` +
         `ptS: ${this.PtStr(this.ptS) }\n` +
         `ptT: ${this.PtStr(this.ptT) }\n` +
         `t3:  ${this.NStr (this.t3)  }\n` ;
      $("#log2").text(msg);
   }
}

$(function() {
   let p = new MorphTester({});
});

