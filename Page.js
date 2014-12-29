var PDFObject = require('./PDFObject')
var ENDL = process.env.ENDL || "\n"
var fontwidths = require('./fontWidths.js')

var Page = function(buffer,base){
	var self = base || new PDFObject(buffer)
	self.translateStack = [];
	self.textStream = ''
	self.font = ''
	self.fontSize = 0
	self.translatePos = {x:0, y:0};
	
	self.resetTranslate = function(){
		while(self.translateStack.length)
			self.endTranslate()
	}

	self.translate = function(x,y){
		x = x.toFixed(0)
		y = y.toFixed(0)
		self.translatePos.x += parseInt(x);
		self.translatePos.y += parseInt(y);
		self.writeln(x,y,'Td')
	}

	self.translateTo = function(x,y){
		var dx = x - self.translatePos.x
		var dy = y - self.translatePos.y
		self.translate(dx,dy)
	}

	self.save = function(){
		self.translateStack.push(self.translatePos)
		self.translatePos = { x: self.translatePos.x, y: self.translatePos.y}
		self.writeln('q')
	}

	self.restore = function(){
		self.writeln('Q')
		var pos = self.translateStack.pop()
		self.translateTo(pos.x,pos.y)
	}

	self.beginTranslate = function(x,y){
		self.save()
		self.translate(x,y)
		console.log('TRANSLATE','PUSH',x,y,self.translateStack)
	}
	
	self.endTranslate = function(){
		console.log('TRANSLATE','POP',self.translateStack)
		self.restore()
		self.translateTo(self.translatePos.x,self.translatePos.y)
	}

	self.write = function(){
		var text = Array.prototype.join.apply(arguments,[' '])
		self.textStream += text;
	}
	self.writeln = function(){
		var text = Array.prototype.join.apply(arguments,[' '])
		self.write(text + ENDL)
	}

	self.printLines = function(text,x,y){
		var spacing = self.fontSize + 2
		text = text.toString()
		text = text.replace("\r\n","\n")
		text = text.replace("\r","\n")
		var lines = text.split("\n")
		y -= lines.length * spacing
		for(var i=lines.length;i>=0;i--)	
		{
			self.print(lines[i],x,y);
			y += spacing
		}
	}

	self.print = function(text,x,y){
		//console.log('PRINT',text,x,y)
		if(x || y)
			self.beginTranslate(x,y)
			//self.translateTo(x,y)
		self.writeln('('+text+')','Tj');
		if(x || y)
			self.endTranslate()
	}

	self.setFont = function(id,size){
		self.font = id
		self.fontSize = size
		self.writeln('/'+id,size,'Tf')
	}

	self.setStrokeColor = function(r,g,b){
		self.writeln(r.toFixed(1),g.toFixed(1),b.toFixed(1),'RG')
	}

	self.setFillColor = function(r,g,b){
		self.writeln(r.toFixed(1),g.toFixed(1),b.toFixed(1),'rg')
	}

	self.drawRect = function(x,y,w,h){
		//x += self.translatePos.x
		//y += self.translatePos.y
		self.writeln(x,y,w,h,'re h S')
	}

	self.drawFilledRect = function(x,y,w,h){
		//x += self.translatePos.x
		//y += self.translatePos.y
		self.writeln(x,y,w,h,'re h F')
	}

	self.drawFrame = function(x,y,w,title,text){
		console.warn('drawFrame is currently broken/subject to change')
		var fs = 8//self.fontSize
		console.log(self.translatePos)
		self.translateTo(x,y)
		var pos = self.translatePos;
		console.log(self.translatePos)
		self.save()
			self.setFont('Hel',fs-1)
			var titleWidth = self.calcWidth(title)
			
			self.setStrokeColor(0,0,0)
			self.setFillColor(1,1,1)
			
			self.drawRect(pos.x,pos.y,w,fs + 5)
			self.drawFilledRect(pos.x + 5,pos.y + fs + 3,titleWidth + 2,7)
			self.drawRect(pos.x + 5,pos.y + fs + 3,titleWidth + 2,7)
		self.restore()
		console.log(self.translatePos,x,y)
			//self.save()
			self.setFont('Hel',fs-1)
			self.print(title,7,12)
			self.setFont('HelB',fs)
			var xoff = self.calcCenter(text,w)
			self.print(text,xoff,2)
			//self.restore()
	}

	self.calcCenter = function(text,width){
		var w = self.calcWidth(text)
		return (width/2) - (w/2)
	}

	self.calcRight = function(text){
		var w = self.calcWidth(text)
		return -w
	}

	self.calcWidth = function(text){
		var fw = fontwidths[self.font=='Hel'?'helvetica':'helveticaBold']
		var w = 0;
		for(var i=0;i<text.length;i++)
			w += fw[text.charCodeAt(i)]
		w /= 1000
		w *= self.fontSize
		return w;
	}

	self.addObj = function(ref){
		self.metadata.Contents = self.metadata.Contents || []
		self.metadata.Contents.push(ref)
		self.imported = false
	}

	self.getTextObj = function(){
		var obj = new PDFObject()
		obj.setRaw('stream\r\nBT\r\n' + self.textStream + 'ET\r\nendstream')
		self.textStream = '';
		return obj;
	}

	return self
}

module.exports = Page